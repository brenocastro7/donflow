export const NOTIFICATION_PROVIDER = Symbol('NOTIFICATION_PROVIDER');

export interface EmailVerificationNotification {
  kind: 'EMAIL_VERIFICATION';
  recipient: string;
  token: string;
  expiresAt: Date;
}

export interface AppointmentNotification {
  kind:
    | 'APPOINTMENT_CONFIRMATION'
    | 'APPOINTMENT_CANCELLATION'
    | 'APPOINTMENT_REMINDER';
  recipient: string;
  appointmentId: string;
  payload: Record<string, unknown>;
}

export interface PasswordResetNotification {
  kind: 'PASSWORD_RESET';
  recipient: string;
  token: string;
  expiresAt: Date;
}

export interface BarberInvitationNotification {
  kind: 'BARBER_INVITATION';
  recipient: string;
  token: string;
  expiresAt: Date;
}

export type ProviderNotification =
  | EmailVerificationNotification
  | AppointmentNotification
  | PasswordResetNotification
  | BarberInvitationNotification;

export interface NotificationProvider {
  send(notification: ProviderNotification): Promise<{
    providerMessageId?: string;
  }>;
}
