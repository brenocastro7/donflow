const ACCESS_TOKEN_KEY = 'donflow.authenticated';
export const COOKIE_SESSION_MARKER = 'cookie-session';

export function getAccessToken(): string | null {
  return (
    window.sessionStorage.getItem(ACCESS_TOKEN_KEY) ?? window.localStorage.getItem(ACCESS_TOKEN_KEY)
  );
}

export function storeAccessToken(_accessToken: string, remember: boolean) {
  clearAccessToken();
  const storage = remember ? window.localStorage : window.sessionStorage;
  storage.setItem(ACCESS_TOKEN_KEY, COOKIE_SESSION_MARKER);
}

export function clearAccessToken() {
  window.sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
}
