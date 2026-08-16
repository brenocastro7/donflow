import { useMutation } from '@tanstack/react-query';
import { Check, Eye, EyeOff, LoaderCircle, LockKeyhole, Scissors, UserRound } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { completeBarberRegistration } from '../features/barbers/barbers-api';
import { ApiError } from '../lib/api/api-error';
import { isStrongPassword, STRONG_PASSWORD_MESSAGE } from '../features/auth/password-policy';
import { PhoneInput } from '../shared/components/phone-input';
import { PasswordStrength } from '../shared/components/password-strength';

const barberField =
  'grid min-h-[3.1rem] grid-cols-[auto_1fr_auto] items-center gap-[0.7rem] rounded-[0.55rem] border border-[rgba(226,216,195,0.13)] bg-panel px-[0.9rem] focus-within:border-[rgba(211,167,91,0.65)] [&_svg]:text-[#777970]';
const barberFieldInput =
  'h-12 min-w-0 border-0 bg-transparent text-text outline-0 [&:-webkit-autofill]:[-webkit-text-fill-color:#f5f1e9] [&:-webkit-autofill]:[caret-color:#f5f1e9] [&:-webkit-autofill]:shadow-[0_0_0_1000px_#11120f_inset]';
const barberSubmit =
  'flex min-h-[3.2rem] w-full items-center justify-center gap-[0.55rem] mt-[1.3rem] rounded-[0.55rem] border border-gold-accent bg-[linear-gradient(135deg,#e0b96f,#a87934)] font-bold text-[#17130d]';

export function CompleteBarberRegistrationPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('+351');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);

  const completion = useMutation({
    mutationFn: () => completeBarberRegistration({ token, name: name.trim(), phone, password }),
    onSuccess: () => setCompleted(true),
    onError: (requestError) =>
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : 'Não foi possível concluir o registo.',
      ),
  });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (!token) return setError('O convite é inválido ou está incompleto.');
    if (name.trim().length < 2) return setError('Introduz o teu nome completo.');
    if (!/^\+[1-9]\d{7,14}$/.test(phone))
      return setError('Introduz o telemóvel no formato internacional, por exemplo +351912345678.');
    if (!isStrongPassword(password)) return setError(STRONG_PASSWORD_MESSAGE);
    if (password !== confirmation) return setError('As palavras-passe não coincidem.');
    completion.mutate();
  };

  return (
    <main className="grid min-h-screen place-items-center bg-[linear-gradient(rgba(5,6,4,0.78),rgba(5,6,4,0.9)),var(--barbershop-cover-image)] bg-center bg-cover bg-no-repeat p-4 text-text">
      <section className="w-[min(100%,32rem)] rounded-2xl border border-[rgba(226,216,195,0.14)] bg-[rgba(12,13,11,0.95)] p-[clamp(1.5rem,5vw,2.5rem)] shadow-[0_2rem_6rem_rgba(0,0,0,0.55)]">
        <div className="flex flex-col items-start text-gold-accent">
          <span className="text-[0.58rem] font-bold tracking-[0.32em] uppercase">Barbearia</span>
          <strong className="font-serif text-[2rem] leading-none text-text uppercase">
            DonFlow
          </strong>
          <Scissors size={17} className="mt-2" />
        </div>
        {completed ? (
          <div className="mt-8">
            <span className="mb-[1.2rem] grid size-14 place-items-center rounded-full bg-[rgba(72,137,87,0.14)] text-[#8fd19e]">
              <Check />
            </span>
            <p className="m-0 text-[0.65rem] font-bold tracking-[0.16em] text-gold-light uppercase">
              Registo concluído
            </p>
            <h1 className="mt-2 mb-0 font-serif text-[clamp(2.35rem,7vw,3.3rem)] leading-[0.95]">
              Bem-vindo à equipa
            </h1>
            <div className="mt-3 text-[0.72rem] leading-[1.5] text-[#898c84]">
              Já podes iniciar sessão e gerir a tua agenda.
            </div>
            <button type="button" onClick={() => navigate('/staff/login')} className={barberSubmit}>
              Entrar no painel
            </button>
          </div>
        ) : (
          <>
            <div className="mt-8">
              <p className="m-0 text-[0.65rem] font-bold tracking-[0.16em] text-gold-light uppercase">
                Convite da equipa
              </p>
              <h1 className="mt-2 mb-0 font-serif text-[clamp(2.35rem,7vw,3.3rem)] leading-[0.95]">
                Completa o teu registo
              </h1>
              <span className="mt-3 block text-[0.72rem] leading-[1.5] text-[#898c84]">
                Ao continuar, confirma que este endereço de e-mail lhe pertence.
              </span>
            </div>
            <form onSubmit={submit} className="mt-[1.4rem]">
              <label htmlFor="barber-name" className="mt-[0.85rem] mb-[0.45rem] block text-[0.72rem] font-semibold text-[#d2d1ca]">
                Nome completo
              </label>
              <div className={barberField}>
                <UserRound size={18} />
                <input
                  id="barber-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  autoComplete="name"
                  maxLength={120}
                  className={barberFieldInput}
                />
              </div>
              <label htmlFor="barber-phone" className="mt-[0.85rem] mb-[0.45rem] block text-[0.72rem] font-semibold text-[#d2d1ca]">
                Telemóvel
              </label>
              <PhoneInput id="barber-phone" value={phone} onChange={setPhone} required />
              <label htmlFor="barber-password" className="mt-[0.85rem] mb-[0.45rem] block text-[0.72rem] font-semibold text-[#d2d1ca]">
                Palavra-passe
              </label>
              <div className={barberField}>
                <LockKeyhole size={18} />
                <input
                  id="barber-password"
                  type={passwordVisible ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="new-password"
                  className={barberFieldInput}
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
              <label htmlFor="barber-password-confirmation" className="mt-[0.85rem] mb-[0.45rem] block text-[0.72rem] font-semibold text-[#d2d1ca]">
                Confirmar palavra-passe
              </label>
              <div className={barberField}>
                <LockKeyhole size={18} />
                <input
                  id="barber-password-confirmation"
                  type={passwordVisible ? 'text' : 'password'}
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  autoComplete="new-password"
                  className={barberFieldInput}
                />
              </div>
              {error && (
                <p className="bg-[rgba(145,57,57,0.1)] p-3 text-[0.7rem] text-[#e5a0a0]" role="alert">
                  {error}
                </p>
              )}
              <button className={barberSubmit} type="submit" disabled={completion.isPending}>
                {completion.isPending ? (
                  <>
                    <LoaderCircle className="animate-spin" size={18} /> A concluir...
                  </>
                ) : (
                  'Concluir registo'
                )}
              </button>
            </form>
          </>
        )}
      </section>
    </main>
  );
}
