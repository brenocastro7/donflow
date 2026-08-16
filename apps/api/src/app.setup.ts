import { timingSafeEqual } from 'node:crypto';
import {
  BadRequestException,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { HttpAdapterHost } from '@nestjs/core';
import type { ValidationError } from 'class-validator';
import { json, urlencoded } from 'express';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { LocalizedHttpExceptionFilter } from './common/filters/localized-http-exception.filter';
import { STRONG_PASSWORD_MESSAGE } from './auth/password-policy';
import {
  ACCESS_COOKIE,
  CSRF_COOKIE,
  parseCookies,
  REFRESH_COOKIE,
} from './auth/auth-cookies';

const CSRF_EXEMPT_PATHS = new Set([
  '/api/auth/register',
  '/api/auth/confirm-email',
  '/api/auth/login',
  '/api/auth/forgot-password',
  '/api/auth/resend-email-confirmation',
  '/api/auth/reset-password',
]);

function secureCompare(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  return bufferA.length === bufferB.length && timingSafeEqual(bufferA, bufferB);
}

function validationMessages(errors: ValidationError[]): string[] {
  const messages: string[] = [];
  const translations: Record<string, string> = {
    isDefined: 'é obrigatório',
    isNotEmpty: 'não pode estar vazio',
    isString: 'deve ser texto',
    isEmail: 'deve ser um endereço de e-mail válido',
    isPhoneNumber: 'deve ser um número de telemóvel válido',
    isUUID: 'deve ser um identificador válido',
    isDateString: 'deve ser uma data válida',
    isEnum: 'contém um valor inválido',
    isInt: 'deve ser um número inteiro',
    isNumber: 'deve ser um número',
    isBoolean: 'deve ser verdadeiro ou falso',
    min: 'tem um valor inferior ao permitido',
    max: 'tem um valor superior ao permitido',
    minLength: 'é demasiado curto',
    maxLength: 'é demasiado longo',
    matches: 'tem um formato inválido',
    whitelistValidation: 'não é permitido',
  };
  const visit = (error: ValidationError, prefix = ''): void => {
    const property = prefix ? `${prefix}.${error.property}` : error.property;
    for (const [constraint, constraintMessage] of Object.entries(
      error.constraints ?? {},
    )) {
      if (
        constraint === 'matches' &&
        constraintMessage === STRONG_PASSWORD_MESSAGE
      ) {
        messages.push(STRONG_PASSWORD_MESSAGE);
        continue;
      }
      messages.push(
        `O campo "${property}" ${translations[constraint] ?? 'é inválido'}.`,
      );
    }
    for (const child of error.children ?? []) {
      visit(child, property);
    }
  };
  errors.forEach((error) => visit(error));
  return messages;
}

export function configureApp(app: INestApplication): void {
  if (process.env.TRUST_PROXY === 'true') {
    const instance = app.getHttpAdapter().getInstance() as {
      set(name: string, value: unknown): void;
    };
    instance.set('trust proxy', 1);
  }
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'none'"],
          frameAncestors: ["'none'"],
          baseUri: ["'none'"],
          formAction: ["'none'"],
        },
      },
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      hsts:
        process.env.NODE_ENV === 'production'
          ? { maxAge: 31_536_000, includeSubDomains: true, preload: true }
          : false,
      referrerPolicy: { policy: 'no-referrer' },
    }),
  );
  const configuredOrigins = process.env.APP_CORS_ORIGINS?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.enableCors({
    origin:
      configuredOrigins && configuredOrigins.length > 0
        ? configuredOrigins
        : ['http://localhost:5173'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'X-CSRF-Token'],
    credentials: true,
  });
  app.use((request: Request, response: Response, next: NextFunction) => {
    const cookies = parseCookies(request.headers.cookie);
    const cookieAuthenticated = Boolean(
      cookies[ACCESS_COOKIE] || cookies[REFRESH_COOKIE],
    );
    if (cookieAuthenticated) {
      response.setHeader('Cache-Control', 'no-store');
    }
    if (
      cookieAuthenticated &&
      !['GET', 'HEAD', 'OPTIONS'].includes(request.method) &&
      !CSRF_EXEMPT_PATHS.has(request.path)
    ) {
      const csrfCookie = cookies[CSRF_COOKIE];
      const csrfHeader = request.get('x-csrf-token');
      if (
        !csrfCookie ||
        !csrfHeader ||
        !secureCompare(csrfCookie, csrfHeader)
      ) {
        next(
          new BadRequestException('A validação de segurança do pedido falhou.'),
        );
        return;
      }
    }
    next();
  });
  app.use(json({ limit: '2mb' }));
  app.use(urlencoded({ extended: true, limit: '2mb' }));
  app.setGlobalPrefix('api');
  app.useGlobalFilters(
    new LocalizedHttpExceptionFilter(app.get(HttpAdapterHost)),
  );
  app.useGlobalPipes(
    new ValidationPipe({
      forbidNonWhitelisted: true,
      transform: true,
      whitelist: true,
      exceptionFactory: (errors) =>
        new BadRequestException(validationMessages(errors)),
    }),
  );

  if (process.env.ENABLE_API_DOCS === 'true') {
    const config = new DocumentBuilder()
      .setTitle('DonFlow API')
      .setDescription('Barbershop scheduling API contracts.')
      .setVersion('1.0.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {
      jsonDocumentUrl: 'api/docs-json',
    });
  }
}
