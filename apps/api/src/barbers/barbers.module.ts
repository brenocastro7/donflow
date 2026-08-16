import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { BarberInvitationsController } from './barber-invitations.controller';
import { BarbersController } from './barbers.controller';
import { BarbersService } from './barbers.service';

@Module({
  imports: [AuthModule, NotificationsModule],
  controllers: [BarbersController, BarberInvitationsController],
  providers: [BarbersService],
  exports: [BarbersService],
})
export class BarbersModule {}
