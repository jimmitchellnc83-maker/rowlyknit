/**
 * Unit tests for the Lemon Squeezy provider adapter.
 *
 * No real network calls — `axios` is replaced with a hand-rolled stub
 * that records the request body and returns a canned response. HMAC
 * verification is exercised against vectors we sign here.
 */

import crypto from 'crypto';
import { LemonSqueezyProvider } from '../billing/lemonSqueezyProvider';
import { LemonSqueezyConfig } from '../../config/billing';

const config: LemonSqueezyConfig = {
  apiKey: 'test-api',
  webhookSecret: 'test-secret',
  storeId: '11111',
  productId: '22222',
  monthlyVariantId: '33333',
  annualVariantId: '44444',
};

function makeStub(response: any) {
  const calls: any[] = [];
  const stub = {
    post: jest.fn(async (url: string, body: any) => {
      calls.push({ url, body });
      return { data: response };
    }),
  } as any;
  return { stub, calls };
}

describe('LemonSqueezyProvider.createCheckout', () => {
  it('posts a JSON:API checkout body with custom user_id + variant', async () => {
    const { stub, calls } = makeStub({
      data: { id: 'sess_abc', attributes: { url: 'https://lemon.test/checkout/abc' } },
    });
    const provider = new LemonSqueezyProvider(config, stub);
    const result = await provider.createCheckout({
      userId: 'user-1',
      userEmail: 'u@example.com',
      plan: 'monthly',
      redirectUrl: 'https://rowly.test/account/billing?checkout=success',
    });

    expect(result).toEqual({
      checkoutUrl: 'https://lemon.test/checkout/abc',
      sessionId: 'sess_abc',
    });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('/checkouts');
    const body = calls[0].body;
    expect(body.data.type).toBe('checkouts');
    expect(body.data.attributes.checkout_data.email).toBe('u@example.com');
    expect(body.data.attributes.checkout_data.custom).toEqual({
      user_id: 'user-1',
      plan: 'monthly',
    });
    expect(body.data.attributes.product_options.redirect_url).toBe(
      'https://rowly.test/account/billing?checkout=success',
    );
    expect(body.data.relationships.variant.data).toEqual({ type: 'variants', id: '33333' });
    expect(body.data.relationships.store.data).toEqual({ type: 'stores', id: '11111' });
  });

  it('uses the annual variant id for plan=annual', async () => {
    const { stub, calls } = makeStub({
      data: { id: 'sess_x', attributes: { url: 'https://lemon.test/x' } },
    });
    const provider = new LemonSqueezyProvider(config, stub);
    await provider.createCheckout({
      userId: 'u',
      userEmail: 'a@b.c',
      plan: 'annual',
      redirectUrl: 'https://rowly.test/r',
    });
    expect(calls[0].body.data.relationships.variant.data.id).toBe('44444');
  });

  it('throws a sanitised error when LS responds with no url', async () => {
    const { stub } = makeStub({ data: { id: 'x', attributes: {} } });
    const provider = new LemonSqueezyProvider(config, stub);
    await expect(
      provider.createCheckout({
        userId: 'u',
        userEmail: 'a@b.c',
        plan: 'monthly',
        redirectUrl: 'https://rowly.test/r',
      }),
    ).rejects.toThrow('Failed to create checkout session');
  });
});

describe('LemonSqueezyProvider.verifyWebhook', () => {
  const provider = new LemonSqueezyProvider(config);

  it('returns false when the signature header is missing', () => {
    expect(provider.verifyWebhook(Buffer.from('{}'), undefined)).toBe(false);
  });

  it('returns true for a correct HMAC-SHA256 signature', () => {
    const body = Buffer.from(JSON.stringify({ hello: 'world' }));
    const sig = crypto.createHmac('sha256', config.webhookSecret).update(body).digest('hex');
    expect(provider.verifyWebhook(body, sig)).toBe(true);
  });

  it('returns false for a wrong signature', () => {
    const body = Buffer.from('hi');
    const sig = crypto.createHmac('sha256', 'wrong').update(body).digest('hex');
    expect(provider.verifyWebhook(body, sig)).toBe(false);
  });

  it('returns false for a signature of the wrong length', () => {
    const body = Buffer.from('hi');
    expect(provider.verifyWebhook(body, 'short')).toBe(false);
  });
});

describe('LemonSqueezyProvider.parseWebhook', () => {
  const provider = new LemonSqueezyProvider(config);

  function buildBody(overrides: any = {}): Buffer {
    return Buffer.from(
      JSON.stringify({
        meta: {
          event_name: 'subscription_created',
          webhook_id: 'wh_001',
          custom_data: { user_id: 'user-9', plan: 'monthly' },
          ...(overrides.meta ?? {}),
        },
        data: {
          type: 'subscriptions',
          id: 'sub_99',
          attributes: {
            customer_id: 5000,
            product_id: 22222,
            variant_id: 33333,
            status: 'on_trial',
            trial_ends_at: '2026-06-01T00:00:00Z',
            renews_at: null,
            ends_at: null,
            user_email: 'u@example.com',
            urls: {
              customer_portal: 'https://lemon.test/portal/abc',
              update_payment_method: 'https://lemon.test/pay/abc',
            },
            ...(overrides.attributes ?? {}),
          },
        },
      }),
    );
  }

  it('extracts subscription, customer, and userId from custom_data', () => {
    const event = provider.parseWebhook(buildBody());
    expect(event.eventName).toBe('subscription_created');
    expect(event.eventId).toBe('wh_001');
    expect(event.userId).toBe('user-9');
    expect(event.subscription).toMatchObject({
      providerSubscriptionId: 'sub_99',
      providerCustomerId: '5000',
      providerProductId: '22222',
      providerVariantId: '33333',
      status: 'on_trial',
      plan: 'monthly',
      customerPortalUrl: 'https://lemon.test/portal/abc',
    });
    expect(event.subscription?.trialEndsAt?.toISOString()).toBe('2026-06-01T00:00:00.000Z');
    expect(event.customer).toEqual({
      providerCustomerId: '5000',
      email: 'u@example.com',
    });
  });

  it('maps the annual variant to plan=annual', () => {
    const body = Buffer.from(
      JSON.stringify({
        meta: { event_name: 'subscription_created', webhook_id: 'w2', custom_data: { user_id: 'u' } },
        data: { type: 'subscriptions', id: 's', attributes: { variant_id: 44444, status: 'active' } },
      }),
    );
    const event = provider.parseWebhook(body);
    expect(event.subscription?.plan).toBe('annual');
  });

  it('maps unknown LS statuses to "unknown"', () => {
    const body = Buffer.from(
      JSON.stringify({
        meta: { event_name: 'subscription_updated', webhook_id: 'w3' },
        data: { type: 'subscriptions', id: 's', attributes: { status: 'something_new' } },
      }),
    );
    expect(provider.parseWebhook(body).subscription?.status).toBe('unknown');
  });

  it('throws on invalid JSON', () => {
    expect(() => provider.parseWebhook(Buffer.from('{not json'))).toThrow();
  });
});
