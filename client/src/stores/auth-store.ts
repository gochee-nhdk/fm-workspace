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

const DEFAULT_USER: User = {
  id: 'c437ea5f-ca2b-46c8-91f1-d6904f67929b',
  email: 'admin@farmersmarket.vn',
  full_name: 'Quản Trị Viên FM Workspace',
  role: 'admin',
};

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (token: string, user: User) => Promise<void>;
  loginWithPassword: (email: string, password: string) => Promise<boolean>;
  register: (email: string, password: string, fullName: string) => Promise<boolean>;
  loginWithGoogle: (credential: string) => Promise<boolean>;
  loginWithQuickProfile: (email: string, full_name?: string, avatar_url?: string) => Promise<boolean>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  autoRestoreWorkspaceIfEmpty: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: DEFAULT_USER,
  token: (typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null) || 'cloud-web-session',
  isAuthenticated: true,
  isLoading: false,

  autoRestoreWorkspaceIfEmpty: async () => {
    try {
      const existingNotes = await idbGetAll<any>(STORES.NOTES).catch(() => []);
      const existingLinks = await idbGetAll<any>(STORES.LINKS).catch(() => []);
      
      // If IndexedDB currently has no notes or links, restore from the full server backup automatically
      if (existingNotes.length === 0 || existingLinks.length === 0) {
        console.log('[AuthStore] Phục hồi toàn diện dữ liệu làm việc từ két sao lưu máy chủ...');
        await backupService.restoreFromServer().catch((err) => {
          console.warn('[AuthStore] Auto-restore warning:', err);
        });
        await useNoteStore.getState().loadNotes().catch(() => {});
      }
    } catch (err) {
      console.warn('[AuthStore] Failed checking auto-restore:', err);
    }
  },

  login: async (token: string, user: User) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    set({ token, user, isAuthenticated: true });
    await switchDatabaseUser(null);
    await dataService.resetInitialized();
    useNoteStore.getState().loadNotes().catch(() => {});
  },

  loginWithPassword: async (email: string, password: string) => {
    try {
      set({ isLoading: true });
      const res = await api.post('/auth/login', { email, password });
      const { token, user } = res.data;
      if (token && user) {
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
        set({ token, user, isAuthenticated: true, isLoading: false });
        await switchDatabaseUser(null);
        await dataService.resetInitialized();
        useNoteStore.getState().loadNotes().catch(() => {});
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
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
        set({ token, user, isAuthenticated: true, isLoading: false });
        await switchDatabaseUser(null);
        await dataService.resetInitialized();
        useNoteStore.getState().loadNotes().catch(() => {});
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
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
        set({ token, user, isAuthenticated: true, isLoading: false });
        await switchDatabaseUser(null);
        await dataService.resetInitialized();
        useNoteStore.getState().loadNotes().catch(() => {});
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
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
        set({ token, user, isAuthenticated: true, isLoading: false });
        await switchDatabaseUser(null);
        await dataService.resetInitialized();
        useNoteStore.getState().loadNotes().catch(() => {});
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
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    set({ token: 'cloud-web-session', user: DEFAULT_USER, isAuthenticated: true });
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  },

  checkAuth: async () => {
    try {
      const storedUser = typeof localStorage !== 'undefined' ? localStorage.getItem('user') : null;
      const storedToken = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;
      if (storedToken && storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser);
          set({ token: storedToken, user: parsedUser, isAuthenticated: true, isLoading: false });
          return;
        } catch (_) {}
      }
      set({ token: storedToken || 'cloud-web-session', user: DEFAULT_USER, isAuthenticated: true, isLoading: false });
    } catch {
      set({ token: 'cloud-web-session', user: DEFAULT_USER, isAuthenticated: true, isLoading: false });
    }
  }
}));