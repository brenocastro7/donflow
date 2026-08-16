import '../config/load-environment';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { MasterBootstrapService } from '../auth/master-bootstrap.service';

function requiredEnvironmentValue(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

async function bootstrap(): Promise<void> {
  const application = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const service = application.get(MasterBootstrapService);
    const result = await service.bootstrap({
      name: requiredEnvironmentValue('MASTER_NAME'),
      email: requiredEnvironmentValue('MASTER_EMAIL'),
      phone: process.env.MASTER_PHONE,
      password: requiredEnvironmentValue('MASTER_PASSWORD'),
    });

    console.log(
      result.created
        ? `MASTER created with id ${result.user.id}`
        : `MASTER already exists with id ${result.user.id}`,
    );
  } finally {
    await application.close();
  }
}

void bootstrap();
