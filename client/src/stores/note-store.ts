import { create } from 'zustand';
import { QuickNoteItem, QuickNoteColor } from '@/types/workspace';
import { noteService } from '@/services/noteService';
import toast from 'react-hot-toast';

interface NoteStoreState {
  isOpen: boolean;
  isMinimized: boolean;
  isPinned: boolean;
  activeNoteId: string | null;
  notes: QuickNoteItem[];
  loading: boolean;
  searchQuery: string;

  // Actions
  loadNotes: () => Promise<void>;
  openNote: (id?: string) => void;
  closeNote: () => void;
  toggleNote: () => void;
  setMinimized: (minimized: boolean) => void;
  togglePinned: () => void;
  createNote: (initialContent?: string) => Promise<QuickNoteItem>;
  selectNote: (id: string) => void;
  updateActiveNote: (fields: Partial<QuickNoteItem>) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  togglePinNote: (id: string) => Promise<void>;
  changeColorNote: (id: string, color: QuickNoteColor) => Promise<void>;
  setSearchQuery: (query: string) => void;
}

export const useNoteStore = create<NoteStoreState>((set, get) => ({
  isOpen: false,
  isMinimized: false,
  isPinned: false,
  activeNoteId: null,
  notes: [],
  loading: false,
  searchQuery: '',

  loadNotes: async () => {
    set({ loading: true });
    try {
      const notes = await noteService.getAllNotes();
      set({ notes, loading: false });

      // If activeNoteId is not set, select the first note if exists
      if (!get().activeNoteId && notes.length > 0) {
        set({ activeNoteId: notes[0].id });
      }
    } catch (err) {
      console.error('Failed to load notes:', err);
      set({ loading: false });
    }
  },

  openNote: (id?: string) => {
    const { notes } = get();
    if (id) {
      set({ isOpen: true, isMinimized: false, activeNoteId: id });
    } else if (notes.length > 0) {
      set({ isOpen: true, isMinimized: false, activeNoteId: get().activeNoteId || notes[0].id });
    } else {
      // If no notes exist, auto-create one
      get().createNote();
      set({ isOpen: true, isMinimized: false });
    }
  },

  closeNote: () => {
    set({ isOpen: false, isMinimized: false });
  },

  toggleNote: () => {
    const { isOpen, isMinimized } = get();
    if (isOpen && !isMinimized) {
      set({ isOpen: false });
    } else {
      get().openNote();
    }
  },

  setMinimized: (isMinimized: boolean) => {
    set({ isMinimized });
  },

  togglePinned: () => {
    const next = !get().isPinned;
    set({ isPinned: next });
    toast.success(next ? 'Đã ghim nổi ghi chú' : 'Đã bỏ ghim nổi', { id: 'note-pin-window' });
  },

  createNote: async (initialContent = '') => {
    const newNote = await noteService.saveNote({
      title: 'Ghi chú mới',
      content: initialContent,
      color: 'amber',
      pinned: false,
    });

    set((state) => ({
      notes: [newNote, ...state.notes],
      activeNoteId: newNote.id,
      isOpen: true,
      isMinimized: false,
    }));

    return newNote;
  },

  selectNote: (id: string) => {
    set({ activeNoteId: id, isMinimized: false });
  },

  updateActiveNote: async (fields: Partial<QuickNoteItem>) => {
    const { activeNoteId, notes } = get();
    if (!activeNoteId) return;

    const current = notes.find((n) => n.id === activeNoteId);
    if (!current) return;

    const updated = await noteService.saveNote({
      ...current,
      ...fields,
      id: activeNoteId,
    });

    set((state) => ({
      notes: noteService.sortNotes(
        state.notes.map((n) => (n.id === activeNoteId ? updated : n))
      ),
    }));
  },

  deleteNote: async (id: string) => {
    await noteService.deleteNote(id);
    const { notes, activeNoteId } = get();
    const remaining = notes.filter((n) => n.id !== id);

    let nextActiveId = activeNoteId;
    if (activeNoteId === id) {
      nextActiveId = remaining.length > 0 ? remaining[0].id : null;
    }

    set({
      notes: remaining,
      activeNoteId: nextActiveId,
    });

    toast.success('Đã xóa ghi chú', { id: 'note-delete' });

    // If no notes remain, create an empty one
    if (remaining.length === 0) {
      await get().createNote();
    }
  },

  togglePinNote: async (id: string) => {
    const updated = await noteService.togglePin(id);
    if (!updated) return;

    set((state) => ({
      notes: noteService.sortNotes(
        state.notes.map((n) => (n.id === id ? updated : n))
      ),
    }));

    toast.success(updated.pinned ? 'Đã ghim ghi chú lên đầu' : 'Đã bỏ ghim ghi chú', {
      id: 'note-pin-item',
    });
  },

  changeColorNote: async (id: string, color: QuickNoteColor) => {
    const updated = await noteService.changeColor(id, color);
    if (!updated) return;

    set((state) => ({
      notes: state.notes.map((n) => (n.id === id ? updated : n)),
    }));
  },

  setSearchQuery: (searchQuery: string) => {
    set({ searchQuery });
  },
}));
