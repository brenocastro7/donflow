import './instrument';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { validateProductionEnvironment } from './config/validate-production-environment';

async function bootstrap() {
  validateProductionEnvironment();
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  configureApp(app);

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
