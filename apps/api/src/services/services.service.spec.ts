import { ConflictException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AuthorizationService } from '../auth/authorization.service';
import { PrismaService } from '../prisma/prisma.service';
import { ServicesService } from './services.service';

describe('ServicesService', () => {
  const prisma = {
    barberProfile: {
      findUnique: jest.fn(),
    },
    barberService: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      delete: jest.fn(),
    },
  };
  const authorization = {
    assertBarberOwnership: jest.fn(),
  };
  const user = {
    id: 'barber-user-id',
    role: UserRole.BARBER,
    barberProfileId: 'barber-profile-id',
  };
  let service: ServicesService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ServicesService(
      prisma as unknown as PrismaService,
      authorization as unknown as AuthorizationService,
    );
  });

  it('lists only active services owned by active master profiles', async () => {
    prisma.barberService.findMany.mockResolvedValue([]);

    await service.listMasterCatalog();

    expect(prisma.barberService.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          isActive: true,
          barberProfile: {
            user: { role: UserRole.MASTER, status: 'ACTIVE' },
          },
        },
      }),
    );
  });

  it('links an adopted service to its master source', async () => {
    prisma.barberProfile.findUnique.mockResolvedValue({
      user: { status: 'ACTIVE' },
    });
    prisma.barberService.findFirst
      .mockResolvedValueOnce({
        id: 'master-service-id',
        name: 'Corte',
        description: 'Corte clássico',
        durationMinutes: 30,
        price: 20,
      })
      .mockResolvedValueOnce(null);
    prisma.barberService.create.mockResolvedValue({ id: 'adopted-service-id' });

    await service.createBarberService(user, {
      sourceBarberServiceId: 'master-service-id',
    });

    expect(prisma.barberService.create).toHaveBeenCalledWith({
      data: {
        barberProfileId: 'barber-profile-id',
        serviceTemplateId: undefined,
        sourceBarberServiceId: 'master-service-id',
        name: 'Corte',
        description: 'Corte clássico',
        durationMinutes: 30,
        price: 20,
      },
    });
  });

  it('permanently deletes an unused owned service', async () => {
    prisma.barberService.findUnique.mockResolvedValue({
      barberProfileId: 'barber-profile-id',
      _count: { appointments: 0 },
    });
    prisma.barberService.delete.mockResolvedValue({ id: 'service-id' });

    await expect(
      service.deleteBarberService(user, 'service-id'),
    ).resolves.toEqual({
      data: { id: 'service-id' },
    });
    expect(authorization.assertBarberOwnership).toHaveBeenCalledWith(
      user,
      'barber-profile-id',
    );
    expect(prisma.barberService.delete).toHaveBeenCalledWith({
      where: { id: 'service-id' },
    });
  });

  it('preserves a service referenced by appointments', async () => {
    prisma.barberService.findUnique.mockResolvedValue({
      barberProfileId: 'barber-profile-id',
      _count: { appointments: 1 },
    });

    await expect(
      service.deleteBarberService(user, 'service-id'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.barberService.delete).not.toHaveBeenCalled();
  });
});
