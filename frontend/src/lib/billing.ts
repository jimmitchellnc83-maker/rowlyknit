import axios from 'axios';

/**
 * Typed client for the `/api/billing/*` surface. Mirrors the backend
 * `billingController` shapes one-for-one — the React pages and tests
 * import from here rather than crafting URLs by hand so that any
 * controller-side rename is caught at the type layer.
 *
 * Errors are surfaced as plain `Error` instances; the calling
 * component decides whether to toast or render an inline banner. The
 * one shape the UI explicitly branches on is the 503 "billing not
 * available" response — caller pulls `code === 'BILLING_NOT_AVAILABLE'`
 * off the resulting Error.
 */

export type BillingPlan = 'monthly' | 'annual';

export interface BillingStatus {
  provider: 'lemonsqueezy' | 'mock' | 'none';
  providerReady: boolean;
  preLaunchOpen: boolean;
  entitled: boolean;
  reason: string;
  plan: BillingPlan | null;
  status: string | null;
  trialEndsAt: string | null;
  renewsAt: string | null;
  endsAt: string | null;
  customerPortalUrl: string | null;
}

export interface CheckoutResponse {
  checkoutUrl: string;
  sessionId: string | null;
  plan: BillingPlan;
}

export interface PortalResponse {
  portalUrl: string;
}

export class BillingError extends Error {
  code: string;
  status: number;
  missing?: string[];
  constructor(message: string, code: string, status: number, missing?: string[]) {
    super(message);
    this.code = code;
    this.status = status;
    this.missing = missing;
  }
}

function toBillingError(err: any): BillingError {
  const status = err?.response?.status ?? 500;
  const data = err?.response?.data ?? {};
  const code = (data.error as string | undefined) ?? 'BILLING_REQUEST_FAILED';
  const message = (data.message as string | undefined) ?? err?.message ?? 'Billing request failed';
  const missing = Array.isArray(data.missing) ? (data.missing as string[]) : undefined;
  return new BillingError(message, code, status, missing);
}

export async function fetchBillingStatus(): Promise<BillingStatus> {
  try {
    const res = await axios.get('/api/billing/status');
    return res.data.data as BillingStatus;
  } catch (err) {
    throw toBillingError(err);
  }
}

export async function startCheckout(plan: BillingPlan): Promise<CheckoutResponse> {
  try {
    const res = await axios.post(`/api/billing/checkout/${plan}`);
    return res.data.data as CheckoutResponse;
  } catch (err) {
    throw toBillingError(err);
  }
}

export async function fetchPortalUrl(): Promise<PortalResponse> {
  try {
    const res = await axios.post('/api/billing/portal');
    return res.data.data as PortalResponse;
  } catch (err) {
    throw toBillingError(err);
  }
}

/**
 * Map Lemon Squeezy / normalised status enums to human copy. Both
 * UpgradePage (banner copy) and AccountBillingPage (status row) consume
 * this — keep them in sync via the shared function rather than two
 * parallel switch statements that drift.
 *
 * Raw values like `on_trial`, `past_due` leaked into the UI before this
 * was hoisted. Calling this function gates the raw value out of the
 * DOM.
 */
export function humanStatusLabel(status: string | null): string {
  switch (status) {
    case 'on_trial':
      return 'Free trial';
    case 'active':
      return 'Active';
    case 'paused':
      return 'Paused';
    case 'past_due':
      return 'Past due';
    case 'unpaid':
      return 'Unpaid';
    case 'cancelled':
    case 'canceled':
      return 'Cancelled';
    case 'expired':
      return 'Expired';
    default:
      return status ? status.replace(/_/g, ' ') : 'Unknown';
  }
}
