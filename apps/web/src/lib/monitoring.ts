import * as Sentry from '@sentry/react';
import { environment } from './env';

export function initMonitoring(): void {
  if (!environment.VITE_SENTRY_DSN) return;

  Sentry.init({
    dsn: environment.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    sendDefaultPii: false,
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: import.meta.env.PROD ? 0.2 : 0,
  });
}
