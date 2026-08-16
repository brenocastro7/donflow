import { useQuery } from '@tanstack/react-query';
import { LoaderCircle } from 'lucide-react';
import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { getCurrentUser } from '../features/auth/auth-api';
import { clearAccessToken, getAccessToken } from '../features/auth/auth-session';
import { useRole } from '../shared/hooks/use-role';
import { StaffLayout } from './staff-layout';

export function StaffProtectedRoute() {
  const navigate = useNavigate();
  const accessToken = getAccessToken();
  const session = useQuery({
    queryKey: ['auth', 'me', accessToken],
    queryFn: () => getCurrentUser(accessToken!),
    enabled: Boolean(accessToken),
    retry: false,
  });
  const { isCustomer, isBarber, isMaster } = useRole(session.data?.data.role);

  useEffect(() => {
    if (!accessToken) {
      navigate('/staff/login', { replace: true });
      return;
    }
    if (session.isError) {
      clearAccessToken();
      navigate('/staff/login', { replace: true });
      return;
    }
    // A CUSTOMER session landing here (e.g. the installed PWA's start_url, or a
    // bookmark to the apex domain) is valid, just in the wrong area — send them
    // to their own area instead of destroying a perfectly good session.
    if (isCustomer) {
      navigate('/customer', { replace: true });
    }
  }, [accessToken, navigate, isCustomer, session.isError]);

  if (!accessToken || session.isLoading || !session.data) {
    return (
      <main className="grid min-h-screen place-content-center justify-items-center gap-[0.8rem] bg-[#080907] text-[#9b9d95]">
        <LoaderCircle className="animate-spin text-gold-accent" />
        <p className="m-0 text-[0.8rem]">A validar a sessão...</p>
      </main>
    );
  }

  if (!isBarber && !isMaster) return null;
  return <StaffLayout user={session.data.data} />;
}
