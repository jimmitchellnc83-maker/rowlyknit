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
 *     paths and the founder smoke flows never get locked out).
 *   - `user.subscription.status` of `'active'` or `'trialing'` returns
 *     `allowed: true`. Today neither value is ever set — Sprint 2 wires
 *     the LS webhook to populate this column. Until then the only
 *     production-allowed path is `'owner'`.
 *   - `VITE_PRE_LAUNCH_OPEN=true` opens access to all logged-in users,
 *     intended ONLY for dev / staging / preview environments. The
 *     production env explicitly does NOT set this.
 *
 * The result's `reason` string is meant for debug overlays + analytics
 * (`upgrade_prompt_shown` props) — not user-facing copy. UI components
 * read `allowed` to decide whether to render the upgrade prompt or the
 * save destination picker.
 */

const OWNER_EMAILS_RAW = (import.meta.env.VITE_OWNER_EMAILS as
  | string
  | undefined) ?? '';

const OWNER_EMAILS = OWNER_EMAILS_RAW.split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

/**
 * Built-in fallback so the founder is never locked out by a missing
 * env var. Codepath: in production we set `VITE_OWNER_EMAILS` and this
 * fallback is redundant; in dev / first-run we want owner access to
 * "just work" without bootstrap config.
 */
const BUILTIN_OWNER = 'jimmitchellnc83@gmail.com';

const PRE_LAUNCH_OPEN =
  (import.meta.env.VITE_PRE_LAUNCH_OPEN as string | undefined) === 'true';

export type EntitlementReason =
  | 'unauthenticated'
  | 'owner'
  | 'admin'
  | 'active_subscription'
  | 'trialing'
  | 'pre_launch_open'
  | 'no_active_subscription';

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
   * Sprint 2 plug-in point. Lemon Squeezy webhook will keep this
   * synced via the `users` table; nothing populates it today.
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
  } | null;
  /** Reserved for Sprint 2 admin role. */
  role?: 'owner' | 'admin' | 'user' | null;
}

export function canUsePaidWorkspace(
  user: UserLike | null | undefined,
): EntitlementResult {
  if (!user || !user.email) {
    return { allowed: false, reason: 'unauthenticated' };
  }

  const email = user.email.toLowerCase();
  if (OWNER_EMAILS.includes(email) || email === BUILTIN_OWNER) {
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

  // Pre-launch escape hatch — dev/staging only. Production must not
  // set VITE_PRE_LAUNCH_OPEN=true. The presence of this flag is the
  // explicit, code-visible "you're bypassing the paywall" signal.
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
