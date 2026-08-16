import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, LoaderCircle, XCircle } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router';
import { confirmCustomerEmail } from '../features/auth/auth-api';
import { cn } from '@/lib/utils';
import {
  customerLoginCard,
  customerLoginPage,
  customerPrimaryButton,
  customerRegistrationSuccess,
  customerRegistrationSuccessH1,
  customerRegistrationSuccessIcon,
  customerRegistrationSuccessP,
  customerRegistrationSuccessSpan,
} from './customer-portal-styles';

export function CustomerConfirmEmailPage() {
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const token = search.get('token') ?? '';
  const confirmation = useQuery({
    queryKey: ['customer', 'confirm-email', token],
    queryFn: () => confirmCustomerEmail(token),
    enabled: Boolean(token),
    retry: false,
    staleTime: Infinity,
  });
  const failed = !token || confirmation.isError;
  const isStaff = confirmation.data?.role === 'BARBER' || confirmation.data?.role === 'MASTER';
  return (
    <main className={customerLoginPage}>
      <section className={cn(customerLoginCard, customerRegistrationSuccess)}>
        {confirmation.isPending ? (
          <LoaderCircle className={cn(customerRegistrationSuccessIcon, 'animate-spin')} />
        ) : failed ? (
          <XCircle className={customerRegistrationSuccessIcon} />
        ) : (
          <CheckCircle2 className={customerRegistrationSuccessIcon} />
        )}
        <p className={customerRegistrationSuccessP}>Confirmação de e-mail</p>
        <h1 className={customerRegistrationSuccessH1}>
          {confirmation.isPending
            ? 'A confirmar…'
            : failed
              ? 'Ligação inválida.'
              : 'Conta confirmada.'}
        </h1>
        <span className={customerRegistrationSuccessSpan}>
          {failed
            ? 'A ligação expirou ou já foi utilizada.'
            : isStaff
              ? 'Já podes iniciar sessão no painel.'
              : 'Já podes iniciar sessão na área do cliente.'}
        </span>
        {!confirmation.isPending && (
          <button
            className={customerPrimaryButton}
            onClick={() => navigate(isStaff ? '/staff/login' : '/customer/login')}
          >
            Iniciar sessão
          </button>
        )}
      </section>
    </main>
  );
}
