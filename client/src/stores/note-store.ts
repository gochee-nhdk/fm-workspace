import { create } from 'zustand';
import { QuickNoteItem, QuickNoteColor } from '@/types/workspace';
import { noteService } from '@/services/noteService';
import toast from 'react-hot-toast';

interface NoteStoreState {
  isOpen: boolean;
  isMinimized: boolean;
  isPinned: boolean;
  activeNoteId: string | null;
  activeTextNoteId: string | null;
  activeChecklistId: string | null;
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
  createNote: (type?: 'note' | 'checklist', initialContent?: string) => Promise<QuickNoteItem>;
  selectNote: (id: string) => void;
  updateNote: (id: string, fields: Partial<QuickNoteItem>) => Promise<void>;
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
  activeTextNoteId: null,
  activeChecklistId: null,
  notes: [],
  loading: false,
  searchQuery: '',

  loadNotes: async () => {
    set({ loading: true });
    try {
      const rawNotes = await noteService.getAllNotes();

      // --- Self-Healing Data Decoupling Migration (2-Compartment Notebook Model) ---
      // Phân tách triệt để 100%: Ngăn Ghi chú và Ngăn To-do là 2 thực thể hoàn toàn độc lập,
      // không chia sẻ id, không để lẫn nội dung của nhau.
      let notes = [...rawNotes];
      let migrated = false;

      for (const n of rawNotes) {
        // 1. Nếu một note có noteType === 'checklist':
        //    Tách mọi dòng văn bản thường (không có [ ] hoặc [x]) sang 1 ghi chú văn bản thuần túy.
        //    Ngăn to-do CHỈ giữ lại các dòng việc cần làm hợp lệ.
        if (n.noteType === 'checklist') {
          const rawChecklist = n.checklistContent || '';
          const rawContent = n.content || '';
          const combined = `${rawChecklist}\n${rawContent}`.replace(/<[^>]+>/g, '\n').replace(/&nbsp;/g, ' ');
          const allLines = combined.split('\n').map((l) => l.trim()).filter(Boolean);

          const todoLines: string[] = [];
          const textLines: string[] = [];

          allLines.forEach((line) => {
            if (/^(?:-\s*)?\[([ xX])\]/.test(line)) {
              todoLines.push(line);
            } else if (line !== '<p><br></p>' && line !== '<br>') {
              textLines.push(line);
            }
          });

          // Nếu note to-do này đang chứa lẫn các dòng văn bản ghi chú (như danh sách nhà cung cấp...)
          if (textLines.length > 0) {
            migrated = true;
            // Tạo 1 bản ghi Ghi chú riêng cho phần văn bản đó
            const textHtml = textLines.map((l) => `<p>${l}</p>`).join('');
            const cleanTitle = (n.title || '').replace(/\s*\((?:Ghi chú|To-do)\)/gi, '').trim();
            await noteService.saveNote({
              title: cleanTitle ? `${cleanTitle} (Ghi chú)` : 'Ghi chú',
              content: textHtml,
              checklistContent: '',
              noteType: 'note',
              color: 'amber',
              pinned: n.pinned,
              images: n.images || [],
            });

            // Làm sạch note to-do hiện tại: CHỈ giữ lại các dòng checklist, đặt title chuẩn To-do
            await noteService.saveNote({
              ...n,
              title: cleanTitle ? `${cleanTitle} (To-do)` : 'Danh sách việc cần làm',
              noteType: 'checklist',
              content: '<p><br></p>',
              checklistContent: todoLines.length > 0 ? todoLines.join('\n') : '- [ ] ',
              images: [],
            });
          } else if (n.content && n.content !== '<p><br></p>') {
            // Dọn sạch n.content trong note checklist nếu còn dư
            migrated = true;
            await noteService.saveNote({
              ...n,
              content: '<p><br></p>',
              images: [],
            });
          }
        } else {
          // 2. Nếu một note có noteType === 'note' (hoặc chưa gán type):
          //    Nếu lỡ chứa checklistContent, tách phần checklistContent thành 1 to-do độc lập.
          const hasText = Boolean(n.content && n.content.trim() && n.content !== '<p><br></p>');
          const hasChecklist = Boolean(
            n.checklistContent &&
            n.checklistContent.trim() &&
            n.checklistContent !== '- [ ] ' &&
            /\[([ xX])\]/.test(n.checklistContent)
          );

          if (hasText && hasChecklist) {
            migrated = true;
            // Giữ note hiện tại làm ghi chú văn bản thuần túy
            await noteService.saveNote({
              ...n,
              noteType: 'note',
              checklistContent: '',
            });
            // Tạo to-do riêng biệt
            await noteService.saveNote({
              title: n.title ? `${n.title} (To-do)` : 'Danh sách việc cần làm',
              content: '<p><br></p>',
              checklistContent: n.checklistContent,
              noteType: 'checklist',
              color: 'blue',
              pinned: n.pinned,
              images: [],
              taskReminders: n.taskReminders || [],
            });
          } else if (n.checklistContent && !hasChecklist) {
            // Dọn sạch checklistContent rác
            migrated = true;
            await noteService.saveNote({
              ...n,
              noteType: 'note',
              checklistContent: '',
            });
          }
        }
      }

      if (migrated) {
        notes = await noteService.getAllNotes();
      }

      const textNotes = notes.filter((n) => n.noteType !== 'checklist');
      const checklistNotes = notes.filter((n) => n.noteType === 'checklist');

      const currentActiveTextId = get().activeTextNoteId;
      const currentActiveChecklistId = get().activeChecklistId;

      const nextActiveTextId = (currentActiveTextId && textNotes.some((n) => n.id === currentActiveTextId))
        ? currentActiveTextId
        : (textNotes[0]?.id || null);

      const nextActiveChecklistId = (currentActiveChecklistId && checklistNotes.some((n) => n.id === currentActiveChecklistId))
        ? currentActiveChecklistId
        : (checklistNotes[0]?.id || null);

      set({
        notes,
        loading: false,
        activeTextNoteId: nextActiveTextId,
        activeChecklistId: nextActiveChecklistId,
        activeNoteId: get().activeNoteId || nextActiveTextId || nextActiveChecklistId,
      });
    } catch (err) {
      console.error('Failed to load notes:', err);
      set({ loading: false });
    }
  },

