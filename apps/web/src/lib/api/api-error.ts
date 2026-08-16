export interface ApiErrorBody {
  statusCode?: number;
  message?: string | string[];
  error?: string;
  code?: string;
}

export class ApiError extends Error {
  readonly status: number;
  readonly body: ApiErrorBody;

  constructor(status: number, body: ApiErrorBody) {
    const message = Array.isArray(body.message)
      ? body.message.join(' ')
      : (body.message ?? 'Não foi possível concluir o pedido.');
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}
