import '../config/load-environment';
import { randomBytes, randomUUID } from 'node:crypto';
import type { ProviderNotification } from '../notifications/notification-provider';
import { ResendNotificationProvider } from '../notifications/resend-notification.provider';

const recipient = process.argv[2]?.trim().toLowerCase();
if (!recipient || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
  throw new Error('Provide a valid preview recipient');
}

const appointmentId = randomUUID();
const startsAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
const token = () => randomBytes(32).toString('hex');
const expiration = () => new Date(Date.now() + 60 * 60 * 1000);
const appointmentPayload = {
  serviceName: 'Corte e barba',
  startsAt,
  customerName: 'Breno Castro',
  barberName: 'Ruben',
  audience: 'CUSTOMER',
};
const previews: ProviderNotification[] = [
  {
    kind: 'EMAIL_VERIFICATION',
    recipient,
    token: token(),
    expiresAt: expiration(),
  },
  {
    kind: 'PASSWORD_RESET',
    recipient,
    token: token(),
    expiresAt: expiration(),
  },
  {
    kind: 'BARBER_INVITATION',
    recipient,
    token: token(),
    expiresAt: expiration(),
  },
  {
    kind: 'APPOINTMENT_CONFIRMATION',
    recipient,
    appointmentId,
    payload: { ...appointmentPayload, event: 'CONFIRMED', version: token() },
  },
  {
    kind: 'APPOINTMENT_CONFIRMATION',
    recipient,
    appointmentId,
    payload: { ...appointmentPayload, event: 'RESCHEDULED', version: token() },
  },
  {
    kind: 'APPOINTMENT_CANCELLATION',
    recipient,
    appointmentId,
    payload: { ...appointmentPayload, event: 'CANCELLED', version: token() },
  },
  {
    kind: 'APPOINTMENT_REMINDER',
    recipient,
    appointmentId,
    payload: { ...appointmentPayload, event: 'REMINDER', version: token() },
  },
];

async function preview(): Promise<void> {
  const provider = new ResendNotificationProvider();
  let sent = 0;
  for (const notification of previews) {
    await provider.send(notification);
    sent += 1;
    await new Promise((resolve) => setTimeout(resolve, 600));
  }
  console.log(`Transactional email previews sent: ${sent}.`);
}

void preview().catch((error: unknown) => {
  const errorName = error instanceof Error ? error.name : 'UnknownError';
  console.error(`Transactional email preview failed (${errorName}).`);
  process.exitCode = 1;
});
