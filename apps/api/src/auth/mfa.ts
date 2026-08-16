import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function encryptionKey(): Buffer {
  const configured = process.env.MFA_ENCRYPTION_KEY?.trim();
  if (
    process.env.NODE_ENV === 'production' &&
    (!configured || configured.length < 32)
  ) {
    throw new Error(
      'MFA_ENCRYPTION_KEY must contain at least 32 characters in production',
    );
  }
  const source =
    configured ||
    `mfa-encryption-fallback:${process.env.JWT_ACCESS_SECRET ?? ''}`;
  if (source.length < 32)
    throw new Error('MFA encryption key is not configured');
  return createHash('sha256').update(source).digest();
}

export function generateMfaSecret(): string {
  const bytes = randomBytes(20);
  let bits = '';
  for (const byte of bytes) bits += byte.toString(2).padStart(8, '0');
  let result = '';
  for (let index = 0; index < bits.length; index += 5) {
    result +=
      BASE32[Number.parseInt(bits.slice(index, index + 5).padEnd(5, '0'), 2)];
  }
  return result;
}

function decodeBase32(value: string): Buffer {
  let bits = '';
  for (const character of value.replace(/=+$/g, '').toUpperCase()) {
    const index = BASE32.indexOf(character);
    if (index < 0) throw new Error('Invalid base32 secret');
    bits += index.toString(2).padStart(5, '0');
  }
  const bytes: number[] = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) {
    bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
  }
  return Buffer.from(bytes);
}

function totp(secret: string, time: number): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(time / 30_000)));
  const digest = createHmac('sha1', decodeBase32(secret))
    .update(counter)
    .digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const value =
    (((digest[offset] & 0x7f) << 24) |
      ((digest[offset + 1] & 0xff) << 16) |
      ((digest[offset + 2] & 0xff) << 8) |
      (digest[offset + 3] & 0xff)) %
    1_000_000;
  return value.toString().padStart(6, '0');
}

export function verifyTotp(
  secret: string,
  code: string,
  now = Date.now(),
): boolean {
  if (!/^\d{6}$/.test(code)) return false;
  return [-1, 0, 1].some((window) => {
    const expected = Buffer.from(totp(secret, now + window * 30_000));
    const received = Buffer.from(code);
    return (
      expected.length === received.length && timingSafeEqual(expected, received)
    );
  });
}

export function encryptMfaSecret(secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(secret, 'utf8'),
    cipher.final(),
  ]);
  return [iv, cipher.getAuthTag(), encrypted]
    .map((part) => part.toString('base64url'))
    .join('.');
}

export function decryptMfaSecret(value: string): string {
  const [iv, tag, encrypted] = value
    .split('.')
    .map((part) => Buffer.from(part, 'base64url'));
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString(
    'utf8',
  );
}

export function hashRecoveryCode(code: string): string {
  return createHash('sha256').update(code.trim().toUpperCase()).digest('hex');
}

export function generateRecoveryCodes(): string[] {
  return Array.from({ length: 8 }, () =>
    randomBytes(6).toString('hex').toUpperCase(),
  );
}
