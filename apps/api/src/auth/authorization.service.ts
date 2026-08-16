import { ForbiddenException, Injectable } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AuthenticatedUser } from './auth.types';

@Injectable()
export class AuthorizationService {
  assertUserOwnership(user: AuthenticatedUser, ownerUserId: string): void {
    if (user.role !== UserRole.MASTER && user.id !== ownerUserId) {
      throw new ForbiddenException(
        'Não tem permissão para aceder a este recurso de utilizador.',
      );
    }
  }

  assertBarberOwnership(
    user: AuthenticatedUser,
    ownerBarberProfileId: string,
  ): void {
    if (
      user.role !== UserRole.MASTER &&
      user.barberProfileId !== ownerBarberProfileId
    ) {
      throw new ForbiddenException(
        'Não tem permissão para aceder a este recurso da agenda.',
      );
    }
  }
}
