import type { UserRole } from '@/features/auth/auth-api';

export function useRole(role: UserRole | undefined) {
  return {
    role,
    isCustomer: role === 'CUSTOMER',
    isBarber: role === 'BARBER',
    isMaster: role === 'MASTER',
  };
}
