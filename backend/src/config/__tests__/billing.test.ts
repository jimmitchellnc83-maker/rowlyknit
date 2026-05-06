/**
 * Tests for the billing config loader.
 *
 * The loader reads `process.env` lazily on each call, so we mutate env
 * between cases. No I/O — these are pure-function checks.
 */

const ALL_KEYS = [
  'BILLING_PROVIDER',
  'BILLING_PRE_LAUNCH_OPEN',
  'APP_URL',
  'LEMONSQUEEZY_API_KEY',
  'LEMONSQUEEZY_WEBHOOK_SECRET',
  'LEMONSQUEEZY_STORE_ID',
  'LEMONSQUEEZY_PRODUCT_ID',
  'LEMONSQUEEZY_MONTHLY_VARIANT_ID',
  'LEMONSQUEEZY_ANNUAL_VARIANT_ID',
];

let original: Record<string, string | undefined>;

beforeEach(() => {
  original = {};
  ALL_KEYS.forEach((k) => {
    original[k] = process.env[k];
    delete process.env[k];
  });
});

afterEach(() => {
  ALL_KEYS.forEach((k) => {
    if (original[k] === undefined) delete process.env[k];
    else process.env[k] = original[k] as string;
  });
});

describe('getBillingConfig', () => {
  it('returns provider=none, ready=true when BILLING_PROVIDER is unset', () => {
    const { getBillingConfig } = require('../billing');
    const cfg = getBillingConfig();
    expect(cfg.provider).toBe('none');
    expect(cfg.ready).toBe(true);
  });

  it('returns provider=mock when BILLING_PROVIDER=mock with no other vars', () => {
    process.env.BILLING_PROVIDER = 'mock';
    const { getBillingConfig } = require('../billing');
    const cfg = getBillingConfig();
    expect(cfg.provider).toBe('mock');
    expect(cfg.ready).toBe(true);
  });

  it('flags lemonsqueezy as not ready and lists missing env vars', () => {
    process.env.BILLING_PROVIDER = 'lemonsqueezy';
    const { getBillingConfig, LEMONSQUEEZY_REQUIRED_ENV } = require('../billing');
    const cfg = getBillingConfig();
    expect(cfg.provider).toBe('lemonsqueezy');
    expect(cfg.ready).toBe(false);
    expect(cfg.missing).toEqual(expect.arrayContaining([...LEMONSQUEEZY_REQUIRED_ENV]));
  });

  it('PR #389 P1 fix — APP_URL is part of LEMONSQUEEZY_REQUIRED_ENV', () => {
    // The /health endpoint surfaces missing required env as a public
    // launch blocker. Without APP_URL on this list, a production deploy
    // could flip BILLING_PROVIDER=lemonsqueezy without APP_URL set and
    // /health would not flag it — checkout success would silently
    // redirect to localhost.
    const { LEMONSQUEEZY_REQUIRED_ENV } = require('../billing');
    expect(LEMONSQUEEZY_REQUIRED_ENV).toEqual(expect.arrayContaining(['APP_URL']));
  });

  it('PR #389 P1 fix — APP_URL missing flags lemonsqueezy as not-ready', () => {
    process.env.BILLING_PROVIDER = 'lemonsqueezy';
    process.env.LEMONSQUEEZY_API_KEY = 'k';
    process.env.LEMONSQUEEZY_WEBHOOK_SECRET = 's';
    process.env.LEMONSQUEEZY_STORE_ID = '1';
    process.env.LEMONSQUEEZY_PRODUCT_ID = '2';
    process.env.LEMONSQUEEZY_MONTHLY_VARIANT_ID = '3';
    process.env.LEMONSQUEEZY_ANNUAL_VARIANT_ID = '4';
    // APP_URL deliberately NOT set
    const { getBillingConfig } = require('../billing');
    const cfg = getBillingConfig();
    expect(cfg.ready).toBe(false);
    expect((cfg as any).missing).toContain('APP_URL');
  });

  it('returns ready=true with config object when all LS vars are present', () => {
    process.env.BILLING_PROVIDER = 'lemonsqueezy';
    process.env.LEMONSQUEEZY_API_KEY = 'k';
    process.env.LEMONSQUEEZY_WEBHOOK_SECRET = 's';
    process.env.LEMONSQUEEZY_STORE_ID = '1';
    process.env.LEMONSQUEEZY_PRODUCT_ID = '2';
    process.env.LEMONSQUEEZY_MONTHLY_VARIANT_ID = '3';
    process.env.LEMONSQUEEZY_ANNUAL_VARIANT_ID = '4';
    process.env.APP_URL = 'https://rowlyknit.com';
    const { getBillingConfig } = require('../billing');
    const cfg = getBillingConfig();
    expect(cfg.ready).toBe(true);
    expect(cfg.provider).toBe('lemonsqueezy');
    expect(cfg.lemonSqueezy).toEqual({
      apiKey: 'k',
      webhookSecret: 's',
      storeId: '1',
      productId: '2',
      monthlyVariantId: '3',
      annualVariantId: '4',
    });
  });

  it('reads APP_URL with trailing slash stripped', () => {
    process.env.APP_URL = 'https://rowlyknit.com/';
    const { getBillingConfig } = require('../billing');
    expect(getBillingConfig().appUrl).toBe('https://rowlyknit.com');
  });

  it('falls back to localhost when APP_URL is unset', () => {
    const { getBillingConfig } = require('../billing');
    expect(getBillingConfig().appUrl).toBe('http://localhost:5173');
  });

  it('reads BILLING_PRE_LAUNCH_OPEN as bool', () => {
    process.env.BILLING_PRE_LAUNCH_OPEN = 'true';
    const { getBillingConfig } = require('../billing');
    expect(getBillingConfig().preLaunchOpen).toBe(true);
  });

  it('isBillingProviderProductionReady is false for none/mock even when ready', () => {
    process.env.BILLING_PROVIDER = 'mock';
    const { isBillingProviderProductionReady } = require('../billing');
    expect(isBillingProviderProductionReady()).toBe(false);
  });

  it('isBillingProviderProductionReady is true only for fully-provisioned LS', () => {
    process.env.BILLING_PROVIDER = 'lemonsqueezy';
    process.env.LEMONSQUEEZY_API_KEY = 'k';
    process.env.LEMONSQUEEZY_WEBHOOK_SECRET = 's';
    process.env.LEMONSQUEEZY_STORE_ID = '1';
    process.env.LEMONSQUEEZY_PRODUCT_ID = '2';
    process.env.LEMONSQUEEZY_MONTHLY_VARIANT_ID = '3';
    process.env.LEMONSQUEEZY_ANNUAL_VARIANT_ID = '4';
    process.env.APP_URL = 'https://rowlyknit.com';
    const { isBillingProviderProductionReady } = require('../billing');
    expect(isBillingProviderProductionReady()).toBe(true);
  });
});
