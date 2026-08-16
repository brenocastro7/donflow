import { useMutation } from '@tanstack/react-query';
import {
  Check,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  Mail,
  Scissors,
  UserRound,
  X,
} from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { useNavigate } from 'react-router';
import { getCurrentUser, login, requestPasswordReset } from '../features/auth/auth-api';
import { storeAccessToken } from '../features/auth/auth-session';
import { ApiError } from '../lib/api/api-error';
import { cn } from '@/lib/utils';

const eyebrowLabel = 'text-[0.68rem] font-bold tracking-[0.2em] text-gold-light uppercase';
const fieldLabel = 'block text-[0.72rem] font-semibold text-[#d2d1ca]';
const goldButton =
  'flex min-h-[3.2rem] w-full items-center justify-center gap-[0.6rem] rounded-[0.55rem] border border-[#d3a75b] bg-gold-gradient text-[0.82rem] font-bold text-[#17130d]';

export function StaffLoginPage() {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [mfaRequired, setMfaRequired] = useState(false);
  const [remember, setRemember] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [recoverySent, setRecoverySent] = useState(false);

  const authentication = useMutation({
    mutationFn: async () => {
      const credentials = await login(identifier.trim(), password, remember, mfaCode);
      const currentUser = await getCurrentUser(credentials.accessToken);
      if (!['BARBER', 'MASTER'].includes(currentUser.data.role)) throw new StaffAccessError();
      return credentials;
    },
    onSuccess: ({ accessToken }) => {
      storeAccessToken(accessToken, remember);
      navigate('/', { replace: true });
    },
    onError: (error) => {
      if (error instanceof ApiError && error.body.code === 'MFA_REQUIRED') {
        setMfaRequired(true);
        setMfaCode('');
        setFormError(null);
        return;
      }
      if (error instanceof StaffAccessError) {
        setFormError('Esta área é exclusiva para contas autorizadas.');
      } else if (error instanceof ApiError && error.status === 401) {
        setFormError(
          error.message.includes('autenticação')
            ? error.message
            : 'E-mail, telemóvel ou palavra-passe incorretos.',
        );
      } else if (error instanceof ApiError && error.status === 429) {
        setFormError('Foram feitas demasiadas tentativas. Aguarda um minuto e tenta novamente.');
      } else {
        setFormError('Não foi possível iniciar sessão. Verifica a ligação e tenta novamente.');
      }
    },
  });

  const recovery = useMutation({
    mutationFn: () => requestPasswordReset(recoveryEmail.trim()),
    onSuccess: () => {
      setRecoveryError(null);
      setRecoverySent(true);
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 429) {
        setRecoveryError('Foram feitos demasiados pedidos. Aguarda um minuto e tenta novamente.');
      } else if (error instanceof ApiError) {
        setRecoveryError(error.message);
      } else {
        setRecoveryError('Não foi possível enviar o e-mail. Tenta novamente.');
      }
    },
  });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    if (!identifier.trim()) {
      setFormError('Introduz o teu e-mail ou telemóvel.');
      return;
    }
    if (password.length < 8) {
      setFormError('A palavra-passe deve ter pelo menos 8 caracteres.');
      return;
    }
    if (mfaRequired && !mfaCode.trim()) {
      setFormError('Introduz o código de autenticação.');
      return;
    }
    authentication.mutate();
  };

  return (
    <main className="grid min-h-screen grid-cols-[minmax(0,1.15fr)_minmax(28rem,0.85fr)] text-text max-[860px]:grid-cols-1 bg-background">
      <section
        className="relative flex min-h-screen items-end overflow-hidden bg-[image:var(--barbershop-cover-portrait)] bg-center bg-cover bg-no-repeat p-[clamp(2rem,6vw,5rem)] max-[860px]:absolute max-[860px]:inset-0 max-[860px]:p-0"
        aria-label="Barbearia DonFlow"
      >
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(5,6,4,0.28),rgba(5,6,4,0.08)),linear-gradient(0deg,rgba(5,6,4,0.96),transparent_68%)] max-[860px]:bg-[rgba(5,6,4,0.82)] max-[860px]:backdrop-blur-[3px]" />
        <div className="relative max-w-[38rem] max-[860px]:hidden">
          <span className={eyebrowLabel}>Área reservada</span>
          <blockquote className="mt-[0.9rem] font-serif text-[clamp(2.5rem,5vw,4.8rem)] leading-[0.98] font-semibold">
            &ldquo;Aparece pela curiosidade, permanece pela qualidade.&rdquo;
          </blockquote>
          <p className="mt-4 text-[#b8b8b1]">Gestão simples da agenda, onde quer que estejas.</p>
        </div>
      </section>

      <section className="grid place-items-center border-l border-border bg-[radial-gradient(circle_at_100%_0,rgba(161,112,45,0.12),transparent_25rem),#0c0d0b] p-[3rem_clamp(2rem,5vw,5rem)] max-[860px]:relative max-[860px]:min-h-screen max-[860px]:border-0 max-[860px]:bg-[rgba(8,9,7,0.74)] max-[860px]:p-[2rem_1.25rem]">
        <div className="w-[min(100%,27rem)] max-[860px]:rounded-2xl max-[860px]:border max-[860px]:border-[rgba(226,216,195,0.12)] max-[860px]:bg-[rgba(12,13,11,0.9)] max-[860px]:p-6 max-[860px]:backdrop-blur-[18px]">
          <div className="flex flex-col items-start text-gold-accent">
            <span className="text-[0.58rem] font-bold tracking-[0.32em] uppercase">Barbearia</span>
            <strong className="font-serif text-[2rem] leading-none tracking-[0.06em] text-text uppercase">
              DonFlow
            </strong>
            <Scissors size={17} className="mt-[0.55rem]" />
          </div>
          <div className="mt-14 max-[860px]:mt-10">
            <p className={cn(eyebrowLabel, 'mb-[0.65rem]')}>Acesso profissional</p>
            <h1 className="font-serif text-[clamp(2.6rem,5vw,3.8rem)] leading-[0.95] font-semibold">
              Bem-vindo de volta
            </h1>
          </div>

          <form className="mt-8" onSubmit={submit} noValidate>
            <label htmlFor="staff-identifier" className={cn(fieldLabel, 'mb-[0.55rem]')}>
              E-mail ou telemóvel
            </label>
            <div className="grid min-h-[3.2rem] grid-cols-[auto_1fr_auto] items-center gap-[0.7rem] rounded-[0.55rem] border border-[rgba(226,216,195,0.13)] bg-panel px-[0.9rem] focus-within:border-[rgba(211,167,91,0.65)] focus-within:shadow-[0_0_0_3px_rgba(211,167,91,0.08)]">
              <UserRound size={18} className="text-[#777970]" />
              <input
                id="staff-identifier"
                name="identifier"
                type="text"
                value={identifier}
                onChange={(event) => {
                  setIdentifier(event.target.value);
                  setMfaRequired(false);
                  setMfaCode('');
                }}
                placeholder="nome@exemplo.pt ou +351..."
                autoComplete="username"
                disabled={authentication.isPending}
                className="h-12 min-w-0 border-0 bg-transparent text-[0.82rem] text-text outline-0 placeholder:text-[#5e615a]"
              />
            </div>

            <label htmlFor="staff-password" className={cn(fieldLabel, 'mt-[1.1rem] mb-[0.55rem]')}>
              Palavra-passe
            </label>
            <div className="grid min-h-[3.2rem] grid-cols-[auto_1fr_auto] items-center gap-[0.7rem] rounded-[0.55rem] border border-[rgba(226,216,195,0.13)] bg-panel px-[0.9rem] focus-within:border-[rgba(211,167,91,0.65)] focus-within:shadow-[0_0_0_3px_rgba(211,167,91,0.08)]">
              <LockKeyhole size={18} className="text-[#777970]" />
              <input
                id="staff-password"
                name="password"
                type={passwordVisible ? 'text' : 'password'}
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setMfaRequired(false);
                  setMfaCode('');
                }}
                placeholder="Introduz a tua palavra-passe"
                autoComplete="current-password"
                disabled={authentication.isPending}
                className="h-12 min-w-0 border-0 bg-transparent text-[0.82rem] text-text outline-0 placeholder:text-[#5e615a]"
              />
              <button
                type="button"
                aria-label={passwordVisible ? 'Ocultar palavra-passe' : 'Mostrar palavra-passe'}
                onClick={() => setPasswordVisible((current) => !current)}
                className="grid cursor-pointer place-items-center border-0 bg-transparent p-[0.35rem] text-[#777970]"
              >
                {passwordVisible ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {mfaRequired && (
              <div className="mt-[1.1rem]" role="group" aria-labelledby="staff-mfa-label">
                <label id="staff-mfa-label" htmlFor="staff-mfa-code" className={cn(fieldLabel, 'mb-[0.35rem]')}>
                  Código de autenticação
                </label>
                <p className="mt-0 mb-[0.55rem] text-[0.68rem] leading-[1.45] text-[#858880]">
                  Introduz o código da aplicação autenticadora ou um código de recuperação.
                </p>
                <div className="grid min-h-[3.2rem] grid-cols-[auto_1fr_auto] items-center gap-[0.7rem] rounded-[0.55rem] border border-[rgba(226,216,195,0.13)] bg-panel px-[0.9rem] focus-within:border-[rgba(211,167,91,0.65)] focus-within:shadow-[0_0_0_3px_rgba(211,167,91,0.08)]">
                  <LockKeyhole size={18} className="text-[#777970]" />
                  <input
                    id="staff-mfa-code"
                    autoComplete="one-time-code"
                    value={mfaCode}
                    onChange={(event) => setMfaCode(event.target.value.replace(/\s/g, ''))}
                    placeholder="Código de autenticação"
                    autoFocus
                    disabled={authentication.isPending}
                    className="h-12 min-w-0 border-0 bg-transparent text-[0.82rem] text-text outline-0 placeholder:text-[#5e615a]"
                  />
                </div>
              </div>
            )}

            <label className="mt-4! flex! cursor-pointer items-center gap-[0.55rem] text-[#92948d]!">
              <input
                type="checkbox"
                checked={remember}
                onChange={(event) => setRemember(event.target.checked)}
                className="size-4 accent-gold"
              />
              <span>Manter sessão neste dispositivo</span>
            </label>

            {formError && (
              <p
                className="mt-4 rounded-[0.45rem] border border-[rgba(177,79,79,0.28)] bg-[rgba(145,57,57,0.1)] px-[0.85rem] py-3 text-[0.72rem] text-[#e5a0a0]"
                role="alert"
              >
                {formError}
              </p>
            )}

            <button
              className={cn(goldButton, 'mt-[1.3rem] cursor-pointer disabled:cursor-wait disabled:opacity-70')}
              type="submit"
              disabled={authentication.isPending}
            >
              {authentication.isPending ? (
                <>
                  <LoaderCircle className="animate-spin" size={18} />A entrar...
                </>
              ) : (
                'Entrar no painel'
              )}
            </button>
          </form>
          <button
            className="mx-auto mt-5 block cursor-pointer border-0 bg-transparent p-1 text-[0.68rem] text-[#cfa65f] underline underline-offset-[0.2rem]"
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
        </div>
      </section>

      {recoveryOpen && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4 backdrop-blur-[7px]"
          role="presentation"
        >
          <section
            className="relative w-[min(100%,28rem)] rounded-[0.9rem] border border-[rgba(226,216,195,0.14)] bg-panel p-8 shadow-[0_2rem_6rem_rgba(0,0,0,0.55)]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="recovery-title"
          >
            <button
              className="absolute top-4 right-4 grid size-[2.3rem] place-items-center rounded-full border border-[rgba(226,216,195,0.12)] bg-transparent"
              type="button"
              aria-label="Fechar"
              onClick={() => setRecoveryOpen(false)}
            >
              <X />
            </button>

            {recoverySent ? (
              <div className="grid justify-items-start">
                <span className="grid size-14 place-items-center rounded-full bg-[rgba(72,137,87,0.14)] text-[#8fd19e]">
                  <Check />
                </span>
                <p className="mt-[1.2rem] text-[0.65rem] font-bold tracking-[0.16em] text-gold-light uppercase">
                  E-mail enviado
                </p>
                <h2 id="recovery-title" className="mt-2 font-serif text-[2.3rem] leading-[0.95]">
                  Consulta a tua caixa de entrada
                </h2>
                <span className="mt-[0.8rem] block text-[0.75rem] leading-[1.6] text-[#898c84]">
                  Se existir uma conta associada a <strong>{recoveryEmail}</strong>, receberás as
                  instruções para definir uma nova palavra-passe.
                </span>
                <button
                  type="button"
                  onClick={() => setRecoveryOpen(false)}
                  className={cn(goldButton, 'mt-6 min-h-12')}
                >
                  Voltar ao login
                </button>
              </div>
            ) : (
              <>
                <div className="grid size-14 place-items-center rounded-full bg-[rgba(200,154,75,0.1)] text-gold-light">
                  <Mail />
                </div>
                <p className="mt-[1.2rem] text-[0.65rem] font-bold tracking-[0.16em] text-gold-light uppercase">
                  Recuperação de acesso
                </p>
                <h2 id="recovery-title" className="mt-2 font-serif text-[2.3rem] leading-[0.95]">
                  Recuperar palavra-passe
                </h2>
                <span className="mt-[0.8rem] block text-[0.75rem] leading-[1.6] text-[#898c84]">
                  Indica o e-mail associado à tua conta profissional.
                </span>

                <form
                  className="mt-[1.4rem]"
                  onSubmit={(event) => {
                    event.preventDefault();
                    setRecoveryError(null);
                    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recoveryEmail.trim())) {
                      setRecoveryError('Introduz um endereço de e-mail válido.');
                      return;
                    }
                    recovery.mutate();
                  }}
                >
                  <label htmlFor="recovery-email" className={cn(fieldLabel, 'mb-[0.55rem]')}>
                    E-mail
                  </label>
                  <div className="grid min-h-[3.2rem] grid-cols-[auto_1fr_auto] items-center gap-[0.7rem] rounded-[0.55rem] border border-[rgba(226,216,195,0.13)] bg-panel px-[0.9rem] focus-within:border-[rgba(211,167,91,0.65)] focus-within:shadow-[0_0_0_3px_rgba(211,167,91,0.08)]">
                    <Mail size={18} className="text-[#777970]" />
                    <input
                      id="recovery-email"
                      type="email"
                      value={recoveryEmail}
                      onChange={(event) => setRecoveryEmail(event.target.value)}
                      placeholder="nome@exemplo.pt"
                      autoComplete="email"
                      autoFocus
                      className="h-12 min-w-0 border-0 bg-transparent text-[0.82rem] text-text outline-0 placeholder:text-[#5e615a]"
                    />
                  </div>
                  {recoveryError && (
                    <p
                      className="mt-4 rounded-[0.45rem] border border-[rgba(177,79,79,0.28)] bg-[rgba(145,57,57,0.1)] px-[0.85rem] py-3 text-[0.72rem] text-[#e5a0a0]"
                      role="alert"
                    >
                      {recoveryError}
                    </p>
                  )}
                  <button
                    className={cn(goldButton, 'mt-[1.3rem] cursor-pointer disabled:cursor-wait disabled:opacity-70')}
                    type="submit"
                    disabled={recovery.isPending}
                  >
                    {recovery.isPending ? (
                      <>
                        <LoaderCircle className="animate-spin" size={18} /> A enviar...
                      </>
                    ) : (
                      'Enviar instruções'
                    )}
                  </button>
                </form>
              </>
            )}
          </section>
        </div>
      )}
    </main>
  );
}

class StaffAccessError extends Error {}
