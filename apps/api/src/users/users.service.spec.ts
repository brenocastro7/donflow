import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { UserRole, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OBJECT_STORAGE } from '../storage/object-storage';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;
  const createdAt = new Date('2026-07-26T12:00:00.000Z');
  const transaction = {
    emailVerificationToken: {
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
    user: {
      update: jest.fn(),
    },
  };
  const prisma = {
    user: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(
      async (callback: (client: typeof transaction) => Promise<void>) =>
        callback(transaction),
    ),
  };
  const storage = {
    put: jest.fn(),
    get: jest.fn(),
    delete: jest.fn(),
    ping: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
        {
          provide: OBJECT_STORAGE,
          useValue: storage,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('returns the account name and profile image in the current session', async () => {
    prisma.user.findUniqueOrThrow.mockResolvedValue({
      id: 'user-id',
      name: 'Breno Passos',
      role: UserRole.MASTER,
      barberProfile: { id: 'profile-id' },
      profileImage: Buffer.from([0x89, 0x50]),
      profileImageMimeType: 'image/png',
      customerBookingBlocked: false,
      customerBookingLimited: false,
      mfaEnabledAt: null,
    });

    await expect(service.getCurrentUser('user-id')).resolves.toEqual({
      data: {
        id: 'user-id',
        name: 'Breno Passos',
        role: UserRole.MASTER,
        barberProfileId: 'profile-id',
        profileImageDataUrl: 'data:image/png;base64,iVA=',
        customerBookingBlocked: false,
        customerBookingLimited: false,
        mfaEnabled: false,
      },
    });
  });

  it('rejects content that does not match the declared image type', async () => {
    const invalidImage = `data:image/png;base64,${Buffer.from('not an image').toString('base64')}`;

    await expect(
      service.updateProfileImage('user-id', invalidImage),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('normalizes an email used for authentication', async () => {
    prisma.user.findFirst.mockResolvedValue(null);

    await service.findForAuthentication(' DAVID@EXAMPLE.COM ');

    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: { email: 'david@example.com' },
      select: {
        id: true,
        passwordHash: true,
        role: true,
        status: true,
        emailVerifiedAt: true,
        mfaSecretEncrypted: true,
        mfaEnabledAt: true,
        mfaRecoveryCodeHashes: true,
        failedLoginAttempts: true,
        loginLockedUntil: true,
        barberProfile: { select: { id: true } },
      },
    });
  });

  it('persists a normalized customer without exposing the password', async () => {
    const persistedUser = {
      id: '5d0f2ed4-6423-4ae9-906b-ec6b4cc37c2b',
      name: 'David',
      email: 'david@example.com',
      phone: '+351912345678',
      role: UserRole.CUSTOMER,
      status: UserStatus.ACTIVE,
      emailVerifiedAt: null,
      createdAt,
    };
    prisma.user.create.mockResolvedValue(persistedUser);

    const emailVerification = {
      tokenHash: 'b'.repeat(64),
      expiresAt: new Date('2026-07-26T13:00:00.000Z'),
    };
    const result = await service.createCustomer(
      {
        name: ' David ',
        email: ' DAVID@EXAMPLE.COM ',
        phone: '+351912345678',
        password: 'password123',
      },
      emailVerification,
    );

    expect(result).toEqual({
      message: 'Cliente registado com sucesso.',
      data: persistedUser,
    });
    expect(result.data).not.toHaveProperty('password');
    expect(result.data).not.toHaveProperty('passwordHash');
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: 'David',
        email: 'david@example.com',
        phone: '+351912345678',
        passwordHash: expect.stringMatching(/^\$argon2id\$/),
        role: UserRole.CUSTOMER,
        status: UserStatus.ACTIVE,
        emailVerificationToken: {
          create: emailVerification,
        },
      }),
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        status: true,
        emailVerifiedAt: true,
        createdAt: true,
      },
    });
  });

  it('marks the email as verified and consumes the token', async () => {
    const verifiedAt = new Date('2026-07-26T12:00:00.000Z');
    transaction.emailVerificationToken.findUnique.mockResolvedValue({
      id: '7bf4213b-ff7b-4945-83c8-0631fdcd6669',
      userId: '5d0f2ed4-6423-4ae9-906b-ec6b4cc37c2b',
      expiresAt: new Date('2026-07-26T13:00:00.000Z'),
      user: { pendingEmail: null, role: UserRole.CUSTOMER },
    });
    transaction.user.update.mockResolvedValue({});
    transaction.emailVerificationToken.delete.mockResolvedValue({});

    await expect(
      service.verifyCustomerEmail('b'.repeat(64), verifiedAt),
    ).resolves.toEqual({ role: UserRole.CUSTOMER });
    expect(transaction.user.update).toHaveBeenCalledWith({
      where: { id: '5d0f2ed4-6423-4ae9-906b-ec6b4cc37c2b' },
      data: { emailVerifiedAt: verifiedAt },
    });
    expect(transaction.emailVerificationToken.delete).toHaveBeenCalledWith({
      where: { id: '7bf4213b-ff7b-4945-83c8-0631fdcd6669' },
    });
  });

  it('promotes a pending email only after token confirmation', async () => {
    const verifiedAt = new Date('2026-07-26T12:00:00.000Z');
    transaction.emailVerificationToken.findUnique.mockResolvedValue({
      id: '7bf4213b-ff7b-4945-83c8-0631fdcd6669',
      userId: '5d0f2ed4-6423-4ae9-906b-ec6b4cc37c2b',
      expiresAt: new Date('2026-07-26T13:00:00.000Z'),
      user: { pendingEmail: 'new@example.com', role: UserRole.CUSTOMER },
    });
    transaction.user.update.mockResolvedValue({});
    transaction.emailVerificationToken.delete.mockResolvedValue({});

    await service.verifyCustomerEmail('c'.repeat(64), verifiedAt);

    expect(transaction.user.update).toHaveBeenCalledWith({
      where: { id: '5d0f2ed4-6423-4ae9-906b-ec6b4cc37c2b' },
      data: {
        email: 'new@example.com',
        pendingEmail: null,
        emailVerifiedAt: verifiedAt,
      },
    });
  });

  it('reports the role of the confirming account, for a staff email change', async () => {
    const verifiedAt = new Date('2026-07-26T12:00:00.000Z');
    transaction.emailVerificationToken.findUnique.mockResolvedValue({
      id: '7bf4213b-ff7b-4945-83c8-0631fdcd6669',
      userId: '5d0f2ed4-6423-4ae9-906b-ec6b4cc37c2b',
      expiresAt: new Date('2026-07-26T13:00:00.000Z'),
      user: { pendingEmail: 'owner@example.com', role: UserRole.MASTER },
    });
    transaction.user.update.mockResolvedValue({});
    transaction.emailVerificationToken.delete.mockResolvedValue({});

    await expect(
      service.verifyCustomerEmail('d'.repeat(64), verifiedAt),
    ).resolves.toEqual({ role: UserRole.MASTER });
  });
});
