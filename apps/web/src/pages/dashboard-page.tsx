import { useQuery } from '@tanstack/react-query';
import {
  CalendarDays,
  CalendarCheck2,
  ChartNoAxesCombined,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Minus,
  Star,
  TrendingDown,
  TrendingUp,
  UserRoundCheck,
} from 'lucide-react';
import { useState, type CSSProperties } from 'react';
import { useStaffUser } from '../app/staff-context';
import { getAccessToken } from '../features/auth/auth-session';
import {
  getDashboard,
  type BarberRating,
  type DashboardMetrics,
  type DashboardScope,
  type DashboardSeriesPoint,
} from '../features/dashboard/dashboard-api';
import { useRole } from '../shared/hooks/use-role';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

const currentMonth = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Lisbon',
    year: 'numeric',
    month: '2-digit',
  }).format(new Date());
const money = (value: number) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(value);

const eyebrow = 'm-0 text-[0.65rem] font-bold tracking-[0.15em] text-gold-accent uppercase';
const iconGold = 'w-[1.05rem] text-gold-accent';
const labelMuted = 'text-[0.68rem] text-[#a0a29a]';
const pillButton = (active: boolean) =>
  cn(
    'min-h-10 rounded-[0.45rem] border-0 bg-transparent px-4 text-[#85887f] max-[720px]:flex-1',
    active && 'bg-gold-accent font-bold text-[#17130d]',
  );

export function DashboardPage() {
  const user = useStaffUser();
  const { isMaster } = useRole(user.role);
  const [scope, setScope] = useState<DashboardScope>('own');
  const effectiveScope = isMaster ? scope : 'own';
  const token = getAccessToken()!;
  const thisMonth = currentMonth();
  const [month, setMonth] = useState(thisMonth);
  const [period, setPeriod] = useState<'day' | 'week'>('day');
  const dashboard = useQuery({
    queryKey: ['dashboard', month, effectiveScope],
    queryFn: () => getDashboard(token, month, effectiveScope),
  });
  const historicalReport = month !== thisMonth;
  const selected = dashboard.data?.data.periods[period] ?? emptyPeriod;
  const report = dashboard.data?.data.report ?? emptyReport;
  return (
    <main className="min-h-screen bg-background text-text">
      <header className="relative min-h-[18rem] overflow-hidden">
        <div className="absolute inset-0 bg-[image:var(--barbershop-cover-admin)] bg-top bg-cover bg-no-repeat" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(7,8,6,0.96),rgba(7,8,6,0.35)),linear-gradient(0deg,#080907,transparent_65%)]" />
        <div className="relative mx-auto w-[min(100%-2rem,76rem)] pt-20 pb-8">
          <p className={eyebrow}>Barbearia DonFlow</p>
          <h1 className="my-2 font-serif text-[clamp(3.5rem,7vw,5.5rem)] leading-[0.85]">
            Dashboard
          </h1>
          <span className="text-[0.8rem] text-[#a2a49d]">
            Indicadores para acompanhar o desempenho do negócio.
          </span>
        </div>
      </header>
      <section className="mx-auto w-[min(100%-2rem,76rem)] pb-20">
        {isMaster && (
          <div className="mb-4 flex items-end justify-between gap-4 max-[720px]:flex-col max-[720px]:items-stretch">
            <div className="flex rounded-[0.6rem] border border-border bg-[#10110e] p-1 max-[720px]:w-full">
              {(['own', 'general'] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  className={pillButton(scope === item)}
                  onClick={() => setScope(item)}
                >
                  {item === 'own' ? 'Minha agenda' : 'Geral da barbearia'}
                </button>
              ))}
            </div>
          </div>
        )}
        <section className="mb-4 grid grid-cols-[minmax(0,1fr)_15rem] items-center gap-4 rounded-[0.85rem] border border-border bg-panel-alt p-5">
          <header>
            <div>
              <p className={eyebrow}>Experiência dos clientes</p>
              <h2 className="my-[0.35rem] text-[1.25rem]">Avaliações da barbearia</h2>
            </div>
            <span className="text-[0.68rem] text-[#85887f]">
              A média reúne todas as avaliações recebidas.
            </span>
          </header>
          <RatingCard
            metrics={{ ...emptyMetrics, ...(dashboard.data?.data.ratings.metrics ?? {}) }}
            reviews={dashboard.data?.data.ratings.reviews ?? []}
          />
        </section>
        <div className="flex items-end justify-between gap-4 max-[720px]:flex-col max-[720px]:items-stretch">
          {!historicalReport && (
            <div className="flex rounded-[0.6rem] border border-border bg-[#10110e] p-1 max-[720px]:w-full">
              {(['day', 'week'] as const).map((item) => (
                <button
                  key={item}
                  className={pillButton(period === item)}
                  onClick={() => setPeriod(item)}
                >
                  {item === 'day' ? 'Hoje' : 'Esta semana'}
                </button>
              ))}
            </div>
          )}
          {historicalReport && (
            <button onClick={() => setMonth(thisMonth)}>Voltar ao mês atual</button>
          )}
          <MonthSelector month={month} onChange={setMonth} max={thisMonth} />
        </div>

        {!historicalReport && (
          <MetricCards metrics={selected.metrics} previous={selected.previousMetrics} />
        )}

        <AppointmentsChart series={report.series} month={month} />

        <section className="mt-5 rounded-[0.85rem] border border-border bg-panel-alt p-5">
          <header className="flex items-center justify-between gap-4">
            <div>
              <p className={eyebrow}>Métricas mensais</p>
              <h2 className="mt-[0.3rem] mb-0 text-[1.1rem]">{monthName(month)}</h2>
            </div>
            <ChartNoAxesCombined className="text-gold-accent" />
          </header>
          <MetricCards metrics={report.metrics} previous={report.previousMetrics} />
        </section>
      </section>
    </main>
  );
}

