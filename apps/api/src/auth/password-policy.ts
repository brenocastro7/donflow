export const STRONG_PASSWORD_PATTERN =
  /^(?!(?:Password123!|Qwerty123!|Admin123456!|Donflow123!|Barbearia2026!)$)(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,72}$/;

export const STRONG_PASSWORD_MESSAGE =
  'A palavra-passe deve ter pelo menos 12 caracteres, uma letra maiúscula, um número e um carácter especial, e não pode ser uma palavra-passe comum.';

export function assertStrongPassword(password: string): void {
  if (!STRONG_PASSWORD_PATTERN.test(password)) {
    throw new Error(STRONG_PASSWORD_MESSAGE);
  }
}
