import { useMutation } from '@tanstack/react-query';
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  Mail,
  UserRound,
} from 'lucide-react';
import { type FormEvent, type ReactNode, useState } from 'react';
import { useNavigate } from 'react-router';
import { registerCustomer } from '../features/auth/auth-api';
import { ApiError } from '../lib/api/api-error';
import { isStrongPassword, STRONG_PASSWORD_MESSAGE } from '../features/auth/password-policy';
import { PhoneInput } from '../shared/components/phone-input';
import { optionalPhone } from '../shared/components/phone-value';
import { PasswordStrength } from '../shared/components/password-strength';
import {
  customerAuthBack,
  customerConsentField,
  customerConsentFieldInput,
  customerLoginCardIntro,
  customerLoginCardIntroH1,
  customerLoginCardIntroP,
  customerLoginCardIntroSpan,
  customerLoginError,
  customerLoginField,
  customerLoginFieldButton,
  customerLoginFieldInput,
  customerLoginForm,
  customerLoginLabel,
  customerLoginPage,
  customerLoginCard,
  customerPrimaryButton,
  customerRegistrationSuccess,
  customerRegistrationSuccessH1,
  customerRegistrationSuccessIcon,
  customerRegistrationSuccessP,
  customerRegistrationSuccessSpan,
} from './customer-portal-styles';
import { cn } from '@/lib/utils';

export function CustomerRegisterPage() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('+351');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [transactionalEmailConsent, setTransactionalEmailConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const registration = useMutation({
    mutationFn: () =>
      registerCustomer({
        name: name.trim(),
        email: email.trim(),
        phone: optionalPhone(phone),
        password,
        transactionalEmailConsent,
      }),
    onError: (cause) =>
      setError(
        cause instanceof ApiError
          ? cause.message
          : 'Não foi possível criar a conta. Tenta novamente.',
      ),
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!name.trim() || !email.trim()) return setError('Preenche o nome e o e-mail.');
    if (!isStrongPassword(password)) return setError(STRONG_PASSWORD_MESSAGE);
    if (password !== confirmation) return setError('As palavras-passe não coincidem.');
    if (!transactionalEmailConsent)
      return setError('É necessário autorizar os e-mails transacionais para criar a conta.');
    registration.mutate();
  };

  if (registration.isSuccess) {
    return (
      <main className={customerLoginPage}>
        <section className={cn(customerLoginCard, customerRegistrationSuccess)}>
          <CheckCircle2 className={customerRegistrationSuccessIcon} />
          <p className={customerRegistrationSuccessP}>Conta criada</p>
          <h1 className={customerRegistrationSuccessH1}>Confirma o teu e-mail.</h1>
          <span className={customerRegistrationSuccessSpan}>
            Enviámos uma ligação de confirmação para <strong>{email}</strong>.
          </span>
          <button className={customerPrimaryButton} onClick={() => navigate('/customer/login')}>
            Voltar ao início de sessão
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className={customerLoginPage}>
      <section className={cn(customerLoginCard, 'my-4')}>
        <button className={customerAuthBack} type="button" onClick={() => navigate('/customer/login')}>
          <ArrowLeft size={17} /> Voltar
        </button>
        <div className={customerLoginCardIntro}>
          <p className={customerLoginCardIntroP}>Área do cliente</p>
          <h1 className={customerLoginCardIntroH1}>Criar conta.</h1>
          <span className={customerLoginCardIntroSpan}>Regista-te para gerir as tuas marcações.</span>
        </div>
        <form onSubmit={submit} className={customerLoginForm}>
          <CustomerField
            label="Nome"
            icon={<UserRound size={18} />}
            value={name}
            onChange={setName}
            autoComplete="name"
          />
          <CustomerField
            label="E-mail"
            icon={<Mail size={18} />}
            value={email}
            onChange={setEmail}
            autoComplete="email"
            type="email"
          />
          <label className={customerLoginLabel}>
            Telemóvel (opcional)
            <PhoneInput value={phone} onChange={setPhone} />
          </label>
          <CustomerField
            label="Palavra-passe"
            icon={<LockKeyhole size={18} />}
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
            type={passwordVisible ? 'text' : 'password'}
            passwordVisible={passwordVisible}
            onTogglePassword={() => setPasswordVisible((visible) => !visible)}
          />
          <PasswordStrength password={password} />
          <CustomerField
            label="Confirmar palavra-passe"
            icon={<LockKeyhole size={18} />}
            value={confirmation}
            onChange={setConfirmation}
            autoComplete="new-password"
            type={passwordVisible ? 'text' : 'password'}
          />
          <label className={customerConsentField}>
            <input
              type="checkbox"
              checked={transactionalEmailConsent}
              onChange={(event) => setTransactionalEmailConsent(event.target.checked)}
              className={customerConsentFieldInput}
            />
            <span>
              Autorizo o envio de e-mails transacionais necessários para confirmações,
              cancelamentos, reagendamentos, lembretes e segurança da conta. Esta autorização não
              inclui marketing.
            </span>
          </label>
          {error && <p className={customerLoginError}>{error}</p>}
          <button className={customerPrimaryButton} disabled={registration.isPending}>
            {registration.isPending ? <LoaderCircle className="animate-spin" /> : 'Criar conta'}
          </button>
        </form>
      </section>
    </main>
  );
}

function CustomerField({
  label,
  icon,
  value,
  onChange,
  autoComplete,
  type = 'text',
  placeholder,
  passwordVisible,
  onTogglePassword,
}: {
  label: string;
  icon: ReactNode;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  type?: string;
  placeholder?: string;
  passwordVisible?: boolean;
  onTogglePassword?: () => void;
}) {
  return (
    <label className={customerLoginLabel}>
      {label}
      <span className={customerLoginField}>
        {icon}
        <input
          type={type}
          value={value}
          autoComplete={autoComplete}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          className={customerLoginFieldInput}
        />
        {onTogglePassword && (
          <button
            type="button"
            aria-label={passwordVisible ? 'Ocultar palavra-passe' : 'Mostrar palavra-passe'}
            onClick={onTogglePassword}
            className={customerLoginFieldButton}
          >
            {passwordVisible ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
      </span>
    </label>
  );
}
