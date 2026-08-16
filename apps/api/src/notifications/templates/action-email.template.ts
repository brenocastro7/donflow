import type { ProviderNotification } from '../notification-provider';
import { emailLayout } from './email-layout';

type ActionNotification = Extract<ProviderNotification, { token: string }>;

export function actionEmailTemplate(
  notification: ActionNotification,
  publicUrl: string,
): { subject: string; text: string; html: string } {
  const route =
    notification.kind === 'EMAIL_VERIFICATION'
      ? 'customer/confirm-email'
      : notification.kind === 'BARBER_INVITATION'
        ? 'complete-barber-registration'
        : 'reset-password';
  const actionUrl = `${publicUrl}/${route}?token=${encodeURIComponent(notification.token)}`;
  const content = {
    EMAIL_VERIFICATION: {
      subject: 'Confirma o teu e-mail — DonFlow',
      title: 'Confirma o teu e-mail',
      action: 'Confirmar e-mail',
      explanation:
        'Confirma o teu endereço de e-mail para ativares a tua conta.',
    },
    PASSWORD_RESET: {
      subject: 'Redefine a tua palavra-passe — DonFlow',
      title: 'Recuperar palavra-passe',
      action: 'Redefinir palavra-passe',
      explanation: 'Utiliza esta ligação para escolher uma nova palavra-passe.',
    },
    BARBER_INVITATION: {
      subject: 'Convite para a equipa — DonFlow',
      title: 'Bem-vindo à equipa',
      action: 'Completar registo',
      explanation:
        'Foste convidado para gerir a tua agenda na DonFlow. Confirma o e-mail e completa o teu registo.',
    },
  } as const;
  const copy = content[notification.kind];
  const expiration = new Intl.DateTimeFormat('pt-PT', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'Europe/Lisbon',
  }).format(notification.expiresAt);

  return {
    subject: copy.subject,
    text: `${copy.title}\n\n${copy.explanation}\n\n${actionUrl}\n\nEsta ligação expira em ${expiration}.`,
    html: emailLayout({
      preheader: copy.explanation,
      eyebrow: 'DonFlow',
      title: copy.title,
      introduction: copy.explanation,
      contentHtml:
        '<p style="margin:0;color:#9d978d;font-family:Arial,sans-serif;font-size:13px;line-height:20px">Se não solicitaste esta ação, podes ignorar esta mensagem em segurança.</p>',
      action: { label: copy.action, url: actionUrl },
      footerNote: `Esta ligação expira em ${expiration}.`,
    }),
  };
}
