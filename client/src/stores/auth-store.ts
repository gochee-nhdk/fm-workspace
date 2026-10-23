import { create } from 'zustand';
import { api } from '@/lib/api';
import { backupService } from '@/services/backupService';
import { switchDatabaseUser } from '@/services/storage/indexedDb';
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
}

export const useAuthStore = create<AuthState>((set) => ({
  user: (() => {
    try {
      const stored = localStorage.getItem('user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  })(),
  token: localStorage.getItem('token'),
  isAuthenticated: !!localStorage.getItem('token'),
  isLoading: false,

  login: async (token: string, user: User) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    set({ token, user, isAuthenticated: true });

    // 1. Switch client-side storage to this user's isolated partition
    await switchDatabaseUser(user.id);
    await dataService.resetInitialized();

    // 2. Wipe previous in-memory notes and reload from isolated partition
    useNoteStore.setState({ notes: [], activeNoteId: null, activeTextNoteId: null, activeChecklistId: null });

    // 3. Restore user's private cloud workspace data
    backupService.restoreFromServer().catch(() => {}).finally(() => {
      useNoteStore.getState().loadNotes().catch(() => {});
    });
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

        // Switch to user's isolated storage
        await switchDatabaseUser(user.id);
        await dataService.resetInitialized();
        useNoteStore.setState({ notes: [], activeNoteId: null, activeTextNoteId: null, activeChecklistId: null });

        backupService.restoreFromServer().catch(() => {}).finally(() => {
          useNoteStore.getState().loadNotes().catch(() => {});
        });
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

        // Switch to newly created user's isolated storage
        await switchDatabaseUser(user.id);
        await dataService.resetInitialized();
        useNoteStore.setState({ notes: [], activeNoteId: null, activeTextNoteId: null, activeChecklistId: null });

        backupService.restoreFromServer().catch(() => {}).finally(() => {
          useNoteStore.getState().loadNotes().catch(() => {});
        });
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

        await switchDatabaseUser(user.id);
        await dataService.resetInitialized();
        useNoteStore.setState({ notes: [], activeNoteId: null, activeTextNoteId: null, activeChecklistId: null });

        backupService.restoreFromServer().catch(() => {}).finally(() => {
          useNoteStore.getState().loadNotes().catch(() => {});
        });
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

        // Restore user's private cloud workspace data
        await switchDatabaseUser(user.id);
        await dataService.resetInitialized();
        useNoteStore.setState({ notes: [], activeNoteId: null, activeTextNoteId: null, activeChecklistId: null });

        backupService.restoreFromServer().catch(() => {}).finally(() => {
          useNoteStore.getState().loadNotes().catch(() => {});
        });
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
    try {
      await api.post('/auth/logout').catch(() => {});
    } catch (_) {}
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('fm_quick_notes_cache');
    await switchDatabaseUser(null);
    useNoteStore.setState({ notes: [], activeNoteId: null, activeTextNoteId: null, activeChecklistId: null });
    set({ token: null, user: null, isAuthenticated: false });
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  },

  checkAuth: async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      set({ isAuthenticated: false, user: null });
      return;
    }

    try {
      set({ isLoading: true });
      const res = await api.get('/auth/me');
      const user = res.data?.data || res.data?.user || (res.data?.id ? res.data : null);
      if (user && user.id) {
        localStorage.setItem('user', JSON.stringify(user));
        set({ user, isAuthenticated: true, isLoading: false });
      } else {
        set({ isAuthenticated: false, user: null, isLoading: false });
      }
    } catch {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      set({ token: null, user: null, isAuthenticated: false, isLoading: false });
    }
  }
}));
