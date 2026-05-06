/**
 * Provider-agnostic billing types.
 *
 * Lemon Squeezy is the first concrete provider, but the rest of the
 * billing layer programs against this interface so a future swap
 * (Stripe / Paddle) only requires another adapter implementation.
 */

export type BillingPlan = 'monthly' | 'annual';

/**
 * Statuses we normalise providers down to. Each provider has its own
 * enum (LS uses `on_trial`, `active`, `paused`, `past_due`, `unpaid`,
 * `cancelled`, `expired`); the adapter maps to one of these so the
 * entitlement helper can stay provider-blind.
 */
export type NormalizedStatus =
  | 'on_trial'
  | 'active'
  | 'paused'
  | 'past_due'
  | 'unpaid'
  | 'cancelled'
  | 'expired'
  | 'unknown';

export const ENTITLED_STATUSES: ReadonlySet<NormalizedStatus> = new Set([
  'on_trial',
  'active',
]);

export interface CheckoutInput {
  userId: string;
  userEmail: string;
  plan: BillingPlan;
  /**
   * Where to send the user after they finish checkout. Provider will
   * append its own query params; we just provide the base.
   */
  redirectUrl: string;
}

export interface CheckoutResult {
  /** Absolute URL the browser should redirect to. */
  checkoutUrl: string;
  /** Provider's own session id, if any. Stored for support. */
  sessionId?: string;
}

/**
 * The shape we extract from a verified webhook so the service layer
 * doesn't have to know provider-specific JSON.
 */
export interface NormalizedWebhookEvent {
  /** Provider's unique event id — drives idempotency. */
  eventId: string;
  /** Original provider event name (e.g. `subscription_created`). */
  eventName: string;
  /** The Rowly user this event resolves to, if known. */
  userId?: string;
  /** Subscription state derived from the payload. Null if non-sub event. */
  subscription: NormalizedSubscription | null;
  /** Customer info if a new customer-id appeared. */
  customer: NormalizedCustomer | null;
  /** The full raw event for forensic storage. */
  raw: unknown;
}

export interface NormalizedSubscription {
  providerSubscriptionId: string;
  providerCustomerId: string | null;
  providerProductId: string | null;
  providerVariantId: string | null;
  status: NormalizedStatus;
  plan: BillingPlan | null;
  trialEndsAt: Date | null;
  renewsAt: Date | null;
  endsAt: Date | null;
  customerPortalUrl: string | null;
  updatePaymentMethodUrl: string | null;
  /**
   * Provider-side `updated_at` timestamp from the webhook payload.
   * Used as the out-of-order guard: an incoming event whose
   * `providerUpdatedAt` is older than the row we already have must not
   * overwrite newer state. Null when the provider didn't include one;
   * in that case the upsert falls through (best-effort).
   */
  providerUpdatedAt: Date | null;
}

export interface NormalizedCustomer {
  providerCustomerId: string;
  email: string | null;
}

/**
 * The interface every billing adapter implements. Mocked freely in
 * tests; the LS implementation is the only one talking to the real
 * Lemon Squeezy API.
 */
export interface BillingProviderAdapter {
  /** Stable identifier — `'lemonsqueezy'` / `'mock'`. */
  readonly name: string;

  /** Hit the provider's API to start a checkout session. */
  createCheckout(input: CheckoutInput): Promise<CheckoutResult>;

  /**
   * Verify a webhook delivery's signature against `rawBody`.
   * Returns `true` on match, `false` on mismatch / missing header.
   */
  verifyWebhook(rawBody: Buffer, signatureHeader: string | undefined): boolean;

  /**
   * Parse a verified webhook body into our normalised shape.
   * Throws if the payload doesn't match the provider's expected
   * envelope. Should NOT throw for unknown event names — callers want
   * to record those for visibility even if we can't act on them.
   */
  parseWebhook(rawBody: Buffer): NormalizedWebhookEvent;
}