function MonthSelector({
  month,
  max,
  onChange,
}: {
  month: string;
  max: string;
  onChange: (month: string) => void;
}) {
  return (
    <label className="grid gap-[0.35rem] text-[0.65rem] text-[#85887f] max-[720px]:w-full">
      <span>Consultar mês</span>
      <div className="flex min-w-[13rem] items-center rounded-[0.6rem] border border-[rgba(226,216,195,0.12)] bg-[linear-gradient(145deg,#151610,#0d0e0b)]">
        <CalendarDays className="ml-[0.8rem] w-4 text-gold-accent" />
        <input
          type="month"
          max={max}
          value={month}
          onChange={(event) => onChange(event.target.value)}
          className="h-[2.6rem] w-full border-0 bg-transparent px-[0.7rem] text-text [color-scheme:dark]"
        />
      </div>
    </label>
  );
}

const emptyMetrics: DashboardMetrics = {
  appointments: 0,
  completed: 0,
  cancelled: 0,
  customers: 0,
  realizedRevenue: 0,
  averageTicket: 0,
  occupiedMinutes: 0,
  occupancyPercent: 0,
  ratingAverage: null,
  ratingCount: 0,
  noShows: 0,
  noShowRate: 0,
};
const emptyPeriod = {
  metrics: emptyMetrics,
  previousMetrics: emptyMetrics,
  series: [],
  reviews: [],
};
const emptyReport = { ...emptyPeriod, month: currentMonth(), days: [] };

function MetricCards({
  metrics,
  previous,
}: {
  metrics: DashboardMetrics;
  previous: DashboardMetrics;
}) {
  return (
    <div className="mt-4 grid grid-cols-5 items-start gap-3 max-[950px]:grid-cols-2">
      <MetricCard
        label="Marcações concluídas"
        value={metrics.completed}
        current={metrics.completed}
        previous={previous.completed}
        icon={CalendarCheck2}
      />
      <MetricCard
        label="Clientes recebidos"
        value={metrics.customers}
        current={metrics.customers}
        previous={previous.customers}
        icon={UserRoundCheck}
      />
      <MetricCard
        label="Valor alcançado"
        value={money(metrics.realizedRevenue)}
        current={metrics.realizedRevenue}
        previous={previous.realizedRevenue}
        detail={`Ticket médio ${money(metrics.averageTicket)}`}
        icon={CircleDollarSign}
      />
      <MetricCard
        label="Taxa de ausência"
        value={`${metrics.noShowRate}%`}
        current={metrics.noShowRate}
        previous={previous.noShowRate}
        detail={`${metrics.noShows} ausências`}
        icon={CalendarDays}
        lowerIsBetter
      />
      <article className="relative box-border h-[11.5rem] min-h-[11.5rem] max-h-[11.5rem] rounded-xl border border-[rgba(226,216,195,0.09)] bg-card-surface p-5 shadow-[0_14px_30px_rgba(0,0,0,0.18)] max-[720px]:p-4">
        <div className="grid grid-cols-[auto_1fr] content-center gap-x-[0.65rem] gap-y-[0.55rem]">
          <ChartNoAxesCombined className={iconGold} />
          <span className={labelMuted}>Ocupação no período</span>
          <div
            className="col-span-full grid size-[5.2rem] place-content-center justify-self-center rounded-full bg-[radial-gradient(circle_at_center,#11120e_58%,transparent_60%),conic-gradient(var(--color-gold-accent)_var(--occupancy),#3b3428_0)] text-center"
            style={{ '--occupancy': `${metrics.occupancyPercent * 3.6}deg` } as CSSProperties}
          >
            <strong className="text-[1.25rem]">{metrics.occupancyPercent}%</strong>
            <small className="text-[0.5rem] text-[#777a72]">da agenda</small>
          </div>
        </div>
        <Trend current={metrics.occupancyPercent} previous={previous.occupancyPercent} />
      </article>
    </div>
  );
}

