import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { hash } from 'argon2';
import { UserRole, UserStatus } from '@prisma/client';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AuthService', () => {
  let service: AuthService;
  const usersService = {
    createCustomer: jest.fn(),
    verifyCustomerEmail: jest.fn(),
    findForAuthentication: jest.fn(),
    createPasswordResetToken: jest.fn(),
    refreshEmailVerificationToken: jest.fn(),
    resetPassword: jest.fn(),
    changePassword: jest.fn(),
  };
  const notificationsService = {
    sendEmailVerification: jest.fn(),
    sendPasswordReset: jest.fn(),
  };
  const jwtService = {
    signAsync: jest.fn(),
  };
  const prisma = {
    user: { update: jest.fn(), findUnique: jest.fn() },
    auditLog: { create: jest.fn() },
    authSession: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: NotificationsService, useValue: notificationsService },
        { provide: JwtService, useValue: jwtService },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  it('authenticates a verified customer and returns an access token', async () => {
    process.env.JWT_ACCESS_SECRET = 'a-secure-test-secret-with-32-characters';
    process.env.JWT_ACCESS_TTL_SECONDS = '900';
    process.env.AUTH_REFRESH_TTL_SECONDS = '86400';
    prisma.authSession.create.mockResolvedValue({ id: 'session-id' });
    usersService.findForAuthentication.mockResolvedValue({
      id: '5d0f2ed4-6423-4ae9-906b-ec6b4cc37c2b',
      passwordHash: await hash('password123'),
      role: UserRole.CUSTOMER,
      status: UserStatus.ACTIVE,
      emailVerifiedAt: new Date(),
      barberProfile: null,
    });
    jwtService.signAsync.mockResolvedValue('signed-token');

    await expect(
      service.login({
        identifier: 'DAVID@EXAMPLE.COM',
        password: 'password123',
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        accessToken: 'signed-token',
        response: {
          accessToken: 'cookie-session',
          tokenType: 'Bearer',
          expiresIn: 900,
        },
      }),
    );
    expect(usersService.findForAuthentication).toHaveBeenCalledWith(
      'DAVID@EXAMPLE.COM',
    );
    expect(jwtService.signAsync).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ expiresIn: 900 }),
    );
  });

  it('extends the token lifetime for a trusted device', async () => {
    process.env.JWT_ACCESS_SECRET = 'a-secure-test-secret-with-32-characters';
    process.env.JWT_ACCESS_TTL_SECONDS = '900';
    process.env.AUTH_REMEMBER_REFRESH_TTL_SECONDS = '2592000';
    prisma.authSession.create.mockResolvedValue({ id: 'session-id' });
    usersService.findForAuthentication.mockResolvedValue({
      id: '5d0f2ed4-6423-4ae9-906b-ec6b4cc37c2b',
      passwordHash: await hash('password123'),
      role: UserRole.MASTER,
      status: UserStatus.ACTIVE,
      emailVerifiedAt: new Date(),
      barberProfile: { id: 'barber-profile-id' },
    });
    jwtService.signAsync.mockResolvedValue('remembered-token');

    await expect(
      service.login({
        identifier: 'master@example.com',
        password: 'password123',
        remember: true,
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        accessToken: 'remembered-token',
        response: expect.objectContaining({ expiresIn: 900 }),
      }),
    );
    expect(jwtService.signAsync).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ expiresIn: 900 }),
    );
  });

  it('requests the second factor only after valid staff credentials', async () => {
    usersService.findForAuthentication.mockResolvedValue({
      id: '5d0f2ed4-6423-4ae9-906b-ec6b4cc37c2b',
      passwordHash: await hash('password123'),
      role: UserRole.MASTER,
      status: UserStatus.ACTIVE,
      emailVerifiedAt: new Date(),
      barberProfile: { id: 'barber-profile-id' },
      mfaEnabledAt: new Date(),
      mfaSecretEncrypted: 'encrypted-secret',
    });

    await expect(
      service.login({
        identifier: 'master@example.com',
        password: 'password123',
      }),
    ).rejects.toMatchObject({
      response: {
        code: 'MFA_REQUIRED',
      },
    });
    expect(prisma.authSession.create).not.toHaveBeenCalled();
  });

  it('rejects a customer whose email is not confirmed', async () => {
    usersService.findForAuthentication.mockResolvedValue({
      id: '5d0f2ed4-6423-4ae9-906b-ec6b4cc37c2b',
      passwordHash: await hash('password123'),
      role: UserRole.CUSTOMER,
      status: UserStatus.ACTIVE,
      emailVerifiedAt: null,
      barberProfile: null,
    });

    await expect(
      service.login({
        identifier: 'david@example.com',
        password: 'password123',
      }),
    ).rejects.toThrow('É necessário confirmar o e-mail.');
  });

  it('creates only a customer through the users service', async () => {
    const input = {
      name: 'David',
      email: 'david@example.com',
      password: 'password123',
    };
    const output = {
      message: 'Customer registered successfully',
      data: { id: '5d0f2ed4-6423-4ae9-906b-ec6b4cc37c2b' },
    };
    usersService.createCustomer.mockResolvedValue(output);

    await expect(service.registerCustomer(input)).resolves.toEqual(output);
    expect(usersService.createCustomer).toHaveBeenCalledWith(
      input,
      expect.objectContaining({
        tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        expiresAt: expect.any(Date),
      }),
    );
    expect(notificationsService.sendEmailVerification).toHaveBeenCalledWith({
      recipient: input.email,
      token: expect.stringMatching(/^[a-f0-9]{64}$/),
      expiresAt: expect.any(Date),
    });
  });

  it('confirms an email using only the token hash in persistence', async () => {
    const token = 'a'.repeat(64);
    usersService.verifyCustomerEmail.mockResolvedValue({
      role: UserRole.CUSTOMER,
    });

    await expect(service.confirmEmail(token)).resolves.toEqual({
      message: 'E-mail confirmado com sucesso.',
      role: UserRole.CUSTOMER,
    });
    expect(usersService.verifyCustomerEmail).toHaveBeenCalledWith(
      expect.stringMatching(/^[a-f0-9]{64}$/),
      expect.any(Date),
    );
    expect(usersService.verifyCustomerEmail).not.toHaveBeenCalledWith(
      token,
      expect.any(Date),
    );
  });

  it('reports the confirming account role so the frontend can route staff to the panel', async () => {
    usersService.verifyCustomerEmail.mockResolvedValue({
      role: UserRole.MASTER,
    });

    await expect(service.confirmEmail('b'.repeat(64))).resolves.toEqual({
      message: 'E-mail confirmado com sucesso.',
      role: UserRole.MASTER,
    });
  });

  it('creates a password reset without exposing account existence', async () => {
    usersService.createPasswordResetToken.mockResolvedValue(
      'david@example.com',
    );

    await expect(service.forgotPassword('DAVID@EXAMPLE.COM')).resolves.toEqual({
      message:
        'Se o e-mail estiver registado, serão enviadas instruções para redefinir a palavra-passe.',
    });
    expect(usersService.createPasswordResetToken).toHaveBeenCalledWith(
      'DAVID@EXAMPLE.COM',
      expect.stringMatching(/^[a-f0-9]{64}$/),
      expect.any(Date),
    );
    expect(notificationsService.sendPasswordReset).toHaveBeenCalledWith({
      recipient: 'david@example.com',
      token: expect.stringMatching(/^[a-f0-9]{64}$/),
      expiresAt: expect.any(Date),
    });
  });

  it('resets a password using only a persisted token hash', async () => {
    usersService.resetPassword.mockResolvedValue(undefined);

    await expect(
      service.resetPassword('a'.repeat(64), 'new-password'),
    ).resolves.toEqual({ message: 'Palavra-passe redefinida com sucesso.' });
    expect(usersService.resetPassword).toHaveBeenCalledWith(
      expect.stringMatching(/^[a-f0-9]{64}$/),
      'new-password',
      expect.any(Date),
    );
    expect(usersService.resetPassword).not.toHaveBeenCalledWith(
      'a'.repeat(64),
      'new-password',
      expect.any(Date),
    );
  });

  it('refreshes an unverified customer email token', async () => {
    usersService.refreshEmailVerificationToken.mockResolvedValue(
      'david@example.com',
    );

    await expect(
      service.resendEmailConfirmation('DAVID@EXAMPLE.COM'),
    ).resolves.toEqual({
      message:
        'Se o e-mail estiver a aguardar confirmação, serão enviadas novas instruções.',
    });
    expect(usersService.refreshEmailVerificationToken).toHaveBeenCalledWith(
      'DAVID@EXAMPLE.COM',
      expect.stringMatching(/^[a-f0-9]{64}$/),
      expect.any(Date),
    );
    expect(notificationsService.sendEmailVerification).toHaveBeenCalledWith({
      recipient: 'david@example.com',
      token: expect.stringMatching(/^[a-f0-9]{64}$/),
      expiresAt: expect.any(Date),
    });
  });
});
