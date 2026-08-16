import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CalendarOff,
  Camera,
  CheckCircle2,
  Clock3,
  KeyRound,
  LogOut,
  MapPin,
  Save,
  Trash2,
  UserRound,
} from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { useStaffUser } from '../app/staff-context';
import {
  changePassword,
  confirmMfa,
  deleteProfileImage,
  disableMfa,
  getSessions,
  revokeSession,
  setupMfa,
  updateProfileImage,
} from '../features/auth/auth-api';
import { clearAccessToken, getAccessToken } from '../features/auth/auth-session';
import { isStrongPassword, STRONG_PASSWORD_MESSAGE } from '../features/auth/password-policy';
import { ApiError } from '../lib/api/api-error';
import { AvatarImageEditor } from '../shared/components/avatar-image-editor';
import { PhoneInput } from '../shared/components/phone-input';
import { optionalPhone } from '../shared/components/phone-value';
import { PasswordStrength } from '../shared/components/password-strength';
import { useRole } from '../shared/hooks/use-role';
import {
  createScheduleBlock,
  deleteScheduleBlock,
  getAccountSettings,
  getBusinessHours,
  getScheduleBlocks,
  getShopSettings,
  updateAccountSettings,
  updateBusinessHours,
  updateShopAddress,
  updateShopHours,
  type BusinessHour,
  type DayOfWeek,
} from '../features/settings/settings-api';
import { cn } from '@/lib/utils';

const cardClass =
  'flex min-w-0 flex-col gap-4 rounded-[0.8rem] border border-[rgba(226,216,195,0.1)] bg-[#10110e] p-5';
const cardHeader =
  'flex items-center gap-[0.8rem] border-b border-[rgba(226,216,195,0.08)] pb-[0.9rem] [&>svg]:text-gold-accent';
const cardHeaderTitle = 'm-0 text-base';
const cardHeaderDesc = 'mt-[0.2rem] mb-0 text-[0.68rem] text-[#7f827a]';
const cardLabel = 'grid gap-[0.4rem] text-[0.7rem] text-[#a9aba4]';
const cardInput =
  'min-h-[2.8rem] min-w-0 rounded-lg border border-[rgba(226,216,195,0.12)] bg-[#0b0c09] px-3 text-text outline-0';
const goldOutlineButton =
  'mt-auto flex min-h-[2.65rem] cursor-pointer items-center justify-center gap-[0.45rem] rounded-lg border border-[rgba(211,167,91,0.45)] bg-[rgba(211,167,91,0.08)] px-[0.9rem] text-[0.7rem] font-bold text-[#e7c27e] disabled:cursor-default disabled:opacity-60';

