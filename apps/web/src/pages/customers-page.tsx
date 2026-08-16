import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Search,
  Sparkles,
  UserRoundCheck,
  UsersRound,
} from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { getAccessToken } from '../features/auth/auth-session';
import { getCustomers } from '../features/customers/customers-api';
import { UserAvatar } from '../shared/components/user-avatar';

const heroBackButton =
  'grid size-[2.7rem] shrink-0 place-items-center rounded-full border border-[rgba(226,216,195,0.14)] bg-[rgba(17,18,15,0.8)]';
const heroEyebrow =
  'flex items-center gap-[0.45rem] text-[0.65rem] font-bold tracking-[0.16em] text-gold-light uppercase';
const sectionEyebrow =
  'm-0 text-[0.65rem] font-bold tracking-[0.15em] text-gold-accent uppercase';
const customersStateClass =
  'mt-4 grid min-h-[10rem] place-items-center rounded-xl border border-dashed border-[rgba(226,216,195,0.12)] text-[0.8rem] text-[#898c84]';

const dateFormatter = new Intl.DateTimeFormat('pt-PT', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'Europe/Lisbon',
});

function formatPrice(value: string | number) {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(
    Number(value),
  );
}

export function CustomersPage() {
  const navigate = useNavigate();
  const accessToken = getAccessToken()!;
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const customers = useQuery({
    queryKey: ['customers', search, page],
    queryFn: () => getCustomers(accessToken, search, page),
  });

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_80%_0,rgba(161,112,45,0.1),transparent_28rem),#080907] text-text">
      <header className="relative min-h-[14rem] overflow-hidden border-b border-[rgba(226,216,195,0.1)] max-[720px]:min-h-[12rem]">
        <div className="absolute inset-0 bg-[image:var(--barbershop-cover-admin)] bg-top bg-cover bg-no-repeat saturate-[0.7]" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(7,8,6,0.96),rgba(7,8,6,0.45)),linear-gradient(0deg,#080907,transparent_60%)]" />
        <div className="relative mx-auto flex w-[min(100%-2rem,72rem)] items-end gap-[1.2rem] py-12 pb-8 max-[720px]:py-8 max-[720px]:pb-6">
          <button
            type="button"
            aria-label="Voltar à página anterior"
            onClick={() => navigate(-1)}
            className={heroBackButton}
          >
            <ArrowLeft />
          </button>
          <div>
            <span className={heroEyebrow}>
              <Sparkles size={14} /> Barbearia DonFlow
            </span>
            <h1 className="mt-[0.45rem] font-serif text-[clamp(3rem,7vw,5rem)] leading-[0.85] max-[720px]:text-[3.25rem]">
              Clientes
            </h1>
            <p className="mt-[0.7rem] text-[0.8rem] text-[#a4a69f]">
              Consulta os clientes registados e o respetivo histórico.
            </p>
          </div>
        </div>
      </header>

      <section className="mx-auto w-[min(100%-2rem,72rem)] py-8 pt-8 pb-16">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className={sectionEyebrow}>Base de clientes</p>
            <h2 className="mt-[0.35rem] text-[1.35rem]">Clientes registados</h2>
          </div>
        </div>

        <label className="mt-6 grid min-h-[3.2rem] grid-cols-[auto_1fr_auto] items-center gap-[0.7rem] rounded-[0.65rem] border border-[rgba(226,216,195,0.11)] bg-[#10110e] px-4 [&_svg]:text-[#6f726b]">
          <Search size={17} />
          <input
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Pesquisar por nome ou telemóvel..."
            className="h-12 min-w-0 border-0 bg-transparent text-text outline-0"
          />
          <span className="text-[0.7rem] text-[#777a72]">
            {customers.data?.meta.total ?? 0} clientes
          </span>
        </label>

        {customers.isLoading ? (
          <div className={customersStateClass}>A carregar clientes...</div>
        ) : customers.isError ? (
          <div className={customersStateClass}>Não foi possível carregar os clientes.</div>
        ) : customers.data?.data.length ? (
          <div className="mt-4 overflow-hidden rounded-xl border border-[rgba(226,216,195,0.1)] bg-[#10110e]">
            <div className="grid min-h-[2.8rem] grid-cols-[minmax(11rem,1.4fr)_minmax(8rem,1fr)_minmax(7rem,0.8fr)_minmax(6rem,0.7fr)_2rem] items-center gap-4 border-b border-[rgba(226,216,195,0.08)] px-4 text-[0.62rem] tracking-[0.1em] text-[#777a72] uppercase max-[720px]:hidden">
              <span>Cliente</span>
              <span>Telemóvel</span>
              <span>Última visita</span>
              <span>Total gasto</span>
              <span aria-hidden="true" />
            </div>
            {customers.data.data.map((customer) => (
              <button
                className="grid min-h-[4.15rem] w-full cursor-pointer grid-cols-[minmax(11rem,1.4fr)_minmax(8rem,1fr)_minmax(7rem,0.8fr)_minmax(6rem,0.7fr)_2rem] items-center gap-4 border-0 border-b border-[rgba(226,216,195,0.065)] bg-transparent px-4 text-left text-[0.74rem] text-[#bbbdb6] last:border-b-0 hover:bg-[rgba(200,154,75,0.055)] max-[720px]:grid-cols-[minmax(0,1fr)_auto] max-[720px]:min-h-[3.6rem] max-[720px]:p-3"
                type="button"
                key={customer.id}
                onClick={() => navigate(`/customers/${customer.id}`)}
                aria-label={`Ver detalhes de ${customer.name}`}
              >
                <span className="flex min-w-0 items-center gap-3 text-text max-[720px]:col-start-1">
                  <UserAvatar
                    className="grid size-8 shrink-0 place-items-center rounded-full border border-[rgba(200,154,75,0.28)] bg-[#252017] text-[0.62rem] font-bold text-gold-light"
                    name={customer.name}
                    profileImageDataUrl={customer.profileImageDataUrl}
                  />
                  <strong className="overflow-hidden text-ellipsis whitespace-nowrap">
                    {customer.name}
                  </strong>
                </span>
                <span className="max-[720px]:hidden">{customer.phone ?? 'Não indicado'}</span>
                <span className="max-[720px]:hidden">
                  {customer.lastVisit
                    ? dateFormatter.format(new Date(customer.lastVisit))
                    : 'Sem visitas'}
                </span>
                <strong className="max-[720px]:hidden">{formatPrice(customer.totalSpent)}</strong>
                <ChevronRight size={18} className="text-[#c89a4b] max-[720px]:col-start-2" />
              </button>
            ))}
          </div>
        ) : (
          <div className={customersStateClass}>Nenhum cliente registado encontrado.</div>
        )}

        {customers.data && customers.data.meta.totalPages > 1 && (
          <div className="mt-4 flex items-center justify-center gap-4 text-[0.72rem] text-[#8f928a]">
            <button
              type="button"
              disabled={page === 1}
              onClick={() => setPage((value) => value - 1)}
              className="grid size-9 place-items-center rounded-full border border-[rgba(226,216,195,0.12)] bg-[#12130f]"
            >
              <ChevronLeft />
            </button>
            <span>
              Página {page} de {customers.data.meta.totalPages}
            </span>
            <button
              type="button"
              disabled={page === customers.data.meta.totalPages}
              onClick={() => setPage((value) => value + 1)}
              className="grid size-9 place-items-center rounded-full border border-[rgba(226,216,195,0.12)] bg-[#12130f]"
            >
              <ChevronRight />
            </button>
          </div>
        )}

        <div className="mt-5 grid grid-cols-4 gap-3 max-[720px]:grid-cols-2">
          <article className="grid min-h-[7rem] grid-cols-[auto_1fr] content-center gap-x-[0.65rem] gap-y-[0.4rem] rounded-[0.7rem] border border-[rgba(226,216,195,0.09)] bg-[#10110e] p-4 [&_svg]:row-span-2 [&_svg]:self-center [&_svg]:text-gold-accent">
            <UsersRound />
            <span className="text-[0.68rem] text-[#85887f]">Total de clientes</span>
            <strong className="text-[1.15rem]">{customers.data?.summary.totalCustomers ?? 0}</strong>
          </article>
          <article className="grid min-h-[7rem] grid-cols-[auto_1fr] content-center gap-x-[0.65rem] gap-y-[0.4rem] rounded-[0.7rem] border border-[rgba(226,216,195,0.09)] bg-[#10110e] p-4 [&_svg]:row-span-2 [&_svg]:self-center [&_svg]:text-gold-accent">
            <UserRoundCheck />
            <span className="text-[0.68rem] text-[#85887f]">Clientes ativos</span>
            <strong className="text-[1.15rem]">{customers.data?.summary.activeCustomers ?? 0}</strong>
          </article>
          <article className="grid min-h-[7rem] grid-cols-[auto_1fr] content-center gap-x-[0.65rem] gap-y-[0.4rem] rounded-[0.7rem] border border-[rgba(226,216,195,0.09)] bg-[#10110e] p-4 [&_svg]:row-span-2 [&_svg]:self-center [&_svg]:text-gold-accent">
            <Sparkles />
            <span className="text-[0.68rem] text-[#85887f]">Novos este mês</span>
            <strong className="text-[1.15rem]">{customers.data?.summary.newCustomers ?? 0}</strong>
          </article>
          <article className="grid min-h-[7rem] grid-cols-[auto_1fr] content-center gap-x-[0.65rem] gap-y-[0.4rem] rounded-[0.7rem] border border-[rgba(226,216,195,0.09)] bg-[#10110e] p-4 [&_svg]:row-span-2 [&_svg]:self-center [&_svg]:text-gold-accent">
            <CircleDollarSign />
            <span className="text-[0.68rem] text-[#85887f]">Ticket médio</span>
            <strong className="text-[1.15rem]">
              {formatPrice(customers.data?.summary.averageTicket ?? 0)}
            </strong>
          </article>
        </div>
      </section>
    </main>
  );
}