  openNote: (id?: string) => {
    const { notes, activeTextNoteId, activeChecklistId, activeNoteId } = get();
    if (id) {
      const target = notes.find((n) => n.id === id);
      const isChecklist = target?.noteType === 'checklist';
      set({
        isOpen: true,
        isMinimized: false,
        activeNoteId: id,
        activeTextNoteId: isChecklist ? activeTextNoteId : id,
        activeChecklistId: isChecklist ? id : activeChecklistId,
      });
    } else if (notes.length > 0) {
      const textNotes = notes.filter((n) => n.noteType !== 'checklist');
      const checklistNotes = notes.filter((n) => n.noteType === 'checklist');
      const validTextId = (activeTextNoteId && textNotes.some((n) => n.id === activeTextNoteId)) ? activeTextNoteId : textNotes[0]?.id || null;
      const validChecklistId = (activeChecklistId && checklistNotes.some((n) => n.id === activeChecklistId)) ? activeChecklistId : checklistNotes[0]?.id || null;
      set({
        isOpen: true,
        isMinimized: false,
        activeTextNoteId: validTextId,
        activeChecklistId: validChecklistId,
        activeNoteId: activeNoteId || validTextId || validChecklistId,
      });
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

  createNote: async (type: 'note' | 'checklist' = 'note', initialContent?: string) => {
    const isChecklist = type === 'checklist';
    const defaultChecklist = isChecklist
      ? (initialContent ?? '- [ ] Việc cần làm 1\n- [ ] Việc cần làm 2')
      : '';
    const defaultContent = isChecklist ? '<p><br></p>' : (initialContent ?? '');
    const defaultTitle = isChecklist ? 'Danh sách việc mới' : 'Ghi chú mới';

    const newNote = await noteService.saveNote({
      title: defaultTitle,
      content: defaultContent,
      checklistContent: defaultChecklist,
      noteType: type,
      color: isChecklist ? 'blue' : 'amber',
      pinned: false,
      images: [],
    });

    set((state) => ({
      notes: [newNote, ...state.notes],
      activeNoteId: newNote.id,
      activeTextNoteId: isChecklist ? state.activeTextNoteId : newNote.id,
      activeChecklistId: isChecklist ? newNote.id : state.activeChecklistId,
      isOpen: true,
      isMinimized: false,
    }));

    return newNote;
  },

  selectNote: (id: string) => {
    const { notes } = get();
    const target = notes.find((n) => n.id === id);
    const isChecklist = target?.noteType === 'checklist';
    set((state) => ({
      activeNoteId: id,
      activeTextNoteId: isChecklist ? state.activeTextNoteId : id,
      activeChecklistId: isChecklist ? id : state.activeChecklistId,
      isMinimized: false,
    }));
  },

  updateNote: async (id: string, fields: Partial<QuickNoteItem>) => {
    const { notes } = get();
    const current = notes.find((n) => n.id === id);
    if (!current) return;

    const isChecklist = (fields.noteType ?? current.noteType) === 'checklist';
    const sanitizedFields: Partial<QuickNoteItem> = { ...fields };
    if (isChecklist) {
      sanitizedFields.content = '<p><br></p>';
      sanitizedFields.images = [];
    } else {
      sanitizedFields.checklistContent = '';
    }

    // Optimistic in-memory update immediately so typing/switching has 0 delay and no data loss
    const optimistic: QuickNoteItem = {
      ...current,
      ...sanitizedFields,
      id,
      updatedAt: new Date().toISOString(),
    };

    set((state) => ({
      notes: state.notes.map((n) => (n.id === id ? optimistic : n)),
    }));

    // Asynchronously persist
    const updated = await noteService.saveNote({
      ...current,
      ...sanitizedFields,
      id,
    });

    // Update in-place to preserve stable list position during active editing & selecting!
    // Only re-sort if pinned status changed, preventing the list from jumping wildly.
    set((state) => {
      const updatedNotes = state.notes.map((n) => (n.id === id ? updated : n));
      return {
        notes: fields.pinned !== undefined ? noteService.sortNotes(updatedNotes) : updatedNotes,
      };
    });
  },

  updateActiveNote: async (fields: Partial<QuickNoteItem>) => {
    const { activeNoteId } = get();
    if (!activeNoteId) return;
    await get().updateNote(activeNoteId, fields);
  },

  deleteNote: async (id: string) => {
    await noteService.deleteNote(id);
    const { notes, activeNoteId, activeTextNoteId, activeChecklistId } = get();
    const target = notes.find((n) => n.id === id);
    const isChecklist = target?.noteType === 'checklist';
    const remaining = notes.filter((n) => n.id !== id);

    const remainingTextNotes = remaining.filter((n) => n.noteType !== 'checklist');
    const remainingChecklistNotes = remaining.filter((n) => n.noteType === 'checklist');

    let nextActiveTextId = activeTextNoteId;
    let nextActiveChecklistId = activeChecklistId;

    if (isChecklist) {
      if (activeChecklistId === id) {
        nextActiveChecklistId = remainingChecklistNotes.length > 0 ? remainingChecklistNotes[0].id : null;
      }
    } else {
      if (activeTextNoteId === id) {
        nextActiveTextId = remainingTextNotes.length > 0 ? remainingTextNotes[0].id : null;
      }
    }

    let nextActiveId = activeNoteId;
    if (activeNoteId === id) {
      nextActiveId = isChecklist ? (nextActiveChecklistId || nextActiveTextId) : (nextActiveTextId || nextActiveChecklistId);
    }

    set({
      notes: remaining,
      activeNoteId: nextActiveId,
      activeTextNoteId: nextActiveTextId,
      activeChecklistId: nextActiveChecklistId,
    });

    toast.success(isChecklist ? 'Đã xóa danh sách to-do' : 'Đã xóa ghi chú', { id: 'note-delete' });

    // If no notes remain in the deleted compartment, create an empty one for that compartment
    if (isChecklist && remainingChecklistNotes.length === 0) {
      await get().createNote('checklist');
    } else if (!isChecklist && remainingTextNotes.length === 0) {
      await get().createNote('note');
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
