import crypto from 'crypto';
import axios, { AxiosInstance } from 'axios';
import logger from '../../config/logger';
import { LemonSqueezyConfig } from '../../config/billing';
import {
  BillingPlan,
  BillingProviderAdapter,
  CheckoutInput,
  CheckoutResult,
  NormalizedStatus,
  NormalizedSubscription,
  NormalizedCustomer,
  NormalizedWebhookEvent,
} from './types';

/**
 * Lemon Squeezy adapter.
 *
 * Talks to https://api.lemonsqueezy.com/v1/. The API uses the JSON:API
 * spec (data/relationships/attributes envelope), which is why
 * `createCheckout` posts a relatively verbose body.
 *
 * The `httpClient` is injected so tests can stub the HTTP layer
 * without monkey-patching axios. In production we construct it once at
 * adapter init with the API key baked into the default Authorization
 * header.
 */
export class LemonSqueezyProvider implements BillingProviderAdapter {
  readonly name = 'lemonsqueezy';

  private readonly config: LemonSqueezyConfig;
  private readonly http: AxiosInstance;

  constructor(config: LemonSqueezyConfig, http?: AxiosInstance) {
    this.config = config;
    this.http =
      http ??
      axios.create({
        baseURL: 'https://api.lemonsqueezy.com/v1',
        headers: {
          Accept: 'application/vnd.api+json',
          'Content-Type': 'application/vnd.api+json',
          Authorization: `Bearer ${config.apiKey}`,
        },
        timeout: 10_000,
      });
  }

  async createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
    const variantId = this.variantIdFor(input.plan);

    // JSON:API envelope. Lemon Squeezy reads `checkout_data.email`,
    // `checkout_data.custom` (we pass user_id so the webhook resolves
    // the Rowly user), and `product_options.redirect_url`.
    const body = {
      data: {
        type: 'checkouts',
        attributes: {
          checkout_data: {
            email: input.userEmail,
            custom: {
              user_id: input.userId,
              plan: input.plan,
            },
          },
          product_options: {
            redirect_url: input.redirectUrl,
          },
        },
        relationships: {
          store: {
            data: { type: 'stores', id: String(this.config.storeId) },
          },
          variant: {
            data: { type: 'variants', id: String(variantId) },
          },
        },
      },
    };

    try {
      const res = await this.http.post('/checkouts', body);
      const url = res?.data?.data?.attributes?.url as string | undefined;
      const sessionId = res?.data?.data?.id as string | undefined;
      if (!url) {
        throw new Error('Lemon Squeezy create-checkout: missing url in response');
      }
      return { checkoutUrl: url, sessionId };
    } catch (err: any) {
      logger.error('Lemon Squeezy checkout creation failed', {
        message: err?.message,
        responseStatus: err?.response?.status,
        // Don't log body — may contain reflected secrets in error mode.
      });
      throw new Error('Failed to create checkout session');
    }
  }

  /**
   * HMAC-SHA256 of the raw body using the webhook secret. Lemon Squeezy
   * sends the digest hex-encoded in `X-Signature`.
   *
   * Constant-time comparison via `crypto.timingSafeEqual`.
   */
  verifyWebhook(rawBody: Buffer, signatureHeader: string | undefined): boolean {
    if (!signatureHeader) return false;
    if (!this.config.webhookSecret) return false;

    const expected = crypto
      .createHmac('sha256', this.config.webhookSecret)
      .update(rawBody)
      .digest('hex');

    // Lemon Squeezy forwards the hex digest verbatim in `X-Signature`.
    // Reject anything that isn't the right length up-front so we don't
    // even build the Buffer for a wildly malformed header.
    if (signatureHeader.length !== expected.length) return false;

    try {
      return crypto.timingSafeEqual(
        Buffer.from(expected, 'utf8'),
        Buffer.from(signatureHeader, 'utf8'),
      );
    } catch {
      return false;
    }
  }

  parseWebhook(rawBody: Buffer): NormalizedWebhookEvent {
    let payload: any;
    try {
      payload = JSON.parse(rawBody.toString('utf8'));
    } catch {
      throw new Error('Lemon Squeezy webhook: body is not valid JSON');
    }

    const meta = payload?.meta ?? {};
    const data = payload?.data ?? {};
    const attributes = data?.attributes ?? {};

    const eventName = String(meta.event_name ?? '');
    if (!eventName) throw new Error('Lemon Squeezy webhook: missing event_name');

    // `meta.webhook_id` is per-delivery (idempotency key in retries).
    // Fall back to a deterministic SHA-256 of the raw body when neither
    // `webhook_id` nor `event_id` was supplied — this preserves
    // idempotency across retries (same body → same hash) without the
    // wall-clock noise from `Date.now()` that previously broke replay
    // dedupe in tests and on a clock-skewed retry.
    const eventId = String(
      meta.webhook_id ??
        meta.event_id ??
        `${eventName}:${data?.id ?? 'unknown'}:sha256:${crypto
          .createHash('sha256')
          .update(rawBody)
          .digest('hex')}`,
    );

    const customData = meta.custom_data ?? {};
    const userId = typeof customData.user_id === 'string' ? customData.user_id : undefined;

    let subscription: NormalizedSubscription | null = null;
    let customer: NormalizedCustomer | null = null;

    if (data?.type === 'subscriptions' && data?.id) {
      subscription = {
        providerSubscriptionId: String(data.id),
        providerCustomerId: attributes.customer_id ? String(attributes.customer_id) : null,
        providerProductId: attributes.product_id ? String(attributes.product_id) : null,
        providerVariantId: attributes.variant_id ? String(attributes.variant_id) : null,
        status: this.mapStatus(attributes.status),
        plan: this.planFromVariant(attributes.variant_id),
        trialEndsAt: parseDate(attributes.trial_ends_at),
        renewsAt: parseDate(attributes.renews_at),
        endsAt: parseDate(attributes.ends_at),
        customerPortalUrl: attributes?.urls?.customer_portal ?? null,
        updatePaymentMethodUrl: attributes?.urls?.update_payment_method ?? null,
        providerUpdatedAt: parseDate(attributes.updated_at),
      };

      if (attributes.customer_id) {
        customer = {
          providerCustomerId: String(attributes.customer_id),
          email: attributes.user_email ?? null,
        };
      }
    }

    return {
      eventId,
      eventName,
      userId,
      subscription,
      customer,
      raw: payload,
    };
  }

  private variantIdFor(plan: BillingPlan): string {
    return plan === 'annual' ? this.config.annualVariantId : this.config.monthlyVariantId;
  }

  private planFromVariant(variantId: string | number | null | undefined): BillingPlan | null {
    if (variantId == null) return null;
    const id = String(variantId);
    if (id === String(this.config.monthlyVariantId)) return 'monthly';
    if (id === String(this.config.annualVariantId)) return 'annual';
    return null;
  }

  private mapStatus(raw: unknown): NormalizedStatus {
    if (typeof raw !== 'string') return 'unknown';
    switch (raw) {
      case 'on_trial':
        return 'on_trial';
      case 'active':
        return 'active';
      case 'paused':
        return 'paused';
      case 'past_due':
        return 'past_due';
      case 'unpaid':
        return 'unpaid';
      case 'cancelled':
        return 'cancelled';
      case 'expired':
        return 'expired';
      default:
        return 'unknown';
    }
  }
}

function parseDate(raw: unknown): Date | null {
  if (!raw) return null;
  if (typeof raw !== 'string' && typeof raw !== 'number') return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}
