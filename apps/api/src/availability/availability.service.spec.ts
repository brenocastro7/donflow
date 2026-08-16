import { DayOfWeek, UserRole } from '@prisma/client';
import { AvailabilityService } from './availability.service';

describe('AvailabilityService', () => {
  const customer = {
    id: 'customer-id',
    role: UserRole.CUSTOMER,
    barberProfileId: null,
  };
  const master = {
    id: 'master-id',
    role: UserRole.MASTER,
    barberProfileId: 'master-profile-id',
  };
  const prisma = {
    barberService: { findFirst: jest.fn() },
    businessHour: { findMany: jest.fn() },
    scheduleBlock: { findMany: jest.fn() },
    appointment: { findMany: jest.fn() },
  };
  const service = new AvailabilityService(prisma as never);

  beforeEach(() => jest.clearAllMocks());

  it('removes blocked periods from generated slots', async () => {
    prisma.barberService.findFirst.mockResolvedValue({ durationMinutes: 30 });
    prisma.businessHour.findMany.mockResolvedValue([
      {
        dayOfWeek: DayOfWeek.MONDAY,
        startMinute: 540,
        endMinute: 600,
      },
    ]);
    prisma.scheduleBlock.findMany.mockResolvedValue([
      {
        startsAt: new Date('2099-07-13T08:15:00.000Z'),
        endsAt: new Date('2099-07-13T08:30:00.000Z'),
      },
    ]);
    prisma.appointment.findMany.mockResolvedValue([]);

    const result = await service.getAvailability(customer, {
      barberProfileId: 'profile-id',
      barberServiceId: 'service-id',
      date: '2099-07-13',
      slotInterval: 15,
    });

    expect(result.data.slots).toEqual([
      {
        startsAt: '2099-07-13T08:30:00.000Z',
        endsAt: '2099-07-13T09:00:00.000Z',
      },
    ]);
  });

  it('summarizes available slots for each day of a month', async () => {
    prisma.barberService.findFirst.mockResolvedValue({ durationMinutes: 30 });
    prisma.businessHour.findMany.mockResolvedValue([
      {
        dayOfWeek: DayOfWeek.MONDAY,
        startMinute: 540,
        endMinute: 600,
      },
    ]);
    prisma.scheduleBlock.findMany.mockResolvedValue([]);
    prisma.appointment.findMany.mockResolvedValue([]);

    const result = await service.getAvailabilityCalendar(customer, {
      barberProfileId: 'profile-id',
      barberServiceId: 'service-id',
      month: '2099-07',
      slotInterval: 15,
    });

    expect(result.data.days.find((day) => day.date === '2099-07-13')).toEqual({
      date: '2099-07-13',
      availableSlots: 3,
      isOpen: true,
    });
    expect(result.data.days.find((day) => day.date === '2099-07-14')).toEqual({
      date: '2099-07-14',
      availableSlots: 0,
      isOpen: false,
    });
  });

  it('shows future same-day slots to staff while preserving customer notice', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2099-07-13T08:00:00.000Z'));
    prisma.barberService.findFirst.mockResolvedValue({ durationMinutes: 15 });
    prisma.businessHour.findMany.mockResolvedValue([
      { dayOfWeek: DayOfWeek.MONDAY, startMinute: 540, endMinute: 600 },
    ]);
    prisma.scheduleBlock.findMany.mockResolvedValue([]);
    prisma.appointment.findMany.mockResolvedValue([]);

    const staffResult = await service.getAvailability(master, {
      barberProfileId: 'profile-id',
      barberServiceId: 'service-id',
      date: '2099-07-13',
      slotInterval: 15,
    });
    const customerResult = await service.getAvailability(customer, {
      barberProfileId: 'profile-id',
      barberServiceId: 'service-id',
      date: '2099-07-13',
      slotInterval: 15,
    });

    expect(staffResult.data.slots.length).toBeGreaterThan(0);
    expect(customerResult.data.slots).toHaveLength(0);
    jest.useRealTimers();
  });
});
