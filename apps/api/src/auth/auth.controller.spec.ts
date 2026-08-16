import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';

describe('AuthController', () => {
  let controller: AuthController;
  const authService = {
    registerCustomer: jest.fn(),
    confirmEmail: jest.fn(),
    login: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: JwtAuthGuard, useValue: { canActivate: () => true } },
        { provide: JwtService, useValue: {} },
        { provide: PrismaService, useValue: {} },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    jest.clearAllMocks();
  });

  it('delegates login to the auth service', async () => {
    const input = {
      identifier: 'david@example.com',
      password: 'password123',
    };
    const responseBody = {
      accessToken: 'cookie-session',
      tokenType: 'Bearer' as const,
      expiresIn: 900,
    };
    const output = {
      accessToken: 'signed-token',
      refreshToken: 'refresh-token',
      csrfToken: 'csrf-token',
      refreshExpiresAt: new Date(Date.now() + 60_000),
      response: responseBody,
    };
    authService.login.mockResolvedValue(output);
    const request = {
      get: jest.fn().mockReturnValue(undefined),
      ip: '127.0.0.1',
    };
    const response = { append: jest.fn() };

    await expect(
      controller.login(input, request as never, response as never),
    ).resolves.toEqual(responseBody);
    expect(authService.login).toHaveBeenCalledWith(input, {
      userAgent: undefined,
      ipAddress: '127.0.0.1',
    });
  });

  it('delegates customer registration to the auth service', async () => {
    const input = {
      name: 'David',
      email: 'david@example.com',
      password: 'password123',
    };
    const output = {
      message: 'Customer registered successfully',
      data: {
        id: '5d0f2ed4-6423-4ae9-906b-ec6b4cc37c2b',
        name: input.name,
        email: input.email,
      },
    };
    authService.registerCustomer.mockResolvedValue(output);

    await expect(controller.register(input)).resolves.toEqual(output);
    expect(authService.registerCustomer).toHaveBeenCalledWith(input);
  });

  it('delegates email confirmation to the auth service', async () => {
    const token = 'a'.repeat(64);
    const output = { message: 'Email confirmed successfully' };
    authService.confirmEmail.mockResolvedValue(output);

    await expect(controller.confirmEmail({ token })).resolves.toEqual(output);
    expect(authService.confirmEmail).toHaveBeenCalledWith(token);
  });
});
