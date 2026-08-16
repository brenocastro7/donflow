import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AppointmentStatus, UserRole, UserStatus } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { AvailabilityQueryDto } from './dto/availability-query.dto';
import { AvailabilityCalendarQueryDto } from './dto/availability-query.dto';
import {
  dayOfWeekForDate,
  lisbonDateMinuteToUtc,
  parseLocalDate,
} from '../schedule/lisbon-time';

@Injectable()
export class AvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  async getAvailability(user: AuthenticatedUser, query: AvailabilityQueryDto) {
    this.assertCalendarAccess(user, query.barberProfileId);
    try {
      parseLocalDate(query.date);
    } catch {
      throw new BadRequestException('A data é inválida.');
    }

    const service = await this.prisma.barberService.findFirst({
      where: {
        id: query.barberServiceId,
        barberProfileId: query.barberProfileId,
        isActive: true,
        barberProfile: { user: { status: UserStatus.ACTIVE } },
      },
      select: { durationMinutes: true },
    });
    if (!service) {
      throw new NotFoundException(
        'Serviço ativo do profissional não encontrado.',
      );
    }

    const dayOfWeek = dayOfWeekForDate(query.date);
    const hours = await this.prisma.businessHour.findMany({
      where: { barberProfileId: query.barberProfileId, dayOfWeek },
      orderBy: { startMinute: 'asc' },
    });
    const dayStart = lisbonDateMinuteToUtc(query.date, 0);
    const dayEnd = lisbonDateMinuteToUtc(query.date, 1440);
    const [blocks, appointments] = await Promise.all([
      this.prisma.scheduleBlock.findMany({
        where: {
          barberProfileId: query.barberProfileId,
          startsAt: { lt: dayEnd },
          endsAt: { gt: dayStart },
        },
        select: { startsAt: true, endsAt: true },
      }),
      this.prisma.appointment.findMany({
        where: {
          barberProfileId: query.barberProfileId,
          status: AppointmentStatus.CONFIRMED,
          startsAt: { lt: dayEnd },
          endsAt: { gt: dayStart },
        },
        select: { startsAt: true, endsAt: true },
      }),
    ]);
    const occupied = [...blocks, ...appointments];
    const earliestBooking = this.earliestBooking(user);
    const slots: Array<{ startsAt: string; endsAt: string }> = [];

    for (const range of hours) {
      for (
        let minute = range.startMinute;
        minute + service.durationMinutes <= range.endMinute;
        minute += query.slotInterval
      ) {
        const startsAt = lisbonDateMinuteToUtc(query.date, minute);
        const endsAt = new Date(
          startsAt.getTime() + service.durationMinutes * 60_000,
        );
        if (
          startsAt >= earliestBooking &&
          !occupied.some(
            (period) => period.startsAt < endsAt && period.endsAt > startsAt,
          )
        ) {
          slots.push({
            startsAt: startsAt.toISOString(),
            endsAt: endsAt.toISOString(),
          });
        }
      }
    }

    return {
      data: {
        date: query.date,
        timeZone: 'Europe/Lisbon',
        barberProfileId: query.barberProfileId,
        barberServiceId: query.barberServiceId,
        slots,
      },
    };
  }

  async getAvailabilityCalendar(
    user: AuthenticatedUser,
    query: AvailabilityCalendarQueryDto,
  ) {
    this.assertCalendarAccess(user, query.barberProfileId);
    const [year, month] = query.month.split('-').map(Number);
    if (!year || month < 1 || month > 12) {
      throw new BadRequestException('O mês é inválido.');
    }

    const service = await this.prisma.barberService.findFirst({
      where: {
        id: query.barberServiceId,
        barberProfileId: query.barberProfileId,
        isActive: true,
        barberProfile: { user: { status: UserStatus.ACTIVE } },
      },
      select: { durationMinutes: true },
    });
    if (!service) {
      throw new NotFoundException(
        'Serviço ativo do profissional não encontrado.',
      );
    }

    const monthStartDate = `${query.month}-01`;
    const nextMonth = new Date(Date.UTC(year, month, 1));
    const monthEndDate = nextMonth.toISOString().slice(0, 10);
    const rangeStart = lisbonDateMinuteToUtc(monthStartDate, 0);
    const rangeEnd = lisbonDateMinuteToUtc(monthEndDate, 0);
    const [hours, blocks, appointments] = await Promise.all([
      this.prisma.businessHour.findMany({
        where: { barberProfileId: query.barberProfileId },
        orderBy: { startMinute: 'asc' },
      }),
      this.prisma.scheduleBlock.findMany({
        where: {
          barberProfileId: query.barberProfileId,
          startsAt: { lt: rangeEnd },
          endsAt: { gt: rangeStart },
        },
        select: { startsAt: true, endsAt: true },
      }),
      this.prisma.appointment.findMany({
        where: {
          barberProfileId: query.barberProfileId,
          status: AppointmentStatus.CONFIRMED,
          startsAt: { lt: rangeEnd },
          endsAt: { gt: rangeStart },
        },
        select: { startsAt: true, endsAt: true },
      }),
    ]);

    const occupied = [...blocks, ...appointments];
    const earliestBooking = this.earliestBooking(user);
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const days = Array.from({ length: daysInMonth }, (_, index) => {
      const date = `${query.month}-${String(index + 1).padStart(2, '0')}`;
      const dayHours = hours.filter(
        (range) => range.dayOfWeek === dayOfWeekForDate(date),
      );
      let availableSlots = 0;

      for (const range of dayHours) {
        for (
          let minute = range.startMinute;
          minute + service.durationMinutes <= range.endMinute;
          minute += query.slotInterval
        ) {
          const startsAt = lisbonDateMinuteToUtc(date, minute);
          const endsAt = new Date(
            startsAt.getTime() + service.durationMinutes * 60_000,
          );
          if (
            startsAt >= earliestBooking &&
            !occupied.some(
              (period) => period.startsAt < endsAt && period.endsAt > startsAt,
            )
          ) {
            availableSlots += 1;
          }
        }
      }

      return {
        date,
        availableSlots,
        isOpen: dayHours.length > 0,
      };
    });

    return {
      data: {
        month: query.month,
        timeZone: 'Europe/Lisbon',
        barberProfileId: query.barberProfileId,
        barberServiceId: query.barberServiceId,
        days,
      },
    };
  }

  private earliestBooking(user: AuthenticatedUser): Date {
    return new Date(
      Date.now() + (user.role === UserRole.CUSTOMER ? 24 * 60 * 60 * 1000 : 1),
    );
  }

  private assertCalendarAccess(
    user: AuthenticatedUser,
    barberProfileId: string,
  ): void {
    if (
      user.role === UserRole.BARBER &&
      user.barberProfileId !== barberProfileId
    ) {
      throw new ForbiddenException(
        'Esta conta só pode consultar a própria disponibilidade.',
      );
    }
  }
}
