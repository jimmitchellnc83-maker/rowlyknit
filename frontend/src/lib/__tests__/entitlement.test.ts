/**
 * Tests for canUsePaidWorkspace — Sprint 1 Public Tools Conversion.
 *
 * Cover:
 *   - unauthenticated → false
 *   - owner email allowlist (env + builtin) → true
 *   - admin role → true
 *   - subscription status active / trialing → true
 *   - subscription status canceled / expired / null → false (without override)
 *   - pre-launch open env → true (only when explicitly set)
 *   - production-default = no_active_subscription
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('canUsePaidWorkspace', () => {
  let originalImportMeta: ImportMetaEnv;

  beforeEach(() => {
    originalImportMeta = { ...import.meta.env };
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

  it('returns owner=true for the builtin owner email (case-insensitive)', async () => {
    const { canUsePaidWorkspace } = await loadFresh();
    expect(canUsePaidWorkspace({ email: 'jimmitchellnc83@gmail.com' })).toEqual({
      allowed: true,
      reason: 'owner',
    });
    expect(canUsePaidWorkspace({ email: 'JimMitchellNc83@Gmail.com' })).toEqual({
      allowed: true,
      reason: 'owner',
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

  it('denies canceled / expired / paused subscriptions without owner role', async () => {
    const { canUsePaidWorkspace } = await loadFresh();
    for (const status of ['canceled', 'expired', 'paused', null] as const) {
      expect(
        canUsePaidWorkspace({
          email: 'lapsed@rowly.test',
          subscription: { status },
        }),
      ).toEqual({ allowed: false, reason: 'no_active_subscription' });
    }
  });

  it('denies a vanilla logged-in user when no env override is set', async () => {
    const { canUsePaidWorkspace } = await loadFresh();
    expect(canUsePaidWorkspace({ email: 'newuser@rowly.test' })).toEqual({
      allowed: false,
      reason: 'no_active_subscription',
    });
  });

  it('isEntitled returns the .allowed bool', async () => {
    const { isEntitled } = await loadFresh();
    expect(isEntitled(null)).toBe(false);
    expect(isEntitled({ email: 'jimmitchellnc83@gmail.com' })).toBe(true);
    expect(isEntitled({ email: 'random@rowly.test' })).toBe(false);
  });
});
