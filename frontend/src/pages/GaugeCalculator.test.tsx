import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import GaugeCalculator from './GaugeCalculator';
import { useAuthStore } from '../stores/authStore';

function renderPage() {
  return render(
    <MemoryRouter>
      <GaugeCalculator />
    </MemoryRouter>,
  );
}

function fillSwatch(stitches: number, rows: number) {
  // Two "Stitches" + two "Rows" inputs (target + your swatch). Index 1 is
  // the swatch column.
  const stitchInputs = screen.getAllByLabelText('Stitches');
  const rowInputs = screen.getAllByLabelText('Rows');
  fireEvent.change(stitchInputs[1], { target: { value: String(stitches) } });
  fireEvent.change(rowInputs[1], { target: { value: String(rows) } });
}

describe('GaugeCalculator save-to-project CTA', () => {
  beforeEach(() => {
    useAuthStore.setState({ isAuthenticated: false, user: null, accessToken: null });
  });

  it('does not show the Save-to-project button for anonymous visitors', () => {
    renderPage();
    fillSwatch(20, 28);
    expect(screen.queryByRole('button', { name: /save to project/i })).not.toBeInTheDocument();
  });

  it('shows a sign-up CTA for anonymous visitors instead', () => {
    renderPage();
    expect(screen.getByText(/Save your gauge to a project/i)).toBeInTheDocument();
  });

  it('shows the Save-to-project button once a result computes for authenticated users', () => {
    useAuthStore.setState({
      isAuthenticated: true,
      user: { id: 'u1', email: 'a@b.c', firstName: 'A', lastName: 'B' } as any,
      accessToken: 't',
    });
    renderPage();
    expect(screen.queryByRole('button', { name: /save to project/i })).not.toBeInTheDocument();
    fillSwatch(20, 28);
    expect(screen.getByRole('button', { name: /save to project/i })).toBeInTheDocument();
  });
});
