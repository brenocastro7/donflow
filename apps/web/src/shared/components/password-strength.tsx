import { Check, X } from 'lucide-react';
import { passwordStrength } from '@/features/auth/password-policy';
import { cn } from '@/lib/utils';

const levelStrongColor: Record<number, string> = {
  1: 'text-[#d47e73]',
  2: 'text-[#d49155]',
  3: 'text-[#d3a75b]',
  4: 'text-[#78c58d]',
};

const levelBarColor: Record<number, string> = {
  1: 'bg-[#bf5e54]',
  2: 'bg-[#c98247]',
  3: 'bg-[#d3a75b]',
  4: 'bg-[#61ad77]',
};

export function PasswordStrength({
  password,
  className,
}: {
  password: string;
  className?: string;
}) {
  if (!password) return null;
  const strength = passwordStrength(password);
  const requirements = [
    ['length', '12 caracteres'],
    ['uppercase', 'Uma maiúscula'],
    ['number', 'Um número'],
    ['special', 'Um carácter especial'],
    ['uncommon', 'Não ser comum'],
  ] as const;
  return (
    <div className={cn('mt-[0.65rem] grid gap-[0.55rem]', className)} aria-live="polite">
      <div className="flex items-center justify-between text-[0.62rem] text-[#858880]">
        <span>Robustez</span>
        <strong className={cn('text-[0.68rem]', levelStrongColor[strength.level])}>
          {strength.label}
        </strong>
      </div>
      <div className="grid grid-cols-4 gap-[0.3rem]" aria-hidden="true">
        {[1, 2, 3, 4].map((segment) => (
          <i
            key={segment}
            className={cn(
              'h-[0.22rem] rounded-2xl bg-white/[0.09] transition-[background] duration-[180ms] ease-in-out',
              strength.level >= segment && levelBarColor[strength.level],
            )}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-[0.7rem] gap-y-[0.35rem]">
        {requirements.map(([key, label]) => {
          const passed = strength.requirements[key];
          return (
            <span
              className={cn(
                'inline-flex items-center gap-[0.2rem] text-[0.58rem] text-[#777a73]',
                '[&_svg]:size-[0.7rem] [&_svg]:text-[#a96560]',
                passed && 'text-[#9a9d95] [&_svg]:text-[#61ad77]',
              )}
              key={key}
            >
              {passed ? <Check /> : <X />}
              {label}
            </span>
          );
        })}
      </div>
    </div>
  );
}
