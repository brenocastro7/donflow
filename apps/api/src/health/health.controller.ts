import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Public } from '../auth/decorators/public.decorator';

export interface HealthResponse {
  status: 'ok';
  service: 'donflow-api';
  timestamp: string;
}

export interface ReadinessResponse extends HealthResponse {
  database: 'up';
}

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @Public()
  check(): HealthResponse {
    return {
      status: 'ok',
      service: 'donflow-api',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ready')
  @Public()
  async ready(): Promise<ReadinessResponse> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException(
        'A base de dados está indisponível.',
      );
    }

    return {
      status: 'ok',
      service: 'donflow-api',
      database: 'up',
      timestamp: new Date().toISOString(),
    };
  }
}
