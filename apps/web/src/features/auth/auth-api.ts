import { apiRequest } from '@/lib/api/api-client';

export type UserRole = 'CUSTOMER' | 'BARBER' | 'MASTER';

export type AuthenticatedUser = {
  id: string;
  name: string;
  role: UserRole;
  barberProfileId: string | null;
  profileImageDataUrl: string | null;
  customerBookingBlocked: boolean;
  customerBookingLimited: boolean;
  mfaEnabled: boolean;
};

type LoginResponse = {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
};

type AuthenticatedUserResponse = {
  data: AuthenticatedUser;
};

export function login(identifier: string, password: string, remember = false, mfaCode?: string) {
  return apiRequest<LoginResponse>('/auth/login', {
    method: 'POST',
    body: { identifier, password, remember, mfaCode: mfaCode?.trim() || undefined },
  });
}

export function setupMfa(accessToken: string, currentPassword: string) {
  return apiRequest<{ data: { secret: string; otpauthUri: string } }>('/auth/mfa/setup', {
    method: 'POST',
    accessToken,
    body: { currentPassword },
  });
}

export function confirmMfa(accessToken: string, code: string) {
  return apiRequest<{ data: { recoveryCodes: string[] } }>('/auth/mfa/confirm', {
    method: 'POST',
    accessToken,
    body: { code },
  });
}

export function disableMfa(accessToken: string, currentPassword: string, code: string) {
  return apiRequest<{ message: string }>('/auth/mfa', {
    method: 'DELETE',
    accessToken,
    body: { currentPassword, code },
  });
}

export function logout(accessToken: string) {
  return apiRequest<{ message: string }>('/auth/logout', {
    method: 'POST',
    accessToken,
  });
}

export function getSessions(accessToken: string) {
  return apiRequest<{
    data: Array<{
      id: string;
      userAgent: string | null;
      createdAt: string;
      lastUsedAt: string;
      expiresAt: string;
      persistent: boolean;
      current: boolean;
    }>;
  }>('/auth/sessions', { accessToken });
}

export function revokeSession(accessToken: string, sessionId: string) {
  return apiRequest<{ message: string }>(`/auth/sessions/${sessionId}`, {
    method: 'DELETE',
    accessToken,
  });
}

export function registerCustomer(input: {
  name: string;
  email: string;
  phone?: string;
  password: string;
  transactionalEmailConsent: boolean;
}) {
  return apiRequest<{ message: string; data: { id: string; email: string } }>('/auth/register', {
    method: 'POST',
    body: input,
  });
}

export function confirmCustomerEmail(token: string) {
  return apiRequest<{ message: string; role: UserRole }>('/auth/confirm-email', {
    method: 'POST',
    body: { token },
  });
}

export function getCurrentUser(accessToken: string) {
  return apiRequest<AuthenticatedUserResponse>('/auth/me', { accessToken });
}

export function updateProfileImage(accessToken: string, dataUrl: string) {
  return apiRequest<AuthenticatedUserResponse>('/auth/me/profile-image', {
    method: 'PUT',
    accessToken,
    body: { dataUrl },
  });
}

export function deleteProfileImage(accessToken: string) {
  return apiRequest<AuthenticatedUserResponse>('/auth/me/profile-image', {
    method: 'DELETE',
    accessToken,
  });
}

export function deleteCustomerAccount(accessToken: string, currentPassword: string) {
  return apiRequest<{ message: string }>('/auth/me/account', {
    method: 'DELETE',
    accessToken,
    body: { currentPassword },
  });
}

export function changePassword(accessToken: string, currentPassword: string, newPassword: string) {
  return apiRequest<{ message: string }>('/auth/change-password', {
    method: 'PATCH',
    accessToken,
    body: { currentPassword, newPassword },
  });
}

export function requestPasswordReset(email: string) {
  return apiRequest<{ message: string }>('/auth/forgot-password', {
    method: 'POST',
    body: { email },
  });
}

export function resendEmailConfirmation(email: string) {
  return apiRequest<{ message: string }>('/auth/resend-email-confirmation', {
    method: 'POST',
    body: { email },
  });
}

export function resetPassword(token: string, newPassword: string) {
  return apiRequest<{ message: string }>('/auth/reset-password', {
    method: 'POST',
    body: { token, newPassword },
  });
}
