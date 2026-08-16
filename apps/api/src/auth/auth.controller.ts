import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import type {
  AuthenticatedUser,
  AuthenticatedUserResponse,
  ConfirmEmailResponse,
  LoginResponse,
  MessageResponse,
} from './auth.types';
import { CurrentUser } from './decorators/current-user.decorator';
import { ConfirmEmailDto } from './dto/confirm-email.dto';
import { DeleteAccountDto } from './dto/delete-account.dto';
import { LoginDto } from './dto/login.dto';
import { ConfirmMfaDto, DisableMfaDto, SetupMfaDto } from './dto/mfa.dto';
import { ProfileImageDto } from './dto/profile-image.dto';
import { RegisterCustomerDto } from './dto/register-customer.dto';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';
import { Public } from './decorators/public.decorator';
import { UserRole } from '@prisma/client';
import type { RegisterCustomerResult } from '../users/users.types';
import { Throttle } from '@nestjs/throttler';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  ResendEmailConfirmationDto,
  ResetPasswordDto,
} from './dto/password.dto';
import {
  clearSessionCookies,
  CSRF_COOKIE,
  parseCookies,
  REFRESH_COOKIE,
  setSessionCookies,
} from './auth-cookies';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  register(
    @Body() registerCustomerDto: RegisterCustomerDto,
  ): Promise<RegisterCustomerResult> {
    return this.authService.registerCustomer(registerCustomerDto);
  }

  @Post('confirm-email')
  @Public()
  confirmEmail(
    @Body() confirmEmailDto: ConfirmEmailDto,
  ): Promise<ConfirmEmailResponse> {
    return this.authService.confirmEmail(confirmEmailDto.token);
  }

  @Post('login')
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async login(
    @Body() loginDto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<LoginResponse> {
    const credentials = await this.authService.login(loginDto, {
      userAgent: request.get('user-agent'),
      ipAddress: request.ip,
    });
    setSessionCookies(response, credentials);
    return credentials.response;
  }

  @Post('refresh')
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<LoginResponse> {
    const cookies = parseCookies(request.headers.cookie);
    const credentials = await this.authService.refreshSession(
      cookies[REFRESH_COOKIE] ?? '',
      request.get('x-csrf-token') ?? cookies[CSRF_COOKIE] ?? '',
    );
    setSessionCookies(response, credentials);
    return credentials.response;
  }

  @Post('logout')
  async logout(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) response: Response,
  ): Promise<MessageResponse> {
    const result = await this.authService.logout(user.sessionId);
    clearSessionCookies(response);
    return result;
  }

  @Post('mfa/setup')
  @UseGuards(RolesGuard)
  @Roles(UserRole.BARBER, UserRole.MASTER)
  setupMfa(@CurrentUser() user: AuthenticatedUser, @Body() dto: SetupMfaDto) {
    return this.authService.setupMfa(user.id, dto.currentPassword);
  }

  @Get('sessions')
  sessions(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.listSessions(user.id, user.sessionId);
  }

  @Delete('sessions/:sessionId')
  revokeSession(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
  ) {
    return this.authService.revokeSession(user.id, sessionId);
  }

  @Post('mfa/confirm')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @UseGuards(RolesGuard)
  @Roles(UserRole.BARBER, UserRole.MASTER)
  confirmMfa(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ConfirmMfaDto,
  ) {
    return this.authService.confirmMfa(user.id, dto.code);
  }

  @Delete('mfa')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @UseGuards(RolesGuard)
  @Roles(UserRole.BARBER, UserRole.MASTER)
  disableMfa(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: DisableMfaDto,
  ) {
    return this.authService.disableMfa(user.id, dto.currentPassword, dto.code);
  }

  @Get('me')
  me(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AuthenticatedUserResponse> {
    return this.authService.currentUser(user.id);
  }

  @Put('me/profile-image')
  updateProfileImage(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ProfileImageDto,
  ): Promise<AuthenticatedUserResponse> {
    return this.authService.updateProfileImage(user.id, dto.dataUrl);
  }

  @Delete('me/profile-image')
  deleteProfileImage(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AuthenticatedUserResponse> {
    return this.authService.deleteProfileImage(user.id);
  }

  @Delete('me/account')
  @UseGuards(RolesGuard)
  @Roles(UserRole.CUSTOMER)
  async deleteAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: DeleteAccountDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<MessageResponse> {
    const result = await this.authService.deleteCustomerAccount(
      user.id,
      dto.currentPassword,
    );
    clearSessionCookies(response);
    return result;
  }

  @Post('forgot-password')
  @Public()
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  forgotPassword(@Body() dto: ForgotPasswordDto): Promise<MessageResponse> {
    return this.authService.forgotPassword(dto.email);
  }

  @Post('resend-email-confirmation')
  @Public()
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  resendEmailConfirmation(
    @Body() dto: ResendEmailConfirmationDto,
  ): Promise<MessageResponse> {
    return this.authService.resendEmailConfirmation(dto.email);
  }

  @Post('reset-password')
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  resetPassword(@Body() dto: ResetPasswordDto): Promise<MessageResponse> {
    return this.authService.resetPassword(dto.token, dto.newPassword);
  }

  @Patch('change-password')
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<MessageResponse> {
    const result = await this.authService.changePassword(
      user.id,
      dto.currentPassword,
      dto.newPassword,
    );
    clearSessionCookies(response);
    return result;
  }
}
