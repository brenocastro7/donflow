import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { UserStatus } from '@prisma/client';
import { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { getAccessTokenConfig } from '../auth.config';
import { AccessTokenPayload, AuthenticatedUser } from '../auth.types';
import { ACCESS_COOKIE, parseCookies } from '../auth-cookies';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

type AuthenticatedRequest = Request & { user?: AuthenticatedUser };

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const [type, bearerToken] = request.headers.authorization?.split(' ') ?? [];
    const cookieToken = parseCookies(request.headers.cookie)[ACCESS_COOKIE];
    const token = type === 'Bearer' ? bearerToken : cookieToken;

    if (!token) {
      throw new UnauthorizedException('É necessário iniciar sessão.');
    }

    try {
      const { secret } = getAccessTokenConfig();
      const payload = await this.jwtService.verifyAsync<AccessTokenPayload>(
        token,
        { secret },
      );
      const currentUser = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: {
          role: true,
          status: true,
          barberProfile: { select: { id: true } },
        },
      });
      if (payload.sid) {
        const session = await this.prisma.authSession.findFirst({
          where: {
            id: payload.sid,
            userId: payload.sub,
            revokedAt: null,
            expiresAt: { gt: new Date() },
          },
          select: { id: true },
        });
        if (!session) throw new Error('The session is no longer active.');
      }
      const currentBarberProfileId = currentUser?.barberProfile?.id ?? null;
      if (
        !currentUser ||
        currentUser.status !== UserStatus.ACTIVE ||
        currentUser.role !== payload.role ||
        currentBarberProfileId !== (payload.barberProfileId ?? null)
      ) {
        throw new Error('The authenticated identity is no longer active.');
      }
      request.user = {
        id: payload.sub,
        role: currentUser.role,
        barberProfileId: currentBarberProfileId,
        sessionId: payload.sid,
      };
      return true;
    } catch {
      throw new UnauthorizedException(
        'O token de acesso é inválido ou expirou.',
      );
    }
  }
}
