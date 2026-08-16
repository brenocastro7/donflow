import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  CalendarCheck2,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Plus,
  RefreshCw,
  Sparkles,
  UserRound,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useStaffUser } from '../app/staff-context';
import { UserAvatar } from '../shared/components/user-avatar';
import {
  cancelAppointment,
  getAppointmentDetail,
  getAppointmentCalendar,
  getAvailability,
  getBarbers,
  getStoredAccessToken,
  rescheduleAppointment,
  updateAppointmentStatus,
  type AppointmentDetail,
  type CalendarAppointment,
  type CalendarView,
} from '../features/appointments/appointments-api';
import {
  getBusinessHours,
  getScheduleBlocks,
  type BusinessHour,
  type DayOfWeek,
  type ScheduleBlock,
} from '../features/settings/settings-api';
import { ApiError } from '../lib/api/api-error';
import { useOutsidePress } from '../shared/hooks/use-outside-press';
import { useRole } from '../shared/hooks/use-role';
import { cn } from '@/lib/utils';

const eyebrow = 'flex items-center gap-2 mb-[0.65rem] text-[0.68rem] font-bold uppercase text-gold-light';
const avatarBadge =
  'grid shrink-0 place-items-center rounded-full border border-[rgba(199,155,79,0.38)] bg-[#242017] font-bold text-gold-light';
const periodTabButton =
  'min-h-[2.3rem] min-w-[4.5rem] cursor-pointer rounded-[0.4rem] border-0 bg-transparent px-3 text-[0.76rem] text-muted max-[720px]:min-w-[3.75rem]';
const dateNavButton =
  'grid min-h-[2.3rem] min-w-[2.3rem] place-items-center cursor-pointer rounded-[0.4rem] border-0 bg-transparent text-[0.76rem] text-muted';

const viewOptions: Array<{ label: string; value: CalendarView }> = [
  { label: 'Dia', value: 'day' },
  { label: 'Semana', value: 'week' },
  { label: 'Mês', value: 'month' },
];

const SLOT_MINUTES = 15;
const DEFAULT_OPENING_MINUTE = 9 * 60;
const DEFAULT_CLOSING_MINUTE = 19 * 60;
const EMPTY_APPOINTMENTS: CalendarAppointment[] = [];
const EMPTY_BUSINESS_HOURS: BusinessHour[] = [];
const EMPTY_SCHEDULE_BLOCKS: ScheduleBlock[] = [];

function lisbonDateParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Lisbon',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function displayDate(date: string) {
  return new Intl.DateTimeFormat('pt-PT', {
    timeZone: 'Europe/Lisbon',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(`${date}T12:00:00Z`));
}

function moveDate(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function moveMonth(date: string, months: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(1);
  value.setUTCMonth(value.getUTCMonth() + months);
  return value.toISOString().slice(0, 10);
}

function localDateKey(value: string) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Lisbon',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value));
}

function startOfWeek(date: string) {
  const value = new Date(`${date}T12:00:00Z`);
  const mondayOffset = (value.getUTCDay() + 6) % 7;
  value.setUTCDate(value.getUTCDate() - mondayOffset);
  return value.toISOString().slice(0, 10);
}

function periodTitle(view: CalendarView, date: string) {
  if (view === 'month') {
    return new Intl.DateTimeFormat('pt-PT', {
      month: 'long',
      year: 'numeric',
    }).format(new Date(`${date}T12:00:00Z`));
  }
  if (view === 'week') {
    const start = startOfWeek(date);
    const end = moveDate(start, 6);
    const formatter = new Intl.DateTimeFormat('pt-PT', { day: 'numeric', month: 'short' });
    return `${formatter.format(new Date(`${start}T12:00:00Z`))} — ${formatter.format(new Date(`${end}T12:00:00Z`))}`;
  }
  return displayDate(date);
}

function timeInLisbon(value: string) {
  return new Intl.DateTimeFormat('pt-PT', {
    timeZone: 'Europe/Lisbon',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value));
}

function shortDateInLisbon(value: string) {
  return new Intl.DateTimeFormat('pt-PT', {
    timeZone: 'Europe/Lisbon',
    day: '2-digit',
    month: '2-digit',
  }).format(new Date(value));
}

function timelinePlacement(
  appointment: CalendarAppointment,
  openingMinute: number,
  totalSlots: number,
) {
  const [hour, minute] = timeInLisbon(appointment.startsAt).split(':').map(Number);
  const startMinute = hour * 60 + minute;
  const row = Math.max(1, Math.floor((startMinute - openingMinute) / SLOT_MINUTES) + 1);
  const span = Math.max(1, Math.ceil(appointment.durationSnapshot / SLOT_MINUTES));

  return {
    row: Math.min(row, totalSlots),
    span: Math.min(span, totalSlots - row + 1),
  };
}

/**
 * Assigns each item a column + column-count so appointments that overlap in
 * time (e.g. a cancelled slot and the new appointment that replaced it) are
 * laid out side by side instead of stacking on top of each other.
 */
function computeOverlapColumns(
  items: Array<{ id: string; row: number; span: number }>,
): Map<string, { column: number; columns: number }> {
  const layout = new Map<string, { column: number; columns: number }>();
  const sorted = [...items].sort((a, b) => a.row - b.row);
  let cluster: typeof sorted = [];
  let clusterEnd = -Infinity;

  const flushCluster = () => {
    if (!cluster.length) return;
    const columnEnds: number[] = [];
    const columnOf = new Map<string, number>();
    for (const item of cluster) {
      let column = columnEnds.findIndex((end) => end <= item.row);
      if (column === -1) {
        column = columnEnds.length;
        columnEnds.push(item.row + item.span);
      } else {
        columnEnds[column] = item.row + item.span;
      }
      columnOf.set(item.id, column);
    }
    const columns = columnEnds.length;
    for (const item of cluster) layout.set(item.id, { column: columnOf.get(item.id)!, columns });
    cluster = [];
    clusterEnd = -Infinity;
  };

  for (const item of sorted) {
    if (cluster.length && item.row >= clusterEnd) flushCluster();
    cluster.push(item);
    clusterEnd = Math.max(clusterEnd, item.row + item.span);
  }
  flushCluster();

  return layout;
}

function periodPlacement(
  startMinute: number,
  endMinute: number,
  openingMinute: number,
  closingMinute: number,
) {
  const clippedStart = Math.max(openingMinute, startMinute);
  const clippedEnd = Math.min(closingMinute, endMinute);
  const row = Math.floor((clippedStart - openingMinute) / SLOT_MINUTES) + 1;
  const span = Math.max(1, Math.ceil((clippedEnd - clippedStart) / SLOT_MINUTES));
  return { row, span };
}

function minuteInLisbon(value: string) {
  const [hour, minute] = timeInLisbon(value).split(':').map(Number);
  return hour * 60 + minute;
}

function toTimelineTime(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

function dayOfWeekForDate(date: string): DayOfWeek {
  return ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'][
    new Date(`${date}T12:00:00Z`).getUTCDay()
  ] as DayOfWeek;
}

function customerName(appointment: CalendarAppointment) {
  return appointment.customer?.name ?? appointment.localCustomerName ?? 'Cliente sem identificação';
}

function customerPhone(appointment: CalendarAppointment) {
  return appointment.customer?.phone ?? appointment.localCustomerPhone;
}

function statusLabel(status: CalendarAppointment['status']) {
  return {
    CONFIRMED: 'Confirmada',
    CANCELLED: 'Cancelada',
    COMPLETED: 'Concluída',
    NO_SHOW: 'Não compareceu',
  }[status];
}

function isCancelledStatus(appointment: CalendarAppointment) {
  return appointment.status === 'CANCELLED' || appointment.status === 'NO_SHOW';
}

