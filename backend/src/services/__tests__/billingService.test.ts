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
  builder.merge = jest.fn().mockResolvedValue([]);
  builder.ignore = jest.fn().mockReturnValue(builder);
  builder.returning = jest.fn().mockImplementation(async () => {
    return builderState.insertResults.shift() ?? [];
  });
  builder.update = jest.fn().mockResolvedValue(builderState.updateResults);
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

  it.each(['paused', 'past_due', 'unpaid', 'cancelled', 'expired'])(
    'returns isActive=false for status=%s',
    async (status) => {
      builderState.firstResults = [{ status }];
      const svc = new BillingService(new MockBillingProvider());
      expect((await svc.getBillingStatusForUser('u')).isActive).toBe(false);
    },
  );
});

describe('BillingService.ingestWebhookEvent — idempotency', () => {
  it('returns "duplicate" when the event id is already stored', async () => {
    builderState.insertResults = [[]]; // no row inserted (onConflict ignore)
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
  });

  it('returns "processed" + writes subscription row on first delivery', async () => {
    // Insert returns one row → not a duplicate. resolveUserId picks
    // up event.userId. Customer upsert + subscription upsert + final
    // event-row update succeed.
    builderState.insertResults = [
      [{ id: 'event-1' }], // billing_events insert
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
    builderState.insertResults = [[{ id: 'event-1' }]];

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
});
