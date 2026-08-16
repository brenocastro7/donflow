import { useOutletContext } from 'react-router';
import type { AuthenticatedUser } from '../features/auth/auth-api';

export function useCustomerUser() {
  return useOutletContext<AuthenticatedUser>();
}
