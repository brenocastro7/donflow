import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AppointmentStatus,
  Prisma,
  UserRole,
  UserStatus,
} from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { profileImageDataUrl } from '../users/profile-image-url';
import { NotificationsService } from '../notifications/notifications.service';
import {
  lisbonDateMinuteToUtc,
  parseLocalDate,
  utcToLisbonDateMinute,
} from '../schedule/lisbon-time';
import {
  AppointmentCalendarQueryDto,
  AppointmentCalendarView,
  CreateAppointmentDto,
  CustomerAppointmentScope,
  CustomerAppointmentsQueryDto,
} from './dto/appointment.dto';

const ACTIVE_STATUSES: AppointmentStatus[] = [AppointmentStatus.CONFIRMED];
const CUSTOMER_CANCELLATION_WINDOW_MS = 24 * 60 * 60 * 1000;
const MINIMUM_BOOKING_NOTICE_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class AppointmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(user: AuthenticatedUser, dto: CreateAppointmentDto) {
    const service = await this.prisma.barberService.findFirst({
      where: {
        id: dto.barberServiceId,
        isActive: true,
        barberProfile: { user: { status: UserStatus.ACTIVE } },
      },
      include: {
        barberProfile: {
          select: {
            id: true,
            userId: true,
            displayName: true,
            user: { select: { email: true } },
          },
        },
      },
    });
    if (!service) {
      throw new NotFoundException(
        'Serviço ativo do profissional não encontrado.',
      );
    }

    const isLocalBooking = user.role !== UserRole.CUSTOMER;
    if (isLocalBooking && !dto.customerName?.trim()) {
      throw new BadRequestException(
        'O nome do cliente é obrigatório para marcações presenciais.',
      );
    }
    if (
      user.role === UserRole.BARBER &&
      user.barberProfileId !== service.barberProfileId
    ) {
      throw new ForbiddenException(
        'Esta conta só pode efetuar marcações na própria agenda.',
      );
    }

    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(
      startsAt.getTime() + service.durationMinutes * 60_000,
    );
    if (
      (user.role === UserRole.CUSTOMER &&
        startsAt.getTime() - Date.now() < MINIMUM_BOOKING_NOTICE_MS) ||
      (user.role !== UserRole.CUSTOMER && startsAt.getTime() <= Date.now())
    ) {
      throw new BadRequestException(
        user.role === UserRole.CUSTOMER
          ? 'A marcação exige uma antecedência mínima de 24 horas.'
          : 'A marcação deve ser efetuada para um horário futuro.',
      );
    }
    await this.assertInsideBusinessHours(
      service.barberProfileId,
      startsAt,
      endsAt,
    );

    try {
      const appointment = await this.prisma.$transaction(
        async (transaction) => {
          const customerSelector =
            user.role === UserRole.CUSTOMER
              ? { id: user.id }
              : dto.customerUserId
                ? { id: dto.customerUserId }
                : dto.customerPhone
                  ? { phone: dto.customerPhone }
                  : null;
          const customer = customerSelector
            ? await transaction.user.findFirst({
                where: {
                  role: UserRole.CUSTOMER,
                  status: UserStatus.ACTIVE,
                  ...customerSelector,
                },
                select: {
                  id: true,
                  name: true,
                  email: true,
                  phone: true,
                  customerBookingBlocked: true,
                  customerBookingLimited: true,
                },
              })
            : null;
          if (user.role === UserRole.CUSTOMER && !customer) {
            throw new NotFoundException('Cliente ativo não encontrado.');
          }
          if (customer?.customerBookingBlocked) {
            throw new ForbiddenException(
              'As marcações deste cliente estão bloqueadas.',
            );
          }
          if (
            customer?.customerBookingLimited &&
            user.role === UserRole.CUSTOMER
          ) {
            throw new ForbiddenException(
              'A próxima marcação deve ser efetuada por um profissional.',
            );
          }
          const lockIdentity =
            customer?.id ??
            `local:${dto.customerPhone ?? user.id}:${startsAt.toISOString()}`;
          await transaction.$executeRaw`
            SELECT pg_advisory_xact_lock(hashtextextended(${lockIdentity}, 0))
          `;
          // Customers have no cap on active bookings. The only quota left is the
          // no-show penalty, lifted as soon as the customer attends an appointment.
          if (customer?.customerBookingLimited) {
            const activeCount = await transaction.appointment.count({
              where: {
                customerUserId: customer.id,
                status: { in: ACTIVE_STATUSES },
              },
            });
            if (activeCount >= 1) {
              throw new ConflictException(
                'O cliente só pode possuir uma marcação ativa.',
              );
            }
          }
          const blocked = await transaction.scheduleBlock.findFirst({
            where: {
              barberProfileId: service.barberProfileId,
              startsAt: { lt: endsAt },
              endsAt: { gt: startsAt },
            },
          });
          const overlap = await transaction.appointment.findFirst({
            where: {
              barberProfileId: service.barberProfileId,
              status: { in: ACTIVE_STATUSES },
              startsAt: { lt: endsAt },
              endsAt: { gt: startsAt },
            },
          });
          if (blocked || overlap) {
            throw new ConflictException(
              'O horário selecionado não está disponível.',
            );
          }
          const created = await transaction.appointment.create({
            data: {
              customerUserId: customer?.id,
              localCustomerName: customer
                ? undefined
                : dto.customerName!.trim(),
              localCustomerPhone: customer ? undefined : dto.customerPhone,
              barberProfileId: service.barberProfileId,
              barberServiceId: service.id,
              startsAt,
              endsAt,
              origin: user.role,
              serviceNameSnapshot: service.name,
              durationSnapshot: service.durationMinutes,
              priceSnapshot: service.price,
              notes: dto.notes?.trim(),
            },
          });
          await transaction.appointmentHistory.create({
            data: {
              appointmentId: created.id,
              actorUserId: user.id,
              action: 'APPOINTMENT_CREATED',
              currentData: this.historySnapshot(created),
            },
          });
          const notificationAppointment = {
            ...created,
            customerName:
              customer?.name ?? created.localCustomerName ?? 'Cliente',
            barberName: service.barberProfile.displayName,
          };
          // The professional doesn't need to be told about a booking they
          // just made themselves — only about ones created on their behalf.
          const isSelfBooking = user.id === service.barberProfile.userId;
          const professionalEmail = isSelfBooking
            ? undefined
            : service.barberProfile.user?.email;
          if (customer?.email || professionalEmail) {
            await this.notificationsService.queueAppointmentCreated(
              transaction,
              notificationAppointment,
              customer?.email,
              ...(professionalEmail ? [professionalEmail] : []),
            );
          }
          await this.notificationsService.queueInAppCreated(
            transaction,
            notificationAppointment,
            isSelfBooking ? undefined : service.barberProfile.userId,
            customer?.id,
          );
          return created;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      return { data: appointment };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        ['P2004', 'P2034'].includes(error.code)
      ) {
        throw new ConflictException(
          'A marcação entra em conflito com outro pedido.',
        );
      }
      throw error;
    }
  }

  async list(user: AuthenticatedUser, query: AppointmentCalendarQueryDto) {
    const period = this.calendarPeriod(query.view, query.date);
    const barberProfileId = this.resolveCalendarBarber(user, query);
    const where: Prisma.AppointmentWhereInput = {
      startsAt: { lt: period.endsAt },
      endsAt: { gt: period.startsAt },
      ...(user.role === UserRole.CUSTOMER
        ? { customerUserId: user.id }
        : { barberProfileId }),
      ...(user.role === UserRole.CUSTOMER && query.barberProfileId
        ? { barberProfileId: query.barberProfileId }
        : {}),
      ...(query.status ? { status: query.status } : {}),
    };
    const [appointments, total] = await Promise.all([
      this.prisma.appointment.findMany({
        where,
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              phone: true,
              profileImage: true,
              profileImageMimeType: true,
              profileImageKey: true,
              updatedAt: true,
            },
          },
          barberProfile: {
            select: {
              id: true,
              displayName: true,
              user: { select: { name: true, status: true } },
            },
          },
        },
        orderBy: { startsAt: 'asc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.appointment.count({ where }),
    ]);
    return {
      data: appointments.map((appointment) =>
        this.withCustomerProfileImage(appointment),
      ),
      meta: {
        view: query.view,
        date: query.date,
        timeZone: 'Europe/Lisbon',
        startsAt: period.startsAt.toISOString(),
        endsAt: period.endsAt.toISOString(),
        barberProfileId:
          user.role === UserRole.CUSTOMER
            ? (query.barberProfileId ?? null)
            : barberProfileId,
        status: query.status ?? null,
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      },
    };
  }

  async detail(user: AuthenticatedUser, id: string) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            phone: true,
            profileImage: true,
            profileImageMimeType: true,
            profileImageKey: true,
            updatedAt: true,
          },
        },
        barberProfile: {
          select: {
            id: true,
            displayName: true,
            user: { select: { id: true, name: true, status: true } },
          },
        },
        barberService: {
          select: { id: true, isActive: true },
        },
      },
    });
    if (!appointment) {
      throw new NotFoundException('Marcação não encontrada.');
    }
    this.assertOperationalAccess(user, appointment);
    return { data: this.withCustomerProfileImage(appointment) };
  }

  async listMine(user: AuthenticatedUser, query: CustomerAppointmentsQueryDto) {
    if (user.role !== UserRole.CUSTOMER) {
      throw new ForbiddenException('Esta consulta é exclusiva para clientes.');
    }
    const customer = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { phone: true },
    });
    const customerIdentity: Prisma.AppointmentWhereInput = customer?.phone
      ? {
          OR: [
            { customerUserId: user.id },
            { customerUserId: null, localCustomerPhone: customer.phone },
          ],
        }
      : { customerUserId: user.id };
    const where: Prisma.AppointmentWhereInput = {
      ...customerIdentity,
      ...(query.scope === CustomerAppointmentScope.UPCOMING
        ? { status: AppointmentStatus.CONFIRMED, startsAt: { gte: new Date() } }
        : {
            status: {
              in: [
                AppointmentStatus.COMPLETED,
                AppointmentStatus.NO_SHOW,
                AppointmentStatus.CANCELLED,
              ],
            },
          }),
    };
    const [appointments, total] = await Promise.all([
      this.prisma.appointment.findMany({
        where,
        include: {
          barberProfile: {
            select: { id: true, displayName: true },
          },
        },
        orderBy: {
          startsAt:
            query.scope === CustomerAppointmentScope.UPCOMING ? 'asc' : 'desc',
        },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.appointment.count({ where }),
    ]);
    return {
      data: appointments,
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      },
    };
  }

  async cancel(user: AuthenticatedUser, id: string, reason?: string) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
      include: {
        customer: { select: { id: true, name: true, email: true } },
        barberProfile: {
          select: {
            userId: true,
            displayName: true,
            user: { select: { email: true } },
          },
        },
      },
    });
    if (!appointment) {
      throw new NotFoundException('Marcação não encontrada.');
    }
    if (!ACTIVE_STATUSES.includes(appointment.status)) {
      throw new ConflictException('A marcação não está ativa.');
    }
    if (user.role === UserRole.CUSTOMER) {
      if (appointment.customerUserId !== user.id) {
        throw new ForbiddenException('A marcação não pertence ao cliente.');
      }
      if (
        appointment.startsAt.getTime() - Date.now() <
        CUSTOMER_CANCELLATION_WINDOW_MS
      ) {
        throw new ForbiddenException(
          'O cancelamento pelo cliente exige uma antecedência mínima de 24 horas.',
        );
      }
    } else if (
      user.role === UserRole.BARBER &&
      appointment.barberProfileId !== user.barberProfileId
    ) {
      throw new ForbiddenException(
        'A marcação não pertence à agenda desta conta.',
      );
    }

    const updated = await this.prisma.$transaction(async (transaction) => {
      const cancelled = await transaction.appointment.update({
        where: { id },
        data: {
          status: AppointmentStatus.CANCELLED,
          cancelledAt: new Date(),
          cancellationReason: reason?.trim(),
          version: { increment: 1 },
        },
      });
      await transaction.appointmentHistory.create({
        data: {
          appointmentId: id,
          actorUserId: user.id,
          action: 'APPOINTMENT_CANCELLED',
          previousData: this.historySnapshot(appointment),
          currentData: this.historySnapshot(cancelled),
        },
      });
      const notificationAppointment = {
        ...cancelled,
        customerName:
          appointment.customer?.name ??
          appointment.localCustomerName ??
          'Cliente',
        barberName: appointment.barberProfile.displayName,
      };
      const cancelledBySelf = user.id === appointment.barberProfile.userId;
      const cancellationProfessionalEmail = cancelledBySelf
        ? undefined
        : appointment.barberProfile.user?.email;
      if (appointment.customer?.email || cancellationProfessionalEmail) {
        await this.notificationsService.queueAppointmentCancelled(
          transaction,
          notificationAppointment,
          appointment.customer?.email,
          ...(cancellationProfessionalEmail
            ? [cancellationProfessionalEmail]
            : []),
        );
      }
      await this.notificationsService.queueInAppChanged(
        transaction,
        notificationAppointment,
        [appointment.barberProfile.userId, appointment.customer?.id].filter(
          (id): id is string => Boolean(id),
        ),
        'CANCELLED',
        appointment.customer?.id,
      );
      return cancelled;
    });
    return { data: updated };
  }

  async reschedule(user: AuthenticatedUser, id: string, startsAtValue: string) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
      include: {
        customer: { select: { id: true, name: true, email: true } },
        barberProfile: {
          select: {
            userId: true,
            displayName: true,
            user: { select: { email: true } },
          },
        },
      },
    });
    if (!appointment) {
      throw new NotFoundException('Marcação não encontrada.');
    }
    if (!ACTIVE_STATUSES.includes(appointment.status)) {
      throw new ConflictException('A marcação não está ativa.');
    }
    this.assertOperationalAccess(user, appointment);
    if (
      user.role === UserRole.CUSTOMER &&
      appointment.startsAt.getTime() - Date.now() <
        CUSTOMER_CANCELLATION_WINDOW_MS
    ) {
      throw new ForbiddenException(
        'A remarcação pelo cliente exige uma antecedência mínima de 24 horas.',
      );
    }

    const startsAt = new Date(startsAtValue);
    if (
      (user.role === UserRole.CUSTOMER &&
        startsAt.getTime() - Date.now() < MINIMUM_BOOKING_NOTICE_MS) ||
      (user.role !== UserRole.CUSTOMER && startsAt.getTime() <= Date.now())
    ) {
      throw new BadRequestException(
        user.role === UserRole.CUSTOMER
          ? 'A marcação exige uma antecedência mínima de 24 horas.'
          : 'A marcação deve ser reagendada para um horário futuro.',
      );
    }
    const endsAt = new Date(
      startsAt.getTime() + appointment.durationSnapshot * 60_000,
    );
    await this.assertInsideBusinessHours(
      appointment.barberProfileId,
      startsAt,
      endsAt,
    );

    try {
      const updated = await this.prisma.$transaction(
        async (transaction) => {
          const blocked = await transaction.scheduleBlock.findFirst({
            where: {
              barberProfileId: appointment.barberProfileId,
              startsAt: { lt: endsAt },
              endsAt: { gt: startsAt },
            },
          });
          const overlap = await transaction.appointment.findFirst({
            where: {
              id: { not: id },
              barberProfileId: appointment.barberProfileId,
              status: { in: ACTIVE_STATUSES },
              startsAt: { lt: endsAt },
              endsAt: { gt: startsAt },
            },
          });
          if (blocked || overlap) {
            throw new ConflictException(
              'O horário selecionado não está disponível.',
            );
          }
          const rescheduled = await transaction.appointment.update({
            where: { id, version: appointment.version },
            data: { startsAt, endsAt, version: { increment: 1 } },
          });
          await transaction.appointmentHistory.create({
            data: {
              appointmentId: id,
              actorUserId: user.id,
              action: 'APPOINTMENT_RESCHEDULED',
              previousData: this.historySnapshot(appointment),
              currentData: this.historySnapshot(rescheduled),
            },
          });
          const notificationAppointment = {
            ...rescheduled,
            customerName:
              appointment.customer?.name ??
              appointment.localCustomerName ??
              'Cliente',
            barberName: appointment.barberProfile.displayName,
          };
          const rescheduledBySelf =
            user.id === appointment.barberProfile.userId;
          const rescheduleProfessionalEmail = rescheduledBySelf
            ? undefined
            : appointment.barberProfile.user?.email;
          if (appointment.customer?.email || rescheduleProfessionalEmail) {
            await this.notificationsService.queueAppointmentRescheduled(
              transaction,
              notificationAppointment,
              appointment.customer?.email,
              ...(rescheduleProfessionalEmail
                ? [rescheduleProfessionalEmail]
                : []),
            );
          }
          await this.notificationsService.queueInAppChanged(
            transaction,
            notificationAppointment,
            [appointment.barberProfile.userId, appointment.customer?.id].filter(
              (userId): userId is string => Boolean(userId),
            ),
            'RESCHEDULED',
            appointment.customer?.id,
          );
          return rescheduled;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      return { data: updated };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        ['P2004', 'P2025', 'P2034'].includes(error.code)
      ) {
        throw new ConflictException(
          'A marcação entra em conflito com outro pedido.',
        );
      }
      throw error;
    }
  }

  async updateStatus(
    user: AuthenticatedUser,
    id: string,
    status: 'COMPLETED' | 'NO_SHOW',
    justification?: string,
  ) {
    if (user.role === UserRole.CUSTOMER) {
      throw new ForbiddenException(
        'Os clientes não podem concluir marcações nem registar faltas.',
      );
    }
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
    });
    if (!appointment) {
      throw new NotFoundException('Marcação não encontrada.');
    }
    const canCorrectAutomaticCompletion =
      status === AppointmentStatus.NO_SHOW &&
      appointment.status === AppointmentStatus.COMPLETED &&
      Boolean(appointment.autoCompletedAt);
    if (
      appointment.status !== AppointmentStatus.CONFIRMED &&
      !canCorrectAutomaticCompletion
    ) {
      throw new ConflictException(
        'Apenas marcações confirmadas podem ser encerradas.',
      );
    }
    this.assertOperationalAccess(user, appointment);
    if (appointment.startsAt > new Date()) {
      throw new ConflictException(
        'A marcação não pode ser encerrada antes da hora prevista.',
      );
    }

    try {
      const updated = await this.prisma.$transaction(async (transaction) => {
        const closed = await transaction.appointment.update({
          where: { id, version: appointment.version },
          data: {
            status,
            noShowJustification:
              status === AppointmentStatus.NO_SHOW
                ? justification?.trim() || null
                : null,
            autoCompletedAt: null,
            version: { increment: 1 },
          },
        });
        await transaction.appointmentHistory.create({
          data: {
            appointmentId: id,
            actorUserId: user.id,
            action:
              status === AppointmentStatus.COMPLETED
                ? 'APPOINTMENT_COMPLETED'
                : 'APPOINTMENT_NO_SHOW',
            previousData: this.historySnapshot(appointment),
            currentData: this.historySnapshot(closed),
          },
        });
        await this.notificationsService.cancelPendingForAppointment(
          transaction,
          id,
        );
        if (appointment.customerUserId) {
          if (status === AppointmentStatus.COMPLETED) {
            await transaction.user.updateMany({
              where: { id: appointment.customerUserId },
              data: { customerBookingLimited: false },
            });
          } else if (!justification?.trim()) {
            await transaction.user.updateMany({
              where: { id: appointment.customerUserId },
              data: { customerBookingLimited: true },
            });
          }
        }
        return closed;
      });
      return { data: updated };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new ConflictException(
          'A marcação foi alterada por outro pedido.',
        );
      }
      throw error;
    }
  }

  async history(user: AuthenticatedUser, id: string) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
      select: { customerUserId: true, barberProfileId: true },
    });
    if (!appointment) {
      throw new NotFoundException('Marcação não encontrada.');
    }
    this.assertOperationalAccess(user, appointment);
    return {
      data: await this.prisma.appointmentHistory.findMany({
        where: { appointmentId: id },
        orderBy: { createdAt: 'asc' },
      }),
    };
  }

  async completeDueAppointments(): Promise<number> {
    const due = await this.prisma.appointment.findMany({
      where: {
        status: AppointmentStatus.CONFIRMED,
        endsAt: { lte: new Date() },
      },
      orderBy: { endsAt: 'asc' },
      take: 100,
    });
    let completed = 0;
    for (const appointment of due) {
      try {
        await this.prisma.$transaction(async (transaction) => {
          const closed = await transaction.appointment.update({
            where: {
              id: appointment.id,
              version: appointment.version,
              status: AppointmentStatus.CONFIRMED,
            },
            data: {
              status: AppointmentStatus.COMPLETED,
              autoCompletedAt: new Date(),
              version: { increment: 1 },
            },
          });
          await transaction.appointmentHistory.create({
            data: {
              appointmentId: appointment.id,
              actorUserId: null,
              action: 'APPOINTMENT_AUTO_COMPLETED',
              previousData: this.historySnapshot(appointment),
              currentData: this.historySnapshot(closed),
            },
          });
          await this.notificationsService.cancelPendingForAppointment(
            transaction,
            appointment.id,
          );
          if (appointment.customerUserId) {
            await transaction.user.updateMany({
              where: { id: appointment.customerUserId },
              data: { customerBookingLimited: false },
            });
          }
        });
        completed += 1;
      } catch (error) {
        if (!(
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2025'
        )) {
          throw error;
        }
      }
    }
    return completed;
  }

  private assertOperationalAccess(
    user: AuthenticatedUser,
    appointment: {
      customerUserId: string | null;
      barberProfileId: string;
    },
  ): void {
    if (
      (user.role === UserRole.CUSTOMER &&
        appointment.customerUserId !== user.id) ||
      (user.role === UserRole.BARBER &&
        appointment.barberProfileId !== user.barberProfileId)
    ) {
      throw new ForbiddenException(
        'A marcação não pertence ao âmbito deste utilizador.',
      );
    }
  }

  private resolveCalendarBarber(
    user: AuthenticatedUser,
    query: AppointmentCalendarQueryDto,
  ): string | undefined {
    if (user.role === UserRole.CUSTOMER) {
      return undefined;
    }
    if (user.role === UserRole.BARBER) {
      if (
        query.barberProfileId &&
        query.barberProfileId !== user.barberProfileId
      ) {
        throw new ForbiddenException(
          'Esta conta só pode consultar a própria agenda.',
        );
      }
      if (!user.barberProfileId) {
        throw new ForbiddenException('É necessário um perfil de agenda.');
      }
      return user.barberProfileId;
    }
    const barberProfileId = query.barberProfileId ?? user.barberProfileId;
    if (!barberProfileId) {
      throw new BadRequestException('É necessário um perfil de agenda.');
    }
    return barberProfileId;
  }

  private calendarPeriod(
    view: AppointmentCalendarView,
    date: string,
  ): { startsAt: Date; endsAt: Date } {
    let parsed: ReturnType<typeof parseLocalDate>;
    try {
      parsed = parseLocalDate(date);
    } catch {
      throw new BadRequestException('A data é inválida.');
    }
    const anchor = new Date(
      Date.UTC(parsed.year, parsed.month - 1, parsed.day),
    );
    let start = anchor;
    let end: Date;

    if (view === AppointmentCalendarView.WEEK) {
      const mondayOffset = (anchor.getUTCDay() + 6) % 7;
      start = new Date(anchor);
      start.setUTCDate(start.getUTCDate() - mondayOffset);
      end = new Date(start);
      end.setUTCDate(end.getUTCDate() + 7);
    } else if (view === AppointmentCalendarView.MONTH) {
      start = new Date(Date.UTC(parsed.year, parsed.month - 1, 1));
      end = new Date(Date.UTC(parsed.year, parsed.month, 1));
    } else {
      end = new Date(start);
      end.setUTCDate(end.getUTCDate() + 1);
    }

    const localDate = (value: Date) => value.toISOString().slice(0, 10);
    return {
      startsAt: lisbonDateMinuteToUtc(localDate(start), 0),
      endsAt: lisbonDateMinuteToUtc(localDate(end), 0),
    };
  }

  private historySnapshot(appointment: {
    startsAt: Date;
    endsAt: Date;
    status: AppointmentStatus;
    version: number;
    serviceNameSnapshot: string;
    durationSnapshot: number;
    priceSnapshot: Prisma.Decimal;
  }): Prisma.InputJsonObject {
    return {
      startsAt: appointment.startsAt.toISOString(),
      endsAt: appointment.endsAt.toISOString(),
      status: appointment.status,
      version: appointment.version,
      serviceName: appointment.serviceNameSnapshot,
      durationMinutes: appointment.durationSnapshot,
      informationalPrice: appointment.priceSnapshot.toString(),
    };
  }

  private async assertInsideBusinessHours(
    barberProfileId: string,
    startsAt: Date,
    endsAt: Date,
  ): Promise<void> {
    const start = utcToLisbonDateMinute(startsAt);
    const end = utcToLisbonDateMinute(endsAt);
    if (start.date !== end.date) {
      throw new BadRequestException('A marcação deve terminar no mesmo dia.');
    }
    const containingRange = await this.prisma.businessHour.findFirst({
      where: {
        barberProfileId,
        dayOfWeek: start.dayOfWeek,
        startMinute: { lte: start.minute },
        endMinute: { gte: end.minute },
      },
    });
    if (!containingRange) {
      throw new BadRequestException(
        'A marcação deve estar dentro do horário de funcionamento.',
      );
    }
  }

  private withCustomerProfileImage<
    T extends {
      customer?:
        | ({
            profileImage: Uint8Array | null;
            profileImageMimeType: string | null;
            profileImageKey: string | null;
            id: string;
            updatedAt: Date;
          } & Record<string, unknown>)
        | null;
    },
  >(appointment: T) {
    if (!appointment.customer) return appointment;
    const { profileImage, profileImageMimeType, ...customer } =
      appointment.customer;
    void profileImage;
    void profileImageMimeType;
    return {
      ...appointment,
      customer: {
        ...customer,
        profileImageDataUrl: profileImageDataUrl(appointment.customer),
      },
    };
  }
}
