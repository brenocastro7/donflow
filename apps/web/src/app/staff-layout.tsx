import {
  Bell,
  CalendarDays,
  LayoutDashboard,
  LogOut,
  Scissors,
  Settings,
  UserRound,
  UsersRound,
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router';
import { logout, type AuthenticatedUser } from '../features/auth/auth-api';
import { clearAccessToken, getAccessToken } from '../features/auth/auth-session';
import {
  getNotifications,
  clearNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationsResponse,
} from '../features/notifications/notifications-api';
import { useOutsidePress } from '../shared/hooks/use-outside-press';
import { useRole } from '../shared/hooks/use-role';
import { SiteFooter } from '../shared/components/site-footer';
import { cn } from '@/lib/utils';

const iconButton = 'relative grid size-[2.6rem] cursor-pointer place-items-center border-0 bg-transparent max-[720px]:size-[2.6rem]';
const notificationsPanel =
  'absolute top-[calc(100%+0.55rem)] right-0 w-[min(20rem,calc(100vw-var(--sidebar)-2rem))] overflow-hidden rounded-[0.85rem] border border-[rgba(200,154,75,0.24)] bg-[rgba(15,16,13,0.98)] shadow-[0_1rem_2.5rem_rgba(0,0,0,0.45)] max-[720px]:top-[calc(100%+0.5rem)] max-[720px]:right-4 max-[720px]:left-4 max-[720px]:w-auto';

const navigation = [
  { label: 'Agenda', icon: CalendarDays, to: '/', available: true },
  { label: 'Dashboard', icon: LayoutDashboard, to: '/dashboard', available: true },
  { label: 'Clientes', icon: UsersRound, to: '/customers', available: true, masterOnly: true },
  { label: 'Equipa', icon: UserRound, to: '/barbers', available: true, masterOnly: true },
  { label: 'Serviços', icon: Scissors, to: '/services', available: true },
  { label: 'Definições', icon: Settings, to: '/settings', available: true },
];

export function StaffLayout({ user }: { user: AuthenticatedUser }) {
  const { isMaster } = useRole(user.role);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const accessToken = getAccessToken()!;
  const [notificationsTarget, setNotificationsTarget] = useState<'desktop' | 'mobile' | null>(null);
  const notificationsQuery = useQuery({
    queryKey: ['notifications', accessToken],
    queryFn: () => getNotifications(accessToken),
    refetchInterval: 15_000,
  });
  const refreshNotifications = () =>
    queryClient.invalidateQueries({ queryKey: ['notifications', accessToken] });
  const readNotification = useMutation({
    mutationFn: (id: string) => markNotificationRead(accessToken, id),
    onSuccess: refreshNotifications,
  });
  const readAllNotifications = useMutation({
    mutationFn: () => markAllNotificationsRead(accessToken),
    onSuccess: refreshNotifications,
  });
  const clearAllNotifications = useMutation({
    mutationFn: () => clearNotifications(accessToken),
    onSuccess: refreshNotifications,
  });
  const unreadNotifications = notificationsQuery.data?.meta.unread ?? 0;
  const desktopNotificationsRef = useOutsidePress<HTMLElement>(
    notificationsTarget === 'desktop',
    () => setNotificationsTarget(null),
  );
  const mobileNotificationsRef = useOutsidePress<HTMLElement>(
    notificationsTarget === 'mobile',
    () => setNotificationsTarget(null),
  );
  const visibleNavigation = navigation.filter(({ masterOnly }) => !masterOnly || isMaster);

  const signOut = async () => {
    await logout(accessToken).catch(() => undefined);
    clearAccessToken();
    navigate('/staff/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_75%_8%,rgba(151,106,45,0.08),transparent_25rem),linear-gradient(rgba(255,255,255,0.012)_1px,transparent_1px)] bg-[length:auto,100%_4rem] text-text">
      <aside className="fixed inset-y-0 left-0 z-20 flex w-[var(--sidebar)] flex-col border-r border-border bg-[rgba(9,10,8,0.96)] backdrop-blur-[20px] max-[720px]:hidden">
        <div className="flex min-h-[10.5rem] flex-col items-center justify-center border-b border-border">
          <span className="text-[0.62rem] font-bold tracking-[0.38em] text-gold-light uppercase">
            Barbearia
          </span>
          <strong className="font-serif text-[2.25rem] tracking-[0.05em] uppercase">
            DonFlow
          </strong>
          <span className="mt-[0.65rem] flex text-gold" aria-hidden="true">
            <Scissors size={15} />
          </span>
        </div>
        <nav className="grid gap-[0.4rem] p-4 px-4 py-6" aria-label="Navegação principal">
          {visibleNavigation.map(({ label, icon: Icon, to, available }) =>
            available ? (
              <NavLink
                className={({ isActive }) =>
                  cn(
                    'flex min-h-[3.15rem] items-center gap-[0.9rem] rounded-[0.65rem] border border-transparent px-4 text-[0.9rem] text-[#a8aaa3] no-underline transition-colors duration-150 hover:bg-white/[0.035] hover:text-text',
                    isActive &&
                      'border-[rgba(200,154,75,0.25)] bg-[linear-gradient(90deg,rgba(200,154,75,0.23),rgba(200,154,75,0.08))] text-text [&_svg]:text-gold-light',
                  )
                }
                end={to === '/'}
                to={to}
                key={label}
              >
                <Icon size={19} strokeWidth={1.7} />
                <span>{label}</span>
              </NavLink>
            ) : (
              <span
                className="flex min-h-[3.15rem] cursor-not-allowed items-center gap-[0.9rem] rounded-[0.65rem] border border-transparent px-4 text-[0.9rem] text-[#a8aaa3] opacity-45"
                key={label}
              >
                <Icon size={19} strokeWidth={1.7} />
                <span>{label}</span>
              </span>
            ),
          )}
        </nav>
        <div className="mt-auto grid grid-cols-[auto_1fr_auto] items-center gap-3 border-t border-border p-5 text-left text-text">
          <span className="relative grid size-[2.6rem] shrink-0 place-items-center overflow-hidden rounded-full border border-[rgba(199,155,79,0.38)] bg-[#242017] text-[0.75rem] font-bold text-gold-light">
            {user.profileImageDataUrl ? (
              <img src={user.profileImageDataUrl} alt="" className="size-full object-cover" />
            ) : (
              initials(user.name)
            )}
          </span>
          <div>
            <strong className="block text-[0.82rem]">{user.name}</strong>
            <span className="mt-[0.2rem] block text-[0.7rem] text-gold-light">Sair da conta</span>
          </div>
          <button
            type="button"
            onClick={signOut}
            aria-label="Terminar sessão"
            className="grid size-[2.2rem] cursor-pointer place-items-center rounded-full border-0 bg-transparent text-[#a7a9a2] hover:bg-white/[0.04] hover:text-gold-light"
          >
            <LogOut size={17} />
          </button>
        </div>
      </aside>

      <header
        className="fixed top-4 right-4 z-[16] max-[720px]:hidden"
        ref={desktopNotificationsRef}
        data-testid="desktop-page-header"
      >
        <button
          className={cn(
            iconButton,
            'rounded-full border border-[rgba(200,154,75,0.2)] bg-[rgba(11,12,10,0.88)] text-gold-light shadow-[0_0.65rem_1.5rem_rgba(0,0,0,0.28)] backdrop-blur-[14px]',
          )}
          type="button"
          aria-expanded={notificationsTarget === 'desktop'}
          aria-label="Notificações"
          aria-controls="desktop-staff-notifications"
          onClick={() =>
            setNotificationsTarget((target) => (target === 'desktop' ? null : 'desktop'))
          }
        >
          <Bell size={21} />
          {unreadNotifications > 0 && (
            <span className="absolute -top-1 -right-1 grid h-[1.15rem] min-w-[1.15rem] place-items-center rounded-full border-2 border-[#0b0c0a] bg-gold-light px-[0.22rem] text-[0.6rem] font-extrabold text-[#0b0c0a]">
              {Math.min(unreadNotifications, 99)}
            </span>
          )}
        </button>
        {notificationsTarget === 'desktop' && (
          <NotificationsPanel
            id="desktop-staff-notifications"
            response={notificationsQuery.data}
            onRead={(id) => readNotification.mutate(id)}
            onReadAll={() => readAllNotifications.mutate()}
            onClear={() => clearAllNotifications.mutate()}
          />
        )}
      </header>

      <header
        className="relative z-[12] hidden min-h-[4.25rem] grid-cols-[2.6rem_1fr_auto] items-center border-b border-border bg-[rgba(8,9,7,0.9)] px-4 backdrop-blur-[16px] max-[720px]:sticky max-[720px]:top-0 max-[720px]:grid"
        ref={mobileNotificationsRef}
        data-testid="mobile-header"
      >
        <button
          className={iconButton}
          type="button"
          aria-expanded={notificationsTarget === 'mobile'}
          aria-label="Notificações"
          aria-controls="mobile-staff-notifications"
          onClick={() =>
            setNotificationsTarget((target) => (target === 'mobile' ? null : 'mobile'))
          }
        >
          <Bell size={21} />
          {unreadNotifications > 0 && (
            <span className="absolute -top-1 -right-1 grid h-[1.15rem] min-w-[1.15rem] place-items-center rounded-full border-2 border-[#0b0c0a] bg-gold-light px-[0.22rem] text-[0.6rem] font-extrabold text-[#0b0c0a]">
              {Math.min(unreadNotifications, 99)}
            </span>
          )}
        </button>
        <div className="font-serif text-[1.45rem] tracking-[0.05em] uppercase text-center">
          DonFlow
        </div>
        <div className="flex items-center justify-end gap-1">
          <button
            className={iconButton}
            type="button"
            aria-label="Definições da conta"
            onClick={() => navigate('/settings')}
          >
            <Settings size={21} />
          </button>
          <button
            className={cn(iconButton, 'text-[#c98d83]')}
            type="button"
            aria-label="Terminar sessão"
            title="Terminar sessão"
            onClick={signOut}
          >
            <LogOut size={20} />
          </button>
        </div>
        {notificationsTarget === 'mobile' && (
          <NotificationsPanel
            id="mobile-staff-notifications"
            response={notificationsQuery.data}
            onRead={(id) => readNotification.mutate(id)}
            onReadAll={() => readAllNotifications.mutate()}
            onClear={() => clearAllNotifications.mutate()}
          />
        )}
      </header>

      <div className="min-h-screen min-w-0 ml-[var(--sidebar)] max-[720px]:ml-0 max-[720px]:pb-[calc(4.6rem+env(safe-area-inset-bottom))]">
        <Outlet context={user} />
        <SiteFooter compact />
      </div>

      <nav
        className="hidden max-[720px]:fixed! max-[720px]:right-0 max-[720px]:bottom-0 max-[720px]:left-0 max-[720px]:z-[14] max-[720px]:grid max-[720px]:h-[calc(4.6rem+env(safe-area-inset-bottom))] max-[720px]:w-screen max-[720px]:grid-cols-5 max-[720px]:border-t max-[720px]:border-border max-[720px]:bg-[rgba(9,10,8,0.96)] max-[720px]:pb-[env(safe-area-inset-bottom)] max-[720px]:shadow-[0_-0.6rem_1.5rem_rgba(0,0,0,0.28)] max-[720px]:backdrop-blur-[18px] max-[720px]:[transform:translateZ(0)] max-[720px]:[will-change:transform]"
        aria-label="Navegação móvel"
      >
        {visibleNavigation.slice(0, 5).map(({ label, icon: Icon, to, available }) =>
          available ? (
            <NavLink
              className={({ isActive }) =>
                cn(
                  'flex min-w-0 flex-col items-center justify-center gap-[0.3rem] text-[0.58rem] text-[#73766e] no-underline',
                  isActive && 'text-gold-light',
                )
              }
              end={to === '/'}
              to={to}
              key={label}
            >
              <Icon size={20} strokeWidth={1.8} />
              <span>{label}</span>
            </NavLink>
          ) : (
            <span
              className="flex min-w-0 flex-col items-center justify-center gap-[0.3rem] text-[0.58rem] text-[#73766e] opacity-[0.42]"
              key={label}
            >
              <Icon size={20} strokeWidth={1.8} />
              <span>{label}</span>
            </span>
          ),
        )}
      </nav>
    </div>
  );
}

function NotificationsPanel({
  id,
  response,
  onRead,
  onReadAll,
  onClear,
}: {
  id: string;
  response?: NotificationsResponse;
  onRead: (id: string) => void;
  onReadAll: () => void;
  onClear: () => void;
}) {
  const unread = response?.meta.unread ?? 0;
  const notifications = response?.data ?? [];
  return (
    <section className={notificationsPanel} id={id} aria-label="Notificações">
      <div className="flex items-center justify-between border-b border-border px-4 py-[0.9rem]">
        <strong className="text-[0.82rem]">Notificações</strong>
        <div className="flex items-center justify-end gap-[0.65rem]">
          {unread > 0 && (
            <button
              type="button"
              onClick={onReadAll}
              className="cursor-pointer border-0 bg-transparent font-[inherit] text-[0.65rem] text-gold-light"
            >
              Marcar como lidas
            </button>
          )}
          {notifications.length > 0 ? (
            <button
              type="button"
              onClick={onClear}
              className="cursor-pointer border-0 bg-transparent font-[inherit] text-[0.65rem] text-[#cf707e]"
            >
              Limpar
            </button>
          ) : (
            <span className="text-[0.65rem] text-gold-light">Sem novas</span>
          )}
        </div>
      </div>
      {notifications.length === 0 ? (
        <div className="flex min-h-24 items-center justify-center gap-[0.55rem] p-4 text-muted">
          <Bell size={20} aria-hidden="true" />
          <p className="m-0 text-[0.75rem]">Não existem notificações.</p>
        </div>
      ) : (
        <div className="max-h-[min(18rem,55vh)] overflow-y-auto">
          {notifications.map((notification) => (
            <button
              className={cn(
                'relative grid w-full cursor-pointer gap-[0.22rem] border-0 border-b border-border bg-transparent px-4 py-[0.8rem] text-left text-text',
                !notification.readAt && 'bg-[rgba(200,154,75,0.09)]',
              )}
              type="button"
              key={notification.id}
              onClick={() => onRead(notification.id)}
            >
              {!notification.readAt && (
                <span className="absolute top-4 left-[0.35rem] size-[0.3rem] rounded-full bg-gold-light" />
              )}
              <strong className="text-[0.75rem]">{notification.title}</strong>
              <span className="text-[0.69rem] leading-[1.4] text-muted">
                {notification.message}
              </span>
              <time dateTime={notification.scheduledAt} className="text-[0.61rem] text-gold-light">
                {formatNotificationDate(notification.scheduledAt)}
              </time>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function formatNotificationDate(value: string) {
  return new Intl.DateTimeFormat('pt-PT', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase('pt-PT'))
    .join('');
}
