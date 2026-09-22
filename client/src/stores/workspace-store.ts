import { create } from 'zustand';

export type WorkspaceState = 'EMPTY' | 'INGESTING' | 'VALIDATING' | 'READY' | 'NEEDS_REVIEW';

interface WorkspaceStore {
  systemState: WorkspaceState;
  activeDatasetId: string | null;
  activeDatasetName: string | null;
  selectedStoreId: string | null;
  selectedCategoryId: string | null;
  setSystemState: (state: WorkspaceState) => void;
  setActiveDataset: (id: string | null, name: string | null) => void;
  setSelectedStoreId: (id: string | null) => void;
  setSelectedCategoryId: (id: string | null) => void;
}

export const useWorkspaceStore = create<WorkspaceStore>((set) => ({
  systemState: 'EMPTY',
  activeDatasetId: null,
  activeDatasetName: null,
  selectedStoreId: null,
  selectedCategoryId: null,

  setSystemState: (systemState) => set({ systemState }),
  setActiveDataset: (id, name) => set({ activeDatasetId: id, activeDatasetName: name }),
  setSelectedStoreId: (selectedStoreId) => set({ selectedStoreId }),
  setSelectedCategoryId: (selectedCategoryId) => set({ selectedCategoryId }),
}));
