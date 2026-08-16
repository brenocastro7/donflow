import { createHash } from 'node:crypto';
import {
  Injectable,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type {
  NotificationProvider,
  ProviderNotification,
} from './notification-provider';
import { notificationEmailTemplate } from './templates/notification-email.template';

interface ResendResponse {
  id?: string;
  message?: string;
}

@Injectable()
export class ResendNotificationProvider implements NotificationProvider {
  async send(
    notification: ProviderNotification,
  ): Promise<{ providerMessageId?: string }> {
    const apiKey = process.env.EMAIL_API_KEY?.trim();
    const fromEmail = process.env.EMAIL_FROM_ADDRESS?.trim();
    const publicUrl = process.env.APP_PUBLIC_URL?.trim().replace(/\/$/, '');
    const requiresPublicUrl =
      notification.kind === 'EMAIL_VERIFICATION' ||
      notification.kind === 'PASSWORD_RESET' ||
      notification.kind === 'BARBER_INVITATION';
    if (!apiKey || !fromEmail || (requiresPublicUrl && !publicUrl)) {
      throw new InternalServerErrorException(
        'A configuração do serviço de e-mail está incompleta.',
      );
    }
    const fromName = process.env.EMAIL_FROM_NAME?.trim() || 'DonFlow';
    const content = notificationEmailTemplate(notification, publicUrl);

    let response: Response;
    try {
      response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': this.idempotencyKey(notification),
        },
        body: JSON.stringify({
          from: `${fromName} <${fromEmail}>`,
          to: [notification.recipient],
          ...content,
        }),
      });
    } catch {
      throw new ServiceUnavailableException(
        'O serviço de e-mail está temporariamente indisponível.',
      );
    }

    const result = (await response.json()) as ResendResponse;
    if (!response.ok || !result.id) {
      throw new ServiceUnavailableException(
        result.message || 'Não foi possível enviar o e-mail transacional.',
      );
    }
    return { providerMessageId: result.id };
  }

  private idempotencyKey(notification: ProviderNotification): string {
    const appointmentVersion =
      'payload' in notification &&
      (typeof notification.payload.version === 'string' ||
        typeof notification.payload.version === 'number')
        ? notification.payload.version
        : '';
    const identity =
      'token' in notification
        ? notification.token
        : `${notification.appointmentId}:${appointmentVersion}`;
    return createHash('sha256')
      .update(`${notification.kind}:${notification.recipient}:${identity}`)
      .digest('hex');
  }
}
