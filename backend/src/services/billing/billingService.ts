import db from '../../config/database';
import logger from '../../config/logger';
import {
  BillingProviderAdapter,
  CheckoutInput,
  CheckoutResult,
  ENTITLED_STATUSES,
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
  /** Convenience boolean: the row's `status` is in ENTITLED_STATUSES. */
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
      ? ENTITLED_STATUSES.has(subscription.status)
      : false;

    return { subscription, isActive };
  }

  /**
   * Idempotent webhook ingest. Walks the parsed event, writes the
   * customer + subscription rows, and records the event. Returns:
   *   - `'duplicate'`  — the event id was already in `billing_events`.
   *   - `'processed'`  — first time we've seen this event id.
   *   - `'unhandled'`  — event recorded but no domain change made
   *                       (unknown event name / missing user link).
   *
   * On error mid-handler we still write the event row with
   * `processed=false` and `error=<message>` so an operator can spot
   * stuck deliveries.
   */
  async ingestWebhookEvent(
    event: NormalizedWebhookEvent,
  ): Promise<'duplicate' | 'processed' | 'unhandled'> {
    // 1. Idempotency check — race-safe insert.
    const inserted = await db('billing_events')
      .insert({
        provider: this.provider.name,
        provider_event_id: event.eventId,
        event_name: event.eventName,
        payload: JSON.stringify(event.raw),
        processed: false,
      })
      .onConflict(['provider', 'provider_event_id'])
      .ignore()
      .returning(['id']);

    if (!inserted || inserted.length === 0) {
      logger.info('Billing webhook duplicate ignored', {
        provider: this.provider.name,
        eventId: event.eventId,
        eventName: event.eventName,
      });
      return 'duplicate';
    }

    const eventRowId = inserted[0].id as string;

    try {
      const handled = await this.applyWebhookSideEffects(event);
      await db('billing_events')
        .where({ id: eventRowId })
        .update({ processed: true, processed_at: new Date() });
      return handled ? 'processed' : 'unhandled';
    } catch (err: any) {
      logger.error('Billing webhook handler failed', {
        provider: this.provider.name,
        eventId: event.eventId,
        eventName: event.eventName,
        error: err?.message,
      });
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
