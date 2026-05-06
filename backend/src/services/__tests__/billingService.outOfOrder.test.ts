/**
 * PR #389 review fix — webhook out-of-order protection.
 *
 * Lemon Squeezy delivers webhooks at-least-once and does not
 * guarantee order across retries. A retry of an earlier `active`
 * event can land AFTER a `cancelled` event and resurrect a cancelled
 * user. The `BillingService.upsertSubscription` path now compares the
 * incoming `providerUpdatedAt` against the row's last-stored
 * `updated_at_provider` and refuses the merge when the incoming one
 * is strictly older.
 *
 * Cases:
 *   - active event then cancelled (newer) event → cancelled wins.
 *   - cancelled event then a stale active retry (older) → cancelled
 *     remains; the late retry is a no-op.
 *   - exact replay (same event_id) is still idempotent (the
 *     billing_events dedupe runs ahead of upsert; we cover that here
 *     end-to-end so the two layers don't drift).
 *   - missing providerUpdatedAt on the incoming event → falls
 *     through to merge (preserves pre-#081 behaviour for legacy /
 *     incomplete payloads).
 *
 * The DB layer is mocked in-process. The mock supports a single
 * subscription row keyed by (provider, provider_subscription_id) and
 * dedupes events by (provider, provider_event_id).
 */

// Jest hoists `jest.mock` calls to the top of the file. The mock
// factory is the only thing that's allowed to "see" the dbMock once
// hoisted; we use a level of indirection via a module-scoped variable
// that's populated before the mock factory is invoked at require time.
const eventStore = new Map<string, any>();
const subStore = new Map<string, any>();
const customerStore = new Map<string, any>();

function tableHandler(table: string): any {
  if (table === 'billing_events') {
    return {
      insert: (row: any) => ({
        onConflict: () => ({
          ignore: () => ({
            returning: async () => {
              const key = `${row.provider}:${row.provider_event_id}`;
              if (eventStore.has(key)) return [];
              eventStore.set(key, { id: `e-${eventStore.size + 1}`, ...row });
              return [{ id: eventStore.get(key).id }];
            },
          }),
        }),
      }),
      where: () => ({ update: async () => 1 }),
    };
  }

  if (table === 'billing_customers') {
    return {
      insert: () => ({
        onConflict: () => ({
          merge: async () => {
            customerStore.set('one', true);
            return [];
          },
        }),
      }),
      where: () => ({ first: async () => null }),
    };
  }

  if (table === 'billing_subscriptions') {
    return {
      insert: (row: any) => ({
        onConflict: () => ({
          merge: async () => {
            const key = `${row.provider}:${row.provider_subscription_id}`;
            const prior = subStore.get(key) ?? {};
            subStore.set(key, { ...prior, ...row });
            return [];
          },
        }),
      }),
      where: (filter: any) => ({
        first: async (..._cols: string[]) => {
          // The pre-merge "do we already have a newer row?" lookup.
          const key = `${filter.provider}:${filter.provider_subscription_id}`;
          return subStore.get(key) ?? null;
        },
        orderBy: () => ({
          first: async () => {
            const found = Array.from(subStore.values()).find(
              (r) => r.user_id === filter.user_id && r.provider === filter.provider,
            );
            return found ?? null;
          },
        }),
      }),
    };
  }

  return { where: () => ({ first: async () => null }) };
}

jest.mock('../../config/database', () => {
  const fn: any = jest.fn(tableHandler);
  fn.raw = jest.fn();
  fn.fn = { now: () => new Date() };
  return { default: fn, __esModule: true };
});
jest.mock('../../config/logger', () => ({
  default: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
  __esModule: true,
}));

import { BillingService } from '../billing/billingService';
import { MockBillingProvider } from '../billing/mockProvider';
import {
  NormalizedSubscription,
  NormalizedWebhookEvent,
} from '../billing/types';

