import { UserRole, UserStatus } from '@prisma/client';

export interface PublicUser {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: UserRole;
  status: UserStatus;
  emailVerifiedAt: Date | null;
  createdAt: Date;
}

export interface RegisterCustomerResult {
  message: 'Cliente registado com sucesso.';
  data: PublicUser;
}

export interface AuthenticationUser {
  id: string;
  passwordHash: string;
  role: UserRole;
  status: UserStatus;
  emailVerifiedAt: Date | null;
  mfaSecretEncrypted: string | null;
  mfaEnabledAt: Date | null;
  mfaRecoveryCodeHashes: unknown;
  failedLoginAttempts: number;
  loginLockedUntil: Date | null;
  barberProfile: { id: string } | null;
}
