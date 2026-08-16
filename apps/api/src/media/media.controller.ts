import {
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Res,
} from '@nestjs/common';
import { UserRole, UserStatus } from '@prisma/client';
import type { Response } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { OBJECT_STORAGE, type ObjectStorage } from '../storage/object-storage';

@Controller('media/profile-images')
export class MediaController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
  ) {}

  @Get(':userId')
  async profileImage(
    @CurrentUser() requester: AuthenticatedUser,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Res() response: Response,
  ) {
    const target = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        role: true,
        status: true,
        profileImageKey: true,
        profileImage: true,
        profileImageMimeType: true,
      },
    });
    if (
      !target ||
      (requester.role === UserRole.CUSTOMER &&
        requester.id !== userId &&
        (target.role === UserRole.CUSTOMER ||
          target.status !== UserStatus.ACTIVE))
    ) {
      throw new NotFoundException('Fotografia não encontrada.');
    }
    const object = target.profileImageKey
      ? await this.storage.get(target.profileImageKey)
      : target.profileImage && target.profileImageMimeType
        ? {
            body: Buffer.from(target.profileImage),
            contentType: target.profileImageMimeType,
          }
        : null;
    if (!object) throw new NotFoundException('Fotografia não encontrada.');
    response.set({
      'Content-Type': object.contentType,
      'Content-Length': String(object.body.length),
      'Cache-Control': 'private, max-age=3600, stale-while-revalidate=86400',
      'X-Content-Type-Options': 'nosniff',
      ...(object.etag ? { ETag: object.etag } : {}),
    });
    response.send(object.body);
  }
}
