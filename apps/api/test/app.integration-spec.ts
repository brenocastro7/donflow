import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DayOfWeek, UserRole, UserStatus } from '@prisma/client';
import { argon2id, hash } from 'argon2';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PrismaService } from '../src/prisma/prisma.service';

const enabled = process.env.RUN_DATABASE_INTEGRATION === 'true';
const integration = enabled ? describe : describe.skip;

integration('Real PostgreSQL role and booking flow', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let barberServiceId: string;
  const password = 'Integration2026!';
  const emails = {
    master: 'integration.master@example.test',
    barber: 'integration.barber@example.test',
    customer: 'integration.customer@example.test',
  };

  beforeAll(async () => {
    process.env.JWT_ACCESS_SECRET =
      'integration-secret-with-at-least-32-characters';
    process.env.EMAIL_PROVIDER = 'noop';
    process.env.ENABLE_API_DOCS = 'false';
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    await cleanup();
    const passwordHash = await hash(password, { type: argon2id });
    await prisma.user.create({
      data: {
        name: 'Integration Master',
        email: emails.master,
        passwordHash,
        emailVerifiedAt: new Date(),
        role: UserRole.MASTER,
        status: UserStatus.ACTIVE,
        barberProfile: { create: { displayName: 'Integration Master' } },
      },
    });
    const barber = await prisma.user.create({
      data: {
        name: 'Integration Barber',
        email: emails.barber,
        passwordHash,
        emailVerifiedAt: new Date(),
        role: UserRole.BARBER,
        status: UserStatus.ACTIVE,
        barberProfile: { create: { displayName: 'Integration Barber' } },
      },
      include: { barberProfile: true },
    });
    const days = Object.values(DayOfWeek);
    await prisma.businessHour.createMany({
      data: days.map((dayOfWeek) => ({
        barberProfileId: barber.barberProfile!.id,
        dayOfWeek,
        startMinute: 0,
        endMinute: 1440,
      })),
    });
    const service = await prisma.barberService.create({
      data: {
        barberProfileId: barber.barberProfile!.id,
        name: 'Integration Cut',
        durationMinutes: 30,
        price: 25,
      },
    });
    barberServiceId = service.id;
  });

  afterAll(async () => {
    if (prisma) await cleanup();
    if (app) await app.close();
  });

  it('enforces registration, role isolation, authentication and the active-booking quota', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        name: 'Integration Customer',
        email: emails.customer,
        password,
        transactionalEmailConsent: true,
      })
      .expect(201);
    await prisma.user.update({
      where: { email: emails.customer },
      data: { emailVerifiedAt: new Date() },
    });

    const [masterLogin, barberLogin, customerLogin] = await Promise.all([
      login(emails.master),
      login(emails.barber),
      login(emails.customer),
    ]);
    const masterSession = sessionCookies(masterLogin.headers['set-cookie']);
    const barberSession = sessionCookies(barberLogin.headers['set-cookie']);
    const customerSession = sessionCookies(customerLogin.headers['set-cookie']);

    await request(app.getHttpServer())
      .get('/api/customers')
      .set('Cookie', masterSession.cookieHeader)
      .expect(200);
    await request(app.getHttpServer())
      .get('/api/customers')
      .set('Cookie', barberSession.cookieHeader)
      .expect(403);
    await request(app.getHttpServer())
      .get('/api/barbers/management')
      .set('Cookie', customerSession.cookieHeader)
      .expect(403);

    // Customers hold as many active bookings as they like; four is simply more
    // than the retired three-appointment cap would have allowed.
    for (const startsAt of futureStarts(4)) {
      await request(app.getHttpServer())
        .post('/api/appointments')
        .set('Cookie', customerSession.cookieHeader)
        .set('X-CSRF-Token', customerSession.csrfToken)
        .send({ barberServiceId, startsAt })
        .expect(201);
    }

    // The no-show penalty is the one quota that survives: while it is active the
    // customer is capped at a single booking, and must go through a professional.
    await prisma.user.update({
      where: { email: emails.customer },
      data: { customerBookingLimited: true },
    });
    await request(app.getHttpServer())
      .post('/api/appointments')
      .set('Cookie', customerSession.cookieHeader)
      .set('X-CSRF-Token', customerSession.csrfToken)
      .send({ barberServiceId, startsAt: futureStarts(5)[4] })
      .expect(403);
    await prisma.user.update({
      where: { email: emails.customer },
      data: { customerBookingLimited: false },
    });
  });

  function login(identifier: string) {
    return request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ identifier, password })
      .expect(201);
  }

  function sessionCookies(value: string[] | undefined) {
    if (!value?.length)
      throw new Error('The login response did not contain session cookies.');
    const cookies = value.map((entry) => entry.split(';', 1)[0]);
    const csrfCookie = cookies.find((entry) =>
      entry.startsWith('donflow_csrf='),
    );
    if (!csrfCookie)
      throw new Error('The login response did not contain a CSRF token.');
    return {
      cookieHeader: cookies.join('; '),
      csrfToken: decodeURIComponent(csrfCookie.slice('donflow_csrf='.length)),
    };
  }

  function futureStarts(count: number) {
    return Array.from({ length: count }, (_, index) => {
      const value = new Date();
      value.setUTCDate(value.getUTCDate() + 3 + index);
      value.setUTCHours(12, 0, 0, 0);
      return value.toISOString();
    });
  }

  async function cleanup() {
    const users = await prisma.user.findMany({
      where: { email: { in: Object.values(emails) } },
      select: { id: true, barberProfile: { select: { id: true } } },
    });
    const userIds = users.map((user) => user.id);
    const profileIds = users.flatMap((user) =>
      user.barberProfile ? [user.barberProfile.id] : [],
    );
    await prisma.inAppNotification.deleteMany({
      where: { userId: { in: userIds } },
    });
    await prisma.review.deleteMany({
      where: { customerUserId: { in: userIds } },
    });
    await prisma.appointment.deleteMany({
      where: {
        OR: [
          { customerUserId: { in: userIds } },
          { barberProfileId: { in: profileIds } },
        ],
      },
    });
    await prisma.auditLog.deleteMany({
      where: { actorUserId: { in: userIds } },
    });
    await prisma.barberService.deleteMany({
      where: { barberProfileId: { in: profileIds } },
    });
    await prisma.barberProfile.deleteMany({
      where: { id: { in: profileIds } },
    });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }
});
