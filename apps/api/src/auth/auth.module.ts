import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { UsersModule } from '../users/users.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthorizationService } from './authorization.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { MasterBootstrapService } from './master-bootstrap.service';

@Module({
  imports: [
    UsersModule,
    NotificationsModule,
    JwtModule.register({ global: true }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthorizationService,
    JwtAuthGuard,
    RolesGuard,
    MasterBootstrapService,
  ],
  exports: [AuthorizationService, JwtAuthGuard, RolesGuard],
})
export class AuthModule {}
