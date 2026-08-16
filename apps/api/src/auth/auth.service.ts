import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma, UserRole, UserStatus } from '@prisma/client';
import { argon2id, hash, verify } from 'argon2';
import { UsersService } from '../users/users.service';
import { PrismaService } from '../prisma/prisma.service';
import type { RegisterCustomerResult } from '../users/users.types';
import { NotificationsService } from '../notifications/notifications.service';
import { getAccessTokenConfig } from './auth.config';
import type {
  AccessTokenPayload,
  ConfirmEmailResponse,
  MessageResponse,
  SessionCredentials,
  SessionMetadata,
} from './auth.types';
import { LoginDto } from './dto/login.dto';
import { RegisterCustomerDto } from './dto/register-customer.dto';
import {
  decryptMfaSecret,
  encryptMfaSecret,
  generateMfaSecret,
  generateRecoveryCodes,
  hashRecoveryCode,
  verifyTotp,
} from './mfa';

const EMAIL_VERIFICATION_TTL_MINUTES = 60;
const PASSWORD_RESET_TTL_MINUTES = 30;

@Injectable()
export class AuthService {
  private dummyPasswordHashPromise?: Promise<string>;

  constructor(
    private readonly usersService: UsersService,
    private readonly notificationsService: NotificationsService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Unknown-identifier login attempts must pay the same argon2 cost as a real
   * password check, otherwise response timing reveals whether an account exists.
   */
  private getDummyPasswordHash(): Promise<string> {
    if (!this.dummyPasswordHashPromise) {
      this.dummyPasswordHashPromise = hash(randomBytes(32).toString('hex'), {
        type: argon2id,
      });
    }
    return this.dummyPasswordHashPromise;
  }

  async registerCustomer(
    registerCustomerDto: RegisterCustomerDto,
  ): Promise<RegisterCustomerResult> {
    const token = randomBytes(32).toString('hex');
    const tokenHash = this.hashVerificationToken(token);
    const expiresAt = new Date(
      Date.now() + EMAIL_VERIFICATION_TTL_MINUTES * 60 * 1000,
    );
    const result = await this.usersService.createCustomer(registerCustomerDto, {
      tokenHash,
      expiresAt,
    });

    await this.notificationsService.sendEmailVerification({
      recipient: registerCustomerDto.email.trim().toLowerCase(),
      token,
      expiresAt,
    });

    return result;
  }

  async login(
    loginDto: LoginDto,
    metadata: SessionMetadata = {},
  ): Promise<SessionCredentials> {
    const user = await this.usersService.findForAuthentication(
      loginDto.identifier,
    );
    const passwordMatches = await verify(
      user?.passwordHash ?? (await this.getDummyPasswordHash()),
      loginDto.password,
    );

    if (user?.loginLockedUntil && user.loginLockedUntil > new Date()) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }
    if (!user || !passwordMatches || user.status !== UserStatus.ACTIVE) {
      if (user) {
        const failedAttempts = user.failedLoginAttempts + 1;
        await this.prisma.user.update({
          where: { id: user.id },
          data: {
            failedLoginAttempts: failedAttempts >= 5 ? 0 : failedAttempts,
            loginLockedUntil:
              failedAttempts >= 5
                ? new Date(Date.now() + 15 * 60 * 1000)
                : undefined,
          },
        });
        await this.recordSecurityEvent(user.id, 'AUTH_LOGIN_FAILED');
      }
      throw new UnauthorizedException('Credenciais inválidas.');
    }
    if (user.failedLoginAttempts || user.loginLockedUntil) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: 0, loginLockedUntil: null },
      });
    }

    if (user.role === UserRole.CUSTOMER && !user.emailVerifiedAt) {
      // Only reachable once the password has already been verified above, so
      // surfacing this distinct reason doesn't expose account existence to a
      // credential-guessing attacker the way it would on the identifier/password
      // check itself.
      throw new UnauthorizedException({
        code: 'EMAIL_NOT_VERIFIED',
        message: 'É necessário confirmar o e-mail.',
      });
    }
    if (user.role !== UserRole.CUSTOMER && user.mfaEnabledAt) {
      if (!loginDto.mfaCode || !user.mfaSecretEncrypted) {
        throw new UnauthorizedException({
          code: 'MFA_REQUIRED',
          message: 'É necessário introduzir o código de autenticação.',
        });
      }
      const validTotp = verifyTotp(
        decryptMfaSecret(user.mfaSecretEncrypted),
        loginDto.mfaCode,
      );
      const recoveryHashes = Array.isArray(user.mfaRecoveryCodeHashes)
        ? user.mfaRecoveryCodeHashes.filter(
            (value): value is string => typeof value === 'string',
          )
        : [];
      const recoveryHash = hashRecoveryCode(loginDto.mfaCode);
      const recoveryIndex = recoveryHashes.indexOf(recoveryHash);
      if (!validTotp && recoveryIndex < 0) {
        throw new UnauthorizedException({
          code: 'MFA_INVALID',
          message: 'O código de autenticação é inválido.',
        });
      }
      if (recoveryIndex >= 0) {
        recoveryHashes.splice(recoveryIndex, 1);
        await this.prisma.user.update({
          where: { id: user.id },
          data: { mfaRecoveryCodeHashes: recoveryHashes },
        });
      }
    }

    const {
      secret,
      ttlSeconds,
      refreshTtlSeconds,
      rememberedRefreshTtlSeconds,
    } = getAccessTokenConfig();
    const refreshLifetime = loginDto.remember
      ? rememberedRefreshTtlSeconds
      : refreshTtlSeconds;
    const refreshToken = randomBytes(48).toString('base64url');
    const csrfToken = randomBytes(32).toString('base64url');
    const refreshExpiresAt = new Date(Date.now() + refreshLifetime * 1000);
    const session = await this.prisma.authSession.create({
      data: {
        userId: user.id,
        refreshTokenHash: this.hashVerificationToken(refreshToken),
        csrfTokenHash: this.hashVerificationToken(csrfToken),
        expiresAt: refreshExpiresAt,
        userAgent: metadata.userAgent?.slice(0, 300),
        ipHash: metadata.ipAddress
          ? this.hashVerificationToken(metadata.ipAddress)
          : undefined,
        persistent: Boolean(loginDto.remember),
      },
    });
    await this.recordSecurityEvent(user.id, 'AUTH_LOGIN_SUCCESS', session.id);
    const payload: AccessTokenPayload = {
      sub: user.id,
      role: user.role,
      sid: session.id,
      ...(user.barberProfile?.id
        ? { barberProfileId: user.barberProfile.id }
        : {}),
    };
    const accessToken = await this.jwtService.signAsync(payload, {
      secret,
      expiresIn: ttlSeconds,
    });

    return {
      accessToken,
      refreshToken,
      csrfToken,
      refreshExpiresAt,
      persistent: Boolean(loginDto.remember),
      response: {
        accessToken: 'cookie-session',
        tokenType: 'Bearer',
        expiresIn: ttlSeconds,
      },
    };
  }

  async refreshSession(
    refreshToken: string,
    csrfToken: string,
  ): Promise<SessionCredentials> {
    const now = new Date();
    const session = await this.prisma.authSession.findUnique({
      where: { refreshTokenHash: this.hashVerificationToken(refreshToken) },
      include: {
        user: { include: { barberProfile: { select: { id: true } } } },
      },
    });
    if (
      !session ||
      session.revokedAt ||
      session.expiresAt <= now ||
      !this.hashesMatch(
        session.csrfTokenHash,
        this.hashVerificationToken(csrfToken),
      ) ||
      session.user.status !== UserStatus.ACTIVE
    ) {
      throw new UnauthorizedException('A sessão é inválida ou expirou.');
    }
    const nextRefreshToken = randomBytes(48).toString('base64url');
    const nextCsrfToken = randomBytes(32).toString('base64url');
    await this.prisma.authSession.update({
      where: { id: session.id },
      data: {
        refreshTokenHash: this.hashVerificationToken(nextRefreshToken),
        csrfTokenHash: this.hashVerificationToken(nextCsrfToken),
        lastUsedAt: now,
      },
    });
    const { secret, ttlSeconds } = getAccessTokenConfig();
    const accessToken = await this.jwtService.signAsync<AccessTokenPayload>(
      {
        sub: session.userId,
        sid: session.id,
        role: session.user.role,
        ...(session.user.barberProfile?.id
          ? { barberProfileId: session.user.barberProfile.id }
          : {}),
      },
      { secret, expiresIn: ttlSeconds },
    );
    return {
      accessToken,
      refreshToken: nextRefreshToken,
      csrfToken: nextCsrfToken,
      refreshExpiresAt: session.expiresAt,
      persistent: session.persistent,
      response: {
        accessToken: 'cookie-session',
        tokenType: 'Bearer',
        expiresIn: ttlSeconds,
      },
    };
  }

  async logout(sessionId?: string): Promise<MessageResponse> {
    if (sessionId) {
      await this.prisma.authSession.updateMany({
        where: { id: sessionId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      const session = await this.prisma.authSession.findUnique({
        where: { id: sessionId },
        select: { userId: true },
      });
      if (session)
        await this.recordSecurityEvent(
          session.userId,
          'AUTH_LOGOUT',
          sessionId,
        );
    }
    return { message: 'Sessão terminada com sucesso.' };
  }

  async listSessions(userId: string, currentSessionId?: string) {
    const sessions = await this.prisma.authSession.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      select: {
        id: true,
        userAgent: true,
        createdAt: true,
        lastUsedAt: true,
        expiresAt: true,
        persistent: true,
      },
      orderBy: { lastUsedAt: 'desc' },
    });
    return {
      data: sessions.map((session) => ({
        ...session,
        current: session.id === currentSessionId,
      })),
    };
  }

  async revokeSession(userId: string, sessionId: string) {
    const result = await this.prisma.authSession.updateMany({
      where: { id: sessionId, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (!result.count) {
      throw new NotFoundException('A sessão já não se encontra ativa.');
    }
    await this.recordSecurityEvent(userId, 'AUTH_SESSION_REVOKED', sessionId);
    return { message: 'Sessão terminada.' };
  }

  async setupMfa(userId: string, currentPassword: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, passwordHash: true, role: true },
    });
    if (!user || !(await verify(user.passwordHash, currentPassword))) {
      throw new UnauthorizedException('A palavra-passe atual é inválida.');
    }
    if (user.role === UserRole.CUSTOMER) {
      throw new ForbiddenException(
        'A autenticação reforçada está reservada aos acessos administrativos.',
      );
    }
    const secret = generateMfaSecret();
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        mfaSecretEncrypted: encryptMfaSecret(secret),
        mfaEnabledAt: null,
        mfaRecoveryCodeHashes: Prisma.DbNull,
      },
    });
    await this.recordSecurityEvent(userId, 'MFA_SETUP_STARTED');
    const label = encodeURIComponent(`DonFlow:${user.email ?? userId}`);
    return {
      data: {
        secret,
        otpauthUri: `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent('DonFlow')}`,
      },
    };
  }

  async confirmMfa(userId: string, code: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { mfaSecretEncrypted: true, role: true },
    });
    if (!user?.mfaSecretEncrypted || user.role === UserRole.CUSTOMER) {
      throw new BadRequestException(
        'Inicia primeiro a configuração da autenticação reforçada.',
      );
    }
    if (!verifyTotp(decryptMfaSecret(user.mfaSecretEncrypted), code)) {
      throw new BadRequestException('O código de autenticação é inválido.');
    }
    const recoveryCodes = generateRecoveryCodes();
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        mfaEnabledAt: new Date(),
        mfaRecoveryCodeHashes: recoveryCodes.map(hashRecoveryCode),
      },
    });
    await this.recordSecurityEvent(userId, 'MFA_ENABLED');
    return { data: { recoveryCodes } };
  }

  async disableMfa(userId: string, currentPassword: string, code: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true, mfaSecretEncrypted: true },
    });
    if (
      !user?.mfaSecretEncrypted ||
      !(await verify(user.passwordHash, currentPassword)) ||
      !verifyTotp(decryptMfaSecret(user.mfaSecretEncrypted), code)
    ) {
      throw new UnauthorizedException(
        'Não foi possível validar as credenciais de segurança.',
      );
    }
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: {
          mfaSecretEncrypted: null,
          mfaEnabledAt: null,
          mfaRecoveryCodeHashes: Prisma.DbNull,
        },
      }),
      this.prisma.authSession.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    await this.recordSecurityEvent(userId, 'MFA_DISABLED');
    return { message: 'Autenticação reforçada desativada.' };
  }

  async confirmEmail(token: string): Promise<ConfirmEmailResponse> {
    const { role } = await this.usersService.verifyCustomerEmail(
      this.hashVerificationToken(token),
      new Date(),
    );

    return {
      message: 'E-mail confirmado com sucesso.',
      role,
    };
  }

  async forgotPassword(emailValue: string): Promise<MessageResponse> {
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(
      Date.now() + PASSWORD_RESET_TTL_MINUTES * 60 * 1000,
    );
    const recipient = await this.usersService.createPasswordResetToken(
      emailValue,
      this.hashVerificationToken(token),
      expiresAt,
    );
    if (recipient) {
      await this.notificationsService.sendPasswordReset({
        recipient,
        token,
        expiresAt,
      });
    }
    return {
      message:
        'Se o e-mail estiver registado, serão enviadas instruções para redefinir a palavra-passe.',
    };
  }

  async resendEmailConfirmation(emailValue: string): Promise<MessageResponse> {
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(
      Date.now() + EMAIL_VERIFICATION_TTL_MINUTES * 60 * 1000,
    );
    const recipient = await this.usersService.refreshEmailVerificationToken(
      emailValue,
      this.hashVerificationToken(token),
      expiresAt,
    );
    if (recipient) {
      await this.notificationsService.sendEmailVerification({
        recipient,
        token,
        expiresAt,
      });
    }
    return {
      message:
        'Se o e-mail estiver a aguardar confirmação, serão enviadas novas instruções.',
    };
  }

  async resetPassword(
    token: string,
    newPassword: string,
  ): Promise<MessageResponse> {
    await this.usersService.resetPassword(
      this.hashVerificationToken(token),
      newPassword,
      new Date(),
    );
    return { message: 'Palavra-passe redefinida com sucesso.' };
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<MessageResponse> {
    await this.usersService.changePassword(
      userId,
      currentPassword,
      newPassword,
    );
    await this.prisma.authSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.recordSecurityEvent(userId, 'PASSWORD_CHANGED');
    return { message: 'Palavra-passe alterada com sucesso.' };
  }

  currentUser(userId: string) {
    return this.usersService.getCurrentUser(userId);
  }

  updateProfileImage(userId: string, dataUrl: string) {
    return this.usersService.updateProfileImage(userId, dataUrl);
  }

  deleteProfileImage(userId: string) {
    return this.usersService.deleteProfileImage(userId);
  }

  async deleteCustomerAccount(
    userId: string,
    currentPassword: string,
  ): Promise<MessageResponse> {
    await this.usersService.deleteCustomerAccount(userId, currentPassword);
    return { message: 'Conta eliminada permanentemente.' };
  }

  private hashVerificationToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private hashesMatch(a: string, b: string): boolean {
    const bufferA = Buffer.from(a);
    const bufferB = Buffer.from(b);
    return (
      bufferA.length === bufferB.length && timingSafeEqual(bufferA, bufferB)
    );
  }

  private async recordSecurityEvent(
    actorUserId: string,
    action: string,
    sessionId?: string,
  ): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        actorUserId,
        action,
        targetType: sessionId ? 'AUTH_SESSION' : 'USER',
        targetId: sessionId ?? actorUserId,
      },
    });
  }
}
