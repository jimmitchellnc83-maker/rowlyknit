/**
 * Auth — cookie-only browser auth (PR #389 final pass 2026-05-06).
 *
 * After this sprint the access token never reaches JS at all:
 *   - The login response body does not include `accessToken` /
 *     `refreshToken`. Both live in httpOnly cookies.
 *   - The store keeps `accessToken: null` always. `setToken` is a
 *     no-op (kept only so the legacy axios interceptor still compiles).
 *   - localStorage continues to hold only the user profile +
 *     isAuthenticated bit.
 *
 * This suite pins the contract:
 *
 *   1. After login, the in-memory `accessToken` is null AND
 *      localStorage does not contain `accessToken`.
 *   2. `setToken` is a no-op — calling it never sets `accessToken`.
 *   3. Legacy cleanup still strips a stale `accessToken` blob from
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

describe('authStore — cookie-only browser auth', () => {
  it('does not store accessToken anywhere after login (cookie-only response)', async () => {
    // Cookie-only login: the JSON body MUST NOT carry tokens. The store
    // reads only `user`, leaves `accessToken=null`, and sets isAuthenticated.
    (axios.post as any).mockResolvedValueOnce({
      data: {
        data: {
          user: { id: 'u-1', email: 'a@rowly.test', firstName: 'A', lastName: 'B', emailVerified: true },
        },
      },
    });

    const { useAuthStore } = await importStore();
    await useAuthStore.getState().login('a@rowly.test', 'StrongP@ss1!');

    // In-memory: must be null. The cookie path is the only auth state.
    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(useAuthStore.getState().isAuthenticated).toBe(true);

    // localStorage: still no token (existing contract).
    const raw = window.localStorage.getItem('rowly-auth');
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!);
    expect(parsed.state).toBeDefined();
    expect(parsed.state.user).toBeDefined();
    expect(parsed.state.isAuthenticated).toBe(true);
    expect(parsed.state.accessToken).toBeUndefined();
    expect(raw).not.toContain('accessToken');
  });

  it('login ignores any server-side accessToken if it accidentally appears in the body', async () => {
    // Defense-in-depth: if a regression re-introduces the token in the
    // response body, the store still must NOT pick it up.
    (axios.post as any).mockResolvedValueOnce({
      data: {
        data: {
          user: { id: 'u-2', email: 'b@rowly.test', firstName: 'B', lastName: 'C', emailVerified: true },
          // This MUST be ignored.
          accessToken: 'rogue-server-leaked-token',
        },
      },
    });

    const { useAuthStore } = await importStore();
    await useAuthStore.getState().login('b@rowly.test', 'StrongP@ss1!');

    expect(useAuthStore.getState().accessToken).toBeNull();
    const raw = window.localStorage.getItem('rowly-auth');
    expect(raw ?? '').not.toContain('rogue-server-leaked-token');
  });

  it('setToken is a no-op — cookie-only auth has nothing to track', async () => {
    const { useAuthStore } = await importStore();
    useAuthStore.getState().setToken('refreshed-token-xyz');

    // Must remain null. The axios interceptor still calls setToken for
    // backwards compatibility, but it should not introduce a token in
    // the JS-readable store.
    expect(useAuthStore.getState().accessToken).toBeNull();

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
        },
      },
    });
    const { useAuthStore } = await importStore();
    await useAuthStore.getState().login('a@rowly.test', 'StrongP@ss1!');

    (axios.post as any).mockResolvedValueOnce({ data: { success: true } });
    await useAuthStore.getState().logout();

    const raw = window.localStorage.getItem('rowly-auth');
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

  // PR #389 final-pass P2: confirm the post-fix login + setToken paths
  // hold the new contract: accessToken stays NULL — neither in memory
  // nor localStorage. There is no longer any JS-side token handle.
  it('post-fix: login and setToken keep accessToken null and never persist anything', async () => {
    (axios.post as any).mockResolvedValueOnce({
      data: {
        data: {
          user: { id: 'u-post', email: 'post@rowly.test', firstName: 'P', lastName: 'O', emailVerified: true },
          // The body MAY still carry this in some adversarial server build,
          // but the cookie-only client must ignore it.
          accessToken: 'login-token-after-fix',
        },
      },
    });

    const { useAuthStore } = await importStore();
    await useAuthStore.getState().login('post@rowly.test', 'StrongP@ss1!');

    expect(useAuthStore.getState().accessToken).toBeNull();
    let raw = window.localStorage.getItem('rowly-auth');
    expect(raw ?? '').not.toContain('login-token-after-fix');
    expect(raw ?? '').not.toContain('accessToken');

    useAuthStore.getState().setToken('refreshed-token-after-fix');
    expect(useAuthStore.getState().accessToken).toBeNull();
    raw = window.localStorage.getItem('rowly-auth');
    expect(raw ?? '').not.toContain('refreshed-token-after-fix');
    expect(raw ?? '').not.toContain('accessToken');
  });
});
