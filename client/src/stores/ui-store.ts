import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'light' | 'dark' | 'auto_time' | 'system';

interface UiState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  getResolvedTheme: () => 'light' | 'dark';
}

/** Detect OS-level dark mode preference */
const getSystemPreference = (): 'light' | 'dark' => {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
};

/**
 * Time-based theme: auto dark between 18:00 – 06:00 (evening/night/early morning)
 * light between 06:00 – 18:00
 */
export const getTimeBasedTheme = (): 'light' | 'dark' => {
  const hour = new Date().getHours();
  // Dark: 18:00 (6 pm) to 06:00 (6 am)
  return hour >= 18 || hour < 6 ? 'dark' : 'light';
};

/**
 * Resolve effective theme given user preference.
 * 'auto_time' → follow daytime/nighttime (06:00 - 18:00 light, 18:00 - 06:00 dark)
 * 'system' → follow OS preference
 * 'light' / 'dark' → respect explicit user choice
 */
export const resolveTheme = (theme: Theme): 'light' | 'dark' => {
  if (theme === 'auto_time') return getTimeBasedTheme();
  if (theme === 'system') return getSystemPreference();
  return theme;
};

export const useUiStore = create<UiState>()(
  persist(
    (set, get) => ({
      // Default: follow system
      theme: 'system' as Theme,

      setTheme: (theme) => set({ theme }),

      toggleTheme: () =>
        set((state) => {
          const resolved = resolveTheme(state.theme);
          return { theme: resolved === 'dark' ? 'light' : 'dark' };
        }),

      getResolvedTheme: () => resolveTheme(get().theme),
    }),
    {
      name: 'fm-ui-preferences',
      partialize: (state) => ({ theme: state.theme }),
    }
  )
);