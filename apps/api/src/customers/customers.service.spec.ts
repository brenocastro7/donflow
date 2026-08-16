import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { NotFoundException } from '@nestjs/common';
import { CustomersService } from './customers.service';

describe('CustomersService', () => {
  const prisma = {
    user: {
      count: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    appointment: {
      aggregate: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
      groupBy: jest.fn(),
    },
  };
  const service = new CustomersService(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.count.mockResolvedValue(1);
    prisma.appointment.count.mockResolvedValue(0);
    prisma.appointment.aggregate.mockResolvedValue({
      _sum: { priceSnapshot: null },
      _count: { _all: 0 },
      _max: { startsAt: null },
    });
    prisma.appointment.groupBy.mockResolvedValue([]);
  });

  it('lists customers with search and pagination', async () => {
    prisma.user.findMany.mockResolvedValue([{ id: 'customer-id' }]);

    const result = await service.list({
      search: 'david',
      page: 2,
      pageSize: 10,
    });

    expect(result.meta).toEqual({
      page: 2,
      pageSize: 10,
      total: 1,
      totalPages: 1,
    });
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 10, take: 10 }),
    );
    const listCall = prisma.user.findMany.mock.calls[0]?.[0];
    expect(listCall.select).not.toHaveProperty('email');
  });

  it('returns only minimal customer data for a staff phone lookup', async () => {
    prisma.user.findMany.mockResolvedValue([
      {
        id: 'customer-id',
        name: 'Cliente Teste',
        phone: '+351912345678',
        profileImage: Buffer.from('image'),
        profileImageMimeType: 'image/jpeg',
      },
    ]);

    const result = await service.lookupByPhone('+351912');

    expect(result.data[0]).toEqual(
      expect.objectContaining({
        id: 'customer-id',
        name: 'Cliente Teste',
        phone: '+351912345678',
        profileImageDataUrl: expect.stringMatching(/^data:image\/jpeg;base64,/),
      }),
    );
    expect(result.data[0]).not.toHaveProperty('email');
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ phone: { startsWith: '+351912' } }),
        take: 5,
      }),
    );
  });

  it('rejects a detail request for a non-customer identity', async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    await expect(service.detail('user-id')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
