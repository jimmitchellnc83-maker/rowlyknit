import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import axios from 'axios'; // Uses globally configured axios from lib/axios

/**
 * Browser auth — cookie-only.
 *
 * After PR #389 final pass (2026-05-06), neither the access token nor
 * the refresh token reaches JS. Both are httpOnly + secure cookies set
 * by the backend on /api/auth/login (and /api/auth/refresh). axios runs
 * with `withCredentials: true` so those cookies travel with every
 * same-origin request automatically, no Bearer header required.
 *
 * What we DO persist locally is the user profile + isAuthenticated bit
 * so the app shell can render immediately without a layout flash on
 * page load. On hydration we still call /api/auth/refresh + /profile to
 * confirm the cookie is still valid; if it isn't, we wipe local state.
 *
 * Socket.IO uses cookie-auth too: socket.io-client connects with
 * `withCredentials: true` and the backend reads the `accessToken`
 * cookie out of the handshake header (see backend/src/config/socket.ts).
 * No JS-readable token is required for any in-app consumer.
 *
 * Why no JS bearer at all in the browser:
 *   - Same-origin cookies already authenticate every request.
 *   - An XSS payload that lands a script in our origin can read
 *     anything in `document.cookie`-readable storage and anything in
 *     in-memory globals. httpOnly cookies are the only place a JWT
 *     can sit where the payload can't see it. Returning the token in
 *     the JSON body, or storing it in zustand, gives that payload a
 *     handle on the user's session — that's the surface this closes.
 */

interface UserPreferences {
  theme?: string;
  notifications?: boolean;
  measurements?: {
    needleSizeFormat?: 'us' | 'metric' | 'uk';
    hookSizeFormat?: 'us' | 'metric' | 'uk';
    lengthDisplayUnit?: 'in' | 'cm' | 'mm';
    yarnLengthDisplayUnit?: 'yd' | 'm';
    weightDisplayUnit?: 'g' | 'oz';
    gaugeBase?: '4in' | '10cm';
    gaugeDetail?: 'per_base' | 'per_unit';
  };
}

/**
 * Subscription snapshot returned by `/api/auth/profile` — derived from
 * the latest `billing_subscriptions` row for this user. The frontend
 * `canUsePaidWorkspace` helper reads `subscription.status` to gate
 * paid-workspace operations. `null` when the user has never started a
 * checkout (the gate falls back to owner / pre-launch-open paths).
 */
export interface UserSubscription {
  status:
    | 'on_trial'
    | 'active'
    | 'paused'
    | 'past_due'
    | 'unpaid'
    | 'cancelled'
    | 'expired'
    | 'unknown'
    | string;
  plan: 'monthly' | 'annual' | null;
  trialEndsAt: string | null;
  renewsAt: string | null;
  endsAt: string | null;
}

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  emailVerified: boolean;
  preferences?: UserPreferences;
  subscription?: UserSubscription | null;
}

interface AuthState {
  user: User | null;
  /**
   * Always `null`. Retained as a field so any lingering reference
   * (component, devtool, third-party hook) reads `null` instead of
   * crashing — but no code path writes to it. Cookie-only auth means
   * there is no JS-side token to track.
   */
  accessToken: null;
  isAuthenticated: boolean;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  register: (data: any) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: User) => void;
  /**
   * No-op. Kept for backwards compatibility with the axios refresh
   * interceptor and any other call site that imports it; the new
   * cookie-only flow has nothing to set.
   */
  setToken: (token: string) => void;
  checkAuth: () => Promise<void>;
}

// One-shot legacy cleanup: previous versions of this store persisted
// `accessToken` to localStorage. After the cookie-first migration that
// blob is dead weight (and a small XSS surface). Strip it out of any
// existing entry BEFORE create(persist(...)) runs — otherwise persist
// hydrates the stale token into in-memory state on import, and the
// cleanup pass only fixes the on-disk copy. Codex caught this on PR
// #382 review (Sprint 383). The `merge` step in the persist config
// below is the belt-and-braces equivalent for any blob shape we miss.
if (typeof window !== 'undefined') {
  try {
    const raw = window.localStorage.getItem('rowly-auth');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.state && Object.prototype.hasOwnProperty.call(parsed.state, 'accessToken')) {
        delete parsed.state.accessToken;
        window.localStorage.setItem('rowly-auth', JSON.stringify(parsed));
      }
    }
  } catch {
    // localStorage may be disabled (Safari private mode etc.); nothing
    // to clean up if we can't read it.
  }
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,

      login: async (email: string, password: string, rememberMe?: boolean) => {
        const response = await axios.post('/api/auth/login', {
          email,
          password,
          rememberMe,
        });

        // Cookie-only flow: the response body intentionally does NOT
        // carry accessToken/refreshToken. The httpOnly cookies set by
        // the response authenticate every subsequent request including
        // the WebSocket handshake.
        const { user } = response.data.data;

        set({
          user,
          accessToken: null,
          isAuthenticated: true,
        });
      },

      register: async (data: any) => {
        await axios.post('/api/auth/register', data);
      },

      logout: async () => {
        try {
          await axios.post('/api/auth/logout');
        } catch (error) {
          console.error('Logout error:', error);
        } finally {
          set({
            user: null,
            accessToken: null,
            isAuthenticated: false,
          });
        }
      },

      setUser: (user: User) => {
        set({ user });
      },

      setToken: (_token: string) => {
        // No-op. The axios refresh interceptor still calls this for
        // backwards compatibility, but cookie-only auth has nothing to
        // track in memory — the new access cookie is set by the
        // /api/auth/refresh response and travels automatically.
      },

      checkAuth: async () => {
        // The persisted state only carries `user` + `isAuthenticated`;
        // both auth cookies are httpOnly so we can't see them from JS.
        // We POST /api/auth/refresh to confirm the refresh cookie is
        // still valid; success rotates a fresh access cookie in. If
        // either /refresh or /profile rejects, wipe local state.
        try {
          await axios.post('/api/auth/refresh', {});

          const profile = await axios.get('/api/auth/profile');
          const user = profile.data?.data?.user;
          if (user) {
            set({ user, isAuthenticated: true });
          }
        } catch (error) {
          console.error('Auth check failed:', error);
          set({
            user: null,
            accessToken: null,
            isAuthenticated: false,
          });
        }
      },
    }),
    {
      name: 'rowly-auth',
      // CRITICAL: do NOT include `accessToken` in this allowlist. The
      // access token must never leave memory. There's a regression
      // test in `authStore.test.ts` that pins this contract.
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
      // Defense-in-depth against the same Codex finding: even if a stale
      // blob survives the pre-create cleanup (different storage adapter,
      // race, whatever), drop `accessToken` while merging persisted →
      // in-memory state so it never enters the store.
      merge: (persisted, current) => {
        const safe = { ...(persisted as Record<string, unknown> | null) };
        if (safe && 'accessToken' in safe) {
          delete safe.accessToken;
        }
        return { ...current, ...(safe as Partial<AuthState>) };
      },
    }
  )
);

// On app load, if the persisted state thinks we're authenticated, hit
// /refresh to confirm the httpOnly cookie is still valid and get a
// fresh in-memory access token. If the user wasn't authenticated, do
// nothing (no point poking the API for a guest).
if (typeof window !== 'undefined') {
  const init = () => {
    const state = useAuthStore.getState();
    if (state.isAuthenticated) {
      state.checkAuth().catch((error) => {
        console.error('checkAuth failed on initialization:', error);
      });
    }
  };

  if ('requestIdleCallback' in window) {
    (window as any).requestIdleCallback(init);
  } else {
    setTimeout(init, 100);
  }
}
