import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { StrictMode } from 'react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { confirmCustomerEmail } from '../features/auth/auth-api';
import { CustomerConfirmEmailPage } from './customer-confirm-email-page';

vi.mock('../features/auth/auth-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../features/auth/auth-api')>()),
  confirmCustomerEmail: vi.fn(),
}));

describe('CustomerConfirmEmailPage', () => {
  beforeEach(() => {
    vi.mocked(confirmCustomerEmail).mockReset();
  });

  it('consumes the confirmation token only once in React StrictMode', async () => {
    vi.mocked(confirmCustomerEmail).mockResolvedValue({
      message: 'E-mail confirmado com sucesso.',
      role: 'CUSTOMER',
    });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    render(
      <StrictMode>
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={[`/customer/confirm-email?token=${'a'.repeat(64)}`]}>
            <CustomerConfirmEmailPage />
          </MemoryRouter>
        </QueryClientProvider>
      </StrictMode>,
    );

    expect(await screen.findByRole('heading', { name: 'Conta confirmada.' })).toBeInTheDocument();
    expect(
      await screen.findByText('Já podes iniciar sessão na área do cliente.'),
    ).toBeInTheDocument();
    expect(confirmCustomerEmail).toHaveBeenCalledTimes(1);
  });

  it('routes a staff email-change confirmation to the panel, not the customer area', async () => {
    vi.mocked(confirmCustomerEmail).mockResolvedValue({
      message: 'E-mail confirmado com sucesso.',
      role: 'MASTER',
    });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[`/customer/confirm-email?token=${'b'.repeat(64)}`]}>
          <CustomerConfirmEmailPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByRole('heading', { name: 'Conta confirmada.' })).toBeInTheDocument();
    expect(await screen.findByText('Já podes iniciar sessão no painel.')).toBeInTheDocument();
  });
});
