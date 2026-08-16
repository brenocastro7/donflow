import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma, UserRole, UserStatus } from '@prisma/client';
import { argon2id, hash, verify } from 'argon2';
import { randomBytes, randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { PrismaService } from '../prisma/prisma.service';
import { OBJECT_STORAGE, type ObjectStorage } from '../storage/object-storage';
import {
  CreateCustomerDto,
  CreateEmailVerificationDto,
} from './dto/create-customer.dto';
import type { AuthenticationUser, RegisterCustomerResult } from './users.types';
import { profileImageDataUrl } from './profile-image-url';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);
  constructor(
    private readonly prisma: PrismaService,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
  ) {}

  async getCurrentUser(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        role: true,
        barberProfile: { select: { id: true } },
        profileImage: true,
        profileImageMimeType: true,
        profileImageKey: true,
        updatedAt: true,
        customerBookingBlocked: true,
        customerBookingLimited: true,
        mfaEnabledAt: true,
      },
    });
    return {
      data: {
        id: user.id,
        name: user.name,
        role: user.role,
        barberProfileId: user.barberProfile?.id ?? null,
        profileImageDataUrl: profileImageDataUrl(user),
        customerBookingBlocked: user.customerBookingBlocked,
        customerBookingLimited: user.customerBookingLimited,
        mfaEnabled: Boolean(user.mfaEnabledAt),
      },
    };
  }

  async updateProfileImage(userId: string, dataUrl: string) {
    const match =
      /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(
        dataUrl,
      );
    if (!match) {
      throw new BadRequestException(
        'Seleciona uma imagem JPEG, PNG ou WebP válida.',
      );
    }
    const image = Buffer.from(match[2], 'base64');
    if (!image.length || image.length > 1_000_000) {
      throw new BadRequestException('A fotografia deve ter no máximo 1 MB.');
    }
    if (!this.hasValidImageSignature(image, match[1])) {
      throw new BadRequestException(
        'O conteúdo do ficheiro não corresponde a uma imagem válida.',
      );
    }
    let sanitizedImage: Buffer;
    try {
      const pipeline = sharp(image, {
        failOn: 'warning',
        limitInputPixels: 16_777_216,
      }).rotate();
      const metadata = await pipeline.metadata();
      const expectedFormat = {
        'image/jpeg': 'jpeg',
        'image/png': 'png',
        'image/webp': 'webp',
      }[match[1]];
      if (
        metadata.format !== expectedFormat ||
        !metadata.width ||
        !metadata.height ||
        metadata.width > 4096 ||
        metadata.height > 4096
      ) {
        throw new Error('Unsupported image characteristics');
      }
      sanitizedImage =
        match[1] === 'image/png'
          ? await pipeline.png({ compressionLevel: 9 }).toBuffer()
          : match[1] === 'image/webp'
            ? await pipeline.webp({ quality: 85 }).toBuffer()
            : await pipeline.jpeg({ quality: 85, mozjpeg: true }).toBuffer();
      if (sanitizedImage.length > 1_000_000) {
        throw new Error('Sanitized image exceeds size limit');
      }
    } catch {
      throw new BadRequestException(
        'Não foi possível validar e processar a fotografia enviada.',
      );
    }
    const current = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { profileImageKey: true },
    });
    const extension = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
    }[match[1]];
    const key = `profile-images/${userId}/${randomUUID()}.${extension}`;
    try {
      await this.storage.put(key, sanitizedImage, match[1]);
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          profileImageKey: key,
          profileImage: null,
          profileImageMimeType: match[1],
        },
      });
    } catch (error) {
      await this.storage.delete(key).catch(() => undefined);
      this.logger.error(
        'Profile image storage failed',
        error instanceof Error ? error.stack : undefined,
      );
      throw new ServiceUnavailableException(
        'Não foi possível guardar a fotografia. Tenta novamente.',
      );
    }
    if (current.profileImageKey && current.profileImageKey !== key) {
      await this.storage
        .delete(current.profileImageKey)
        .catch((error) =>
          this.logger.warn(
            `Could not remove replaced profile image: ${String(error)}`,
          ),
        );
    }
    return this.getCurrentUser(userId);
  }

  async deleteProfileImage(userId: string) {
    const current = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { profileImageKey: true },
    });
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        profileImageKey: null,
        profileImage: null,
        profileImageMimeType: null,
      },
    });
    if (current.profileImageKey)
      await this.storage.delete(current.profileImageKey).catch(() => undefined);
    return this.getCurrentUser(userId);
  }

  async deleteCustomerAccount(
    userId: string,
    currentPassword: string,
  ): Promise<void> {
    const currentUser = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true, profileImageKey: true },
    });
    if (
      !currentUser ||
      !(await verify(currentUser.passwordHash, currentPassword))
    ) {
      throw new UnauthorizedException('A palavra-passe atual é inválida.');
    }
    const futureAppointments = await this.prisma.appointment.count({
      where: {
        customerUserId: userId,
        status: 'CONFIRMED',
        startsAt: { gte: new Date() },
      },
    });
    if (futureAppointments) {
      throw new ConflictException(
        'Cancela as marcações futuras antes de eliminar a conta.',
      );
    }
    const passwordHash = await hash(randomBytes(32).toString('hex'), {
      type: argon2id,
    });
    await this.prisma.$transaction(async (transaction) => {
      await transaction.emailVerificationToken.deleteMany({
        where: { userId },
      });
      await transaction.passwordResetToken.deleteMany({ where: { userId } });
      await transaction.inAppNotification.deleteMany({ where: { userId } });
      await transaction.authSession.deleteMany({ where: { userId } });
      await transaction.user.update({
        where: { id: userId, role: UserRole.CUSTOMER },
        data: {
          name: 'Conta eliminada',
          email: null,
          pendingEmail: null,
          phone: null,
          passwordHash,
          transactionalEmailConsentAt: null,
          emailVerifiedAt: null,
          profileImage: null,
          profileImageMimeType: null,
          profileImageKey: null,
          status: UserStatus.INACTIVE,
          customerBookingBlocked: true,
        },
      });
    });
    if (currentUser.profileImageKey) {
      await this.storage
        .delete(currentUser.profileImageKey)
        .catch(() => undefined);
    }
  }

  private hasValidImageSignature(image: Buffer, mimeType: string): boolean {
    if (mimeType === 'image/jpeg') {
      return (
        image.length >= 3 &&
        image[0] === 0xff &&
        image[1] === 0xd8 &&
        image[2] === 0xff
      );
    }
    if (mimeType === 'image/png') {
      return image
        .subarray(0, 8)
        .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    }
    return (
      image.length >= 12 &&
      image.subarray(0, 4).toString('ascii') === 'RIFF' &&
      image.subarray(8, 12).toString('ascii') === 'WEBP'
    );
  }

  async findForAuthentication(
    identifier: string,
  ): Promise<AuthenticationUser | null> {
    const normalizedIdentifier = identifier.trim();
    const isEmail = normalizedIdentifier.includes('@');
    // Phones are stored with an explicit country prefix (see PhoneInput), but the
    // login field is free text with no country picker. Portugal is the default
    // country there too, so a bare national number (no leading "+") is assumed to
    // be +351 rather than rejected outright as a wrong-credentials error.
    const phone = normalizedIdentifier.startsWith('+')
      ? normalizedIdentifier
      : `+351${normalizedIdentifier.replace(/\D/g, '')}`;

    return this.prisma.user.findFirst({
      where: isEmail
        ? { email: normalizedIdentifier.toLowerCase() }
        : { phone },
      select: {
        id: true,
        passwordHash: true,
        role: true,
        status: true,
        emailVerifiedAt: true,
        mfaSecretEncrypted: true,
        mfaEnabledAt: true,
        mfaRecoveryCodeHashes: true,
        failedLoginAttempts: true,
        loginLockedUntil: true,
        barberProfile: { select: { id: true } },
      },
    });
  }

  async createCustomer(
    createCustomerDto: CreateCustomerDto,
    emailVerification: CreateEmailVerificationDto,
  ): Promise<RegisterCustomerResult> {
    const email = createCustomerDto.email.trim().toLowerCase();
    const phone = createCustomerDto.phone?.trim();
    const passwordHash = await hash(createCustomerDto.password, {
      type: argon2id,
    });

    try {
      const user = await this.prisma.user.create({
        data: {
          name: createCustomerDto.name.trim(),
          email,
          phone,
          passwordHash,
          transactionalEmailConsentAt:
            createCustomerDto.transactionalEmailConsent ? new Date() : null,
          emailVerificationToken: {
            create: emailVerification,
          },
          role: UserRole.CUSTOMER,
          status: UserStatus.ACTIVE,
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          status: true,
          emailVerifiedAt: true,
          createdAt: true,
        },
      });

      return {
        message: 'Cliente registado com sucesso.',
        data: user,
      };
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

  async verifyCustomerEmail(
    tokenHash: string,
    verifiedAt: Date,
  ): Promise<{ role: UserRole }> {
    return this.prisma.$transaction(async (transaction) => {
      const verificationToken =
        await transaction.emailVerificationToken.findUnique({
          where: { tokenHash },
          select: {
            id: true,
            userId: true,
            expiresAt: true,
            user: { select: { pendingEmail: true, role: true } },
          },
        });

      if (!verificationToken || verificationToken.expiresAt <= verifiedAt) {
        throw new BadRequestException(
          'O código de confirmação do e-mail é inválido ou expirou.',
        );
      }

      await transaction.user.update({
        where: { id: verificationToken.userId },
        data: verificationToken.user.pendingEmail
          ? {
              email: verificationToken.user.pendingEmail,
              pendingEmail: null,
              emailVerifiedAt: verifiedAt,
            }
          : { emailVerifiedAt: verifiedAt },
      });

      await transaction.emailVerificationToken.delete({
        where: { id: verificationToken.id },
      });

      return { role: verificationToken.user.role };
    });
  }

  async createPasswordResetToken(
    emailValue: string,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<string | null> {
    const email = emailValue.trim().toLowerCase();
    const user = await this.prisma.user.findFirst({
      where: { email, status: UserStatus.ACTIVE },
      select: { id: true, email: true },
    });
    if (!user?.email) {
      return null;
    }
    await this.prisma.passwordResetToken.upsert({
      where: { userId: user.id },
      create: { userId: user.id, tokenHash, expiresAt },
      update: { tokenHash, expiresAt, createdAt: new Date() },
    });
    return user.email;
  }

  async refreshEmailVerificationToken(
    emailValue: string,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<string | null> {
    const email = emailValue.trim().toLowerCase();
    const user = await this.prisma.user.findFirst({
      where: {
        email,
        role: UserRole.CUSTOMER,
        status: UserStatus.ACTIVE,
        emailVerifiedAt: null,
      },
      select: { id: true, email: true },
    });
    if (!user?.email) {
      return null;
    }
    await this.prisma.emailVerificationToken.upsert({
      where: { userId: user.id },
      create: { userId: user.id, tokenHash, expiresAt },
      update: { tokenHash, expiresAt, createdAt: new Date() },
    });
    return user.email;
  }

  async resetPassword(
    tokenHash: string,
    newPassword: string,
    now: Date,
  ): Promise<void> {
    const passwordHash = await hash(newPassword, { type: argon2id });
    await this.prisma.$transaction(async (transaction) => {
      const token = await transaction.passwordResetToken.findUnique({
        where: { tokenHash },
        select: { id: true, userId: true, expiresAt: true },
      });
      if (!token || token.expiresAt <= now) {
        throw new BadRequestException(
          'O código de redefinição da palavra-passe é inválido ou expirou.',
        );
      }
      await transaction.user.update({
        where: { id: token.userId },
        data: { passwordHash },
      });
      await transaction.passwordResetToken.delete({
        where: { id: token.id },
      });
      await transaction.authSession.updateMany({
        where: { userId: token.userId, revokedAt: null },
        data: { revokedAt: now },
      });
    });
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });
    if (!user || !(await verify(user.passwordHash, currentPassword))) {
      throw new UnauthorizedException('A palavra-passe atual é inválida.');
    }
    const passwordHash = await hash(newPassword, { type: argon2id });
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { passwordHash },
      }),
      this.prisma.passwordResetToken.deleteMany({ where: { userId } }),
      this.prisma.authSession.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
  }
}
