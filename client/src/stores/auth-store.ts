import { create } from 'zustand';
import { api } from '@/lib/api';
import { backupService } from '@/services/backupService';
import { switchDatabaseUser, idbGetAll, STORES } from '@/services/storage/indexedDb';
import { dataService } from '@/services/dataService';
import { useNoteStore } from './note-store';

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'manager' | 'staff' | 'merchandiser' | 'viewer';
  avatar_url?: string;
  google_id?: string;
}

export type AuthMode = 'local' | 'cloud';

const LEGACY_FAKE_TOKEN = 'cloud-web-session';

const getInitFlagKey = (userId?: string | null) =>
  `fm_workspace_initialized_${userId || 'local'}`;

function readInitialSession(): { token: string | null; user: User | null; authMode: AuthMode; isAuthenticated: boolean } {
  if (typeof localStorage === 'undefined') {
    return { token: null, user: null, authMode: 'local', isAuthenticated: false };
  }
  const storedToken = localStorage.getItem('token');
  const storedUser = localStorage.getItem('user');

  // Purge legacy hardcoded fake token to prevent 401s on real JWT endpoints
  if (storedToken === LEGACY_FAKE_TOKEN) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    return { token: null, user: null, authMode: 'local', isAuthenticated: false };
  }

  if (storedToken && storedUser) {
    try {
      const parsedUser = JSON.parse(storedUser) as User;
      if (parsedUser?.id) {
        return { token: storedToken, user: parsedUser, authMode: 'cloud', isAuthenticated: true };
      }
    } catch {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
  }

  return { token: null, user: null, authMode: 'local', isAuthenticated: false };
}

interface AuthState {
  user: User | null;
  token: string | null;
  authMode: AuthMode;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  clearError: () => void;
  login: (token: string, user: User) => Promise<void>;
  loginWithPassword: (email: string, password: string) => Promise<boolean>;
  register: (email: string, password: string, fullName: string) => Promise<boolean>;
  loginWithGoogle: (credential: string) => Promise<boolean>;
  loginWithQuickProfile: (email: string, full_name?: string, avatar_url?: string) => Promise<boolean>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  autoRestoreWorkspaceIfEmpty: () => Promise<void>;
}

const initialSession = readInitialSession();

