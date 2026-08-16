import { registerSW } from 'virtual:pwa-register';

const UPDATE_CHECK_INTERVAL_MS = 30 * 60 * 1000;

export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return;

  registerSW({
    immediate: true,
    onRegisteredSW(_url, registration) {
      if (!registration) return;

      // Precached responses (including index.html) go stale as soon as we ship a
      // security-relevant change like a CSP update. A page left open for hours (a
      // shop tablet in standalone mode) would otherwise only re-check on its next
      // full navigation, so poll explicitly and also re-check when the tab regains
      // focus after being backgrounded/asleep.
      setInterval(() => registration.update(), UPDATE_CHECK_INTERVAL_MS);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') registration.update();
      });
    },
  });
}
