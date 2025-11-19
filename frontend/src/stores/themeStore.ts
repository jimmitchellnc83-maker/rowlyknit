import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Theme = 'light' | 'dark';

interface ThemeState {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: 'light',

      toggleTheme: () => {
        set((state) => {
          const newTheme = state.theme === 'light' ? 'dark' : 'light';
          applyTheme(newTheme);
          return { theme: newTheme };
        });
      },

      setTheme: (theme: Theme) => {
        applyTheme(theme);
        set({ theme });
      },
    }),
    {
      name: 'rowly-theme',
      onRehydrateStorage: () => (state) => {
        // Apply theme after rehydration
        if (state?.theme) {
          applyTheme(state.theme);
        }
      },
    }
  )
);

// Helper function to apply theme to document
function applyTheme(theme: Theme) {
  const root = window.document.documentElement;

  if (theme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

// Initialize theme on load
const { theme } = useThemeStore.getState();
applyTheme(theme);
