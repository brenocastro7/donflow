import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AuthorizationService } from '../auth/authorization.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  BusinessHourItemDto,
  CreateScheduleBlockDto,
} from './dto/schedule.dto';

@Injectable()
export class ScheduleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: AuthorizationService,
  ) {}

  async getBusinessHours(barberProfileId: string) {
    return {
      data: await this.prisma.businessHour.findMany({
        where: { barberProfileId },
        orderBy: [{ dayOfWeek: 'asc' }, { startMinute: 'asc' }],
      }),
    };
  }

  async replaceBusinessHours(
    user: AuthenticatedUser,
    barberProfileId: string,
    hours: BusinessHourItemDto[],
  ) {
    this.authorization.assertBarberOwnership(user, barberProfileId);
    this.validateHours(hours);
    await this.prisma.$transaction([
      this.prisma.businessHour.deleteMany({ where: { barberProfileId } }),
      this.prisma.businessHour.createMany({
        data: hours.map((hour) => ({ ...hour, barberProfileId })),
      }),
    ]);
    return this.getBusinessHours(barberProfileId);
  }

  async createBlock(
    user: AuthenticatedUser,
    barberProfileId: string,
    dto: CreateScheduleBlockDto,
  ) {
    this.authorization.assertBarberOwnership(user, barberProfileId);
    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);
    if (startsAt >= endsAt) {
      throw new BadRequestException(
        'O fim do bloqueio deve ser posterior ao início.',
      );
    }
    return {
      data: await this.prisma.scheduleBlock.create({
        data: {
          barberProfileId,
          startsAt,
          endsAt,
          reason: dto.reason?.trim(),
        },
      }),
    };
  }

  async getBlocks(user: AuthenticatedUser, barberProfileId: string) {
    this.authorization.assertBarberOwnership(user, barberProfileId);
    return {
      data: await this.prisma.scheduleBlock.findMany({
        where: { barberProfileId, endsAt: { gte: new Date() } },
        orderBy: { startsAt: 'asc' },
      }),
    };
  }

  async deleteBlock(user: AuthenticatedUser, id: string) {
    const block = await this.prisma.scheduleBlock.findUnique({
      where: { id },
      select: { barberProfileId: true },
    });
    if (!block) {
      throw new NotFoundException('Bloqueio de agenda não encontrado.');
    }
    this.authorization.assertBarberOwnership(user, block.barberProfileId);
    await this.prisma.scheduleBlock.delete({ where: { id } });
    return { message: 'Bloqueio de agenda eliminado com sucesso.' };
  }

  private validateHours(hours: BusinessHourItemDto[]): void {
    for (const hour of hours) {
      if (hour.startMinute >= hour.endMinute) {
        throw new BadRequestException(
          'O fim do horário de funcionamento deve ser posterior ao início.',
        );
      }
      const overlaps = hours.some(
        (candidate) =>
          candidate !== hour &&
          candidate.dayOfWeek === hour.dayOfWeek &&
          candidate.startMinute < hour.endMinute &&
          candidate.endMinute > hour.startMinute,
      );
      if (overlaps) {
        throw new BadRequestException(
          'Os horários de funcionamento não podem sobrepor-se.',
        );
      }
    }
  }
}
