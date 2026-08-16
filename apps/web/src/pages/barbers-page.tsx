import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CalendarDays,
  LoaderCircle,
  Mail,
  Plus,
  Power,
  RefreshCw,
  Scissors,
  UserRound,
  X,
} from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { useNavigate } from 'react-router';
import { useStaffUser } from '../app/staff-context';
import { getAccessToken } from '../features/auth/auth-session';
import {
  getBarberManagement,
  inviteBarber,
  resendBarberInvitation,
  updateBarberStatus,
} from '../features/barbers/barbers-api';
import { ApiError } from '../lib/api/api-error';
import { UserAvatar } from '../shared/components/user-avatar';
import { useRole } from '../shared/hooks/use-role';
import { cn } from '@/lib/utils';

const eyebrow =
  'flex items-center gap-[0.45rem] m-0 text-[0.65rem] font-bold tracking-[0.16em] text-gold-light uppercase';
const goldButton =
  'flex min-h-[2.9rem] items-center justify-center gap-2 rounded-lg border border-gold-accent bg-[linear-gradient(135deg,#e0b96f,#a87934)] px-4 font-bold text-[#17130d]';
const goldToolbarButton = cn(goldButton, 'max-[700px]:w-[2.9rem] max-[700px]:px-0');
const outlineButton =
  'flex min-h-9 items-center gap-[0.4rem] rounded-[0.4rem] border border-[rgba(226,216,195,0.14)] bg-transparent px-[0.7rem] text-[0.65rem] text-[#cfcec7]';
const dialogInputRow =
  'mt-2 grid min-h-[3.1rem] grid-cols-[auto_1fr] items-center gap-[0.7rem] rounded-lg border border-[rgba(226,216,195,0.13)] bg-[#0b0c0a] px-[0.85rem]';
const dialogInput =
  'h-12 min-w-0 border-0 bg-transparent text-text outline-0 [&:-webkit-autofill]:[-webkit-text-fill-color:#f5f1e9] [&:-webkit-autofill]:[caret-color:#f5f1e9] [&:-webkit-autofill]:shadow-[0_0_0_1000px_#0b0c0a_inset]';
const dialogFooterButton =
  'min-h-[2.7rem] rounded-[0.45rem] border border-[rgba(226,216,195,0.14)] bg-transparent px-[0.9rem]';

