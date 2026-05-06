import db from '../../config/database';
import logger from '../../config/logger';
import {
  BillingProviderAdapter,
  CheckoutInput,
  CheckoutResult,
  isEntitledNow,
  NormalizedStatus,
  NormalizedSubscription,
  NormalizedWebhookEvent,
} from './types';

/**
 * Service layer for the billing flow.
 *
 * Responsibilities:
 *   - Talk to the configured provider adapter for outbound work.
 *   - Persist customer / subscription / event rows.
 *   - Compute the "is this user entitled?" answer from the latest
 *     subscription row.
 *
 * Idempotency: `recordEvent` is the only entry point that writes
 * `billing_events`. It uses `(provider, provider_event_id)` as the
 * dedupe key — repeat deliveries of the same webhook resolve to the
 * same row and skip the side-effects.
 */
export interface PersistedSubscription {
  id: string;
  user_id: string;
  provider: string;
  provider_subscription_id: string;
  provider_customer_id: string | null;
  provider_product_id: string | null;
  provider_variant_id: string | null;
  status: NormalizedStatus;
  plan: 'monthly' | 'annual' | null;
  trial_ends_at: Date | null;
  renews_at: Date | null;
  ends_at: Date | null;
  customer_portal_url: string | null;
  update_payment_method_url: string | null;
  created_at: Date;
  updated_at: Date;
  /**
   * Provider-side `updated_at` snapshot for the most recent merge.
   * Used as the out-of-order guard on subsequent webhooks. Nullable
   * because legacy rows predate migration #081 and some webhook
   * envelopes omit the timestamp entirely.
   */
  updated_at_provider: Date | null;
}

export interface BillingStatusForUser {
  /**
   * The latest subscription row for the user, in any state. `null` if
   * the user has never transacted.
   */
  subscription: PersistedSubscription | null;
  /**
   * "Is this user currently entitled to paid-workspace access?"
   *
   * Driven by `isEntitledNow(status, ends_at)` — `active` and
   * `on_trial` are unconditional, `cancelled` is true iff `ends_at` is
   * still in the future (LS-style grace through the paid period),
   * everything else is false. Renamed-in-spirit from "isActive" to
   * make it clear the boolean is the entitlement decision, not just
   * a status-set membership check.
   */
  isActive: boolean;
}

export class BillingService {
  constructor(private readonly provider: BillingProviderAdapter) {}

  get providerName(): string {
    return this.provider.name;
  }

