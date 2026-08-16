import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  LoaderCircle,
  Scissors,
  UserRound,
} from 'lucide-react';
import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useStaffUser } from '../app/staff-context';
import {
  createAppointment,
  getAvailability,
  getAvailabilityCalendar,
  getBarbers,
  getBarberServices,
} from '../features/appointments/appointments-api';
import { getAccessToken } from '../features/auth/auth-session';
import { lookupCustomersByPhone } from '../features/customers/customers-api';
import { ApiError } from '../lib/api/api-error';
import { PhoneInput } from '../shared/components/phone-input';
import { optionalPhone } from '../shared/components/phone-value';
import { UserAvatar } from '../shared/components/user-avatar';
import { useOutsidePress } from '../shared/hooks/use-outside-press';
import { useRole } from '../shared/hooks/use-role';
import { cn } from '@/lib/utils';

const bookingSection =
  'rounded-[0.9rem] border border-[rgba(226,216,195,0.11)] bg-[rgba(17,18,15,0.88)] p-[clamp(1.25rem,4vw,2rem)]';
const bookingLabel = 'block text-[0.72rem] font-semibold text-[#cfcec7]';
const bookingInput =
  'mt-[0.55rem] min-h-12 w-full rounded-lg border border-[rgba(226,216,195,0.13)] bg-[#0b0c0a] px-[0.85rem] text-[0.8rem] text-text outline-0 focus:border-[rgba(211,167,91,0.65)] focus:shadow-[0_0_0_3px_rgba(211,167,91,0.08)]';
const actionButton =
  'flex min-h-12 items-center justify-center gap-[0.55rem] rounded-lg border border-[rgba(226,216,195,0.14)] bg-panel px-5 max-[620px]:px-[0.65rem] max-[620px]:text-[0.72rem]';
const goldActionButton = cn(
  actionButton,
  'border-gold-accent bg-[linear-gradient(135deg,#e0b96f,#a87934)] font-bold text-[#17130d]',
);

function todayInLisbon() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Lisbon',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function slotTime(value: string) {
  return new Intl.DateTimeFormat('pt-PT', {
    timeZone: 'Europe/Lisbon',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value));
}

function moveCalendarMonth(month: string, direction: -1 | 1) {
  const value = new Date(`${month}-01T12:00:00Z`);
  value.setUTCMonth(value.getUTCMonth() + direction);
  return value.toISOString().slice(0, 7);
}

function calendarGrid(month: string) {
  const first = new Date(`${month}-01T12:00:00Z`);
  const offset = (first.getUTCDay() + 6) % 7;
  first.setUTCDate(first.getUTCDate() - offset);
  return Array.from({ length: 42 }, (_, index) => {
    const value = new Date(first);
    value.setUTCDate(first.getUTCDate() + index);
    return value.toISOString().slice(0, 10);
  });
}

