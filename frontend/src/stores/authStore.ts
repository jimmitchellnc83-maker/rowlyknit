import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import axios from 'axios';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  emailVerified: boolean;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  register: (data: any) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: User) => void;
  setToken: (token: string) => void;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
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
          accessToken,
          isAuthenticated: true,
        });

        // Set axios default header
        axios.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
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

          delete axios.defaults.headers.common['Authorization'];
        }
      },

      setUser: (user: User) => {
        set({ user });
      },

      setToken: (token: string) => {
        set({ accessToken: token });
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      },

      checkAuth: async () => {
        const { accessToken } = get();

        if (!accessToken) {
          return;
        }

        try {
          axios.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;

          const response = await axios.get('/api/auth/profile');
          const { user } = response.data.data;

          set({
            user,
            isAuthenticated: true,
          });
        } catch (error) {
          console.error('Auth check failed:', error);
          set({
            user: null,
            accessToken: null,
            isAuthenticated: false,
          });

          delete axios.defaults.headers.common['Authorization'];
        }
      },
    }),
    {
      name: 'rowly-auth',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

// Initialize auth on app load
// Only run checkAuth in browser environment after hydration
if (typeof window !== 'undefined') {
  // Delay checkAuth to avoid blocking initial render
  Promise.resolve().then(() => {
    useAuthStore.getState().checkAuth();
  });
}
