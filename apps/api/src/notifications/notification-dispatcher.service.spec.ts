import { NotificationStatus, NotificationType, Prisma } from '@prisma/client';
import { describe, expect, it, jest } from '@jest/globals';
import { NotificationDispatcherService } from './notification-dispatcher.service';

describe('NotificationDispatcherService', () => {
  it('delivers one due notification and records the provider result', async () => {
    const transaction = {
      $queryRaw: jest
        .fn()
        .mockResolvedValueOnce([
          {
            id: 'notification-id',
            appointmentId: 'appointment-id',
            type: NotificationType.APPOINTMENT_CONFIRMATION,
            recipient: 'customer@example.com',
            payload: {
              version: 1,
              startsAt: '2026-08-03T08:00:00.000Z',
              serviceName: 'Haircut',
            },
          },
        ])
        .mockResolvedValueOnce([]),
      notification: {
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const prisma = {
      $transaction: jest.fn(
        async (callback: (client: typeof transaction) => Promise<boolean>) =>
          callback(transaction),
      ),
    };
    const provider = {
      send: jest.fn().mockResolvedValue({ providerMessageId: 'resend-id' }),
    };
    const dispatcher = new NotificationDispatcherService(
      prisma as never,
      provider,
    );

    await dispatcher.processDue();

    expect(provider.send).toHaveBeenCalledWith({
      kind: NotificationType.APPOINTMENT_CONFIRMATION,
      recipient: 'customer@example.com',
      appointmentId: 'appointment-id',
      payload: expect.objectContaining({ version: 1 }),
    });
    expect(transaction.notification.update).toHaveBeenCalledWith({
      where: { id: 'notification-id' },
      data: {
        status: NotificationStatus.SENT,
        sentAt: expect.any(Date),
        attempts: { increment: 1 },
        providerMessageId: 'resend-id',
        lastError: null,
      },
    });
  });

  it('records a failed attempt without losing the outbox item', async () => {
    const transaction = {
      $queryRaw: jest
        .fn()
        .mockResolvedValueOnce([
          {
            id: 'notification-id',
            appointmentId: 'appointment-id',
            type: NotificationType.APPOINTMENT_CANCELLATION,
            recipient: 'customer@example.com',
            payload: {
              version: 2,
              startsAt: '2026-08-03T08:00:00.000Z',
              serviceName: 'Haircut',
            } satisfies Prisma.InputJsonObject,
          },
        ])
        .mockResolvedValueOnce([]),
      notification: {
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const prisma = {
      $transaction: jest.fn(
        async (callback: (client: typeof transaction) => Promise<boolean>) =>
          callback(transaction),
      ),
    };
    const provider = {
      send: jest.fn().mockRejectedValue(new Error('provider unavailable')),
    };
    const dispatcher = new NotificationDispatcherService(
      prisma as never,
      provider,
    );

    await dispatcher.processDue();

    expect(transaction.notification.update).toHaveBeenCalledWith({
      where: { id: 'notification-id' },
      data: {
        status: NotificationStatus.FAILED,
        attempts: { increment: 1 },
        lastError: 'provider unavailable',
      },
    });
  });
});
