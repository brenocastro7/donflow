import { Outlet } from 'react-router';
import { SiteFooter } from '../shared/components/site-footer';

export function PublicLayout() {
  return (
    <div>
      <Outlet />
      <SiteFooter />
    </div>
  );
}
