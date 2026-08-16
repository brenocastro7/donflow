import '../config/load-environment';
import { randomUUID } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';
import { OBJECT_STORAGE, type ObjectStorage } from '../storage/object-storage';

const extension: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

async function migrate(): Promise<void> {
  if (process.env.STORAGE_PROVIDER !== 'r2') {
    throw new Error('STORAGE_PROVIDER must be r2 to migrate profile images');
  }
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error'],
  });
  const prisma = app.get(PrismaService);
  const storage = app.get<ObjectStorage>(OBJECT_STORAGE);
  try {
    await storage.ping();
    const users = await prisma.user.findMany({
      where: { profileImage: { not: null }, profileImageKey: null },
      select: { id: true, profileImage: true, profileImageMimeType: true },
    });
    let migrated = 0;
    for (const user of users) {
      if (!user.profileImage || !user.profileImageMimeType) continue;
      const suffix = extension[user.profileImageMimeType];
      if (!suffix) continue;
      const key = `profile-images/${user.id}/${randomUUID()}.${suffix}`;
      await storage.put(
        key,
        Buffer.from(user.profileImage),
        user.profileImageMimeType,
      );
      try {
        await prisma.user.update({
          where: { id: user.id },
          data: { profileImageKey: key, profileImage: null },
        });
        migrated += 1;
      } catch (error) {
        await storage.delete(key).catch(() => undefined);
        throw error;
      }
    }
    console.log(
      `R2 connection verified. Migrated profile images: ${migrated}.`,
    );
  } finally {
    await app.close();
  }
}

void migrate().catch((error: unknown) => {
  const errorName = error instanceof Error ? error.name : 'UnknownError';
  console.error(`R2 profile-image migration failed (${errorName}).`);
  process.exitCode = 1;
});
