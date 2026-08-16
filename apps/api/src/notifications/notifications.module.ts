import { Module } from '@nestjs/common';
import { NOTIFICATION_PROVIDER } from './notification-provider';
import { NoopNotificationProvider } from './noop-notification.provider';
import { NotificationsService } from './notifications.service';
import { ResendNotificationProvider } from './resend-notification.provider';
import { NotificationDispatcherService } from './notification-dispatcher.service';
import { NotificationsController } from './notifications.controller';

@Module({
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationDispatcherService,
    NoopNotificationProvider,
    ResendNotificationProvider,
    {
      provide: NOTIFICATION_PROVIDER,
      inject: [NoopNotificationProvider, ResendNotificationProvider],
      useFactory: (
        noop: NoopNotificationProvider,
        resend: ResendNotificationProvider,
      ) =>
        process.env.EMAIL_PROVIDER?.trim().toLowerCase() === 'resend'
          ? resend
          : noop,
    },
  ],
  exports: [NotificationsService, NOTIFICATION_PROVIDER],
})
export class NotificationsModule {}
