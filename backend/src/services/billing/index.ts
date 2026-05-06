import { getBillingConfig } from '../../config/billing';
import { LemonSqueezyProvider } from './lemonSqueezyProvider';
import { MockBillingProvider } from './mockProvider';
import { BillingService } from './billingService';
import { BillingProviderAdapter } from './types';

/**
 * Factory + lazy singleton for the configured BillingService.
 *
 * Why lazy: `BILLING_PROVIDER` and the LS env vars are read on each
 * call to `getBillingConfig()`, but the resulting service is cached
 * for the duration of the process. Tests can call `resetBillingService`
 * between cases to swap providers without restarting the worker.
 */
let cachedService: BillingService | null = null;
let cachedSignature: string | null = null;

export function getBillingService(): BillingService | null {
  const cfg = getBillingConfig();
  const signature = `${cfg.provider}:${cfg.ready ? 'ready' : 'not-ready'}`;

  if (cachedService && cachedSignature === signature) return cachedService;

  let adapter: BillingProviderAdapter | null = null;
  if (cfg.provider === 'lemonsqueezy' && cfg.ready && cfg.lemonSqueezy) {
    adapter = new LemonSqueezyProvider(cfg.lemonSqueezy);
  } else if (cfg.provider === 'mock') {
    adapter = new MockBillingProvider();
  } else {
    adapter = null;
  }

  if (!adapter) {
    cachedService = null;
    cachedSignature = signature;
    return null;
  }

  cachedService = new BillingService(adapter);
  cachedSignature = signature;
  return cachedService;
}

/**
 * For tests: clear the cached service so the next `getBillingService`
 * call re-reads `process.env`.
 */
export function resetBillingService(): void {
  cachedService = null;
  cachedSignature = null;
}

/**
 * Tests-only: install a hand-built service. Lets a single test pin a
 * particular adapter (e.g. one wrapping a Jest-mocked axios) without
 * needing to mutate env vars.
 */
export function setBillingServiceForTests(svc: BillingService | null): void {
  cachedService = svc;
  cachedSignature = svc ? `injected:${svc.providerName}` : null;
}

export type { BillingService } from './billingService';
export * from './types';
