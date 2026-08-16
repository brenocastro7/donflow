import {
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { ArgumentsHost } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { SentryExceptionCaptured } from '@sentry/nestjs';

@Catch()
export class LocalizedHttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(LocalizedHttpExceptionFilter.name);

  constructor(private readonly adapterHost: HttpAdapterHost) {}

  @SentryExceptionCaptured()
  catch(exception: unknown, host: ArgumentsHost): void {
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const response =
      exception instanceof HttpException ? exception.getResponse() : null;
    const body =
      typeof response === 'object' && response !== null
        ? response
        : {
            message:
              typeof response === 'string'
                ? response
                : 'Ocorreu um erro interno.',
          };

    if (!(exception instanceof HttpException)) {
      this.logger.error(
        'Erro não tratado durante o pedido HTTP.',
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    this.adapterHost.httpAdapter.reply(
      host.switchToHttp().getResponse(),
      {
        ...body,
        statusCode: status,
        error: this.errorLabel(status),
      },
      status,
    );
  }

  private errorLabel(status: number): string {
    const labels: Record<number, string> = {
      [HttpStatus.BAD_REQUEST]: 'Pedido inválido',
      [HttpStatus.UNAUTHORIZED]: 'Não autorizado',
      [HttpStatus.FORBIDDEN]: 'Acesso proibido',
      [HttpStatus.NOT_FOUND]: 'Não encontrado',
      [HttpStatus.CONFLICT]: 'Conflito',
      [HttpStatus.TOO_MANY_REQUESTS]: 'Demasiados pedidos',
      [HttpStatus.INTERNAL_SERVER_ERROR]: 'Erro interno',
      [HttpStatus.SERVICE_UNAVAILABLE]: 'Serviço indisponível',
    };
    return labels[status] ?? 'Erro no pedido';
  }
}
