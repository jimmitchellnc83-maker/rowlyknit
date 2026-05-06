/**
 * Provider-agnostic billing config.
 *
 * Lemon Squeezy is the first concrete provider, but the rest of the
 * codebase reads from this module rather than `process.env` directly so
 * a future swap (or a parallel mock for tests) only touches one file.
 *
 * Production launch posture:
 *   - When `BILLING_PROVIDER=lemonsqueezy` is set in production AND any
 *     of the required Lemon Squeezy values are missing, `getBillingConfig`
 *     returns `{ ready: false, missing: [...] }`. The app still starts —
 *     billing-routes return 503 / 501 with a "billing not yet provisioned"
 *     message — but `/health` flags `billing` as a public-launch blocker
 *     so monitoring sees the gap loudly.
 *   - When `BILLING_PROVIDER` is unset OR set to `none`, billing is OFF.
 *     `/upgrade` shows the placeholder "Billing is not available yet"
 *     message; the public-tool save gate still runs but uses the
 *     `BILLING_PRE_LAUNCH_OPEN` escape hatch (see entitlement helper).
 *
 * Tests: this module reads `process.env` lazily on each call so a test
 * can mutate env between cases. There is no top-level snapshot.
 */

export type BillingProviderName = 'lemonsqueezy' | 'mock' | 'none';

export interface LemonSqueezyConfig {
  apiKey: string;
  webhookSecret: string;
  storeId: string;
  productId: string;
  monthlyVariantId: string;
  annualVariantId: string;
}

export interface BillingConfigReady {
  provider: BillingProviderName;
  ready: true;
  /** Present iff `provider === 'lemonsqueezy'`. */
  lemonSqueezy?: LemonSqueezyConfig;
  /** Mirrors APP_URL — provider-agnostic redirect target. */
  appUrl: string;
  /**
   * Pre-launch escape hatch: when true, the entitlement gate returns
   * `allowed: true` for any logged-in user. Lets us deploy the billing
   * surface in production before owner provisions Lemon Squeezy
   * without locking everyone out of the workspace.
   */
  preLaunchOpen: boolean;
}

export interface BillingConfigNotReady {
  provider: BillingProviderName;
  ready: false;
  /** Names of the env vars that are missing. */
  missing: string[];
  appUrl: string;
  preLaunchOpen: boolean;
}

export type BillingConfig = BillingConfigReady | BillingConfigNotReady;

/**
 * Required env vars for each provider. Kept here so tests can assert
 * against a single source of truth.
 */
export const LEMONSQUEEZY_REQUIRED_ENV = [
  'LEMONSQUEEZY_API_KEY',
  'LEMONSQUEEZY_WEBHOOK_SECRET',
  'LEMONSQUEEZY_STORE_ID',
  'LEMONSQUEEZY_PRODUCT_ID',
  'LEMONSQUEEZY_MONTHLY_VARIANT_ID',
  'LEMONSQUEEZY_ANNUAL_VARIANT_ID',
] as const;

function readProvider(): BillingProviderName {
  const raw = (process.env.BILLING_PROVIDER || '').toLowerCase().trim();
  if (raw === 'lemonsqueezy') return 'lemonsqueezy';
  if (raw === 'mock') return 'mock';
  return 'none';
}

function readAppUrl(): string {
  return (process.env.APP_URL || 'http://localhost:5173').replace(/\/$/, '');
}

function readPreLaunchOpen(): boolean {
  return (process.env.BILLING_PRE_LAUNCH_OPEN || '').toLowerCase() === 'true';
}

/**
 * Build the current config snapshot. Pure: no I/O, no logging.
 *
 * - In dev/test, missing Lemon Squeezy vars → `ready: false` (the app
 *   doesn't crash; tests can set `BILLING_PROVIDER=mock` and skip).
 * - In production with `BILLING_PROVIDER=lemonsqueezy`, missing vars →
 *   `ready: false`. Callers (server startup logger, /health) decide how
 *   to surface this. We don't `throw` here — config validation errors
 *   should not take the whole app down; they should be visible.
 */
export function getBillingConfig(): BillingConfig {
  const provider = readProvider();
  const appUrl = readAppUrl();
  const preLaunchOpen = readPreLaunchOpen();

  if (provider === 'none') {
    return { provider, ready: true, appUrl, preLaunchOpen };
  }

  if (provider === 'mock') {
    // Mock provider needs nothing — used by tests + dev smoke.
    return { provider, ready: true, appUrl, preLaunchOpen };
  }

  // Lemon Squeezy — collect missing vars.
  const missing = LEMONSQUEEZY_REQUIRED_ENV.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    return { provider, ready: false, missing, appUrl, preLaunchOpen };
  }

  return {
    provider,
    ready: true,
    appUrl,
    preLaunchOpen,
    lemonSqueezy: {
      apiKey: process.env.LEMONSQUEEZY_API_KEY!,
      webhookSecret: process.env.LEMONSQUEEZY_WEBHOOK_SECRET!,
      storeId: process.env.LEMONSQUEEZY_STORE_ID!,
      productId: process.env.LEMONSQUEEZY_PRODUCT_ID!,
      monthlyVariantId: process.env.LEMONSQUEEZY_MONTHLY_VARIANT_ID!,
      annualVariantId: process.env.LEMONSQUEEZY_ANNUAL_VARIANT_ID!,
    },
  };
}

/**
 * Convenience predicate. `true` when the configured provider has all
 * required values populated (or the provider is `none`/`mock`).
 */
export function isBillingReady(): boolean {
  return getBillingConfig().ready;
}

/**
 * Boolean — "billing is wired enough to take real money." Returns
 * false for `none`/`mock` even if ready. Used by /health to flag a
 * production deploy that hasn't been hooked up to Lemon Squeezy yet.
 */
export function isBillingProviderProductionReady(): boolean {
  const cfg = getBillingConfig();
  return cfg.provider === 'lemonsqueezy' && cfg.ready;
}
