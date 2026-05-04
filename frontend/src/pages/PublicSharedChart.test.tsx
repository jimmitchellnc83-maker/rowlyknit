/**
 * Recipient-facing public chart viewer — verifies the password flow that
 * replaces the dropped `?password=…` query string. This is the surface a
 * non-Rowly recipient lands on after clicking a share link, so the
 * contract is:
 *   1. password-protected GET → password form appears,
 *   2. wrong password → inline error, no chart shown,
 *   3. correct password → chart renders + download link works,
 *   4. nothing the page does ever appends `?password=` to a URL,
 *   5. 429 throttling renders a cooldown message instead of crashing.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import axios, { AxiosError } from 'axios';
import PublicSharedChart from './PublicSharedChart';

vi.mock('axios');
const mockedAxios = axios as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  isCancel: (e: unknown) => boolean;
};

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/c/:token" element={<PublicSharedChart />} />
      </Routes>
    </MemoryRouter>
  );
}

function ax401(passwordProtected = true) {
  const err = new Error('401') as AxiosError<{
    password_protected?: boolean;
    error?: string;
  }>;
  err.isAxiosError = true;
  err.response = {
    status: 401,
    data: passwordProtected
      ? { password_protected: true, error: 'Password required' }
      : { error: 'Invalid password' },
    statusText: 'Unauthorized',
    headers: {},
    config: {} as never,
  };
  return err;
}

function ax429(retryAfter?: string) {
  const err = new Error('429') as AxiosError;
  err.isAxiosError = true;
  err.response = {
    status: 429,
    data: { error: 'Too many attempts' },
    statusText: 'Too Many Requests',
    headers: retryAfter ? { 'retry-after': retryAfter } : {},
    config: {} as never,
  };
  return err;
}

const OK_PAYLOAD = {
  data: {
    chart: {
      id: 'chart-1',
      name: 'Cabled Cowl',
      grid: [['k', 'k', 'p'], ['p', 'k', 'k']],
      rows: 2,
      columns: 3,
      symbol_legend: { k: 'knit', p: 'purl' },
      description: 'A simple cabled cowl chart.',
    },
    share_options: {
      allow_copy: false,
      allow_download: true,
      visibility: 'public',
    },
  },
};

beforeEach(() => {
  vi.resetAllMocks();
  // axios.isCancel is read by the page on every error; default it to a
  // real function so canceled-Promise paths don't blow up.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (mockedAxios as any).isCancel = (e: unknown) =>
    !!(e && typeof e === 'object' && (e as { name?: string }).name === 'CanceledError');
});

describe('PublicSharedChart — password-protected recipient flow', () => {
  it('shows the password form when GET returns 401 password_required', async () => {
    mockedAxios.get.mockRejectedValueOnce(ax401(true));

    renderAt('/c/abc123');

    expect(await screen.findByRole('heading', { name: /Password required/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Unlock chart/i })).toBeInTheDocument();
  });

  it('keeps the password form on 401 with the wrong password and shows an inline error', async () => {
    mockedAxios.get.mockRejectedValueOnce(ax401(true));
    // Wrong password → 401 (not password_protected — body says invalid).
    mockedAxios.post.mockRejectedValueOnce(ax401(false));

    renderAt('/c/abc123');

    const input = (await screen.findByLabelText(/Password/i)) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'guess' } });
    fireEvent.click(screen.getByRole('button', { name: /Unlock chart/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/Incorrect password/i);
    // We MUST still be on the password form — chart never rendered.
    expect(
      screen.queryByRole('heading', { name: /Cabled Cowl/i })
    ).not.toBeInTheDocument();
  });

  it('renders the chart + download link after the correct password unlocks it', async () => {
    // Sequence:
    //   1. initial GET → 401 password_required
    //   2. POST /access → 200 (access cookie set out-of-band)
    //   3. retry GET → 200 with chart payload
    mockedAxios.get
      .mockRejectedValueOnce(ax401(true))
      .mockResolvedValueOnce(OK_PAYLOAD);
    mockedAxios.post.mockResolvedValueOnce({ data: { success: true } });

    renderAt('/c/abc123');

    const input = (await screen.findByLabelText(/Password/i)) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'correct-horse' } });
    fireEvent.click(screen.getByRole('button', { name: /Unlock chart/i }));

    expect(await screen.findByRole('heading', { name: /Cabled Cowl/i })).toBeInTheDocument();

    // Download link is rendered (allow_download: true).
    const dl = screen.getByRole('link', { name: /Download PDF/i }) as HTMLAnchorElement;
    expect(dl).toBeInTheDocument();

    // CRITICAL: the download URL must not carry a password query param.
    // (`?password=…` flow is intentionally dead end-to-end.)
    expect(dl.getAttribute('href')).toBe('/shared/chart/abc123/download?format=pdf');
    expect(dl.getAttribute('href')).not.toMatch(/[?&]password=/i);
  });

  it('never appends ?password= to the GET request URL', async () => {
    mockedAxios.get.mockRejectedValueOnce(ax401(true));
    mockedAxios.post.mockResolvedValueOnce({ data: { success: true } });
    mockedAxios.get.mockResolvedValueOnce(OK_PAYLOAD);

    renderAt('/c/abc123');

    fireEvent.change(await screen.findByLabelText(/Password/i), {
      target: { value: 'pw' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Unlock chart/i }));

    await waitFor(() => {
      expect(mockedAxios.get).toHaveBeenCalledTimes(2);
    });
    for (const call of mockedAxios.get.mock.calls) {
      const url = call[0] as string;
      expect(url).not.toMatch(/[?&]password=/i);
    }
    // Same guarantee for the POST: password rides in the body, not URL.
    for (const call of mockedAxios.post.mock.calls) {
      const url = call[0] as string;
      expect(url).not.toMatch(/[?&]password=/i);
      const body = call[1];
      expect(body).toEqual({ password: 'pw' });
    }
  });

  it('shows a cooldown message when /access returns 429', async () => {
    mockedAxios.get.mockRejectedValueOnce(ax401(true));
    mockedAxios.post.mockRejectedValueOnce(ax429('900')); // 15 minutes

    renderAt('/c/abc123');

    fireEvent.change(await screen.findByLabelText(/Password/i), {
      target: { value: 'wrong' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Unlock chart/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/Too many attempts/i);
    // Still on the password form.
    expect(screen.getByLabelText(/Password/i)).toBeInTheDocument();
  });
});

describe('PublicSharedChart — non-password public charts', () => {
  it('renders the chart immediately (no password gate) on 200', async () => {
    mockedAxios.get.mockResolvedValueOnce(OK_PAYLOAD);

    renderAt('/c/no-pw');

    expect(await screen.findByRole('heading', { name: /Cabled Cowl/i })).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: /Password required/i })
    ).not.toBeInTheDocument();
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it('shows the not-found state on 404', async () => {
    const err = new Error('404') as AxiosError;
    err.isAxiosError = true;
    err.response = {
      status: 404,
      data: { error: 'Chart not found or link expired' },
      statusText: 'Not Found',
      headers: {},
      config: {} as never,
    };
    mockedAxios.get.mockRejectedValueOnce(err);

    renderAt('/c/missing');

    expect(await screen.findByRole('heading', { name: /Chart not found/i })).toBeInTheDocument();
  });
});
