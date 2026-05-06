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
  const stitchInputs = screen.getAllByLabelText('Stitches');
  const rowInputs = screen.getAllByLabelText('Rows');
  fireEvent.change(stitchInputs[1], { target: { value: String(stitches) } });
  fireEvent.change(rowInputs[1], { target: { value: String(rows) } });
}

/**
 * Sprint 1 Public Tools Conversion — the Save-to-Rowly button is now
 * always rendered (logged-in or out) once a result computes. The flow
 * branches on click: logged-out → store + redirect, logged-in not
 * entitled → upgrade prompt, logged-in entitled → destination picker.
 *
 * The CTA replaces the previous "show Save button only when
 * authenticated, otherwise show a sign-up panel" pattern.
 */
describe('GaugeCalculator — Sprint 1 Save to Rowly CTA', () => {
  beforeEach(() => {
    useAuthStore.setState({ isAuthenticated: false, user: null, accessToken: null });
  });

  it('does not show the Save CTA before a result computes', () => {
    renderPage();
    expect(
      screen.queryByRole('button', { name: /save this gauge to a project/i }),
    ).not.toBeInTheDocument();
  });

  it('shows the Save-to-Rowly CTA for logged-out visitors once a result computes', () => {
    renderPage();
    fillSwatch(20, 28);
    expect(
      screen.getByRole('button', { name: /save this gauge to a project/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/save this gauge to your rowly workspace/i),
    ).toBeInTheDocument();
  });

  it('shows the Save-to-Rowly CTA for authenticated users once a result computes', () => {
    useAuthStore.setState({
      isAuthenticated: true,
      user: { id: 'u1', email: 'a@b.c', firstName: 'A', lastName: 'B' } as any,
      accessToken: null,
    });
    renderPage();
    expect(
      screen.queryByRole('button', { name: /save this gauge to a project/i }),
    ).not.toBeInTheDocument();
    fillSwatch(20, 28);
    expect(
      screen.getByRole('button', { name: /save this gauge to a project/i }),
    ).toBeInTheDocument();
  });
});