export const useAuthStore = create<AuthState>((set, get) => {
  const applyAuthenticatedSession = async (token: string, user: User) => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
    }
    set({ token, user, authMode: 'cloud', isAuthenticated: true, isLoading: false, error: null });
    await switchDatabaseUser(user.id);
    await dataService.resetInitialized();
    await useNoteStore.getState().loadNotes().catch((err) => {
      console.warn('[AuthStore] Failed to reload notes after login:', err);
    });
  };

  return {
    user: initialSession.user,
    token: initialSession.token,
    authMode: initialSession.authMode,
    isAuthenticated: initialSession.isAuthenticated,
    isLoading: false,
    error: null,
    clearError: () => set({ error: null }),

    autoRestoreWorkspaceIfEmpty: async () => {
      try {
        const { isAuthenticated, token, user } = get();
        const initKey = getInitFlagKey(user?.id);

        // Never overwrite an already-initialized workspace (e.g. if user intentionally deleted all items)
        if (typeof localStorage !== 'undefined' && localStorage.getItem(initKey) === 'true') {
          return;
        }

        // Only auto-restore from server backup in authenticated Cloud Sync mode
        if (!isAuthenticated || !token) {
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem(initKey, 'true');
          }
          return;
        }

        const [existingNotes, existingLinks, existingAccounts, existingStores, existingActivities] = await Promise.all([
          idbGetAll<unknown>(STORES.NOTES).catch(() => []),
          idbGetAll<unknown>(STORES.LINKS).catch(() => []),
          idbGetAll<unknown>(STORES.ACCOUNTS).catch(() => []),
          idbGetAll<unknown>(STORES.STORES).catch(() => []),
          idbGetAll<unknown>(STORES.ACTIVITIES).catch(() => []),
        ]);

        const allStoresEmpty =
          existingNotes.length === 0 &&
          existingLinks.length === 0 &&
          existingAccounts.length === 0 &&
          existingStores.length === 0 &&
          existingActivities.length === 0;

        if (allStoresEmpty) {
          console.log('[AuthStore] First-time cloud workspace init: restoring from server backup...');
          await backupService.restoreFromServer().catch((err) => {
            console.warn('[AuthStore] Auto-restore warning:', err);
          });
          await useNoteStore.getState().loadNotes().catch((err) => {
            console.warn('[AuthStore] Failed to load notes after auto-restore:', err);
          });
        }

        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(initKey, 'true');
        }
      } catch (err) {
        console.warn('[AuthStore] Failed checking auto-restore:', err);
      }
    },

    login: async (token: string, user: User) => {
      await applyAuthenticatedSession(token, user);
    },

    loginWithPassword: async (email: string, password: string) => {
      try {
        set({ isLoading: true });
        const res = await api.post('/auth/login', { email, password });
        const { token, user } = res.data;
        if (token && user) {
          await applyAuthenticatedSession(token, user);
          return true;
        }
        set({ isLoading: false });
        return false;
      } catch (err) {
        set({ isLoading: false });
        throw err;
      }
    },

    register: async (email: string, password: string, fullName: string) => {
      try {
        set({ isLoading: true });
        const res = await api.post('/auth/register', { email, password, full_name: fullName });
        const { token, user } = res.data;
        if (token && user) {
          await applyAuthenticatedSession(token, user);
          return true;
        }
        set({ isLoading: false });
        return false;
      } catch (err) {
        set({ isLoading: false });
        throw err;
      }
    },

    loginWithGoogle: async (credential: string) => {
      try {
        set({ isLoading: true });
        const res = await api.post('/auth/google', { credential });
        const { token, user } = res.data;
        if (token && user) {
          await applyAuthenticatedSession(token, user);
          return true;
        }
        set({ isLoading: false });
        return false;
      } catch (err) {
        set({ isLoading: false });
        throw err;
      }
    },

    loginWithQuickProfile: async (email: string, full_name?: string, avatar_url?: string) => {
      try {
        set({ isLoading: true });
        const res = await api.post('/auth/quick-profile', { email, full_name, avatar_url });
        const { token, user } = res.data;
        if (token && user) {
          await applyAuthenticatedSession(token, user);
          return true;
        }
        set({ isLoading: false });
        return false;
      } catch (err) {
        set({ isLoading: false });
        throw err;
      }
    },

    logout: async () => {
      const hadToken = Boolean(get().token);
      if (hadToken) {
        await api.post('/auth/logout').catch((err) => {
          console.warn('[AuthStore] Logout request failed:', err);
        });
      }
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
      set({ token: null, user: null, authMode: 'local', isAuthenticated: false });
      await switchDatabaseUser(null);
      await dataService.resetInitialized();
      if (typeof window !== 'undefined') {
        window.location.reload();
      }
    },

    checkAuth: async () => {
      try {
        const session = readInitialSession();
        if (session.isAuthenticated && session.user && session.token) {
          set({
            token: session.token,
            user: session.user,
            authMode: 'cloud',
            isAuthenticated: true,
            isLoading: false,
          });
          await switchDatabaseUser(session.user.id);
          return;
        }

        set({
          token: null,
          user: null,
          authMode: 'local',
          isAuthenticated: false,
          isLoading: false,
        });
        await switchDatabaseUser(null);
      } catch (err) {
        console.warn('[AuthStore] checkAuth error, falling back to Local-First mode:', err);
        set({
          token: null,
          user: null,
          authMode: 'local',
          isAuthenticated: false,
          isLoading: false,
        });
        await switchDatabaseUser(null);
      }
    },
  };
});
