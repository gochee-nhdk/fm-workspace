import { STORES, idbGetAll, idbGetById, idbPut, idbDelete } from './storage/indexedDb';
import { QuickNoteItem, QuickNoteColor } from '@/types/workspace';

const LOCAL_STORAGE_KEY = 'fm_quick_notes_cache';

// Helper to generate unique ID
const generateId = (): string => {
  return 'note_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7);
};

// Safe localStorage sync helpers
const getLocalStorageNotes = (): QuickNoteItem[] => {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (_) {
    return [];
  }
};

const saveLocalStorageNotes = (notes: QuickNoteItem[]): void => {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(notes));
  } catch (_) {}
};

export const noteService = {
  /**
   * Retrieves all notes, sorted with pinned notes first, then latest updated first.
   */
  async getAllNotes(): Promise<QuickNoteItem[]> {
    try {
      const items = await idbGetAll<QuickNoteItem>(STORES.NOTES);
      if (items && items.length > 0) {
        saveLocalStorageNotes(items);
        return this.sortNotes(items);
      }
    } catch (err) {
      console.warn('IDB note fetch error, falling back to cache:', err);
    }
    // Fallback to cache if IDB is empty or offline
    const cached = getLocalStorageNotes();
    return this.sortNotes(cached);
  },

  /**
   * Helper to sort notes: pinned on top, then newest updatedAt
   */
  sortNotes(notes: QuickNoteItem[]): QuickNoteItem[] {
    return [...notes].sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  },

  /**
   * Get a single note by ID
   */
  async getNoteById(id: string): Promise<QuickNoteItem | null> {
    try {
      const note = await idbGetById<QuickNoteItem>(STORES.NOTES, id);
      if (note) return note;
    } catch (_) {}
    const cached = getLocalStorageNotes();
    return cached.find((n) => n.id === id) || null;
  },

  /**
   * Create or update note with zero-delay auto-save
   */
  async saveNote(data: Partial<QuickNoteItem> & { id?: string }): Promise<QuickNoteItem> {
    const now = new Date().toISOString();
    const isNew = !data.id;
    const id = data.id || generateId();

    const existing = isNew ? null : await this.getNoteById(id);

    // Preserve user title (allows clearing title completely while user is editing)
    const titleToSave = data.title !== undefined ? data.title : (existing?.title ?? 'Ghi chú mới');

    const noteToSave: QuickNoteItem = {
      id,
      title: titleToSave,
      content: data.content ?? existing?.content ?? '',
      pinned: data.pinned ?? existing?.pinned ?? false,
      color: data.color ?? existing?.color ?? 'amber',
      tags: data.tags ?? existing?.tags ?? [],
      reminderAt: data.reminderAt !== undefined ? data.reminderAt : (existing?.reminderAt ?? null),
      reminderEmail: data.reminderEmail !== undefined ? data.reminderEmail : (existing?.reminderEmail ?? null),
      reminderNotifyDesktop: data.reminderNotifyDesktop !== undefined ? data.reminderNotifyDesktop : (existing?.reminderNotifyDesktop ?? true),
      reminderNotifyEmail: data.reminderNotifyEmail !== undefined ? data.reminderNotifyEmail : (existing?.reminderNotifyEmail ?? false),
      reminderCompleted: data.reminderCompleted !== undefined ? data.reminderCompleted : (existing?.reminderCompleted ?? false),
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };

    // 1. Sync to localStorage instantly
    const cached = getLocalStorageNotes();
    const updatedCache = isNew
      ? [noteToSave, ...cached]
      : cached.map((n) => (n.id === id ? noteToSave : n));
    saveLocalStorageNotes(updatedCache);

    // 2. Persist to IndexedDB
    try {
      await idbPut<QuickNoteItem>(STORES.NOTES, noteToSave);
    } catch (err) {
      console.error('Failed to save note to IDB:', err);
    }

    return noteToSave;
  },

  /**
   * Delete a note
   */
  async deleteNote(id: string): Promise<boolean> {
    // 1. Remove from localStorage cache
    const cached = getLocalStorageNotes();
    saveLocalStorageNotes(cached.filter((n) => n.id !== id));

    // 2. Remove from IndexedDB
    try {
      await idbDelete(STORES.NOTES, id);
      return true;
    } catch (err) {
      console.error('Failed to delete note from IDB:', err);
      return true; // Still removed from cache
    }
  },

  /**
   * Toggle pinned state
   */
  async togglePin(id: string): Promise<QuickNoteItem | null> {
    const note = await this.getNoteById(id);
    if (!note) return null;
    return this.saveNote({ ...note, pinned: !note.pinned });
  },

  /**
   * Change note color
   */
  async changeColor(id: string, color: QuickNoteColor): Promise<QuickNoteItem | null> {
    const note = await this.getNoteById(id);
    if (!note) return null;
    return this.saveNote({ ...note, color });
  },
};
