import logger from '../config/logger';
import { getBillingConfig } from '../config/billing';
import { getBillingService } from '../services/billing';
import { ENTITLED_STATUSES } from '../services/billing/types';

/**
 * Server-side entitlement gate for paid-workspace operations.
 *
 * Mirrors the frontend `frontend/src/lib/entitlement.ts` contract so
 * the two surfaces stay aligned. The frontend version cannot be
 * trusted alone — anyone who pokes at the DOM can flip a boolean —
 * which is why every workspace-write route MUST run this gate
 * server-side via `requireEntitlement` middleware.
 *
 * Reasons returned by this function:
 *   - `unauthenticated`        — no userId given
 *   - `owner`                  — email is in OWNER_EMAIL allowlist
 *   - `pre_launch_open`        — BILLING_PRE_LAUNCH_OPEN=true escape
 *                                 hatch (dev/staging or pre-billing
 *                                 production rollout)
 *   - `active_subscription`    — billing_subscriptions row with
 *                                 status=active
 *   - `trialing`               — same row but status=on_trial
 *   - `cancelled_grace`        — status=cancelled but ends_at is in
 *                                 the future; user keeps access
 *                                 through the paid-through period
 *   - `no_active_subscription` — has billing rows but none entitled
 *   - `no_subscription`        — never transacted
 *
 * Owner allowlist comes from `OWNER_EMAIL` (comma-separated). This is
 * the same env var `requireOwner` reads — single source of truth.
 */
export type EntitlementReason =
  | 'unauthenticated'
  | 'owner'
  | 'pre_launch_open'
  | 'active_subscription'
  | 'trialing'
  | 'cancelled_grace'
  | 'no_active_subscription'
  | 'no_subscription';

export interface EntitlementResult {
  allowed: boolean;
  reason: EntitlementReason;
  /** Latest subscription summary, if any. Null for owner / pre-launch. */
  subscription?: {
    status: string;
    plan: 'monthly' | 'annual' | null;
    trialEndsAt: string | null;
    renewsAt: string | null;
    endsAt: string | null;
  } | null;
}

function ownerEmails(): Set<string> {
  const raw = process.env.OWNER_EMAIL ?? '';
  return new Set(
    raw
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}

/**
 * Resolve entitlement for a user. The id and (optional) email are read
 * straight from the JWT payload; we don't re-query `users` here unless
 * we need to (the email is already on the JWT). This keeps the gate
 * cheap on every workspace-write call.
 */
export async function canUsePaidWorkspace(args: {
  userId: string | null | undefined;
  email?: string | null | undefined;
}): Promise<EntitlementResult> {
  const { userId, email } = args;
  if (!userId) {
    return { allowed: false, reason: 'unauthenticated', subscription: null };
  }

  const lowerEmail = (email ?? '').toLowerCase();
  const owners = ownerEmails();
  if (lowerEmail && owners.has(lowerEmail)) {
    return { allowed: true, reason: 'owner', subscription: null };
  }

  const cfg = getBillingConfig();
  if (cfg.preLaunchOpen) {
    return { allowed: true, reason: 'pre_launch_open', subscription: null };
  }

  // No provider configured (or not ready) — without the pre-launch
  // open flag and without owner access, deny. The /upgrade page
  // separately surfaces "billing isn't wired yet" so the user knows
  // why they're hitting this gate.
  const service = getBillingService();
  if (!service) {
    return { allowed: false, reason: 'no_subscription', subscription: null };
  }

  let status;
  try {
    status = await service.getBillingStatusForUser(userId);
  } catch (err: any) {
    // Don't fail-closed on a transient billing-table read failure —
    // log loudly so monitoring catches it. We DO fail closed (the
    // gate denies) so that's still the conservative outcome; we just
    // don't crash the request.
    logger.error('Entitlement lookup failed', { userId, error: err?.message });
    return { allowed: false, reason: 'no_subscription', subscription: null };
  }

  if (!status.subscription) {
    return { allowed: false, reason: 'no_subscription', subscription: null };
  }

  const sub = status.subscription;
  const summary = {
    status: sub.status,
    plan: sub.plan,
    trialEndsAt: sub.trial_ends_at ? new Date(sub.trial_ends_at).toISOString() : null,
    renewsAt: sub.renews_at ? new Date(sub.renews_at).toISOString() : null,
    endsAt: sub.ends_at ? new Date(sub.ends_at).toISOString() : null,
  };

  if (status.isActive) {
    let reason: EntitlementReason;
    if (sub.status === 'on_trial') reason = 'trialing';
    else if (sub.status === 'cancelled') reason = 'cancelled_grace';
    else reason = 'active_subscription';
    return { allowed: true, reason, subscription: summary };
  }

  return {
    allowed: false,
    reason: 'no_active_subscription',
    subscription: summary,
  };
}

/**
 * Convenience wrapper that pulls the user from `req.user` (populated
 * by `authenticate` middleware). Returns a deny result if the request
 * isn't authenticated.
 */
export async function canUsePaidWorkspaceForReq(
  req: { user?: { userId?: string; email?: string | null } },
): Promise<EntitlementResult> {
  return canUsePaidWorkspace({
    userId: req.user?.userId ?? null,
    email: req.user?.email ?? null,
  });
}

export const __testHelpers = { ENTITLED_STATUSES };