const days: Array<{ value: DayOfWeek; label: string }> = [
  { value: 'MONDAY', label: 'Segunda-feira' },
  { value: 'TUESDAY', label: 'Terça-feira' },
  { value: 'WEDNESDAY', label: 'Quarta-feira' },
  { value: 'THURSDAY', label: 'Quinta-feira' },
  { value: 'FRIDAY', label: 'Sexta-feira' },
  { value: 'SATURDAY', label: 'Sábado' },
  { value: 'SUNDAY', label: 'Domingo' },
];
const toTime = (minute: number) =>
  `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
const toMinute = (time: string) => {
  const [hour, minute] = time.split(':').map(Number);
  return hour * 60 + minute;
};

export function SettingsPage() {
  const user = useStaffUser();
  const { isMaster } = useRole(user.role);
  const token = getAccessToken()!;
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const tabs = isMaster
    ? (['account', 'shop', 'agenda'] as const)
    : (['account', 'agenda'] as const);
  const [tab, setTab] = useState<(typeof tabs)[number]>('account');
  const account = useQuery({
    queryKey: ['settings', 'account'],
    queryFn: () => getAccountSettings(token),
  });
  const shop = useQuery({
    queryKey: ['settings', 'shop'],
    queryFn: () => getShopSettings(token),
    enabled: isMaster,
  });
  const hours = useQuery({
    queryKey: ['settings', 'hours', user.barberProfileId],
    queryFn: () => getBusinessHours(token, user.barberProfileId!),
    enabled: Boolean(user.barberProfileId),
  });
  const blocks = useQuery({
    queryKey: ['settings', 'blocks', user.barberProfileId],
    queryFn: () => getScheduleBlocks(token, user.barberProfileId!),
    enabled: Boolean(user.barberProfileId),
  });
  const activeSessions = useQuery({
    queryKey: ['auth', 'sessions'],
    queryFn: () => getSessions(token),
    enabled: tab === 'account',
  });
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [accountPassword, setAccountPassword] = useState('');
  const [address, setAddress] = useState('');
  const [hoursDraft, setHoursDraft] = useState<BusinessHour[]>([]);
  const [shopHoursDraft, setShopHoursDraft] = useState<BusinessHour[]>([]);
  const [lunchStart, setLunchStart] = useState('13:00');
  const [lunchEnd, setLunchEnd] = useState('15:00');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [mfaPassword, setMfaPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [photoToEdit, setPhotoToEdit] = useState<File | null>(null);
  const [sessionToEnd, setSessionToEnd] = useState<string | null>(null);
  const [mfaSecret, setMfaSecret] = useState<string | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [blockStart, setBlockStart] = useState('');
  const [blockEnd, setBlockEnd] = useState('');
  const [blockReason, setBlockReason] = useState('');
  const [blockCalendarMonth, setBlockCalendarMonth] = useState(() =>
    new Date().toISOString().slice(0, 7),
  );
  const [feedback, setFeedback] = useState('');
  const [feedbackError, setFeedbackError] = useState(false);
  const [shopConfirmation, setShopConfirmation] = useState('');
  useEffect(() => {
    if (account.data) {
      setName(account.data.data.name);
      setEmail(account.data.data.email ?? '');
      setPhone(account.data.data.phone ?? '+351');
    }
  }, [account.data]);
  useEffect(() => {
    if (shop.data) {
      setAddress(shop.data.data.address ?? '');
      if (shop.data.data.businessHours.length) setShopHoursDraft(shop.data.data.businessHours);
    }
  }, [shop.data]);
  useEffect(() => {
    if (hours.data) {
      setHoursDraft(hours.data.data);
      const groupedHours = groupHours(hours.data.data);
      const gap = days
        .map(({ value }) => groupedHours.get(value) ?? [])
        .find((periods) => periods.length > 1);
      if (gap) {
        setLunchStart(toTime(gap[0].endMinute));
        setLunchEnd(toTime(gap[1].startMinute));
      }
      if (isMaster && !shop.data?.data.businessHours.length) {
        setShopHoursDraft(hours.data.data);
      }
    }
  }, [hours.data, shop.data?.data.businessHours.length, isMaster]);

  const saveAccount = useMutation({
    mutationFn: () => {
      const saved = account.data?.data;
      const emailChanged = email.trim().toLowerCase() !== saved?.email;
      const phoneChanged = phone.trim() !== (saved?.phone ?? '+351');
      return updateAccountSettings(token, {
        ...(name.trim() !== saved?.name ? { name: name.trim() } : {}),
        ...(emailChanged ? { email: email.trim() } : {}),
        ...(phoneChanged ? { phone: optionalPhone(phone) } : {}),
        ...(emailChanged || phoneChanged ? { currentPassword: accountPassword } : {}),
      });
    },
    onSuccess: async (response) => {
      setFeedbackError(false);
      setAccountPassword('');
      queryClient.setQueryData(
        ['auth', 'me', token],
        (current: { data: typeof user } | undefined) =>
          current ? { ...current, data: { ...current.data, name: response.data.name } } : current,
      );
      await queryClient.invalidateQueries({ queryKey: ['settings', 'account'] });
      await queryClient.invalidateQueries({ queryKey: ['barbers'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setFeedback(
        response.data.emailConfirmationPending
          ? 'Dados guardados. Enviámos uma confirmação para o novo e-mail.'
          : 'Dados da conta guardados com sucesso.',
      );
    },
    onError: (error) => {
      setFeedbackError(true);
      setFeedback(
        error instanceof ApiError
          ? `Não foi possível guardar: ${error.message}`
          : 'Não foi possível guardar as alterações da conta.',
      );
    },
  });
  const savePassword = useMutation({
    mutationFn: () => changePassword(token, currentPassword, newPassword),
    onSuccess: () => {
      clearAccessToken();
      setCurrentPassword('');
      setNewPassword('');
      navigate('/staff/login', { replace: true });
    },
    onError: (error) => {
      setFeedbackError(true);
      setFeedback(
        error instanceof ApiError ? error.message : 'Não foi possível alterar a palavra-passe.',
      );
    },
  });
  const beginMfa = useMutation({
    mutationFn: () => setupMfa(token, mfaPassword),
    onSuccess: (result) => {
      setMfaSecret(result.data.secret);
      setFeedbackError(false);
      setFeedback('Adiciona a chave à aplicação autenticadora e confirma o código.');
    },
    onError: (error) => {
      setFeedbackError(true);
      setFeedback(
        error instanceof ApiError ? error.message : 'Não foi possível iniciar a configuração.',
      );
    },
  });
  const enableMfa = useMutation({
    mutationFn: () => confirmMfa(token, mfaCode),
    onSuccess: (result) => {
      setRecoveryCodes(result.data.recoveryCodes);
      setMfaSecret(null);
      setFeedbackError(false);
      setFeedback('Autenticação reforçada ativada. Guarda os códigos de recuperação.');
      void queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
    },
  });
  const removeMfa = useMutation({
    mutationFn: () => disableMfa(token, mfaPassword, mfaCode),
    onSuccess: () => {
      setFeedback('Autenticação reforçada desativada. Inicia sessão novamente.');
      setMfaPassword('');
      setMfaCode('');
    },
  });
  const endSession = useMutation({
    mutationFn: (sessionId: string) => revokeSession(token, sessionId),
    onSuccess: async () => {
      setSessionToEnd(null);
      setFeedbackError(false);
      setFeedback('Sessão terminada com sucesso.');
      await queryClient.invalidateQueries({ queryKey: ['auth', 'sessions'] });
    },
    onError: (error) => {
      setFeedbackError(true);
      setFeedback(
        error instanceof ApiError ? error.message : 'Não foi possível terminar a sessão.',
      );
    },
  });
  const completeShopUpdate = async (
    response: Awaited<ReturnType<typeof updateShopAddress>>,
    message: string,
  ) => {
    setFeedbackError(false);
    queryClient.setQueryData(['settings', 'shop'], response);
    await queryClient.invalidateQueries({ queryKey: ['settings'] });
    await queryClient.invalidateQueries({ queryKey: ['customer', 'shop-settings'] });
    setShopConfirmation(message);
    setFeedback(message);
  };
  const failShopUpdate = (error: unknown) => {
    setFeedbackError(true);
    setShopConfirmation('');
    setFeedback(
      error instanceof ApiError
        ? error.message
        : 'Não foi possível guardar as definições da barbearia.',
    );
  };
  const saveShopAddress = useMutation({
    mutationFn: () => updateShopAddress(token, address),
    onSuccess: async (response) => {
      await completeShopUpdate(response, 'Morada atualizada para todos os utilizadores.');
    },
    onError: failShopUpdate,
  });
  const saveShopHours = useMutation({
    mutationFn: () => updateShopHours(token, shopHoursDraft),
    onSuccess: async (response) => {
      await completeShopUpdate(response, 'Horários atualizados para todos os utilizadores.');
    },
    onError: failShopUpdate,
  });
  const saveLunch = useMutation({
    mutationFn: () => {
      const start = toMinute(lunchStart),
        end = toMinute(lunchEnd);
      const grouped = groupHours(hoursDraft);
      const next = days.flatMap(({ value }) => {
        const day = grouped.get(value) ?? [];
        if (!day.length) return [];
        const opening = day[0].startMinute,
          closing = day.at(-1)!.endMinute;
        return opening < start && end < closing
          ? [
              { dayOfWeek: value, startMinute: opening, endMinute: start },
              { dayOfWeek: value, startMinute: end, endMinute: closing },
            ]
          : day;
      });
      return updateBusinessHours(token, user.barberProfileId!, next);
    },
    onSuccess: (response) => {
      setHoursDraft(response.data);
      queryClient.setQueryData(['settings', 'hours', user.barberProfileId], response);
      setFeedback('Intervalo guardado com sucesso.');
    },
  });
  const addBlock = useMutation({
    mutationFn: () =>
      createScheduleBlock(token, user.barberProfileId!, {
        startsAt: new Date(blockStart).toISOString(),
        endsAt: new Date(blockEnd).toISOString(),
        reason: blockReason || undefined,
      }),
    onSuccess: async () => {
      setBlockStart('');
      setBlockEnd('');
      setBlockReason('');
      await queryClient.invalidateQueries({ queryKey: ['settings', 'blocks'] });
      setFeedback('Indisponibilidade adicionada com sucesso.');
    },
  });
  const removeBlock = useMutation({
    mutationFn: (id: string) => deleteScheduleBlock(token, id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['settings', 'blocks'] });
      setFeedback('Indisponibilidade eliminada com sucesso.');
    },
  });
  const photo = useMutation({
    mutationFn: (dataUrl: string) => updateProfileImage(token, dataUrl),
    onSuccess: (session) => {
      queryClient.setQueryData(['auth', 'me', token], session);
      setFeedback('Fotografia atualizada com sucesso.');
    },
  });
  const removePhoto = useMutation({
    mutationFn: () => deleteProfileImage(token),
    onSuccess: (session) => {
      queryClient.setQueryData(['auth', 'me', token], session);
      setFeedback('Fotografia eliminada com sucesso.');
    },
  });
  const shopGrouped = useMemo(() => groupHours(shopHoursDraft), [shopHoursDraft]);
  const changeShopDay = (day: DayOfWeek, open: boolean, start = '09:00', end = '19:00') => {
    setShopConfirmation('');
    setShopHoursDraft((current) => [
      ...current.filter((item) => item.dayOfWeek !== day),
      ...(open ? [{ dayOfWeek: day, startMinute: toMinute(start), endMinute: toMinute(end) }] : []),
    ]);
  };
  const readPhoto = (file?: File) => {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 10_000_000) {
      setFeedbackError(true);
      setFeedback('Seleciona uma imagem JPEG, PNG ou WebP com no máximo 10 MB.');
      return;
    }
    setPhotoToEdit(file);
  };
  const submit = (event: FormEvent, action: () => void) => {
    event.preventDefault();
    setFeedbackError(false);
    action();
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_80%_0,rgba(161,112,45,0.12),transparent_28rem),#080907] p-[3rem_clamp(1rem,4vw,4rem)_5rem] text-text max-[720px]:p-[1.5rem_1rem_6rem]">
      {photoToEdit && (
        <AvatarImageEditor
          file={photoToEdit}
          onCancel={() => setPhotoToEdit(null)}
          onConfirm={(dataUrl) => {
            setPhotoToEdit(null);
            photo.mutate(dataUrl);
          }}
        />
      )}
      <header className="mx-auto max-w-[72rem]">
        <p className="m-0 text-[0.65rem] font-bold tracking-[0.16em] text-gold-accent uppercase">
          Preferências
        </p>
        <h1 className="my-[0.35rem] font-serif text-[clamp(3rem,7vw,5rem)] leading-[0.9] max-[720px]:text-[3.4rem]">
          Definições
        </h1>
        <span className="text-[0.8rem] text-[#92958d]">
          Gerir a conta, a barbearia e a disponibilidade.
        </span>
      </header>
      <nav className="mx-auto my-8 mb-4 flex max-w-[72rem] gap-[0.4rem] rounded-xl border border-[rgba(226,216,195,0.1)] bg-[#10110e] p-[0.3rem] max-[720px]:overflow-auto">
        {tabs.map((item) => (
          <button
            key={item}
            className={cn(
              'min-h-[2.6rem] flex-1 cursor-pointer rounded-lg border-0 bg-transparent text-[#85887f] max-[720px]:min-w-24',
              tab === item &&
                'bg-[linear-gradient(135deg,#e0b96f,#a87934)] font-bold text-[#17130d]',
            )}
            onClick={() => setTab(item)}
          >
            {item === 'account' ? 'Conta' : item === 'shop' ? 'Horários e Morada' : 'Agenda'}
          </button>
        ))}
      </nav>
      {feedback && (
        <div
          className={cn(
            'mx-auto mb-4 flex min-h-[3.2rem] max-w-[72rem] items-center gap-[0.7rem] rounded-[0.65rem] border border-[rgba(80,184,117,0.28)] bg-[rgba(34,91,52,0.28)] px-4 py-[0.7rem] text-[0.75rem] text-[#c9e9d1]',
            '[&>svg]:w-[1.1rem] [&>svg]:text-[#63c783]',
            feedbackError &&
              'border-[rgba(202,92,82,0.32)] bg-[rgba(102,35,30,0.3)] text-[#f0c4be] [&>svg]:text-[#d8776e]',
          )}
          role="status"
        >
          <CheckCircle2 />
          <span className="flex-1">{feedback}</span>
          <button
            type="button"
            onClick={() => setFeedback('')}
            aria-label="Fechar confirmação"
            className="border-0 bg-transparent text-[1.2rem] text-[#c9e9d1]"
          >
            ×
          </button>
        </div>
      )}
      {tab === 'account' && (
        <section className="mx-auto grid max-w-[72rem] grid-cols-2 gap-4 max-[720px]:grid-cols-1">
          <form className={cardClass} onSubmit={(e) => submit(e, () => saveAccount.mutate())}>
            <header className={cardHeader}>
              <UserRound />
              <div>
                <h2 className={cardHeaderTitle}>Dados da conta</h2>
                <p className={cardHeaderDesc}>Informações utilizadas no painel.</p>
              </div>
            </header>
            <label className={cardLabel}>
              Nome
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className={cardInput}
              />
            </label>
            <label className={cardLabel}>
              E-mail
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className={cardInput}
              />
              {account.data?.data.emailConfirmationPending && (
                <small className="text-[0.63rem] text-gold-accent">
                  Confirmação pendente para {account.data.data.pendingEmail}
                </small>
              )}
            </label>
            <label className={cardLabel}>
              Telemóvel
              <PhoneInput value={phone} onChange={setPhone} />
            </label>
            {(email.trim().toLowerCase() !== account.data?.data.email ||
              phone.trim() !== (account.data?.data.phone ?? '+351')) && (
              <label className={cardLabel}>
                Palavra-passe atual
                <input
                  type="password"
                  value={accountPassword}
                  onChange={(event) => setAccountPassword(event.target.value)}
                  autoComplete="current-password"
                  required
                  className={cardInput}
                />
                <small className="text-[0.6rem] text-[#777a72]">
                  Necessária para proteger alterações de e-mail ou telemóvel.
                </small>
              </label>
            )}
            <button className={goldOutlineButton}>
              <Save />
              Guardar dados
            </button>
          </form>
          <section className={cardClass}>
            <header className={cardHeader}>
              <Camera />
              <div>
                <h2 className={cardHeaderTitle}>Fotografia</h2>
                <p className={cardHeaderDesc}>JPEG, PNG ou WebP até 10 MB. A imagem será otimizada.</p>
              </div>
            </header>
            <div className="flex flex-wrap items-center gap-3">
              <span className="grid size-16 place-items-center overflow-hidden rounded-full border border-[rgba(211,167,91,0.35)] bg-[#252017] font-bold text-gold-light">
                {user.profileImageDataUrl ? (
                  <img
                    src={user.profileImageDataUrl}
                    alt="Fotografia de perfil"
                    className="size-full object-cover"
                  />
                ) : (
                  initials(user.name)
                )}
              </span>
              <label className={cn(goldOutlineButton, 'relative mt-0 cursor-pointer')}>
                <Camera />
                Alterar
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => readPhoto(e.target.files?.[0])}
                  className="absolute size-px opacity-0"
                />
              </label>
              <button
                onClick={() => removePhoto.mutate()}
                disabled={!user.profileImageDataUrl}
                className={cn(
                  goldOutlineButton,
                  'mt-0 border-[rgba(186,91,108,0.3)] bg-[rgba(154,88,103,0.08)] text-[#d78a97]',
                )}
              >
                <Trash2 />
                Eliminar
              </button>
            </div>
          </section>
          <form
            className={cardClass}
            onSubmit={(e) =>
              submit(e, () => {
                if (!isStrongPassword(newPassword)) {
                  setFeedbackError(true);
                  setFeedback(STRONG_PASSWORD_MESSAGE);
                  return;
                }
                savePassword.mutate();
              })
            }
          >
            <header className={cardHeader}>
              <KeyRound />
              <div>
                <h2 className={cardHeaderTitle}>Palavra-passe</h2>
                <p className={cardHeaderDesc}>Utiliza uma combinação segura.</p>
              </div>
            </header>
            <label className={cardLabel}>
              Palavra-passe atual
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                className={cardInput}
              />
            </label>
            <label className={cardLabel}>
              Nova palavra-passe
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                minLength={12}
                required
                className={cardInput}
              />
            </label>
            <PasswordStrength password={newPassword} />
            <button
              className={goldOutlineButton}
              disabled={
                !currentPassword || !isStrongPassword(newPassword) || savePassword.isPending
              }
            >
              <Save />
              Alterar palavra-passe
            </button>
          </form>
          <section className={cardClass}>
            <header className={cardHeader}>
              <KeyRound />
              <div>
                <h2 className={cardHeaderTitle}>Autenticação reforçada</h2>
                <p className={cardHeaderDesc}>Protege o acesso com uma aplicação autenticadora.</p>
              </div>
            </header>
            {!user.mfaEnabled && (
              <div className="rounded-xl border border-border bg-white/[0.02] p-3 text-[0.7rem] leading-[1.6] text-[#c7c5bc]">
                <p className="m-0 font-semibold text-gold-light">Como ativar em 3 passos</p>
                <ol className="mt-[0.4rem] mb-0 list-decimal space-y-1 pl-[1.1rem]">
                  <li>Instala uma aplicação autenticadora no telemóvel.</li>
                  <li>
                    Introduz a tua palavra-passe atual e carrega em{' '}
                    <strong className="text-text">Configurar</strong> para gerar a chave.
                  </li>
                  <li>
                    Adiciona a chave na aplicação e introduz o código de 6 dígitos gerado para
                    confirmar.
                  </li>
                </ol>
                <p className="mt-2 mb-0 text-[#8f9188]">
                  Apps sugeridas: Google Authenticator, Microsoft Authenticator, Authy ou 1Password.
                </p>
              </div>
            )}
            <label className={cardLabel}>
              Palavra-passe atual
              <input
                type="password"
                value={mfaPassword}
                onChange={(event) => setMfaPassword(event.target.value)}
                className={cardInput}
              />
            </label>
            {mfaSecret && (
              <p className="[overflow-wrap:anywhere] rounded-xl border border-[rgba(195,145,63,0.35)] bg-[rgba(195,145,63,0.08)] p-[0.85rem]">
                Chave de configuração: <strong>{mfaSecret}</strong>
              </p>
            )}
            {(mfaSecret || user.mfaEnabled) && (
              <label className={cardLabel}>
                Código de autenticação
                <input
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={mfaCode}
                  onChange={(event) => setMfaCode(event.target.value.trim())}
                  className={cardInput}
                />
              </label>
            )}
            {recoveryCodes.length > 0 && (
              <div className="[overflow-wrap:anywhere] rounded-xl border border-[rgba(195,145,63,0.35)] bg-[rgba(195,145,63,0.08)] p-[0.85rem]">
                <strong>Códigos de recuperação — serão apresentados apenas agora</strong>
                <code className="mt-[0.65rem] block leading-[1.6] whitespace-pre-wrap">
                  {recoveryCodes.join('\n')}
                </code>
              </div>
            )}
            {!user.mfaEnabled && !mfaSecret && (
              <button
                className={goldOutlineButton}
                type="button"
                disabled={!mfaPassword || beginMfa.isPending}
                onClick={() => beginMfa.mutate()}
              >
                Configurar
              </button>
            )}
            {mfaSecret && (
              <button
                className={goldOutlineButton}
                type="button"
                disabled={!/^\d{6}$/.test(mfaCode) || enableMfa.isPending}
                onClick={() => enableMfa.mutate()}
              >
                Ativar
              </button>
            )}
            {user.mfaEnabled && (
              <button
                className={goldOutlineButton}
                type="button"
                disabled={!mfaPassword || !/^\d{6}$/.test(mfaCode) || removeMfa.isPending}
                onClick={() => removeMfa.mutate()}
              >
                Desativar
              </button>
            )}
          </section>
          <section className={cardClass}>
            <header className={cardHeader}>
              <KeyRound />
              <div>
                <h2 className={cardHeaderTitle}>Sessões ativas</h2>
                <p className={cardHeaderDesc}>Termina as sessões dos dispositivos que já não utilizas.</p>
              </div>
            </header>
            <div className="grid gap-[0.65rem]">
              {activeSessions.data?.data.map((session) => (
                <div
                  key={session.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.08] p-3 max-[560px]:flex-col max-[560px]:items-stretch"
                >
                  <span>
                    <strong className="block">
                      {session.current ? 'Este dispositivo' : 'Outro dispositivo'}
                    </strong>
                    <small className="block">
                      {session.userAgent || 'Dispositivo não identificado'} ·{' '}
                      {new Date(session.lastUsedAt).toLocaleString('pt-PT')}
                    </small>
                  </span>
                  {!session.current &&
                    (sessionToEnd === session.id ? (
                      <span className="flex shrink-0 gap-[0.4rem] max-[560px]:w-full">
                        <button
                          type="button"
                          onClick={() => setSessionToEnd(null)}
                          className="inline-flex min-h-[2.35rem] cursor-pointer items-center justify-center gap-[0.4rem] rounded-[0.45rem] border border-[rgba(211,167,91,0.22)] bg-[rgba(211,167,91,0.07)] px-[0.7rem] text-[0.65rem] font-bold text-gold-accent disabled:cursor-wait disabled:opacity-60 max-[560px]:flex-1"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          disabled={endSession.isPending}
                          onClick={() => endSession.mutate(session.id)}
                          className="inline-flex min-h-[2.35rem] cursor-pointer items-center justify-center gap-[0.4rem] rounded-[0.45rem] border border-[rgba(196,82,82,0.35)] bg-[rgba(164,66,66,0.12)] px-[0.7rem] text-[0.65rem] font-bold text-[#e39a9a] disabled:cursor-wait disabled:opacity-60 max-[560px]:flex-1"
                        >
                          {endSession.isPending ? 'A terminar…' : 'Confirmar'}
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setSessionToEnd(session.id)}
                        className="inline-flex min-h-[2.35rem] shrink-0 cursor-pointer items-center justify-center gap-[0.4rem] self-start rounded-[0.45rem] border border-[rgba(211,167,91,0.22)] bg-[rgba(211,167,91,0.07)] px-[0.7rem] text-[0.65rem] font-bold text-gold-accent max-[560px]:self-auto"
                      >
                        <LogOut size={15} /> Terminar sessão
                      </button>
                    ))}
                </div>
              ))}
            </div>
          </section>
        </section>
      )}
      {tab === 'shop' && isMaster && (
        <section className="mx-auto grid max-w-[72rem] grid-cols-1 gap-4">
          <form className={cardClass} onSubmit={(event) => event.preventDefault()}>
            <header className={cardHeader}>
              <MapPin />
              <div>
                <h2 className={cardHeaderTitle}>Barbearia</h2>
                <p className={cardHeaderDesc}>Morada e horário-base de funcionamento.</p>
              </div>
            </header>
            <label className={cardLabel}>
              Morada
              <input
                value={address}
                onChange={(e) => {
                  setAddress(e.target.value);
                  setShopConfirmation('');
                }}
                placeholder="Morada completa"
                className={cardInput}
              />
            </label>
            <button
              type="button"
              onClick={() => saveShopAddress.mutate()}
              disabled={saveShopAddress.isPending}
              className={goldOutlineButton}
            >
              <Save />
              {saveShopAddress.isPending ? 'A guardar morada...' : 'Guardar morada'}
            </button>
            <HoursEditor grouped={shopGrouped} onChange={changeShopDay} />
            <button
              type="button"
              onClick={() => saveShopHours.mutate()}
              disabled={saveShopHours.isPending}
              className={goldOutlineButton}
            >
              <Save />
              {saveShopHours.isPending ? 'A guardar horários...' : 'Guardar horários'}
            </button>
            {shopConfirmation && (
              <div
                className="flex items-center gap-[0.55rem] rounded-lg border border-[rgba(80,184,117,0.26)] bg-[rgba(34,91,52,0.2)] px-[0.8rem] py-[0.7rem] text-[0.67rem] leading-[1.4] text-[#bfe3c8] [&>svg]:w-4 [&>svg]:shrink-0 [&>svg]:text-[#63c783]"
                role="status"
              >
                <CheckCircle2 /> <span>{shopConfirmation}</span>
              </div>
            )}
          </form>
        </section>
      )}
      {tab === 'agenda' && (
        <section className="mx-auto grid max-w-[72rem] grid-cols-2 gap-4 max-[720px]:grid-cols-1">
          <form className={cardClass} onSubmit={(e) => submit(e, () => saveLunch.mutate())}>
            <header className={cardHeader}>
              <Clock3 />
              <div>
                <h2 className={cardHeaderTitle}>Intervalo</h2>
                <p className={cardHeaderDesc}>Período reservado para almoço.</p>
              </div>
            </header>
            <div className="grid grid-cols-2 gap-3">
              <label className={cardLabel}>
                Início
                <input
                  type="time"
                  value={lunchStart}
                  onChange={(e) => setLunchStart(e.target.value)}
                  className={cardInput}
                />
              </label>
              <label className={cardLabel}>
                Fim
                <input
                  type="time"
                  value={lunchEnd}
                  onChange={(e) => setLunchEnd(e.target.value)}
                  className={cardInput}
                />
              </label>
            </div>
            <button className={goldOutlineButton}>
              <Save />
              Guardar intervalo
            </button>
          </form>
          <form className={cardClass} onSubmit={(e) => submit(e, () => addBlock.mutate())}>
            <header className={cardHeader}>
              <CalendarOff />
              <div>
                <h2 className={cardHeaderTitle}>Indisponibilidades</h2>
                <p className={cardHeaderDesc}>Bloqueie dias ou períodos específicos.</p>
              </div>
            </header>
            <BlockCalendar
              month={blockCalendarMonth}
              start={blockStart.slice(0, 10)}
              end={blockEnd.slice(0, 10)}
              onMonthChange={setBlockCalendarMonth}
              onSelect={(date) => {
                const startTime = blockStart.split('T')[1] || '09:00';
                const endTime = blockEnd.split('T')[1] || '19:00';
                if (!blockStart || (blockStart && blockEnd)) {
                  setBlockStart(`${date}T${startTime}`);
                  setBlockEnd('');
                } else if (date < blockStart.slice(0, 10)) {
                  setBlockEnd(`${blockStart.slice(0, 10)}T${endTime}`);
                  setBlockStart(`${date}T${startTime}`);
                } else {
                  setBlockEnd(`${date}T${endTime}`);
                }
              }}
            />
            <label className={cardLabel}>
              Início
              <input
                type="datetime-local"
                value={blockStart}
                onChange={(e) => setBlockStart(e.target.value)}
                required
                className={cardInput}
              />
            </label>
            <label className={cardLabel}>
              Fim
              <input
                type="datetime-local"
                value={blockEnd}
                onChange={(e) => setBlockEnd(e.target.value)}
                required
                className={cardInput}
              />
            </label>
            <label className={cardLabel}>
              Motivo
              <input
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                maxLength={250}
                className={cardInput}
              />
            </label>
            <button className={goldOutlineButton}>
              <CalendarOff />
              Adicionar bloqueio
            </button>
            <div className="grid gap-[0.45rem]">
              {blocks.data?.data.map((block) => (
                <article
                  key={block.id}
                  className="flex items-center justify-between rounded-lg border border-[rgba(226,216,195,0.08)] p-[0.65rem]"
                >
                  <span>
                    <strong className="block text-[0.68rem]">
                      {new Date(block.startsAt).toLocaleString('pt-PT')}
                    </strong>
                    <small className="mt-[0.2rem] block text-[0.62rem] text-[#777a72]">
                      {block.reason ?? 'Indisponível'}
                    </small>
                  </span>
                  <button
                    type="button"
                    onClick={() => removeBlock.mutate(block.id)}
                    className="grid size-8 cursor-pointer place-items-center border-0 bg-transparent text-[#c77b88]"
                  >
                    <Trash2 />
                  </button>
                </article>
              ))}
            </div>
          </form>
        </section>
      )}
    </main>
  );
}

function groupHours(hours: BusinessHour[]) {
  const map = new Map<DayOfWeek, BusinessHour[]>();
  for (const hour of hours)
    map.set(
      hour.dayOfWeek,
      [...(map.get(hour.dayOfWeek) ?? []), hour].sort((a, b) => a.startMinute - b.startMinute),
    );
  return map;
}
function HoursEditor({
  grouped,
  onChange,
}: {
  grouped: Map<DayOfWeek, BusinessHour[]>;
  onChange: (day: DayOfWeek, open: boolean, start?: string, end?: string) => void;
}) {
  return (
    <div className="grid gap-2">
      {days.map(({ value, label }) => {
        const periods = grouped.get(value) ?? [],
          open = periods.length > 0,
          start = open ? toTime(periods[0].startMinute) : '09:00',
          end = open ? toTime(periods.at(-1)!.endMinute) : '19:00';
        return (
          <div
            className="grid grid-cols-[minmax(8rem,1fr)_auto] items-center gap-2 rounded-lg border border-[rgba(226,216,195,0.07)] p-2 max-[720px]:grid-cols-[minmax(0,1fr)_auto] max-[720px]:gap-3 max-[720px]:p-[0.8rem]"
            key={value}
          >
            <label className="flex items-center gap-2 text-[0.72rem] text-[#b8bab3]">
              <span
                className={cn(
                  'grid size-4 shrink-0 cursor-pointer place-items-center rounded-[0.3rem] border border-[rgba(211,167,91,0.42)] bg-[#0b0c09] text-[#17130d] transition-[border-color,background,box-shadow] duration-150',
                  open &&
                    'border-gold-accent bg-[linear-gradient(135deg,#e0b96f,#a87934)] shadow-[0_0_0_3px_rgba(211,167,91,0.1)]',
                )}
              >
                {open && (
                  <svg viewBox="0 0 10 8" className="size-[0.5rem]" aria-hidden="true">
                    <path
                      d="M1 4l2.5 2.5L9 1"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </span>
              <input
                type="checkbox"
                checked={open}
                onChange={(e) => onChange(value, e.target.checked, start, end)}
                className="sr-only"
              />
              {label}
            </label>
            <span
              className={cn(
                'hidden justify-self-end rounded-2xl bg-white/[0.04] px-2 py-1 text-[0.58rem] text-[#858880] max-[720px]:inline-flex',
                open && 'bg-[rgba(60,121,75,0.12)] text-[#8ac798]',
              )}
            >
              {open ? 'Aberto' : 'Encerrado'}
            </span>
            <div className="grid grid-cols-[7rem_auto_7rem] items-end gap-2 max-[720px]:col-span-full max-[720px]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] max-[720px]:gap-[0.65rem]">
              <label className="grid gap-1">
                <span className="hidden text-[0.58rem] text-[#73766e] max-[720px]:block">Abre</span>
                <input
                  type="time"
                  value={start}
                  disabled={!open}
                  onChange={(e) => onChange(value, true, e.target.value, end)}
                  className="w-full cursor-pointer border-[rgba(211,167,91,0.2)] text-[#f2eadc] bg-[linear-gradient(145deg,#11120e,#0a0b09)] [color-scheme:dark] [font-variant-numeric:tabular-nums] transition-[border-color,box-shadow,opacity] duration-150 hover:not-disabled:border-[rgba(211,167,91,0.42)] focus:border-gold-accent focus:shadow-[0_0_0_3px_rgba(211,167,91,0.1)] disabled:cursor-not-allowed disabled:border-[rgba(226,216,195,0.06)] disabled:bg-[#0a0b09] disabled:text-[#5f625b] disabled:opacity-[0.58] [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-[0.72] [&::-webkit-calendar-picker-indicator]:[filter:sepia(1)_saturate(0.8)_hue-rotate(355deg)_brightness(1.35)] disabled:[&::-webkit-calendar-picker-indicator]:opacity-25"
                />
              </label>
              <span className="pb-[0.85rem] max-[720px]:hidden">até</span>
              <label className="grid gap-1">
                <span className="hidden text-[0.58rem] text-[#73766e] max-[720px]:block">Fecha</span>
                <input
                  type="time"
                  value={end}
                  disabled={!open}
                  onChange={(e) => onChange(value, true, start, e.target.value)}
                  className="w-full cursor-pointer border-[rgba(211,167,91,0.2)] text-[#f2eadc] bg-[linear-gradient(145deg,#11120e,#0a0b09)] [color-scheme:dark] [font-variant-numeric:tabular-nums] transition-[border-color,box-shadow,opacity] duration-150 hover:not-disabled:border-[rgba(211,167,91,0.42)] focus:border-gold-accent focus:shadow-[0_0_0_3px_rgba(211,167,91,0.1)] disabled:cursor-not-allowed disabled:border-[rgba(226,216,195,0.06)] disabled:bg-[#0a0b09] disabled:text-[#5f625b] disabled:opacity-[0.58] [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-[0.72] [&::-webkit-calendar-picker-indicator]:[filter:sepia(1)_saturate(0.8)_hue-rotate(355deg)_brightness(1.35)] disabled:[&::-webkit-calendar-picker-indicator]:opacity-25"
                />
              </label>
            </div>
          </div>
        );
      })}
    </div>
  );
}
function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function BlockCalendar({
  month,
  start,
  end,
  onMonthChange,
  onSelect,
}: {
  month: string;
  start: string;
  end: string;
  onMonthChange: (month: string) => void;
  onSelect: (date: string) => void;
}) {
  const first = new Date(`${month}-01T12:00:00Z`);
  const offset = (first.getUTCDay() + 6) % 7;
  const gridStart = new Date(first);
  gridStart.setUTCDate(gridStart.getUTCDate() - offset);
  const dates = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setUTCDate(date.getUTCDate() + index);
    return date.toISOString().slice(0, 10);
  });
  const moveMonth = (amount: number) => {
    const date = new Date(`${month}-01T12:00:00Z`);
    date.setUTCMonth(date.getUTCMonth() + amount);
    onMonthChange(date.toISOString().slice(0, 7));
  };
  return (
    <div className="rounded-xl border border-[rgba(226,216,195,0.1)] bg-[#0b0c09] p-[0.8rem]">
      <header className="grid grid-cols-[2rem_1fr_2rem] items-center border-0 pb-[0.7rem]">
        <button
          type="button"
          onClick={() => moveMonth(-1)}
          aria-label="Mês anterior"
          className="grid h-8 min-h-8 w-8 place-items-center rounded-[0.45rem] border border-[rgba(226,216,195,0.1)] bg-[#12130f] p-0 text-[1.15rem] text-gold-accent"
        >
          ‹
        </button>
        <strong className="text-center capitalize">
          {first.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })}
        </strong>
        <button
          type="button"
          onClick={() => moveMonth(1)}
          aria-label="Mês seguinte"
          className="grid h-8 min-h-8 w-8 place-items-center rounded-[0.45rem] border border-[rgba(226,216,195,0.1)] bg-[#12130f] p-0 text-[1.15rem] text-gold-accent"
        >
          ›
        </button>
      </header>
      <div className="grid grid-cols-7 gap-1">
        {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((day) => (
          <span
            key={day}
            className="py-1 text-center text-[0.55rem] text-[#686b64] uppercase"
          >
            {day}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {dates.map((date) => {
          const inRange = Boolean(start && end && date >= start && date <= end);
          const outside = !date.startsWith(month);
          const selected = date === start || date === end;
          return (
            <button
              type="button"
              key={date}
              className={cn(
                'min-h-[2.15rem] rounded-[0.42rem] border border-transparent bg-[#11120e] p-0 text-[0.65rem] text-[#b8bab3] hover:border-[rgba(211,167,91,0.3)]',
                outside && 'bg-transparent text-[#444740]',
                inRange && 'bg-[rgba(137,95,41,0.24)] text-[#e5d5b7]',
                selected && 'border-gold-accent bg-gold-accent font-bold text-[#16120b]',
              )}
              onClick={() => onSelect(date)}
            >
              {Number(date.slice(-2))}
            </button>
          );
        })}
      </div>
      <small className="mt-[0.65rem] block text-center text-[0.58rem] text-[#666961]">
        Seleciona a data inicial e, em seguida, a data final.
      </small>
    </div>
  );
}