function RatingCard({ metrics, reviews }: { metrics: DashboardMetrics; reviews: BarberRating[] }) {
  const slides = [
    { kind: 'summary' as const },
    ...reviews.map((review) => ({ kind: 'barber' as const, review })),
  ];
  const [slide, setSlide] = useState(0);
  const active = slides[Math.min(slide, slides.length - 1)];
  const previous = () => setSlide((current) => (current - 1 + slides.length) % slides.length);
  const next = () => setSlide((current) => (current + 1) % slides.length);
  return (
    <article className="relative h-[11.5rem] min-h-[11.5rem] max-h-[11.5rem] w-full overflow-hidden rounded-xl border border-[rgba(226,216,195,0.09)] bg-card-surface">
      <div className="h-full min-h-0 px-[1.6rem]">
        {active.kind === 'summary' ? (
          <div className="grid h-full min-h-0 grid-cols-[auto_1fr] content-center gap-x-[0.65rem] gap-y-[0.35rem] p-[1.35rem_1.15rem_1rem] animate-rating-slide-in">
            <Star className={iconGold} />
            <span className={labelMuted}>Avaliação média</span>
            <strong className="col-span-full mt-[0.35rem] text-[2rem] font-medium">
              {metrics.ratingAverage === null ? '—' : metrics.ratingAverage.toFixed(1)}
            </strong>
            <div className="[grid-column:1/4] text-[0.8rem] tracking-[0.12rem] text-[#e0ad41]">
              ★★★★★
            </div>
            <small className="col-span-full text-[0.58rem] text-[#777a72]">
              Baseado em {metrics.ratingCount} avaliações
            </small>
          </div>
        ) : (
          <BarberRatingSlide barber={active.review} />
        )}
      </div>
      {slides.length > 1 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-between px-[0.35rem]">
          <button
            type="button"
            onClick={previous}
            aria-label="Avaliação anterior"
            className="pointer-events-auto grid size-[1.6rem] place-items-center rounded-full border border-[rgba(211,167,91,0.2)] bg-[#0b0c09] text-gold-accent"
          >
            <ChevronLeft className="w-[0.85rem]" />
          </button>
          <span className="absolute right-0 bottom-[0.35rem] left-0 text-center text-[0.52rem] text-[#696c65]">
            {slide + 1}/{slides.length}
          </span>
          <button
            type="button"
            onClick={next}
            aria-label="Próxima avaliação"
            className="pointer-events-auto grid size-[1.6rem] place-items-center rounded-full border border-[rgba(211,167,91,0.2)] bg-[#0b0c09] text-gold-accent"
          >
            <ChevronRight className="w-[0.85rem]" />
          </button>
        </div>
      )}
    </article>
  );
}

function BarberRatingSlide({ barber }: { barber: BarberRating }) {
  return (
    <div className="grid h-full min-h-0 animate-rating-slide-in justify-items-center gap-[0.2rem] p-[1rem_1rem_1.25rem] text-center">
      <Avatar className="size-[3.2rem] border border-[rgba(211,167,91,0.35)] bg-[#181710] text-[0.7rem] text-gold-accent">
        {barber.profileImageDataUrl ? (
          <AvatarImage src={barber.profileImageDataUrl} alt="" />
        ) : (
          <AvatarFallback className="bg-transparent text-gold-accent">
            {initials(barber.name)}
          </AvatarFallback>
        )}
      </Avatar>
      <strong className="text-[0.75rem]">{barber.name}</strong>
      <span className="text-[0.72rem] text-[#e0ad41]">
        ★ {barber.ratingAverage === null ? '—' : barber.ratingAverage.toFixed(1)}
      </span>
      <small className="text-[0.55rem] text-[#777a72]">
        {barber.ratingCount ? `${barber.ratingCount} avaliações` : 'Sem avaliações'}
      </small>
    </div>
  );
}

