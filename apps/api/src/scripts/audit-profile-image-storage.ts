import '../config/load-environment';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';
import { OBJECT_STORAGE, type ObjectStorage } from '../storage/object-storage';

async function audit(): Promise<void> {
  if (process.env.STORAGE_PROVIDER !== 'r2') {
    throw new Error('STORAGE_PROVIDER must be r2 to audit object storage');
  }
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error'],
  });
  try {
    const prisma = app.get(PrismaService);
    const storage = app.get<ObjectStorage>(OBJECT_STORAGE);
    await storage.ping();
    const users = await prisma.user.findMany({
      where: { profileImageKey: { not: null } },
      select: { profileImageKey: true },
    });
    let readable = 0;
    let missing = 0;
    for (const user of users) {
      if (!user.profileImageKey) continue;
      const object = await storage.get(user.profileImageKey);
      if (object?.body.length) readable += 1;
      else missing += 1;
    }
    console.log(
      `Profile-image storage audit: database=${users.length}, readable=${readable}, missing=${missing}.`,
    );
  } finally {
    await app.close();
  }
}

void audit().catch((error: unknown) => {
  const errorName = error instanceof Error ? error.name : 'UnknownError';
  console.error(`Profile-image storage audit failed (${errorName}).`);
  process.exitCode = 1;
});
