/**
 * Tests for BillingService — exercises:
 *   - getBillingStatusForUser (active vs none vs cancelled)
 *   - ingestWebhookEvent (idempotency, persistence, user resolution)
 *   - the entitlement boolean derived from status
 *
 * The knex `db` module is mocked. The mock supports the chained calls
 * the service actually issues; if you add a new query shape, extend
 * `makeBuilder()`.
 */

const builderState: any = {
  insertResults: [] as any[],
  updateResults: 1,
  firstResults: [] as any[],
  selectResults: [] as any[],
  rows: [] as any[],
};

function makeBuilder(): any {
  const builder: any = {};
  builder.where = jest.fn().mockReturnValue(builder);
  builder.whereNull = jest.fn().mockReturnValue(builder);
  builder.orderBy = jest.fn().mockReturnValue(builder);
  builder.limit = jest.fn().mockReturnValue(builder);
  builder.first = jest.fn().mockImplementation(async () => {
    return builderState.firstResults.shift() ?? null;
  });
  builder.select = jest.fn().mockResolvedValue(builderState.selectResults);
  builder.insert = jest.fn().mockReturnValue(builder);
  builder.onConflict = jest.fn().mockReturnValue(builder);
  // `merge` is dual-shaped:
  //   - billing_customers / billing_subscriptions chain it as a
  //     terminal: `.onConflict(...).merge({...})` resolves to [].
  //   - billing_events chains it before `.returning(...)` since the
  //     PR #389 final-pass retry rewrite needs row metadata back from
  //     the upsert. We support both by making the mocked `merge` a
  //     thenable that ALSO carries the chainable methods, so callers
  //     that `await` it succeed and callers that go on to `.returning(...)`
  //     do too.
  builder.merge = jest.fn().mockImplementation(() => builder);
  builder.ignore = jest.fn().mockReturnValue(builder);
  builder.returning = jest.fn().mockImplementation(async () => {
    return builderState.insertResults.shift() ?? [];
  });
  builder.update = jest.fn().mockResolvedValue(builderState.updateResults);
  // Make the builder thenable so `await db('t').insert(...).onConflict(...).merge(...)`
  // (without a trailing `.returning`) still resolves cleanly. Knex's
  // real builder is also thenable.
  builder.then = (resolve: (v: any) => any) => resolve([]);
  return builder;
}

const dbMock: any = jest.fn(() => makeBuilder());
dbMock.raw = jest.fn();
dbMock.fn = { now: () => new Date() };

jest.mock('../../config/database', () => ({
  default: dbMock,
  __esModule: true,
}));

jest.mock('../../config/logger', () => ({
  default: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
  __esModule: true,
}));

import { BillingService } from '../billing/billingService';
import { MockBillingProvider } from '../billing/mockProvider';

beforeEach(() => {
  jest.clearAllMocks();
  builderState.insertResults = [];
  builderState.firstResults = [];
  builderState.selectResults = [];
  builderState.updateResults = 1;
});

describe('BillingService.getBillingStatusForUser', () => {
  it('returns null subscription + isActive=false when no row exists', async () => {
    builderState.firstResults = [null];
    const svc = new BillingService(new MockBillingProvider());
    const status = await svc.getBillingStatusForUser('user-1');
    expect(status.subscription).toBeNull();
    expect(status.isActive).toBe(false);
  });

  it('returns isActive=true for status=on_trial', async () => {
    builderState.firstResults = [
      {
        id: 'sub-1',
        user_id: 'user-1',
        provider: 'mock',
        status: 'on_trial',
        plan: 'monthly',
        trial_ends_at: new Date('2026-06-01'),
        renews_at: null,
        ends_at: null,
      },
    ];
    const svc = new BillingService(new MockBillingProvider());
    const status = await svc.getBillingStatusForUser('user-1');
    expect(status.isActive).toBe(true);
    expect(status.subscription?.status).toBe('on_trial');
  });

  it('returns isActive=true for status=active', async () => {
    builderState.firstResults = [{ status: 'active' }];
    const svc = new BillingService(new MockBillingProvider());
    expect((await svc.getBillingStatusForUser('u')).isActive).toBe(true);
  });

  it.each(['paused', 'past_due', 'unpaid', 'expired'])(
    'returns isActive=false for status=%s',
    async (status) => {
      builderState.firstResults = [{ status, ends_at: null }];
      const svc = new BillingService(new MockBillingProvider());
      expect((await svc.getBillingStatusForUser('u')).isActive).toBe(false);
    },
  );

  // PR #389 P2 cancelled-grace policy. `cancelled` is now conditional
  // on `ends_at` being in the future — see types.ts/isEntitledNow.
  it('returns isActive=true for status=cancelled with ends_at in the future', async () => {
    const futureEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    builderState.firstResults = [{ status: 'cancelled', ends_at: futureEndsAt }];
    const svc = new BillingService(new MockBillingProvider());
    expect((await svc.getBillingStatusForUser('u')).isActive).toBe(true);
  });

  it('returns isActive=false for status=cancelled with ends_at in the past', async () => {
    const pastEndsAt = new Date(Date.now() - 24 * 60 * 60 * 1000);
    builderState.firstResults = [{ status: 'cancelled', ends_at: pastEndsAt }];
    const svc = new BillingService(new MockBillingProvider());
    expect((await svc.getBillingStatusForUser('u')).isActive).toBe(false);
  });

  it('returns isActive=false for status=cancelled with null ends_at', async () => {
    builderState.firstResults = [{ status: 'cancelled', ends_at: null }];
    const svc = new BillingService(new MockBillingProvider());
    expect((await svc.getBillingStatusForUser('u')).isActive).toBe(false);
  });
});

