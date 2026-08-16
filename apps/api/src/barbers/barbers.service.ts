import { createHash, randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, UserRole, UserStatus } from '@prisma/client';
import { argon2id, hash } from 'argon2';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { profileImageDataUrl } from '../users/profile-image-url';
import { assertStrongPassword } from '../auth/password-policy';
import { CompleteBarberInvitationDto } from './dto/barber-invitation.dto';

const INVITATION_TTL_MS = 48 * 60 * 60 * 1000;
const DEFAULT_BUSINESS_HOURS = [
  ...(
    ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'] as const
  ).flatMap((dayOfWeek) => [
    { dayOfWeek, startMinute: 540, endMinute: 780 },
    { dayOfWeek, startMinute: 900, endMinute: 1140 },
  ]),
  { dayOfWeek: 'SATURDAY' as const, startMinute: 540, endMinute: 840 },
];

@Injectable()
export class BarbersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async invite(actorUserId: string, emailValue: string) {
    const email = emailValue.trim().toLowerCase();
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existingUser) {
      throw new ConflictException('Este e-mail já se encontra registado.');
    }

    const { token, tokenHash, expiresAt } = this.invitationToken();
    const invitation = await this.prisma.$transaction(async (transaction) => {
      const saved = await transaction.barberInvitation.upsert({
        where: { email },
        create: { email, tokenHash, expiresAt, invitedByUserId: actorUserId },
        update: { tokenHash, expiresAt, invitedByUserId: actorUserId },
      });
      await transaction.auditLog.create({
        data: {
          actorUserId,
          action: 'BARBER_INVITED',
          targetType: 'BarberInvitation',
          targetId: saved.id,
        },
      });
      return saved;
    });
    await this.notifications.sendBarberInvitation({
      recipient: email,
      token,
      expiresAt,
    });
    return { data: this.publicInvitation(invitation) };
  }

  async resendInvitation(actorUserId: string, invitationId: string) {
    const current = await this.prisma.barberInvitation.findUnique({
      where: { id: invitationId },
    });
    if (!current) {
      throw new NotFoundException('Convite de profissional não encontrado.');
    }
    const { token, tokenHash, expiresAt } = this.invitationToken();
    const invitation = await this.prisma.barberInvitation.update({
      where: { id: invitationId },
      data: { tokenHash, expiresAt, invitedByUserId: actorUserId },
    });
    await this.notifications.sendBarberInvitation({
      recipient: invitation.email,
      token,
      expiresAt,
    });
    return { data: this.publicInvitation(invitation) };
  }

  async completeInvitation(dto: CompleteBarberInvitationDto) {
    assertStrongPassword(dto.password);
    const now = new Date();
    const tokenHash = this.hashToken(dto.token);
    const passwordHash = await hash(dto.password, { type: argon2id });
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const invitation = await transaction.barberInvitation.findUnique({
          where: { tokenHash },
        });
        if (!invitation || invitation.expiresAt <= now) {
          throw new BadRequestException('O convite é inválido ou expirou.');
        }
        const user = await transaction.user.create({
          data: {
            name: dto.name.trim(),
            email: invitation.email,
            phone: dto.phone.trim(),
            passwordHash,
            emailVerifiedAt: now,
            role: UserRole.BARBER,
            status: UserStatus.ACTIVE,
            barberProfile: {
              create: {
                displayName: dto.name.trim(),
                businessHours: { create: DEFAULT_BUSINESS_HOURS },
              },
            },
          },
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            role: true,
            status: true,
            barberProfile: { select: { id: true, displayName: true } },
          },
        });
        await transaction.barberInvitation.delete({
          where: { id: invitation.id },
        });
        await transaction.auditLog.create({
          data: {
            actorUserId: invitation.invitedByUserId,
            action: 'BARBER_REGISTRATION_COMPLETED',
            targetType: 'User',
            targetId: user.id,
          },
        });
        return { message: 'Registo concluído com sucesso.', data: user };
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'O e-mail ou telemóvel já se encontra registado.',
        );
      }
      throw error;
    }
  }

  async managementList() {
    const [barbers, invitations] = await Promise.all([
      this.prisma.barberProfile.findMany({
        where: { user: { role: UserRole.BARBER } },
        select: {
          id: true,
          displayName: true,
          createdAt: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              role: true,
              status: true,
              profileImage: true,
              profileImageMimeType: true,
              profileImageKey: true,
              updatedAt: true,
            },
          },
        },
        orderBy: { displayName: 'asc' },
      }),
      this.prisma.barberInvitation.findMany({
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    return {
      data: {
        barbers: barbers.map(({ user, ...barber }) => ({
          ...barber,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            role: user.role,
            status: user.status,
            profileImageDataUrl: profileImageDataUrl(user),
          },
        })),
        invitations: invitations.map((invitation) =>
          this.publicInvitation(invitation),
        ),
      },
    };
  }

  async list(includeInactive: boolean) {
    const profiles = await this.prisma.barberProfile.findMany({
      where: {
        user: {
          role: { in: [UserRole.BARBER, UserRole.MASTER] },
          ...(includeInactive ? {} : { status: UserStatus.ACTIVE }),
        },
      },
      select: {
        id: true,
        displayName: true,
        user: {
          select: {
            id: true,
            name: true,
            role: true,
            status: true,
            profileImage: true,
            profileImageMimeType: true,
            profileImageKey: true,
            updatedAt: true,
          },
        },
      },
      orderBy: { displayName: 'asc' },
    });
    return {
      data: profiles.map(({ user, ...profile }) => ({
        ...profile,
        user: {
          id: user.id,
          name: user.name,
          role: user.role,
          status: user.status,
          profileImageDataUrl: profileImageDataUrl(user),
        },
      })),
    };
  }

  async updateStatus(
    actorUserId: string,
    barberProfileId: string,
    status: UserStatus,
  ) {
    const profile = await this.prisma.barberProfile.findUnique({
      where: { id: barberProfileId },
      select: { userId: true, user: { select: { role: true } } },
    });
    if (!profile || profile.user.role !== UserRole.BARBER) {
      throw new NotFoundException('Profissional não encontrado.');
    }
    const user = await this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.user.update({
        where: { id: profile.userId },
        data: { status },
        select: { id: true, role: true, status: true },
      });
      await transaction.auditLog.create({
        data: {
          actorUserId,
          action:
            status === UserStatus.ACTIVE
              ? 'BARBER_ACTIVATED'
              : 'BARBER_DEACTIVATED',
          targetType: 'User',
          targetId: profile.userId,
        },
      });
      return updated;
    });
    return { data: user };
  }

  private invitationToken() {
    const token = randomBytes(32).toString('hex');
    return {
      token,
      tokenHash: this.hashToken(token),
      expiresAt: new Date(Date.now() + INVITATION_TTL_MS),
    };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private publicInvitation(invitation: {
    id: string;
    email: string;
    expiresAt: Date;
    createdAt: Date;
  }) {
    return {
      id: invitation.id,
      email: invitation.email,
      expiresAt: invitation.expiresAt,
      createdAt: invitation.createdAt,
      status: invitation.expiresAt <= new Date() ? 'EXPIRED' : 'PENDING',
    };
  }
}
