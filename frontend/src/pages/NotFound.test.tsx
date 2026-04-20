import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import NotFound from './NotFound';

describe('NotFound', () => {
  it('shows the 404 heading, explanation, and a back-to-dashboard link', () => {
    render(
      <MemoryRouter>
        <NotFound />
      </MemoryRouter>
    );

    expect(screen.getByText('404')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /page not found/i })
    ).toBeInTheDocument();

    const link = screen.getByRole('link', { name: /back to dashboard/i });
    expect(link).toHaveAttribute('href', '/');
  });
});
