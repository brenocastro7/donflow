import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { StaffLayout } from './staff-layout';

function renderWithClient(ui: React.ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

const staffUser = {
  id: 'master-id',
  name: 'Breno Passos',
  role: 'MASTER' as const,
  barberProfileId: 'master-profile-id',
  profileImageDataUrl: null,
  customerBookingBlocked: false,
  customerBookingLimited: false,
  mfaEnabled: false,
};
const barberUser = {
  id: 'barber-id',
  name: 'João Silva',
  role: 'BARBER' as const,
  barberProfileId: 'barber-profile-id',
  profileImageDataUrl: null,
  customerBookingBlocked: false,
  customerBookingLimited: false,
  mfaEnabled: false,
};

afterEach(cleanup);

describe('StaffLayout', () => {
  it('does not expose master-only barber management to barbers', () => {
    renderWithClient(
      <MemoryRouter>
        <Routes>
          <Route element={<StaffLayout user={barberUser} />}>
            <Route index element={<h1>Conteúdo da agenda</h1>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.queryByText('Equipa')).not.toBeInTheDocument();
  });

  it('offers account settings without rendering a second mobile menu control', () => {
    renderWithClient(
      <MemoryRouter>
        <Routes>
          <Route element={<StaffLayout user={staffUser} />}>
            <Route index element={<h1>Conteúdo da agenda</h1>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(document.querySelector('[aria-label="Definições da conta"]')).toBeInTheDocument();
    expect(
      document.querySelector('[data-testid="mobile-header"] [aria-label="Terminar sessão"]'),
    ).toBeInTheDocument();
    expect(document.querySelector('[aria-label="Abrir menu"]')).not.toBeInTheDocument();
  });

  it('opens the notifications panel from the mobile header', async () => {
    const user = userEvent.setup();
    renderWithClient(
      <MemoryRouter>
        <Routes>
          <Route element={<StaffLayout user={staffUser} />}>
            <Route index element={<h1>Conteúdo da agenda</h1>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    const notificationsButton = document.querySelector<HTMLButtonElement>(
      'button[aria-controls="mobile-staff-notifications"]',
    );
    expect(notificationsButton).not.toBeNull();
    await user.click(notificationsButton!);

    expect(document.querySelector('#mobile-staff-notifications')).toBeInTheDocument();
    expect(screen.getByText('Não existem notificações.')).toBeInTheDocument();
  });

  it('opens the notifications panel from the desktop page header', async () => {
    const user = userEvent.setup();
    renderWithClient(
      <MemoryRouter>
        <Routes>
          <Route element={<StaffLayout user={staffUser} />}>
            <Route index element={<h1>Conteúdo da agenda</h1>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    const desktopHeader = document.querySelector('[data-testid="desktop-page-header"]') as HTMLElement;
    await user.click(within(desktopHeader).getByRole('button', { name: 'Notificações' }));

    expect(document.querySelector('#desktop-staff-notifications')).toBeInTheDocument();

    fireEvent.pointerDown(document.body);

    expect(document.querySelector('#desktop-staff-notifications')).not.toBeInTheDocument();
  });

  it('keeps the main navigation while changing pages', async () => {
    const user = userEvent.setup();
    renderWithClient(
      <MemoryRouter initialEntries={['/services']}>
        <Routes>
          <Route element={<StaffLayout user={staffUser} />}>
            <Route index element={<h1>Conteúdo da agenda</h1>} />
            <Route path="services" element={<h1>Conteúdo dos serviços</h1>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Conteúdo dos serviços' })).toBeInTheDocument();
    const navigation = screen.getByRole('navigation', { name: 'Navegação principal' });

    await user.click(within(navigation).getByRole('link', { name: 'Agenda' }));

    expect(screen.getByRole('heading', { name: 'Conteúdo da agenda' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Navegação principal' })).toBeInTheDocument();
  });
});
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
