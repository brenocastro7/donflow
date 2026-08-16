import { NotificationType } from '@prisma/client';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  const provider = { send: jest.fn() };
  const prisma = {
    inAppNotification: {
      findMany: jest.fn(),
      count: jest.fn(),
      updateMany: jest.fn(),
    },
  };
  const service = new NotificationsService(prisma as never, provider);
  const transaction = {
    notification: {
      createMany: jest.fn(),
      updateMany: jest.fn(),
      create: jest.fn(),
    },
    inAppNotification: {
      createMany: jest.fn(),
      deleteMany: jest.fn(),
    },
  };
  const appointment = {
    id: 'appointment-id',
    version: 1,
    startsAt: new Date('2026-08-10T09:00:00.000Z'),
    endsAt: new Date('2026-08-10T09:30:00.000Z'),
    serviceNameSnapshot: 'Haircut',
    barberProfileId: 'barber-id',
  };

  beforeEach(() => jest.clearAllMocks());

  it('delegates email verification through the configured provider', async () => {
    provider.send.mockResolvedValue({});
    await service.sendEmailVerification({
      recipient: 'customer@example.com',
      token: 'token',
      expiresAt: new Date('2026-08-10T10:00:00.000Z'),
    });
    expect(provider.send).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'EMAIL_VERIFICATION' }),
    );
  });

  it('queues confirmation and reminder without invoking a provider', async () => {
    transaction.notification.createMany.mockResolvedValue({ count: 2 });
    await service.queueAppointmentCreated(
      transaction as never,
      appointment,
      'customer@example.com',
    );
    expect(transaction.notification.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          type: NotificationType.APPOINTMENT_CONFIRMATION,
        }),
        expect.objectContaining({
          type: NotificationType.APPOINTMENT_REMINDER,
        }),
      ]),
    });
    expect(provider.send).not.toHaveBeenCalled();
  });
});
