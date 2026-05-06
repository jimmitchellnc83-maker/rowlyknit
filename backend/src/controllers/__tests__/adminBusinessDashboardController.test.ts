/**
 * Controller-level tests for the owner-only business dashboard.
 *
 * Mocks the knex `db` so handlers run in isolation. The dashboard fans
 * out into many small queries, so the mock is a flexible chainable
 * builder whose terminal calls (`.first`, `.count`, `.select` with
 * groupBy) can be programmed per-test via `dbMock.__queue`.
 *
 * The tests focus on the contract callers depend on:
 *   - launch readiness derived from billing config + email config
 *   - revenue zeros safely when no rows exist
 *   - real subscription counts when billing rows exist
 *   - funnel surfaces missingEvents when usage_events has no matches
 *   - publicTools list always renders the 8 routes regardless of usage data
 *   - ownerTasks reflect the computed state
 *
 * The owner-gate itself is exercised by the requireOwner middleware tests;
 * here we assume the handler is reached (i.e. the gate already passed).
 */

const dbMock: any = jest.fn();
dbMock.schema = { hasTable: jest.fn() };
dbMock.raw = jest.fn();

jest.mock('../../config/database', () => ({
  default: dbMock,
  __esModule: true,
}));

jest.mock('../../config/redis', () => ({
  redisClient: { ping: jest.fn(), info: jest.fn() },
  __esModule: true,
}));

jest.mock('../../config/logger', () => ({
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  __esModule: true,
}));

import type { Request, Response } from 'express';
import { getBusinessDashboard } from '../adminBusinessDashboardController';

function makeRes(): Response & { __json: any; __status: number } {
  const res: any = {};
  res.__status = 200;
  res.status = jest.fn((code: number) => {
    res.__status = code;
    return res;
  });
  res.json = jest.fn((body: any) => {
    res.__json = body;
    return res;
  });
  return res as Response & { __json: any; __status: number };
}

// `BuilderState` is referenced inline by `programDbMock`. The standalone
// `chainable()` helper that used it has been folded into `programDbMock`
// to keep the test file lean — every test programs queues directly.

const ENV_KEYS = [
  'NODE_ENV',
  'BILLING_PROVIDER',
  'BILLING_PRE_LAUNCH_OPEN',
  'APP_URL',
  'LEMONSQUEEZY_API_KEY',
  'LEMONSQUEEZY_WEBHOOK_SECRET',
  'LEMONSQUEEZY_STORE_ID',
  'LEMONSQUEEZY_PRODUCT_ID',
  'LEMONSQUEEZY_MONTHLY_VARIANT_ID',
  'LEMONSQUEEZY_ANNUAL_VARIANT_ID',
  'EMAIL_PROVIDER',
  'EMAIL_API_KEY',
  'ADSENSE_PUBLISHER_ID',
];

let originalEnv: Record<string, string | undefined>;

beforeEach(() => {
  originalEnv = {};
  ENV_KEYS.forEach((k) => {
    originalEnv[k] = process.env[k];
    delete process.env[k];
  });
  dbMock.mockReset();
  dbMock.schema.hasTable.mockReset();
});

afterEach(() => {
  ENV_KEYS.forEach((k) => {
    if (originalEnv[k] === undefined) delete process.env[k];
    else process.env[k] = originalEnv[k] as string;
  });
});

/**
 * Configure `dbMock` so terminal calls return values keyed by table name
 * and intent (count / groupBy / first). Every table reports as existing
 * unless `tablesExist[name] === false`.
 *
 * `perTable[tableName]` is consulted in priority order:
 *   1. If the chain saw a `whereIn` call, look for `[tableName + ':whereIn']`
 *      first — used to disambiguate failed_payment counts from generic
 *      counts on `billing_events`.
 *   2. If the chain saw a `groupBy` call, look for `[tableName + ':groupBy']`.
 *   3. If a `first` was called, look for `[tableName + ':first']`.
 *   4. Fallback: `[tableName]` for plain count, `[tableName + ':first']`
 *      for first calls.
 *
 * Each entry is a queue (array). The first call shifts off the front.
 * If the queue is empty the mock returns 0 (count) / null (first) / []
 * (groupBy) — the same shape the real DB returns when nothing matches.
 */
