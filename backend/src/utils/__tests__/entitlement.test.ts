/**
 * Tests for the server-side entitlement helper.
 *
 * Mocks the billing service module so we can pin specific subscription
 * states without exercising the DB layer. Each case isolates env vars
 * (OWNER_EMAIL, BILLING_PRE_LAUNCH_OPEN, BILLING_PROVIDER) so suites
 * don't bleed into each other.
 */

const mockGetBillingStatusForUser = jest.fn();
const mockGetBillingService = jest.fn();

jest.mock('../../services/billing', () => ({
  getBillingService: () => mockGetBillingService(),
  __esModule: true,
}));

jest.mock('../../config/logger', () => ({
  default: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
  __esModule: true,
}));

const ENV_KEYS = [
  'OWNER_EMAIL',
  'BILLING_PROVIDER',
  'BILLING_PRE_LAUNCH_OPEN',
  'APP_URL',
];

let originalEnv: Record<string, string | undefined>;

beforeEach(() => {
  jest.resetModules();
  originalEnv = {};
  ENV_KEYS.forEach((k) => {
    originalEnv[k] = process.env[k];
    delete process.env[k];
  });
  mockGetBillingStatusForUser.mockReset();
  mockGetBillingService.mockReset();
});

afterEach(() => {
  ENV_KEYS.forEach((k) => {
    if (originalEnv[k] === undefined) delete process.env[k];
    else process.env[k] = originalEnv[k] as string;
  });
});

function fakeService(status: any) {
  return {
    providerName: 'mock',
    getBillingStatusForUser: jest.fn(async () => status),
  };
}

describe('canUsePaidWorkspace', () => {
  it('denies with reason=unauthenticated when no userId', async () => {
    const { canUsePaidWorkspace } = require('../entitlement');
    const result = await canUsePaidWorkspace({ userId: null });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('unauthenticated');
  });

  it('allows owner email regardless of subscription state', async () => {
    process.env.OWNER_EMAIL = 'owner@example.com';
    const { canUsePaidWorkspace } = require('../entitlement');
    const result = await canUsePaidWorkspace({
      userId: 'u',
      email: 'OWNER@example.com',
    });
    expect(result.allowed).toBe(true);
    expect(result.reason).toBe('owner');
  });

  it('allows when BILLING_PRE_LAUNCH_OPEN=true', async () => {
    process.env.BILLING_PRE_LAUNCH_OPEN = 'true';
    const { canUsePaidWorkspace } = require('../entitlement');
    const result = await canUsePaidWorkspace({ userId: 'u', email: 'a@b.c' });
    expect(result.allowed).toBe(true);
    expect(result.reason).toBe('pre_launch_open');
  });

  it('denies with no_subscription when no provider AND no pre_launch_open', async () => {
    mockGetBillingService.mockReturnValue(null);
    const { canUsePaidWorkspace } = require('../entitlement');
    const result = await canUsePaidWorkspace({ userId: 'u', email: 'a@b.c' });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('no_subscription');
  });

  it('denies with no_subscription when service returns no row', async () => {
    process.env.BILLING_PROVIDER = 'mock';
    mockGetBillingService.mockReturnValue(
      fakeService({ subscription: null, isActive: false }),
    );
    const { canUsePaidWorkspace } = require('../entitlement');
    const result = await canUsePaidWorkspace({ userId: 'u', email: 'a@b.c' });
    expect(result.reason).toBe('no_subscription');
    expect(result.allowed).toBe(false);
  });

  it('allows trialing for status=on_trial', async () => {
    process.env.BILLING_PROVIDER = 'mock';
    mockGetBillingService.mockReturnValue(
      fakeService({
        subscription: {
          status: 'on_trial',
          plan: 'monthly',
          trial_ends_at: new Date('2026-06-01'),
          renews_at: null,
          ends_at: null,
        },
        isActive: true,
      }),
    );
    const { canUsePaidWorkspace } = require('../entitlement');
    const result = await canUsePaidWorkspace({ userId: 'u', email: 'a@b.c' });
    expect(result.allowed).toBe(true);
    expect(result.reason).toBe('trialing');
  });

  it('allows active subscription', async () => {
    process.env.BILLING_PROVIDER = 'mock';
    mockGetBillingService.mockReturnValue(
      fakeService({
        subscription: { status: 'active', plan: 'annual', trial_ends_at: null, renews_at: new Date(), ends_at: null },
        isActive: true,
      }),
    );
    const { canUsePaidWorkspace } = require('../entitlement');
    const result = await canUsePaidWorkspace({ userId: 'u', email: 'a@b.c' });
    expect(result.allowed).toBe(true);
    expect(result.reason).toBe('active_subscription');
  });

  it.each(['cancelled', 'expired', 'past_due', 'unpaid'])(
    'denies status=%s with reason=no_active_subscription',
    async (status) => {
      process.env.BILLING_PROVIDER = 'mock';
      mockGetBillingService.mockReturnValue(
        fakeService({
          subscription: { status, plan: 'monthly', trial_ends_at: null, renews_at: null, ends_at: null },
          isActive: false,
        }),
      );
      const { canUsePaidWorkspace } = require('../entitlement');
      const result = await canUsePaidWorkspace({ userId: 'u', email: 'a@b.c' });
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('no_active_subscription');
    },
  );
});
