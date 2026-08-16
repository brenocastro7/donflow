import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserRole, UserStatus } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AuthorizationService } from '../auth/authorization.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateBarberServiceDto,
  CreateServiceTemplateDto,
  UpdateBarberServiceDto,
  UpdateServiceTemplateDto,
} from './dto/service.dto';

@Injectable()
export class ServicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: AuthorizationService,
  ) {}

  async createTemplate(dto: CreateServiceTemplateDto) {
    return {
      data: await this.prisma.serviceTemplate.create({
        data: {
          ...dto,
          name: dto.name.trim(),
          description: dto.description?.trim(),
        },
      }),
    };
  }

  async listTemplates() {
    return {
      data: await this.prisma.serviceTemplate.findMany({
        orderBy: { name: 'asc' },
      }),
    };
  }

  async listMasterCatalog() {
    return {
      data: await this.prisma.barberService.findMany({
        where: {
          isActive: true,
          barberProfile: {
            user: { role: UserRole.MASTER, status: UserStatus.ACTIVE },
          },
        },
        select: {
          id: true,
          name: true,
          description: true,
          durationMinutes: true,
          price: true,
        },
        orderBy: { name: 'asc' },
      }),
    };
  }

  async updateTemplate(id: string, dto: UpdateServiceTemplateDto) {
    return {
      data: await this.prisma.serviceTemplate.update({
        where: { id },
        data: dto,
      }),
    };
  }

  async createBarberService(
    user: AuthenticatedUser,
    dto: CreateBarberServiceDto,
  ) {
    const barberProfileId =
      user.role === UserRole.MASTER
        ? (dto.barberProfileId ?? user.barberProfileId)
        : user.barberProfileId;
    if (!barberProfileId) {
      throw new BadRequestException('É necessário um perfil de agenda.');
    }
    this.authorization.assertBarberOwnership(user, barberProfileId);

    const profile = await this.prisma.barberProfile.findUnique({
      where: { id: barberProfileId },
      select: { user: { select: { status: true } } },
    });
    if (!profile || profile.user.status !== UserStatus.ACTIVE) {
      throw new NotFoundException('Profissional ativo não encontrado.');
    }

    const template = dto.serviceTemplateId
      ? await this.prisma.serviceTemplate.findUnique({
          where: { id: dto.serviceTemplateId },
        })
      : null;
    if (dto.serviceTemplateId && (!template || !template.isActive)) {
      throw new NotFoundException('Modelo de serviço ativo não encontrado.');
    }

    if (dto.serviceTemplateId && dto.sourceBarberServiceId) {
      throw new BadRequestException(
        'Escolhe apenas uma origem para o serviço.',
      );
    }

    const sourceService = dto.sourceBarberServiceId
      ? await this.prisma.barberService.findFirst({
          where: {
            id: dto.sourceBarberServiceId,
            isActive: true,
            barberProfile: {
              user: { role: UserRole.MASTER, status: UserStatus.ACTIVE },
            },
          },
        })
      : null;
    if (dto.sourceBarberServiceId && !sourceService) {
      throw new NotFoundException('Serviço partilhado ativo não encontrado.');
    }

    if (sourceService) {
      const existingAdoption = await this.prisma.barberService.findFirst({
        where: {
          barberProfileId,
          sourceBarberServiceId: sourceService.id,
        },
      });
      if (existingAdoption) {
        throw new ConflictException(
          'Este serviço partilhado já foi adicionado.',
        );
      }
    }

    const name = dto.name?.trim() || sourceService?.name || template?.name;
    const durationMinutes =
      dto.durationMinutes ??
      sourceService?.durationMinutes ??
      template?.durationMinutes;
    const price = dto.price ?? sourceService?.price ?? template?.price;
    if (!name || !durationMinutes || price === undefined) {
      throw new BadRequestException(
        'Sem um modelo, o nome, a duração e o preço são obrigatórios.',
      );
    }

    return {
      data: await this.prisma.barberService.create({
        data: {
          barberProfileId,
          serviceTemplateId: template?.id,
          sourceBarberServiceId: sourceService?.id,
          name,
          description:
            dto.description?.trim() ??
            sourceService?.description ??
            template?.description,
          durationMinutes,
          price,
        },
      }),
    };
  }

  async listBarberServices(
    user: AuthenticatedUser,
    barberProfileId: string,
    includeInactive = false,
  ) {
    const canSeeInactive =
      includeInactive &&
      (user.role === UserRole.MASTER ||
        user.barberProfileId === barberProfileId);
    return {
      data: await this.prisma.barberService.findMany({
        where: {
          barberProfileId,
          ...(canSeeInactive ? {} : { isActive: true }),
        },
        orderBy: { name: 'asc' },
      }),
    };
  }

  async updateBarberService(
    user: AuthenticatedUser,
    id: string,
    dto: UpdateBarberServiceDto,
  ) {
    const service = await this.prisma.barberService.findUnique({
      where: { id },
      select: { barberProfileId: true },
    });
    if (!service) {
      throw new NotFoundException('Serviço do profissional não encontrado.');
    }
    this.authorization.assertBarberOwnership(user, service.barberProfileId);
    return {
      data: await this.prisma.barberService.update({
        where: { id },
        data: dto,
      }),
    };
  }

  async deleteBarberService(user: AuthenticatedUser, id: string) {
    const service = await this.prisma.barberService.findUnique({
      where: { id },
      select: {
        barberProfileId: true,
        _count: { select: { appointments: true } },
      },
    });
    if (!service) {
      throw new NotFoundException('Serviço do profissional não encontrado.');
    }
    this.authorization.assertBarberOwnership(user, service.barberProfileId);
    if (service._count.appointments > 0) {
      throw new ConflictException(
        'Este serviço possui marcações associadas e não pode ser eliminado. Desativa-o para impedir novas marcações.',
      );
    }
    await this.prisma.barberService.delete({ where: { id } });
    return { data: { id } };
  }
}
