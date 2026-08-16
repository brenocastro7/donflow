import { useMutation } from '@tanstack/react-query';
import { Check, Eye, EyeOff, LoaderCircle, LockKeyhole, Mail, X } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  getCurrentUser,
  login,
  requestPasswordReset,
  resendEmailConfirmation,
} from '../features/auth/auth-api';
import { storeAccessToken } from '../features/auth/auth-session';
import { ApiError } from '../lib/api/api-error';
import { cn } from '@/lib/utils';
import {
  customerAuthSwitch,
  customerAuthLink,
  customerDialogBackdrop,
  customerDialog,
  customerDialogClose,
  customerDialogForm,
  customerDialogIcon,
  customerDialogTitle,
  customerDialogText,
  customerDialogLabel,
  customerDialogInput,
  customerDialogSuccess,
  customerLoginCard,
  customerLoginCardBrand,
  customerLoginCardBrandText,
  customerLoginCardBrandStrong,
  customerLoginCardIntro,
  customerLoginCardIntroP,
  customerLoginCardIntroH1,
  customerLoginCardIntroSpan,
  customerLoginError,
  customerLoginField,
  customerLoginFieldButton,
  customerLoginFieldInput,
  customerLoginForm,
  customerLoginLabel,
  customerLoginPage,
  customerLoginRemember,
  customerPrimaryButton,
  customerRecoveryLink,
} from './customer-portal-styles';

