import { describe, expect, it, jest } from '@jest/globals';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { UserRole, UserStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from './jwt-auth.guard';

const reflector = {
  getAllAndOverride: jest.fn().mockReturnValue(false),
} as unknown as Reflector;

function context(authorization = 'Bearer valid-token') {
  const request: { headers: { authorization?: string }; user?: unknown } = {
    headers: { authorization },
  };
  return {
    request,
    context: {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => undefined,
      getClass: () => undefined,
    } as unknown as ExecutionContext,
  };
}

describe('JwtAuthGuard', () => {
  it('accepts only a token matching the current active identity', async () => {
    process.env.JWT_ACCESS_SECRET =
      'unit-test-secret-with-at-least-32-characters';
    const jwt = {
      verifyAsync: jest.fn().mockResolvedValue({
        sub: 'user-id',
        role: UserRole.BARBER,
        barberProfileId: 'profile-id',
      }),
    };
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          role: UserRole.BARBER,
          status: UserStatus.ACTIVE,
          barberProfile: { id: 'profile-id' },
        }),
      },
    };
    const guard = new JwtAuthGuard(
      jwt as unknown as JwtService,
      prisma as unknown as PrismaService,
      reflector,
    );
    const testContext = context();

    await expect(guard.canActivate(testContext.context)).resolves.toBe(true);
    expect(testContext.request.user).toEqual({
      id: 'user-id',
      role: UserRole.BARBER,
      barberProfileId: 'profile-id',
    });
  });

  it('rejects a previously issued token after the user is deactivated', async () => {
    process.env.JWT_ACCESS_SECRET =
      'unit-test-secret-with-at-least-32-characters';
    const jwt = {
      verifyAsync: jest.fn().mockResolvedValue({
        sub: 'user-id',
        role: UserRole.BARBER,
        barberProfileId: 'profile-id',
      }),
    };
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          role: UserRole.BARBER,
          status: UserStatus.INACTIVE,
          barberProfile: { id: 'profile-id' },
        }),
      },
    };
    const guard = new JwtAuthGuard(
      jwt as unknown as JwtService,
      prisma as unknown as PrismaService,
      reflector,
    );

    await expect(guard.canActivate(context().context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects a valid JWT after its server session is revoked', async () => {
    process.env.JWT_ACCESS_SECRET =
      'unit-test-secret-with-at-least-32-characters';
    const jwt = {
      verifyAsync: jest.fn().mockResolvedValue({
        sub: 'user-id',
        sid: 'session-id',
        role: UserRole.BARBER,
        barberProfileId: 'profile-id',
      }),
    };
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          role: UserRole.BARBER,
          status: UserStatus.ACTIVE,
          barberProfile: { id: 'profile-id' },
        }),
      },
      authSession: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const guard = new JwtAuthGuard(
      jwt as unknown as JwtService,
      prisma as unknown as PrismaService,
      reflector,
    );
    await expect(guard.canActivate(context().context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
