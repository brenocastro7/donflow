import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Camera, LogOut, Trash2, UserRound } from 'lucide-react';
import { type FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  changePassword,
  deleteCustomerAccount,
  deleteProfileImage,
  getCurrentUser,
  logout,
  updateProfileImage,
} from '../features/auth/auth-api';
import { clearAccessToken, getAccessToken } from '../features/auth/auth-session';
import { isStrongPassword, STRONG_PASSWORD_MESSAGE } from '../features/auth/password-policy';
import { getAccountSettings, updateAccountSettings } from '../features/settings/settings-api';
import { ApiError } from '../lib/api/api-error';
import { AvatarImageEditor } from '../shared/components/avatar-image-editor';
import { PhoneInput } from '../shared/components/phone-input';
import { optionalPhone } from '../shared/components/phone-value';
import { PasswordStrength } from '../shared/components/password-strength';
import { cn } from '@/lib/utils';
import {
  customerCard,
  customerPrimaryButton,
  customerSecondaryButton,
  customerSectionEyebrow,
  customerSectionPage,
  customerSectionTitle,
} from './customer-portal-styles';

export function CustomerAccountPage() {
  const token = getAccessToken()!;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const account = useQuery({
    queryKey: ['customer', 'account'],
    queryFn: () => getAccountSettings(token),
  });
  const session = useQuery({
    queryKey: ['auth', 'me', token],
    queryFn: () => getCurrentUser(token),
  });
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [passwordCurrent, setPasswordCurrent] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deletionPassword, setDeletionPassword] = useState('');
  const [photoToEdit, setPhotoToEdit] = useState<File | null>(null);
  useEffect(() => {
    if (account.data) {
      setName(account.data.data.name);
      setEmail(account.data.data.email ?? '');
      setPhone(account.data.data.phone ?? '+351');
    }
  }, [account.data]);
  const save = useMutation({
    mutationFn: () =>
      updateAccountSettings(token, {
        name,
        email,
        phone: optionalPhone(phone),
        currentPassword: currentPassword || undefined,
      }),
    onSuccess: async () => {
      setMessage('Alterações guardadas.');
      setCurrentPassword('');
      await queryClient.invalidateQueries();
    },
    onError: (error) =>
      setMessage(error instanceof ApiError ? error.message : 'Não foi possível guardar.'),
  });
  const password = useMutation({
    mutationFn: () => changePassword(token, passwordCurrent, newPassword),
    onSuccess: () => {
      clearAccessToken();
      setPasswordCurrent('');
      setNewPassword('');
      navigate('/customer/login', { replace: true });
    },
    onError: (error) =>
      setMessage(
        error instanceof ApiError ? error.message : 'Não foi possível alterar a palavra-passe.',
      ),
  });
  const changeAccountPassword = () => {
    setMessage(null);
    if (!isStrongPassword(newPassword)) {
      setMessage(STRONG_PASSWORD_MESSAGE);
      return;
    }
    password.mutate();
  };
  const photo = useMutation({
    mutationFn: (dataUrl: string) => updateProfileImage(token, dataUrl),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['auth', 'me', token] }),
  });
  const removePhoto = useMutation({
    mutationFn: () => deleteProfileImage(token),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['auth', 'me', token] }),
  });
  const deletion = useMutation({
    mutationFn: () => deleteCustomerAccount(token, deletionPassword),
    onSuccess: () => {
      clearAccessToken();
      navigate('/customer/login', { replace: true });
    },
    onError: (error) =>
      setMessage(error instanceof ApiError ? error.message : 'Não foi possível eliminar a conta.'),
  });
  const upload = (file?: File) => {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 10_000_000) {
      setMessage('Seleciona uma imagem JPEG, PNG ou WebP com no máximo 10 MB.');
      return;
    }
    setPhotoToEdit(file);
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    setMessage(null);
    save.mutate();
  };
  const accountInput =
    'h-[2.8rem] rounded-[0.4rem] border border-[rgba(225,216,197,0.12)] bg-[#0b0c0a] px-3 text-[#eee] outline-0';
  const accountLabel = 'grid gap-[0.4rem] text-[0.68rem] text-[#aaa]';
  const accountActionButton =
    'flex items-center gap-[0.3rem] rounded-[0.4rem] border border-[rgba(214,170,91,0.2)] bg-transparent p-[0.55rem] text-[0.65rem] text-[#d6aa5b] cursor-pointer';
  const dangerButton =
    'flex items-center gap-[0.4rem] rounded-[0.4rem] border border-[rgba(190,72,72,0.3)] bg-transparent p-[0.65rem] text-[#df9292] cursor-pointer';

  return (
    <main className={customerSectionPage}>
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
      <header>
        <span className={customerSectionEyebrow}>Área do cliente</span>
        <h1 className={customerSectionTitle}>A minha conta</h1>
      </header>
      <section className={cn(customerCard, 'flex items-center gap-3 max-[620px]:flex-wrap max-[620px]:items-stretch')}>
        <span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-full bg-[#272118] text-[#c49343]">
          {session.data?.data.profileImageDataUrl ? (
            <img
              src={session.data.data.profileImageDataUrl}
              alt=""
              className="size-full object-cover"
            />
          ) : (
            <UserRound />
          )}
        </span>
        <div className="flex flex-1 flex-col gap-[0.2rem] max-[620px]:min-w-[calc(100%-5rem)]">
          <strong>Fotografia de perfil</strong>
          <small className="text-[0.65rem] leading-[1.4] text-[#7d8078]">
            JPEG, PNG ou WebP até 10 MB. A imagem será otimizada.
          </small>
        </div>
        <label className={accountActionButton}>
          <Camera /> Alterar
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => upload(event.target.files?.[0])}
            className="hidden"
          />
        </label>
        {session.data?.data.profileImageDataUrl && (
          <button className={accountActionButton} onClick={() => removePhoto.mutate()}>
            <Trash2 /> Remover
          </button>
        )}
      </section>
      <form
        className={cn(customerCard, 'grid grid-cols-2 gap-4 max-[620px]:grid-cols-1')}
        onSubmit={submit}
      >
        <h2 className="col-span-full m-0 font-[Georgia,serif] text-[1.15rem]">Dados pessoais</h2>
        <label className={accountLabel}>
          Nome
          <input
            className={accountInput}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label className={accountLabel}>
          E-mail
          <input
            className={accountInput}
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label className={accountLabel}>
          Telemóvel
          <PhoneInput value={phone} onChange={setPhone} />
        </label>
        <label className={accountLabel}>
          Palavra-passe atual <small className="text-[#757870]">necessária para alterar e-mail ou telemóvel</small>
          <input
            className={accountInput}
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
          />
        </label>
        <button className={cn(customerPrimaryButton, 'col-span-full')} disabled={save.isPending}>
          Guardar alterações
        </button>
      </form>
      <section className={cn(customerCard, 'grid grid-cols-2 gap-4 max-[620px]:grid-cols-1')}>
        <h2 className="col-span-full m-0 font-[Georgia,serif] text-[1.15rem]">
          Alterar palavra-passe
        </h2>
        <label className={accountLabel}>
          Palavra-passe atual
          <input
            className={accountInput}
            type="password"
            value={passwordCurrent}
            onChange={(event) => setPasswordCurrent(event.target.value)}
          />
        </label>
        <label className={accountLabel}>
          Nova palavra-passe
          <input
            className={accountInput}
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
          />
        </label>
        <PasswordStrength password={newPassword} className="col-span-full" />
        <button
          className={cn(customerSecondaryButton, 'col-span-full')}
          disabled={!passwordCurrent || !isStrongPassword(newPassword) || password.isPending}
          onClick={changeAccountPassword}
        >
          Alterar palavra-passe
        </button>
      </section>
      {message && <p className="text-center text-[0.7rem] text-[#d6aa5b]">{message}</p>}
      <section
        className={cn(
          customerCard,
          'flex items-center justify-between gap-4 border-[rgba(190,72,72,0.2)] max-[620px]:flex-col max-[620px]:items-stretch',
        )}
      >
        <div className="flex flex-col gap-1">
          <strong>Eliminar conta</strong>
          <small className="text-[0.65rem] leading-[1.4] text-[#7d8078]">
            O acesso e os dados pessoais serão removidos permanentemente. O histórico operacional
            será preservado.
          </small>
        </div>
        {confirmDelete ? (
          <div className="flex gap-2 max-[620px]:grid max-[620px]:grid-cols-2">
            <input
              className={accountInput}
              type="password"
              autoComplete="current-password"
              placeholder="Palavra-passe atual"
              value={deletionPassword}
              onChange={(event) => setDeletionPassword(event.target.value)}
            />
            <button className={dangerButton} onClick={() => setConfirmDelete(false)}>
              Voltar
            </button>
            <button
              className={dangerButton}
              disabled={deletionPassword.length < 8 || deletion.isPending}
              onClick={() => deletion.mutate()}
            >
              Confirmar eliminação
            </button>
          </div>
        ) : (
          <button className={dangerButton} onClick={() => setConfirmDelete(true)}>
            <Trash2 /> Eliminar conta
          </button>
        )}
      </section>
      <button
        className={cn(dangerButton, 'mx-auto my-4 border-[rgba(214,170,91,0.2)] text-[#aaa]')}
        onClick={async () => {
          await logout(token).catch(() => undefined);
          clearAccessToken();
          navigate('/customer/login', { replace: true });
        }}
      >
        <LogOut /> Terminar sessão
      </button>
    </main>
  );
}
