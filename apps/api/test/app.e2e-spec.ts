import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserRole, UserStatus } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/app.setup';
import { NotificationsService } from './../src/notifications/notifications.service';
import { HealthResponse } from './../src/health/health.controller';
import { PrismaService } from './../src/prisma/prisma.service';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;
  const createdAt = new Date('2026-07-26T12:00:00.000Z');
  const prisma = {
    user: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
    $queryRaw: jest.fn(),
  };
  const notificationsService = {
    sendEmailVerification: jest.fn(),
  };
  const jwtSecret = 'e2e-test-secret-with-at-least-32-characters';
  const jwtService = new JwtService();

  beforeEach(async () => {
    process.env.JWT_ACCESS_SECRET = jwtSecret;
    process.env.ENABLE_API_DOCS = 'true';
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(NotificationsService)
      .useValue(notificationsService)
      .compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    jest.clearAllMocks();
    prisma.user.findUnique.mockResolvedValue({
      role: UserRole.CUSTOMER,
      status: UserStatus.ACTIVE,
      barberProfile: null,
    });
  });

  it('protects barber listing with authentication', () => {
    return request(app.getHttpServer())
      .get('/api/barbers')
      .expect(401)
      .expect(({ body }) => {
        expect(body).toEqual(
          expect.objectContaining({
            message: 'É necessário iniciar sessão.',
            error: 'Não autorizado',
          }),
        );
      });
  });

  it('protects administrative customer queries', () => {
    return request(app.getHttpServer()).get('/api/customers').expect(401);
  });

  it('prevents a customer from creating a barber', () => {
    const token = jwtService.sign(
      {
        sub: '5d0f2ed4-6423-4ae9-906b-ec6b4cc37c2b',
        role: UserRole.CUSTOMER,
      },
      { secret: jwtSecret },
    );
    return request(app.getHttpServer())
      .post('/api/barbers')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Barber',
        email: 'barber@example.com',
        password: 'SecurePassword1!',
      })
      .expect(403);
  });

  it('protects availability and appointments with authentication', async () => {
    await request(app.getHttpServer()).get('/api/availability').expect(401);
    await request(app.getHttpServer()).post('/api/appointments').expect(401);
    await request(app.getHttpServer())
      .get('/api/appointments/5d0f2ed4-6423-4ae9-906b-ec6b4cc37c2b')
      .expect(401);
  });

  it('validates the appointment calendar query', () => {
    const token = jwtService.sign(
      {
        sub: '5d0f2ed4-6423-4ae9-906b-ec6b4cc37c2b',
        role: UserRole.CUSTOMER,
      },
      { secret: jwtSecret },
    );
    return request(app.getHttpServer())
      .get('/api/appointments?view=year&date=invalid')
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
  });

  it('accepts only final appointment lifecycle statuses', () => {
    prisma.user.findUnique.mockResolvedValue({
      role: UserRole.BARBER,
      status: UserStatus.ACTIVE,
      barberProfile: { id: '2c953987-aad4-4681-80ad-2455f480b47d' },
    });
    const token = jwtService.sign(
      {
        sub: '5d0f2ed4-6423-4ae9-906b-ec6b4cc37c2b',
        role: UserRole.BARBER,
        barberProfileId: '2c953987-aad4-4681-80ad-2455f480b47d',
      },
      { secret: jwtSecret },
    );
    return request(app.getHttpServer())
      .patch('/api/appointments/5d0f2ed4-6423-4ae9-906b-ec6b4cc37c2b/status')
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'PENDING' })
      .expect(400);
  });

  it('prevents a customer from creating a service template', () => {
    const token = jwtService.sign(
      {
        sub: '5d0f2ed4-6423-4ae9-906b-ec6b4cc37c2b',
        role: UserRole.CUSTOMER,
      },
      { secret: jwtSecret },
    );
    return request(app.getHttpServer())
      .post('/api/service-templates')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Haircut', durationMinutes: 30, price: 20 })
      .expect(403);
  });

  it('/api (GET)', () => {
    return request(app.getHttpServer())
      .get('/api')
      .expect(200)
      .expect('Hello World!');
  });

  it('/api/health (GET)', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/health')
      .expect(200);
    const body = response.body as HealthResponse;

    expect(body.status).toBe('ok');
    expect(body.service).toBe('donflow-api');
    expect(typeof body.timestamp).toBe('string');
    expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp);
  });

  it('/api/docs-json (GET) exposes the OpenAPI contract', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/docs-json')
      .expect(200);
    const body = response.body as {
      openapi: string;
      info: { title: string };
      components: {
        schemas: {
          CreateAppointmentDto: {
            properties: Record<string, unknown>;
          };
        };
      };
    };
    expect(body.openapi).toMatch(/^3\./);
    expect(body.info.title).toBe('DonFlow API');
    const appointmentProperties = Object.keys(
      body.components.schemas.CreateAppointmentDto.properties,
    );
    expect(appointmentProperties).toEqual(
      expect.arrayContaining([
        'barberServiceId',
        'startsAt',
        'customerName',
        'customerPhone',
      ]),
    );
  });

  it('/api/health/ready (GET) checks the database', async () => {
    prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

    await request(app.getHttpServer())
      .get('/api/health/ready')
      .expect(200)
      .expect((response) => {
        expect(response.body).toEqual(
          expect.objectContaining({ status: 'ok', database: 'up' }),
        );
      });
  });

  it('/api/auth/register (POST) persists a sanitized customer', async () => {
    prisma.user.create.mockResolvedValue({
      id: '5d0f2ed4-6423-4ae9-906b-ec6b4cc37c2b',
      name: 'David',
      email: 'david@example.com',
      phone: null,
      role: UserRole.CUSTOMER,
      status: UserStatus.ACTIVE,
      emailVerifiedAt: null,
      createdAt,
    });

    const response = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        name: 'David',
        email: 'david@example.com',
        password: 'SecurePassword1!',
        transactionalEmailConsent: true,
      })
      .expect(201);

    expect(response.body).toEqual({
      message: 'Cliente registado com sucesso.',
      data: {
        id: '5d0f2ed4-6423-4ae9-906b-ec6b4cc37c2b',
        name: 'David',
        email: 'david@example.com',
        phone: null,
        role: 'CUSTOMER',
        status: 'ACTIVE',
        emailVerifiedAt: null,
        createdAt: createdAt.toISOString(),
      },
    });
    expect(prisma.user.create).toHaveBeenCalledTimes(1);
    expect(notificationsService.sendEmailVerification).toHaveBeenCalledTimes(1);
  });

  it('/api/auth/confirm-email (POST) rejects malformed tokens', () => {
    return request(app.getHttpServer())
      .post('/api/auth/confirm-email')
      .send({ token: 'invalid' })
      .expect(400);
  });

  it('/api/auth/reset-password (POST) rejects malformed tokens', () => {
    return request(app.getHttpServer())
      .post('/api/auth/reset-password')
      .send({ token: 'invalid', newPassword: 'new-password' })
      .expect(400);
  });

  it('/api/auth/register (POST) rejects invalid input and role injection', () => {
    return request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        name: '',
        email: 'invalid-email',
        password: 'short',
        role: 'MASTER',
      })
      .expect(400);
  });

  it('rejects cookie-authenticated mutations without a matching CSRF token', () => {
    return request(app.getHttpServer())
      .post('/api/auth/logout')
      .set('Cookie', 'donflow_access=fake; donflow_csrf=expected')
      .expect(400);
  });

  afterEach(async () => {
    await app.close();
  });
});
