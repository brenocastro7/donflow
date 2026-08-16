import { BadRequestException } from '@nestjs/common';
import { DayOfWeek, UserRole } from '@prisma/client';
import { ScheduleService } from './schedule.service';

describe('ScheduleService', () => {
  const prisma = {
    businessHour: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const authorization = { assertBarberOwnership: jest.fn() };
  const service = new ScheduleService(prisma as never, authorization as never);
  const user = {
    id: 'user-id',
    role: UserRole.BARBER,
    barberProfileId: 'profile-id',
  };

  beforeEach(() => jest.clearAllMocks());

  it('rejects overlapping business hour ranges', async () => {
    await expect(
      service.replaceBusinessHours(user, 'profile-id', [
        {
          dayOfWeek: DayOfWeek.MONDAY,
          startMinute: 540,
          endMinute: 780,
        },
        {
          dayOfWeek: DayOfWeek.MONDAY,
          startMinute: 720,
          endMinute: 840,
        },
      ]),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
