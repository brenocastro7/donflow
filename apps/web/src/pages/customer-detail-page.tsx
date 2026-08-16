import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CalendarDays, Phone, ShieldBan } from 'lucide-react';
import { useNavigate, useParams } from 'react-router';
import { getAccessToken } from '../features/auth/auth-session';
import {
  getCustomer,
  getCustomerAppointments,
  updateCustomerBookingBlock,
} from '../features/customers/customers-api';
import { cn } from '@/lib/utils';
import { UserAvatar } from '../shared/components/user-avatar';

const pageBg = 'min-h-screen bg-[radial-gradient(circle_at_80%_0,rgba(161,112,45,0.1),transparent_28rem),#080907] p-8 text-text max-[720px]:p-4';
const customersStateClass =
  'mt-4 grid min-h-[10rem] place-items-center rounded-xl border border-dashed border-[rgba(226,216,195,0.12)] text-[0.8rem] text-[#898c84]';
const panelCard = 'mx-auto w-[min(100%,72rem)] rounded-[0.85rem] border border-[rgba(226,216,195,0.1)] bg-[#10110e]';

const dateTimeFormatter = new Intl.DateTimeFormat('pt-PT', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'Europe/Lisbon',
});

function formatPrice(value: string | number) {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(
    Number(value),
  );
}

const statusLabels = {
  CONFIRMED: 'Confirmada',
  CANCELLED: 'Cancelada',
  COMPLETED: 'Concluída',
  NO_SHOW: 'Não compareceu',
};

