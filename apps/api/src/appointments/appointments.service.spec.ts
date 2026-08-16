import { ConflictException, ForbiddenException } from '@nestjs/common';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { AppointmentStatus, Prisma, UserRole } from '@prisma/client';
import { AppointmentsService } from './appointments.service';
import { AppointmentCalendarView } from './dto/appointment.dto';

function futureAppointmentStart(daysAhead: number): Date {
  const startsAt = new Date();
  startsAt.setUTCDate(startsAt.getUTCDate() + daysAhead);
  startsAt.setUTCHours(10, 0, 0, 0);
  return startsAt;
}

describe('AppointmentsService', () => {
  const prisma = {
    user: {
      findFirst: jest.fn(),
      updateMany: jest.fn(),
    },
    barberService: {
      findFirst: jest.fn(),
    },
    businessHour: {
      findFirst: jest.fn(),
    },
    scheduleBlock: {
      findFirst: jest.fn(),
    },
    appointment: {
      count: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    appointmentHistory: {
      create: jest.fn(),
    },
    $executeRaw: jest.fn(),
    $transaction: jest.fn(
      async (
        callback: (transaction: {
          appointment: typeof prisma.appointment;
          appointmentHistory: typeof prisma.appointmentHistory;
        }) => Promise<unknown>,
      ) => callback(prisma),
    ),
  };
  const notificationsService = {
    queueAppointmentCreated: jest.fn(),
    queueAppointmentCancelled: jest.fn(),
    queueAppointmentRescheduled: jest.fn(),
    queueInAppCreated: jest.fn(),
    queueInAppChanged: jest.fn(),
    cancelPendingForAppointment: jest.fn(),
  };
  const service = new AppointmentsService(
    prisma as never,
    notificationsService as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.appointment.count.mockResolvedValue(0);
    prisma.businessHour.findFirst.mockResolvedValue({ id: 'hours-id' });
    prisma.scheduleBlock.findFirst.mockResolvedValue(null);
    prisma.appointment.findFirst.mockResolvedValue(null);
  });

  it('allows staff to create a same-day local appointment without a customer account', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2099-07-13T08:00:00.000Z'));
    const startsAt = new Date('2099-07-13T08:30:00.000Z');
    const created = {
      id: 'local-appointment-id',
      customerUserId: null,
      localCustomerName: 'Cliente local',
      localCustomerPhone: '+351912345678',
      barberProfileId: 'barber-id',
      barberServiceId: 'service-id',
      startsAt,
      endsAt: new Date(startsAt.getTime() + 30 * 60 * 1000),
      status: AppointmentStatus.CONFIRMED,
      origin: UserRole.BARBER,
      serviceNameSnapshot: 'Corte',
      durationSnapshot: 30,
      priceSnapshot: new Prisma.Decimal(20),
      notes: null,
      cancellationReason: null,
      cancelledAt: null,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    prisma.barberService.findFirst.mockResolvedValue({
      id: 'service-id',
      barberProfileId: 'barber-id',
      durationMinutes: 30,
      name: 'Corte',
      price: new Prisma.Decimal(20),
      barberProfile: { id: 'barber-id' },
    });
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.appointment.create.mockResolvedValue(created);

    const result = await service.create(
      {
        id: 'barber-user-id',
        role: UserRole.BARBER,
        barberProfileId: 'barber-id',
      },
      {
        barberServiceId: 'service-id',
        startsAt: startsAt.toISOString(),
        customerName: ' Cliente local ',
        customerPhone: '+351912345678',
      },
    );

    expect(result.data).toBe(created);
    expect(prisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ phone: '+351912345678' }),
      }),
    );
    expect(prisma.appointment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          customerUserId: undefined,
          localCustomerName: 'Cliente local',
          localCustomerPhone: '+351912345678',
        }),
      }),
    );
    expect(notificationsService.queueAppointmentCreated).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  it('links a local appointment when the phone belongs to a customer', async () => {
    const startsAt = futureAppointmentStart(3);
    prisma.barberService.findFirst.mockResolvedValue({
      id: 'service-id',
      barberProfileId: 'barber-id',
      durationMinutes: 30,
      name: 'Corte',
      price: new Prisma.Decimal(20),
      barberProfile: { id: 'barber-id' },
    });
    prisma.user.findFirst.mockResolvedValue({
      id: 'registered-customer-id',
      name: 'Cliente registado',
      email: 'cliente@example.com',
      phone: '+351912345678',
    });
    prisma.appointment.create.mockResolvedValue({
      id: 'linked-appointment-id',
      customerUserId: 'registered-customer-id',
      barberProfileId: 'barber-id',
      startsAt,
      endsAt: new Date(startsAt.getTime() + 30 * 60 * 1000),
      status: AppointmentStatus.CONFIRMED,
      version: 1,
      serviceNameSnapshot: 'Corte',
      durationSnapshot: 30,
      priceSnapshot: new Prisma.Decimal(20),
    });

    await service.create(
      {
        id: 'master-user-id',
        role: UserRole.MASTER,
        barberProfileId: 'master-barber-id',
      },
      {
        barberServiceId: 'service-id',
        startsAt: startsAt.toISOString(),
        customerName: 'Nome introduzido localmente',
        customerPhone: '+351912345678',
      },
    );

    expect(prisma.appointment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          customerUserId: 'registered-customer-id',
          localCustomerName: undefined,
          localCustomerPhone: undefined,
        }),
      }),
    );
    expect(notificationsService.queueAppointmentCreated).toHaveBeenCalledWith(
      prisma,
      expect.objectContaining({ id: 'linked-appointment-id' }),
      'cliente@example.com',
    );
  });

  it('does not email or in-app notify the professional about a booking they made themselves', async () => {
    const startsAt = futureAppointmentStart(3);
    prisma.barberService.findFirst.mockResolvedValue({
      id: 'service-id',
      barberProfileId: 'barber-id',
      durationMinutes: 30,
      name: 'Corte',
      price: new Prisma.Decimal(20),
      barberProfile: {
        id: 'barber-id',
        userId: 'barber-user-id',
        displayName: 'Barbeiro',
        user: { email: 'barbeiro@example.com' },
      },
    });
    prisma.user.findFirst.mockResolvedValue({
      id: 'registered-customer-id',
      name: 'Cliente registado',
      email: 'cliente@example.com',
      phone: '+351912345678',
    });
    prisma.appointment.create.mockResolvedValue({
      id: 'self-booked-appointment-id',
      customerUserId: 'registered-customer-id',
      barberProfileId: 'barber-id',
      startsAt,
      endsAt: new Date(startsAt.getTime() + 30 * 60 * 1000),
      status: AppointmentStatus.CONFIRMED,
      version: 1,
      serviceNameSnapshot: 'Corte',
      durationSnapshot: 30,
      priceSnapshot: new Prisma.Decimal(20),
    });

    await service.create(
      {
        id: 'barber-user-id',
        role: UserRole.BARBER,
        barberProfileId: 'barber-id',
      },
      {
        barberServiceId: 'service-id',
        startsAt: startsAt.toISOString(),
        customerName: 'Nome introduzido localmente',
        customerPhone: '+351912345678',
      },
    );

    expect(notificationsService.queueAppointmentCreated).toHaveBeenCalledWith(
      prisma,
      expect.objectContaining({ id: 'self-booked-appointment-id' }),
      'cliente@example.com',
    );
    expect(notificationsService.queueInAppCreated).toHaveBeenCalledWith(
      prisma,
      expect.objectContaining({ id: 'self-booked-appointment-id' }),
      undefined,
      'registered-customer-id',
    );
  });

  it('still emails and in-app notifies the professional when a different staff member books on their behalf', async () => {
    const startsAt = futureAppointmentStart(3);
    prisma.barberService.findFirst.mockResolvedValue({
      id: 'service-id',
      barberProfileId: 'barber-id',
      durationMinutes: 30,
      name: 'Corte',
      price: new Prisma.Decimal(20),
      barberProfile: {
        id: 'barber-id',
        userId: 'barber-user-id',
        displayName: 'Barbeiro',
        user: { email: 'barbeiro@example.com' },
      },
    });
    prisma.user.findFirst.mockResolvedValue({
      id: 'registered-customer-id',
      name: 'Cliente registado',
      email: 'cliente@example.com',
      phone: '+351912345678',
    });
    prisma.appointment.create.mockResolvedValue({
      id: 'master-booked-appointment-id',
      customerUserId: 'registered-customer-id',
      barberProfileId: 'barber-id',
      startsAt,
      endsAt: new Date(startsAt.getTime() + 30 * 60 * 1000),
      status: AppointmentStatus.CONFIRMED,
      version: 1,
      serviceNameSnapshot: 'Corte',
      durationSnapshot: 30,
      priceSnapshot: new Prisma.Decimal(20),
    });

    await service.create(
      {
        id: 'master-user-id',
        role: UserRole.MASTER,
        barberProfileId: 'master-barber-id',
      },
      {
        barberServiceId: 'service-id',
        startsAt: startsAt.toISOString(),
        customerName: 'Nome introduzido localmente',
        customerPhone: '+351912345678',
      },
    );

    expect(notificationsService.queueAppointmentCreated).toHaveBeenCalledWith(
      prisma,
      expect.objectContaining({ id: 'master-booked-appointment-id' }),
      'cliente@example.com',
      'barbeiro@example.com',
    );
    expect(notificationsService.queueInAppCreated).toHaveBeenCalledWith(
      prisma,
      expect.objectContaining({ id: 'master-booked-appointment-id' }),
      'barber-user-id',
      'registered-customer-id',
    );
  });

  it('requires at least 24 hours notice for a new appointment', async () => {
    prisma.barberService.findFirst.mockResolvedValue({
      id: 'service-id',
      barberProfileId: 'barber-id',
      durationMinutes: 30,
      barberProfile: { id: 'barber-id' },
    });

    await expect(
      service.create(
        {
          id: 'customer-id',
          role: UserRole.CUSTOMER,
          barberProfileId: null,
        },
        {
          barberServiceId: 'service-id',
          startsAt: new Date(Date.now() + 23 * 60 * 60 * 1000).toISOString(),
        },
      ),
    ).rejects.toThrow('A marcação exige uma antecedência mínima de 24 horas.');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('requires a customer name for an operational local booking', async () => {
    prisma.barberService.findFirst.mockResolvedValue({
      id: 'service-id',
      barberProfileId: 'barber-id',
      durationMinutes: 30,
      barberProfile: { id: 'barber-id' },
    });

    await expect(
      service.create(
        {
          id: 'barber-user-id',
          role: UserRole.BARBER,
          barberProfileId: 'barber-id',
        },
        {
          barberServiceId: 'service-id',
          startsAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
        },
      ),
    ).rejects.toThrow(
      'O nome do cliente é obrigatório para marcações presenciais.',
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('lets a customer hold any number of active appointments', async () => {
    const startsAt = futureAppointmentStart(2);
    prisma.barberService.findFirst.mockResolvedValue({
      id: 'service-id',
      barberProfileId: 'barber-id',
      durationMinutes: 30,
      name: 'Corte',
      price: new Prisma.Decimal(20),
      barberProfile: { id: 'barber-id' },
    });
    prisma.user.findFirst.mockResolvedValue({
      id: 'customer-id',
      name: 'Cliente',
      email: 'customer@example.com',
      phone: null,
      customerBookingLimited: false,
    });
    prisma.appointment.count.mockResolvedValue(25);

    await expect(
      service.create(
        {
          id: 'customer-id',
          role: UserRole.CUSTOMER,
          barberProfileId: null,
        },
        {
          barberServiceId: 'service-id',
          startsAt: startsAt.toISOString(),
        },
      ),
    ).resolves.toBeDefined();
    expect(prisma.appointment.create).toHaveBeenCalled();
  });

  it('still caps a no-show customer at one active appointment', async () => {
    const startsAt = futureAppointmentStart(2);
    prisma.barberService.findFirst.mockResolvedValue({
      id: 'service-id',
      barberProfileId: 'barber-id',
      durationMinutes: 30,
      name: 'Corte',
      price: new Prisma.Decimal(20),
      barberProfile: { id: 'barber-id' },
    });
    prisma.user.findFirst.mockResolvedValue({
      id: 'customer-id',
      name: 'Cliente',
      email: 'customer@example.com',
      phone: null,
      customerBookingLimited: true,
    });
    prisma.appointment.count.mockResolvedValue(1);

    await expect(
      service.create(
        {
          id: 'staff-id',
          role: UserRole.MASTER,
          barberProfileId: 'barber-id',
        },
        {
          barberServiceId: 'service-id',
          startsAt: startsAt.toISOString(),
          customerName: 'Cliente',
          customerPhone: '+351910000000',
        },
      ),
    ).rejects.toThrow('O cliente só pode possuir uma marcação ativa.');
    expect(prisma.appointment.create).not.toHaveBeenCalled();
  });

  it('enforces the 24-hour customer cancellation rule', async () => {
    prisma.appointment.findUnique.mockResolvedValue({
      id: 'appointment-id',
      customerUserId: 'customer-id',
      barberProfileId: 'barber-id',
      status: AppointmentStatus.CONFIRMED,
      startsAt: new Date(Date.now() + 23 * 60 * 60 * 1000),
    } satisfies Partial<Prisma.AppointmentGetPayload<object>>);

    await expect(
      service.cancel(
        {
          id: 'customer-id',
          role: UserRole.CUSTOMER,
          barberProfileId: null,
        },
        'appointment-id',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.appointment.update).not.toHaveBeenCalled();
  });

  it('allows the assigned barber to cancel inside 24 hours', async () => {
    const appointment = {
      id: 'appointment-id',
      customerUserId: 'customer-id',
      barberProfileId: 'barber-id',
      status: AppointmentStatus.CONFIRMED,
      startsAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
      endsAt: new Date(Date.now() + 2.5 * 60 * 60 * 1000),
      version: 1,
      serviceNameSnapshot: 'Haircut',
      durationSnapshot: 30,
      priceSnapshot: new Prisma.Decimal(20),
      customer: { id: 'customer-id', email: 'customer@example.com' },
      barberProfile: { userId: 'barber-user-id' },
    };
    prisma.appointment.findUnique.mockResolvedValue(appointment);
    prisma.appointment.update.mockResolvedValue({
      ...appointment,
      status: AppointmentStatus.CANCELLED,
    });

    const result = await service.cancel(
      {
        id: 'barber-user-id',
        role: UserRole.BARBER,
        barberProfileId: 'barber-id',
      },
      'appointment-id',
    );
    expect(result.data.status).toBe(AppointmentStatus.CANCELLED);
    expect(
      notificationsService.queueAppointmentCancelled,
    ).toHaveBeenCalledTimes(1);
  });

  it('returns the assigned barber day schedule and period metadata', async () => {
    prisma.appointment.findMany.mockResolvedValue([]);

    const result = await service.list(
      {
        id: 'barber-user-id',
        role: UserRole.BARBER,
        barberProfileId: 'barber-id',
      },
      {
        view: AppointmentCalendarView.DAY,
        date: '2026-07-28',
        page: 1,
        pageSize: 25,
      },
    );

    expect(result.meta).toEqual(
      expect.objectContaining({
        view: AppointmentCalendarView.DAY,
        date: '2026-07-28',
        barberProfileId: 'barber-id',
        timeZone: 'Europe/Lisbon',
      }),
    );
    expect(prisma.appointment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ barberProfileId: 'barber-id' }),
      }),
    );
  });

  it('prevents a barber from selecting another barber schedule', async () => {
    await expect(
      service.list(
        {
          id: 'barber-user-id',
          role: UserRole.BARBER,
          barberProfileId: 'barber-id',
        },
        {
          view: AppointmentCalendarView.WEEK,
          date: '2026-07-28',
          barberProfileId: 'other-barber-id',
          page: 1,
          pageSize: 25,
        },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('lets master select another barber month schedule', async () => {
    prisma.appointment.findMany.mockResolvedValue([]);

    const result = await service.list(
      {
        id: 'master-user-id',
        role: UserRole.MASTER,
        barberProfileId: 'master-barber-id',
      },
      {
        view: AppointmentCalendarView.MONTH,
        date: '2026-07-28',
        barberProfileId: 'other-barber-id',
        page: 1,
        pageSize: 25,
      },
    );

    expect(result.meta.barberProfileId).toBe('other-barber-id');
    expect(prisma.appointment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          barberProfileId: 'other-barber-id',
        }),
      }),
    );
  });

  it('returns an authorized appointment detail', async () => {
    prisma.appointment.findUnique.mockResolvedValue({
      id: 'appointment-id',
      customerUserId: 'customer-id',
      barberProfileId: 'barber-id',
    });

    const result = await service.detail(
      {
        id: 'customer-id',
        role: UserRole.CUSTOMER,
        barberProfileId: null,
      },
      'appointment-id',
    );

    expect(result.data.id).toBe('appointment-id');
  });

  it('allows the assigned barber to complete a started appointment', async () => {
    const appointment = {
      id: 'appointment-id',
      customerUserId: 'customer-id',
      barberProfileId: 'barber-id',
      status: AppointmentStatus.CONFIRMED,
      startsAt: new Date(Date.now() - 60 * 60 * 1000),
      endsAt: new Date(Date.now() - 30 * 60 * 1000),
      version: 1,
      serviceNameSnapshot: 'Haircut',
      durationSnapshot: 30,
      priceSnapshot: new Prisma.Decimal(20),
    };
    prisma.appointment.findUnique.mockResolvedValue(appointment);
    prisma.appointment.update.mockResolvedValue({
      ...appointment,
      status: AppointmentStatus.COMPLETED,
      version: 2,
    });

    const result = await service.updateStatus(
      {
        id: 'barber-user-id',
        role: UserRole.BARBER,
        barberProfileId: 'barber-id',
      },
      'appointment-id',
      AppointmentStatus.COMPLETED,
    );

    expect(result.data.status).toBe(AppointmentStatus.COMPLETED);
    expect(prisma.appointmentHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'APPOINTMENT_COMPLETED' }),
      }),
    );
    expect(
      notificationsService.cancelPendingForAppointment,
    ).toHaveBeenCalledTimes(1);
  });

  it('rejects closing an appointment before its scheduled start', async () => {
    prisma.appointment.findUnique.mockResolvedValue({
      id: 'appointment-id',
      customerUserId: 'customer-id',
      barberProfileId: 'barber-id',
      status: AppointmentStatus.CONFIRMED,
      startsAt: new Date(Date.now() + 60 * 60 * 1000),
    });

    await expect(
      service.updateStatus(
        {
          id: 'barber-user-id',
          role: UserRole.BARBER,
          barberProfileId: 'barber-id',
        },
        'appointment-id',
        AppointmentStatus.NO_SHOW,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
