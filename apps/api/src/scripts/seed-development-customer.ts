import '../config/load-environment';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, UserRole, UserStatus } from '@prisma/client';
import { argon2id, hash } from 'argon2';

const email = process.env.DEV_CUSTOMER_EMAIL ?? 'customer.test@example.test';
const password = process.env.DEV_CUSTOMER_PASSWORD ?? 'DevCustomer2026!';
const name = process.env.DEV_CUSTOMER_NAME ?? 'Test Customer';

async function seed(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'The development customer cannot be created in production.',
    );
  }
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is required');

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });
  try {
    const passwordHash = await hash(password, { type: argon2id });
    const user = await prisma.user.upsert({
      where: { email },
      create: {
        name,
        email,
        passwordHash,
        emailVerifiedAt: new Date(),
        transactionalEmailConsentAt: new Date(),
        role: UserRole.CUSTOMER,
        status: UserStatus.ACTIVE,
      },
      update: {
        name,
        passwordHash,
        emailVerifiedAt: new Date(),
        transactionalEmailConsentAt: new Date(),
        role: UserRole.CUSTOMER,
        status: UserStatus.ACTIVE,
        customerBookingBlocked: false,
        customerBookingLimited: false,
      },
      select: { id: true, email: true },
    });
    console.log(`Development customer ready: ${user.email} (${user.id})`);
  } finally {
    await prisma.$disconnect();
  }
}

void seed();