export function CustomerDetailPage() {
  const navigate = useNavigate();
  const { customerId = '' } = useParams();
  const accessToken = getAccessToken()!;
  const queryClient = useQueryClient();
  const customer = useQuery({
    queryKey: ['customer', customerId],
    queryFn: () => getCustomer(accessToken, customerId),
    enabled: Boolean(customerId),
  });
  const appointments = useQuery({
    queryKey: ['customer-appointments', customerId],
    queryFn: () => getCustomerAppointments(accessToken, customerId),
    enabled: Boolean(customerId),
  });
  const bookingBlock = useMutation({
    mutationFn: (blocked: boolean) => updateCustomerBookingBlock(accessToken, customerId, blocked),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['customer', customerId] }),
  });

  if (customer.isLoading)
    return (
      <main className={pageBg}>
        <div className={customersStateClass}>A carregar cliente...</div>
      </main>
    );
  if (!customer.data)
    return (
      <main className={pageBg}>
        <div className={customersStateClass}>Cliente não encontrado.</div>
      </main>
    );
  const data = customer.data.data;

  return (
    <main className={pageBg}>
      <header className="mx-auto mb-6 flex w-[min(100%,72rem)] items-center gap-4 text-[0.72rem] tracking-[0.12em] text-[#a5a79f] uppercase">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="Voltar à lista de clientes"
          className="grid size-[2.7rem] shrink-0 place-items-center rounded-full border border-[rgba(226,216,195,0.14)] bg-[rgba(17,18,15,0.8)]"
        >
          <ArrowLeft />
        </button>
        <span>Detalhes do cliente</span>
      </header>
      <section
        className={cn(
          panelCard,
          'grid grid-cols-[auto_minmax(12rem,1fr)_repeat(3,minmax(7rem,auto))] items-center gap-6 p-6',
          'max-[720px]:grid-cols-[auto_1fr] max-[720px]:gap-4 max-[720px]:p-4',
        )}
      >
        <UserAvatar
          className="grid size-[4.5rem] place-items-center rounded-full border border-[rgba(200,154,75,0.3)] bg-[#252017] text-gold-light max-[720px]:size-14"
          name={data.name}
          profileImageDataUrl={data.profileImageDataUrl}
        />
        <div>
          <p className="m-0 text-[0.65rem] font-bold tracking-[0.15em] text-gold-accent uppercase">
            Cliente registado
          </p>
          <h1 className="mt-[0.3rem] mb-[0.6rem] font-serif text-[2.25rem] leading-none">
            {data.name}
          </h1>
          <span className="flex items-center gap-[0.4rem] text-[0.72rem] text-[#9a9d95]">
            <Phone size={15} /> {data.phone ?? 'Telemóvel não indicado'}
          </span>
        </div>
        <div className="border-l border-[rgba(226,216,195,0.09)] pl-6 text-center max-[720px]:border-t max-[720px]:border-l-0 max-[720px]:pt-3 max-[720px]:pl-0">
          <strong className="block text-[0.95rem]">{data._count.customerAppointments}</strong>
          <span className="mt-[0.35rem] block text-[0.62rem] text-[#7f827a]">Marcações</span>
        </div>
        <div className="border-l border-[rgba(226,216,195,0.09)] pl-6 text-center max-[720px]:border-t max-[720px]:border-l-0 max-[720px]:pt-3 max-[720px]:pl-0">
          <strong className="block text-[0.95rem]">{formatPrice(data.totalSpent)}</strong>
          <span className="mt-[0.35rem] block text-[0.62rem] text-[#7f827a]">Total gasto</span>
        </div>
        <div className="border-l border-[rgba(226,216,195,0.09)] pl-6 text-center max-[720px]:col-span-2 max-[720px]:border-t max-[720px]:border-l-0 max-[720px]:pt-3 max-[720px]:pl-0">
          <strong className="block text-[0.95rem]">
            {data.lastVisit ? dateTimeFormatter.format(new Date(data.lastVisit)) : '—'}
          </strong>
          <span className="mt-[0.35rem] block text-[0.62rem] text-[#7f827a]">Última visita</span>
        </div>
      </section>
      <section
        className={cn(
          panelCard,
          'mt-4 flex items-center justify-between gap-4 px-5 py-4',
          'max-[720px]:flex-col max-[720px]:items-stretch',
        )}
      >
        <div className="flex items-center gap-3">
          <ShieldBan size={20} className="shrink-0 text-gold-accent" />
          <span className="flex flex-col gap-1">
            <strong className="text-[0.78rem]">Permissão para novas marcações</strong>
            <small className="text-[0.68rem] leading-[1.4] text-[#898c84]">
              {data.customerBookingBlocked
                ? 'Este cliente não pode receber novas marcações.'
                : data.customerBookingLimited
                  ? 'A próxima marcação deve ser feita por um profissional e existe o limite de uma marcação ativa.'
                  : 'O cliente pode efetuar marcações normalmente.'}
            </small>
          </span>
        </div>
        <button
          className={cn(
            'shrink-0 cursor-pointer rounded-lg border border-[rgba(200,154,75,0.3)] bg-[rgba(200,154,75,0.08)] px-[0.9rem] py-[0.65rem] text-gold-light max-[720px]:w-full',
            !data.customerBookingBlocked &&
              'border-[rgba(200,85,85,0.35)] bg-[rgba(160,55,55,0.1)] text-[#e49a9a]',
          )}
          type="button"
          disabled={bookingBlock.isPending}
          onClick={() => bookingBlock.mutate(!data.customerBookingBlocked)}
        >
          {bookingBlock.isPending
            ? 'A guardar…'
            : data.customerBookingBlocked
              ? 'Desbloquear marcações'
              : 'Bloquear marcações'}
        </button>
      </section>
      <section className={cn(panelCard, 'mt-4 p-5 max-[720px]:p-[0.8rem]')}>
        <div className="mb-4 flex items-center gap-[0.8rem]">
          <CalendarDays className="text-gold-accent" />
          <div>
            <p className="m-0 text-[0.65rem] font-bold tracking-[0.15em] text-gold-accent uppercase">
              Histórico
            </p>
            <h2 className="mt-[0.35rem] text-[1.35rem]">Marcações do cliente</h2>
          </div>
        </div>
        {appointments.data?.data.length ? (
          <div className="overflow-auto rounded-[0.65rem] border border-[rgba(226,216,195,0.08)]">
            <div className="grid min-w-[43rem] min-h-[2.6rem] grid-cols-[1.15fr_1.2fr_1fr_0.7fr_0.85fr] items-center gap-4 px-4 text-[0.6rem] tracking-[0.1em] text-[#757870] uppercase">
              <span>Data</span>
              <span>Serviço</span>
              <span>Profissional</span>
              <span>Valor</span>
              <span>Estado</span>
            </div>
            {appointments.data.data.map((appointment) => (
              <article
                key={appointment.id}
                className="grid min-w-[43rem] min-h-[3.6rem] grid-cols-[1.15fr_1.2fr_1fr_0.7fr_0.85fr] items-center gap-4 border-t border-[rgba(226,216,195,0.065)] px-4 text-[0.7rem] text-[#a8aaa3]"
              >
                <span>{dateTimeFormatter.format(new Date(appointment.startsAt))}</span>
                <strong className="text-[#f1ede5]">{appointment.serviceNameSnapshot}</strong>
                <span>{appointment.barberProfile.displayName}</span>
                <span>{formatPrice(appointment.priceSnapshot)}</span>
                <span
                  className={cn(
                    'w-max rounded-2xl bg-[rgba(79,155,99,0.12)] px-2 py-1 text-[#79b988]',
                    (appointment.status === 'CANCELLED' || appointment.status === 'NO_SHOW') &&
                      'bg-[rgba(154,88,103,0.13)] text-[#c87a88]',
                  )}
                >
                  {statusLabels[appointment.status]}
                </span>
              </article>
            ))}
          </div>
        ) : (
          <div className={customersStateClass}>Este cliente ainda não possui marcações.</div>
        )}
      </section>
    </main>
  );
}
