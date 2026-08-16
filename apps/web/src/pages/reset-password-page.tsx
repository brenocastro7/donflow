import { useMutation } from '@tanstack/react-query';
import { Check, Eye, EyeOff, LoaderCircle, LockKeyhole, Scissors } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { resetPassword } from '../features/auth/auth-api';
import { ApiError } from '../lib/api/api-error';
import { isStrongPassword, STRONG_PASSWORD_MESSAGE } from '../features/auth/password-policy';
import { PasswordStrength } from '../shared/components/password-strength';
import { cn } from '@/lib/utils';

const resetField =
  'grid min-h-[3.2rem] grid-cols-[auto_1fr_auto] items-center gap-[0.7rem] rounded-[0.55rem] border border-[rgba(226,216,195,0.13)] bg-panel px-[0.9rem] focus-within:border-[rgba(211,167,91,0.65)] [&_svg]:text-[#777970]';
const resetFieldInput = 'h-12 min-w-0 border-0 bg-transparent text-text outline-0';
const resetSubmit =
  'flex min-h-[3.2rem] w-full items-center justify-center gap-[0.55rem] mt-[1.3rem] rounded-[0.55rem] border border-gold-accent bg-[linear-gradient(135deg,#e0b96f,#a87934)] font-bold text-[#17130d]';

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);

  const reset = useMutation({
    mutationFn: () => resetPassword(token, password),
    onSuccess: () => setCompleted(true),
    onError: (requestError) =>
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : 'Não foi possível alterar a palavra-passe.',
      ),
  });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (!token) {
      setError('O link de recuperação é inválido ou está incompleto.');
      return;
    }
    if (!isStrongPassword(password)) {
      setError(STRONG_PASSWORD_MESSAGE);
      return;
    }
    if (password !== confirmation) {
      setError('As palavras-passe não coincidem.');
      return;
    }
    reset.mutate();
  };

  return (
    <main className="grid min-h-screen place-items-center bg-[linear-gradient(rgba(5,6,4,0.78),rgba(5,6,4,0.9)),var(--barbershop-cover-image)] bg-center bg-cover bg-no-repeat p-4 text-text">
      <section className="w-[min(100%,30rem)] rounded-2xl border border-[rgba(226,216,195,0.14)] bg-[rgba(12,13,11,0.94)] p-[clamp(1.5rem,5vw,2.5rem)] shadow-[0_2rem_6rem_rgba(0,0,0,0.55)] backdrop-blur-[18px]">
        <div className="flex flex-col items-start text-gold-accent">
          <span className="text-[0.58rem] font-bold tracking-[0.32em] uppercase">Barbearia</span>
          <strong className="font-serif text-[2rem] leading-none text-text uppercase">
            DonFlow
          </strong>
          <Scissors size={17} className="mt-2" />
        </div>

        {completed ? (
          <div className="mt-10">
            <span className="mb-[1.2rem] grid size-14 place-items-center rounded-full bg-[rgba(72,137,87,0.14)] text-[#8fd19e]">
              <Check />
            </span>
            <p className="m-0 text-[0.65rem] font-bold tracking-[0.16em] text-gold-light uppercase">
              Acesso recuperado
            </p>
            <h1 className="mt-2 mb-0 font-serif text-[clamp(2.4rem,7vw,3.4rem)] leading-[0.95]">
              Palavra-passe alterada
            </h1>
            <div className="mt-[0.8rem] text-[0.76rem] text-[#898c84]">
              Já podes iniciar sessão com a nova palavra-passe.
            </div>
            <div className="mt-[1.2rem] grid w-full grid-cols-2 gap-[0.6rem] max-[430px]:grid-cols-1">
              <button
                type="button"
                onClick={() => navigate('/customer/login')}
                className={cn(resetSubmit, 'mt-0 min-w-0 p-[0.6rem] text-[0.68rem]')}
              >
                Login de cliente
              </button>
              <button
                type="button"
                onClick={() => navigate('/staff/login')}
                className={cn(resetSubmit, 'mt-0 min-w-0 p-[0.6rem] text-[0.68rem]')}
              >
                Login profissional
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="mt-10">
              <p className="m-0 text-[0.65rem] font-bold tracking-[0.16em] text-gold-light uppercase">
                Recuperação de acesso
              </p>
              <h1 className="mt-2 mb-0 font-serif text-[clamp(2.4rem,7vw,3.4rem)] leading-[0.95]">
                Definir nova palavra-passe
              </h1>
            </div>
            <form onSubmit={submit} className="mt-[1.8rem]">
              <label htmlFor="new-password" className="mt-4 mb-[0.55rem] block text-[0.72rem] font-semibold text-[#d2d1ca]">
                Nova palavra-passe
              </label>
              <div className={resetField}>
                <LockKeyhole size={18} />
                <input
                  id="new-password"
                  type={passwordVisible ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="new-password"
                  placeholder="Mínimo de 12 caracteres"
                  className={resetFieldInput}
                />
                <button
                  type="button"
                  aria-label={passwordVisible ? 'Ocultar palavra-passe' : 'Mostrar palavra-passe'}
                  onClick={() => setPasswordVisible((current) => !current)}
                  className="grid place-items-center border-0 bg-transparent"
                >
                  {passwordVisible ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <PasswordStrength password={password} />
              <label htmlFor="confirm-password" className="mt-4 mb-[0.55rem] block text-[0.72rem] font-semibold text-[#d2d1ca]">
                Confirmar palavra-passe
              </label>
              <div className={resetField}>
                <LockKeyhole size={18} />
                <input
                  id="confirm-password"
                  type={passwordVisible ? 'text' : 'password'}
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  autoComplete="new-password"
                  placeholder="Repete a nova palavra-passe"
                  className={resetFieldInput}
                />
              </div>
              {error && (
                <p className="bg-[rgba(145,57,57,0.1)] p-3 text-[0.7rem] text-[#e5a0a0]" role="alert">
                  {error}
                </p>
              )}
              <button className={resetSubmit} type="submit" disabled={reset.isPending}>
                {reset.isPending ? (
                  <>
                    <LoaderCircle className="animate-spin" size={18} /> A guardar...
                  </>
                ) : (
                  'Alterar palavra-passe'
                )}
              </button>
            </form>
          </>
        )}
      </section>
    </main>
  );
}
