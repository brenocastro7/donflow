import { InternalServerErrorException } from '@nestjs/common';
import type { ProviderNotification } from '../notification-provider';
import { actionEmailTemplate } from './action-email.template';
import { appointmentEmailTemplate } from './appointment-email.template';

export function notificationEmailTemplate(
  notification: ProviderNotification,
  publicUrl?: string,
): { subject: string; text: string; html: string } {
  if ('payload' in notification) return appointmentEmailTemplate(notification);
  if (!publicUrl) {
    throw new InternalServerErrorException(
      'A configuração do serviço de e-mail está incompleta.',
    );
  }
  return actionEmailTemplate(notification, publicUrl);
}
