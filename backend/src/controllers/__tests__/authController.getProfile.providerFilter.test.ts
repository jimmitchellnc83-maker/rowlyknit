/**
 * PR #389 P1 closure pass 2 — `getProfile` must filter
 * `billing_subscriptions` by the currently-configured billing
 * provider, mirroring `billingController.getStatus` + portal URL
 * lookup.
 *
 * Why this matters: a deployment can have stale `mock` subscription
 * rows from dev/staging exercises (or — eventually — rows from a
 * provider that was retired). When the production deploy flips
 * `BILLING_PROVIDER=lemonsqueezy`, `/api/auth/profile` would otherwise
 * surface those stale rows as the user's "current subscription". The
 * fix queries `billing_subscriptions` with `{ user_id, provider }`
 * matching the active config so a mismatched row is invisible.
 *
 * The test mocks the `db` chain so we can assert (a) the WHERE clause
 * actually carries `provider: <cfg.provider>` and (b) the response's
 * `subscription` field is null when no row matches the provider.
 */

process.env.JWT_SECRET = 'a'.repeat(40);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(40);
process.env.NODE_ENV = 'test';

interface ChainCall {
  table: string;
  method: string;
  args: unknown[];
}

const captured: ChainCall[] = [];

const usersFirst = jest.fn();
const billingFirst = jest.fn();

jest.mock('../../config/database', () => {
  const dbFn: any = jest.fn((table: string) => {
    function chain(): any {
      const handler: ProxyHandler<object> = {
        get(_t, prop) {
          const name = String(prop);
          return (...args: unknown[]) => {
            captured.push({ table, method: name, args });
            if (name === 'first') {
              if (table === 'users') return usersFirst();
              if (table === 'billing_subscriptions') return billingFirst();
              return Promise.resolve(null);
            }
            return new Proxy({}, handler);
          };
        },
      };
      return new Proxy({}, handler);
    }
    return chain();
  });
  return { default: dbFn, __esModule: true };
});

jest.mock('../../middleware/auditLog', () => ({
  createAuditLog: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../config/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { getProfile } from '../authController';

function makeReq(): any {
  return {
    body: {},
    cookies: {},
    headers: {},
    ip: '1.2.3.4',
    user: { userId: 'user-1', email: 'a@example.com' },
  };
}

function makeRes(): any {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

const ENV_KEYS = ['BILLING_PROVIDER', 'BILLING_PRE_LAUNCH_OPEN', 'APP_URL'] as const;
const savedEnv: Record<string, string | undefined> = {};
beforeAll(() => {
  for (const k of ENV_KEYS) savedEnv[k] = process.env[k];
});
afterAll(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k] as string;
  }
});

beforeEach(() => {
  captured.length = 0;
  jest.clearAllMocks();
  // Sane default: provider=none means no filter row exists, so
  // billingFirst should return undefined unless the test overrides.
  billingFirst.mockResolvedValue(undefined);
  usersFirst.mockResolvedValue({
    id: 'user-1',
    email: 'a@example.com',
    first_name: 'A',
    last_name: 'User',
    username: null,
    profile_image: null,
    email_verified: true,
    preferences: {},
    created_at: new Date('2026-01-01T00:00:00.000Z'),
  });
});

describe('getProfile — billing_subscriptions filter by active provider', () => {
  it('queries billing_subscriptions with provider=lemonsqueezy when BILLING_PROVIDER=lemonsqueezy', async () => {
    process.env.BILLING_PROVIDER = 'lemonsqueezy';
    process.env.APP_URL = 'https://rowlyknit.com';
    // The other LS env vars aren't read by getBillingConfig at this
    // call site — only the provider token matters here.

    billingFirst.mockResolvedValueOnce({
      status: 'active',
      plan: 'monthly',
      provider: 'lemonsqueezy',
      trial_ends_at: null,
      renews_at: new Date('2026-06-01T00:00:00.000Z'),
      ends_at: null,
    });

    const res = makeRes();
    await getProfile(makeReq(), res);

    const billingWheres = captured.filter(
      (c) => c.table === 'billing_subscriptions' && c.method === 'where',
    );
    // The first .where(...) should carry both user_id and provider.
    expect(billingWheres.length).toBeGreaterThanOrEqual(1);
    const filter = billingWheres[0].args[0] as Record<string, unknown>;
    expect(filter.user_id).toBe('user-1');
    expect(filter.provider).toBe('lemonsqueezy');

    expect(res.json).toHaveBeenCalled();
    const body = (res.json as jest.Mock).mock.calls[0][0];
    expect(body.data.user.subscription).toEqual(
      expect.objectContaining({ status: 'active', plan: 'monthly' }),
    );
  });

  it('returns subscription=null when DB only has a stale mock row but provider is now lemonsqueezy', async () => {
    process.env.BILLING_PROVIDER = 'lemonsqueezy';
    process.env.APP_URL = 'https://rowlyknit.com';
    // Simulate the production filter: there is a mock row in the DB
    // (left over from staging), but the WHERE provider='lemonsqueezy'
    // means the lookup returns nothing.
    billingFirst.mockResolvedValueOnce(undefined);

    const res = makeRes();
    await getProfile(makeReq(), res);

    const filter = (
      captured.find(
        (c) => c.table === 'billing_subscriptions' && c.method === 'where',
      )?.args[0] as Record<string, unknown> | undefined
    );
    expect(filter?.provider).toBe('lemonsqueezy');

    const body = (res.json as jest.Mock).mock.calls[0][0];
    expect(body.data.user.subscription).toBeNull();
  });

  it('uses provider=none when BILLING_PROVIDER is unset and surfaces null subscription', async () => {
    delete process.env.BILLING_PROVIDER;
    delete process.env.APP_URL;

    const res = makeRes();
    await getProfile(makeReq(), res);

    const filter = (
      captured.find(
        (c) => c.table === 'billing_subscriptions' && c.method === 'where',
      )?.args[0] as Record<string, unknown> | undefined
    );
    expect(filter?.provider).toBe('none');

    const body = (res.json as jest.Mock).mock.calls[0][0];
    expect(body.data.user.subscription).toBeNull();
  });
});