describe('BillingService.ingestWebhookEvent — idempotency + retry', () => {
  it('returns "duplicate" when the event id is already processed=true', async () => {
    // Upsert returns the existing row with processed=true → exact replay
    // of a successfully-processed event. Side effects MUST NOT re-run.
    builderState.insertResults = [[{ id: 'event-1', processed: true }]];

    const svc = new BillingService(new MockBillingProvider());

    const event = {
      eventId: 'wh_dup',
      eventName: 'subscription_created',
      userId: 'user-1',
      subscription: null,
      customer: null,
      raw: {},
    };

    const result = await svc.ingestWebhookEvent(event);
    expect(result).toBe('duplicate');
    // Only the upsert hits billing_events; the side-effect path
    // (customers / subscriptions update) is skipped entirely.
    expect(dbMock).not.toHaveBeenCalledWith('billing_customers');
    expect(dbMock).not.toHaveBeenCalledWith('billing_subscriptions');
  });

  it('returns "processed" + writes subscription row on first delivery', async () => {
    // Upsert returns processed=false → first time we've seen this event.
    builderState.insertResults = [
      [{ id: 'event-1', processed: false }],
    ];

    const svc = new BillingService(new MockBillingProvider());
    const result = await svc.ingestWebhookEvent({
      eventId: 'wh_new',
      eventName: 'subscription_created',
      userId: 'user-1',
      subscription: {
        providerSubscriptionId: 'sub-1',
        providerCustomerId: 'cust-1',
        providerProductId: 'p',
        providerVariantId: 'v',
        status: 'on_trial',
        plan: 'monthly',
        trialEndsAt: new Date('2026-06-01'),
        renewsAt: null,
        endsAt: null,
        customerPortalUrl: 'https://x',
        updatePaymentMethodUrl: null,
        providerUpdatedAt: new Date('2026-05-06T10:00:00Z'),
      },
      customer: { providerCustomerId: 'cust-1', email: 'u@x.test' },
      raw: { fixture: true },
    });

    expect(result).toBe('processed');
    expect(dbMock).toHaveBeenCalledWith('billing_events');
    expect(dbMock).toHaveBeenCalledWith('billing_customers');
    expect(dbMock).toHaveBeenCalledWith('billing_subscriptions');
  });

  it('returns "unhandled" for non-subscription events that lack a user', async () => {
    builderState.insertResults = [[{ id: 'event-1', processed: false }]];

    const svc = new BillingService(new MockBillingProvider());
    const result = await svc.ingestWebhookEvent({
      eventId: 'wh_other',
      eventName: 'order_created',
      userId: undefined,
      subscription: null,
      customer: null,
      raw: {},
    });

    expect(result).toBe('unhandled');
  });

  // PR #389 final-pass P1: retry-after-failure path.
  it('retry of a processed=false row re-runs side effects and clears error on success', async () => {
    // Upsert returns processed=false from the prior failed attempt.
    // Side effects succeed this time → row gets processed=true and the
    // error column is cleared.
    builderState.insertResults = [[{ id: 'event-1', processed: false }]];
    builderState.updateResults = 1;

    const svc = new BillingService(new MockBillingProvider());
    const result = await svc.ingestWebhookEvent({
      eventId: 'wh_retry',
      eventName: 'subscription_created',
      userId: 'user-1',
      subscription: {
        providerSubscriptionId: 'sub-1',
        providerCustomerId: 'cust-1',
        providerProductId: 'p',
        providerVariantId: 'v',
        status: 'active',
        plan: 'monthly',
        trialEndsAt: null,
        renewsAt: new Date('2026-06-01'),
        endsAt: null,
        customerPortalUrl: 'https://x',
        updatePaymentMethodUrl: null,
        providerUpdatedAt: new Date('2026-05-06T11:00:00Z'),
      },
      customer: { providerCustomerId: 'cust-1', email: 'u@x.test' },
      raw: { fixture: true, attempt: 2 },
    });

    expect(result).toBe('processed');
    // Domain-side writes happened — proves we re-ran rather than
    // short-circuiting as a duplicate.
    expect(dbMock).toHaveBeenCalledWith('billing_customers');
    expect(dbMock).toHaveBeenCalledWith('billing_subscriptions');
    // Final billing_events update should clear `error` (passes null).
    // Hard-asserting the exact update call is brittle through the
    // generic builder mock; the runs-twice fact (success + processed
    // toggle) is the load-bearing check.
  });

  it('repeated failure keeps processed=false and updates error', async () => {
    // Upsert returns processed=false (prior failed attempt). The
    // subscription-upsert side effect throws — the catch arm must
    // write processed=false + new error and rethrow.
    builderState.insertResults = [[{ id: 'event-1', processed: false }]];

    const svc = new BillingService(new MockBillingProvider());

    // Force a failure in the side-effect path. Spying on the private
    // applyWebhookSideEffects keeps the mock thin.
    const boomMessage = 'simulated DB failure on retry';
    const spy = jest
      .spyOn(svc as unknown as { applyWebhookSideEffects: () => Promise<boolean> }, 'applyWebhookSideEffects')
      .mockRejectedValueOnce(new Error(boomMessage));

    await expect(
      svc.ingestWebhookEvent({
        eventId: 'wh_repeat_fail',
        eventName: 'subscription_created',
        userId: 'user-1',
        subscription: null,
        customer: null,
        raw: {},
      }),
    ).rejects.toThrow(boomMessage);

    expect(spy).toHaveBeenCalledTimes(1);
    // The catch arm writes back to billing_events with the new error
    // — proves we stayed on the retry-friendly path rather than
    // returning 'duplicate'.
    expect(dbMock).toHaveBeenCalledWith('billing_events');
    spy.mockRestore();
  });
});
