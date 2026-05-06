/**
 * Provider-agnostic entitlement gate for paid workspace operations.
 *
 * Sprint 1 of the Public Tools Conversion engine. Lemon Squeezy / any
 * other billing provider plugs in at the `user.subscription.status`
 * read below — this function never speaks to the provider directly,
 * which keeps the UI free of any one vendor's SDK and makes it cheap
 * to swap providers (or run a free-internal-grant period during
 * launch) by toggling env without touching component code.
 *
 * The contract:
 *   - Public tools (calculate / show result / read help docs) DO NOT
 *     call this. They are free regardless of entitlement.
 *   - Save / attach to workspace (project / stash / pattern / Make
 *     Mode) MUST gate on `canUsePaidWorkspace(user).allowed === true`.
 *
 * Production rules (explicit):
 *   - Owner email allowlist always returns `allowed: true` (so support
 *     paths and the founder smoke flows never get locked out). The
 *     allowlist comes from `VITE_OWNER_EMAIL` (comma-separated) — the
 *     frontend mirror of the backend `OWNER_EMAIL` env var. There is
 *     NO hardcoded founder email fallback: shipping a literal email in
 *     the bundle would leak PII to anyone who downloaded the JS, and
 *     it would silently keep the founder logged in even when the env
 *     var is intentionally cleared (e.g. handoff to a new owner).
 *   - `user.subscription.status` of `'active'` or `'trialing'` returns
 *     `allowed: true`. Today neither value is ever set — Sprint 2 wires
 *     the LS webhook to populate this column. Until then the only
 *     production-allowed paths are owner / pre-launch.
 *   - `user.subscription.status === 'cancelled'` keeps `allowed: true`
 *     while `endsAt` is in the future (the LS-style "you keep access
 *     through what you've already paid for" grace). Falls to denied
 *     once `endsAt` lapses — at which point LS sends
 *     `subscription_expired` and the row's `status` flips to
 *     `expired`. Mirrors the backend `isEntitledNow` policy.
 *   - `VITE_BILLING_PRE_LAUNCH_OPEN=true` opens access to all
 *     logged-in users. Mirrors the backend `BILLING_PRE_LAUNCH_OPEN`
 *     so the two surfaces agree. Intended for dev / staging / preview
 *     environments AND the brief window between deploying the billing
 *     surface and provisioning the real provider; production must
 *     flip this to `false` once the trial flow is live.
 *
 * The result's `reason` string is meant for debug overlays + analytics
 * (`upgrade_prompt_shown` props) — not user-facing copy. UI components
 * read `allowed` to decide whether to render the upgrade prompt or the
 * save destination picker.
 */

const OWNER_EMAILS_RAW = (import.meta.env.VITE_OWNER_EMAIL as
  | string
  | undefined) ?? '';

const OWNER_EMAILS = OWNER_EMAILS_RAW.split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

const PRE_LAUNCH_OPEN =
  (import.meta.env.VITE_BILLING_PRE_LAUNCH_OPEN as string | undefined) === 'true';

export type EntitlementReason =
  | 'unauthenticated'
  | 'owner'
  | 'admin'
  | 'active_subscription'
  | 'trialing'
  | 'cancelled_grace'
  | 'pre_launch_open'
  | 'no_active_subscription'
  | 'no_subscription';

export interface EntitlementResult {
  allowed: boolean;
  reason: EntitlementReason;
}

/**
 * Subset of the user shape this gate reads. Kept intentionally minimal
 * so test harnesses don't have to construct a full `User` object.
 */
export interface UserLike {
  email?: string | null;
  /**
   * Sprint 2 plug-in point. Lemon Squeezy webhook keeps this synced
   * via the `users` table. `endsAt` is consulted only when status is
   * `cancelled` — it's the paid-through date and gates the grace
   * window.
   */
  subscription?: {
    status?:
      | 'active'
      | 'on_trial'
      | 'trialing'
      | 'paused'
      | 'past_due'
      | 'unpaid'
      | 'cancelled'
      | 'canceled'
      | 'expired'
      | 'unknown'
      | string
      | null;
    endsAt?: string | null;
  } | null;
  /** Reserved for Sprint 2 admin role. */
  role?: 'owner' | 'admin' | 'user' | null;
}

/**
 * Frontend mirror of the backend `isEntitledNow` policy. Pure helper —
 * exported so the AccountBillingPage can branch on the cancelled-grace
 * state for copy purposes without re-implementing the date check.
 *
 * `now` is injectable so tests can pin the clock.
 */
export function cancelledGraceActive(
  endsAt: string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!endsAt) return false;
  const ts = Date.parse(endsAt);
  if (Number.isNaN(ts)) return false;
  return ts > now.getTime();
}

export function canUsePaidWorkspace(
  user: UserLike | null | undefined,
  now: Date = new Date(),
): EntitlementResult {
  if (!user || !user.email) {
    return { allowed: false, reason: 'unauthenticated' };
  }

  const email = user.email.toLowerCase();
  if (OWNER_EMAILS.includes(email)) {
    return { allowed: true, reason: 'owner' };
  }

  if (user.role === 'admin') {
    return { allowed: true, reason: 'admin' };
  }

  // Billing plug-in point — the only place a billing provider ever
  // touches the UI. Read-only: the webhook is what writes this.
  // `on_trial` is the Lemon Squeezy normalised value; `trialing` is
  // accepted as a synonym for forwards-compat with other providers.
  const sub = user.subscription?.status ?? null;
  if (sub === 'active') return { allowed: true, reason: 'active_subscription' };
  if (sub === 'on_trial' || sub === 'trialing') {
    return { allowed: true, reason: 'trialing' };
  }

  // Cancelled-grace: the user has cancelled but still has paid-through
  // access until `endsAt`. Once `endsAt` is in the past, LS sends
  // `subscription_expired` and the row's status flips — we fall
  // through to the denial branch below.
  if ((sub === 'cancelled' || sub === 'canceled')
      && cancelledGraceActive(user.subscription?.endsAt, now)) {
    return { allowed: true, reason: 'cancelled_grace' };
  }

  // Pre-launch escape hatch — dev/staging only. Production must not
  // set VITE_BILLING_PRE_LAUNCH_OPEN=true once trials are live. The
  // presence of this flag is the explicit, code-visible "you're
  // bypassing the paywall" signal.
  if (PRE_LAUNCH_OPEN) {
    return { allowed: true, reason: 'pre_launch_open' };
  }

  return { allowed: false, reason: 'no_active_subscription' };
}

/**
 * Convenience for components that just need a boolean. Equivalent to
 * `canUsePaidWorkspace(user).allowed`.
 */
export function isEntitled(user: UserLike | null | undefined): boolean {
  return canUsePaidWorkspace(user).allowed;
}
