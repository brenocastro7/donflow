import { useMutation, useQuery } from '@tanstack/react-query';
import { Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate, useOutletContext, useSearchParams } from 'react-router';
import {
  createAppointment,
  getAppointmentDetail,
  getAvailability,
  getAvailabilityCalendar,
  getBarbers,
  getBarberServices,
  rescheduleAppointment,
} from '../features/appointments/appointments-api';
import { getAccessToken } from '../features/auth/auth-session';
import type { AuthenticatedUser } from '../features/auth/auth-api';
import { ApiError } from '../lib/api/api-error';
import { cn } from '@/lib/utils';
import {
  customerLoginError,
  customerPrimaryButton,
  customerSectionEyebrow,
  customerSectionPage,
  customerSectionTitle,
} from './customer-portal-styles';

const today = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Lisbon' }).format(new Date());
const monthGrid = (month: string) => {
  const first = new Date(`${month}-01T12:00:00Z`);
  first.setUTCDate(first.getUTCDate() - ((first.getUTCDay() + 6) % 7));
  return Array.from({ length: 42 }, (_, i) => {
    const day = new Date(first);
    day.setUTCDate(first.getUTCDate() + i);
    return day.toISOString().slice(0, 10);
  });
};
const moveMonth = (month: string, value: number) => {
  const date = new Date(`${month}-01T12:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + value);
  return date.toISOString().slice(0, 7);
};
const time = (value: string) =>
  new Intl.DateTimeFormat('pt-PT', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Lisbon',
  }).format(new Date(value));

export function CustomerBookingPage() {
  const navigate = useNavigate();
  const token = getAccessToken()!;
  const [searchParams] = useSearchParams();
  const rescheduleId = searchParams.get('reschedule');
  const user = useOutletContext<AuthenticatedUser>();
  const [barberId, setBarberId] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [date, setDate] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [month, setMonth] = useState(today().slice(0, 7));
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState(false);
  const barbers = useQuery({
    queryKey: ['customer', 'booking', 'barbers'],
    queryFn: () => getBarbers(token),
  });
  const appointment = useQuery({
    queryKey: ['customer', 'appointment', rescheduleId],
    queryFn: () => getAppointmentDetail(token, rescheduleId!),
    enabled: Boolean(rescheduleId),
    retry: false,
  });
  const services = useQuery({
    queryKey: ['customer', 'booking', 'services', barberId],
    queryFn: () => getBarberServices(token, barberId),
    enabled: Boolean(barberId),
  });
  const calendar = useQuery({
    queryKey: ['customer', 'booking', 'calendar', barberId, serviceId, month],
    queryFn: () => getAvailabilityCalendar(token, barberId, serviceId, month),
    enabled: Boolean(barberId && serviceId),
  });
  const slots = useQuery({
    queryKey: ['customer', 'booking', 'slots', barberId, serviceId, date],
    queryFn: () => getAvailability(token, barberId, serviceId, date),
    enabled: Boolean(barberId && serviceId && date),
  });
  useEffect(() => {
    if (!rescheduleId) setServiceId('');
    setDate('');
    setStartsAt('');
  }, [barberId, rescheduleId]);
  useEffect(() => {
    setDate('');
    setStartsAt('');
  }, [serviceId]);
  useEffect(() => setStartsAt(''), [date]);
  useEffect(() => {
    if (!appointment.data?.data || !rescheduleId) return;
    setBarberId(appointment.data.data.barberProfile.id);
    setServiceId(appointment.data.data.barberService.id);
  }, [appointment.data, rescheduleId]);
  const days = useMemo(() => monthGrid(month), [month]);
  const creation = useMutation({
    mutationFn: () =>
      rescheduleId
        ? rescheduleAppointment(token, rescheduleId, startsAt)
        : createAppointment(token, { barberServiceId: serviceId, startsAt }),
    onSuccess: () => setCreated(true),
    onError: (cause) =>
      setError(cause instanceof ApiError ? cause.message : 'Não foi possível concluir a marcação.'),
  });
  if (user.customerBookingBlocked || user.customerBookingLimited) {
    return <Navigate to="/customer" replace state={{ showBookingRestriction: true }} />;
  }
  if (created)
    return (
      <main className={cn(customerSectionPage, 'flex flex-col items-center justify-center text-center')}>
        <Check className="size-12 text-[#d6aa5b]" />
        <span>{rescheduleId ? 'Marcação reagendada' : 'Marcação confirmada'}</span>
        <h1 className={customerSectionTitle}>
          {rescheduleId ? 'A nova hora ficou reservada.' : 'A tua hora ficou reservada.'}
        </h1>
        <button className={customerPrimaryButton} onClick={() => navigate('/customer/appointments')}>
          Ver as minhas marcações
        </button>
      </main>
    );
  return (
    <main className={customerSectionPage}>
      <header>
        <span className={customerSectionEyebrow}>
          {rescheduleId ? 'Reagendar marcação' : 'Nova marcação'}
        </span>
        <h1 className={customerSectionTitle}>Escolhe a tua hora.</h1>
        <p className="text-[0.72rem] text-[#85877f]">
          As marcações exigem uma antecedência mínima de 24 horas.
        </p>
      </header>
      {!rescheduleId && (
        <section className="mt-4 rounded-[0.7rem] border border-[rgba(225,216,197,0.1)] bg-panel p-4">
          <div className="mb-4 flex items-center gap-[0.55rem]">
            <span className="grid size-[1.6rem] place-items-center rounded-full bg-[#c99a4c] text-[0.65rem] text-[#171208]">
              1
            </span>
            <h2 className="m-0 text-[0.85rem]">Profissional</h2>
          </div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(8rem,1fr))] gap-[0.6rem]">
            {barbers.data?.data.map((barber) => (
              <button
                className={cn(
                  'flex flex-col items-center rounded-lg border border-[rgba(225,216,197,0.1)] bg-[#0c0d0b] p-[0.8rem] text-[#eee]',
                  barberId === barber.id && 'border-[#c99a4c] bg-[rgba(201,154,76,0.1)]',
                )}
                key={barber.id}
                onClick={() => setBarberId(barber.id)}
              >
                <span className="mb-[0.7rem] grid size-16 place-items-center rounded-full border-2 border-[#aa7934] bg-[#272118] font-[Georgia,serif] text-gold-light">
                  {barber.user.profileImageDataUrl ? (
                    <img
                      src={barber.user.profileImageDataUrl}
                      alt=""
                      className="size-full rounded-[inherit] object-cover"
                    />
                  ) : (
                    barber.displayName.slice(0, 2).toUpperCase()
                  )}
                </span>
                <strong className="text-[0.75rem]">{barber.displayName}</strong>
              </button>
            ))}
          </div>
        </section>
      )}
      {!rescheduleId && barberId && (
        <section className="mt-4 rounded-[0.7rem] border border-[rgba(225,216,197,0.1)] bg-panel p-4">
          <div className="mb-4 flex items-center gap-[0.55rem]">
            <span className="grid size-[1.6rem] place-items-center rounded-full bg-[#c99a4c] text-[0.65rem] text-[#171208]">
              2
            </span>
            <h2 className="m-0 text-[0.85rem]">Serviço</h2>
          </div>
          <div className="grid gap-2">
            {services.data?.data.map((service) => (
              <button
                className={cn(
                  'flex items-center justify-between rounded-lg border border-[rgba(225,216,197,0.1)] bg-[#0c0d0b] p-[0.85rem] text-[#eee]',
                  serviceId === service.id && 'border-[#c99a4c] bg-[rgba(201,154,76,0.1)]',
                )}
                key={service.id}
                onClick={() => setServiceId(service.id)}
              >
                <span className="flex flex-col gap-1 text-left">
                  <strong>{service.name}</strong>
                  <small className="text-[#777a73]">{service.durationMinutes} min</small>
                </span>
                <b className="text-[0.7rem] text-[#d6aa5b]">
                  {new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(
                    Number(service.price),
                  )}
                </b>
              </button>
            ))}
          </div>
        </section>
      )}
      {serviceId && (
        <section className="mt-4 rounded-[0.7rem] border border-[rgba(225,216,197,0.1)] bg-panel p-4">
          <div className="mb-4 flex items-center gap-[0.55rem]">
            <span className="grid size-[1.6rem] place-items-center rounded-full bg-[#c99a4c] text-[0.65rem] text-[#171208]">
              3
            </span>
            <h2 className="m-0 text-[0.85rem]">Data</h2>
          </div>
          <div className="mb-3 flex items-center justify-between capitalize">
            <button
              className="border-0 bg-transparent text-[#d6aa5b]"
              onClick={() => setMonth(moveMonth(month, -1))}
            >
              <ChevronLeft />
            </button>
            <strong>
              {new Intl.DateTimeFormat('pt-PT', { month: 'long', year: 'numeric' }).format(
                new Date(`${month}-01T12:00:00Z`),
              )}
            </strong>
            <button
              className="border-0 bg-transparent text-[#d6aa5b]"
              onClick={() => setMonth(moveMonth(month, 1))}
            >
              <ChevronRight />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1">
            <div className="contents">
              {['S', 'T', 'Q', 'Q', 'S', 'S', 'D'].map((d, i) => (
                <span key={i} className="p-[0.4rem] text-center text-[0.6rem] text-[#696c65]">
                  {d}
                </span>
              ))}
            </div>
            {days.map((day) => {
              const info = calendar.data?.data.days.find((item) => item.date === day);
              const enabled = day >= today() && Boolean(info?.availableSlots);
              const outside = day.slice(0, 7) !== month;
              const active = date === day;
              return (
                <button
                  className={cn(
                    'relative aspect-square rounded-[0.35rem] border border-[rgba(225,216,197,0.08)] bg-[#0c0d0b] text-[#ddd] disabled:text-[#444740] disabled:opacity-[0.55]',
                    outside && 'text-[#444740] opacity-[0.55]',
                    active && 'border-[#c99a4c] bg-[#c99a4c] text-[#171208]',
                  )}
                  disabled={!enabled}
                  key={day}
                  onClick={() => setDate(day)}
                >
                  <span>{Number(day.slice(-2))}</span>
                  {enabled && (
                    <small className="absolute right-[0.15rem] bottom-[0.1rem] text-[0.48rem] text-[#7db489]">
                      {info?.availableSlots}
                    </small>
                  )}
                </button>
              );
            })}
          </div>
        </section>
      )}
      {date && (
        <section className="mt-4 rounded-[0.7rem] border border-[rgba(225,216,197,0.1)] bg-panel p-4">
          <div className="mb-4 flex items-center gap-[0.55rem]">
            <span className="grid size-[1.6rem] place-items-center rounded-full bg-[#c99a4c] text-[0.65rem] text-[#171208]">
              4
            </span>
            <h2 className="m-0 text-[0.85rem]">Horário</h2>
          </div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(4.5rem,1fr))] gap-[0.4rem]">
            {slots.data?.data.slots.map((slot) => (
              <button
                className={cn(
                  'rounded-[0.35rem] border border-[rgba(225,216,197,0.1)] bg-[#0c0d0b] p-[0.65rem] text-[#ddd]',
                  startsAt === slot.startsAt && 'border-[#c99a4c] bg-[rgba(201,154,76,0.1)]',
                )}
                key={slot.startsAt}
                onClick={() => setStartsAt(slot.startsAt)}
              >
                {time(slot.startsAt)}
              </button>
            ))}
          </div>
        </section>
      )}
      {error && <p className={customerLoginError}>{error}</p>}
      <button
        className={customerPrimaryButton}
        disabled={!startsAt || creation.isPending}
        onClick={() => {
          setError(null);
          creation.mutate();
        }}
      >
        {creation.isPending
          ? 'A confirmar…'
          : rescheduleId
            ? 'Confirmar novo horário'
            : 'Confirmar marcação'}
      </button>
    </main>
  );
}
