import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './app';

describe('App', () => {
  it('protects the staff panel with the professional login', async () => {
    window.history.replaceState({}, '', '/');
    render(<App />);

    expect(
      await screen.findByRole('heading', {
        name: 'Bem-vindo de volta',
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Entrar no painel' })).toBeInTheDocument();
  });
});
