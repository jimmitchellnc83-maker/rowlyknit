import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import axios from 'axios'; // Uses globally configured axios from lib/axios

/**
 * Browser auth — cookie-first.
 *
 * After the Auth + Launch Polish Sprint (2026-05-04) the access token is
 * NEVER persisted to localStorage in the browser. Both the access token
 * and the refresh token live in httpOnly + secure cookies set by the
 * backend on /api/auth/login (and /api/auth/refresh). axios runs with
 * `withCredentials: true` so those cookies travel with every same-origin
 * request automatically, no Bearer header required.
 *
 * What we DO persist locally is the user profile + isAuthenticated bit
 * so the app shell can render immediately without a layout flash on
 * page load. On hydration we still call /api/auth/refresh + /profile to
 * confirm the cookie is still valid; if it isn't, we wipe local state.
 *
 * The in-memory `accessToken` is kept around for two non-browser
 * consumers:
 *   1. Socket.IO — connect-time auth payload `{ token: accessToken }`
 *      (httpOnly cookies don't reach the WebSocket handshake on every
 *      browser; the in-memory copy is the safest cross-browser path).
 *   2. Future API clients (mobile / scripts) that prefer Bearer.
 *
 * The Bearer-header path on axios was removed because:
 *   - Same-origin cookies already authenticate every request.
 *   - Setting `axios.defaults.headers.common.Authorization` from a
 *     persisted localStorage token is exactly the XSS exfil surface
 *     this sprint is closing.
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

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  emailVerified: boolean;
  preferences?: UserPreferences;
}

interface AuthState {
  user: User | null;
  /**
   * In-memory only. Lives for the duration of the JS context. Used by
   * the Socket.IO client and any future Bearer-preferring consumer.
   * NEVER written to localStorage.
   */
  accessToken: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  register: (data: any) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: User) => void;
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

        const { user, accessToken } = response.data.data;

        set({
          user,
          // In-memory only — for Socket.IO + non-browser consumers.
          accessToken,
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

      setToken: (token: string) => {
        // In-memory only — does NOT persist to localStorage. Called by
        // the axios refresh-on-401 interceptor with the new access token
        // returned in the /api/auth/refresh response body, so Socket.IO
        // can pick it up on its next connect.
        set({ accessToken: token });
      },

      checkAuth: async () => {
        // The persisted state only carries `user` + `isAuthenticated`;
        // the access cookie is httpOnly so we can't see it from JS. We
        // try to mint a fresh in-memory token via /api/auth/refresh
        // (which reads the refresh cookie) — if that succeeds we trust
        // the persisted user; if not, wipe everything.
        try {
          const refresh = await axios.post('/api/auth/refresh', {});
          const newToken = refresh.data?.data?.accessToken;
          if (newToken) {
            set({ accessToken: newToken });
          }

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
