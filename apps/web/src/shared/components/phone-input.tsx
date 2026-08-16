import { Check, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { useOutsidePress } from '../hooks/use-outside-press';
import { cn } from '@/lib/utils';

const countryCodes = [
  { code: '+351', country: 'Portugal', flag: '🇵🇹' },
  { code: '+34', country: 'Espanha', flag: '🇪🇸' },
  { code: '+33', country: 'França', flag: '🇫🇷' },
  { code: '+44', country: 'Reino Unido', flag: '🇬🇧' },
  { code: '+353', country: 'Irlanda', flag: '🇮🇪' },
  { code: '+55', country: 'Brasil', flag: '🇧🇷' },
  { code: '+1', country: 'Estados Unidos/Canadá', flag: '🇺🇸' },
  { code: '+244', country: 'Angola', flag: '🇦🇴' },
  { code: '+238', country: 'Cabo Verde', flag: '🇨🇻' },
  { code: '+245', country: 'Guiné-Bissau', flag: '🇬🇼' },
  { code: '+258', country: 'Moçambique', flag: '🇲🇿' },
  { code: '+239', country: 'São Tomé e Príncipe', flag: '🇸🇹' },
  { code: '+352', country: 'Luxemburgo', flag: '🇱🇺' },
  { code: '+49', country: 'Alemanha', flag: '🇩🇪' },
  { code: '+41', country: 'Suíça', flag: '🇨🇭' },
  { code: '+39', country: 'Itália', flag: '🇮🇹' },
  { code: '+31', country: 'Países Baixos', flag: '🇳🇱' },
  { code: '+32', country: 'Bélgica', flag: '🇧🇪' },
].sort((first, second) => second.code.length - first.code.length);

function parts(value: string) {
  const prefix = countryCodes.find(({ code }) => value.startsWith(code))?.code ?? '+351';
  return {
    prefix,
    nationalNumber: value.startsWith(prefix)
      ? value.slice(prefix.length)
      : value.replace(/\D/g, ''),
  };
}

interface PhoneInputProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  placeholder?: string;
}

export function PhoneInput({
  id,
  value,
  onChange,
  disabled,
  required,
  className,
  placeholder = '912 345 678',
}: PhoneInputProps) {
  const { prefix, nationalNumber } = parts(value || '+351');
  const [open, setOpen] = useState(false);
  const containerRef = useOutsidePress<HTMLSpanElement>(open, () => setOpen(false));
  const selectedCountry = countryCodes.find((country) => country.code === prefix)!;
  return (
    <span
      className={cn(
        'relative grid min-w-0 grid-cols-[auto_minmax(0,1fr)] rounded-[0.45rem] border border-[rgba(225,216,197,0.12)] bg-[#0b0c0a] focus-within:border-[rgba(211,167,91,0.6)] focus-within:shadow-[0_0_0_3px_rgba(211,167,91,0.08)]',
        className,
      )}
      ref={containerRef}
    >
      <span className="relative block">
        <button
          type="button"
          className="grid h-[2.9rem] w-[6.5rem] cursor-pointer grid-cols-[auto_1fr_auto] items-center gap-[0.35rem] border-0 border-r border-[rgba(225,216,197,0.1)] bg-transparent px-[0.55rem] text-[#ece8df] max-[380px]:w-[5.75rem] max-[380px]:px-[0.35rem] [&[aria-expanded='true']_svg]:rotate-180 [&_svg]:text-[#8c8e87] [&_svg]:transition-transform [&_svg]:duration-150"
          aria-label="Indicativo do país"
          aria-haspopup="listbox"
          aria-expanded={open}
          disabled={disabled}
          onClick={() => setOpen((current) => !current)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setOpen(false);
          }}
        >
          <span>{selectedCountry.flag}</span>
          <strong className="text-[0.72rem]">{selectedCountry.code}</strong>
          <ChevronDown size={14} />
        </button>
        {open && (
          <span
            className="absolute top-[calc(100%+0.4rem)] left-0 z-[80] grid max-h-64 w-[min(18rem,calc(100vw-2rem))] overflow-y-auto rounded-[0.55rem] border border-[rgba(211,167,91,0.25)] bg-[#151611] p-[0.35rem] shadow-[0_1rem_2.8rem_rgba(0,0,0,0.58)]"
            role="listbox"
            aria-label="País e indicativo"
          >
            {countryCodes.map((country) => (
              <button
                type="button"
                role="option"
                aria-selected={country.code === prefix}
                key={`${country.country}-${country.code}`}
                onClick={() => {
                  onChange(`${country.code}${nationalNumber}`);
                  setOpen(false);
                }}
                className="grid min-h-10 cursor-pointer grid-cols-[1.4rem_1fr_auto_1rem] items-center gap-2 rounded-[0.35rem] border-0 bg-transparent px-[0.55rem] text-left text-[0.7rem] text-[#ddd9d0] hover:bg-[rgba(211,167,91,0.11)] aria-selected:bg-[rgba(211,167,91,0.11)] [&_strong]:text-gold [&_svg]:text-gold"
              >
                <span>{country.flag}</span>
                <span>{country.country}</span>
                <strong>{country.code}</strong>
                {country.code === prefix && <Check size={14} />}
              </button>
            ))}
          </span>
        )}
      </span>
      <input
        id={id}
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        value={nationalNumber}
        disabled={disabled}
        required={required}
        placeholder={placeholder}
        onChange={(event) => onChange(`${prefix}${event.target.value.replace(/\D/g, '')}`)}
        className="h-[2.9rem] min-w-0 w-full border-0! rounded-none! bg-transparent! px-3 text-[#ece8df] outline-0 [&:-webkit-autofill]:[-webkit-text-fill-color:#ece8df] [&:-webkit-autofill]:shadow-[0_0_0_1000px_#0b0c0a_inset]"
      />
    </span>
  );
}