  /** Pass-through to the provider. */
  async createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
    return this.provider.createCheckout(input);
  }

  /** Pass-through. Used by webhook route before reading the body. */
  verifyWebhook(rawBody: Buffer, signatureHeader: string | undefined): boolean {
    return this.provider.verifyWebhook(rawBody, signatureHeader);
  }

  /** Pass-through. */
  parseWebhook(rawBody: Buffer): NormalizedWebhookEvent {
    return this.provider.parseWebhook(rawBody);
  }

  /**
   * Get the latest subscription row for a user. "Latest" = most
   * recently updated. Used by `/api/billing/status` and the
   * entitlement helper.
   */
  async getBillingStatusForUser(userId: string): Promise<BillingStatusForUser> {
    const row: PersistedSubscription | undefined = await db('billing_subscriptions')
      .where({ user_id: userId, provider: this.provider.name })
      .orderBy('updated_at', 'desc')
      .first();

    const subscription = row ?? null;
    const isActive = subscription
      ? isEntitledNow(subscription.status, subscription.ends_at)
      : false;

    return { subscription, isActive };
  }

  /**
   * Idempotent webhook ingest with retry-on-failure. Walks the parsed
   * event, writes the customer + subscription rows, and records the
   * event. Returns:
   *   - `'duplicate'`  — exact replay of an already-processed event;
   *                      side effects are NOT re-run.
   *   - `'processed'`  — side effects ran (first delivery OR successful
   *                      retry of a previously-failed delivery).
   *   - `'unhandled'`  — event recorded but no domain change made
   *                       (unknown event name / missing user link).
   *
   * Provider retry semantics:
   *   - LS retries failed webhook deliveries; the same `eventId` is
   *     re-presented. The previous design called `onConflict.ignore()`
   *     and returned `'duplicate'` on every retry — even when the
   *     original attempt landed in `processed=false` because the
   *     side-effect handler threw — so a once-failed event NEVER
   *     re-ran. That's the P1 we're closing here.
   *   - The fix: use `onConflict.merge()` to atomically claim the row
   *     (insert OR re-read), then check `processed`. If it's already
   *     true, it's a true duplicate. If false, we've inherited the
   *     row from a prior failure and should re-run side effects.
   *   - Successful retry sets `processed=true`, `processed_at=now`,
   *     and clears `error`. A repeated failure leaves `processed=false`
   *     and updates `error` with the latest message.
   *
   * The merge writes only the timestamp-style "we touched this row"
   * fields and explicitly leaves `processed`/`error` alone on conflict
   * — those reflect the LATEST attempt, which the try/catch below
   * decides. Race-safe because two concurrent retries would each
   * reach the same `processed=true` post-condition; the second one
   * would re-run idempotently or short-circuit on the now-true flag.
   */
  async ingestWebhookEvent(
    event: NormalizedWebhookEvent,
  ): Promise<'duplicate' | 'processed' | 'unhandled'> {
    const now = new Date();

    // Atomic upsert: insert OR (on conflict) leave the row alone but
    // still get the id back via returning. We update payload/event_name
    // on conflict so a retry that carries an updated envelope is
    // captured, but we DO NOT touch `processed`, `processed_at`, or
    // `error` — those describe the latest *attempt* and are written
    // below by the try/catch.
    const upserted = await db('billing_events')
      .insert({
        provider: this.provider.name,
        provider_event_id: event.eventId,
        event_name: event.eventName,
        payload: JSON.stringify(event.raw),
        processed: false,
        created_at: now,
      })
      .onConflict(['provider', 'provider_event_id'])
      .merge({
        // Refresh envelope-level fields in case the provider replayed a
        // newer copy. `processed` / `error` / `processed_at` are
        // intentionally NOT in this merge list.
        event_name: event.eventName,
        payload: JSON.stringify(event.raw),
      })
      .returning(['id', 'processed']);

    if (!upserted || upserted.length === 0) {
      // Defensive: the merge form should always return a row. If the
      // driver returns nothing (some adapters do for pure-no-op
      // conflicts), look the row up explicitly.
      const existing = await db('billing_events')
        .where({
          provider: this.provider.name,
          provider_event_id: event.eventId,
        })
        .first<{ id: string; processed: boolean } | undefined>('id', 'processed');
      if (!existing) {
        // Truly impossible — we just inserted-or-merged this row. Fail
        // loud so the bug is visible.
        throw new Error('Billing webhook upsert returned no row');
      }
      return this.runSideEffectsAndMarkProcessed(existing.id, existing.processed, event);
    }

    const row = upserted[0] as { id: string; processed: boolean };
    return this.runSideEffectsAndMarkProcessed(row.id, row.processed, event);
  }

  /**
   * Apply side effects iff the row hasn't already been marked
   * `processed=true`. Encapsulates the "first delivery vs retry vs
   * true duplicate" decision so `ingestWebhookEvent` only has to
   * resolve the row identity.
   */
  private async runSideEffectsAndMarkProcessed(
    eventRowId: string,
    alreadyProcessed: boolean,
    event: NormalizedWebhookEvent,
  ): Promise<'duplicate' | 'processed' | 'unhandled'> {
    if (alreadyProcessed) {
      logger.info('Billing webhook duplicate ignored (already processed)', {
        provider: this.provider.name,
        eventId: event.eventId,
        eventName: event.eventName,
      });
      return 'duplicate';
    }

    try {
      const handled = await this.applyWebhookSideEffects(event);
      // Mark success: clear any prior error message so a once-failed
      // event that now succeeds has a clean audit row.
      await db('billing_events')
        .where({ id: eventRowId })
        .update({
          processed: true,
          processed_at: new Date(),
          error: null,
        });
      return handled ? 'processed' : 'unhandled';
    } catch (err: any) {
      logger.error('Billing webhook handler failed', {
        provider: this.provider.name,
        eventId: event.eventId,
        eventName: event.eventName,
        error: err?.message,
      });
      // Keep `processed=false` so the next retry re-runs side effects.
      // `processed_at` records the attempt time (useful for "stuck
      // event" alerts); `error` captures the latest message so an
      // operator sees the most recent failure cause.
      await db('billing_events')
        .where({ id: eventRowId })
        .update({
          processed: false,
          processed_at: new Date(),
          error: String(err?.message ?? err).slice(0, 1000),
        });
      throw err;
    }
  }

  /**
   * Apply the domain-side effects of a normalised event. Returns
   * `true` when at least one row was written/updated. Pure helper:
   * does not interact with `billing_events`.
   */
  private async applyWebhookSideEffects(event: NormalizedWebhookEvent): Promise<boolean> {
    if (!event.subscription) {
      // Non-subscription event (e.g. `order_created`). We still
      // recorded the row above; nothing else to do.
      return false;
    }

    const userId = await this.resolveUserId(event);
    if (!userId) {
      logger.warn('Billing webhook has no resolvable user', {
        eventId: event.eventId,
        eventName: event.eventName,
        providerSubscriptionId: event.subscription.providerSubscriptionId,
      });
      return false;
    }

    if (event.customer) {
      await this.upsertCustomer(userId, event.customer);
    }
    await this.upsertSubscription(userId, event.subscription);
    return true;
  }

  /**
   * Find the Rowly user id this event maps to.
   *   1. The event itself carries `userId` from `custom_data` we set
   *      at checkout — the happy path.
   *   2. Fall back to an existing customer row by provider_customer_id
   *      (covers the case where custom_data was missing).
   *   3. Fall back to the subscription's previously-stored user_id.
   */
  private async resolveUserId(event: NormalizedWebhookEvent): Promise<string | null> {
    if (event.userId) return event.userId;

    if (event.customer?.providerCustomerId) {
      const existing = await db('billing_customers')
        .where({
          provider: this.provider.name,
          provider_customer_id: event.customer.providerCustomerId,
        })
        .first('user_id');
      if (existing) return existing.user_id;
    }

    if (event.subscription) {
      const existing = await db('billing_subscriptions')
        .where({
          provider: this.provider.name,
          provider_subscription_id: event.subscription.providerSubscriptionId,
        })
        .first('user_id');
      if (existing) return existing.user_id;
    }

    return null;
  }

  private async upsertCustomer(
    userId: string,
    customer: NonNullable<NormalizedWebhookEvent['customer']>,
  ): Promise<void> {
    const now = new Date();
    await db('billing_customers')
      .insert({
        user_id: userId,
        provider: this.provider.name,
        provider_customer_id: customer.providerCustomerId,
        email: customer.email ?? '',
        created_at: now,
        updated_at: now,
      })
      .onConflict(['provider', 'provider_customer_id'])
      .merge({
        user_id: userId,
        email: customer.email ?? db.raw('billing_customers.email'),
        updated_at: now,
      });
  }

  /**
   * Upsert a subscription row with out-of-order webhook protection.
   *
   * Lemon Squeezy delivers webhooks at-least-once and does not
   * guarantee order across retries — a delayed retry of an earlier
   * `subscription_active` could land AFTER `subscription_cancelled`,
   * which would resurrect a cancelled user. Guard:
   *
   *   1. Fetch the existing row's `updated_at_provider`.
   *   2. If both timestamps are present and the incoming one is
   *      strictly older, no-op (log so an operator sees it).
   *   3. Otherwise, merge as before and write the new
   *      `updated_at_provider`.
   *
   * Missing-timestamp policy: if either side lacks a provider
   * timestamp we fall through to the merge. That preserves the
   * pre-#081 behaviour for legacy rows and avoids dropping a
   * legitimate event whose envelope happens to omit `updated_at`.
   * Exact replays remain idempotent because `(provider, event_id)`
   * dedupe in `billing_events` runs ahead of this method.
   */
  private async upsertSubscription(
    userId: string,
    sub: NormalizedSubscription,
  ): Promise<void> {
    const now = new Date();

    if (sub.providerUpdatedAt) {
      const existing = await db('billing_subscriptions')
        .where({
          provider: this.provider.name,
          provider_subscription_id: sub.providerSubscriptionId,
        })
        .first<{ updated_at_provider: Date | null; status: NormalizedStatus } | undefined>(
          'updated_at_provider',
          'status',
        );

      if (
        existing?.updated_at_provider &&
        new Date(existing.updated_at_provider).getTime() > sub.providerUpdatedAt.getTime()
      ) {
        logger.warn('Billing webhook out-of-order — older provider update ignored', {
          provider: this.provider.name,
          providerSubscriptionId: sub.providerSubscriptionId,
          existingProviderUpdatedAt: existing.updated_at_provider,
          incomingProviderUpdatedAt: sub.providerUpdatedAt,
          existingStatus: existing.status,
          incomingStatus: sub.status,
        });
        return;
      }
    }

    await db('billing_subscriptions')
      .insert({
        user_id: userId,
        provider: this.provider.name,
        provider_subscription_id: sub.providerSubscriptionId,
        provider_customer_id: sub.providerCustomerId,
        provider_product_id: sub.providerProductId,
        provider_variant_id: sub.providerVariantId,
        status: sub.status,
        plan: sub.plan,
        trial_ends_at: sub.trialEndsAt,
        renews_at: sub.renewsAt,
        ends_at: sub.endsAt,
        customer_portal_url: sub.customerPortalUrl,
        update_payment_method_url: sub.updatePaymentMethodUrl,
        created_at: now,
        updated_at: now,
        updated_at_provider: sub.providerUpdatedAt,
      })
      .onConflict(['provider', 'provider_subscription_id'])
      .merge({
        user_id: userId,
        provider_customer_id: sub.providerCustomerId,
        provider_product_id: sub.providerProductId,
        provider_variant_id: sub.providerVariantId,
        status: sub.status,
        plan: sub.plan,
        trial_ends_at: sub.trialEndsAt,
        renews_at: sub.renewsAt,
        ends_at: sub.endsAt,
        customer_portal_url: sub.customerPortalUrl,
        update_payment_method_url: sub.updatePaymentMethodUrl,
        updated_at: now,
        updated_at_provider: sub.providerUpdatedAt,
      });
  }
}
