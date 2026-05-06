/**
 * Controller-level tests for the billing surface.
 *
 * Mocks the billing-service factory + the knex `db` so handlers run in
 * isolation. No express harness — we invoke the handler directly with
 * a hand-built req / res. That keeps the test focused on:
 *   - status returns the right shape
 *   - checkout 503s when the provider isn't ready
 *   - webhook rejects bad signatures and ingests good ones
 */

const mockGetBillingService = jest.fn();
const mockCanUse = jest.fn();
const dbMock: any = jest.fn();

jest.mock('../../services/billing', () => ({
  getBillingService: () => mockGetBillingService(),
  __esModule: true,
}));

jest.mock('../../utils/entitlement', () => ({
  canUsePaidWorkspaceForReq: (...args: any[]) => mockCanUse(...args),
  __esModule: true,
}));

jest.mock('../../config/database', () => ({
  default: dbMock,
  __esModule: true,
}));

jest.mock('../../config/logger', () => ({
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  __esModule: true,
}));

import type { Request, Response } from 'express';
import {
  getStatus,
  checkoutMonthly,
  checkoutAnnual,
  lemonSqueezyWebhook,
  portal,
} from '../billingController';

function makeRes(): Response {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
}

const ENV_KEYS = [
  'BILLING_PROVIDER',
  'BILLING_PRE_LAUNCH_OPEN',
  'APP_URL',
  'LEMONSQUEEZY_API_KEY',
  'LEMONSQUEEZY_WEBHOOK_SECRET',
  'LEMONSQUEEZY_STORE_ID',
  'LEMONSQUEEZY_PRODUCT_ID',
  'LEMONSQUEEZY_MONTHLY_VARIANT_ID',
  'LEMONSQUEEZY_ANNUAL_VARIANT_ID',
];

let originalEnv: Record<string, string | undefined>;

beforeEach(() => {
  originalEnv = {};
  ENV_KEYS.forEach((k) => {
    originalEnv[k] = process.env[k];
    delete process.env[k];
  });
  mockGetBillingService.mockReset();
  mockCanUse.mockReset();
  dbMock.mockReset();
});

afterEach(() => {
  ENV_KEYS.forEach((k) => {
    if (originalEnv[k] === undefined) delete process.env[k];
    else process.env[k] = originalEnv[k] as string;
  });
});

function buildBuilderForLatestSub(row: any) {
  return {
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    first: jest.fn().mockResolvedValue(row),
  };
}

describe('GET /api/billing/status', () => {
  it('returns provider/state and entitlement booleans', async () => {
    process.env.BILLING_PROVIDER = 'mock';
    mockCanUse.mockResolvedValueOnce({
      allowed: true,
      reason: 'trialing',
      subscription: {
        status: 'on_trial',
        plan: 'monthly',
        trialEndsAt: '2026-06-01T00:00:00.000Z',
        renewsAt: null,
        endsAt: null,
      },
    });
    dbMock.mockReturnValueOnce(
      buildBuilderForLatestSub({ customer_portal_url: 'https://lemon.test/portal/x' }),
    );

    const req = { user: { userId: 'user-1', email: 'a@b.c' } } as unknown as Request;
    const res = makeRes();
    await getStatus(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          provider: 'mock',
          providerReady: true,
          entitled: true,
          reason: 'trialing',
          plan: 'monthly',
          status: 'on_trial',
          trialEndsAt: '2026-06-01T00:00:00.000Z',
          customerPortalUrl: 'https://lemon.test/portal/x',
        }),
      }),
    );
  });
});

describe('POST /api/billing/checkout/*', () => {
  it('503s when LS provider isn\'t ready', async () => {
    process.env.BILLING_PROVIDER = 'lemonsqueezy';
    // No LS env vars → not ready.
    mockGetBillingService.mockReturnValue(null);

    const req = { user: { userId: 'u' } } as unknown as Request;
    const res = makeRes();
    await checkoutMonthly(req, res);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: 'BILLING_NOT_AVAILABLE',
      }),
    );
  });

  it('returns the checkout URL from the provider when ready', async () => {
    process.env.BILLING_PROVIDER = 'mock';
    mockGetBillingService.mockReturnValue({
      providerName: 'mock',
      createCheckout: jest.fn().mockResolvedValue({
        checkoutUrl: 'https://example.test/co/abc',
        sessionId: 'co-abc',
      }),
    });
    dbMock.mockReturnValueOnce({
      where: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValue({ email: 'u@example.com' }),
    });

    const req = { user: { userId: 'user-1' } } as unknown as Request;
    const res = makeRes();
    await checkoutAnnual(req, res);

    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: {
        checkoutUrl: 'https://example.test/co/abc',
        sessionId: 'co-abc',
        plan: 'annual',
      },
    });
  });

  it('502s when the provider throws', async () => {
    process.env.BILLING_PROVIDER = 'mock';
    mockGetBillingService.mockReturnValue({
      providerName: 'mock',
      createCheckout: jest.fn().mockRejectedValue(new Error('boom')),
    });
    dbMock.mockReturnValueOnce({
      where: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValue({ email: 'u@example.com' }),
    });

    const req = { user: { userId: 'u' } } as unknown as Request;
    const res = makeRes();
    await checkoutMonthly(req, res);

    expect(res.status).toHaveBeenCalledWith(502);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'CHECKOUT_FAILED' }),
    );
  });
});

