/**
 * Tests for canUsePaidWorkspace — entitlement gate.
 *
 * Covers, after the PR #389 review pass:
 *   - unauthenticated → false
 *   - owner allowlist via `VITE_OWNER_EMAIL` (case-insensitive,
 *     comma-separated) → true
 *   - NO hardcoded founder fallback (the previous BUILTIN_OWNER
 *     constant was dropped in the review fix; the founder is denied
 *     when `VITE_OWNER_EMAIL` is empty)
 *   - admin role → true
 *   - subscription status active / on_trial / trialing → true
 *   - canceled / expired / null → false (without override)
 *   - pre-launch open via `VITE_BILLING_PRE_LAUNCH_OPEN=true` → true
 *   - production-default = no_active_subscription
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('canUsePaidWorkspace', () => {
  let originalImportMeta: ImportMetaEnv;

  beforeEach(() => {
    originalImportMeta = { ...import.meta.env };
    // Wipe entitlement-relevant env BETWEEN cases so the previous
    // test's setup never leaks. Each case opts into the env it needs.
    delete (import.meta.env as Record<string, unknown>).VITE_OWNER_EMAIL;
    delete (import.meta.env as Record<string, unknown>).VITE_BILLING_PRE_LAUNCH_OPEN;
    vi.resetModules();
  });

  afterEach(() => {
    Object.assign(import.meta.env, originalImportMeta);
    vi.resetModules();
  });

  async function loadFresh() {
    return await import('../entitlement');
  }

  it('returns unauthenticated when user is null', async () => {
    const { canUsePaidWorkspace } = await loadFresh();
    expect(canUsePaidWorkspace(null)).toEqual({
      allowed: false,
      reason: 'unauthenticated',
    });
  });

  it('returns unauthenticated when user has no email', async () => {
    const { canUsePaidWorkspace } = await loadFresh();
    expect(canUsePaidWorkspace({})).toEqual({
      allowed: false,
      reason: 'unauthenticated',
    });
    expect(canUsePaidWorkspace({ email: '' })).toEqual({
      allowed: false,
      reason: 'unauthenticated',
    });
  });

  it('returns owner=true for emails listed in VITE_OWNER_EMAIL (case-insensitive)', async () => {
    (import.meta.env as Record<string, unknown>).VITE_OWNER_EMAIL =
      'jimmitchellnc83@gmail.com, ops@rowly.test';
    const { canUsePaidWorkspace } = await loadFresh();
    expect(canUsePaidWorkspace({ email: 'jimmitchellnc83@gmail.com' })).toEqual({
      allowed: true,
      reason: 'owner',
    });
    expect(canUsePaidWorkspace({ email: 'JimMitchellNc83@Gmail.com' })).toEqual({
      allowed: true,
      reason: 'owner',
    });
    expect(canUsePaidWorkspace({ email: 'ops@rowly.test' })).toEqual({
      allowed: true,
      reason: 'owner',
    });
  });

  it('does NOT treat the founder email as owner when VITE_OWNER_EMAIL is empty', async () => {
    // PR #389 review fix: the hardcoded BUILTIN_OWNER fallback shipped
    // a literal email in the bundle. We dropped it. With no env-set
    // allowlist the founder gets the default `no_active_subscription`
    // result like anyone else.
    const { canUsePaidWorkspace } = await loadFresh();
    expect(canUsePaidWorkspace({ email: 'jimmitchellnc83@gmail.com' })).toEqual({
      allowed: false,
      reason: 'no_active_subscription',
    });
  });

  it('returns admin=true when user.role is admin', async () => {
    const { canUsePaidWorkspace } = await loadFresh();
    expect(
      canUsePaidWorkspace({ email: 'staff@rowly.test', role: 'admin' }),
    ).toEqual({ allowed: true, reason: 'admin' });
  });

  it('returns active_subscription when subscription.status is active', async () => {
    const { canUsePaidWorkspace } = await loadFresh();
    expect(
      canUsePaidWorkspace({
        email: 'paid@rowly.test',
        subscription: { status: 'active' },
      }),
    ).toEqual({ allowed: true, reason: 'active_subscription' });
  });

  it('returns trialing when subscription.status is trialing', async () => {
    const { canUsePaidWorkspace } = await loadFresh();
    expect(
      canUsePaidWorkspace({
        email: 'trial@rowly.test',
        subscription: { status: 'trialing' },
      }),
    ).toEqual({ allowed: true, reason: 'trialing' });
  });

  it('returns trialing when subscription.status is on_trial (LS normalized)', async () => {
    const { canUsePaidWorkspace } = await loadFresh();
    expect(
      canUsePaidWorkspace({
        email: 'trial@rowly.test',
        subscription: { status: 'on_trial' },
      }),
    ).toEqual({ allowed: true, reason: 'trialing' });
  });

  it('denies expired / paused / null subscriptions without owner role', async () => {
    const { canUsePaidWorkspace } = await loadFresh();
    for (const status of ['expired', 'paused', null] as const) {
      expect(
        canUsePaidWorkspace({
          email: 'lapsed@rowly.test',
          subscription: { status },
        }),
      ).toEqual({ allowed: false, reason: 'no_active_subscription' });
    }
  });

  // PR #389 P2 cancelled-grace policy. Mirrors the backend
  // `isEntitledNow` helper. The frontend can apply the date check
  // locally because `endsAt` is part of the user.subscription snapshot
  // returned by /api/auth/profile.
  describe('cancelled-grace policy', () => {
    const NOW = new Date('2026-05-06T12:00:00Z');

    it('keeps access for status=cancelled when endsAt is in the future', async () => {
      const { canUsePaidWorkspace } = await loadFresh();
      const future = new Date('2026-06-01T00:00:00Z').toISOString();
      expect(
        canUsePaidWorkspace(
          { email: 'grace@rowly.test', subscription: { status: 'cancelled', endsAt: future } },
          NOW,
        ),
      ).toEqual({ allowed: true, reason: 'cancelled_grace' });
    });

    it('also accepts the US-spelling status=canceled', async () => {
      const { canUsePaidWorkspace } = await loadFresh();
      const future = new Date('2026-06-01T00:00:00Z').toISOString();
      expect(
        canUsePaidWorkspace(
          { email: 'grace@rowly.test', subscription: { status: 'canceled', endsAt: future } },
          NOW,
        ),
      ).toEqual({ allowed: true, reason: 'cancelled_grace' });
    });

    it('denies status=cancelled when endsAt is in the past', async () => {
      const { canUsePaidWorkspace } = await loadFresh();
      const past = new Date('2026-04-01T00:00:00Z').toISOString();
      expect(
        canUsePaidWorkspace(
          { email: 'lapsed@rowly.test', subscription: { status: 'cancelled', endsAt: past } },
          NOW,
        ),
      ).toEqual({ allowed: false, reason: 'no_active_subscription' });
    });

    it('denies status=cancelled when endsAt is null', async () => {
      const { canUsePaidWorkspace } = await loadFresh();
      expect(
        canUsePaidWorkspace(
          { email: 'lapsed@rowly.test', subscription: { status: 'cancelled', endsAt: null } },
          NOW,
        ),
      ).toEqual({ allowed: false, reason: 'no_active_subscription' });
    });

    it('denies status=cancelled when endsAt is missing entirely', async () => {
      const { canUsePaidWorkspace } = await loadFresh();
      expect(
        canUsePaidWorkspace(
          { email: 'lapsed@rowly.test', subscription: { status: 'cancelled' } },
          NOW,
        ),
      ).toEqual({ allowed: false, reason: 'no_active_subscription' });
    });

    it('cancelledGraceActive helper applies the date check directly', async () => {
      const { cancelledGraceActive } = await loadFresh();
      const future = new Date(NOW.getTime() + 24 * 60 * 60 * 1000).toISOString();
      const past = new Date(NOW.getTime() - 24 * 60 * 60 * 1000).toISOString();
      expect(cancelledGraceActive(future, NOW)).toBe(true);
      expect(cancelledGraceActive(past, NOW)).toBe(false);
      expect(cancelledGraceActive(null, NOW)).toBe(false);
      expect(cancelledGraceActive('not-a-date', NOW)).toBe(false);
    });
  });

  it('denies a vanilla logged-in user when no env override is set', async () => {
    const { canUsePaidWorkspace } = await loadFresh();
    expect(canUsePaidWorkspace({ email: 'newuser@rowly.test' })).toEqual({
      allowed: false,
      reason: 'no_active_subscription',
    });
  });

  it('opens access when VITE_BILLING_PRE_LAUNCH_OPEN=true (mirrors backend)', async () => {
    (import.meta.env as Record<string, unknown>).VITE_BILLING_PRE_LAUNCH_OPEN = 'true';
    const { canUsePaidWorkspace } = await loadFresh();
    expect(canUsePaidWorkspace({ email: 'random@rowly.test' })).toEqual({
      allowed: true,
      reason: 'pre_launch_open',
    });
  });

  it('owner override takes precedence over pre-launch flag', async () => {
    (import.meta.env as Record<string, unknown>).VITE_OWNER_EMAIL = 'owner@rowly.test';
    (import.meta.env as Record<string, unknown>).VITE_BILLING_PRE_LAUNCH_OPEN = 'true';
    const { canUsePaidWorkspace } = await loadFresh();
    expect(canUsePaidWorkspace({ email: 'owner@rowly.test' })).toEqual({
      allowed: true,
      reason: 'owner',
    });
  });

  it('exposes no_subscription as a valid EntitlementReason for backend parity', async () => {
    // The backend gate returns `no_subscription` when a user has
    // never transacted (no billing_subscriptions row). Frontend code
    // that surfaces server-driven reasons (UpgradePage, analytics
    // events) must accept the string. We only need a type assignment
    // test — the value never originates client-side.
    const { canUsePaidWorkspace: _gate } = await loadFresh();
    type Reason = ReturnType<typeof _gate>['reason'];
    const fromServer: Reason = 'no_subscription';
    expect(fromServer).toBe('no_subscription');
  });

  it('isEntitled returns the .allowed bool', async () => {
    (import.meta.env as Record<string, unknown>).VITE_OWNER_EMAIL =
      'jimmitchellnc83@gmail.com';
    const { isEntitled } = await loadFresh();
    expect(isEntitled(null)).toBe(false);
    expect(isEntitled({ email: 'jimmitchellnc83@gmail.com' })).toBe(true);
    expect(isEntitled({ email: 'random@rowly.test' })).toBe(false);
  });
});
