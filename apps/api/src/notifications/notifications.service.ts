import { Inject, Injectable } from '@nestjs/common';
import { NotificationStatus, NotificationType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  NOTIFICATION_PROVIDER,
  type EmailVerificationNotification,
  type NotificationProvider,
} from './notification-provider';

export interface AppointmentNotificationData {
  id: string;
  version: number;
  startsAt: Date;
  endsAt: Date;
  serviceNameSnapshot: string;
  barberProfileId: string;
  customerName?: string | null;
  barberName?: string | null;
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(NOTIFICATION_PROVIDER)
    private readonly provider: NotificationProvider,
  ) {}

  async sendEmailVerification(
    notification: Omit<EmailVerificationNotification, 'kind'>,
  ): Promise<void> {
    await this.provider.send({ kind: 'EMAIL_VERIFICATION', ...notification });
  }

  async sendPasswordReset(
    notification: Omit<
      import('./notification-provider').PasswordResetNotification,
      'kind'
    >,
  ): Promise<void> {
    await this.provider.send({ kind: 'PASSWORD_RESET', ...notification });
  }

  async sendBarberInvitation(
    notification: Omit<
      import('./notification-provider').BarberInvitationNotification,
      'kind'
    >,
  ): Promise<void> {
    await this.provider.send({ kind: 'BARBER_INVITATION', ...notification });
  }

  async queueAppointmentCreated(
    transaction: Prisma.TransactionClient,
    appointment: AppointmentNotificationData,
    customerRecipient?: string | null,
    professionalRecipient?: string | null,
    event: 'CONFIRMED' | 'RESCHEDULED' = 'CONFIRMED',
  ): Promise<void> {
    const data: Prisma.NotificationCreateManyInput[] = [];
    if (customerRecipient) {
      const payload = this.appointmentPayload(appointment, 'CUSTOMER', event);
      data.push(
        {
          appointmentId: appointment.id,
          appointmentVersion: appointment.version,
          type: NotificationType.APPOINTMENT_CONFIRMATION,
          recipient: customerRecipient,
          payload,
          scheduledAt: new Date(),
        },
        {
          appointmentId: appointment.id,
          appointmentVersion: appointment.version,
          type: NotificationType.APPOINTMENT_REMINDER,
          recipient: customerRecipient,
          payload,
          scheduledAt: new Date(
            appointment.startsAt.getTime() - 24 * 60 * 60 * 1000,
          ),
        },
      );
    }
    if (professionalRecipient) {
      data.push({
        appointmentId: appointment.id,
        appointmentVersion: appointment.version,
        type: NotificationType.APPOINTMENT_CONFIRMATION,
        recipient: professionalRecipient,
        payload: this.appointmentPayload(appointment, 'PROFESSIONAL', event),
        scheduledAt: new Date(),
      });
    }
    if (!data.length) return;
    await transaction.notification.createMany({
      data,
    });
  }

  async queueAppointmentRescheduled(
    transaction: Prisma.TransactionClient,
    appointment: AppointmentNotificationData,
    customerRecipient?: string | null,
    professionalRecipient?: string | null,
  ): Promise<void> {
    await this.cancelPending(transaction, appointment.id);
    await this.queueAppointmentCreated(
      transaction,
      appointment,
      customerRecipient,
      professionalRecipient,
      'RESCHEDULED',
    );
  }

  async queueAppointmentCancelled(
    transaction: Prisma.TransactionClient,
    appointment: AppointmentNotificationData,
    customerRecipient?: string | null,
    professionalRecipient?: string | null,
  ): Promise<void> {
    await this.cancelPending(transaction, appointment.id);
    const data = [
      ...(customerRecipient
        ? [
            {
              appointmentId: appointment.id,
              appointmentVersion: appointment.version,
              type: NotificationType.APPOINTMENT_CANCELLATION,
              recipient: customerRecipient,
              payload: this.appointmentPayload(
                appointment,
                'CUSTOMER',
                'CANCELLED',
              ),
              scheduledAt: new Date(),
            },
          ]
        : []),
      ...(professionalRecipient
        ? [
            {
              appointmentId: appointment.id,
              appointmentVersion: appointment.version,
              type: NotificationType.APPOINTMENT_CANCELLATION,
              recipient: professionalRecipient,
              payload: this.appointmentPayload(
                appointment,
                'PROFESSIONAL',
                'CANCELLED',
              ),
              scheduledAt: new Date(),
            },
          ]
        : []),
    ];
    if (data.length) await transaction.notification.createMany({ data });
  }

  async cancelPendingForAppointment(
    transaction: Prisma.TransactionClient,
    appointmentId: string,
  ): Promise<void> {
    await this.cancelPending(transaction, appointmentId);
    await transaction.inAppNotification.deleteMany({
      where: {
        appointmentId,
        scheduledAt: { gt: new Date() },
        readAt: null,
      },
    });
  }

  async queueInAppCreated(
    transaction: Prisma.TransactionClient,
    appointment: AppointmentNotificationData,
    barberUserId?: string | null,
    customerUserId?: string | null,
  ) {
    const date = this.formatAppointmentDate(appointment.startsAt);
    const customerName = appointment.customerName ?? 'Cliente';
    const barberName = appointment.barberName ?? 'o profissional escolhido';
    const rows = [
      ...(barberUserId
        ? [
            {
              userId: barberUserId,
              appointmentId: appointment.id,
              appointmentVersion: appointment.version,
              type: NotificationType.APPOINTMENT_CONFIRMATION,
              title: 'Nova marcação',
              message: `${customerName} efetuou uma marcação para ${date}.`,
              scheduledAt: new Date(),
            },
          ]
        : []),
      ...(customerUserId
        ? [
            {
              userId: customerUserId,
              appointmentId: appointment.id,
              appointmentVersion: appointment.version,
              type: NotificationType.APPOINTMENT_CONFIRMATION,
              title: 'Marcação confirmada',
              message: `A tua marcação com ${barberName} foi confirmada para ${date}.`,
              scheduledAt: new Date(),
            },
            {
              userId: customerUserId,
              appointmentId: appointment.id,
              appointmentVersion: appointment.version,
              type: NotificationType.APPOINTMENT_REMINDER,
              title: 'Lembrete da marcação',
              message: `Lembrete: a tua marcação com ${barberName} é em ${date}.`,
              scheduledAt: new Date(
                appointment.startsAt.getTime() - 24 * 60 * 60 * 1000,
              ),
            },
          ]
        : []),
    ];
    await transaction.inAppNotification.createMany({ data: rows });
  }

  async queueInAppChanged(
    transaction: Prisma.TransactionClient,
    appointment: AppointmentNotificationData,
    userIds: string[],
    kind: 'CANCELLED' | 'RESCHEDULED',
    customerUserId?: string | null,
  ) {
    const date = this.formatAppointmentDate(appointment.startsAt);
    const customerName = appointment.customerName ?? 'Cliente';
    const barberName = appointment.barberName ?? 'o profissional escolhido';
    await transaction.inAppNotification.deleteMany({
      where: {
        appointmentId: appointment.id,
        scheduledAt: { gt: new Date() },
        readAt: null,
      },
    });
    await transaction.inAppNotification.createMany({
      data: [
        ...userIds.map((userId) => ({
          userId,
          appointmentId: appointment.id,
          appointmentVersion: appointment.version,
          type:
            kind === 'CANCELLED'
              ? NotificationType.APPOINTMENT_CANCELLATION
              : NotificationType.APPOINTMENT_CONFIRMATION,
          title:
            kind === 'CANCELLED' ? 'Marcação cancelada' : 'Marcação reagendada',
          message:
            userId === customerUserId
              ? kind === 'CANCELLED'
                ? `A tua marcação com ${barberName} foi cancelada.`
                : `A tua marcação com ${barberName} foi reagendada para ${date}.`
              : kind === 'CANCELLED'
                ? `A marcação de ${customerName} foi cancelada.`
                : `A marcação de ${customerName} foi reagendada para ${date}.`,
          scheduledAt: new Date(),
        })),
        ...(kind === 'RESCHEDULED' && customerUserId
          ? [
              {
                userId: customerUserId,
                appointmentId: appointment.id,
                appointmentVersion: appointment.version,
                type: NotificationType.APPOINTMENT_REMINDER,
                title: 'Lembrete da marcação',
                message: `Lembrete: a marcação com ${barberName} é em ${date}.`,
                scheduledAt: new Date(
                  appointment.startsAt.getTime() - 24 * 60 * 60 * 1000,
                ),
              },
            ]
          : []),
      ],
    });
  }

  async listInApp(userId: string) {
    const now = new Date();
    const [data, unread] = await Promise.all([
      this.prisma.inAppNotification.findMany({
        where: { userId, scheduledAt: { lte: now } },
        orderBy: { scheduledAt: 'desc' },
        take: 30,
      }),
      this.prisma.inAppNotification.count({
        where: { userId, scheduledAt: { lte: now }, readAt: null },
      }),
    ]);
    return { data, meta: { unread } };
  }

  async markRead(userId: string, id: string) {
    await this.prisma.inAppNotification.updateMany({
      where: { id, userId },
      data: { readAt: new Date() },
    });
    return { message: 'Notificação lida.' };
  }

  async markAllRead(userId: string) {
    await this.prisma.inAppNotification.updateMany({
      where: { userId, scheduledAt: { lte: new Date() }, readAt: null },
      data: { readAt: new Date() },
    });
    return { message: 'Notificações lidas.' };
  }

  async clearInApp(userId: string) {
    await this.prisma.inAppNotification.deleteMany({
      where: { userId, scheduledAt: { lte: new Date() } },
    });
    return { message: 'Notificações eliminadas.' };
  }

  private async cancelPending(
    transaction: Prisma.TransactionClient,
    appointmentId: string,
  ): Promise<void> {
    await transaction.notification.updateMany({
      where: { appointmentId, status: NotificationStatus.PENDING },
      data: { status: NotificationStatus.CANCELLED },
    });
  }

  private appointmentPayload(
    appointment: AppointmentNotificationData,
    audience: 'CUSTOMER' | 'PROFESSIONAL',
    event: 'CONFIRMED' | 'RESCHEDULED' | 'CANCELLED',
  ): Prisma.InputJsonObject {
    return {
      appointmentId: appointment.id,
      version: appointment.version,
      startsAt: appointment.startsAt.toISOString(),
      endsAt: appointment.endsAt.toISOString(),
      serviceName: appointment.serviceNameSnapshot,
      barberProfileId: appointment.barberProfileId,
      customerName: appointment.customerName ?? 'Cliente',
      barberName: appointment.barberName ?? 'Profissional',
      audience,
      event,
    };
  }

  private formatAppointmentDate(value: Date): string {
    return new Intl.DateTimeFormat('pt-PT', {
      timeZone: 'Europe/Lisbon',
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(value);
  }
}