export function BarbersPage() {
  const user = useStaffUser();
  const { isMaster } = useRole(user.role);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const accessToken = getAccessToken()!;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const management = useQuery({
    queryKey: ['barber-management'],
    queryFn: () => getBarberManagement(accessToken),
    enabled: isMaster,
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['barber-management'] });
  const invitation = useMutation({
    mutationFn: () => inviteBarber(accessToken, email.trim()),
    onSuccess: async () => {
      await refresh();
      setEmail('');
      setError(null);
      setDialogOpen(false);
    },
    onError: (requestError) =>
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : 'Não foi possível enviar o convite.',
      ),
  });
  const resend = useMutation({
    mutationFn: (id: string) => resendBarberInvitation(accessToken, id),
    onSuccess: refresh,
    onError: (requestError) =>
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : 'Não foi possível reenviar o convite.',
      ),
  });
  const status = useMutation({
    mutationFn: ({ id, value }: { id: string; value: 'ACTIVE' | 'INACTIVE' }) =>
      updateBarberStatus(accessToken, id, value),
    onSuccess: refresh,
    onError: (requestError) =>
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : 'Não foi possível alterar o estado.',
      ),
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError('Introduz um endereço de e-mail válido.');
    invitation.mutate();
  };

  if (!isMaster) return null;
  const data = management.data?.data;
  return (
    <main className="min-h-screen bg-[#080907] text-text">
      <header className="relative min-h-[14rem] overflow-hidden border-b border-[rgba(226,216,195,0.1)]">
        <div className="absolute inset-0 bg-[image:var(--barbershop-cover-admin)] bg-top bg-cover bg-no-repeat saturate-[0.7]" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(7,8,6,0.96),rgba(7,8,6,0.45)),linear-gradient(0deg,#080907,transparent_60%)]" />
        <div className="relative mx-auto w-[min(100%-2rem,72rem)] py-12 pb-8">
          <span className={eyebrow}>
            <Scissors size={15} /> Barbearia DonFlow
          </span>
          <h1 className="mt-[0.45rem] font-serif text-[clamp(3rem,7vw,5rem)] leading-[0.85]">
            Equipa
          </h1>
          <p className="text-[0.8rem] text-[#a4a69f]">Gere a equipa e as respetivas agendas.</p>
        </div>
      </header>
      <section className="mx-auto w-[min(100%-2rem,72rem)] py-8 pt-8 pb-20">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className={eyebrow}>Equipa</p>
            <h2 className="mt-[0.35rem] text-[1.35rem]">Profissionais e convites</h2>
          </div>
          <button
            type="button"
            className={goldToolbarButton}
            onClick={() => {
              setError(null);
              setDialogOpen(true);
            }}
          >
            <Plus size={18} /> <span className="max-[700px]:hidden">Convidar profissional</span>
          </button>
        </div>
        {error && !dialogOpen && (
          <p className="bg-[rgba(145,57,57,0.1)] p-[0.7rem] text-[0.7rem] text-[#e5a0a0]" role="alert">
            {error}
          </p>
        )}
        {management.isLoading ? (
          <BarberState loading title="A carregar equipa" />
        ) : management.isError ? (
          <BarberState title="Não foi possível carregar a equipa" />
        ) : (
          <>
            {data?.invitations.length ? (
              <section className="mt-[1.7rem]">
                <h3 className="mt-0 mb-[0.7rem] text-[0.72rem] tracking-[0.1em] text-[#b6b7b0] uppercase">
                  Convites pendentes
                </h3>
                <div className="grid gap-[0.65rem]">
                  {data.invitations.map((item) => (
                    <article
                      className="grid grid-cols-[auto_1fr_auto] items-center gap-[0.9rem] rounded-[0.7rem] border border-[rgba(226,216,195,0.11)] bg-[#10110e] p-4 max-[700px]:grid-cols-[auto_1fr]"
                      key={item.id}
                    >
                      <span className="grid size-[2.7rem] place-items-center rounded-full border border-[rgba(200,154,75,0.25)] bg-[rgba(200,154,75,0.08)] text-gold-light">
                        <Mail />
                      </span>
                      <div>
                        <strong className="block text-[0.82rem]">{item.email}</strong>
                        <small className="mt-1 block text-[0.65rem] text-[#777a72]">
                          {item.status === 'EXPIRED' ? 'Convite expirado' : 'A aguardar registo'}
                        </small>
                      </div>
                      <button
                        type="button"
                        className={cn(outlineButton, 'max-[700px]:col-span-full max-[700px]:row-auto max-[700px]:justify-self-start')}
                        disabled={resend.isPending}
                        onClick={() => resend.mutate(item.id)}
                      >
                        <RefreshCw size={15} /> Reenviar
                      </button>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}
            <section className="mt-[1.7rem]">
              <h3 className="mt-0 mb-[0.7rem] text-[0.72rem] tracking-[0.1em] text-[#b6b7b0] uppercase">
                Equipa registada
              </h3>
              {data?.barbers.length ? (
                <div className="grid gap-[0.65rem]">
                  {data.barbers.map((barber) => (
                    <article
                      className="grid grid-cols-[auto_1fr_auto] items-center gap-[0.9rem] rounded-[0.7rem] border border-[rgba(226,216,195,0.11)] bg-[#10110e] p-4"
                      key={barber.id}
                    >
                      <UserAvatar
                        className="grid size-[2.7rem] place-items-center rounded-full border border-[rgba(200,154,75,0.25)] bg-[rgba(200,154,75,0.08)] text-gold-light"
                        name={barber.displayName || barber.user.name}
                        profileImageDataUrl={barber.user.profileImageDataUrl}
                      />
                      <div>
                        <strong className="block text-[0.82rem]">
                          {barber.displayName || barber.user.name}
                        </strong>
                        <small className="mt-1 block text-[0.65rem] text-[#777a72]">
                          {barber.user.email}
                        </small>
                        <small className="mt-1 block text-[0.65rem] text-[#777a72]">
                          {barber.user.phone}
                        </small>
                      </div>
                      <span
                        className={cn(
                          'rounded-[2rem] px-[0.55rem] py-[0.3rem] text-[0.6rem] text-[#c28e8e] bg-[rgba(121,63,63,0.13)]',
                          barber.user.status === 'ACTIVE' && 'text-[#7fc18f] bg-[rgba(60,121,75,0.14)]',
                        )}
                      >
                        {barber.user.status === 'ACTIVE' ? 'Ativo' : 'Inativo'}
                      </span>
                      <div className="flex gap-2 [grid-column:2/-1] max-[700px]:[grid-column:1/-1]">
                        <button
                          type="button"
                          className={cn(outlineButton, 'max-[700px]:flex-1 max-[700px]:justify-center')}
                          onClick={() => navigate(`/?barberProfileId=${barber.id}`)}
                        >
                          <CalendarDays size={15} /> Ver agenda
                        </button>
                        <button
                          type="button"
                          className={cn(outlineButton, 'max-[700px]:flex-1 max-[700px]:justify-center')}
                          disabled={status.isPending}
                          onClick={() =>
                            status.mutate({
                              id: barber.id,
                              value: barber.user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE',
                            })
                          }
                        >
                          <Power size={15} />{' '}
                          {barber.user.status === 'ACTIVE' ? 'Desativar' : 'Ativar'}
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <BarberState title="Ainda não existem profissionais registados" />
              )}
            </section>
          </>
        )}
      </section>
      {dialogOpen && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-[rgba(0,0,0,0.78)] p-4 backdrop-blur-[6px]">
          <section
            className="w-[min(100%,30rem)] rounded-[0.9rem] border border-[rgba(226,216,195,0.14)] bg-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="barber-dialog-title"
          >
            <header className="flex items-center justify-between border-b border-[rgba(226,216,195,0.09)] p-[1.3rem]">
              <div>
                <p className={eyebrow}>Novo convite</p>
                <h2 id="barber-dialog-title" className="mt-[0.35rem] font-[Georgia,serif]">
                  Convidar profissional
                </h2>
              </div>
              <button
                type="button"
                aria-label="Fechar"
                onClick={() => setDialogOpen(false)}
                className="grid size-[2.3rem] place-items-center rounded-full border border-[rgba(226,216,195,0.14)] bg-transparent"
              >
                <X />
              </button>
            </header>
            <form onSubmit={submit} className="p-[1.3rem]">
              <label htmlFor="barber-email" className="text-[0.72rem] font-semibold">
                E-mail do profissional
              </label>
              <div className={dialogInputRow}>
                <Mail size={18} />
                <input
                  id="barber-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoFocus
                  autoComplete="email"
                  placeholder="profissional@exemplo.pt"
                  className={dialogInput}
                />
              </div>
              <p className="text-[0.68rem] leading-[1.5] text-[#777a72]">
                O profissional receberá uma ligação válida por 48 horas para confirmar o e-mail e
                completar o registo.
              </p>
              {error && (
                <p className="bg-[rgba(145,57,57,0.1)] p-[0.7rem] text-[0.7rem] text-[#e5a0a0]" role="alert">
                  {error}
                </p>
              )}
              <footer className="mt-[1.2rem] flex justify-end gap-[0.6rem]">
                <button
                  type="button"
                  className={dialogFooterButton}
                  onClick={() => setDialogOpen(false)}
                >
                  Cancelar
                </button>
                <button className={goldButton} type="submit" disabled={invitation.isPending}>
                  {invitation.isPending ? (
                    <>
                      <LoaderCircle className="animate-spin" /> A enviar...
                    </>
                  ) : (
                    <>
                      <Mail size={16} /> Enviar convite
                    </>
                  )}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}

function BarberState({ title, loading }: { title: string; loading?: boolean }) {
  return (
    <div className="grid min-h-[12rem] content-center place-items-center gap-[0.7rem] rounded-[0.7rem] border border-[rgba(226,216,195,0.1)] text-[#858880]">
      {loading ? <LoaderCircle className="animate-spin" /> : <UserRound />}
      <p className="m-0 text-[0.75rem]">{title}</p>
    </div>
  );
}
