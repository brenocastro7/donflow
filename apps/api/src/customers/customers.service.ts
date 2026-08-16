import { Injectable, NotFoundException } from '@nestjs/common';
import {
  AppointmentStatus,
  Prisma,
  UserRole,
  UserStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { profileImageDataUrl } from '../users/profile-image-url';
import {
  CustomerAppointmentsQueryDto,
  CustomerListQueryDto,
} from './dto/customer-query.dto';

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async lookupByPhone(phone: string) {
    const customers = await this.prisma.user.findMany({
      where: {
        role: UserRole.CUSTOMER,
        status: UserStatus.ACTIVE,
        emailVerifiedAt: { not: null },
        phone: { startsWith: phone },
      },
      select: {
        id: true,
        name: true,
        phone: true,
        profileImage: true,
        profileImageMimeType: true,
        profileImageKey: true,
        updatedAt: true,
      },
      orderBy: { name: 'asc' },
      take: 5,
    });
    return {
      data: customers.map((customer) => ({
        ...customer,
        profileImageDataUrl: profileImageDataUrl(customer),
      })),
    };
  }

  async list(query: CustomerListQueryDto) {
    const search = query.search?.trim();
    const where: Prisma.UserWhereInput = {
      role: UserRole.CUSTOMER,
      emailVerifiedAt: { not: null },
      ...(query.status ? { status: query.status } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { phone: { contains: search } },
            ],
          }
        : {}),
    };
    const startOfMonth = new Date();
    startOfMonth.setUTCDate(1);
    startOfMonth.setUTCHours(0, 0, 0, 0);
    const [
      customers,
      total,
      totalCustomers,
      activeCustomers,
      newCustomers,
      ticket,
    ] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          phone: true,
          status: true,
          createdAt: true,
          profileImage: true,
          profileImageMimeType: true,
          profileImageKey: true,
          updatedAt: true,
          _count: { select: { customerAppointments: true } },
        },
        orderBy: { name: 'asc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.user.count({ where }),
      this.prisma.user.count({
        where: {
          role: UserRole.CUSTOMER,
          emailVerifiedAt: { not: null },
        },
      }),
      this.prisma.user.count({
        where: {
          role: UserRole.CUSTOMER,
          status: UserStatus.ACTIVE,
          emailVerifiedAt: { not: null },
        },
      }),
      this.prisma.user.count({
        where: {
          role: UserRole.CUSTOMER,
          emailVerifiedAt: { not: null },
          createdAt: { gte: startOfMonth },
        },
      }),
      this.prisma.appointment.aggregate({
        where: {
          customerUserId: { not: null },
          status: AppointmentStatus.COMPLETED,
          customer: {
            is: {
              role: UserRole.CUSTOMER,
              emailVerifiedAt: { not: null },
            },
          },
        },
        _sum: { priceSnapshot: true },
        _count: { _all: true },
      }),
    ]);

    const customerIds = customers.map((customer) => customer.id);
    const customerMetrics = customerIds.length
      ? await this.prisma.appointment.groupBy({
          by: ['customerUserId'],
          where: {
            customerUserId: { in: customerIds },
            status: AppointmentStatus.COMPLETED,
          },
          _max: { startsAt: true },
          _sum: { priceSnapshot: true },
        })
      : [];
    const metricsByCustomer = new Map(
      customerMetrics.map((metrics) => [metrics.customerUserId, metrics]),
    );
    const totalRevenue = Number(ticket._sum.priceSnapshot ?? 0);

    return {
      data: customers.map((customer) => {
        const metrics = metricsByCustomer.get(customer.id);
        return {
          ...this.withProfileImage(customer),
          lastVisit: metrics?._max.startsAt ?? null,
          totalSpent: metrics?._sum.priceSnapshot ?? 0,
        };
      }),
      meta: this.pagination(query.page, query.pageSize, total),
      summary: {
        totalCustomers,
        activeCustomers,
        newCustomers,
        averageTicket: ticket._count._all
          ? totalRevenue / ticket._count._all
          : 0,
      },
    };
  }

  async detail(id: string) {
    const customer = await this.prisma.user.findFirst({
      where: {
        id,
        role: UserRole.CUSTOMER,
        emailVerifiedAt: { not: null },
      },
      select: {
        id: true,
        name: true,
        phone: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        profileImage: true,
        profileImageMimeType: true,
        profileImageKey: true,
        customerBookingBlocked: true,
        customerBookingLimited: true,
        _count: { select: { customerAppointments: true } },
      },
    });
    if (!customer) {
      throw new NotFoundException('Cliente não encontrado.');
    }
    const metrics = await this.prisma.appointment.aggregate({
      where: {
        customerUserId: id,
        status: AppointmentStatus.COMPLETED,
      },
      _max: { startsAt: true },
      _sum: { priceSnapshot: true },
    });
    return {
      data: {
        ...this.withProfileImage(customer),
        lastVisit: metrics._max.startsAt,
        totalSpent: metrics._sum.priceSnapshot ?? 0,
      },
    };
  }

  async appointments(id: string, query: CustomerAppointmentsQueryDto) {
    await this.assertCustomer(id);
    const where: Prisma.AppointmentWhereInput = {
      customerUserId: id,
      ...(query.status ? { status: query.status } : {}),
    };
    const [appointments, total] = await Promise.all([
      this.prisma.appointment.findMany({
        where,
        include: {
          barberProfile: {
            select: {
              id: true,
              displayName: true,
              user: { select: { name: true, status: true } },
            },
          },
        },
        orderBy: { startsAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.appointment.count({ where }),
    ]);
    return {
      data: appointments,
      meta: this.pagination(query.page, query.pageSize, total),
    };
  }

  async updateBookingBlock(id: string, blocked: boolean) {
    await this.assertCustomer(id);
    return {
      data: await this.prisma.user.update({
        where: { id },
        data: { customerBookingBlocked: blocked },
        select: {
          id: true,
          customerBookingBlocked: true,
          customerBookingLimited: true,
        },
      }),
    };
  }

  private async assertCustomer(id: string): Promise<void> {
    const customer = await this.prisma.user.findFirst({
      where: {
        id,
        role: UserRole.CUSTOMER,
        emailVerifiedAt: { not: null },
      },
      select: { id: true },
    });
    if (!customer) {
      throw new NotFoundException('Cliente não encontrado.');
    }
  }

  private pagination(page: number, pageSize: number, total: number) {
    return {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  private withProfileImage<
    T extends {
      id: string;
      profileImage: Uint8Array | null;
      profileImageMimeType: string | null;
      profileImageKey: string | null;
      updatedAt: Date;
    },
  >(user: T) {
    const { profileImage, profileImageMimeType, ...data } = user;
    void profileImage;
    void profileImageMimeType;
    return {
      ...data,
      profileImageDataUrl: profileImageDataUrl(user),
    };
  }
}
