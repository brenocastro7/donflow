import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Clock3, Scissors } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { cancelAppointment, getMyAppointments } from '../features/appointments/appointments-api';
import { getAccessToken } from '../features/auth/auth-session';
import { getMyReviews } from '../features/reviews/reviews-api';
import { getShopSettings } from '../features/settings/settings-api';
import { ApiError } from '../lib/api/api-error';
import { cn } from '@/lib/utils';
import {
  customerActionButton,
  customerDangerActionButton,
  customerEmptyState,
  customerLoginError,
  customerSectionEyebrow,
  customerSectionPage,
  customerSectionTitle,
} from './customer-portal-styles';
import { ExportToCalendarMenu } from './export-to-calendar-menu';

const date = new Intl.DateTimeFormat('pt-PT', {
  dateStyle: 'long',
  timeStyle: 'short',
  timeZone: 'Europe/Lisbon',
});
const status = {
  CONFIRMED: 'Confirmada',
  COMPLETED: 'Concluída',
  CANCELLED: 'Cancelada',
  NO_SHOW: 'Ausente',
};

export function CustomerAppointmentsPage() {
  const [scope, setScope] = useState<'upcoming' | 'history'>('upcoming');
  const accessToken = getAccessToken()!;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [appointmentToCancel, setAppointmentToCancel] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const appointments = useQuery({
    queryKey: ['customer', 'appointments', scope],
    queryFn: () => getMyAppointments(accessToken, scope),
  });
  const reviews = useQuery({
    queryKey: ['customer', 'reviews'],
    queryFn: () => getMyReviews(accessToken),
    enabled: scope === 'history',
  });
  const shop = useQuery({
    queryKey: ['customer', 'shop-settings'],
    queryFn: () => getShopSettings(accessToken),
  });
  const reviewedIds = new Set(reviews.data?.data.map((review) => review.appointmentId));
  const cancellation = useMutation({
    mutationFn: (appointmentId: string) => cancelAppointment(accessToken, appointmentId),
    onSuccess: async () => {
      setAppointmentToCancel(null);
      setActionError(null);
      await queryClient.invalidateQueries({ queryKey: ['customer', 'appointments'] });
    },
    onError: (cause) =>
      setActionError(
        cause instanceof ApiError ? cause.message : 'Não foi possível cancelar a marcação.',
      ),
  });
  return (
    <main className={customerSectionPage}>
      <header>
        <span className={customerSectionEyebrow}>Área do cliente</span>
        <h1 className={customerSectionTitle}>As minhas marcações</h1>
      </header>
      <div className="my-6 grid grid-cols-2 rounded-[0.55rem] border border-[rgba(214,170,91,0.14)] bg-[#10110e] p-1">
        <button
          className={cn(
            'cursor-pointer rounded-[0.4rem] border-0 bg-transparent p-3 text-[#85877f]',
            scope === 'upcoming' && 'bg-[#c99a4c] text-[#171208]',
          )}
          onClick={() => setScope('upcoming')}
        >
          Próximas
        </button>
        <button
          className={cn(
            'cursor-pointer rounded-[0.4rem] border-0 bg-transparent p-3 text-[#85877f]',
            scope === 'history' && 'bg-[#c99a4c] text-[#171208]',
          )}
          onClick={() => setScope('history')}
        >
          Concluídas
        </button>
      </div>
      <section className="grid gap-3">
        {appointments.data?.data.map((item) => (
          <article
            key={item.id}
            className="relative grid gap-[0.8rem] rounded-[0.7rem] border border-[rgba(225,216,197,0.1)] bg-panel p-4"
          >
            <div className="flex items-center gap-[0.55rem] text-[0.7rem] text-[#979990]">
              <CalendarDays className="text-[#c49343]" />
              <span>{date.format(new Date(item.startsAt))}</span>
            </div>
            <div className="flex items-center gap-[0.55rem] text-[0.7rem] text-[#979990]">
              <Scissors className="text-[#c49343]" />
              <span className="flex flex-col gap-[0.2rem]">
                <strong>{item.serviceNameSnapshot}</strong>
                <small className="text-[#73766f]">{item.barberProfile.displayName}</small>
              </span>
            </div>
            <div className="flex items-center gap-[0.55rem] text-[0.7rem] text-[#979990]">
              <Clock3 className="text-[#c49343]" />
              <span>{item.durationSnapshot} min</span>
            </div>
            <span
              className={cn(
                'absolute top-4 right-4 rounded-2xl px-2 py-1 text-[0.6rem]',
                item.status === 'CANCELLED' || item.status === 'NO_SHOW'
                  ? 'bg-[rgba(154,88,103,0.13)] text-[#d58b98]'
                  : 'bg-[rgba(79,155,99,0.12)] text-[#79b988]',
              )}
            >
              {status[item.status]}
            </span>
            {item.status === 'CONFIRMED' && (
              <div className="flex flex-wrap gap-2">
                <button
                  className={customerActionButton}
                  type="button"
                  onClick={() => setAppointmentToCancel(item.id)}
                >
                  Cancelar
                </button>
                <button
                  className={customerActionButton}
                  type="button"
                  onClick={() => navigate(`/customer/book?reschedule=${item.id}`)}
                >
                  Reagendar
                </button>
                <ExportToCalendarMenu
                  appointment={item}
                  shopAddress={shop.data?.data.address ?? null}
                />
              </div>
            )}
            {item.status === 'COMPLETED' &&
              (reviewedIds.has(item.id) ? (
                <span className="justify-self-start rounded-[0.4rem] bg-[rgba(79,155,99,0.1)] px-[0.7rem] py-[0.42rem] text-[0.62rem] text-[#79b988]">
                  Avaliado
                </span>
              ) : (
                <button
                  className="mt-[0.15rem] cursor-pointer justify-self-start rounded-[0.4rem] border border-[rgba(214,170,91,0.28)] bg-[rgba(214,170,91,0.08)] px-[0.7rem] py-[0.42rem] text-[0.62rem] text-[#d6aa5b]"
                  type="button"
                  onClick={() => navigate(`/customer/appointments?review=${item.id}`)}
                >
                  Avaliar
                </button>
              ))}
          </article>
        ))}
        {appointments.isLoading && <p className={customerEmptyState}>A carregar marcações…</p>}
        {!appointments.isLoading && !appointments.data?.data.length && (
          <p className={customerEmptyState}>Não existem marcações nesta categoria.</p>
        )}
      </section>
      {appointmentToCancel && (
        <div
          className="fixed inset-0 z-[120] grid place-items-center bg-[rgba(0,0,0,0.78)] p-5 backdrop-blur-[5px]"
          role="presentation"
        >
          <section
            className="relative w-[min(100%,28rem)] rounded-[0.85rem] border border-[rgba(214,170,91,0.28)] bg-[linear-gradient(145deg,#171813,#0d0e0c)] p-8 text-center shadow-[0_1.5rem_5rem_rgba(0,0,0,0.55)]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cancel-appointment-title"
          >
            <h2 id="cancel-appointment-title" className="m-0 font-serif text-[1.7rem]">
              Cancelar marcação?
            </h2>
            <p className="mt-[0.8rem] mb-[1.4rem] text-[0.76rem] leading-[1.7] text-[#a2a49c]">
              O cancelamento pelo cliente exige uma antecedência mínima de 24 horas.
            </p>
            {actionError && <p className={customerLoginError}>{actionError}</p>}
            <div className="mt-[1.15rem] flex justify-center gap-[0.65rem]">
              <button
                className={customerActionButton}
                type="button"
                onClick={() => {
                  setAppointmentToCancel(null);
                  setActionError(null);
                }}
              >
                Manter marcação
              </button>
              <button
                className={customerDangerActionButton}
                type="button"
                disabled={cancellation.isPending}
                onClick={() => cancellation.mutate(appointmentToCancel)}
              >
                {cancellation.isPending ? 'A cancelar…' : 'Confirmar cancelamento'}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