function programDbMock(opts: {
  tablesExist?: Record<string, boolean>;
  perTable?: Record<string, unknown[]>;
}) {
  const { tablesExist = {}, perTable = {} } = opts;

  dbMock.schema.hasTable.mockImplementation(async (name: string) => {
    return tablesExist[name] !== false; // default true
  });

  // Clone the queues so the test owns its own state.
  const queues: Record<string, unknown[]> = {};
  for (const [k, v] of Object.entries(perTable)) {
    queues[k] = [...(v as unknown[])];
  }

  function shift(key: string, fallback: unknown): unknown {
    const q = queues[key];
    if (q && q.length > 0) return q.shift();
    return fallback;
  }

  dbMock.mockImplementation((tableName: string) => {
    let isGroupBy = false;
    let sawWhereIn = false;

    const builder: any = {};
    const passthrough = (m: string) => {
      builder[m] = jest.fn((...args: unknown[]) => {
        if (m === 'groupBy') isGroupBy = true;
        if (m === 'whereIn') sawWhereIn = true;
        void args;
        return builder;
      });
    };
    [
      'where',
      'whereNull',
      'whereIn',
      'whereRaw',
      'select',
      'orderBy',
      'groupBy',
      'limit',
      'count',
      'countDistinct',
    ].forEach(passthrough);

    builder.first = jest.fn(async () => shift(`${tableName}:first`, null));

    builder.then = (onResolve: (v: unknown) => unknown) => {
      let value: unknown;
      if (isGroupBy) {
        value = shift(`${tableName}:groupBy`, []);
      } else if (sawWhereIn && queues[`${tableName}:whereIn`] && queues[`${tableName}:whereIn`].length > 0) {
        value = [{ count: String(shift(`${tableName}:whereIn`, 0)) }];
      } else {
        // Plain count call.
        value = [{ count: String(shift(tableName, 0)) }];
      }
      return Promise.resolve(value).then(onResolve);
    };

    return builder;
  });
}

