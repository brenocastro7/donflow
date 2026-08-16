import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import * as Sentry from '@sentry/react';
import { App } from './app/app';
import { initMonitoring } from './lib/monitoring';
import { registerServiceWorker } from './lib/register-service-worker';
import './index.css';

initMonitoring();
registerServiceWorker();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Sentry.ErrorBoundary fallback={<p>Ocorreu um erro. Recarregue a página.</p>}>
      <App />
    </Sentry.ErrorBoundary>
  </StrictMode>,
);
