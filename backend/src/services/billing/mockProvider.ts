import crypto from 'crypto';
import { randomUUID } from 'crypto';
import {
  BillingProviderAdapter,
  CheckoutInput,
  CheckoutResult,
  NormalizedWebhookEvent,
} from './types';

/**
 * In-process mock billing provider.
 *
 * Used by:
 *   - Unit tests (avoid hitting any real provider).
 *   - `BILLING_PROVIDER=mock` for local dev smoke before the owner
 *     provisions Lemon Squeezy.
 *
 * Behaviour:
 *   - `createCheckout` returns a deterministic-shape URL that does NOT
 *     resolve to a real provider. The smoke flow is "click the URL,
 *     paste the equivalent webhook into a curl, see the user become
 *     entitled". We do NOT pretend a click on this URL will return
 *     successfully — the goal is to exercise the integration seams.
 *   - `verifyWebhook` accepts any signature equal to a HMAC-SHA256 of
 *     the raw body using the secret `'mock-secret'`. Tests can either
 *     compute that or call `MockBillingProvider.signMockBody` to get
 *     the right header.
 *   - `parseWebhook` expects a JSON envelope shaped like Lemon
 *     Squeezy's so the rest of the service layer doesn't need a
 *     conditional. Construct one with `MockBillingProvider.buildEvent`.
 */
export class MockBillingProvider implements BillingProviderAdapter {
  readonly name = 'mock';
  static readonly SECRET = 'mock-secret';

  async createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
    const id = randomUUID();
    const url = `https://example.test/mock-checkout/${id}?plan=${input.plan}&user=${encodeURIComponent(
      input.userId,
    )}`;
    return Promise.resolve({ checkoutUrl: url, sessionId: id });
  }

  verifyWebhook(rawBody: Buffer, signatureHeader: string | undefined): boolean {
    if (!signatureHeader) return false;
    const expected = MockBillingProvider.signMockBody(rawBody);
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
    const payload = JSON.parse(rawBody.toString('utf8'));
    const meta = payload?.meta ?? {};
    const data = payload?.data ?? {};
    const attributes = data?.attributes ?? {};
    const eventName = String(meta.event_name ?? '');
    const eventId = String(meta.webhook_id ?? meta.event_id ?? `${eventName}:${data?.id ?? randomUUID()}`);
    const customData = meta.custom_data ?? {};
    const userId = typeof customData.user_id === 'string' ? customData.user_id : undefined;

    if (!eventName) throw new Error('Mock provider: missing event_name');

    let subscription = null;
    if (data?.type === 'subscriptions' && data?.id) {
      subscription = {
        providerSubscriptionId: String(data.id),
        providerCustomerId: attributes.customer_id ? String(attributes.customer_id) : null,
        providerProductId: attributes.product_id ? String(attributes.product_id) : null,
        providerVariantId: attributes.variant_id ? String(attributes.variant_id) : null,
        status: (attributes.status as any) ?? 'unknown',
        plan: (attributes.plan as any) ?? null,
        trialEndsAt: attributes.trial_ends_at ? new Date(attributes.trial_ends_at) : null,
        renewsAt: attributes.renews_at ? new Date(attributes.renews_at) : null,
        endsAt: attributes.ends_at ? new Date(attributes.ends_at) : null,
        customerPortalUrl: attributes?.urls?.customer_portal ?? null,
        updatePaymentMethodUrl: attributes?.urls?.update_payment_method ?? null,
      };
    }

    return {
      eventId,
      eventName,
      userId,
      subscription,
      customer: null,
      raw: payload,
    };
  }

  /**
   * HMAC-SHA256(rawBody, MOCK_SECRET) hex-encoded — the exact format
   * the LS provider would expect from a real Lemon Squeezy delivery.
   */
  static signMockBody(rawBody: Buffer): string {
    return crypto.createHmac('sha256', MockBillingProvider.SECRET).update(rawBody).digest('hex');
  }
}
