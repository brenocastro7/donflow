import { useQuery } from '@tanstack/react-query';
import { LoaderCircle } from 'lucide-react';
import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { getCurrentUser } from '../features/auth/auth-api';
import { clearAccessToken, getAccessToken } from '../features/auth/auth-session';
import { useRole } from '../shared/hooks/use-role';
import { CustomerLayout } from './customer-layout';

export function CustomerProtectedRoute() {
  const navigate = useNavigate();
  const accessToken = getAccessToken();
  const session = useQuery({
    queryKey: ['auth', 'me', accessToken],
    queryFn: () => getCurrentUser(accessToken!),
    enabled: Boolean(accessToken),
    retry: false,
  });
  const { isCustomer } = useRole(session.data?.data.role);

  useEffect(() => {
    if (!accessToken) {
      navigate('/customer/login', { replace: true });
      return;
    }
    if (session.isError) {
      clearAccessToken();
      navigate('/customer/login', { replace: true });
      return;
    }
    // A BARBER/MASTER session landing here is valid, just in the wrong area —
    // send them to the panel instead of destroying a perfectly good session.
    if (session.data && !isCustomer) {
      navigate('/', { replace: true });
    }
  }, [accessToken, navigate, session.data, isCustomer, session.isError]);

  if (!accessToken || session.isLoading || !session.data) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#090a08] text-[#c49343]">
        <LoaderCircle />
        <span>A preparar a tua experiência…</span>
      </main>
    );
  }
  return <CustomerLayout user={session.data.data} />;
}
