import type { AppointmentNotification } from '../notification-provider';
import { detailRows, emailLayout } from './email-layout';

export function appointmentEmailTemplate(
  notification: AppointmentNotification,
): { subject: string; text: string; html: string } {
  const startsAt = new Date(String(notification.payload.startsAt));
  const serviceName = String(notification.payload.serviceName);
  const customerName =
    typeof notification.payload.customerName === 'string'
      ? notification.payload.customerName
      : 'Cliente';
  const barberName =
    typeof notification.payload.barberName === 'string'
      ? notification.payload.barberName
      : 'Profissional';
  const audience = notification.payload.audience ?? 'CUSTOMER';
  const event = notification.payload.event ?? 'CONFIRMED';
  const dateTime = new Intl.DateTimeFormat('pt-PT', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'Europe/Lisbon',
  }).format(startsAt);
  const isCustomer = audience === 'CUSTOMER';
  const isCancellation = notification.kind === 'APPOINTMENT_CANCELLATION';
  const isReminder = notification.kind === 'APPOINTMENT_REMINDER';
  const isRescheduled = event === 'RESCHEDULED';
  const heading = isCancellation
    ? 'Marcação cancelada'
    : isReminder
      ? 'Lembrete de marcação'
      : isRescheduled
        ? 'Marcação reagendada'
        : 'Marcação confirmada';
  const explanation = isCustomer
    ? isCancellation
      ? `A tua marcação com ${barberName} foi cancelada.`
      : isReminder
        ? `Lembrete: a tua marcação com ${barberName} é em ${dateTime}.`
        : isRescheduled
          ? `A tua marcação com ${barberName} foi reagendada para ${dateTime}.`
          : `A tua marcação com ${barberName} foi confirmada para ${dateTime}.`
    : isCancellation
      ? `A marcação de ${customerName} foi cancelada.`
      : isRescheduled
        ? `A marcação de ${customerName} foi reagendada para ${dateTime}.`
        : `Foi criada uma marcação de ${customerName} para ${dateTime}.`;

  return {
    subject: `${heading} — DonFlow`,
    text: `${heading}\n\n${explanation}\n\nServiço: ${serviceName}\nData e hora: ${dateTime}\nProfissional: ${barberName}`,
    html: emailLayout({
      preheader: explanation,
      eyebrow: 'A tua agenda',
      title: heading,
      introduction: explanation,
      contentHtml: detailRows([
        { label: 'Serviço', value: serviceName },
        { label: 'Data e hora', value: dateTime },
        { label: 'Profissional', value: barberName },
      ]),
    }),
  };
}
