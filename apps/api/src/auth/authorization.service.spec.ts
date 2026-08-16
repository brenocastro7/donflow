import { ForbiddenException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AuthorizationService } from './authorization.service';

describe('AuthorizationService', () => {
  const service = new AuthorizationService();

  it('allows a customer to access their own user resource', () => {
    expect(() =>
      service.assertUserOwnership(
        {
          id: 'user-id',
          role: UserRole.CUSTOMER,
          barberProfileId: null,
        },
        'user-id',
      ),
    ).not.toThrow();
  });

  it('rejects access to another user resource', () => {
    expect(() =>
      service.assertUserOwnership(
        {
          id: 'user-id',
          role: UserRole.CUSTOMER,
          barberProfileId: null,
        },
        'another-user-id',
      ),
    ).toThrow(ForbiddenException);
  });

  it('allows the master to access any barber resource', () => {
    expect(() =>
      service.assertBarberOwnership(
        {
          id: 'master-id',
          role: UserRole.MASTER,
          barberProfileId: 'master-profile-id',
        },
        'another-profile-id',
      ),
    ).not.toThrow();
  });
});