describe('GET /api/admin/business-dashboard handler', () => {
  it('returns the full dashboard shape with launchReadiness blocked when billing+email are unwired', async () => {
    process.env.NODE_ENV = 'production';
    process.env.APP_URL = 'https://rowlyknit.com'; // production guard requires this
    process.env.EMAIL_PROVIDER = 'noop';
    // BILLING_PROVIDER unset → 'none'

    programDbMock({
      tablesExist: {
        billing_subscriptions: true,
        billing_events: true,
        usage_events: true,
        users: true,
        projects: true,
        patterns: true,
        pattern_models: true,
        source_files: true,
        yarn: true,
        charts: true,
        email_logs: true,
        blog_posts: false,
      },
      perTable: {},
    });

    const res = makeRes();
    await getBusinessDashboard({} as Request, res);
    expect(res.json).toHaveBeenCalledTimes(1);
    const body = res.__json;
    expect(body.success).toBe(true);
    expect(body.data.launchReadiness.publicLaunchBlocked).toBe(true);
    expect(body.data.launchReadiness.publicLaunchBlockers.length).toBeGreaterThan(0);
    expect(body.data.launchReadiness.billing.provider).toBe('none');
    expect(body.data.launchReadiness.transactionalEmail.provider).toBe('noop');
    expect(typeof body.data.launchReadiness.suggestedNextAction).toBe('string');

    // Section presence
    expect(body.data.revenue).toBeDefined();
    expect(body.data.users).toBeDefined();
    expect(body.data.funnel).toBeDefined();
    expect(body.data.publicTools).toBeDefined();
    expect(body.data.productUsage).toBeDefined();
    expect(body.data.contentAndSEO).toBeDefined();
    expect(body.data.ownerTasks).toBeDefined();
  });

  it('returns revenue zeros safely when no billing rows exist', async () => {
    process.env.NODE_ENV = 'development';
    process.env.BILLING_PROVIDER = 'lemonsqueezy';
    process.env.APP_URL = 'http://localhost:3000';
    process.env.LEMONSQUEEZY_API_KEY = 'k';
    process.env.LEMONSQUEEZY_WEBHOOK_SECRET = 's';
    process.env.LEMONSQUEEZY_STORE_ID = '1';
    process.env.LEMONSQUEEZY_PRODUCT_ID = '2';
    process.env.LEMONSQUEEZY_MONTHLY_VARIANT_ID = '3';
    process.env.LEMONSQUEEZY_ANNUAL_VARIANT_ID = '4';

    programDbMock({
      tablesExist: { billing_subscriptions: true, billing_events: true, blog_posts: false },
      perTable: { 'billing_subscriptions:groupBy': [[]] },
    });

    const res = makeRes();
    await getBusinessDashboard({} as Request, res);
    const r = res.__json.data.revenue;
    expect(r.wired).toBe(true);
    expect(r.mrrUsd).toBe(0);
    expect(r.arrUsd).toBe(0);
    expect(r.activeSubscriptions).toBe(0);
    expect(r.trialSubscriptions).toBe(0);
    expect(r.cancelledSubscriptions).toBe(0);
    expect(r.expiredSubscriptions).toBe(0);
    expect(r.failedPaymentCount).toBe(0);
    expect(r.latestBillingEventAt).toBeNull();
    expect(r.trialToPaidConversionRate).toBeNull();
    expect(r.churnRate).toBeNull();
  });

  it('flags revenue.wired=false when billing_subscriptions table is missing', async () => {
    process.env.NODE_ENV = 'development';
    programDbMock({
      tablesExist: {
        billing_subscriptions: false,
        billing_events: false,
        blog_posts: false,
      },
      perTable: {},
    });

    const res = makeRes();
    await getBusinessDashboard({} as Request, res);
    const r = res.__json.data.revenue;
    expect(r.wired).toBe(false);
    expect(r.note).toContain('billing_subscriptions');
  });

  it('returns real subscription counts when billing rows exist', async () => {
    process.env.NODE_ENV = 'development';
    process.env.BILLING_PROVIDER = 'lemonsqueezy';
    process.env.APP_URL = 'http://localhost:3000';
    process.env.LEMONSQUEEZY_API_KEY = 'k';
    process.env.LEMONSQUEEZY_WEBHOOK_SECRET = 's';
    process.env.LEMONSQUEEZY_STORE_ID = '1';
    process.env.LEMONSQUEEZY_PRODUCT_ID = '2';
    process.env.LEMONSQUEEZY_MONTHLY_VARIANT_ID = '3';
    process.env.LEMONSQUEEZY_ANNUAL_VARIANT_ID = '4';

    programDbMock({
      tablesExist: { billing_subscriptions: true, billing_events: true, blog_posts: false },
      perTable: {
        'billing_subscriptions:groupBy': [
          [
            { status: 'active', plan: 'monthly', count: '4' },
            { status: 'active', plan: 'annual', count: '2' },
            { status: 'on_trial', plan: 'monthly', count: '3' },
            { status: 'cancelled', plan: 'monthly', count: '1' },
            { status: 'expired', plan: 'annual', count: '1' },
            { status: 'past_due', plan: 'monthly', count: '1' },
          ],
        ],
        // failed-payment count uses whereIn → distinct queue.
        'billing_events:whereIn': [2],
        'billing_events:first': [{ created_at: new Date('2026-05-01T12:00:00Z') }],
      },
    });

    const res = makeRes();
    await getBusinessDashboard({} as Request, res);
    const r = res.__json.data.revenue;
    expect(r.wired).toBe(true);
    expect(r.activeSubscriptions).toBe(6);
    expect(r.trialSubscriptions).toBe(3);
    expect(r.cancelledSubscriptions).toBe(1);
    expect(r.expiredSubscriptions).toBe(1);
    expect(r.pastDueSubscriptions).toBe(1);
    expect(r.monthlySubscribers).toBe(5); // 4 active + 1 past_due
    expect(r.annualSubscribers).toBe(2);
    // MRR = 5 * 12 + 2 * (99/12) = 60 + 16.5 = 76.5
    expect(r.mrrUsd).toBeCloseTo(76.5, 2);
    expect(r.arrUsd).toBeCloseTo(76.5 * 12, 2);
    expect(r.failedPaymentCount).toBe(2);
    expect(r.latestBillingEventAt).toBe('2026-05-01T12:00:00.000Z');
    expect(r.trialToPaidConversionRate).not.toBeNull();
    expect(r.churnRate).not.toBeNull();
  });

  it('returns missingEvents for funnel metrics that have no usage_events rows', async () => {
    process.env.NODE_ENV = 'development';

    programDbMock({
      tablesExist: { billing_subscriptions: true, billing_events: true, usage_events: true, blog_posts: false },
      perTable: { 'billing_subscriptions:groupBy': [[]] },
    });

    const res = makeRes();
    await getBusinessDashboard({} as Request, res);
    const f = res.__json.data.funnel;
    expect(f.wired).toBe(true);
    expect(Array.isArray(f.missingEvents)).toBe(true);
    expect(f.missingEvents.length).toBeGreaterThan(0);
    // We should specifically flag known event names.
    expect(f.missingEvents).toEqual(
      expect.arrayContaining([
        'public_tool_viewed',
        'public_tool_used',
        'save_to_rowly_clicked',
        'upgrade_page_viewed',
        'checkout_started',
        'checkout_completed',
      ]),
    );
  });

  it('flags funnel.wired=false when usage_events table is missing', async () => {
    process.env.NODE_ENV = 'development';
    programDbMock({
      tablesExist: { usage_events: false, billing_subscriptions: true, blog_posts: false },
      perTable: { 'billing_subscriptions:groupBy': [[]] },
    });
    const res = makeRes();
    await getBusinessDashboard({} as Request, res);
    expect(res.__json.data.funnel.wired).toBe(false);
    expect(res.__json.data.funnel.note).toContain('usage_events');
  });

  it('always renders all 8 publicTools entries even when usage data is empty', async () => {
    process.env.NODE_ENV = 'development';
    programDbMock({
      tablesExist: { usage_events: true, billing_subscriptions: true, blog_posts: false },
      perTable: { 'billing_subscriptions:groupBy': [[]] },
    });
    const res = makeRes();
    await getBusinessDashboard({} as Request, res);
    const tools = res.__json.data.publicTools.tools;
    expect(tools.length).toBe(8);
    const routes = tools.map((t: any) => t.route);
    expect(routes).toEqual(
      expect.arrayContaining([
        '/calculators',
        '/calculators/gauge',
        '/calculators/size',
        '/calculators/yardage',
        '/calculators/row-repeat',
        '/calculators/shaping',
        '/help/glossary',
        '/help/knit911',
      ]),
    );
    // Every tool with no events flagged its missingTrackingEvents list.
    tools.forEach((t: any) => {
      expect(Array.isArray(t.missingTrackingEvents)).toBe(true);
    });
  });

  it('contentAndSEO.adsense reports the canonical publisher id and policy flags', async () => {
    process.env.NODE_ENV = 'development';
    programDbMock({
      tablesExist: { billing_subscriptions: true, billing_events: true, usage_events: true, blog_posts: false },
      perTable: { 'billing_subscriptions:groupBy': [[]] },
    });
    const res = makeRes();
    await getBusinessDashboard({} as Request, res);
    const a = res.__json.data.contentAndSEO.adsense;
    expect(a.publisherId).toBe('ca-pub-9472587145183950');
    expect(a.landingPageAdsEnabled).toBe(false);
    expect(a.appAdsEnabled).toBe(false);
    expect(a.approvedAdRoutes).toEqual(
      expect.arrayContaining([
        '/calculators',
        '/calculators/gauge',
        '/calculators/size',
        '/calculators/yardage',
        '/calculators/row-repeat',
        '/calculators/shaping',
        '/help/glossary',
        '/help/knit911',
      ]),
    );
    expect(a.approvedAdRoutes.length).toBe(8);
    expect(a.expectedAdsTxtLine).toBe('google.com, pub-9472587145183950, DIRECT, f08c47fec0942fa0');
    // The script-present + ads.txt-valid signals are computed live by
    // probing the filesystem; in jest we may or may not see the right
    // files (depends on the working dir + the dist build state). Just
    // assert the keys exist and are booleans.
    expect(typeof a.scriptPresent).toBe('boolean');
    expect(typeof a.adsTxtPresent).toBe('boolean');
    expect(typeof a.adsTxtValid).toBe('boolean');
    expect(typeof a.publicAdsEnabled).toBe('boolean');
  });

  it('owner tasks include all 11 expected steps (LS + AdSense + Search Console + legal + support email + beta promo + SEO post)', async () => {
    process.env.NODE_ENV = 'development';
    programDbMock({
      tablesExist: { billing_subscriptions: true, billing_events: true, usage_events: true, email_logs: true, blog_posts: false },
      perTable: { 'billing_subscriptions:groupBy': [[]] },
    });
    const res = makeRes();
    await getBusinessDashboard({} as Request, res);
    const ids = res.__json.data.ownerTasks.map((t: any) => t.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        'ls_account',
        'ls_env',
        'ls_webhook',
        'checkout_smoke',
        'tools_linked',
        'adsense',
        'beta_promo',
        'search_console',
        'legal_cookie',
        'support_email',
        'first_seo_post',
      ]),
    );
    expect(ids.length).toBe(11);
    // Each task has the four required keys.
    res.__json.data.ownerTasks.forEach((t: any) => {
      expect(t).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          label: expect.any(String),
          status: expect.any(String),
          reason: expect.any(String),
          suggestedAction: expect.any(String),
        }),
      );
      expect(['done', 'blocked', 'not_started', 'needs_owner']).toContain(t.status);
    });
  });

  it('beta_promo does NOT mark DONE just because welcome emails fired (welcome auto-fires on signup)', async () => {
    process.env.NODE_ENV = 'development';
    programDbMock({
      tablesExist: { billing_subscriptions: true, billing_events: true, usage_events: true, email_logs: true, blog_posts: false },
      perTable: {
        'billing_subscriptions:groupBy': [[]],
        // first() on email_logs returns null because the controller
        // queries `whereIn('template', ['beta_promo', 'beta_announcement'])`
        // — welcome rows do not match.
        'email_logs:first': [null],
      },
    });
    const res = makeRes();
    await getBusinessDashboard({} as Request, res);
    const beta = res.__json.data.ownerTasks.find((t: any) => t.id === 'beta_promo');
    expect(beta).toBeDefined();
    expect(beta.status).not.toBe('done');
    expect(beta.reason).toMatch(/beta_promo|beta_announcement/);
  });

  it('support_email DONE when SUPPORT_EMAIL env var is set', async () => {
    process.env.NODE_ENV = 'development';
    process.env.SUPPORT_EMAIL = 'help@rowlyknit.com';
    programDbMock({
      tablesExist: { billing_subscriptions: true, blog_posts: false },
      perTable: { 'billing_subscriptions:groupBy': [[]] },
    });
    const res = makeRes();
    await getBusinessDashboard({} as Request, res);
    const support = res.__json.data.ownerTasks.find((t: any) => t.id === 'support_email');
    expect(support.status).toBe('done');
    expect(support.reason).toContain('help@rowlyknit.com');
    delete process.env.SUPPORT_EMAIL;
  });
});
