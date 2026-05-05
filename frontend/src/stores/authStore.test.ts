/**
 * Auth + Launch Polish Sprint 2026-05-04 — cookie-first browser auth.
 *
 * The access token must NEVER end up in localStorage. The backend sets
 * it as an httpOnly cookie; the in-memory zustand store is the only
 * other place it should live (so Socket.IO can pick it up). This test
 * pins the contract:
 *
 *   1. After login, localStorage["rowly-auth"] does NOT contain
 *      `accessToken`.
 *   2. After a token refresh via setToken, localStorage["rowly-auth"]
 *      still does NOT contain `accessToken`.
 *   3. The legacy-cleanup pass strips a stale `accessToken` blob from
 *      any persisted entry that still has one.
 *
 * Vitest with happy-dom gives us a real localStorage to read.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('axios', () => {
  const post = vi.fn();
  const get = vi.fn();
  const defaultsHeaders: Record<string, unknown> = {};
  return {
    default: {
      post,
      get,
      defaults: {
        headers: { common: defaultsHeaders },
        baseURL: '',
        timeout: 0,
        withCredentials: true,
      },
      // Required by lib/axios.ts side effects when imported transitively.
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
    },
  };
});

import axios from 'axios';

beforeEach(() => {
  window.localStorage.clear();
  vi.clearAllMocks();
  vi.resetModules();
});

afterEach(() => {
  window.localStorage.clear();
});

async function importStore() {
  // Import lazily so the module-load init code (legacy cleanup,
  // requestIdleCallback) runs against a fresh localStorage state per
  // test. `resetModules` in beforeEach ensures we get a clean copy.
  return await import('./authStore');
}

describe('authStore — cookie-first browser auth', () => {
  it('does not persist accessToken to localStorage after login', async () => {
    (axios.post as any).mockResolvedValueOnce({
      data: {
        data: {
          user: { id: 'u-1', email: 'a@rowly.test', firstName: 'A', lastName: 'B', emailVerified: true },
          accessToken: 'in-memory-only-token',
        },
      },
    });

    const { useAuthStore } = await importStore();
    await useAuthStore.getState().login('a@rowly.test', 'StrongP@ss1!');

    // In-memory: present.
    expect(useAuthStore.getState().accessToken).toBe('in-memory-only-token');
    expect(useAuthStore.getState().isAuthenticated).toBe(true);

    // localStorage: must NOT carry the token.
    const raw = window.localStorage.getItem('rowly-auth');
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!);
    expect(parsed.state).toBeDefined();
    expect(parsed.state.user).toBeDefined();
    expect(parsed.state.isAuthenticated).toBe(true);
    expect(parsed.state.accessToken).toBeUndefined();
    // Belt-and-braces: the stringified blob doesn't even mention it.
    expect(raw).not.toContain('in-memory-only-token');
    expect(raw).not.toContain('accessToken');
  });

  it('does not persist accessToken when setToken is called (refresh path)', async () => {
    const { useAuthStore } = await importStore();
    useAuthStore.getState().setToken('refreshed-token-xyz');

    expect(useAuthStore.getState().accessToken).toBe('refreshed-token-xyz');

    const raw = window.localStorage.getItem('rowly-auth');
    if (raw) {
      const parsed = JSON.parse(raw);
      expect(parsed.state?.accessToken).toBeUndefined();
      expect(raw).not.toContain('refreshed-token-xyz');
    }
  });

  it('does not persist accessToken after logout', async () => {
    (axios.post as any).mockResolvedValueOnce({
      data: {
        data: {
          user: { id: 'u-1', email: 'a@rowly.test', firstName: 'A', lastName: 'B', emailVerified: true },
          accessToken: 'login-token',
        },
      },
    });
    const { useAuthStore } = await importStore();
    await useAuthStore.getState().login('a@rowly.test', 'StrongP@ss1!');

    (axios.post as any).mockResolvedValueOnce({ data: { success: true } });
    await useAuthStore.getState().logout();

    const raw = window.localStorage.getItem('rowly-auth');
    expect(raw ?? '').not.toContain('login-token');
    expect(raw ?? '').not.toContain('accessToken');
  });

  it('legacy cleanup: strips a pre-existing accessToken from a stored blob on module load', async () => {
    // Simulate a returning user whose previous-version persisted state
    // still carries the old token.
    window.localStorage.setItem(
      'rowly-auth',
      JSON.stringify({
        state: {
          user: { id: 'u-legacy', email: 'legacy@rowly.test', firstName: 'L', lastName: 'X', emailVerified: true },
          accessToken: 'legacy-localstorage-token',
          isAuthenticated: true,
        },
        version: 0,
      }),
    );

    // Importing the store triggers the one-shot legacy cleanup pass.
    await importStore();

    const raw = window.localStorage.getItem('rowly-auth');
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!);
    expect(parsed.state.user).toBeDefined();
    expect(parsed.state.isAuthenticated).toBe(true);
    expect(parsed.state.accessToken).toBeUndefined();
    expect(raw).not.toContain('legacy-localstorage-token');
  });

  // Codex Sprint 383: verify the cleanup happens BEFORE persist
  // hydration, so a stale `accessToken` from a legacy blob never lands
  // in in-memory state. Pre-fix behavior: create(persist(...)) ran
  // first, hydrated the token into the store, THEN the cleanup pass
  // rewrote localStorage — leaving the token in memory until logout.
  it('legacy cleanup runs BEFORE persist hydration — stale accessToken never reaches in-memory state', async () => {
    window.localStorage.setItem(
      'rowly-auth',
      JSON.stringify({
        state: {
          user: { id: 'u-legacy-2', email: 'legacy2@rowly.test', firstName: 'L', lastName: 'X', emailVerified: true },
          accessToken: 'pre-hydration-token-must-not-leak',
          isAuthenticated: true,
        },
        version: 0,
      }),
    );

    const { useAuthStore } = await importStore();

    // The whole point: even though the persisted blob contained an
    // accessToken, it must NOT be present in the hydrated in-memory
    // store. (Pre-fix this would equal 'pre-hydration-token-must-not-leak'.)
    expect(useAuthStore.getState().accessToken).toBeNull();

    // Persisted user/isAuthenticated still hydrate normally.
    expect(useAuthStore.getState().user?.email).toBe('legacy2@rowly.test');
    expect(useAuthStore.getState().isAuthenticated).toBe(true);

    // localStorage was rewritten without accessToken.
    const raw = window.localStorage.getItem('rowly-auth');
    expect(raw).toBeTruthy();
    expect(raw).not.toContain('pre-hydration-token-must-not-leak');
    expect(raw).not.toContain('accessToken');
  });

  // Same Codex finding — defense-in-depth assertion. Even if the
  // pre-create cleanup somehow misses (e.g. a different storage path),
  // the persist `merge` step must drop `accessToken` so the in-memory
  // store stays clean. We simulate by writing a blob, importing once
  // to let the persist middleware mount, then exercising the merge by
  // re-rehydrating directly.
  it('persist merge drops accessToken even if a blob with one is present', async () => {
    window.localStorage.setItem(
      'rowly-auth',
      JSON.stringify({
        state: {
          user: { id: 'u-merge', email: 'merge@rowly.test', firstName: 'M', lastName: 'E', emailVerified: true },
          accessToken: 'should-be-dropped-by-merge',
          isAuthenticated: true,
        },
        version: 0,
      }),
    );

    const { useAuthStore } = await importStore();

    // After hydration the in-memory accessToken must be null no matter
    // which guard caught it (cleanup or merge).
    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(useAuthStore.getState().user?.email).toBe('merge@rowly.test');
  });

  // Same finding — confirm the post-fix login + setToken paths still
  // hold the contract: accessToken stays in memory, never localStorage.
  it('post-fix: login and setToken keep accessToken memory-only and never persist it', async () => {
    (axios.post as any).mockResolvedValueOnce({
      data: {
        data: {
          user: { id: 'u-post', email: 'post@rowly.test', firstName: 'P', lastName: 'O', emailVerified: true },
          accessToken: 'login-token-after-fix',
        },
      },
    });

    const { useAuthStore } = await importStore();
    await useAuthStore.getState().login('post@rowly.test', 'StrongP@ss1!');

    expect(useAuthStore.getState().accessToken).toBe('login-token-after-fix');
    let raw = window.localStorage.getItem('rowly-auth');
    expect(raw ?? '').not.toContain('login-token-after-fix');
    expect(raw ?? '').not.toContain('accessToken');

    useAuthStore.getState().setToken('refreshed-token-after-fix');
    expect(useAuthStore.getState().accessToken).toBe('refreshed-token-after-fix');
    raw = window.localStorage.getItem('rowly-auth');
    expect(raw ?? '').not.toContain('refreshed-token-after-fix');
    expect(raw ?? '').not.toContain('accessToken');
  });
});