describe('POST /api/billing/portal', () => {
  it('returns the stored customer-portal URL', async () => {
    dbMock.mockReturnValueOnce({
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValue({
        customer_portal_url: 'https://lemon.test/portal/x',
      }),
    });

    const req = { user: { userId: 'u' } } as unknown as Request;
    const res = makeRes();
    await portal(req, res);

    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { portalUrl: 'https://lemon.test/portal/x' },
    });
  });

  it('404s when no portal URL is on file', async () => {
    dbMock.mockReturnValueOnce({
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValue(null),
    });

    const req = { user: { userId: 'u' } } as unknown as Request;
    const res = makeRes();
    await portal(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('filters by configured provider — mock rows do not leak through when provider=lemonsqueezy', async () => {
    // PR #389 review fix. The `where()` query in `portal` must scope
    // to `cfg.provider` so a stale mock-provider row from a prior
    // smoke test doesn't satisfy a production lookup. We verify the
    // builder receives the provider in its where filter.
    process.env.BILLING_PROVIDER = 'lemonsqueezy';
    process.env.LEMONSQUEEZY_API_KEY = 'k';
    process.env.LEMONSQUEEZY_WEBHOOK_SECRET = 's';
    process.env.LEMONSQUEEZY_STORE_ID = '1';
    process.env.LEMONSQUEEZY_PRODUCT_ID = '2';
    process.env.LEMONSQUEEZY_MONTHLY_VARIANT_ID = '3';
    process.env.LEMONSQUEEZY_ANNUAL_VARIANT_ID = '4';

    const whereSpy = jest.fn().mockReturnThis();
    dbMock.mockReturnValueOnce({
      where: whereSpy,
      orderBy: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValue(null),
    });

    const req = { user: { userId: 'u' } } as unknown as Request;
    const res = makeRes();
    await portal(req, res);

    expect(whereSpy).toHaveBeenCalledWith({
      user_id: 'u',
      provider: 'lemonsqueezy',
    });
  });
});

describe('GET /api/billing/status — provider filter', () => {
  it('scopes the customer-portal-URL lookup to the configured provider', async () => {
    process.env.BILLING_PROVIDER = 'mock';
    mockCanUse.mockResolvedValueOnce({
      allowed: true,
      reason: 'trialing',
      subscription: null,
    });
    const whereSpy = jest.fn().mockReturnThis();
    dbMock.mockReturnValueOnce({
      where: whereSpy,
      orderBy: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValue({
        customer_portal_url: 'https://example.test/portal/mock-1',
      }),
    });

    const req = { user: { userId: 'user-x', email: 'a@b.c' } } as unknown as Request;
    const res = makeRes();
    await getStatus(req, res);

    expect(whereSpy).toHaveBeenCalledWith({
      user_id: 'user-x',
      provider: 'mock',
    });
  });
});

describe('POST /api/billing/lemonsqueezy/webhook', () => {
  it('rejects 401 on invalid signature', async () => {
    process.env.BILLING_PROVIDER = 'mock';
    const verify = jest.fn().mockReturnValue(false);
    mockGetBillingService.mockReturnValue({
      providerName: 'mock',
      verifyWebhook: verify,
      parseWebhook: jest.fn(),
      ingestWebhookEvent: jest.fn(),
    });

    const req = {
      body: Buffer.from('{}'),
      headers: { 'x-signature': 'bad' },
    } as unknown as Request;
    const res = makeRes();
    await lemonSqueezyWebhook(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('500s when raw-body parser missing (defensive guard)', async () => {
    process.env.BILLING_PROVIDER = 'mock';
    mockGetBillingService.mockReturnValue({
      providerName: 'mock',
      verifyWebhook: jest.fn(),
      parseWebhook: jest.fn(),
      ingestWebhookEvent: jest.fn(),
    });
    const req = { body: { not: 'a buffer' }, headers: {} } as unknown as Request;
    const res = makeRes();
    await lemonSqueezyWebhook(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('ingests valid event and returns 200', async () => {
    process.env.BILLING_PROVIDER = 'mock';
    const ingest = jest.fn().mockResolvedValue('processed');
    mockGetBillingService.mockReturnValue({
      providerName: 'mock',
      verifyWebhook: jest.fn().mockReturnValue(true),
      parseWebhook: jest.fn().mockReturnValue({
        eventId: 'wh_123',
        eventName: 'subscription_created',
        userId: 'u',
        subscription: null,
        customer: null,
        raw: {},
      }),
      ingestWebhookEvent: ingest,
    });

    const req = {
      body: Buffer.from('{}'),
      headers: { 'x-signature': 'doesntmatter-mock-passes' },
    } as unknown as Request;
    const res = makeRes();
    await lemonSqueezyWebhook(req, res);

    expect(ingest).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: { outcome: 'processed', eventId: 'wh_123' } }),
    );
  });
});
