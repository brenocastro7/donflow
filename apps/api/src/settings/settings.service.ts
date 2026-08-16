import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { verify } from 'argon2';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateAccountDto, UpdateShopDto } from './dto/settings.dto';

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async getAccount(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        pendingEmail: true,
        phone: true,
        emailVerifiedAt: true,
      },
    });
    return {
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        pendingEmail: user.pendingEmail,
        emailConfirmationPending: Boolean(user.pendingEmail),
      },
    };
  }

  async updateAccount(userId: string, dto: UpdateAccountDto) {
    try {
      const current = await this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: {
          email: true,
          phone: true,
          passwordHash: true,
          barberProfile: { select: { id: true } },
        },
      });
      const email = dto.email?.trim().toLowerCase();
      const emailChanged = Boolean(email && email !== current.email);
      const phoneChanged = Boolean(
        dto.phone && dto.phone.trim() !== current.phone,
      );
      if (emailChanged || phoneChanged) {
        const passwordMatches = dto.currentPassword
          ? await verify(current.passwordHash, dto.currentPassword)
          : false;
        if (!passwordMatches) {
          throw new UnauthorizedException(
            'Introduz a palavra-passe atual para alterar o e-mail ou telemóvel.',
          );
        }
      }
      if (emailChanged) {
        const conflict = await this.prisma.user.findFirst({
          where: {
            id: { not: userId },
            OR: [{ email }, { pendingEmail: email }],
          },
          select: { id: true },
        });
        if (conflict) {
          throw new ConflictException('O e-mail já pertence a outra conta.');
        }
      }
      const rawToken = emailChanged ? randomBytes(32).toString('hex') : null;
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
      const user = await this.prisma.$transaction(async (transaction) => {
        const saved = await transaction.user.update({
          where: { id: userId },
          data: {
            ...(dto.name ? { name: dto.name.trim() } : {}),
            ...(emailChanged ? { pendingEmail: email } : {}),
            ...(dto.phone ? { phone: dto.phone.trim() } : {}),
          },
          select: {
            id: true,
            name: true,
            email: true,
            pendingEmail: true,
            phone: true,
            emailVerifiedAt: true,
          },
        });
        if (dto.name && current.barberProfile) {
          await transaction.barberProfile.update({
            where: { id: current.barberProfile.id },
            data: { displayName: dto.name.trim() },
          });
        }
        if (rawToken) {
          const tokenHash = createHash('sha256').update(rawToken).digest('hex');
          await transaction.emailVerificationToken.upsert({
            where: { userId },
            create: { userId, tokenHash, expiresAt },
            update: { tokenHash, expiresAt },
          });
        }
        return saved;
      });
      if (rawToken && user.pendingEmail) {
        await this.notifications.sendEmailVerification({
          recipient: user.pendingEmail,
          token: rawToken,
          expiresAt,
        });
      }
      return {
        data: {
          id: user.id,
          name: user.name,
          email: user.email,
          pendingEmail: user.pendingEmail,
          phone: user.phone,
          emailConfirmationPending: Boolean(user.pendingEmail),
        },
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'O e-mail ou telemóvel já pertence a outra conta.',
        );
      }
      throw error;
    }
  }

  async getShop() {
    return {
      data: await this.prisma.shopSettings.upsert({
        where: { id: 1 },
        create: { id: 1 },
        update: {},
      }),
    };
  }

  async updateShop(dto: UpdateShopDto) {
    for (const hour of dto.businessHours ?? []) {
      if (hour.startMinute >= hour.endMinute) {
        throw new ConflictException(
          'O fim do horário deve ser posterior ao início.',
        );
      }
    }
    const profiles = await this.prisma.barberProfile.findMany({
      select: { id: true },
    });
    const businessHours = dto.businessHours?.map(
      ({ dayOfWeek, startMinute, endMinute }) => ({
        dayOfWeek,
        startMinute,
        endMinute,
      }),
    ) as Prisma.InputJsonValue | undefined;
    const data = await this.prisma.$transaction(async (transaction) => {
      const saved = await transaction.shopSettings.upsert({
        where: { id: 1 },
        create: {
          id: 1,
          ...(dto.address !== undefined
            ? { address: dto.address.trim() || null }
            : {}),
          ...(businessHours !== undefined ? { businessHours } : {}),
        },
        update: {
          ...(dto.address !== undefined
            ? { address: dto.address.trim() || null }
            : {}),
          ...(businessHours !== undefined ? { businessHours } : {}),
        },
      });
      if (dto.businessHours !== undefined) {
        const profileIds = profiles.map((profile) => profile.id);
        await transaction.businessHour.deleteMany({
          where: { barberProfileId: { in: profileIds } },
        });
        if (profileIds.length && dto.businessHours.length) {
          await transaction.businessHour.createMany({
            data: profiles.flatMap((profile) =>
              dto.businessHours!.map((hour) => ({
                ...hour,
                barberProfileId: profile.id,
              })),
            ),
          });
        }
      }
      return saved;
    });
    return { data };
  }
}