export function NewAppointmentPage() {
  const user = useStaffUser();
  const { isMaster, isBarber } = useRole(user.role);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const accessToken = getAccessToken()!;
  const [barberProfileId, setBarberProfileId] = useState(user.barberProfileId ?? '');
  const [barberServiceId, setBarberServiceId] = useState('');
  const [date, setDate] = useState('');
  const [calendarMonth, setCalendarMonth] = useState(() => todayInLisbon().slice(0, 7));
  const [startsAt, setStartsAt] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('+351');
  const [phoneLookup, setPhoneLookup] = useState('+351');
  const [customerSuggestionsOpen, setCustomerSuggestionsOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [created, setCreated] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setPhoneLookup(customerPhone), 300);
    return () => window.clearTimeout(timer);
  }, [customerPhone]);
  const customerSuggestions = useQuery({
    queryKey: ['customers', 'phone-lookup', phoneLookup],
    queryFn: () => lookupCustomersByPhone(accessToken, phoneLookup),
    enabled: /^\+[1-9]\d{3,14}$/.test(phoneLookup) && phoneLookup.replace(/\D/g, '').length >= 6,
    staleTime: 30_000,
  });
  const customerSuggestionsRef = useOutsidePress<HTMLDivElement>(customerSuggestionsOpen, () =>
    setCustomerSuggestionsOpen(false),
  );

  const barbers = useQuery({
    queryKey: ['barbers', 'active'],
    queryFn: () => getBarbers(accessToken),
  });

  useEffect(() => {
    if (isMaster && !barberProfileId && barbers.data?.data.length) {
      const ownProfile = barbers.data.data.find((barber) => barber.id === user.barberProfileId);
      setBarberProfileId(ownProfile?.id ?? barbers.data.data[0].id);
    }
  }, [barberProfileId, barbers.data?.data, user.barberProfileId, isMaster]);

  const services = useQuery({
    queryKey: ['barber-services', barberProfileId],
    queryFn: () => getBarberServices(accessToken, barberProfileId),
    enabled: Boolean(barberProfileId),
  });

  useEffect(() => {
    setBarberServiceId('');
    setStartsAt('');
  }, [barberProfileId]);

  useEffect(() => setStartsAt(''), [barberServiceId, date]);

  const availability = useQuery({
    queryKey: ['availability', barberProfileId, barberServiceId, date],
    queryFn: () => getAvailability(accessToken, barberProfileId, barberServiceId, date),
    enabled: Boolean(barberProfileId && barberServiceId && date),
  });

  const availabilityCalendar = useQuery({
    queryKey: ['availability-calendar', barberProfileId, barberServiceId, calendarMonth],
    queryFn: () =>
      getAvailabilityCalendar(accessToken, barberProfileId, barberServiceId, calendarMonth),
    enabled: Boolean(barberProfileId && barberServiceId && calendarMonth),
  });

  useEffect(() => {
    const days = availabilityCalendar.data?.data.days;
    if (!days) return;
    const selectedDay = days.find((day) => day.date === date);
    if (selectedDay?.availableSlots) return;
    const firstAvailable = days.find(
      (day) => day.date >= todayInLisbon() && day.availableSlots > 0,
    );
    setDate(firstAvailable?.date ?? '');
  }, [availabilityCalendar.data?.data.days, date]);

  const selectedService = useMemo(
    () => services.data?.data.find((service) => service.id === barberServiceId),
    [barberServiceId, services.data?.data],
  );

  const creation = useMutation({
    mutationFn: () =>
      createAppointment(accessToken, {
        barberServiceId,
        startsAt,
        customerName: customerName.trim(),
        ...(optionalPhone(customerPhone) ? { customerPhone: optionalPhone(customerPhone) } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['appointments'] });
      setCreated(true);
    },
    onError: (error) => {
      if (error instanceof ApiError) {
        setFormError(error.message);
      } else {
        setFormError('Não foi possível criar a marcação. Tenta novamente.');
      }
    },
  });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    if (!barberProfileId || !barberServiceId || !date || !startsAt || !customerName.trim()) {
      setFormError('Preenche o profissional, o serviço, a data, a hora e o nome do cliente.');
      return;
    }
    if (optionalPhone(customerPhone) && !/^\+[1-9]\d{7,14}$/.test(customerPhone.trim())) {
      setFormError('O telemóvel deve estar no formato internacional, por exemplo +351912345678.');
      return;
    }
    creation.mutate();
  };

  if (created) {
    return (
      <main className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_85%_0,rgba(161,112,45,0.12),transparent_28rem),#080907] p-4 text-text">
        <div className="w-[min(100%,30rem)] rounded-2xl border border-[rgba(226,216,195,0.12)] bg-panel p-10 text-center">
          <span className="mx-auto grid size-16 place-items-center rounded-full bg-[rgba(72,137,87,0.14)] text-[#8fd19e]">
            <Check size={28} />
          </span>
          <p className="mt-4 text-[0.68rem] tracking-[0.16em] text-gold-light uppercase">
            Marcação criada
          </p>
          <h1 className="mt-2 font-serif text-[2.6rem]">{customerName}</h1>
          <dl className="my-6 border-t border-[rgba(226,216,195,0.1)]">
            <div className="flex justify-between border-b border-[rgba(226,216,195,0.1)] py-[0.8rem] text-[0.75rem]">
              <dt className="text-[#858880]">Serviço</dt>
              <dd className="m-0">{selectedService?.name}</dd>
            </div>
            <div className="flex justify-between border-b border-[rgba(226,216,195,0.1)] py-[0.8rem] text-[0.75rem]">
              <dt className="text-[#858880]">Data</dt>
              <dd className="m-0">
                {new Intl.DateTimeFormat('pt-PT').format(new Date(`${date}T12:00:00Z`))}
              </dd>
            </div>
            <div className="flex justify-between border-b border-[rgba(226,216,195,0.1)] py-[0.8rem] text-[0.75rem]">
              <dt className="text-[#858880]">Horário</dt>
              <dd className="m-0">{slotTime(startsAt)}</dd>
            </div>
          </dl>
          <button
            type="button"
            onClick={() => navigate(`/?date=${date}`)}
            className={cn(goldActionButton, 'w-full')}
          >
            Ver na agenda <ChevronRight size={18} />
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_85%_0,rgba(161,112,45,0.12),transparent_28rem),#080907] pb-16 text-text">
      <header className="mx-auto flex w-[min(100%-2rem,64rem)] items-start gap-[1.2rem] py-12 pb-8 max-[620px]:pt-6">
        <button
          type="button"
          aria-label="Voltar à página anterior"
          onClick={() => navigate(-1)}
          className="grid size-[2.7rem] shrink-0 place-items-center rounded-full border border-[rgba(226,216,195,0.14)] bg-panel"
        >
          <ArrowLeft />
        </button>
        <div>
          <span className="text-[0.65rem] font-bold tracking-[0.18em] text-gold-accent uppercase">
            Barbearia DonFlow
          </span>
          <h1 className="mt-[0.35rem] font-serif text-[clamp(2.8rem,6vw,4.5rem)] leading-[0.9]">
            Nova marcação
          </h1>
          <p className="mt-[0.7rem] text-[0.82rem] text-[#92948d]">
            Regista uma marcação presencial na agenda.
          </p>
        </div>
      </header>

      <form className="mx-auto grid w-[min(100%-2rem,64rem)] gap-4" onSubmit={submit}>
        <section className={bookingSection}>
          <div className="mb-6 flex items-start gap-[0.9rem]">
            <span className="grid size-8 shrink-0 place-items-center rounded-full border border-[rgba(200,154,75,0.3)] text-[0.65rem] text-gold-light">
              01
            </span>
            <div>
              <h2 className="m-0 text-base">Marcação</h2>
              <p className="mt-[0.3rem] mb-0 text-[0.72rem] text-[#858880]">
                Escolhe o profissional e o serviço a prestar.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 max-[620px]:grid-cols-1">
            <label className={bookingLabel}>
              Profissional
              <select
                value={barberProfileId}
                onChange={(event) => setBarberProfileId(event.target.value)}
                disabled={isBarber || barbers.isLoading}
                className={bookingInput}
              >
                <option value="">Seleciona o profissional</option>
                {barbers.data?.data
                  .filter((barber) => isMaster || barber.id === user.barberProfileId)
                  .map((barber) => (
                    <option value={barber.id} key={barber.id}>
                      {barber.displayName}
                    </option>
                  ))}
              </select>
            </label>
            <label className={bookingLabel}>
              Serviço
              <select
                value={barberServiceId}
                onChange={(event) => setBarberServiceId(event.target.value)}
                disabled={!barberProfileId || services.isLoading}
                className={bookingInput}
              >
                <option value="">Seleciona o serviço</option>
                {services.data?.data.map((service) => (
                  <option value={service.id} key={service.id}>
                    {service.name} · {service.durationMinutes} min
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <section className={bookingSection}>
          <div className="mb-6 flex items-start gap-[0.9rem]">
            <span className="grid size-8 shrink-0 place-items-center rounded-full border border-[rgba(200,154,75,0.3)] text-[0.65rem] text-gold-light">
              02
            </span>
            <div>
              <h2 className="m-0 text-base">Data e horário</h2>
              <p className="mt-[0.3rem] mb-0 text-[0.72rem] text-[#858880]">
                Apenas horários realmente disponíveis podem ser selecionados.
              </p>
            </div>
          </div>
          <div className="w-[min(100%,24rem)] rounded-xl border border-[rgba(226,216,195,0.13)] bg-[#0b0c0a] p-[0.8rem]">
            <header className="mb-[0.65rem] grid grid-cols-[2.4rem_1fr_2.4rem] items-center">
              <button
                type="button"
                aria-label="Mês anterior"
                onClick={() => setCalendarMonth((month) => moveCalendarMonth(month, -1))}
                className="grid size-[2.2rem] place-items-center rounded-[0.4rem] border border-[rgba(226,216,195,0.11)] bg-panel"
              >
                <ChevronLeft size={17} />
              </button>
              <strong className="text-center text-[0.78rem] capitalize">
                {new Intl.DateTimeFormat('pt-PT', {
                  month: 'long',
                  year: 'numeric',
                }).format(new Date(`${calendarMonth}-01T12:00:00Z`))}
              </strong>
              <button
                type="button"
                aria-label="Mês seguinte"
                onClick={() => setCalendarMonth((month) => moveCalendarMonth(month, 1))}
                className="grid size-[2.2rem] place-items-center rounded-[0.4rem] border border-[rgba(226,216,195,0.11)] bg-panel"
              >
                <ChevronRight size={17} />
              </button>
            </header>
            <div className="grid grid-cols-7" aria-hidden="true">
              {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((day) => (
                <span
                  key={day}
                  className="py-[0.45rem] text-center text-[0.55rem] font-bold text-[#6f726b] uppercase"
                >
                  {day}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {calendarGrid(calendarMonth).map((calendarDate) => {
                const day = availabilityCalendar.data?.data.days.find(
                  (item) => item.date === calendarDate,
                );
                const outsideMonth = !calendarDate.startsWith(calendarMonth);
                const unavailable = !day || day.availableSlots === 0;
                const selected = date === calendarDate;
                return (
                  <button
                    className={cn(
                      'relative grid aspect-square place-items-center rounded-[0.4rem] border border-transparent bg-transparent text-[0.68rem] text-[#b8bab2]',
                      outsideMonth && 'invisible',
                      unavailable
                        ? 'cursor-not-allowed text-[#545750]'
                        : 'cursor-pointer',
                      selected &&
                        'border-gold-accent bg-[linear-gradient(135deg,#e0b96f,#a87934)] font-extrabold text-[#17130d]',
                    )}
                    type="button"
                    key={calendarDate}
                    disabled={
                      outsideMonth ||
                      unavailable ||
                      calendarDate < todayInLisbon() ||
                      availabilityCalendar.isLoading
                    }
                    onClick={() => setDate(calendarDate)}
                    aria-label={`${calendarDate}: ${
                      day?.availableSlots
                        ? `${day.availableSlots} horários disponíveis`
                        : 'sem horários disponíveis'
                    }`}
                  >
                    <span>{Number(calendarDate.slice(-2))}</span>
                    {!outsideMonth && (
                      <i
                        className={cn(
                          'absolute right-[0.28rem] bottom-[0.22rem] size-[0.3rem] rounded-full',
                          unavailable ? 'bg-[#704b4b]' : 'bg-[#65a978]',
                        )}
                      />
                    )}
                  </button>
                );
              })}
            </div>
            <footer className="mt-[0.7rem] flex gap-4 border-t border-[rgba(226,216,195,0.08)] pt-[0.7rem]">
              <span className="flex items-center gap-[0.35rem] text-[0.58rem] text-[#74776f]">
                <i className="size-[0.4rem] rounded-full bg-[#65a978]" /> Com horários
              </span>
              <span className="flex items-center gap-[0.35rem] text-[0.58rem] text-[#74776f]">
                <i className="size-[0.4rem] rounded-full bg-[#704b4b]" /> Sem horários
              </span>
            </footer>
          </div>

          <div className="mt-[1.2rem] flex flex-wrap gap-[0.55rem]" aria-label="Horários disponíveis">
            {!barberServiceId ? (
              <p className="m-0 flex items-center gap-2 text-[0.75rem] text-[#858880]">
                Seleciona um serviço para consultar os horários.
              </p>
            ) : availability.isLoading ? (
              <p className="m-0 flex items-center gap-2 text-[0.75rem] text-[#858880]">
                <LoaderCircle className="animate-spin" size={17} /> A consultar horários...
              </p>
            ) : availability.data?.data.slots.length ? (
              availability.data.data.slots.map((slot) => (
                <button
                  className={cn(
                    'flex min-h-10 min-w-[5.3rem] items-center justify-center gap-[0.4rem] rounded-[0.45rem] border border-[rgba(226,216,195,0.13)] bg-[#0b0c0a] text-[#b8bab2]',
                    startsAt === slot.startsAt &&
                      'border-gold bg-[linear-gradient(135deg,#e0b96f,#a87934)] text-[#17130d]',
                  )}
                  type="button"
                  key={slot.startsAt}
                  onClick={() => setStartsAt(slot.startsAt)}
                >
                  <Clock3 size={15} />
                  {slotTime(slot.startsAt)}
                </button>
              ))
            ) : (
              <p className="m-0 flex items-center gap-2 text-[0.75rem] text-[#858880]">
                Não existem horários disponíveis nesta data.
              </p>
            )}
          </div>
        </section>

        <section className={bookingSection}>
          <div className="mb-6 flex items-start gap-[0.9rem]">
            <span className="grid size-8 shrink-0 place-items-center rounded-full border border-[rgba(200,154,75,0.3)] text-[0.65rem] text-gold-light">
              03
            </span>
            <div>
              <h2 className="m-0 text-base">Cliente</h2>
              <p className="mt-[0.3rem] mb-0 text-[0.72rem] text-[#858880]">
                O nome é obrigatório. O telemóvel é opcional e associa uma conta existente.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 max-[620px]:grid-cols-1">
            <label className={bookingLabel}>
              Nome do cliente
              <span className="relative block">
                <UserRound size={17} className="absolute top-[1.55rem] left-[0.8rem] z-[1] text-[#6f726b]" />
                <input
                  type="text"
                  value={customerName}
                  onChange={(event) => setCustomerName(event.target.value)}
                  maxLength={120}
                  placeholder="Nome completo"
                  className={cn(bookingInput, 'pl-[2.35rem]')}
                />
              </span>
            </label>
            <label className={bookingLabel}>
              Telemóvel <small className="font-normal text-[#71746c]">Opcional</small>
              <div className="relative" ref={customerSuggestionsRef}>
                <PhoneInput
                  value={customerPhone}
                  onChange={(value) => {
                    setCustomerPhone(value);
                    setCustomerSuggestionsOpen(true);
                  }}
                />
                {customerSuggestionsOpen && customerSuggestions.data?.data.length ? (
                  <div className="absolute inset-x-0 top-[calc(100%+0.35rem)] z-[12] overflow-hidden rounded-[0.55rem] border border-[rgba(211,167,91,0.24)] bg-[#151611] p-[0.35rem] shadow-[0_1rem_2.5rem_rgba(0,0,0,0.45)]">
                    <small className="block px-2 py-[0.35rem] text-[0.58rem] tracking-[0.08em] text-[#777a72] uppercase">
                      Clientes encontrados
                    </small>
                    {customerSuggestions.data.data.map((customer) => (
                      <button
                        type="button"
                        key={customer.id}
                        onClick={() => {
                          setCustomerName(customer.name);
                          setCustomerPhone(customer.phone ?? '+351');
                          setCustomerSuggestionsOpen(false);
                        }}
                        className="grid w-full cursor-pointer grid-cols-[2rem_1fr_auto] items-center gap-[0.6rem] rounded-[0.4rem] border-0 bg-transparent p-[0.55rem] text-left text-[#eeeae1] hover:bg-[rgba(211,167,91,0.1)] [&_svg]:text-gold"
                      >
                        <UserAvatar
                          name={customer.name}
                          profileImageDataUrl={customer.profileImageDataUrl}
                        />
                        <span className="min-w-0">
                          <strong className="block min-w-0">{customer.name}</strong>
                          <small className="mt-[0.15rem] block min-w-0 text-[#858880]">
                            {customer.phone}
                          </small>
                        </span>
                        <Check size={16} />
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </label>
          </div>
          <label className={cn(bookingLabel, 'mt-4')}>
            Observações <small className="font-normal text-[#71746c]">Opcional</small>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              maxLength={500}
              placeholder="Alguma informação útil para a marcação?"
              className={cn(bookingInput, 'min-h-24 resize-y p-[0.85rem]')}
            />
          </label>
        </section>

        {formError && (
          <p
            className="m-0 rounded-lg border border-[rgba(177,79,79,0.28)] bg-[rgba(145,57,57,0.1)] px-4 py-[0.85rem] text-[0.74rem] text-[#e5a0a0]"
            role="alert"
          >
            {formError}
          </p>
        )}

        <footer className="flex justify-end gap-[0.7rem] pt-2 max-[620px]:sticky max-[620px]:bottom-0 max-[620px]:z-[5] max-[620px]:grid max-[620px]:grid-cols-[0.7fr_1.3fr] max-[620px]:bg-[rgba(8,9,7,0.94)] max-[620px]:py-[0.8rem] max-[620px]:backdrop-blur-[14px]">
          <button type="button" onClick={() => navigate(-1)} className={actionButton}>
            Cancelar
          </button>
          <button type="submit" disabled={creation.isPending} className={goldActionButton}>
            {creation.isPending ? (
              <>
                <LoaderCircle className="animate-spin" size={18} /> A criar...
              </>
            ) : (
              <>
                <Scissors size={18} /> Confirmar marcação
              </>
            )}
          </button>
        </footer>
      </form>
    </main>
  );
}
