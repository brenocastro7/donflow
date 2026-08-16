import { Injectable } from '@nestjs/common';
import type {
  NotificationProvider,
  ProviderNotification,
} from './notification-provider';

@Injectable()
export class NoopNotificationProvider implements NotificationProvider {
  async send(
    notification: ProviderNotification,
  ): Promise<{ providerMessageId?: string }> {
    void notification;
    return Promise.resolve({});
  }
}
