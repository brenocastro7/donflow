import { BrowserRouter, Route, Routes } from 'react-router';
import { lazy, Suspense } from 'react';
import { StaffProtectedRoute } from './staff-protected-route';
import { PublicLayout } from './public-layout';
import { CustomerProtectedRoute } from './customer-protected-route';
import { useRouteManifest } from '@/shared/hooks/use-route-manifest';

function RouteManifestSync() {
  useRouteManifest();
  return null;
}

const AgendaPage = lazy(() =>
  import('../pages/agenda-page').then((module) => ({ default: module.AgendaPage })),
);
const BarbersPage = lazy(() =>
  import('../pages/barbers-page').then((module) => ({ default: module.BarbersPage })),
);
const CompleteBarberRegistrationPage = lazy(() =>
  import('../pages/complete-barber-registration-page').then((module) => ({
    default: module.CompleteBarberRegistrationPage,
  })),
);
const CustomerDetailPage = lazy(() =>
  import('../pages/customer-detail-page').then((module) => ({
    default: module.CustomerDetailPage,
  })),
);
const CustomersPage = lazy(() =>
  import('../pages/customers-page').then((module) => ({ default: module.CustomersPage })),
);
const DashboardPage = lazy(() =>
  import('../pages/dashboard-page').then((module) => ({ default: module.DashboardPage })),
);
const SettingsPage = lazy(() =>
  import('../pages/settings-page').then((module) => ({ default: module.SettingsPage })),
);
const NewAppointmentPage = lazy(() =>
  import('../pages/new-appointment-page').then((module) => ({
    default: module.NewAppointmentPage,
  })),
);
const NotFoundPage = lazy(() =>
  import('../pages/not-found-page').then((module) => ({ default: module.NotFoundPage })),
);
const ResetPasswordPage = lazy(() =>
  import('../pages/reset-password-page').then((module) => ({ default: module.ResetPasswordPage })),
);
const ServicesPage = lazy(() =>
  import('../pages/services-page').then((module) => ({ default: module.ServicesPage })),
);
const StaffLoginPage = lazy(() =>
  import('../pages/staff-login-page').then((module) => ({ default: module.StaffLoginPage })),
);
const CustomerHomePage = lazy(() =>
  import('../pages/customer-home-page').then((module) => ({ default: module.CustomerHomePage })),
);
const CustomerLoginPage = lazy(() =>
  import('../pages/customer-login-page').then((module) => ({ default: module.CustomerLoginPage })),
);
const CustomerRegisterPage = lazy(() =>
  import('../pages/customer-register-page').then((module) => ({
    default: module.CustomerRegisterPage,
  })),
);
const CustomerConfirmEmailPage = lazy(() =>
  import('../pages/customer-confirm-email-page').then((module) => ({
    default: module.CustomerConfirmEmailPage,
  })),
);
const CustomerAppointmentsPage = lazy(() =>
  import('../pages/customer-appointments-page').then((module) => ({
    default: module.CustomerAppointmentsPage,
  })),
);
const CustomerAccountPage = lazy(() =>
  import('../pages/customer-account-page').then((module) => ({
    default: module.CustomerAccountPage,
  })),
);
const CustomerBookingPage = lazy(() =>
  import('../pages/customer-booking-page').then((module) => ({
    default: module.CustomerBookingPage,
  })),
);

export function AppRouter() {
  return (
    <BrowserRouter>
      <RouteManifestSync />
      <Suspense
        fallback={
          <main className="session-loading">
            <p>A carregar…</p>
          </main>
        }
      >
        <Routes>
          <Route element={<StaffProtectedRoute />}>
            <Route index element={<AgendaPage />} />
            <Route path="appointments/new" element={<NewAppointmentPage />} />
            <Route path="services" element={<ServicesPage />} />
            <Route path="barbers" element={<BarbersPage />} />
            <Route path="customers" element={<CustomersPage />} />
            <Route path="customers/:customerId" element={<CustomerDetailPage />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
          <Route path="customer" element={<CustomerProtectedRoute />}>
            <Route index element={<CustomerHomePage />} />
            <Route path="book" element={<CustomerBookingPage />} />
            <Route path="appointments" element={<CustomerAppointmentsPage />} />
            <Route path="account" element={<CustomerAccountPage />} />
          </Route>
          <Route element={<PublicLayout />}>
            <Route path="customer/login" element={<CustomerLoginPage />} />
            <Route path="customer/register" element={<CustomerRegisterPage />} />
            <Route path="customer/confirm-email" element={<CustomerConfirmEmailPage />} />
            <Route path="staff/login" element={<StaffLoginPage />} />
            <Route path="reset-password" element={<ResetPasswordPage />} />
            <Route
              path="complete-barber-registration"
              element={<CompleteBarberRegistrationPage />}
            />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