function MetricCard({
  label,
  value,
  detail,
  current,
  previous,
  lowerIsBetter = false,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  detail?: string;
  current: number;
  previous: number;
  lowerIsBetter?: boolean;
  icon: typeof UserRoundCheck;
}) {
  return (
    <article className="relative box-border h-[11.5rem] min-h-[11.5rem] max-h-[11.5rem] rounded-xl border border-[rgba(226,216,195,0.09)] bg-card-surface p-5 shadow-[0_14px_30px_rgba(0,0,0,0.18)] max-[720px]:p-4">
      <div className="grid grid-cols-[auto_1fr] content-center gap-x-[0.7rem] gap-y-[0.65rem]">
        <Icon className={iconGold} />
        <span className={labelMuted}>{label}</span>
        <strong className="col-span-full mt-[0.45rem] text-[clamp(1.45rem,2.3vw,2rem)] font-medium">
          {value}
        </strong>
        {detail && (
          <small className="col-span-full text-[0.62rem] text-[#72756e]">{detail}</small>
        )}
      </div>
      <Trend current={current} previous={previous} lowerIsBetter={lowerIsBetter} />
    </article>
  );
}

function Trend({
  current,
  previous,
  lowerIsBetter = false,
}: {
  current: number;
  previous: number;
  lowerIsBetter?: boolean;
}) {
  const difference = current - previous;
  const percentage =
    previous === 0
      ? current === 0
        ? 0
        : 100
      : Math.round((difference / Math.abs(previous)) * 100);
  const improved = lowerIsBetter ? difference < 0 : difference > 0;
  const worsened = lowerIsBetter ? difference > 0 : difference < 0;
  const Icon = difference > 0 ? TrendingUp : difference < 0 ? TrendingDown : Minus;
  const color = improved ? 'text-[#69b77d]' : worsened ? 'text-[#cf707e]' : 'text-[#85887f]';
  return (
    <span
      className={cn(
        'absolute right-4 bottom-3 left-4 flex items-center gap-1 text-[0.55rem] whitespace-nowrap',
        color,
      )}
    >
      <Icon className="size-3 text-current" />
      {difference === 0 ? 'Sem alteração' : `${Math.abs(percentage)}% face ao período anterior`}
    </span>
  );
}

function AppointmentsChart({ series, month }: { series: DashboardSeriesPoint[]; month: string }) {
  const maximum = Math.max(1, ...series.map((item) => item.appointments));
  return (
    <section className="mt-5 rounded-[0.85rem] border border-border bg-panel-alt p-5">
      <header className="flex items-center justify-between gap-4">
        <div>
          <p className={eyebrow}>Movimento da agenda</p>
          <h2 className="mt-[0.3rem] mb-0 text-[1.1rem]">Marcações em {monthName(month)}</h2>
        </div>
        <span className="text-[0.68rem] text-[#85887f]">
          {series.reduce((sum, item) => sum + item.appointments, 0)} no mês
        </span>
      </header>
      <div className="mt-[1.3rem] flex h-60 items-end gap-[clamp(0.25rem,1vw,0.8rem)] overflow-x-auto border-t border-[rgba(226,216,195,0.07)] pt-4">
        {series.map((item) => (
          <div
            className="grid min-w-[1.1rem] flex-1 grid-rows-[1.2rem_1fr_1.3rem] gap-[0.3rem] text-center"
            key={item.date}
            title={`${item.appointments} marcações`}
          >
            <span className="text-[0.58rem] text-[#bbbdb6]">{item.appointments}</span>
            <div className="flex items-end justify-center">
              <i
                className="block w-[min(2rem,75%)] min-h-[2px] rounded-[0.3rem_0.3rem_0.1rem_0.1rem] bg-[linear-gradient(180deg,#dfb661,#8c632d)] shadow-[0_0_14px_rgba(211,167,91,0.14)]"
                style={{
                  height: `${Math.max(item.appointments ? 10 : 2, (item.appointments / maximum) * 100)}%`,
                }}
              />
            </div>
            <small className="text-[0.55rem] text-[#777a72] capitalize">
              {new Date(`${item.date}T12:00:00`).toLocaleDateString('pt-PT', { day: '2-digit' })}
            </small>
          </div>
        ))}
      </div>
    </section>
  );
}

function monthName(month: string) {
  return new Date(`${month}-02`).toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' });
}
function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}
