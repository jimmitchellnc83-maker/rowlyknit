/**
 * Component tests for the Maker plan / Upgrade page.
 *
 * Mocks the billing client + auth store so each branch (logged-out,
 * billing-not-ready, entitled, ready-not-entitled) renders without
 * actually hitting axios.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../lib/billing', () => ({
  fetchBillingStatus: vi.fn(),
  startCheckout: vi.fn(),
  fetchPortalUrl: vi.fn(),
  BillingError: class BillingError extends Error {
    code: string;
    status: number;
    constructor(message: string, code = 'BILLING_REQUEST_FAILED', status = 500) {
      super(message);
      this.code = code;
      this.status = status;
    }
  },
}));

vi.mock('../hooks/useSeo', () => ({
  useSeo: () => undefined,
}));

vi.mock('../lib/analytics', () => ({
  trackEvent: vi.fn(),
}));

const mockUseAuth = vi.fn();
vi.mock('../stores/authStore', () => ({
  useAuthStore: () => mockUseAuth(),
}));

import UpgradePage from './UpgradePage';
import * as billing from '../lib/billing';

const mockedFetchStatus = vi.mocked(billing.fetchBillingStatus);
const mockedStartCheckout = vi.mocked(billing.startCheckout);

function renderPage() {
  return render(
    <MemoryRouter>
      <UpgradePage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mockedFetchStatus.mockReset();
  mockedStartCheckout.mockReset();
  mockUseAuth.mockReset();
  // jsdom: stub `window.location.href` assignment by default so handlers don't navigate
  Object.defineProperty(window, 'location', {
    writable: true,
    value: { ...window.location, href: '' },
  });
});

describe('UpgradePage — pricing UI', () => {
  it('renders both pricing cards with $12 / $80 copy', async () => {
    mockUseAuth.mockReturnValue({ user: null, isAuthenticated: false });
    renderPage();
    expect(await screen.findByTestId('pricing-card-monthly')).toBeInTheDocument();
    expect(screen.getByTestId('pricing-card-annual')).toBeInTheDocument();
    expect(screen.getByText('$12')).toBeInTheDocument();
    expect(screen.getByText('$80')).toBeInTheDocument();
    expect(screen.getAllByText(/30-day free trial/i).length).toBeGreaterThanOrEqual(1);
  });

  it('logged-out click on a pricing card redirects to /login?next=/upgrade', async () => {
    mockUseAuth.mockReturnValue({ user: null, isAuthenticated: false });
    renderPage();
    fireEvent.click(screen.getByTestId('checkout-monthly'));
    await waitFor(() => {
      expect(window.location.href).toBe('/login?next=%2Fupgrade');
    });
    expect(mockedStartCheckout).not.toHaveBeenCalled();
  });
});

describe('UpgradePage — logged in, billing not ready', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      user: { email: 'plain@example.com' },
      isAuthenticated: true,
    });
    mockedFetchStatus.mockResolvedValue({
      provider: 'lemonsqueezy',
      providerReady: false,
      preLaunchOpen: false,
      entitled: false,
      reason: 'no_subscription',
      plan: null,
      status: null,
      trialEndsAt: null,
      renewsAt: null,
      endsAt: null,
      customerPortalUrl: null,
    });
  });

  it('shows the "Billing is not available yet" panel', async () => {
    renderPage();
    expect(await screen.findByText(/Billing is not available yet/i)).toBeInTheDocument();
  });

  it('disables the pricing-card buttons with "Coming soon"', async () => {
    renderPage();
    const monthly = await screen.findByTestId('checkout-monthly');
    await waitFor(() => expect(monthly).toBeDisabled());
    expect(monthly).toHaveTextContent(/Coming soon/i);
  });
});

describe('UpgradePage — logged in, entitled', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      user: { email: 'paid@example.com' },
      isAuthenticated: true,
    });
    mockedFetchStatus.mockResolvedValue({
      provider: 'lemonsqueezy',
      providerReady: true,
      preLaunchOpen: false,
      entitled: true,
      reason: 'trialing',
      plan: 'monthly',
      status: 'on_trial',
      trialEndsAt: '2026-06-01T00:00:00.000Z',
      renewsAt: null,
      endsAt: null,
      customerPortalUrl: 'https://lemon.test/portal/xyz',
    });
  });

  it('renders the "you\'re on Maker" banner with manage billing CTA', async () => {
    renderPage();
    expect(await screen.findByTestId('upgrade-active-banner')).toBeInTheDocument();
    expect(screen.getByTestId('upgrade-manage-billing')).toBeInTheDocument();
  });
});

describe('UpgradePage — logged in, billing ready, not entitled', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      user: { email: 'plain@example.com' },
      isAuthenticated: true,
    });
    mockedFetchStatus.mockResolvedValue({
      provider: 'lemonsqueezy',
      providerReady: true,
      preLaunchOpen: false,
      entitled: false,
      reason: 'no_subscription',
      plan: null,
      status: null,
      trialEndsAt: null,
      renewsAt: null,
      endsAt: null,
      customerPortalUrl: null,
    });
  });

  it('clicking the monthly button calls startCheckout and navigates to checkoutUrl', async () => {
    mockedStartCheckout.mockResolvedValueOnce({
      checkoutUrl: 'https://lemon.test/co/abc',
      sessionId: 'abc',
      plan: 'monthly',
    });

    renderPage();
    const button = await screen.findByTestId('checkout-monthly');
    await waitFor(() => expect(button).not.toBeDisabled());
    fireEvent.click(button);

    await waitFor(() => expect(mockedStartCheckout).toHaveBeenCalledWith('monthly'));
    await waitFor(() => {
      expect(window.location.href).toBe('https://lemon.test/co/abc');
    });
  });

  it('shows an inline error if checkout fails', async () => {
    mockedStartCheckout.mockRejectedValueOnce(
      Object.assign(new Error('boom'), { code: 'CHECKOUT_FAILED' }),
    );

    renderPage();
    const button = await screen.findByTestId('checkout-annual');
    await waitFor(() => expect(button).not.toBeDisabled());
    fireEvent.click(button);

    await waitFor(() => expect(screen.getByTestId('upgrade-error')).toBeInTheDocument());
  });
});