export function AgendaPage() {
  const user = useStaffUser();
  const { isMaster } = useRole(user.role);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [view, setView] = useState<CalendarView>('day');
  const [selectedDate, setSelectedDate] = useState(
    () => searchParams.get('date') ?? lisbonDateParts(),
  );
  const [selectedBarberProfileId, setSelectedBarberProfileId] = useState(
    () =>
      (isMaster ? searchParams.get('barberProfileId') : null) ??
      user.barberProfileId ??
      '',
  );
  const [barberMenuOpen, setBarberMenuOpen] = useState(false);
  const barberSelectorRef = useOutsidePress<HTMLDivElement>(barberMenuOpen, () =>
    setBarberMenuOpen(false),
  );
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);
  const accessToken = getStoredAccessToken();

  const barbers = useQuery({
    queryKey: ['barbers', 'active'],
    queryFn: () => getBarbers(accessToken!),
    enabled: Boolean(accessToken && isMaster),
  });

  useEffect(() => {
    if (isMaster && !selectedBarberProfileId && barbers.data?.data.length) {
      setSelectedBarberProfileId(barbers.data.data[0].id);
    }
  }, [barbers.data?.data, selectedBarberProfileId, isMaster]);

  const calendar = useQuery({
    queryKey: ['appointments', view, selectedDate, selectedBarberProfileId],
    queryFn: () =>
      getAppointmentCalendar(accessToken!, view, selectedDate, selectedBarberProfileId),
    enabled: Boolean(accessToken && selectedBarberProfileId),
  });
  const scheduleHours = useQuery({
    queryKey: ['settings', 'hours', selectedBarberProfileId],
    queryFn: () => getBusinessHours(accessToken!, selectedBarberProfileId),
    enabled: Boolean(accessToken && selectedBarberProfileId),
  });
  const scheduleBlocks = useQuery({
    queryKey: ['settings', 'blocks', selectedBarberProfileId],
    queryFn: () => getScheduleBlocks(accessToken!, selectedBarberProfileId),
    enabled: Boolean(accessToken && selectedBarberProfileId),
  });

  const appointments = calendar.data?.data ?? EMPTY_APPOINTMENTS;
  const availableBarbers = barbers.data?.data ?? [];
  const selectedBarber = availableBarbers.find((barber) => barber.id === selectedBarberProfileId);
  const occupiedMinutes = useMemo(
    () =>
      appointments
        .filter((appointment) => appointment.status === 'CONFIRMED')
        .reduce((total, appointment) => total + appointment.durationSnapshot, 0),
    [appointments],
  );
  const nextAppointment = appointments.find(
    (appointment) =>
      appointment.status === 'CONFIRMED' && new Date(appointment.startsAt).getTime() > Date.now(),
  );

  const movePeriod = (direction: -1 | 1) => {
    if (view === 'month') {
      setSelectedDate((current) => moveMonth(current, direction));
      return;
    }
    setSelectedDate((current) => moveDate(current, (view === 'week' ? 7 : 1) * direction));
  };

  return (
    <main>
      <section
        className="relative flex min-h-[18.5rem] items-end justify-between overflow-hidden border-b border-border py-12 px-[clamp(2rem,5vw,5rem)] max-[720px]:min-h-[12.5rem] max-[720px]:px-5 max-[720px]:pt-8 max-[720px]:pb-[1.6rem]"
        aria-labelledby="agenda-title"
      >
        <div
          className="absolute inset-0 bg-[image:var(--barbershop-cover-admin)] bg-top bg-cover bg-no-repeat saturate-[0.68] contrast-[1.08]"
          aria-hidden="true"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(7,8,6,0.97),rgba(7,8,6,0.48)),linear-gradient(0deg,#080907,transparent_48%)]" />
        <div className="relative">
          <span className={eyebrow}>
            <Sparkles size={15} />
            Gestão da barbearia
          </span>
          <h1
            id="agenda-title"
            className="m-0 font-serif text-[clamp(3.25rem,6vw,5.6rem)] font-semibold leading-[0.9] max-[720px]:text-[3.4rem]"
          >
            Agenda
          </h1>
          <p className="mt-[0.8rem] mb-0 text-[#c3c1ba] max-[720px]:max-w-[17rem] max-[720px]:text-[0.78rem]">
            Organiza o teu dia e acompanha cada marcação.
          </p>
        </div>
        <blockquote className="relative mb-2 text-right font-serif text-[clamp(1.4rem,2.2vw,2rem)] italic leading-[1.15] text-gold-light max-[720px]:hidden">
          “Aparece pela curiosidade, permanece pela qualidade.”
        </blockquote>
      </section>

      <section className="mx-auto w-[min(100%,88rem)] pt-8 px-[clamp(1.25rem,4vw,4rem)] pb-16 max-[720px]:pt-[1.4rem] max-[720px]:px-4 max-[720px]:pb-8">
        <div className="flex items-center justify-between gap-4 max-[720px]:items-end">
          <div>
            <p className={eyebrow}>A tua agenda</p>
            <h2 className="m-0 text-[clamp(1.25rem,2vw,1.65rem)] max-[720px]:max-w-[12rem] max-[720px]:text-[1.15rem]">
              {periodTitle(view, selectedDate)}
            </h2>
          </div>
          <button
            className="inline-flex min-h-[2.9rem] cursor-pointer items-center gap-[0.6rem] rounded-[0.55rem] border border-gold-accent bg-[linear-gradient(135deg,#e0b96f,#a87934)] px-[1.2rem] text-[0.82rem] font-bold text-[#17130d] max-[720px]:w-[2.85rem] max-[720px]:min-w-[2.85rem] max-[720px]:justify-center max-[720px]:px-0"
            type="button"
            onClick={() => navigate('/appointments/new')}
          >
            <Plus size={18} />
            <span className="max-[720px]:hidden">Nova marcação</span>
          </button>
        </div>

        <div className="mt-[1.75rem] grid grid-cols-[auto_1fr_auto] items-center gap-4 rounded-[0.8rem] border border-border bg-[rgba(18,19,16,0.76)] p-3 max-[980px]:grid-cols-[auto_1fr] max-[720px]:mt-5 max-[720px]:grid-cols-1 max-[720px]:gap-[0.65rem] max-[720px]:border-0 max-[720px]:bg-transparent max-[720px]:p-0">
          <div
            className="flex rounded-[0.55rem] bg-[#090a08] p-1 max-[720px]:mx-auto max-[720px]:justify-self-center max-[720px]:border max-[720px]:border-border"
            role="group"
            aria-label="Período da agenda"
          >
            {viewOptions.map((option) => (
              <button
                className={cn(
                  periodTabButton,
                  view === option.value && 'bg-[rgba(200,154,75,0.15)] text-gold-light',
                )}
                type="button"
                key={option.value}
                onClick={() => setView(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="flex justify-center max-[720px]:mx-auto max-[720px]:justify-self-center max-[720px]:border max-[720px]:border-border">
            <button
              className={dateNavButton}
              type="button"
              aria-label="Período anterior"
              onClick={() => movePeriod(-1)}
            >
              <ChevronLeft size={18} />
            </button>
            <button
              className="mx-[0.35rem] flex min-h-[2.3rem] min-w-0 cursor-pointer items-center justify-center gap-[0.4rem] rounded-[0.4rem] border border-[rgba(200,154,75,0.42)] bg-[rgba(200,154,75,0.11)] px-[0.9rem] font-bold text-gold-light shadow-[inset_0_0_0_1px_rgba(200,154,75,0.04)] hover:border-[rgba(228,187,114,0.75)] hover:bg-[rgba(200,154,75,0.18)] max-[720px]:mx-0 max-[720px]:min-w-[2.35rem] max-[720px]:px-0"
              type="button"
              aria-label="Ir para hoje"
              onClick={() => {
                setSelectedDate(lisbonDateParts());
                setView('day');
              }}
            >
              <CalendarCheck2 size={16} className="max-[720px]:size-4" />
              <span className="max-[720px]:hidden">Hoje</span>
            </button>
            <button
              className={dateNavButton}
              type="button"
              aria-label="Período seguinte"
              onClick={() => movePeriod(1)}
            >
              <ChevronRight size={18} />
            </button>
          </div>
          {isMaster && (
            <div
              className="relative min-w-[12rem] max-[720px]:col-start-1 max-[720px]:w-full"
              ref={barberSelectorRef}
            >
              <button
                className="grid w-full min-w-[12rem] cursor-pointer grid-cols-[auto_1fr_auto] items-center gap-[0.65rem] rounded-[0.55rem] border border-border bg-[#0c0d0b] px-[0.55rem] py-[0.35rem] text-left text-text disabled:cursor-default disabled:opacity-100 max-[720px]:min-h-[3.2rem]"
                type="button"
                aria-haspopup="listbox"
                aria-expanded={barberMenuOpen}
                onClick={() => setBarberMenuOpen((current) => !current)}
              >
                <UserAvatar
                  className={cn(avatarBadge, 'size-8 text-[0.62rem]')}
                  name={selectedBarber?.displayName ?? 'DonFlow'}
                  profileImageDataUrl={selectedBarber?.user.profileImageDataUrl}
                />
                <span className="text-[0.76rem] font-semibold">
                  <small className="block text-muted text-[0.6rem] font-normal">Agenda de</small>
                  {barbers.isLoading
                    ? 'A carregar profissionais…'
                    : (selectedBarber?.displayName ?? 'Selecionar profissional')}
                </span>
                <ChevronDown
                  className={cn(
                    'transition-transform duration-150',
                    barberMenuOpen && 'rotate-180',
                  )}
                  size={17}
                />
              </button>

              {barberMenuOpen && (
                <div
                  className="absolute z-20 top-[calc(100%+0.45rem)] right-0 w-[max(100%,15rem)] overflow-hidden rounded-[0.65rem] border border-[rgba(198,151,74,0.3)] bg-panel p-[0.35rem] shadow-[0_1rem_2.5rem_rgba(0,0,0,0.48)] max-[720px]:right-auto max-[720px]:left-0 max-[720px]:w-full"
                  role="listbox"
                  aria-label="Agendas"
                >
                  {barbers.isLoading ? (
                    <div className="flex min-h-[3.2rem] w-full items-center justify-center gap-[0.45rem] p-[0.65rem] text-center text-[0.68rem] text-muted">
                      <RefreshCw className="animate-spin" size={15} />A carregar profissionais…
                    </div>
                  ) : barbers.isError ? (
                    <button
                      className="flex min-h-[3.2rem] w-full cursor-pointer items-center justify-center gap-[0.45rem] border-0 bg-transparent p-[0.65rem] text-center text-[0.68rem] text-gold-light"
                      type="button"
                      onClick={() => void barbers.refetch()}
                    >
                      Não foi possível carregar. Tentar novamente
                    </button>
                  ) : availableBarbers.length === 0 ? (
                    <div className="flex min-h-[3.2rem] w-full items-center justify-center gap-[0.45rem] p-[0.65rem] text-center text-[0.68rem] text-muted">
                      Não existem profissionais ativos.
                    </div>
                  ) : (
                    availableBarbers.map((barber) => {
                      const isSelected = barber.id === selectedBarberProfileId;
                      return (
                        <button
                          className={cn(
                            'grid w-full cursor-pointer grid-cols-[auto_1fr_auto] items-center gap-[0.65rem] rounded-[0.45rem] border-0 bg-transparent p-[0.55rem] text-left text-text hover:bg-[rgba(198,151,74,0.12)]',
                            isSelected && 'bg-[rgba(198,151,74,0.12)]',
                          )}
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          key={barber.id}
                          onClick={() => {
                            setSelectedBarberProfileId(barber.id);
                            setSelectedAppointmentId(null);
                            setBarberMenuOpen(false);
                          }}
                        >
                          <UserAvatar
                            className={cn(avatarBadge, 'size-8 text-[0.62rem]')}
                            name={barber.displayName}
                            profileImageDataUrl={barber.user.profileImageDataUrl}
                          />
                          <span>
                            <strong className="block text-[0.74rem]">{barber.displayName}</strong>
                            <small className="mt-[0.15rem] block text-[0.6rem] text-muted">
                              {barber.id === user.barberProfileId
                                ? 'A minha agenda'
                                : 'Agenda disponível'}
                            </small>
                          </span>
                          {isSelected && <CalendarCheck2 size={16} className="text-gold-light" />}
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div
          className="mt-[0.85rem] mb-6 grid grid-cols-3 gap-3 max-[720px]:mt-3 max-[720px]:mb-[1.2rem] max-[720px]:gap-[0.45rem]"
          aria-label="Resumo do dia"
        >
          <div className="flex min-h-14 items-center gap-[0.7rem] rounded-[0.65rem] border border-border bg-[rgba(17,18,15,0.5)] px-4 text-[0.76rem] text-muted max-[720px]:min-h-[4.5rem] max-[720px]:flex-col max-[720px]:items-start max-[720px]:justify-center max-[720px]:gap-[0.35rem] max-[720px]:p-[0.55rem] max-[720px]:text-[0.62rem] max-[720px]:leading-[1.25]">
            <CalendarDays size={18} className="text-gold-light" />
            <span className="max-[720px]:min-w-0 max-[720px]:[overflow-wrap:anywhere]">
              <strong className="text-gold-light">{appointments.length}</strong> marcações
            </span>
          </div>
          <div className="flex min-h-14 items-center gap-[0.7rem] rounded-[0.65rem] border border-border bg-[rgba(17,18,15,0.5)] px-4 text-[0.76rem] text-muted max-[720px]:min-h-[4.5rem] max-[720px]:flex-col max-[720px]:items-start max-[720px]:justify-center max-[720px]:gap-[0.35rem] max-[720px]:p-[0.55rem] max-[720px]:text-[0.62rem] max-[720px]:leading-[1.25]">
            <Clock3 size={18} className="text-gold-light" />
            <span className="max-[720px]:min-w-0 max-[720px]:[overflow-wrap:anywhere]">
              <strong className="text-gold-light">
                {Math.floor(occupiedMinutes / 60)}h{occupiedMinutes % 60 || ''}
              </strong>{' '}
              ocupadas
            </span>
          </div>
          <div className="flex min-h-14 items-center gap-[0.7rem] rounded-[0.65rem] border border-border bg-[rgba(17,18,15,0.5)] px-4 text-[0.76rem] text-muted max-[720px]:min-h-[4.5rem] max-[720px]:flex-col max-[720px]:items-start max-[720px]:justify-center max-[720px]:gap-[0.35rem] max-[720px]:p-[0.55rem] max-[720px]:text-[0.62rem] max-[720px]:leading-[1.25]">
            <UserRound size={18} className="text-gold-light" />
            <span className="max-[720px]:min-w-0 max-[720px]:[overflow-wrap:anywhere]">
              {nextAppointment ? (
                <>
                  {view === 'day' ? (
                    <>
                      Próxima às{' '}
                      <strong className="text-gold-light">
                        {timeInLisbon(nextAppointment.startsAt)}
                      </strong>
                    </>
                  ) : (
                    <>
                      Próxima em{' '}
                      <strong className="text-gold-light">
                        {shortDateInLisbon(nextAppointment.startsAt)}
                      </strong>{' '}
                      às{' '}
                      <strong className="text-gold-light">
                        {timeInLisbon(nextAppointment.startsAt)}
                      </strong>
                    </>
                  )}
                </>
              ) : (
                'Sem próxima marcação'
              )}
            </span>
          </div>
        </div>

        {!accessToken ? (
          <AgendaState
            icon={<UserRound />}
            title="Inicia sessão para consultar a agenda"
            description="As marcações reais aparecerão aqui após a autenticação da conta."
          />
        ) : calendar.isLoading ? (
          <AgendaState
            icon={<RefreshCw className="animate-spin" />}
            title="A carregar agenda"
            description="Estamos a consultar as marcações deste período."
          />
        ) : calendar.isError ? (
          <AgendaState
            icon={<AlertCircle />}
            title="Não foi possível carregar a agenda"
            description="Confirma a sessão e a ligação à API e tenta novamente."
            action={
              <button
                type="button"
                onClick={() => void calendar.refetch()}
                className="mt-4 cursor-pointer rounded-[0.45rem] border border-[rgba(200,154,75,0.35)] bg-[rgba(200,154,75,0.08)] px-4 py-[0.65rem] text-gold-light"
              >
                Tentar novamente
              </button>
            }
          />
        ) : view === 'week' ? (
          <WeeklyAgenda
            appointments={appointments}
            selectedDate={selectedDate}
            onSelectAppointment={setSelectedAppointmentId}
            onSelectDay={(date) => {
              setSelectedDate(date);
              setView('day');
            }}
          />
        ) : view === 'month' ? (
          <MonthlyAgenda
            appointments={appointments}
            selectedDate={selectedDate}
            onSelectDay={(date) => {
              setSelectedDate(date);
              setView('day');
            }}
          />
        ) : (
          <DayTimeline
            appointments={appointments}
            businessHours={scheduleHours.data?.data ?? EMPTY_BUSINESS_HOURS}
            scheduleBlocks={scheduleBlocks.data?.data ?? EMPTY_SCHEDULE_BLOCKS}
            selectedDate={selectedDate}
            onSelectAppointment={setSelectedAppointmentId}
          />
        )}
      </section>

      {selectedAppointmentId && accessToken && (
        <AppointmentDialog
          appointmentId={selectedAppointmentId}
          accessToken={accessToken}
          onClose={() => setSelectedAppointmentId(null)}
          onChanged={async () => {
            await queryClient.invalidateQueries({ queryKey: ['appointments'] });
          }}
        />
      )}
    </main>
  );
}

function DayTimeline({
  appointments,
  businessHours,
  scheduleBlocks,
  selectedDate,
  onSelectAppointment,
}: {
  appointments: CalendarAppointment[];
  businessHours: BusinessHour[];
  scheduleBlocks: ScheduleBlock[];
  selectedDate: string;
  onSelectAppointment: (appointmentId: string) => void;
}) {
  const dayHours = businessHours
    .filter((hour) => hour.dayOfWeek === dayOfWeekForDate(selectedDate))
    .sort((left, right) => left.startMinute - right.startMinute);
  const openingMinute = dayHours[0]?.startMinute ?? DEFAULT_OPENING_MINUTE;
  const closingMinute = dayHours.at(-1)?.endMinute ?? DEFAULT_CLOSING_MINUTE;
  const totalSlots = Math.max(1, Math.ceil((closingMinute - openingMinute) / SLOT_MINUTES));
  const timelineStyle = { '--timeline-slots': totalSlots } as CSSProperties;
  const slots = Array.from({ length: totalSlots }, (_, index) => {
    const minutes = openingMinute + index * SLOT_MINUTES;
    return toTimelineTime(minutes);
  });
  const configuredLunchPeriods = dayHours.slice(0, -1).flatMap((period, index) => {
    const next = dayHours[index + 1];
    return period.endMinute < next.startMinute
      ? [{ startMinute: period.endMinute, endMinute: next.startMinute }]
      : [];
  });
  const visibleBlocks = scheduleBlocks.filter(
    (block) =>
      localDateKey(block.startsAt) <= selectedDate && localDateKey(block.endsAt) >= selectedDate,
  );
  const displayBlocks = visibleBlocks.flatMap((block) => {
    const startsOnDate = localDateKey(block.startsAt) === selectedDate;
    const endsOnDate = localDateKey(block.endsAt) === selectedDate;
    const startMinute = startsOnDate ? minuteInLisbon(block.startsAt) : openingMinute;
    const endMinute = endsOnDate ? minuteInLisbon(block.endsAt) : closingMinute;
    return endMinute <= openingMinute || startMinute >= closingMinute
      ? []
      : [{ block, startMinute, endMinute }];
  });
  const lunchPeriods = configuredLunchPeriods.filter(
    (lunch) =>
      !displayBlocks.some(
        ({ startMinute, endMinute }) =>
          startMinute < lunch.endMinute && endMinute > lunch.startMinute,
      ),
  );
  const hasFullDayBlock = displayBlocks.some(
    ({ startMinute, endMinute }) => startMinute <= openingMinute && endMinute >= closingMinute,
  );

  const appointmentPlacements = appointments.map((appointment) => ({
    appointment,
    placement: timelinePlacement(appointment, openingMinute, totalSlots),
  }));
  // A cancelled slot is only worth showing when nothing new was booked into it —
  // once a replacement appointment covers the same time range, the cancelled one hides.
  const visibleAppointmentPlacements = appointmentPlacements.filter(({ appointment, placement }) => {
    if (!isCancelledStatus(appointment)) return true;
    const hasReplacement = appointmentPlacements.some(
      ({ appointment: other, placement: otherPlacement }) =>
        other.id !== appointment.id &&
        !isCancelledStatus(other) &&
        otherPlacement.row < placement.row + placement.span &&
        otherPlacement.row + otherPlacement.span > placement.row,
    );
    return !hasReplacement;
  });
  const overlapLayout = computeOverlapColumns(
    visibleAppointmentPlacements.map(({ appointment, placement }) => ({
      id: appointment.id,
      row: placement.row,
      span: placement.span,
    })),
  );

  return (
    <section
      className="overflow-hidden rounded-[0.9rem] border border-border bg-[rgba(14,15,13,0.82)]"
      aria-label={`Agenda diária das ${toTimelineTime(openingMinute)} às ${toTimelineTime(closingMinute)}`}
    >
      <div className="grid grid-cols-[6.5rem_1fr] border-b border-border px-4 py-[0.8rem] text-[0.64rem] tracking-[0.12em] text-[#70736b] uppercase max-[720px]:grid-cols-[4rem_1fr] max-[720px]:px-0 max-[720px]:[&>span:first-child]:pl-[0.55rem] max-[720px]:[&>span:last-child]:pl-3">
        <span>Horário</span>
        <span>Marcações do dia</span>
      </div>
      <div className="grid grid-cols-[6.5rem_1fr] px-4 pb-4 max-[720px]:grid-cols-[4rem_minmax(0,1fr)] max-[720px]:py-0 max-[720px]:pr-2 max-[720px]:pb-3 max-[720px]:pl-0">
        <div
          className="relative grid grid-rows-[repeat(var(--timeline-slots,40),1.4rem)] max-[720px]:grid-rows-[repeat(var(--timeline-slots,40),1.625rem)] max-[720px]:[&>span]:pr-[0.65rem] max-[720px]:[&>span]:text-right"
          aria-hidden="true"
          style={timelineStyle}
        >
          {slots.map((time, index) => (
            <span key={time} className="pt-[0.55rem] text-[0.68rem] text-[#676a63]">
              {index % 2 === 0 ? time : ''}
            </span>
          ))}
          <span className="absolute -bottom-[0.35rem] pt-[0.55rem] text-[0.68rem] text-[#676a63]">
            {toTimelineTime(closingMinute)}
          </span>
        </div>
        <div
          className="relative [--row-h:1.4rem] bg-[image:repeating-linear-gradient(to_bottom,transparent_0,transparent_calc(2.8rem-1px),rgba(255,255,255,0.055)_calc(2.8rem-1px),rgba(255,255,255,0.055)_2.8rem)] bg-[size:100%_2.8rem] max-[720px]:[--row-h:1.625rem] max-[720px]:bg-[image:repeating-linear-gradient(to_bottom,transparent_0,transparent_calc(3.25rem-1px),rgba(255,255,255,0.055)_calc(3.25rem-1px),rgba(255,255,255,0.055)_3.25rem)] max-[720px]:bg-[size:100%_3.25rem]"
          style={{ ...timelineStyle, height: `calc(var(--timeline-slots) * var(--row-h))` }}
        >
          {lunchPeriods.map((lunch) => {
            const placement = periodPlacement(
              lunch.startMinute,
              lunch.endMinute,
              openingMinute,
              closingMinute,
            );
            return (
              <div
                className="absolute inset-x-0 z-[1] flex items-center justify-center gap-[0.55rem] rounded-lg border border-dashed border-[rgba(226,216,195,0.13)] bg-[image:repeating-linear-gradient(-45deg,rgba(255,255,255,0.018),rgba(255,255,255,0.018)_8px,transparent_8px,transparent_16px)] bg-[#0b0c0a] text-[0.72rem] tracking-[0.08em] text-[#777a72] uppercase max-[720px]:mx-[0.35rem] max-[720px]:flex-col max-[720px]:gap-[0.4rem] max-[720px]:px-[0.4rem] max-[720px]:py-[0.55rem] max-[720px]:text-center max-[720px]:leading-[1.25]"
                key={`${lunch.startMinute}-${lunch.endMinute}`}
                style={{
                  top: `calc(var(--row-h) * ${placement.row - 1} + 0.09rem)`,
                  height: `calc(var(--row-h) * ${placement.span} - 0.18rem)`,
                }}
              >
                <Clock3 size={16} />
                <span>Intervalo de almoço</span>
                <small className="text-[0.62rem] text-[#5d6059]">
                  {toTimelineTime(lunch.startMinute)}–{toTimelineTime(lunch.endMinute)}
                </small>
              </div>
            );
          })}
          {displayBlocks.map(({ block, startMinute, endMinute }) => {
            const placement = periodPlacement(startMinute, endMinute, openingMinute, closingMinute);
            return (
              <div
                className="absolute inset-x-0 z-[2] flex min-h-0 items-center justify-center gap-[0.55rem] overflow-hidden rounded-lg border border-dashed border-[rgba(192,118,85,0.28)] bg-[image:repeating-linear-gradient(-45deg,rgba(192,118,85,0.045),rgba(192,118,85,0.045)_8px,transparent_8px,transparent_16px)] bg-[#100c0a] px-[0.65rem] py-[0.35rem] text-center text-[0.7rem] tracking-[0.05em] text-[#c2957e] uppercase"
                key={block.id}
                style={{
                  top: `calc(var(--row-h) * ${placement.row - 1} + 0.09rem)`,
                  height: `calc(var(--row-h) * ${placement.span} - 0.18rem)`,
                }}
              >
                <CalendarDays size={16} />
                <span>Encerrado{block.reason ? ` devido a: ${block.reason}` : ''}</span>
                <small className="shrink-0 text-[0.6rem] text-[#80665a]">
                  {toTimelineTime(Math.max(startMinute, openingMinute))}–
                  {toTimelineTime(Math.min(endMinute, closingMinute))}
                </small>
              </div>
            );
          })}
          {visibleAppointmentPlacements.map(({ appointment, placement }) => {
            const name = customerName(appointment);
            const isCompact = appointment.durationSnapshot <= SLOT_MINUTES;
            const isShort = !isCompact && appointment.durationSnapshot <= 30;
            const status = appointment.status.toLowerCase();
            const isCancelledLike = status === 'cancelled' || status === 'no_show';
            const isCompleted = status === 'completed';
            const overlap = overlapLayout.get(appointment.id) ?? { column: 0, columns: 1 };
            const gapRem = overlap.columns > 1 ? 0.375 : 0;
            const width = `calc((100% - ${(overlap.columns - 1) * gapRem}rem) / ${overlap.columns})`;
            const left =
              overlap.column === 0
                ? '0px'
                : `calc((${width}) * ${overlap.column} + ${overlap.column * gapRem}rem)`;
            return (
              <button
                className={cn(
                  'absolute z-[2] grid min-h-0 cursor-pointer grid-cols-[auto_minmax(8rem,1.3fr)_minmax(8rem,1fr)_auto_auto] items-center gap-[0.85rem] overflow-hidden rounded-[0.55rem] border border-[rgba(198,151,74,0.25)] border-l-[3px] border-l-[#c6974a] bg-[linear-gradient(90deg,rgba(198,151,74,0.16),#171815_38%)] px-[0.85rem] py-[0.55rem] text-left text-text',
                  'max-[720px]:grid-cols-[minmax(0,0.85fr)_minmax(0,1fr)_auto_auto_auto] max-[720px]:items-center max-[720px]:gap-[0.35rem] max-[720px]:px-[0.4rem] max-[720px]:py-[0.28rem]',
                  '[&_strong]:block [&_strong]:text-[0.8rem] [&_small]:mt-1 [&_small]:block [&_small]:text-[0.66rem] [&_small]:font-normal [&_small]:text-muted',
                  isCancelledLike && 'border-l-[#9a5867] opacity-[0.62]',
                  isCompleted && 'border-l-[#5a8a6a]',
                  isShort &&
                    'items-center gap-[0.6rem] py-[0.35rem] [&_strong]:leading-[1.05] [&_small]:leading-[1.05] max-[720px]:[&_strong]:leading-none max-[720px]:[&_small]:leading-none',
                  isCompact &&
                    'grid-cols-[minmax(5rem,1fr)_minmax(5rem,0.85fr)_auto_auto] items-center gap-[0.45rem] rounded-[0.35rem] py-0 px-[0.55rem] max-[720px]:grid-cols-[minmax(0,0.85fr)_minmax(0,1fr)_auto_auto_auto] max-[720px]:gap-[0.3rem] max-[720px]:px-[0.35rem]',
                )}
                type="button"
                key={appointment.id}
                style={{
                  top: `calc(var(--row-h) * ${placement.row - 1} + 0.09rem)`,
                  height: `calc(var(--row-h) * ${placement.span} - 0.18rem)`,
                  left,
                  width,
                }}
                title={`${timeInLisbon(appointment.startsAt)}–${timeInLisbon(appointment.endsAt)} · ${name} · ${appointment.serviceNameSnapshot} · ${statusLabel(appointment.status)}`}
                onClick={() => onSelectAppointment(appointment.id)}
              >
                <UserAvatar
                  className={cn(
                    avatarBadge,
                    'size-[2.4rem] text-[0.7rem] text-[#e6e2d9] max-[720px]:hidden',
                    isShort && 'size-[1.7rem] self-center justify-self-center',
                    isCompact && 'hidden',
                  )}
                  name={name}
                  profileImageDataUrl={appointment.customer?.profileImageDataUrl}
                />
                <span
                  className={cn(
                    'max-[720px]:col-start-1 max-[720px]:row-start-1 max-[720px]:min-w-0 max-[720px]:overflow-hidden max-[720px]:text-ellipsis max-[720px]:whitespace-nowrap max-[720px]:[&>small]:hidden max-[720px]:[&>strong]:text-[0.7rem]',
                    isCompact &&
                      'min-w-0 overflow-hidden text-ellipsis whitespace-nowrap [&>small]:hidden [&>strong]:text-[0.66rem]',
                  )}
                >
                  <strong>{name}</strong>
                  <small>{customerPhone(appointment) ?? 'Sem telemóvel'}</small>
                </span>
                <span
                  className={cn(
                    'max-[720px]:contents',
                    'max-[720px]:[&>strong]:col-start-2 max-[720px]:[&>strong]:row-start-1 max-[720px]:[&>strong]:m-0 max-[720px]:[&>strong]:block max-[720px]:[&>strong]:overflow-hidden max-[720px]:[&>strong]:text-center max-[720px]:[&>strong]:text-[0.6rem] max-[720px]:[&>strong]:text-ellipsis max-[720px]:[&>strong]:whitespace-nowrap',
                    'max-[720px]:[&>small]:col-start-3 max-[720px]:[&>small]:row-start-1 max-[720px]:[&>small]:m-0 max-[720px]:[&>small]:block max-[720px]:[&>small]:text-right max-[720px]:[&>small]:text-[0.6rem] max-[720px]:[&>small]:whitespace-nowrap',
                    isCompact && 'flex items-center gap-[0.4rem] [&>strong]:text-[0.66rem] [&>small]:m-0 [&>small]:text-[0.61rem] [&>small]:whitespace-nowrap',
                  )}
                >
                  <strong>{appointment.serviceNameSnapshot}</strong>
                  <small>
                    {timeInLisbon(appointment.startsAt)}–{timeInLisbon(appointment.endsAt)}
                  </small>
                </span>
                <span
                  className={cn(
                    'rounded-2xl bg-[rgba(60,121,75,0.14)] px-[0.6rem] py-[0.35rem] text-[0.62rem] text-[#7fc18f] max-[720px]:sr-only',
                    isCompact && 'px-[0.4rem] py-[0.14rem] text-[0.57rem]',
                  )}
                >
                  {statusLabel(appointment.status)}
                </span>
                <span
                  aria-hidden="true"
                  className={cn(
                    'hidden max-[720px]:col-start-4 max-[720px]:row-start-1 max-[720px]:block max-[720px]:size-[0.55rem] max-[720px]:justify-self-center max-[720px]:rounded-full max-[720px]:border max-[720px]:border-[rgba(127,193,143,0.5)] max-[720px]:bg-[#4f9b63] max-[720px]:shadow-[0_0_0_3px_rgba(79,155,99,0.12)]',
                    isCompleted &&
                      'max-[720px]:border-[rgba(224,196,90,0.5)] max-[720px]:bg-[#d3a75b] max-[720px]:shadow-[0_0_0_3px_rgba(211,167,91,0.12)]',
                    isCancelledLike &&
                      'max-[720px]:border-[rgba(207,112,126,0.5)] max-[720px]:bg-[#9a5867] max-[720px]:shadow-[0_0_0_3px_rgba(154,88,103,0.12)]',
                  )}
                />
                <ChevronRight
                  size={18}
                  className={cn(
                    'max-[720px]:col-start-5 max-[720px]:row-start-1 max-[720px]:size-[14px]',
                    isCompact ? 'max-[720px]:block' : '',
                  )}
                />
              </button>
            );
          })}
          {appointments.length === 0 && !hasFullDayBlock && (
            <p className="absolute inset-0 m-0 flex items-center justify-center text-center text-[0.8rem] text-muted max-[720px]:mx-auto max-[720px]:max-w-[14rem] max-[720px]:p-[0.8rem] max-[720px]:leading-[1.45]">
              Não existem marcações para este dia.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function AppointmentDialog({
  appointmentId,
  accessToken,
  onClose,
  onChanged,
}: {
  appointmentId: string;
  accessToken: string;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const [mode, setMode] = useState<'details' | 'cancel' | 'reschedule' | 'no-show'>('details');
  const [reason, setReason] = useState('');
  const [noShowJustification, setNoShowJustification] = useState('');
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [selectedStart, setSelectedStart] = useState('');

  const detail = useQuery({
    queryKey: ['appointment-detail', appointmentId],
    queryFn: () => getAppointmentDetail(accessToken, appointmentId),
  });
  const appointment = detail.data?.data;

  useEffect(() => {
    if (appointment && !rescheduleDate) {
      setRescheduleDate(localDateKey(appointment.startsAt));
    }
  }, [appointment, rescheduleDate]);

  const availability = useQuery({
    queryKey: [
      'appointment-reschedule-availability',
      appointment?.barberProfile.id,
      appointment?.barberService.id,
      rescheduleDate,
    ],
    queryFn: () =>
      getAvailability(
        accessToken,
        appointment!.barberProfile.id,
        appointment!.barberService.id,
        rescheduleDate,
      ),
    enabled: Boolean(
      mode === 'reschedule' && appointment?.barberService.isActive && rescheduleDate,
    ),
  });

  useEffect(() => setSelectedStart(''), [rescheduleDate]);

  const cancelMutation = useMutation({
    mutationFn: () => cancelAppointment(accessToken, appointmentId, reason),
    onSuccess: async () => {
      await onChanged();
      onClose();
    },
  });

  const rescheduleMutation = useMutation({
    mutationFn: () => rescheduleAppointment(accessToken, appointmentId, selectedStart),
    onSuccess: async () => {
      await onChanged();
      onClose();
    },
  });

  const noShowMutation = useMutation({
    mutationFn: () =>
      updateAppointmentStatus(accessToken, appointmentId, 'NO_SHOW', noShowJustification),
    onSuccess: async () => {
      await onChanged();
      onClose();
    },
  });

  const mutationError = cancelMutation.error ?? rescheduleMutation.error ?? noShowMutation.error;
  const errorMessage =
    mutationError instanceof ApiError
      ? mutationError.message
      : mutationError
        ? 'Não foi possível concluir a alteração.'
        : null;

  const dialogButton =
    'rounded-lg border border-border px-[0.9rem] py-[0.7rem] text-text bg-transparent cursor-pointer disabled:cursor-not-allowed disabled:opacity-45 max-[720px]:min-h-[2.35rem] max-[720px]:flex-none max-[720px]:px-[0.7rem] max-[720px]:text-[0.68rem]';
  const dialogPrimaryButton = cn(dialogButton, 'border-gold text-[#151006] bg-gold-light');
  const dialogCancelButton = cn(dialogButton, 'border-[rgba(190,80,80,0.45)] text-[#e6a1a1]');
  const dialogDangerButton = cn(dialogCancelButton, 'bg-[rgba(132,38,38,0.22)]');
  const dialogFieldInput =
    'w-full rounded-lg border border-border bg-[#0a0b09] p-3 text-text outline-0 [color-scheme:dark] font-[inherit]';

  return (
    <div
      className="fixed inset-0 z-40 grid place-items-center bg-[rgba(2,3,2,0.78)] p-5 backdrop-blur-[7px]"
      role="presentation"
    >
      <section
        className="w-[min(34rem,100%)] max-h-[min(46rem,calc(100vh-2.5rem))] overflow-y-auto rounded-[0.9rem] border border-[rgba(198,151,74,0.28)] bg-[linear-gradient(145deg,#181915,#0d0e0c_70%)] shadow-[0_1.5rem_5rem_rgba(0,0,0,0.55)] max-[720px]:w-[min(100%,32rem)] max-[720px]:max-h-[calc(100dvh-2rem)] max-[720px]:rounded-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="appointment-dialog-title"
      >
        <header className="flex items-start justify-between border-b border-border px-[1.35rem] pt-5 pb-4">
          <div>
            <span className="text-[0.62rem] tracking-[0.13em] text-gold uppercase">
              Gestão da marcação
            </span>
            <h2 id="appointment-dialog-title" className="mt-1 font-[Georgia,serif] text-[1.35rem]">
              {mode === 'cancel'
                ? 'Cancelar marcação'
                : mode === 'reschedule'
                  ? 'Reagendar marcação'
                  : mode === 'no-show'
                    ? 'Registar falta'
                    : 'Detalhes da marcação'}
            </h2>
          </div>
          <button
            type="button"
            aria-label="Fechar detalhes"
            onClick={onClose}
            className="grid size-[2.15rem] cursor-pointer place-items-center rounded-full border border-border bg-transparent text-muted"
          >
            <X size={19} />
          </button>
        </header>

        {detail.isLoading ? (
          <div className="flex min-h-[14rem] items-center justify-center gap-[0.7rem] text-muted">
            <RefreshCw className="animate-spin" />
            <span>A carregar detalhes…</span>
          </div>
        ) : detail.isError || !appointment ? (
          <div className="flex min-h-[14rem] items-center justify-center gap-[0.7rem] text-[#e49a9a]">
            <AlertCircle />
            <span>Não foi possível carregar esta marcação.</span>
          </div>
        ) : (
          <>
            <AppointmentDialogSummary appointment={appointment} />

            {mode === 'cancel' && (
              <div className="border-t border-border px-[1.35rem] py-[1.15rem]">
                <label className="grid gap-[0.45rem] text-[0.73rem] font-semibold text-[#d9d7d0]">
                  Motivo do cancelamento{' '}
                  <span className="text-[0.65rem] font-normal text-muted">(opcional)</span>
                  <textarea
                    maxLength={500}
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    placeholder="Adiciona uma observação ao histórico"
                    className={cn(dialogFieldInput, 'min-h-[5.5rem] resize-y')}
                  />
                </label>
                <p className="mt-[0.45rem] text-[0.65rem] font-normal text-muted">
                  Esta ação liberta imediatamente o horário na agenda.
                </p>
              </div>
            )}

            {mode === 'reschedule' && (
              <div className="border-t border-border px-[1.35rem] py-[1.15rem]">
                <label className="grid gap-[0.45rem] text-[0.73rem] font-semibold text-[#d9d7d0]">
                  Nova data
                  <input
                    type="date"
                    min={lisbonDateParts()}
                    value={rescheduleDate}
                    onChange={(event) => setRescheduleDate(event.target.value)}
                    className={dialogFieldInput}
                  />
                </label>
                {!appointment.barberService.isActive ? (
                  <p className="mt-[0.45rem] text-[0.7rem] text-[#e49a9a]">
                    Este serviço está inativo e não pode ser reagendado.
                  </p>
                ) : availability.isLoading ? (
                  <p className="mt-[0.45rem] text-[0.65rem] font-normal text-muted">
                    A consultar horários disponíveis…
                  </p>
                ) : (
                  <div className="mt-[0.85rem] grid grid-cols-4 gap-2 max-[720px]:grid-cols-3">
                    {availability.data?.data.slots.map((slot) => (
                      <button
                        className={cn(
                          'cursor-pointer rounded-[0.45rem] border border-border bg-panel px-[0.35rem] py-[0.55rem] text-text',
                          selectedStart === slot.startsAt &&
                            'border-gold bg-gold-light text-[#120e07]',
                        )}
                        type="button"
                        key={slot.startsAt}
                        onClick={() => setSelectedStart(slot.startsAt)}
                      >
                        {timeInLisbon(slot.startsAt)}
                      </button>
                    ))}
                    {availability.data?.data.slots.length === 0 && (
                      <p className="col-span-full text-[0.65rem] font-normal text-muted">
                        Não existem horários disponíveis nesta data.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {mode === 'no-show' && (
              <div className="border-t border-border px-[1.35rem] py-[1.15rem]">
                <label className="grid gap-[0.45rem] text-[0.73rem] font-semibold text-[#d9d7d0]">
                  Justificação{' '}
                  <span className="text-[0.65rem] font-normal text-muted">(opcional)</span>
                  <textarea
                    maxLength={500}
                    value={noShowJustification}
                    onChange={(event) => setNoShowJustification(event.target.value)}
                    placeholder="Indica a justificação apresentada pelo cliente"
                    className={cn(dialogFieldInput, 'min-h-[5.5rem] resize-y')}
                  />
                </label>
                <p className="mt-[0.45rem] text-[0.65rem] font-normal text-muted">
                  Sem justificação, a próxima marcação terá de ser feita por um profissional e o
                  cliente ficará limitado a uma marcação ativa.
                </p>
              </div>
            )}

            {errorMessage && (
              <p className="mx-[1.35rem] mb-4 text-[0.7rem] text-[#e49a9a]" role="alert">
                {errorMessage}
              </p>
            )}

            <footer className="flex justify-end gap-[0.65rem] border-t border-border px-[1.35rem] pt-4 pb-5 max-[720px]:sticky max-[720px]:bottom-0 max-[720px]:flex-wrap max-[720px]:bg-[#0d0e0c] max-[720px]:px-4 max-[720px]:pt-3 max-[720px]:pb-[0.9rem]">
              {mode === 'details' ? (
                <>
                  <button
                    className={dialogCancelButton}
                    type="button"
                    disabled={
                      appointment.status !== 'CONFIRMED' &&
                      !(appointment.status === 'COMPLETED' && appointment.autoCompletedAt)
                    }
                    onClick={() => setMode('no-show')}
                  >
                    Ausente
                  </button>
                  <button
                    className={dialogCancelButton}
                    type="button"
                    disabled={appointment.status !== 'CONFIRMED'}
                    onClick={() => setMode('cancel')}
                  >
                    Cancelar
                  </button>
                  <button
                    className={dialogPrimaryButton}
                    type="button"
                    disabled={appointment.status !== 'CONFIRMED'}
                    onClick={() => setMode('reschedule')}
                  >
                    Reagendar
                  </button>
                </>
              ) : (
                <>
                  <button className={dialogButton} type="button" onClick={() => setMode('details')}>
                    Voltar
                  </button>
                  {mode === 'cancel' ? (
                    <button
                      className={dialogDangerButton}
                      type="button"
                      disabled={cancelMutation.isPending}
                      onClick={() => cancelMutation.mutate()}
                    >
                      {cancelMutation.isPending ? 'A cancelar…' : 'Confirmar cancelamento'}
                    </button>
                  ) : mode === 'reschedule' ? (
                    <button
                      className={dialogPrimaryButton}
                      type="button"
                      disabled={!selectedStart || rescheduleMutation.isPending}
                      onClick={() => rescheduleMutation.mutate()}
                    >
                      {rescheduleMutation.isPending ? 'A reagendar…' : 'Confirmar novo horário'}
                    </button>
                  ) : (
                    <button
                      className={dialogDangerButton}
                      type="button"
                      disabled={noShowMutation.isPending}
                      onClick={() => noShowMutation.mutate()}
                    >
                      {noShowMutation.isPending ? 'A registar…' : 'Confirmar falta'}
                    </button>
                  )}
                </>
              )}
            </footer>
          </>
        )}
      </section>
    </div>
  );
}

function AppointmentDialogSummary({ appointment }: { appointment: AppointmentDetail }) {
  const name = customerName(appointment);
  const date = new Intl.DateTimeFormat('pt-PT', {
    timeZone: 'Europe/Lisbon',
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date(appointment.startsAt));

  return (
    <div className="px-[1.35rem] py-[1.15rem]">
      <div className="mb-[1.15rem] grid grid-cols-[auto_1fr_auto] items-center gap-3">
        <UserAvatar
          className={cn(avatarBadge, 'size-[2.4rem] text-[0.7rem] text-[#e6e2d9]')}
          name={name}
          profileImageDataUrl={appointment.customer?.profileImageDataUrl}
        />
        <span>
          <strong className="block text-[0.8rem]">{name}</strong>
          <small className="mt-[0.28rem] block text-[0.66rem] font-normal text-muted">
            {customerPhone(appointment) ?? 'Sem telemóvel'}
          </small>
        </span>
        <span className="rounded-2xl bg-[rgba(60,121,75,0.14)] px-[0.6rem] py-[0.35rem] text-[0.62rem] text-[#7fc18f]">
          {statusLabel(appointment.status)}
        </span>
      </div>
      <dl className="m-0 grid grid-cols-2 gap-[0.8rem] max-[720px]:grid-cols-1">
        <div className="rounded-[0.55rem] border border-border bg-white/[0.018] p-3">
          <dt className="text-[0.62rem] text-muted uppercase">Serviço</dt>
          <dd className="mt-1 mb-0 text-[0.78rem] font-[650] capitalize">
            {appointment.serviceNameSnapshot}
          </dd>
        </div>
        <div className="rounded-[0.55rem] border border-border bg-white/[0.018] p-3">
          <dt className="text-[0.62rem] text-muted uppercase">Data</dt>
          <dd className="mt-1 mb-0 text-[0.78rem] font-[650] capitalize">{date}</dd>
        </div>
        <div className="rounded-[0.55rem] border border-border bg-white/[0.018] p-3">
          <dt className="text-[0.62rem] text-muted uppercase">Horário</dt>
          <dd className="mt-1 mb-0 text-[0.78rem] font-[650] capitalize">
            {timeInLisbon(appointment.startsAt)}–{timeInLisbon(appointment.endsAt)}
          </dd>
        </div>
        <div className="rounded-[0.55rem] border border-border bg-white/[0.018] p-3">
          <dt className="text-[0.62rem] text-muted uppercase">Profissional</dt>
          <dd className="mt-1 mb-0 text-[0.78rem] font-[650] capitalize">
            {appointment.barberProfile.displayName}
          </dd>
        </div>
      </dl>
    </div>
  );
}

function WeeklyAgenda({
  appointments,
  selectedDate,
  onSelectDay,
  onSelectAppointment,
}: {
  appointments: CalendarAppointment[];
  selectedDate: string;
  onSelectDay: (date: string) => void;
  onSelectAppointment: (appointmentId: string) => void;
}) {
  const monday = startOfWeek(selectedDate);
  const days = Array.from({ length: 7 }, (_, index) => moveDate(monday, index));
  const activeAppointments = appointments.filter(
    (appointment) => appointment.status !== 'CANCELLED',
  );
  return (
    <section
      className="overflow-hidden overflow-x-auto rounded-[0.9rem] border border-border bg-[rgba(14,15,13,0.82)] max-[720px]:-mx-4 max-[720px]:rounded-none max-[720px]:border-x-0"
      aria-label="Agenda semanal"
    >
      <div className="grid min-w-[59rem] grid-cols-7 max-[720px]:min-w-[52rem]">
        {days.map((date) => {
          const dayAppointments = activeAppointments.filter(
            (appointment) => localDateKey(appointment.startsAt) === date,
          );
          const dateValue = new Date(`${date}T12:00:00Z`);
          return (
            <div
              className="min-h-[30rem] not-first:border-l not-first:border-border"
              key={date}
            >
              <button
                className="flex min-h-[7.2rem] w-full cursor-pointer flex-col items-center justify-center border-0 border-b border-border bg-white/[0.015] hover:bg-[rgba(200,154,75,0.08)]"
                type="button"
                onClick={() => onSelectDay(date)}
              >
                <span className="text-[0.62rem] font-bold tracking-[0.12em] text-[#777a72] uppercase">
                  {new Intl.DateTimeFormat('pt-PT', { weekday: 'short' }).format(dateValue)}
                </span>
                <strong className="mt-[0.3rem] font-serif text-[2rem]">
                  {dateValue.getUTCDate()}
                </strong>
                <small className="mt-[0.15rem] text-[0.58rem] text-gold-light">
                  {dayAppointments.length} marcações
                </small>
              </button>
              <div className="grid content-start gap-[0.45rem] p-[0.55rem]">
                {dayAppointments.length ? (
                  dayAppointments.map((appointment) => (
                    <button
                      className="flex min-h-[5.5rem] flex-col items-start rounded-[0.45rem] border border-[rgba(200,154,75,0.18)] border-l-2 border-l-gold bg-[linear-gradient(135deg,rgba(200,154,75,0.12),#151613)] p-[0.7rem] text-left text-text"
                      type="button"
                      key={appointment.id}
                      onClick={() => onSelectAppointment(appointment.id)}
                    >
                      <strong className="text-[0.68rem] text-gold-light">
                        {timeInLisbon(appointment.startsAt)}
                      </strong>
                      <span className="mt-[0.45rem] text-[0.72rem] font-semibold">
                        {customerName(appointment)}
                      </span>
                      <small className="mt-[0.2rem] text-[0.6rem] text-[#7d8078]">
                        {appointment.serviceNameSnapshot}
                      </small>
                    </button>
                  ))
                ) : (
                  <span className="px-[0.3rem] py-[1.2rem] text-center text-[0.62rem] text-[#5f625b]">
                    Sem marcações
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function MonthlyAgenda({
  appointments,
  selectedDate,
  onSelectDay,
}: {
  appointments: CalendarAppointment[];
  selectedDate: string;
  onSelectDay: (date: string) => void;
}) {
  const monthStart = `${selectedDate.slice(0, 7)}-01`;
  const gridStart = startOfWeek(monthStart);
  const days = Array.from({ length: 42 }, (_, index) => moveDate(gridStart, index));
  const currentMonth = selectedDate.slice(0, 7);
  const today = lisbonDateParts();
  const counts = appointments
    .filter((appointment) => appointment.status !== 'CANCELLED')
    .reduce<Record<string, number>>((result, appointment) => {
      const date = localDateKey(appointment.startsAt);
      result[date] = (result[date] ?? 0) + 1;
      return result;
    }, {});

  return (
    <section
      className="overflow-hidden rounded-[0.9rem] border border-border bg-[rgba(14,15,13,0.82)] max-[720px]:-mx-2"
      aria-label="Agenda mensal"
    >
      <div className="grid grid-cols-7 border-b border-border" aria-hidden="true">
        {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((day) => (
          <span
            key={day}
            className="px-2 py-[0.85rem] text-center text-[0.62rem] font-bold tracking-[0.1em] text-[#777a72] uppercase max-[720px]:px-[0.15rem] max-[720px]:text-[0.54rem]"
          >
            {day}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((date) => {
          const count = counts[date] ?? 0;
          const outsideMonth = !date.startsWith(currentMonth);
          const isToday = date === today;
          return (
            <button
              className={cn(
                'flex min-h-[7.8rem] cursor-pointer flex-col items-start border-0 border-r border-b border-border p-3 text-text bg-transparent hover:bg-[rgba(200,154,75,0.07)] max-[720px]:min-h-[5.2rem] max-[720px]:p-[0.4rem] [&:nth-child(7n)]:border-r-0',
                '[&>span]:grid [&>span]:size-[1.8rem] [&>span]:place-items-center [&>span]:rounded-full [&>span]:text-[0.72rem]',
                '[&>strong]:mt-auto [&>strong]:rounded-[0.35rem] [&>strong]:bg-[rgba(200,154,75,0.12)] [&>strong]:px-[0.55rem] [&>strong]:py-[0.4rem] [&>strong]:text-[0.62rem] [&>strong]:text-gold-light',
                'max-[720px]:[&>strong]:w-full max-[720px]:[&>strong]:overflow-hidden max-[720px]:[&>strong]:text-ellipsis max-[720px]:[&>strong]:text-center max-[720px]:[&>strong]:whitespace-nowrap max-[720px]:[&>strong]:px-[0.2rem] max-[720px]:[&>strong]:py-[0.3rem] max-[720px]:[&>strong]:text-[0.52rem]',
                outsideMonth && 'bg-black/[0.14] text-[#4f524b] [&>strong]:opacity-50',
                isToday && '[&>span]:bg-gold-light [&>span]:font-extrabold [&>span]:text-[#17130d]',
              )}
              type="button"
              key={date}
              onClick={() => onSelectDay(date)}
            >
              <span>{Number(date.slice(-2))}</span>
              {count > 0 && (
                <strong>
                  {count} {count === 1 ? 'marcação' : 'marcações'}
                </strong>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function AgendaState({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[24rem] flex-col items-center justify-center rounded-[0.9rem] border border-border bg-[rgba(14,15,13,0.82)] p-8 text-center">
      <span className="grid size-14 place-items-center rounded-full border border-[rgba(200,154,75,0.25)] bg-[rgba(200,154,75,0.08)] text-gold-light">
        {icon}
      </span>
      <h3 className="mt-4 text-base">{title}</h3>
      <p className="mt-[0.55rem] max-w-[27rem] text-[0.8rem] leading-[1.6] text-muted">
        {description}
      </p>
      {action}
    </div>
  );
}
