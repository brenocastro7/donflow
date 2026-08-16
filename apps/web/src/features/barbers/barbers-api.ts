import { apiRequest } from '@/lib/api/api-client';

export type ManagedBarber = {
  id: string;
  displayName: string | null;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    role: 'BARBER';
    status: 'ACTIVE' | 'INACTIVE';
    profileImageDataUrl: string | null;
  };
};

export type BarberInvitation = {
  id: string;
  email: string;
  expiresAt: string;
  createdAt: string;
  status: 'PENDING' | 'EXPIRED';
};

type ManagementResponse = {
  data: { barbers: ManagedBarber[]; invitations: BarberInvitation[] };
};

export function getBarberManagement(accessToken: string) {
  return apiRequest<ManagementResponse>('/barbers/management', { accessToken });
}

export function inviteBarber(accessToken: string, email: string) {
  return apiRequest<{ data: BarberInvitation }>('/barbers', {
    method: 'POST',
    accessToken,
    body: { email },
  });
}

export function resendBarberInvitation(accessToken: string, invitationId: string) {
  return apiRequest<{ data: BarberInvitation }>(`/barbers/invitations/${invitationId}/resend`, {
    method: 'POST',
    accessToken,
  });
}

export function updateBarberStatus(
  accessToken: string,
  barberProfileId: string,
  status: 'ACTIVE' | 'INACTIVE',
) {
  return apiRequest<{ data: { id: string; status: 'ACTIVE' | 'INACTIVE' } }>(
    `/barbers/${barberProfileId}/status`,
    { method: 'PATCH', accessToken, body: { status } },
  );
}

export function completeBarberRegistration(input: {
  token: string;
  name: string;
  phone: string;
  password: string;
}) {
  return apiRequest<{ message: string }>('/barber-invitations/complete', {
    method: 'POST',
    body: input,
  });
}
