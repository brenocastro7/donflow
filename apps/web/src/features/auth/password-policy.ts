export const STRONG_PASSWORD_MESSAGE =
  'A palavra-passe deve ter pelo menos 12 caracteres, uma letra maiúscula, um número e um carácter especial, e não pode ser uma palavra-passe comum.';

export function isStrongPassword(password: string) {
  return /^(?!(?:Password123!|Qwerty123!|Admin123456!|Donflow123!|Barbearia2026!)$)(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,72}$/.test(
    password,
  );
}

const commonPasswords = new Set([
  'password123!',
  'qwerty123!',
  'admin123456!',
  'donflow123!',
  'barbearia2026!',
]);

export function passwordStrength(password: string) {
  const requirements = {
    length: password.length >= 12,
    uppercase: /[A-Z]/.test(password),
    number: /\d/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
    uncommon: Boolean(password) && !commonPasswords.has(password.toLowerCase()),
  };
  const requiredScore = Object.values(requirements).filter(Boolean).length;
  const strong = isStrongPassword(password);
  const level = strong ? 4 : requiredScore >= 4 ? 3 : requiredScore >= 3 ? 2 : 1;
  return {
    level: password ? level : 0,
    label: ['Introduz uma palavra-passe', 'Muito fraca', 'Fraca', 'Razoável', 'Forte'][
      password ? level : 0
    ],
    requirements,
  };
}
