import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AppointmentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(customerUserId: string, dto: CreateReviewDto) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: dto.appointmentId },
      select: { customerUserId: true, status: true },
    });
    if (!appointment) throw new NotFoundException('Marcação não encontrada.');
    if (appointment.customerUserId !== customerUserId) {
      throw new ForbiddenException(
        'Só pode avaliar uma marcação da própria conta.',
      );
    }
    if (appointment.status !== AppointmentStatus.COMPLETED) {
      throw new ConflictException(
        'A avaliação só pode ser enviada após a conclusão.',
      );
    }
    try {
      return {
        data: await this.prisma.review.create({
          data: {
            appointmentId: dto.appointmentId,
            customerUserId,
            rating: dto.rating,
            comment: dto.comment?.trim() || null,
          },
        }),
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Esta marcação já foi avaliada.');
      }
      throw error;
    }
  }

  async listMine(customerUserId: string) {
    return {
      data: await this.prisma.review.findMany({
        where: { customerUserId },
        include: {
          appointment: {
            select: { startsAt: true, serviceNameSnapshot: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    };
  }
}
