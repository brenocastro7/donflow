import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CalendarDays, Home, Star, UserRound, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import type { AuthenticatedUser } from '../features/auth/auth-api';
import { getAccessToken } from '../features/auth/auth-session';
import {
  getNotifications,
  clearNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../features/notifications/notifications-api';
import { SiteFooter } from '../shared/components/site-footer';
import { getMyAppointments } from '../features/appointments/appointments-api';
import { createReview, getMyReviews } from '../features/reviews/reviews-api';
import { ApiError } from '../lib/api/api-error';
import { useOutsidePress } from '../shared/hooks/use-outside-press';
import { cn } from '@/lib/utils';
import { customerPrimaryButton } from '../pages/customer-portal-styles';

export function CustomerLayout({ user }: { user: AuthenticatedUser }) {
  const location = useLocation();
  const navigate = useNavigate();
  const token = getAccessToken()!;
  const queryClient = useQueryClient();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [reviewClosed, setReviewClosed] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [reviewError, setReviewError] = useState<string | null>(null);
  const notificationsRef = useOutsidePress<HTMLElement>(notificationsOpen, () =>
    setNotificationsOpen(false),
  );
  const notifications = useQuery({
    queryKey: ['notifications', token],
    queryFn: () => getNotifications(token),
    refetchInterval: 15_000,
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['notifications', token] });
  const read = useMutation({
    mutationFn: (id: string) => markNotificationRead(token, id),
    onSuccess: refresh,
  });
  const readAll = useMutation({
    mutationFn: () => markAllNotificationsRead(token),
    onSuccess: refresh,
  });
  const clearAll = useMutation({ mutationFn: () => clearNotifications(token), onSuccess: refresh });
  const unread = notifications.data?.meta.unread ?? 0;
  const completedAppointments = useQuery({
    queryKey: ['customer', 'appointments', 'history'],
    queryFn: () => getMyAppointments(token, 'history'),
  });
  const reviews = useQuery({
    queryKey: ['customer', 'reviews'],
    queryFn: () => getMyReviews(token),
  });
  const reviewedAppointmentIds = new Set(reviews.data?.data.map((item) => item.appointmentId));
  const requestedReviewId = new URLSearchParams(location.search).get('review');
  const reviewCandidates =
    completedAppointments.data?.data.filter(
      (appointment) =>
        appointment.status === 'COMPLETED' && !reviewedAppointmentIds.has(appointment.id),
    ) ?? [];
  const pendingReview = requestedReviewId
    ? reviewCandidates.find((appointment) => appointment.id === requestedReviewId)
    : reviewCandidates[0];
  const closeReview = () => {
    setReviewClosed(true);
    if (requestedReviewId) navigate(location.pathname, { replace: true });
  };
  useEffect(() => {
    if (requestedReviewId) setReviewClosed(false);
  }, [requestedReviewId]);
  const review = useMutation({
    mutationFn: () =>
      createReview(token, {
        appointmentId: pendingReview!.id,
        rating,
        ...(comment.trim() ? { comment: comment.trim() } : {}),
      }),
    onSuccess: async () => {
      setRating(0);
      setComment('');
      setReviewError(null);
      if (requestedReviewId) navigate(location.pathname, { replace: true });
      await queryClient.invalidateQueries({ queryKey: ['customer', 'reviews'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (error) =>
      setReviewError(
        error instanceof ApiError ? error.message : 'Não foi possível enviar a avaliação.',
      ),
  });
  return (
    <div className="min-h-screen bg-[#090a08] text-[#f4efe6]">
      <header
        className="fixed inset-x-0 top-0 z-20 flex h-[4.5rem] items-center justify-between border-b border-[rgba(214,170,91,0.14)] bg-[rgba(8,9,7,0.88)] px-5 backdrop-blur-[16px]"
        ref={notificationsRef}
      >
        <div className="flex items-center gap-[0.55rem] uppercase">
          <span className="text-[0.55rem] tracking-[0.18em] text-[#b98a3f]">Barbearia</span>
          <strong className="font-serif text-[1.3rem]">DonFlow</strong>
        </div>
        <button
          type="button"
          aria-label="Notificações"
          aria-expanded={notificationsOpen}
          onClick={() => setNotificationsOpen((open) => !open)}
          className="relative grid cursor-pointer place-items-center border-0 bg-transparent text-[#d6aa5b]"
        >
          <Bell size={20} />
          {unread > 0 && (
            <span className="absolute -top-[0.55rem] -right-[0.55rem] grid h-[1.15rem] min-w-[1.15rem] place-items-center rounded-2xl border-2 border-[#090a08] bg-[#d6aa5b] px-[0.2rem] text-[0.55rem] font-extrabold text-[#161107]">
              {Math.min(unread, 99)}
            </span>
          )}
        </button>
        {notificationsOpen && (
          <section
            className="absolute top-[calc(100%+0.5rem)] right-4 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-[rgba(214,170,91,0.22)] bg-[rgba(14,15,12,0.99)] shadow-[0_1.5rem_3rem_rgba(0,0,0,0.5)]"
            aria-label="Central de notificações"
          >
            <header className="flex items-center justify-between gap-2 border-b border-[rgba(225,216,197,0.09)] px-4 py-[0.85rem]">
              <div className="flex flex-col gap-[0.15rem]">
                <strong className="text-[0.78rem]">Notificações</strong>
                <span className="text-[0.58rem] text-[#85877f]">{unread} por ler</span>
              </div>
              <div className="flex items-center justify-end gap-[0.55rem]">
                {unread > 0 && (
                  <button
                    type="button"
                    onClick={() => readAll.mutate()}
                    className="cursor-pointer border-0 bg-transparent text-[0.58rem] text-[#d6aa5b]"
                  >
                    Marcar como lidas
                  </button>
                )}
                {Boolean(notifications.data?.data.length) && (
                  <button
                    type="button"
                    onClick={() => clearAll.mutate()}
                    className="cursor-pointer border-0 bg-transparent text-[0.58rem] text-[#cf707e]"
                  >
                    Limpar
                  </button>
                )}
              </div>
            </header>
            <div className="[scrollbar-color:#76572c_#11120f] [scrollbar-width:thin] max-h-[min(18rem,55vh)] overflow-y-auto overscroll-contain">
              {notifications.data?.data.map((notification) => (
                <button
                  className={cn(
                    'relative grid w-full cursor-pointer gap-1 border-0 border-b border-[rgba(225,216,197,0.07)] bg-transparent px-4 py-[0.85rem] text-left text-[#eee]',
                    !notification.readAt && 'bg-[rgba(201,154,76,0.09)]',
                  )}
                  type="button"
                  key={notification.id}
                  onClick={() => read.mutate(notification.id)}
                >
                  {!notification.readAt && (
                    <span className="absolute top-4 left-[0.35rem] size-[0.3rem] rounded-full bg-[#d6aa5b]" />
                  )}
                  <strong className="text-[0.72rem]">{notification.title}</strong>
                  <span className="text-[0.65rem] leading-[1.4] text-[#91938b]">
                    {notification.message}
                  </span>
                  <time className="text-[0.56rem] text-[#c49343]">
                    {formatNotificationDate(notification.scheduledAt)}
                  </time>
                </button>
              ))}
              {!notifications.isLoading && !notifications.data?.data.length && (
                <p className="m-0 px-4 py-8 text-center text-[0.68rem] text-[#777a73]">
                  Não existem notificações.
                </p>
              )}
            </div>
          </section>
        )}
      </header>
      <div className="min-h-screen pb-[4.8rem]">
        <Outlet context={user} />
        <SiteFooter compact />
      </div>
      <nav
        className="fixed inset-x-0 bottom-0 z-30 grid h-[calc(4.6rem+env(safe-area-inset-bottom))] grid-cols-3 border-t border-[rgba(214,170,91,0.16)] bg-[rgba(10,11,9,0.97)] pb-[env(safe-area-inset-bottom)]"
        aria-label="Navegação do cliente"
      >
        <NavLink
          to="/customer"
          end
          className={({ isActive }) =>
            cn(
              'flex flex-col items-center justify-center gap-[0.3rem] text-[0.6rem] no-underline',
              isActive ? 'text-[#d6aa5b]' : 'text-[#7d7f78]',
            )
          }
        >
          <Home size={20} />
          <span>Início</span>
        </NavLink>
        <NavLink
          to="/customer/appointments"
          className={({ isActive }) =>
            cn(
              'flex flex-col items-center justify-center gap-[0.3rem] text-[0.6rem] no-underline',
              isActive ? 'text-[#d6aa5b]' : 'text-[#7d7f78]',
            )
          }
        >
          <CalendarDays size={20} />
          <span>Marcações</span>
        </NavLink>
        <NavLink
          to="/customer/account"
          className={({ isActive }) =>
            cn(
              'flex flex-col items-center justify-center gap-[0.3rem] text-[0.6rem] no-underline',
              isActive ? 'text-[#d6aa5b]' : 'text-[#7d7f78]',
            )
          }
        >
          <UserRound size={20} />
          <span>Conta</span>
        </NavLink>
      </nav>
      {pendingReview && !reviewClosed && (
        <div
          className="fixed inset-0 z-[120] grid place-items-center bg-black/80 p-5 backdrop-blur-[6px]"
          role="presentation"
        >
          <section
            className="relative w-[min(100%,29rem)] rounded-[0.9rem] border border-[rgba(214,170,91,0.28)] bg-[linear-gradient(145deg,#171813,#0d0e0c)] p-8 text-center shadow-[0_2rem_6rem_rgba(0,0,0,0.62)]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="customer-review-title"
          >
            <button
              className="absolute top-3 right-3 grid size-8 cursor-pointer place-items-center border-0 bg-transparent text-[#85877f]"
              type="button"
              aria-label="Fechar"
              onClick={closeReview}
            >
              <X className="size-4" />
            </button>
            <span className="mx-auto mb-[0.85rem] grid size-12 place-items-center rounded-full bg-[rgba(214,170,91,0.1)] text-[#d6aa5b]">
              <Star />
            </span>
            <p className="m-0 text-[0.58rem] font-bold tracking-[0.14em] text-[#c49343] uppercase">
              A tua opinião é importante
            </p>
            <h2 id="customer-review-title" className="my-[0.45rem] font-serif text-[1.9rem]">
              Como foi a tua experiência?
            </h2>
            <small className="text-[0.68rem] text-[#85877f]">
              {pendingReview.serviceNameSnapshot} com {pendingReview.barberProfile.displayName}
            </small>
            <div
              className="my-5 flex justify-center gap-[0.35rem]"
              role="radiogroup"
              aria-label="Classificação"
            >
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={rating === value}
                  aria-label={`${value} estrelas`}
                  className={cn(
                    'grid size-[2.45rem] cursor-pointer place-items-center rounded-full border border-[rgba(214,170,91,0.18)] bg-[#0b0c09] text-[#62563f]',
                    value <= rating &&
                      'border-[rgba(214,170,91,0.55)] bg-[rgba(214,170,91,0.1)] text-[#e0ad41]',
                  )}
                  onClick={() => setRating(value)}
                >
                  <Star className="size-[1.15rem] fill-current" />
                </button>
              ))}
            </div>
            <label className="grid gap-[0.4rem] text-left text-[0.68rem] text-[#aaa9a2]">
              Comentário <span className="text-[#70736c]">(opcional)</span>
              <textarea
                maxLength={500}
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                placeholder="Conta-nos como correu o serviço..."
                className="min-h-[6.5rem] resize-y rounded-lg border border-[rgba(225,216,197,0.12)] bg-[#0b0c09] p-3 leading-[1.5] text-[#eee] outline-0 focus:border-[rgba(214,170,91,0.6)] focus:shadow-[0_0_0_3px_rgba(214,170,91,0.08)]"
              />
            </label>
            {reviewError && (
              <div className="mt-3 text-[0.66rem] text-[#df8e8e]">{reviewError}</div>
            )}
            <button
              className={cn(customerPrimaryButton, 'mt-4')}
              type="button"
              disabled={!rating || review.isPending}
              onClick={() => review.mutate()}
            >
              {review.isPending ? 'A enviar…' : 'Enviar avaliação'}
            </button>
            <button
              className="mt-[0.8rem] cursor-pointer border-0 bg-transparent text-[0.65rem] text-[#85877f]"
              type="button"
              onClick={closeReview}
            >
              Avaliar mais tarde
            </button>
          </section>
        </div>
      )}
    </div>
  );
}

function formatNotificationDate(value: string) {
  return new Intl.DateTimeFormat('pt-PT', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Europe/Lisbon',
  }).format(new Date(value));
}
