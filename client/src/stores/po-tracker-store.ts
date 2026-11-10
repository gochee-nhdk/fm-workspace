import { create } from 'zustand';
import {
  POTrackerPO,
  POFolderItem,
  POTrackerStats,
  POStatus,
  POFilterStatus,
} from '@/types/po-tracker';

interface POTrackerState {
  folders: POFolderItem[];
  pos: POTrackerPO[];
  stats: POTrackerStats | null;
  activeFolderId: string | null; // null = "Tất cả"
  activeStatus: POFilterStatus | null;
  search: string;
  loading: boolean;
  detailPO: POTrackerPO | null;
  detailLoading: boolean;

  // Actions
  setFolders: (folders: POFolderItem[]) => void;
  setPos: (pos: POTrackerPO[]) => void;
  setStats: (stats: POTrackerStats) => void;
  setActiveFolderId: (id: string | null) => void;
  setActiveStatus: (status: POFilterStatus | null) => void;
  setSearch: (q: string) => void;
  setLoading: (v: boolean) => void;
  setDetailPO: (po: POTrackerPO | null) => void;
  setDetailLoading: (v: boolean) => void;

  // Optimistic mutations
  updatePOInList: (id: string, patch: Partial<POTrackerPO>) => void;
  removePOFromList: (id: string) => void;
  addPOToList: (po: POTrackerPO) => void;
  updateFolderInList: (id: string, patch: Partial<POFolderItem>) => void;
  removeFolderFromList: (id: string) => void;
  addFolderToList: (folder: POFolderItem) => void;
}

export const usePOTrackerStore = create<POTrackerState>((set) => ({
  folders: [],
  pos: [],
  stats: null,
  activeFolderId: null,
  activeStatus: null,
  search: '',
  loading: false,
  detailPO: null,
  detailLoading: false,

  setFolders: (folders) => set({ folders: Array.isArray(folders) ? folders : [] }),
  setPos: (pos) => set({ pos: Array.isArray(pos) ? pos : [] }),
  setStats: (stats) => set({ stats: stats && typeof stats === 'object' ? stats : null }),
  setActiveFolderId: (id) => set({ activeFolderId: id, activeStatus: null }),
  setActiveStatus: (status) => set({ activeStatus: status }),
  setSearch: (q) => set({ search: q }),
  setLoading: (v) => set({ loading: v }),
  setDetailPO: (po) => set({ detailPO: po }),
  setDetailLoading: (v) => set({ detailLoading: v }),

  updatePOInList: (id, patch) =>
    set((s) => ({
      pos: s.pos.map((p) => (p.id === id ? { ...p, ...patch } : p)),
      detailPO: s.detailPO?.id === id ? { ...s.detailPO, ...patch } : s.detailPO,
    })),

  removePOFromList: (id) =>
    set((s) => ({
      pos: s.pos.filter((p) => p.id !== id),
      detailPO: s.detailPO?.id === id ? null : s.detailPO,
    })),

  addPOToList: (po) =>
    set((s) => ({ pos: [po, ...s.pos] })),

  updateFolderInList: (id, patch) =>
    set((s) => ({
      folders: s.folders.map((f) => (f.id === id ? { ...f, ...patch } : f)),
    })),

  removeFolderFromList: (id) =>
    set((s) => ({
      folders: s.folders.filter((f) => f.id !== id),
      activeFolderId: s.activeFolderId === id ? null : s.activeFolderId,
    })),

  addFolderToList: (folder) =>
    set((s) => ({ folders: [...s.folders, folder] })),
}));
