import { UserRole, UserStatus } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { BarbersService } from './barbers.service';

describe('BarbersService invitations', () => {
  type InvitationCreateInput = {
    email: string;
    tokenHash: string;
    expiresAt: Date;
  };
  let invitationCreateInput: InvitationCreateInput | undefined;
  let sentToken: string | undefined;
  const transaction = {
    barberInvitation: {
      upsert: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
    user: { create: jest.fn() },
    auditLog: { create: jest.fn() },
  };
  const prisma = {
    user: { findUnique: jest.fn() },
    $transaction: jest.fn(
      (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
    ),
  };
  const notifications = { sendBarberInvitation: jest.fn() };
  let service: BarbersService;

  beforeEach(() => {
    jest.clearAllMocks();
    invitationCreateInput = undefined;
    sentToken = undefined;
    notifications.sendBarberInvitation.mockImplementation(
      (notification: { token: string }) => {
        sentToken = notification.token;
        return Promise.resolve();
      },
    );
    service = new BarbersService(
      prisma as unknown as PrismaService,
      notifications as unknown as NotificationsService,
    );
  });

  it('creates an email-only invitation and sends a raw one-time token', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    transaction.barberInvitation.upsert.mockImplementation(
      (input: { create: InvitationCreateInput }) => {
        invitationCreateInput = input.create;
        return Promise.resolve({
          id: 'invitation-id',
          email: input.create.email,
          expiresAt: input.create.expiresAt,
          createdAt: new Date(),
        });
      },
    );

    await service.invite('master-id', ' BARBER@EXAMPLE.COM ');

    expect(invitationCreateInput?.email).toBe('barber@example.com');
    expect(invitationCreateInput?.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(notifications.sendBarberInvitation).toHaveBeenCalledWith(
      expect.objectContaining({
        recipient: 'barber@example.com',
        token: expect.stringMatching(/^[a-f0-9]{64}$/) as string,
      }),
    );
    expect(sentToken).not.toBe(invitationCreateInput?.tokenHash);
  });

  it('creates the barber account only after completing a valid invitation', async () => {
    transaction.barberInvitation.findUnique.mockResolvedValue({
      id: 'invitation-id',
      email: 'barber@example.com',
      invitedByUserId: 'master-id',
      expiresAt: new Date(Date.now() + 60_000),
    });
    transaction.user.create.mockResolvedValue({
      id: 'barber-user-id',
      role: UserRole.BARBER,
      status: UserStatus.ACTIVE,
    });

    await service.completeInvitation({
      token: 'a'.repeat(64),
      name: 'João Silva',
      phone: '+351912345678',
      password: 'SecurePassword1!',
    });

    expect(transaction.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: 'barber@example.com',
          name: 'João Silva',
          phone: '+351912345678',
          role: UserRole.BARBER,
          status: UserStatus.ACTIVE,
          emailVerifiedAt: expect.any(Date) as Date,
          barberProfile: expect.any(Object) as object,
        }) as object,
      }),
    );
    expect(transaction.barberInvitation.delete).toHaveBeenCalledWith({
      where: { id: 'invitation-id' },
    });
  });
});
