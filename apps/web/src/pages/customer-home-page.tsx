import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  ArrowRight,
  Award,
  MapPin,
  Scissors,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useOutletContext } from 'react-router';
import { getBarbers } from '../features/appointments/appointments-api';
import type { AuthenticatedUser } from '../features/auth/auth-api';
import { getAccessToken } from '../features/auth/auth-session';
import { getShopSettings } from '../features/settings/settings-api';
import { customerPrimaryButton } from './customer-portal-styles';

export function CustomerHomePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useOutletContext<AuthenticatedUser>();
  const [bookingNotice, setBookingNotice] = useState(false);
  const accessToken = getAccessToken()!;
  const barbers = useQuery({
    queryKey: ['customer', 'barbers'],
    queryFn: () => getBarbers(accessToken),
  });
  const shop = useQuery({
    queryKey: ['customer', 'shop-settings'],
    queryFn: () => getShopSettings(accessToken),
    refetchInterval: 30_000,
  });
  const bookingRestricted = user.customerBookingBlocked || user.customerBookingLimited;

  useEffect(() => {
    if ((location.state as { showBookingRestriction?: boolean } | null)?.showBookingRestriction) {
      setBookingNotice(true);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const startBooking = () => {
    if (bookingRestricted) {
      setBookingNotice(true);
      return;
    }
    navigate('/customer/book');
  };

  return (
    <main className="pt-[4.5rem]">
      <section className="relative flex min-h-[min(42rem,72vh)] items-end overflow-hidden bg-[image:var(--barbershop-cover-image)] bg-center bg-cover bg-no-repeat max-[620px]:min-h-[44rem]">
        <div className="absolute inset-0 bg-[linear-gradient(0deg,#090a08_1%,rgba(8,9,7,0.22)_62%,rgba(8,9,7,0.25)),linear-gradient(90deg,rgba(7,8,6,0.84),transparent_75%)]" />
        <div className="relative w-[min(100%,48rem)] px-[clamp(1.25rem,5vw,4rem)] py-12">
          <span className="text-[0.62rem] font-bold tracking-[0.13em] text-[#c49343] uppercase">
            Desde 2022
          </span>
          <h1 className="my-[0.65rem] font-serif text-[clamp(2.8rem,8vw,5.5rem)] leading-[0.94] max-[620px]:text-[3.15rem]">
            Aparece pela curiosidade, permanece pela qualidade.
          </h1>
          <p className="max-w-[30rem] text-[0.8rem] leading-[1.65] text-[#b0ada5]">
            Ambiente premium e profissionais especializados para cuidar de si.
          </p>
          <button className={customerPrimaryButton} onClick={startBooking}>
            Marcar horário <ArrowRight size={18} />
          </button>
        </div>
      </section>

      {shop.data?.data.address && (
        <section className="mx-[clamp(1.25rem,5vw,4rem)] mt-6 mb-0 flex items-center gap-4 rounded-xl border border-[rgba(214,170,91,0.14)] bg-[linear-gradient(145deg,#141510,#0d0e0b)] p-5">
          <span className="grid size-12 shrink-0 place-items-center rounded-full bg-[rgba(214,170,91,0.1)] text-[#d6aa5b]">
            <MapPin className="size-[1.2rem]" />
          </span>
          <div>
            <small className="text-[0.55rem] font-bold tracking-[0.14em] text-[#c49343] uppercase">
              Onde estamos
            </small>
            <h2 className="my-[0.2rem] font-serif text-[1.35rem]">Visite a Barbearia DonFlow</h2>
            <address className="text-[0.7rem] leading-[1.45] text-[#999b93] not-italic">
              {shop.data.data.address}
            </address>
          </div>
        </section>
      )}

      <section className="px-[clamp(1.25rem,5vw,4rem)] py-8">
        <header className="flex items-end justify-between">
          <div>
            <span className="text-[0.62rem] font-bold tracking-[0.13em] text-[#c49343] uppercase">
              A nossa equipa
            </span>
            <h2 className="mt-1 mb-0 font-serif text-[2rem]">Profissionais</h2>
          </div>
        </header>
        <div className="mt-5 grid grid-cols-[repeat(auto-fit,minmax(9rem,11rem))] justify-center gap-3 max-[620px]:grid-cols-[repeat(auto-fit,minmax(8rem,10rem))]">
          {barbers.data?.data.map((barber) => (
            <article
              key={barber.id}
              className="flex flex-col items-center rounded-xl border border-[rgba(218,175,96,0.12)] bg-panel px-[0.8rem] py-[1.2rem] text-center"
            >
              <span className="mb-[0.7rem] grid size-16 place-items-center rounded-full border-2 border-[#aa7934] bg-[#272118] font-[Georgia,serif] text-gold-light">
                {barber.user.profileImageDataUrl ? (
                  <img
                    src={barber.user.profileImageDataUrl}
                    alt=""
                    className="size-full rounded-[inherit] object-cover"
                  />
                ) : (
                  initials(barber.displayName)
                )}
              </span>
              <strong className="text-[0.75rem]">{barber.displayName}</strong>
              <small className="mt-[0.3rem] text-[0.6rem] text-[#777a73]">
                Profissional DonFlow
              </small>
            </article>
          ))}
          {barbers.isLoading && <p>A carregar profissionais…</p>}
        </div>
      </section>

      <section className="grid grid-cols-4 gap-[0.65rem] px-[clamp(1.25rem,5vw,4rem)] py-8 max-[620px]:grid-cols-2">
        <article className="flex min-h-24 flex-col items-center justify-center gap-[0.55rem] border-t border-[rgba(214,170,91,0.15)] text-center text-[#a7a69f]">
          <Sparkles className="text-[#c49343]" />
          <strong className="max-w-[9rem] text-[0.62rem] font-medium">Ambiente premium</strong>
        </article>
        <article className="flex min-h-24 flex-col items-center justify-center gap-[0.55rem] border-t border-[rgba(214,170,91,0.15)] text-center text-[#a7a69f]">
          <Award className="text-[#c49343]" />
          <strong className="max-w-[9rem] text-[0.62rem] font-medium">
            Profissionais especializados
          </strong>
        </article>
        <article className="flex min-h-24 flex-col items-center justify-center gap-[0.55rem] border-t border-[rgba(214,170,91,0.15)] text-center text-[#a7a69f]">
          <ShieldCheck className="text-[#c49343]" />
          <strong className="max-w-[9rem] text-[0.62rem] font-medium">Serviço de confiança</strong>
        </article>
        <article className="flex min-h-24 flex-col items-center justify-center gap-[0.55rem] border-t border-[rgba(214,170,91,0.15)] text-center text-[#a7a69f]">
          <Scissors className="text-[#c49343]" />
          <strong className="max-w-[9rem] text-[0.62rem] font-medium">
            Serviços personalizados
          </strong>
        </article>
      </section>
      {bookingNotice && (
        <div
          className="fixed inset-0 z-[120] grid place-items-center bg-[rgba(0,0,0,0.78)] p-5 backdrop-blur-[5px]"
          role="presentation"
          onMouseDown={() => setBookingNotice(false)}
        >
          <section
            className="relative w-[min(100%,28rem)] rounded-[0.85rem] border border-[rgba(214,170,91,0.28)] bg-[linear-gradient(145deg,#171813,#0d0e0c)] p-8 text-center shadow-[0_1.5rem_5rem_rgba(0,0,0,0.55)]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="booking-notice-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              className="absolute top-3 right-3 grid size-8 cursor-pointer place-items-center border-0 bg-transparent text-[#85877f]"
              type="button"
              aria-label="Fechar"
              onClick={() => setBookingNotice(false)}
            >
              <X className="size-4" />
            </button>
            <span className="mx-auto mb-4 grid size-12 place-items-center rounded-full bg-[rgba(214,170,91,0.1)] text-[#d6aa5b]">
              <AlertCircle />
            </span>
            <h2 id="booking-notice-title" className="m-0 font-serif text-[1.7rem]">
              Não foi possível iniciar a marcação
            </h2>
            <p className="mt-[0.8rem] mb-[1.4rem] text-[0.76rem] leading-[1.7] text-[#a2a49c]">
              {user.customerBookingBlocked
                ? 'Neste momento, não foi possível efetuar uma nova marcação. Entra em contacto com a barbearia para podermos ajudar.'
                : 'Não é possível efetuar uma nova marcação devido a uma ausência injustificada. Entra em contacto com a barbearia para efetuar a próxima marcação.'}
            </p>
            <button
              className={customerPrimaryButton}
              type="button"
              onClick={() => setBookingNotice(false)}
            >
              Compreendi
            </button>
          </section>
        </div>
      )}
    </main>
  );
}

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}
