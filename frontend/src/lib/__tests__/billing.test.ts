/**
 * Tests for the typed billing client. Mocks `axios` so we can assert
 * each helper hits the right URL and returns the right shape.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('axios', () => {
  const get = vi.fn();
  const post = vi.fn();
  return {
    default: { get, post },
    get,
    post,
  };
});

import axios from 'axios';
import {
  fetchBillingStatus,
  startCheckout,
  fetchPortalUrl,
  BillingError,
  humanStatusLabel,
} from '../billing';

const mockedGet = axios.get as unknown as ReturnType<typeof vi.fn>;
const mockedPost = axios.post as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockedGet.mockReset();
  mockedPost.mockReset();
});

describe('fetchBillingStatus', () => {
  it('GETs /api/billing/status and unwraps `data.data`', async () => {
    mockedGet.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          provider: 'mock',
          providerReady: true,
          preLaunchOpen: false,
          entitled: true,
          reason: 'trialing',
          plan: 'monthly',
          status: 'on_trial',
          trialEndsAt: '2026-06-01T00:00:00.000Z',
          renewsAt: null,
          endsAt: null,
          customerPortalUrl: 'https://lemon.test/p/x',
        },
      },
    });

    const result = await fetchBillingStatus();
    expect(mockedGet).toHaveBeenCalledWith('/api/billing/status');
    expect(result.entitled).toBe(true);
    expect(result.plan).toBe('monthly');
    expect(result.customerPortalUrl).toBe('https://lemon.test/p/x');
  });

  it('throws BillingError carrying code + status from a 503', async () => {
    mockedGet.mockRejectedValueOnce({
      response: {
        status: 503,
        data: {
          error: 'BILLING_NOT_AVAILABLE',
          message: 'Billing is not yet available',
          missing: ['LEMONSQUEEZY_API_KEY'],
        },
      },
    });

    await expect(fetchBillingStatus()).rejects.toMatchObject({
      code: 'BILLING_NOT_AVAILABLE',
      status: 503,
      missing: ['LEMONSQUEEZY_API_KEY'],
    });
  });
});

describe('startCheckout', () => {
  it('POSTs the right plan-specific URL', async () => {
    mockedPost.mockResolvedValueOnce({
      data: {
        success: true,
        data: { checkoutUrl: 'https://lemon.test/co/abc', sessionId: 'abc', plan: 'monthly' },
      },
    });

    const result = await startCheckout('monthly');
    expect(mockedPost).toHaveBeenCalledWith('/api/billing/checkout/monthly');
    expect(result.checkoutUrl).toBe('https://lemon.test/co/abc');
    expect(result.plan).toBe('monthly');
  });

  it('routes annual plan to /checkout/annual', async () => {
    mockedPost.mockResolvedValueOnce({
      data: {
        success: true,
        data: { checkoutUrl: 'https://lemon.test/co/y', sessionId: 'y', plan: 'annual' },
      },
    });
    await startCheckout('annual');
    expect(mockedPost).toHaveBeenCalledWith('/api/billing/checkout/annual');
  });

  it('throws BillingError on 502', async () => {
    mockedPost.mockRejectedValueOnce({
      response: { status: 502, data: { error: 'CHECKOUT_FAILED', message: 'Could not create checkout' } },
    });
    await expect(startCheckout('monthly')).rejects.toBeInstanceOf(BillingError);
  });
});

describe('fetchPortalUrl', () => {
  it('returns the portal URL', async () => {
    mockedPost.mockResolvedValueOnce({
      data: { success: true, data: { portalUrl: 'https://lemon.test/portal/x' } },
    });
    const result = await fetchPortalUrl();
    expect(mockedPost).toHaveBeenCalledWith('/api/billing/portal');
    expect(result.portalUrl).toBe('https://lemon.test/portal/x');
  });
});

describe('humanStatusLabel', () => {
  // PR #389 P2 cancelled-grace policy. The label switch was hoisted
  // into lib/billing in pass 2 so AccountBillingPage and UpgradePage
  // share it. The new endsAt argument lets a cancelled-with-future
  // subscription read "Access until <date>" rather than implying
  // active renewal — the reviewer flagged this as a SaaS-expectation
  // gap.
  const NOW = new Date('2026-05-06T12:00:00Z');

  it('returns "Active" for active', () => {
    expect(humanStatusLabel('active')).toBe('Active');
  });

  it('returns "Free trial" for on_trial', () => {
    expect(humanStatusLabel('on_trial')).toBe('Free trial');
  });

  it('returns "Cancelled" for cancelled when endsAt is null', () => {
    expect(humanStatusLabel('cancelled', null, NOW)).toBe('Cancelled');
  });

  it('returns "Cancelled" for cancelled when endsAt is in the past', () => {
    const past = new Date(NOW.getTime() - 24 * 60 * 60 * 1000).toISOString();
    expect(humanStatusLabel('cancelled', past, NOW)).toBe('Cancelled');
  });

  it('returns "Access until <date>" for cancelled when endsAt is in the future', () => {
    const future = new Date(NOW.getTime() + 14 * 24 * 60 * 60 * 1000);
    const expected = `Access until ${future.toLocaleDateString()}`;
    expect(humanStatusLabel('cancelled', future.toISOString(), NOW)).toBe(expected);
    // US spelling parity — LS sometimes serializes both.
    expect(humanStatusLabel('canceled', future.toISOString(), NOW)).toBe(expected);
  });

  it('returns "Cancelled" for cancelled when endsAt is unparseable', () => {
    expect(humanStatusLabel('cancelled', 'not-a-date', NOW)).toBe('Cancelled');
  });

  it('returns "Expired" for expired regardless of endsAt', () => {
    const future = new Date(NOW.getTime() + 86_400_000).toISOString();
    expect(humanStatusLabel('expired', future, NOW)).toBe('Expired');
  });

  it('returns "Unknown" for null status', () => {
    expect(humanStatusLabel(null)).toBe('Unknown');
  });
});
