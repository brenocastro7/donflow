import { UserRole } from '@prisma/client';

export interface AccessTokenPayload {
  sub: string;
  role: UserRole;
  sid?: string;
  barberProfileId?: string;
}

export interface AuthenticatedUser {
  id: string;
  role: UserRole;
  barberProfileId: string | null;
  sessionId?: string;
}

export interface LoginResponse {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
}

export interface SessionCredentials {
  response: LoginResponse;
  accessToken: string;
  refreshToken: string;
  csrfToken: string;
  refreshExpiresAt: Date;
  persistent: boolean;
}

export interface SessionMetadata {
  userAgent?: string;
  ipAddress?: string;
}

export interface MessageResponse {
  message: string;
}

export interface ConfirmEmailResponse extends MessageResponse {
  role: UserRole;
}

export interface AuthenticatedUserResponse {
  data: AuthenticatedUser & {
    name: string;
    profileImageDataUrl: string | null;
    mfaEnabled: boolean;
  };
}