export function CustomerLoginPage() {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [recoverySent, setRecoverySent] = useState(false);
  const [emailNotVerified, setEmailNotVerified] = useState(false);
  const authentication = useMutation({
    mutationFn: async () => {
      const credentials = await login(identifier.trim(), password, remember);
      const current = await getCurrentUser(credentials.accessToken);
      if (current.data.role !== 'CUSTOMER') throw new CustomerAccessError();
      return credentials;
    },
    onSuccess: ({ accessToken }) => {
      storeAccessToken(accessToken, remember);
      navigate('/customer', { replace: true });
    },
    onError: (cause) => {
      setEmailNotVerified(false);
      if (cause instanceof CustomerAccessError) {
        setError('Esta entrada é exclusiva para clientes da barbearia.');
      } else if (cause instanceof ApiError && cause.body.code === 'EMAIL_NOT_VERIFIED') {
        setEmailNotVerified(true);
        setError('Confirma o teu e-mail antes de iniciar sessão. Verifica a tua caixa de entrada.');
      } else if (cause instanceof ApiError && cause.status === 401) {
        setError('E-mail, telemóvel ou palavra-passe incorretos.');
      } else {
        setError('Não foi possível iniciar sessão. Tenta novamente.');
      }
    },
  });
  const resendConfirmation = useMutation({
    mutationFn: () => resendEmailConfirmation(identifier.trim()),
    onSuccess: (result) => setError(result.message),
    onError: () => setError('Não foi possível reenviar o e-mail. Tenta novamente.'),
  });
  const recovery = useMutation({
    mutationFn: () => requestPasswordReset(recoveryEmail.trim()),
    onSuccess: () => {
      setRecoveryError(null);
      setRecoverySent(true);
    },
    onError: (cause) => {
      if (cause instanceof ApiError && cause.status === 429) {
        setRecoveryError('Foram feitos demasiados pedidos. Aguarda um minuto e tenta novamente.');
      } else {
        setRecoveryError(
          cause instanceof ApiError ? cause.message : 'Não foi possível enviar o e-mail.',
        );
      }
    },
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!identifier.trim() || password.length < 8) {
      setError('Preenche os dados de acesso corretamente.');
      return;
    }
    authentication.mutate();
  };

  return (
    <main className={customerLoginPage}>
      <section className={customerLoginCard}>
        <div className={customerLoginCardBrand}>
          <span className={customerLoginCardBrandText}>Barbearia</span>
          <strong className={customerLoginCardBrandStrong}>DonFlow</strong>
          <small className={customerLoginCardBrandText}>Desde 2022</small>
        </div>
        <div className={customerLoginCardIntro}>
          <p className={customerLoginCardIntroP}>Área do cliente</p>
          <h1 className={customerLoginCardIntroH1}>Bem-vindo.</h1>
          <span className={customerLoginCardIntroSpan}>
            Inicia sessão para gerir as tuas marcações.
          </span>
        </div>
        <form onSubmit={submit} className={customerLoginForm}>
          <label className={customerLoginLabel}>
            E-mail ou telemóvel
            <span className={customerLoginField}>
              <Mail size={18} className="text-[#947039]" />
              <input
                autoComplete="username"
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                placeholder="O teu e-mail ou telemóvel"
                className={customerLoginFieldInput}
              />
            </span>
          </label>
          <label className={customerLoginLabel}>
            Palavra-passe
            <span className={customerLoginField}>
              <LockKeyhole size={18} className="text-[#947039]" />
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="A tua palavra-passe"
                className={customerLoginFieldInput}
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className={customerLoginFieldButton}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </span>
          </label>
          <label className={customerLoginRemember}>
            <input
              type="checkbox"
              checked={remember}
              onChange={(event) => setRemember(event.target.checked)}
            />
            Manter sessão neste dispositivo
          </label>
          <button
            className={customerRecoveryLink}
            type="button"
            onClick={() => {
              setRecoveryEmail(identifier.includes('@') ? identifier : '');
              setRecoveryError(null);
              setRecoverySent(false);
              setRecoveryOpen(true);
            }}
          >
            Recuperar palavra-passe
          </button>
          {error && <p className={customerLoginError}>{error}</p>}
          {emailNotVerified && identifier.includes('@') && (
            <button
              className={customerRecoveryLink}
              type="button"
              disabled={resendConfirmation.isPending}
              onClick={() => resendConfirmation.mutate()}
            >
              {resendConfirmation.isPending ? 'A reenviar…' : 'Reenviar e-mail de confirmação'}
            </button>
          )}
          <button className={customerPrimaryButton} disabled={authentication.isPending}>
            {authentication.isPending ? (
              <LoaderCircle className="animate-spin" />
            ) : (
              'Entrar'
            )}
          </button>
          <p className={customerAuthSwitch}>
            Ainda não tens conta?{' '}
            <button type="button" onClick={() => navigate('/customer/register')} className={customerAuthLink}>
              Criar nova conta
            </button>
          </p>
        </form>
      </section>
      {recoveryOpen && (
        <div className={customerDialogBackdrop} role="presentation">
          <section
            className={customerDialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="customer-recovery-title"
          >
            <button
              className={customerDialogClose}
              type="button"
              aria-label="Fechar"
              onClick={() => setRecoveryOpen(false)}
            >
              <X className="size-4" />
            </button>
            {recoverySent ? (
              <div className={customerDialogSuccess}>
                <span className={customerDialogIcon}>
                  <Check />
                </span>
                <h2 id="customer-recovery-title" className={customerDialogTitle}>
                  Consulta o teu e-mail
                </h2>
                <p className={customerDialogText}>
                  Se o endereço estiver registado, receberás instruções para definir uma nova
                  palavra-passe.
                </p>
                <button
                  className={customerPrimaryButton}
                  type="button"
                  onClick={() => setRecoveryOpen(false)}
                >
                  Voltar ao login
                </button>
              </div>
            ) : (
              <form
                className={customerDialogForm}
                onSubmit={(event) => {
                  event.preventDefault();
                  setRecoveryError(null);
                  recovery.mutate();
                }}
              >
                <span className={customerDialogIcon}>
                  <Mail />
                </span>
                <h2 id="customer-recovery-title" className={customerDialogTitle}>
                  Recuperar palavra-passe
                </h2>
                <p className={customerDialogText}>Introduz o e-mail associado à tua conta.</p>
                <label className={customerDialogLabel}>
                  E-mail
                  <input
                    type="email"
                    value={recoveryEmail}
                    onChange={(event) => setRecoveryEmail(event.target.value)}
                    autoComplete="email"
                    required
                    className={customerDialogInput}
                  />
                </label>
                {recoveryError && (
                  <div className={customerLoginError} role="alert">
                    {recoveryError}
                  </div>
                )}
                <button
                  className={cn(customerPrimaryButton, 'mt-[0.35rem]')}
                  disabled={recovery.isPending || !recoveryEmail.trim()}
                >
                  {recovery.isPending ? (
                    <LoaderCircle className="animate-spin" />
                  ) : (
                    'Enviar instruções'
                  )}
                </button>
              </form>
            )}
          </section>
        </div>
      )}
    </main>
  );
}

class CustomerAccessError extends Error {}
