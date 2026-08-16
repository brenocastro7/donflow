import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { UserRole } from '@prisma/client';
import { DashboardService } from './dashboard.service';

describe('DashboardService', () => {
  const findMany =
    jest.fn<(input: { where: Record<string, unknown> }) => Promise<never[]>>();
  const reviewFindMany = jest.fn<() => Promise<never[]>>();
  const hoursFindMany = jest.fn<() => Promise<never[]>>();
  const profileFindMany = jest.fn<() => Promise<never[]>>();
  const prisma = {
    appointment: { findMany },
    review: { findMany: reviewFindMany },
    businessHour: { findMany: hoursFindMany },
    barberProfile: { findMany: profileFindMany },
  };
  const service = new DashboardService(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.appointment.findMany.mockResolvedValue([]);
    prisma.review.findMany.mockResolvedValue([]);
    prisma.businessHour.findMany.mockResolvedValue([]);
    prisma.barberProfile.findMany.mockResolvedValue([]);
  });

  it('scopes non-administrative metrics to the current agenda', async () => {
    await service.get({
      id: 'user-id',
      role: UserRole.BARBER,
      barberProfileId: 'profile-id',
    });

    expect(prisma.appointment.findMany).toHaveBeenCalledTimes(7);
    for (const [query] of prisma.appointment.findMany.mock.calls) {
      expect(query.where.barberProfileId).toBe('profile-id');
    }
  });

  it('does not constrain administrative metrics to one agenda', async () => {
    await service.get({
      id: 'user-id',
      role: UserRole.MASTER,
      barberProfileId: 'profile-id',
    });

    const firstCall = prisma.appointment.findMany.mock.calls[0]?.[0];
    expect(firstCall.where).not.toHaveProperty('barberProfileId');
  });
});
