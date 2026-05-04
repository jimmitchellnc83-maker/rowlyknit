/**
 * Auth + Launch Polish Sprint 2026-05-04 — ForgotPassword error handling.
 *
 * Before: every POST failure was swallowed and rendered as "if an
 * account exists, we've sent a link" — including 429 rate-limit hits
 * and 5xx server errors. The user had no way to tell whether anything
 * happened. Codex review on PR #381 + live smoke caught this.
 *
 * Contract:
 *   - 2xx → enumeration-safe success message (same wording whether
 *     the email matched a real user or not).
 *   - 429 → visible error.
 *   - 5xx / transport failure → visible error.
 *   - other 4xx → visible error.
 *
 * Toasts in `react-toastify` aren't strictly visible in jsdom unless
 * the container is mounted, so we lock the inline error region too —
 * it has a deterministic role="alert" + data-testid the test can
 * grab without racing toast animations.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';

vi.mock('axios', async () => {
  const actual = await vi.importActual<typeof import('axios')>('axios');
  return {
    ...actual,
    default: {
      ...actual.default,
      post: vi.fn(),
    },
  };
});

import axios from 'axios';
import ForgotPassword from './ForgotPassword';

function renderForm() {
  return render(
    <MemoryRouter>
      <ForgotPassword />
      <ToastContainer />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('ForgotPassword — enumeration-safe success', () => {
  it('shows the success card on 2xx response', async () => {
    (axios.post as any).mockResolvedValueOnce({ status: 200, data: { success: true } });

    renderForm();
    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'real@rowly.test' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send reset link/i }));

    expect(await screen.findByText(/check your email/i)).toBeInTheDocument();
    expect(screen.queryByTestId('forgot-password-error')).not.toBeInTheDocument();
  });

  it('shows the same success card for an unknown email (the backend always 2xxs)', async () => {
    // The backend deliberately 200s whether or not the email matches a
    // real account — that's the enumeration-safety contract. We just
    // mirror it on the UI.
    (axios.post as any).mockResolvedValueOnce({ status: 200, data: { success: true } });

    renderForm();
    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'nope@rowly.test' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send reset link/i }));

    expect(await screen.findByText(/check your email/i)).toBeInTheDocument();
    expect(screen.queryByTestId('forgot-password-error')).not.toBeInTheDocument();
  });
});

describe('ForgotPassword — surfaces real failures', () => {
  it('surfaces a 429 rate-limit response as a visible error', async () => {
    (axios.post as any).mockRejectedValueOnce({
      isAxiosError: true,
      response: {
        status: 429,
        data: { success: false, message: 'Too many password reset requests, please try again later' },
      },
    });

    renderForm();
    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'rate-limited@rowly.test' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send reset link/i }));

    const alert = await screen.findByTestId('forgot-password-error');
    expect(alert).toHaveTextContent(/too many/i);
    // The user is still on the form — they did NOT get bumped to the
    // "check your email" success card.
    expect(screen.queryByText(/check your email/i)).not.toBeInTheDocument();
  });

  it('surfaces a 5xx server error as a visible error', async () => {
    (axios.post as any).mockRejectedValueOnce({
      isAxiosError: true,
      response: {
        status: 500,
        data: { success: false, message: 'Internal server error' },
      },
    });

    renderForm();
    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'broken@rowly.test' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send reset link/i }));

    const alert = await screen.findByTestId('forgot-password-error');
    expect(alert).toHaveTextContent(/something went wrong/i);
    expect(screen.queryByText(/check your email/i)).not.toBeInTheDocument();
  });

  it('surfaces a transport failure (no response object) as a visible error', async () => {
    (axios.post as any).mockRejectedValueOnce({
      isAxiosError: true,
      // no response — network error / DNS failure / proxy down
    });

    renderForm();
    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'unreachable@rowly.test' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send reset link/i }));

    const alert = await screen.findByTestId('forgot-password-error');
    expect(alert).toHaveTextContent(/couldn't reach the server/i);
  });

  it('clears the error when the user retries successfully', async () => {
    // First click — rate-limited.
    (axios.post as any).mockRejectedValueOnce({
      isAxiosError: true,
      response: { status: 429, data: { message: 'Too many password reset requests' } },
    });
    renderForm();

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'retry@rowly.test' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send reset link/i }));
    await screen.findByTestId('forgot-password-error');

    // Second click — now succeeds. Wait for the inline error to clear.
    (axios.post as any).mockResolvedValueOnce({ status: 200, data: { success: true } });
    fireEvent.click(screen.getByRole('button', { name: /send reset link/i }));

    await waitFor(() => {
      expect(screen.queryByTestId('forgot-password-error')).not.toBeInTheDocument();
    });
    expect(await screen.findByText(/check your email/i)).toBeInTheDocument();
  });
});
