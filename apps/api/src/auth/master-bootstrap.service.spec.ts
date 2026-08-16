import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { UserRole, UserStatus } from '@prisma/client';
import { MasterBootstrapService } from './master-bootstrap.service';

describe('MasterBootstrapService', () => {
  const prisma = {
    user: {
      findFirst: jest.fn(),
      create: jest.fn<(argument: unknown) => Promise<unknown>>(),
    },
  };
  const service = new MasterBootstrapService(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates the initial master and their barber profile', async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      id: 'master-id',
      role: UserRole.MASTER,
    });

    await expect(
      service.bootstrap({
        name: 'Master',
        email: 'MASTER@EXAMPLE.COM',
        password: 'SecurePassword1!',
      }),
    ).resolves.toEqual({
      created: true,
      user: { id: 'master-id', role: UserRole.MASTER },
    });
    const createArgument = prisma.user.create.mock.calls[0]?.[0] as {
      data: {
        email: string;
        role: UserRole;
        status: UserStatus;
        emailVerifiedAt: Date;
        passwordHash: string;
        barberProfile: { create: { displayName: string } };
      };
    };
    expect(createArgument.data.email).toBe('master@example.com');
    expect(createArgument.data.role).toBe(UserRole.MASTER);
    expect(createArgument.data.status).toBe(UserStatus.ACTIVE);
    expect(createArgument.data.emailVerifiedAt).toBeInstanceOf(Date);
    expect(createArgument.data.passwordHash).toMatch(/^\$argon2id\$/);
    expect(createArgument.data.barberProfile).toEqual({
      create: { displayName: 'Master' },
    });
  });

  it('does not create a second master', async () => {
    prisma.user.findFirst.mockResolvedValue({
      id: 'master-id',
      email: 'master@example.com',
    });

    await expect(
      service.bootstrap({
        name: 'Another Master',
        email: 'another@example.com',
        password: 'SecurePassword1!',
      }),
    ).resolves.toEqual({
      created: false,
      user: { id: 'master-id', email: 'master@example.com' },
    });
    expect(prisma.user.create).not.toHaveBeenCalled();
  });
});
