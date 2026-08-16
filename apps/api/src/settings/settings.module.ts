import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';

@Module({
  imports: [NotificationsModule],
  controllers: [SettingsController],
  providers: [SettingsService],
})
export class SettingsModule {}
