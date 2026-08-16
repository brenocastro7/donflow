import { useEffect } from 'react';
import { useLocation } from 'react-router';

const CUSTOMER_MANIFEST_HREF = '/customer-manifest.webmanifest';
const STAFF_MANIFEST_HREF = '/manifest.webmanifest';

export function useRouteManifest() {
  const location = useLocation();

  useEffect(() => {
    const href = location.pathname.startsWith('/customer')
      ? CUSTOMER_MANIFEST_HREF
      : STAFF_MANIFEST_HREF;
    let link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'manifest';
      document.head.appendChild(link);
    }
    if (link.getAttribute('href') !== href) link.setAttribute('href', href);
  }, [location.pathname]);
}
