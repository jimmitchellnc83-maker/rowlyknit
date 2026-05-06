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
import { fetchBillingStatus, startCheckout, fetchPortalUrl, BillingError } from '../billing';

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
