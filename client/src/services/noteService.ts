import { STORES, idbGetAll, idbGetById, idbPut, idbDelete } from './storage/indexedDb';
import { QuickNoteItem, QuickNoteColor } from '@/types/workspace';
import { autoBackupManager } from './autoBackupManager';
import { sanitizeNoteHTML } from './backupService';

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
    // Keep localStorage light without deleting actual user text content
    const lightweightNotes = notes.map((n) => ({
      ...n,
      // Strip oversized inline image data if exceeding 150KB to preserve localStorage quota
      content: n.content && n.content.length > 150000 ? n.content.replace(/data:image\/[^"'\s)]+/g, '') : n.content,
      images: n.images?.map((img) => ({
        ...img,
        url: img.url && img.url.startsWith('data:image') && img.url.length > 50000 ? '' : img.url,
      })),
    }));
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(lightweightNotes));
  } catch (_) {
    // If quota still exceeded, persist essential note info and truncated text, keeping IDB primary
    try {
      const stripped = notes.map((n) => ({
        id: n.id,
        title: n.title,
        content: n.content ? n.content.slice(0, 10000) : '',
        updatedAt: n.updatedAt,
        pinned: n.pinned,
        color: n.color,
        tags: n.tags,
        noteType: n.noteType,
      }));
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(stripped));
    } catch (_) {}
  }
};

export const noteService = {
  /**
   * Retrieves all notes, sorted with pinned notes first, then latest updated first.
   * Merges IDB with cache to ensure full content is never lost or overwritten.
   */
  async getAllNotes(): Promise<QuickNoteItem[]> {
    let idbItems: QuickNoteItem[] = [];
    try {
      idbItems = await idbGetAll<QuickNoteItem>(STORES.NOTES);
    } catch (err) {
      console.warn('IDB note fetch error, falling back to cache:', err);
    }

    const cached = getLocalStorageNotes();

    // If IDB has notes, merge with cache so any note having fuller content in IDB or cache is preserved
    if (idbItems && idbItems.length > 0) {
      const mergedMap = new Map<string, QuickNoteItem>();
      
      // Seed with cached notes (sanitized)
      for (const item of cached) {
        mergedMap.set(item.id, {
          ...item,
          content: sanitizeNoteHTML(item.content || ''),
        });
      }

      // Overwrite/merge with IDB notes based on newest timestamp
      for (const item of idbItems) {
        const sanitizedItem = {
          ...item,
          content: sanitizeNoteHTML(item.content || ''),
        };
        const existingCached = mergedMap.get(item.id);
        if (!existingCached) {
          mergedMap.set(item.id, sanitizedItem);
        } else {
          // Compare updatedAt timestamps: fresher note wins
          const itemTime = new Date(item.updatedAt || 0).getTime();
          const cacheTime = new Date(existingCached.updatedAt || 0).getTime();
          const isItemFresher = itemTime >= cacheTime;
          mergedMap.set(item.id, {
            ...existingCached,
            ...sanitizedItem,
            content: isItemFresher ? sanitizedItem.content : existingCached.content,
            images: (sanitizedItem.images && sanitizedItem.images.length > 0) ? sanitizedItem.images : existingCached.images,
          });
        }
      }

      const mergedList = Array.from(mergedMap.values());
      saveLocalStorageNotes(mergedList);
      return this.sortNotes(mergedList);
    }

    // Fallback to cache if IDB is empty or offline
    return this.sortNotes(cached);
  },

  /**
   * Helper to sort notes: pinned on top, then newest updatedAt
   */
  sortNotes(notes: QuickNoteItem[]): QuickNoteItem[] {
    return [...notes].sort((a, b) => {
      const aPinned = Boolean(a.pinned);
      const bPinned = Boolean(b.pinned);
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;
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
   * Create or update note with zero-delay auto-save and anti-loss guard
   */
  async saveNote(data: Partial<QuickNoteItem> & { id?: string }): Promise<QuickNoteItem> {
    const now = new Date().toISOString();
    const isNew = !data.id;
    const id = data.id || generateId();

    const cached = getLocalStorageNotes();
    const existingFromCache = cached.find((n) => n.id === id);
    const existing = isNew ? null : ((await this.getNoteById(id)) || existingFromCache);

    // Anti-loss guard: If existing note has content (> 0) and incoming content is undefined or empty string,
    // ensure we don't accidentally wipe existing content unless explicit clear flag is provided
    let contentToSave = data.content !== undefined ? data.content : (existing?.content ?? '');
    if (
      existing &&
      existing.content &&
      existing.content.trim().length > 0 &&
      (contentToSave === '' || contentToSave === '<p><br></p>') &&
      data.content !== ''
    ) {
      contentToSave = existing.content;
    }

    // Preserve user title (allows clearing title completely while user is editing)
    const titleToSave = data.title !== undefined ? data.title : (existing?.title ?? 'Ghi chú mới');
    // Ensure all saved HTML content is sanitized against XSS
    const sanitizedContent = sanitizeNoteHTML(contentToSave);

    const noteToSave: QuickNoteItem = {
      id,
      title: titleToSave,
      content: sanitizedContent,
      checklistContent: data.checklistContent !== undefined ? data.checklistContent : (existing?.checklistContent ?? ''),
      pinned: data.pinned !== undefined ? Boolean(data.pinned) : (existing?.pinned ?? false),
      color: data.color ?? existing?.color ?? 'amber',
      tags: data.tags ?? existing?.tags ?? [],
      images: data.images !== undefined ? data.images : (existing?.images ?? []),
      reminderAt: data.reminderAt !== undefined ? data.reminderAt : (existing?.reminderAt ?? null),
      reminderEmail: data.reminderEmail !== undefined ? data.reminderEmail : (existing?.reminderEmail ?? null),
      reminderNotifyDesktop: data.reminderNotifyDesktop !== undefined ? data.reminderNotifyDesktop : (existing?.reminderNotifyDesktop ?? true),
      reminderNotifyEmail: data.reminderNotifyEmail !== undefined ? data.reminderNotifyEmail : (existing?.reminderNotifyEmail ?? false),
      reminderCompleted: data.reminderCompleted !== undefined ? data.reminderCompleted : (existing?.reminderCompleted ?? false),
      taskReminders: data.taskReminders !== undefined ? data.taskReminders : (existing?.taskReminders ?? []),
      emailProvider: data.emailProvider !== undefined ? data.emailProvider : (existing?.emailProvider ?? 'gmail'),
      noteType: data.noteType !== undefined ? data.noteType : (existing?.noteType ?? (contentToSave && /^-\s*\[([ xX])\]/m.test(contentToSave) ? 'checklist' : 'note')),
      isLocked: data.isLocked !== undefined ? Boolean(data.isLocked) : (existing?.isLocked ?? false),
      password: data.password !== undefined ? data.password : (existing?.password ?? ''),
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };

    // 1. Sync to localStorage instantly
    const latestCache = getLocalStorageNotes();
    const updatedCache = isNew
      ? [noteToSave, ...latestCache]
      : latestCache.map((n) => (n.id === id ? noteToSave : n));
    saveLocalStorageNotes(updatedCache);

    // 2. Persist to IndexedDB
    try {
      await idbPut<QuickNoteItem>(STORES.NOTES, noteToSave);
      // Dual-Persistence: schedule background sync to server
      autoBackupManager.scheduleSync();
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
      autoBackupManager.scheduleSync();
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
    return this.saveNote({ ...note, pinned: !Boolean(note.pinned) });
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
