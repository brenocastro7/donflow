import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { NotificationStatus, NotificationType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  NOTIFICATION_PROVIDER,
  type AppointmentNotification,
  type NotificationProvider,
} from './notification-provider';

// Kept well above Neon's 5-minute auto-suspend threshold so the database
// can actually scale to zero between polls during idle periods, instead of
// a query every few seconds keeping it permanently active.
const POLL_INTERVAL_MS = 5 * 60_000;

interface DueNotification {
  id: string;
  appointmentId: string;
  type: NotificationType;
  recipient: string;
  payload: Prisma.JsonValue;
}

@Injectable()
export class NotificationDispatcherService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(NotificationDispatcherService.name);
  private interval?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(NOTIFICATION_PROVIDER)
    private readonly provider: NotificationProvider,
  ) {}

  onModuleInit(): void {
    if (process.env.NODE_ENV === 'test') {
      return;
    }
    this.interval = setInterval(() => void this.processDue(), POLL_INTERVAL_MS);
    this.interval.unref();
    setTimeout(() => void this.processDue(), 1_000).unref();
  }

  onModuleDestroy(): void {
    if (this.interval) {
      clearInterval(this.interval);
    }
  }

  async processDue(): Promise<void> {
    if (this.running) {
      return;
    }
    this.running = true;
    try {
      for (let index = 0; index < 20; index += 1) {
        const processed = await this.processNext();
        if (!processed) {
          break;
        }
      }
    } catch (error) {
      this.logger.error(
        'Notification outbox processing failed',
        error instanceof Error ? error.stack : undefined,
      );
    } finally {
      this.running = false;
    }
  }

  private async processNext(): Promise<boolean> {
    return this.prisma.$transaction(async (transaction) => {
      const rows = await transaction.$queryRaw<DueNotification[]>`
        SELECT id, appointment_id AS "appointmentId", type, recipient, payload
        FROM notifications
        WHERE status IN ('PENDING', 'FAILED')
          AND scheduled_at <= NOW()
          AND attempts < 5
          AND (status = 'PENDING' OR updated_at <= NOW() - INTERVAL '1 minute')
        ORDER BY scheduled_at, created_at
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      `;
      const notification = rows[0];
      if (!notification) {
        return false;
      }

      try {
        const result = await this.provider.send(
          this.toProviderNotification(notification),
        );
        await transaction.notification.update({
          where: { id: notification.id },
          data: {
            status: NotificationStatus.SENT,
            sentAt: new Date(),
            attempts: { increment: 1 },
            providerMessageId: result.providerMessageId,
            lastError: null,
          },
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown provider error';
        await transaction.notification.update({
          where: { id: notification.id },
          data: {
            status: NotificationStatus.FAILED,
            attempts: { increment: 1 },
            lastError: message.slice(0, 500),
          },
        });
        this.logger.warn(`Notification ${notification.id} failed: ${message}`);
      }
      return true;
    });
  }

  private toProviderNotification(
    notification: DueNotification,
  ): AppointmentNotification {
    if (
      notification.type !== NotificationType.APPOINTMENT_CONFIRMATION &&
      notification.type !== NotificationType.APPOINTMENT_CANCELLATION &&
      notification.type !== NotificationType.APPOINTMENT_REMINDER
    ) {
      throw new Error(`Unsupported outbox type: ${notification.type}`);
    }
    return {
      kind: notification.type,
      recipient: notification.recipient,
      appointmentId: notification.appointmentId,
      payload: notification.payload as Record<string, unknown>,
    };
  }
}
