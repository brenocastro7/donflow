import type { Response } from 'express';
import type { SessionCredentials } from './auth.types';

export const ACCESS_COOKIE = 'donflow_access';
export const REFRESH_COOKIE = 'donflow_refresh';
export const CSRF_COOKIE = 'donflow_csrf';

function csrfCookieDomain(): string {
  if (process.env.NODE_ENV !== 'production') return '';
  try {
    const host = new URL(process.env.APP_PUBLIC_URL ?? '').hostname;
    return host ? `; Domain=${host}` : '';
  } catch {
    return '';
  }
}

export function parseCookies(header?: string): Record<string, string> {
  if (!header) return {};
  return Object.fromEntries(
    header.split(';').flatMap((entry) => {
      const separator = entry.indexOf('=');
      if (separator < 1) return [];
      return [
        [
          decodeURIComponent(entry.slice(0, separator).trim()),
          decodeURIComponent(entry.slice(separator + 1).trim()),
        ],
      ];
    }),
  );
}

export function setSessionCookies(
  response: Response,
  credentials: SessionCredentials,
): void {
  const secure = process.env.NODE_ENV === 'production';
  const common = `Path=/; SameSite=Strict${secure ? '; Secure' : ''}`;
  const accessMaxAge = credentials.response.expiresIn;
  const refreshMaxAge = Math.max(
    0,
    Math.floor((credentials.refreshExpiresAt.getTime() - Date.now()) / 1000),
  );
  const accessPersistence = credentials.persistent
    ? `; Max-Age=${accessMaxAge}`
    : '';
  const refreshPersistence = credentials.persistent
    ? `; Max-Age=${refreshMaxAge}`
    : '';
  response.append(
    'Set-Cookie',
    `${ACCESS_COOKIE}=${encodeURIComponent(credentials.accessToken)}; ${common}; HttpOnly${accessPersistence}`,
  );
  response.append(
    'Set-Cookie',
    `${REFRESH_COOKIE}=${encodeURIComponent(credentials.refreshToken)}; ${common}; HttpOnly${refreshPersistence}`,
  );
  response.append(
    'Set-Cookie',
    `${CSRF_COOKIE}=${encodeURIComponent(credentials.csrfToken)}; ${common}${refreshPersistence}${csrfCookieDomain()}`,
  );
}

export function clearSessionCookies(response: Response): void {
  const secure = process.env.NODE_ENV === 'production';
  const common = `Path=/; SameSite=Strict${secure ? '; Secure' : ''}; Max-Age=0`;
  response.append('Set-Cookie', `${ACCESS_COOKIE}=; ${common}; HttpOnly`);
  response.append('Set-Cookie', `${REFRESH_COOKIE}=; ${common}; HttpOnly`);
  response.append(
    'Set-Cookie',
    `${CSRF_COOKIE}=; ${common}${csrfCookieDomain()}`,
  );
}
