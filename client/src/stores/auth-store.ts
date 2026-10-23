import { create } from 'zustand';
import { api } from '@/lib/api';
import { backupService } from '@/services/backupService';
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
  login: (token: string, user: User) => void;
  loginWithGoogle: (credential: string) => Promise<boolean>;
  loginWithQuickProfile: (email: string, full_name?: string, avatar_url?: string) => Promise<boolean>;
  logout: () => void;
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

  login: (token: string, user: User) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    set({ token, user, isAuthenticated: true });
    // Cloud sync restore for newly logged in account
    backupService.restoreFromServer().catch(() => {}).then(() => {
      useNoteStore.getState().loadNotes().catch(() => {});
    });
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
        backupService.restoreFromServer().catch(() => {}).then(() => {
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
        backupService.restoreFromServer().catch(() => {}).then(() => {
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

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('fm_quick_notes_cache');
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
