import { environment } from '@/lib/env';
import { ApiError, type ApiErrorBody } from './api-error';
import { COOKIE_SESSION_MARKER } from '@/features/auth/auth-session';

export interface ApiRequestOptions extends Omit<RequestInit, 'body' | 'headers'> {
  body?: unknown;
  headers?: HeadersInit;
  accessToken?: string;
}

function cookie(name: string): string | undefined {
  return document.cookie
    .split('; ')
    .find((entry) => entry.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

function csrfToken(): string | undefined {
  const value = cookie('donflow_csrf');
  return value ? decodeURIComponent(value) : undefined;
}

function isUnsafe(method?: string): boolean {
  return !['GET', 'HEAD', 'OPTIONS'].includes((method ?? 'GET').toUpperCase());
}

function apiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${environment.VITE_API_URL.replace(/\/$/, '')}${normalizedPath}`;
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Accept', 'application/json');

  if (options.body !== undefined) {
    headers.set('Content-Type', 'application/json');
  }
  if (options.accessToken && options.accessToken !== COOKIE_SESSION_MARKER) {
    headers.set('Authorization', `Bearer ${options.accessToken}`);
  }
  const csrf = csrfToken();
  if (csrf && isUnsafe(options.method)) headers.set('X-CSRF-Token', csrf);

  let response = await fetch(apiUrl(path), {
    ...options,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    headers,
    credentials: 'include',
  });

  if (response.status === 401 && path !== '/auth/refresh' && options.accessToken) {
    const refreshHeaders = new Headers({ Accept: 'application/json' });
    const refreshCsrf = csrfToken();
    if (refreshCsrf) refreshHeaders.set('X-CSRF-Token', refreshCsrf);
    const refreshed = await fetch(apiUrl('/auth/refresh'), {
      method: 'POST',
      headers: refreshHeaders,
      credentials: 'include',
    });
    if (refreshed.ok) {
      const retryHeaders = new Headers(headers);
      const nextCsrf = csrfToken();
      if (nextCsrf && isUnsafe(options.method)) retryHeaders.set('X-CSRF-Token', nextCsrf);
      response = await fetch(apiUrl(path), {
        ...options,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        headers: retryHeaders,
        credentials: 'include',
      });
    }
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as ApiErrorBody;
    throw new ApiError(response.status, body);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