function buildSub(
  overrides: Partial<NormalizedSubscription> & { providerUpdatedAt: Date | null },
): NormalizedSubscription {
  return {
    providerSubscriptionId: 'sub_ooo',
    providerCustomerId: 'cust_1',
    providerProductId: 'p',
    providerVariantId: 'v',
    status: 'active',
    plan: 'monthly',
    trialEndsAt: null,
    renewsAt: new Date('2026-07-01'),
    endsAt: null,
    customerPortalUrl: null,
    updatePaymentMethodUrl: null,
    ...overrides,
  };
}

function buildEvent(
  eventId: string,
  status: NormalizedSubscription['status'],
  providerUpdatedAt: Date | null,
): NormalizedWebhookEvent {
  return {
    eventId,
    eventName:
      status === 'cancelled' ? 'subscription_cancelled' : 'subscription_updated',
    userId: 'user-ooo-1',
    subscription: buildSub({ status, providerUpdatedAt }),
    customer: { providerCustomerId: 'cust_1', email: 'ooo@example.test' },
    raw: { fixture: true, eventId, status },
  };
}

beforeEach(() => {
  eventStore.clear();
  subStore.clear();
  customerStore.clear();
});

describe('BillingService — webhook out-of-order protection', () => {
  it('older active retry does NOT overwrite a newer cancelled state', async () => {
    const svc = new BillingService(new MockBillingProvider());

    const cancelledAt = new Date('2026-05-06T12:00:00Z');
    const earlierActiveAt = new Date('2026-05-06T10:00:00Z');

    // 1. cancelled (newer) lands first.
    const o1 = await svc.ingestWebhookEvent(
      buildEvent('wh_cancelled', 'cancelled', cancelledAt),
    );
    expect(o1).toBe('processed');

    // 2. a delayed retry of an earlier active event arrives.
    const o2 = await svc.ingestWebhookEvent(
      buildEvent('wh_active_retry', 'active', earlierActiveAt),
    );
    expect(o2).toBe('processed'); // event row was written…

    // …but the subscription row stays cancelled.
    const status = await svc.getBillingStatusForUser('user-ooo-1');
    expect(status.subscription?.status).toBe('cancelled');
    expect(status.isActive).toBe(false);
  });

  it('newer cancelled overwrites an older active', async () => {
    const svc = new BillingService(new MockBillingProvider());

    const activeAt = new Date('2026-05-06T10:00:00Z');
    const cancelledAt = new Date('2026-05-06T12:00:00Z');

    await svc.ingestWebhookEvent(buildEvent('wh_active_1', 'active', activeAt));
    await svc.ingestWebhookEvent(
      buildEvent('wh_cancelled_1', 'cancelled', cancelledAt),
    );

    const status = await svc.getBillingStatusForUser('user-ooo-1');
    expect(status.subscription?.status).toBe('cancelled');
    expect(status.isActive).toBe(false);
  });

  it('exact replay of the same event id is still idempotent', async () => {
    const svc = new BillingService(new MockBillingProvider());

    const updatedAt = new Date('2026-05-06T11:00:00Z');
    const first = await svc.ingestWebhookEvent(
      buildEvent('wh_replay', 'active', updatedAt),
    );
    const second = await svc.ingestWebhookEvent(
      buildEvent('wh_replay', 'active', updatedAt),
    );

    expect(first).toBe('processed');
    expect(second).toBe('duplicate');
  });

  it('falls through to merge when providerUpdatedAt is missing on incoming event', async () => {
    // Some legacy webhook envelopes omit `attributes.updated_at`.
    // Refusing those would silently drop legitimate state changes.
    // Policy: if the incoming event has no provider timestamp, we
    // cannot apply the out-of-order guard so we merge.
    const svc = new BillingService(new MockBillingProvider());

    const seedAt = new Date('2026-05-06T10:00:00Z');
    await svc.ingestWebhookEvent(buildEvent('wh_seed', 'active', seedAt));

    const o2 = await svc.ingestWebhookEvent(
      buildEvent('wh_no_ts', 'past_due', null),
    );
    expect(o2).toBe('processed');

    const status = await svc.getBillingStatusForUser('user-ooo-1');
    expect(status.subscription?.status).toBe('past_due');
  });
});
