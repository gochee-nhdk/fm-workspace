import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  FileText,
  Plus,
  Pin,
  PinOff,
  Minus,
  X,
  Trash2,
  Copy,
  Check,
  PanelLeftClose,
  PanelLeft,
  Search,
  CheckSquare,
  Sparkles,
  Clock,
  Bell,
  BellRing,
  Mail,
  Calendar,
  Send,
  ListTodo,
  CheckCircle2,
  Circle,
  AlertCircle,
} from 'lucide-react';
import { useNoteStore } from '@/stores/note-store';
import { QuickNoteColor, QuickNoteItem } from '@/types/workspace';
import { reminderService } from '@/services/reminderService';
import toast from 'react-hot-toast';

const COLOR_MAP: Record<
  QuickNoteColor,
  { bg: string; dot: string; border: string; glow: string }
> = {
  amber: {
    bg: 'bg-amber-500/10 dark:bg-amber-400/15',
    dot: 'bg-amber-500',
    border: 'border-amber-500/30',
    glow: 'rgba(245,158,11,0.25)',
  },
  blue: {
    bg: 'bg-[#0071e3]/10 dark:bg-[#2997ff]/15',
    dot: 'bg-[#0071e3]',
    border: 'border-[#0071e3]/30',
    glow: 'rgba(0,113,227,0.25)',
  },
  emerald: {
    bg: 'bg-emerald-500/10 dark:bg-emerald-400/15',
    dot: 'bg-emerald-500',
    border: 'border-emerald-500/30',
    glow: 'rgba(16,185,129,0.25)',
  },
  purple: {
    bg: 'bg-purple-500/10 dark:bg-purple-400/15',
    dot: 'bg-purple-500',
    border: 'border-purple-500/30',
    glow: 'rgba(139,92,246,0.25)',
  },
  rose: {
    bg: 'bg-rose-500/10 dark:bg-rose-400/15',
    dot: 'bg-rose-500',
    border: 'border-rose-500/30',
    glow: 'rgba(244,63,94,0.25)',
  },
};

/**
 * Format date to YYYY-MM-DDTHH:mm for datetime-local input
 */
const toDatetimeLocal = (date: Date): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

/**
 * Subtle tactile audio feedback for Apple-style checkbox toggle
 */
const playPopSound = () => {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(650, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(320, ctx.currentTime + 0.04);
    gain.gain.setValueAtTime(0.04, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.05);
  } catch (_) {}
};

interface ChecklistRow {
  lineIndex: number;
  completed: boolean;
  text: string;
}

export const QuickNoteWindow: React.FC = () => {
  const {
    isOpen,
    isMinimized,
    isPinned,
    activeNoteId,
    notes,
    loadNotes,
    closeNote,
    setMinimized,
    togglePinned,
    createNote,
    selectNote,
    updateActiveNote,
    deleteNote,
    togglePinNote,
    changeColorNote,
  } = useNoteStore();

  const [showSidebar, setShowSidebar] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [copied, setCopied] = useState(false);
  const [editorMode, setEditorMode] = useState<'text' | 'checklist'>('text');
  const [showReminderModal, setShowReminderModal] = useState(false);

  // Reminder popover form state
  const [reminderDate, setReminderDate] = useState('');
  const [reminderDesktop, setReminderDesktop] = useState(true);
  const [reminderEmail, setReminderEmail] = useState(false);
  const [reminderEmailInput, setReminderEmailInput] = useState('');

  const contentRef = useRef<HTMLTextAreaElement>(null);
  const newTaskInputRef = useRef<HTMLInputElement>(null);

  // Local drafts for instant typing, smooth Vietnamese Telex / IME & zero cursor jumping
  const [localTitle, setLocalTitle] = useState('');
  const [localContent, setLocalContent] = useState('');
  const activeNoteIdRef = useRef<string | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initial load
  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  const activeNote = notes.find((n) => n.id === activeNoteId) || notes[0];

  // Sync local draft when active note switches
  useEffect(() => {
    if (activeNote) {
      if (activeNoteIdRef.current !== activeNote.id) {
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
          debounceTimerRef.current = null;
        }
        activeNoteIdRef.current = activeNote.id;
        setLocalTitle(activeNote.title || '');
        setLocalContent(activeNote.content || '');

        // Auto-detect if note is primarily a checklist
        const hasChecklist = /^-\s*\[([ xX])\]/m.test(activeNote.content || '');
        setEditorMode(hasChecklist ? 'checklist' : 'text');

        // Sync reminder state
        if (activeNote.reminderAt) {
          try {
            const d = new Date(activeNote.reminderAt);
            setReminderDate(toDatetimeLocal(d));
          } catch (_) {
            setReminderDate('');
          }
        } else {
          setReminderDate('');
        }
        setReminderDesktop(activeNote.reminderNotifyDesktop ?? true);
        setReminderEmail(activeNote.reminderNotifyEmail ?? false);
        setReminderEmailInput(activeNote.reminderEmail || reminderService.getPreferredEmail() || '');
      }
    }
  }, [activeNote]);

  // Clean up debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Filter notes by search
  const filteredNotes = notes.filter((n) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return (
      (n.title || '').toLowerCase().includes(q) ||
      (n.content || '').toLowerCase().includes(q)
    );
  });

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setLocalTitle(val);

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      updateActiveNote({ title: val });
    }, 250);
  };

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setLocalContent(val);

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      updateActiveNote({ content: val });
    }, 300);
  };

  // ──────── Parse Checklist Rows from localContent ────────
  const checklistRows: ChecklistRow[] = useMemo(() => {
    const lines = localContent.split('\n');
    const rows: ChecklistRow[] = [];
    lines.forEach((line, idx) => {
      const match = line.match(/^-\s*\[([ xX])\]\s*(.*)$/);
      if (match) {
        rows.push({
          lineIndex: idx,
          completed: match[1].toLowerCase() === 'x',
          text: match[2],
        });
      }
    });
    return rows;
  }, [localContent]);

  const checklistTotal = checklistRows.length;
  const checklistCompleted = checklistRows.filter((r) => r.completed).length;
  const checklistPercent = checklistTotal > 0 ? Math.round((checklistCompleted / checklistTotal) * 100) : 0;

  // Toggle single checklist row directly in note
  const handleToggleChecklistRow = (lineIndex: number) => {
    playPopSound();
    const lines = localContent.split('\n');
    const targetLine = lines[lineIndex];
    if (!targetLine) return;

    const match = targetLine.match(/^-\s*\[([ xX])\]\s*(.*)$/);
    if (match) {
      const isCurrentlyChecked = match[1].toLowerCase() === 'x';
      const newCheck = isCurrentlyChecked ? ' ' : 'x';
      lines[lineIndex] = `- [${newCheck}] ${match[2]}`;
      const newContent = lines.join('\n');
      setLocalContent(newContent);
      updateActiveNote({ content: newContent });
    }
  };

  // Update text of single checklist row
  const handleUpdateChecklistRowText = (lineIndex: number, newText: string) => {
    const lines = localContent.split('\n');
    const targetLine = lines[lineIndex];
    if (!targetLine) return;

    const match = targetLine.match(/^-\s*\[([ xX])\]\s*(.*)$/);
    if (match) {
      lines[lineIndex] = `- [${match[1]}] ${newText}`;
      const newContent = lines.join('\n');
      setLocalContent(newContent);

      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        updateActiveNote({ content: newContent });
      }, 300);
    }
  };

  // Delete single checklist row
  const handleDeleteChecklistRow = (lineIndex: number) => {
    const lines = localContent.split('\n');
    lines.splice(lineIndex, 1);
    const newContent = lines.join('\n');
    setLocalContent(newContent);
    updateActiveNote({ content: newContent });
  };

  // Insert a new checklist row below lineIndex or at end
  const handleInsertChecklistRowAfter = (lineIndex?: number) => {
    const lines = localContent.split('\n');
    if (lineIndex !== undefined && lineIndex >= 0) {
      lines.splice(lineIndex + 1, 0, '- [ ] ');
    } else {
      if (lines.length === 1 && lines[0].trim() === '') {
        lines[0] = '- [ ] ';
      } else {
        lines.push('- [ ] ');
      }
    }
    const newContent = lines.join('\n');
    setLocalContent(newContent);
    updateActiveNote({ content: newContent });

    // Focus newly created row
    setTimeout(() => {
      const inputs = document.querySelectorAll<HTMLInputElement>('.checklist-item-input');
      const targetInput = lineIndex !== undefined ? inputs[lineIndex + 1] : inputs[inputs.length - 1];
      targetInput?.focus();
    }, 50);
  };

  // Complete / Uncomplete all checklist rows
  const handleToggleAllChecklist = (completed: boolean) => {
    const char = completed ? 'x' : ' ';
    const lines = localContent.split('\n');
    const updated = lines.map((line) => {
      if (/^-\s*\[([ xX])\]/.test(line)) {
        return line.replace(/^-\s*\[([ xX])\]/, `- [${char}]`);
      }
      return line;
    });
    const newContent = updated.join('\n');
    setLocalContent(newContent);
    updateActiveNote({ content: newContent });
    toast.success(completed ? 'Đã hoàn tất tất cả việc!' : 'Đã bỏ chọn tất cả!', { id: 'check-all' });
  };

  // Switch to checklist mode & ensure at least one checklist item
  const handleActivateChecklistMode = () => {
    if (editorMode === 'checklist') {
      handleInsertChecklistRowAfter();
      return;
    }

    setEditorMode('checklist');
    if (checklistRows.length === 0) {
      if (localContent.trim().length === 0) {
        setLocalContent('- [ ] ');
        updateActiveNote({ content: '- [ ] ' });
      } else {
        // Convert non-empty lines into checklist items
        const lines = localContent.split('\n').filter((l) => l.trim().length > 0);
        const converted = lines.map((l) => `- [ ] ${l.replace(/^-\s*\[[ xX]\]\s*/, '').replace(/^-\s*/, '')}`).join('\n');
        setLocalContent(converted);
        updateActiveNote({ content: converted });
      }
    }
  };

  // 1-Click copy whole note
  const handleCopyNote = () => {
    if (!activeNote) return;
    const title = localTitle.trim() || activeNote.title || 'Ghi chú';
    const text = `${title}\n\n${localContent}`;
    navigator.clipboard.writeText(text.trim());
    setCopied(true);
    toast.success('Đã sao chép nội dung ghi chú!', { id: 'note-copied' });
    setTimeout(() => setCopied(false), 2000);
  };

  // ──────── Reminder Handlers ────────
  const handleOpenReminderModal = () => {
    if (activeNote?.reminderAt) {
      try {
        setReminderDate(toDatetimeLocal(new Date(activeNote.reminderAt)));
      } catch (_) {
        setReminderDate(toDatetimeLocal(new Date(Date.now() + 30 * 60 * 1000)));
      }
    } else {
      // Default to 30 mins from now
      setReminderDate(toDatetimeLocal(new Date(Date.now() + 30 * 60 * 1000)));
    }
    setReminderDesktop(activeNote?.reminderNotifyDesktop ?? true);
    setReminderEmail(activeNote?.reminderNotifyEmail ?? false);
    setReminderEmailInput(activeNote?.reminderEmail || reminderService.getPreferredEmail() || '');
    setShowReminderModal(true);
  };

  const handleApplyPreset = (minutesAhead: number) => {
    const target = new Date(Date.now() + minutesAhead * 60 * 1000);
    setReminderDate(toDatetimeLocal(target));
  };

  const handleApplyPresetTime = (hours: number, minutes: number, tomorrow = false) => {
    const target = new Date();
    if (tomorrow) target.setDate(target.getDate() + 1);
    target.setHours(hours, minutes, 0, 0);
    if (!tomorrow && target.getTime() <= Date.now()) {
      target.setDate(target.getDate() + 1);
    }
    setReminderDate(toDatetimeLocal(target));
  };

  const handleApplyNextMonday = () => {
    const target = new Date();
    const day = target.getDay();
    const diff = target.getDate() + ((7 - day + 1) % 7 || 7);
    target.setDate(diff);
    target.setHours(8, 30, 0, 0);
    setReminderDate(toDatetimeLocal(target));
  };

  const handleSaveReminder = async () => {
    if (!activeNote) return;
    if (!reminderDate) {
      toast.error('Vui lòng chọn thời gian nhắc nhở');
      return;
    }

    const reminderIso = new Date(reminderDate).toISOString();

    // Check desktop notification permission if enabled
    if (reminderDesktop) {
      const granted = await reminderService.requestNotificationPermission();
      if (!granted) {
        toast('Hãy cấp quyền thông báo trên trình duyệt để nhận chuông nhắc nhở', {
          icon: '🔔',
        });
      }
    }

    // Save preferred email if provided
    if (reminderEmail && reminderEmailInput.trim()) {
      reminderService.setPreferredEmail(reminderEmailInput.trim());
    }

    updateActiveNote({
      reminderAt: reminderIso,
      reminderNotifyDesktop: reminderDesktop,
      reminderNotifyEmail: reminderEmail,
      reminderEmail: reminderEmailInput.trim() || null,
      reminderCompleted: false,
    });

    setShowReminderModal(false);
    toast.success(
      `⏰ Đã đặt lịch nhắc: ${new Date(reminderIso).toLocaleString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
      })}`,
      { id: 'reminder-saved' }
    );
  };

  const handleRemoveReminder = () => {
    if (!activeNote) return;
    updateActiveNote({
      reminderAt: null,
      reminderCompleted: false,
    });
    setShowReminderModal(false);
    toast.success('Đã hủy lịch nhắc nhở của ghi chú này', { id: 'reminder-removed' });
  };

  const handleSendTestEmail = () => {
    if (!activeNote) return;
    reminderService.composeEmailReminder(
      {
        ...activeNote,
        title: localTitle || activeNote.title,
        content: localContent,
        reminderAt: reminderDate ? new Date(reminderDate).toISOString() : null,
      },
      reminderEmailInput.trim() || undefined
    );
    toast.success('Đang mở ứng dụng email...', { id: 'email-opened' });
  };

  // Only render if opened
  if (!isOpen) return null;

  // Minimized Floating Pill View
  if (isMinimized) {
    return createPortal(
      <aside
        aria-label="Cửa sổ ghi chú thu nhỏ"
        className="fixed bottom-6 right-6 z-[9999] animate-in fade-in zoom-in-95 duration-200"
      >
        <button
          type="button"
          onClick={() => setMinimized(false)}
          className="group flex items-center gap-3 px-4 py-2.5 rounded-full bg-white/85 dark:bg-[#16161c]/85 hover:bg-white dark:hover:bg-[#1c1c24] backdrop-blur-3xl border border-black/10 dark:border-white/15 shadow-[0_16px_40px_rgba(0,0,0,0.18),inset_0_1.5px_1px_rgba(255,255,255,1)] hover:shadow-[0_20px_50px_rgba(0,113,227,0.25)] transition-all cursor-pointer select-none active:scale-95"
          title="Mở rộng cửa sổ ghi chú"
        >
          <div className="w-6 h-6 rounded-full bg-gradient-to-b from-[#ffd60a] to-[#ff9f0a] flex items-center justify-center text-white shadow-xs">
            <FileText className="w-3.5 h-3.5 drop-shadow-xs" />
          </div>
          <span className="text-[13px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] max-w-[160px] truncate">
            {localTitle.trim() || activeNote?.title || 'Ghi chú mới'}
          </span>
          {activeNote?.reminderAt && !activeNote?.reminderCompleted && (
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" title="Có lịch nhắc" />
          )}
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/10 text-[#76767b] dark:text-[#a1a1a6]">
            {notes.length}
          </span>
        </button>
      </aside>,
      document.body
    );
  }

  const currentColorConfig = COLOR_MAP[activeNote?.color || 'amber'];

  return createPortal(
    <div
      role="region"
      aria-label="Cửa sổ ghi chú nhanh"
      className={`fixed inset-0 z-[9999] flex ${
        isPinned
          ? 'items-end justify-end p-4 sm:p-6 pointer-events-none'
          : 'items-center justify-center p-3 sm:p-5 md:p-6'
      } font-sans select-none animate-in fade-in duration-180`}
    >
      {/* Full Backdrop (only when NOT pinned in PiP mode) */}
      {!isPinned && (
        <div
          className="fixed inset-0 bg-black/35 dark:bg-black/70 backdrop-blur-md transition-opacity"
          onClick={closeNote}
        />
      )}

      {/* ─────────────────── Liquid Glass Note Window ─────────────────── */}
      <div
        className={`pointer-events-auto relative ${
          isPinned
            ? showSidebar
              ? 'w-[780px] max-w-[96vw]'
              : 'w-[520px] max-w-[96vw]'
            : showSidebar
            ? 'w-[880px] max-w-[96vw]'
            : 'w-[600px] max-w-[96vw]'
        } h-[600px] max-h-[90vh] bg-white/95 dark:bg-[#16161c]/95 backdrop-blur-3xl rounded-[28px] border border-white/80 dark:border-white/15 shadow-[0_24px_80px_rgba(0,0,0,0.18),inset_0_1.5px_1px_rgba(255,255,255,1),inset_0_-1px_1.5px_rgba(0,0,0,0.06)] dark:shadow-[0_28px_90px_rgba(0,0,0,0.85),inset_0_1px_1px_rgba(255,255,255,0.18)] flex overflow-hidden z-10 transition-all duration-300 ease-out`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Meniscus Specular Reflection */}
        <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/90 dark:via-white/25 to-transparent pointer-events-none z-20" />

        {/* ───────── Collapsible Notes List Sidebar ───────── */}
        {showSidebar && (
          <div className="w-64 sm:w-68 border-r border-black/[0.06] dark:border-white/10 flex flex-col bg-black/[0.015] dark:bg-white/[0.015] shrink-0 animate-in slide-in-from-left duration-200">
            {/* Sidebar Search Bar */}
            <div className="p-3 border-b border-black/[0.06] dark:border-white/10">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[#86868b] absolute left-3 top-2.5 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Tìm ghi chú..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 rounded-full text-[12px] bg-white/80 dark:bg-white/10 border border-black/10 dark:border-white/10 focus:border-amber-500/40 focus:ring-0 focus:outline-none outline-none text-[#1d1d1f] dark:text-[#f5f5f7] placeholder:text-[#86868b]"
                />
              </div>
            </div>

            {/* Notes List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {filteredNotes.map((note) => {
                const isSelected = note.id === activeNote?.id;
                const dotColor = COLOR_MAP[note.color || 'amber'].dot;
                const hasReminder = Boolean(note.reminderAt && !note.reminderCompleted);

                return (
                  <div
                    key={note.id}
                    onClick={() => selectNote(note.id)}
                    className={`group relative p-2.5 rounded-xl cursor-pointer transition-all duration-150 ${
                      isSelected
                        ? 'bg-amber-500/12 dark:bg-amber-400/15 border border-amber-500/30 dark:border-amber-400/35 shadow-xs'
                        : 'hover:bg-black/5 dark:hover:bg-white/5 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className={`w-2 h-2 rounded-full ${dotColor} shrink-0`} />
                        <h5
                          className={`text-[12.5px] font-semibold truncate ${
                            isSelected
                              ? 'text-amber-900 dark:text-amber-200'
                              : 'text-[#1d1d1f] dark:text-[#f5f5f7]'
                          }`}
                        >
                          {note.title || 'Ghi chú mới'}
                        </h5>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {hasReminder && (
                          <span title="Có lịch nhắc">
                            <Clock className="w-3 h-3 text-amber-500 fill-amber-500/20" />
                          </span>
                        )}
                        {note.pinned && (
                          <Pin className="w-3 h-3 text-amber-500 fill-amber-500" />
                        )}
                      </div>
                    </div>

                    <p className="text-[11px] text-[#76767b] dark:text-[#a1a1a6] line-clamp-1">
                      {note.content.split('\n')[1] || note.content || 'Trống...'}
                    </p>

                    <div className="flex items-center justify-between text-[10px] text-[#86868b] dark:text-[#76767b] mt-1 font-mono">
                      <span>
                        {new Date(note.updatedAt).toLocaleDateString('vi-VN', {
                          day: '2-digit',
                          month: '2-digit',
                        })}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteNote(note.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 hover:text-rose-600 transition-opacity p-0.5"
                        title="Xóa ghi chú"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ───────── Main Editor Column ───────── */}
        <div className="flex-1 flex flex-col min-w-0 relative">
          {/* Apple Window Title Bar */}
          <div className="h-14 px-4 sm:px-5 border-b border-black/[0.06] dark:border-white/10 flex items-center justify-between shrink-0 bg-white/50 dark:bg-white/[0.02]">
            {/* Left Controls: Sidebar toggle + Brand + Add Note */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowSidebar(!showSidebar)}
                className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
                  showSidebar
                    ? 'bg-[#0071e3]/15 text-[#0071e3] dark:text-[#2997ff]'
                    : 'text-[#76767b] hover:text-[#1d1d1f] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10'
                }`}
                title={showSidebar ? 'Ẩn danh sách ghi chú' : 'Hiện danh sách ghi chú'}
              >
                {showSidebar ? (
                  <PanelLeftClose className="w-4 h-4" />
                ) : (
                  <PanelLeft className="w-4 h-4" />
                )}
              </button>

              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-gradient-to-b from-[#ffd60a] to-[#ff9f0a] flex items-center justify-center text-white shadow-xs">
                  <FileText className="w-3.5 h-3.5" />
                </div>
                <span className="text-[13px] font-bold text-[#1d1d1f] dark:text-white hidden sm:inline">
                  Ghi Chú Nhanh
                </span>
              </div>

              <button
                type="button"
                onClick={() => createNote()}
                className="w-7 h-7 rounded-full bg-[#0071e3]/10 dark:bg-[#2997ff]/15 text-[#0066cc] dark:text-[#2997ff] hover:bg-[#0071e3] hover:text-white transition-all flex items-center justify-center cursor-pointer active:scale-90 ml-1"
                title="Tạo ghi chú mới"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* Right Window Controls: Reminder, Pin, Minimize, Close */}
            <div className="flex items-center gap-1.5 shrink-0 pl-2">
              {/* Reminder / Scheduling button */}
              {activeNote && (
                <button
                  type="button"
                  onClick={handleOpenReminderModal}
                  className={`h-7 px-2.5 rounded-full flex items-center gap-1.5 text-[11.5px] font-medium transition-all cursor-pointer ${
                    activeNote.reminderAt && !activeNote.reminderCompleted
                      ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 shadow-xs'
                      : 'text-[#76767b] hover:text-[#1d1d1f] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10'
                  }`}
                  title="Cài lịch nhắc nhở & thông báo email"
                >
                  {activeNote.reminderAt && !activeNote.reminderCompleted ? (
                    <>
                      <BellRing className="w-3.5 h-3.5 text-amber-500 animate-bounce" />
                      <span className="hidden md:inline font-mono text-[10.5px]">
                        {new Date(activeNote.reminderAt).toLocaleTimeString('vi-VN', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </>
                  ) : (
                    <>
                      <Bell className="w-3.5 h-3.5" />
                      <span className="hidden md:inline">Nhắc nhở</span>
                    </>
                  )}
                </button>
              )}

              {/* Always-on-top Pin */}
              <button
                type="button"
                onClick={togglePinned}
                className={`w-7 h-7 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                  isPinned
                    ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 shadow-xs'
                    : 'text-[#76767b] hover:text-[#1d1d1f] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10'
                }`}
                title={isPinned ? 'Bỏ chế độ ghim nổi (PiP)' : 'Ghim nổi trên cùng khi làm việc'}
              >
                {isPinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
              </button>

              {/* Minimize to capsule */}
              <button
                type="button"
                onClick={() => setMinimized(true)}
                className="w-7 h-7 rounded-full text-[#76767b] hover:text-[#1d1d1f] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 flex items-center justify-center transition-colors cursor-pointer"
                title="Thu nhỏ xuống thanh nổi"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>

              {/* Close window */}
              <button
                type="button"
                onClick={closeNote}
                className="w-7 h-7 rounded-full text-[#76767b] hover:text-[#1d1d1f] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 flex items-center justify-center transition-colors cursor-pointer"
                title="Đóng (Esc)"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Note Editor Area */}
          {activeNote ? (
            <div className="flex-1 flex flex-col p-5 sm:p-6 overflow-hidden apple-note-canvas">
              {/* Title input - Apple Large Headline Typography */}
              <div className="mb-1 shrink-0">
                <input
                  type="text"
                  value={localTitle}
                  onChange={handleTitleChange}
                  placeholder="Tiêu đề ghi chú..."
                  style={{ border: 'none', outline: 'none', boxShadow: 'none' }}
                  className="w-full text-[21px] sm:text-[23px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7] bg-transparent !border-0 !border-none !outline-none !shadow-none !ring-0 focus:!ring-0 focus:!outline-none focus:!border-none placeholder:text-[#86868b]/40 tracking-tight p-0 selection:bg-amber-500/20 selection:text-amber-800 dark:selection:text-amber-200"
                />
              </div>

              {/* Reminder Active HUD Banner (if scheduled) */}
              {activeNote.reminderAt && !activeNote.reminderCompleted && (
                <div className="flex items-center justify-between px-3 py-1.5 rounded-full bg-amber-500/10 dark:bg-amber-400/15 border border-amber-500/25 dark:border-amber-400/30 text-amber-800 dark:text-amber-200 text-[11.5px] mb-2 shrink-0 animate-in fade-in duration-200">
                  <div className="flex items-center gap-2 min-w-0 truncate">
                    <span className="flex h-2 w-2 relative shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                    </span>
                    <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                    <span className="font-semibold truncate">
                      {new Date(activeNote.reminderAt).toLocaleString('vi-VN', {
                        hour: '2-digit',
                        minute: '2-digit',
                        day: '2-digit',
                        month: '2-digit',
                      })}
                    </span>
                    <span className="opacity-70 text-[11px] hidden sm:inline">
                      • {activeNote.reminderNotifyEmail ? 'Desktop & Email' : 'Desktop'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 text-[11px]">
                    <button
                      type="button"
                      onClick={handleOpenReminderModal}
                      className="hover:underline font-medium cursor-pointer"
                    >
                      Đổi giờ
                    </button>
                    <span>•</span>
                    <button
                      type="button"
                      onClick={handleRemoveReminder}
                      className="hover:text-rose-600 font-medium cursor-pointer"
                    >
                      Hủy
                    </button>
                  </div>
                </div>
              )}

              {/* Timestamp & Auto-save status */}
              <div className="flex items-center justify-between gap-3 text-[11px] text-[#86868b] dark:text-[#76767b] pb-2.5 pt-1 border-b border-black/[0.04] dark:border-white/[0.06] mb-3 shrink-0">
                <div className="flex items-center gap-2 whitespace-nowrap min-w-0">
                  <span className="font-medium text-[#86868b] dark:text-[#a1a1a6] truncate">
                    {new Date(activeNote.updatedAt).toLocaleTimeString('vi-VN', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}{' '}
                    • {localContent.length} ký tự
                  </span>
                  <span className="text-[#34c759] inline-flex items-center gap-1 font-medium shrink-0">
                    <Sparkles className="w-3 h-3 text-[#34c759]" /> Tự động lưu
                  </span>
                </div>

                {/* Quick Note Color Tag Selector */}
                <div className="flex items-center gap-1.5 p-1 rounded-full bg-black/[0.03] dark:bg-white/[0.05] border border-black/[0.03] dark:border-white/[0.05] shrink-0">
                  {(['amber', 'blue', 'emerald', 'purple', 'rose'] as QuickNoteColor[]).map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => changeColorNote(activeNote.id, c)}
                      className={`w-3.5 h-3.5 rounded-full ${COLOR_MAP[c].dot} transition-transform ${
                        activeNote.color === c ? 'scale-110 ring-2 ring-black/20 dark:ring-white/40 shadow-xs' : 'opacity-60 hover:opacity-100 hover:scale-105'
                      }`}
                      title={`Màu ${c}`}
                    />
                  ))}
                </div>
              </div>

              {/* ──────────────── CONTENT AREA: TEXT VS INTERACTIVE CHECKLIST ──────────────── */}
              {editorMode === 'checklist' ? (
                <div className="flex-1 flex flex-col min-h-0 overflow-y-auto pr-1 space-y-2.5">
                  {/* Progress Bar & Actions */}
                  {checklistTotal > 0 && (
                    <div className="p-3 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.04] dark:border-white/[0.06] shrink-0 space-y-2">
                      <div className="flex items-center justify-between text-[12px]">
                        <span className="font-medium text-slate-700 dark:text-slate-300">
                          Tiến độ: <strong className="text-emerald-600 dark:text-emerald-400">{checklistCompleted}/{checklistTotal} việc</strong> ({checklistPercent}%)
                        </span>
                        <div className="flex items-center gap-2 text-[11px]">
                          {checklistCompleted < checklistTotal ? (
                            <button
                              type="button"
                              onClick={() => handleToggleAllChecklist(true)}
                              className="text-[#0071e3] dark:text-[#2997ff] hover:underline cursor-pointer font-medium"
                            >
                              Xong tất cả
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleToggleAllChecklist(false)}
                              className="text-slate-500 hover:underline cursor-pointer"
                            >
                              Bỏ chọn
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="w-full h-1.5 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-300 rounded-full"
                          style={{ width: `${checklistPercent}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Interactive Checklist Rows */}
                  <div className="space-y-1.5 flex-1">
                    {checklistRows.map((row, idx) => (
                      <div
                        key={`row-${row.lineIndex}-${idx}`}
                        className={`group flex items-center gap-3 p-2.5 rounded-xl border transition-all duration-200 ${
                          row.completed
                            ? 'bg-emerald-500/[0.04] dark:bg-emerald-400/[0.05] border-emerald-500/20'
                            : 'bg-white/60 dark:bg-white/[0.03] border-black/[0.04] dark:border-white/[0.06] hover:border-amber-500/30'
                        }`}
                      >
                        {/* Interactive Clickable Round Apple Checkbox */}
                        <button
                          type="button"
                          onClick={() => handleToggleChecklistRow(row.lineIndex)}
                          className={`w-5 h-5 rounded-full flex items-center justify-center transition-all cursor-pointer shrink-0 active:scale-90 ${
                            row.completed
                              ? 'bg-emerald-500 dark:bg-emerald-400 text-white shadow-xs scale-105'
                              : 'border-2 border-black/25 dark:border-white/30 hover:border-amber-500 hover:scale-105'
                          }`}
                          title={row.completed ? 'Đánh dấu chưa xong' : 'Đánh dấu đã hoàn thành'}
                        >
                          {row.completed && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </button>

                        {/* Direct Editable Task Text Input */}
                        <input
                          type="text"
                          value={row.text}
                          onChange={(e) => handleUpdateChecklistRowText(row.lineIndex, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleInsertChecklistRowAfter(row.lineIndex);
                            } else if (e.key === 'Backspace' && row.text === '') {
                              e.preventDefault();
                              handleDeleteChecklistRow(row.lineIndex);
                            }
                          }}
                          placeholder="Nhập việc cần làm..."
                          className={`checklist-item-input flex-1 bg-transparent !border-0 !border-none !outline-none !shadow-none !ring-0 text-[14px] ${
                            row.completed
                              ? 'line-through text-[#86868b] dark:text-[#76767b]'
                              : 'text-[#1d1d1f] dark:text-[#f5f5f7]'
                          }`}
                        />

                        {/* Delete row button */}
                        <button
                          type="button"
                          onClick={() => handleDeleteChecklistRow(row.lineIndex)}
                          className="opacity-0 group-hover:opacity-100 hover:text-rose-600 transition-opacity p-1 text-[#86868b] cursor-pointer"
                          title="Xóa dòng này"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}

                    {/* Add New Item Button inside list */}
                    <button
                      type="button"
                      onClick={() => handleInsertChecklistRowAfter()}
                      className="w-full flex items-center gap-2.5 p-2.5 rounded-xl border border-dashed border-black/15 dark:border-white/15 hover:border-amber-500/50 hover:bg-amber-500/[0.04] text-[13px] text-[#76767b] hover:text-amber-600 dark:hover:text-amber-400 transition-all cursor-pointer mt-2"
                    >
                      <Plus className="w-4 h-4 text-amber-500" />
                      <span>Thêm mục mới... (Nhấn Enter)</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* Seamless Flowing Writing Canvas */
                <div className="flex-1 flex flex-col min-h-0">
                  {checklistTotal > 0 && (
                    <div className="flex items-center justify-between px-3.5 py-2 mb-2.5 rounded-2xl bg-amber-500/[0.08] dark:bg-amber-400/[0.1] border border-amber-500/20 text-[12px] text-amber-900 dark:text-amber-200 shrink-0 animate-in fade-in duration-150">
                      <div className="flex items-center gap-2">
                        <CheckSquare className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                        <span>Ghi chú này có <strong>{checklistTotal} mục việc cần làm</strong></span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEditorMode('checklist')}
                        className="font-semibold text-[#0071e3] dark:text-[#2997ff] hover:underline cursor-pointer flex items-center gap-1"
                      >
                        <span>Mở hộp Checklist</span> →
                      </button>
                    </div>
                  )}
                  <textarea
                    ref={contentRef}
                    value={localContent}
                    onChange={handleContentChange}
                    placeholder="Gõ ghi chú, kế hoạch thu mua, thông tin cần nhớ... (Phím tắt Alt + N)"
                    style={{ border: 'none', outline: 'none', boxShadow: 'none' }}
                    className="flex-1 w-full bg-transparent !border-0 !border-none !outline-none !shadow-none !ring-0 focus:!ring-0 focus:!outline-none focus:!border-none resize-none font-sans text-[14.5px] leading-relaxed text-[#1d1d1f] dark:text-[#f5f5f7] placeholder:text-[#86868b]/50 dark:placeholder:text-[#636366]/60 p-0 selection:bg-amber-500/20 selection:text-amber-800 dark:selection:text-amber-200"
                  />
                </div>
              )}

              {/* Bottom Quick Tools Bar - Apple Liquid Glass Dock */}
              <div className="pt-3 border-t border-black/[0.04] dark:border-white/[0.06] flex items-center justify-between gap-3 shrink-0">
                {/* The ONE and ONLY Mode Switcher: Ghi chú vs Checklist */}
                <div className="inline-flex items-center p-1 rounded-full bg-black/[0.04] dark:bg-white/[0.06] border border-black/[0.05] dark:border-white/[0.08] backdrop-blur-xl shrink-0">
                  <button
                    type="button"
                    onClick={() => setEditorMode('text')}
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[12px] font-medium transition-all duration-200 cursor-pointer whitespace-nowrap ${
                      editorMode === 'text'
                        ? 'bg-white dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-white shadow-[0_2px_8px_rgba(0,0,0,0.08),inset_0_1px_0.5px_rgba(255,255,255,0.9)] scale-[1.01]'
                        : 'text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-white'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5 text-[#0071e3] dark:text-[#2997ff]" />
                    <span>Ghi chú</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleActivateChecklistMode}
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[12px] font-medium transition-all duration-200 cursor-pointer whitespace-nowrap ${
                      editorMode === 'checklist'
                        ? 'bg-white dark:bg-[#2c2c2e] text-amber-700 dark:text-amber-300 shadow-[0_2px_8px_rgba(0,0,0,0.08),inset_0_1px_0.5px_rgba(255,255,255,0.9)] scale-[1.01]'
                        : 'text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-white'
                    }`}
                  >
                    <CheckSquare className="w-3.5 h-3.5 text-amber-500" />
                    <span>Checklist</span>
                    {checklistTotal > 0 && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 ml-0.5">
                        {checklistCompleted}/{checklistTotal}
                      </span>
                    )}
                  </button>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {/* Copy note button */}
                  <button
                    type="button"
                    onClick={handleCopyNote}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[12.5px] font-medium bg-black/[0.03] dark:bg-white/[0.06] hover:bg-black/[0.06] dark:hover:bg-white/[0.1] text-[#1d1d1f] dark:text-[#f5f5f7] transition-all cursor-pointer active:scale-95 border border-black/[0.04] dark:border-white/[0.08]"
                    title="Sao chép toàn bộ ghi chú"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-[#34c759]" />
                        <span className="text-[#34c759] font-medium">Đã chép</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-[#76767b] dark:text-[#a1a1a6]" />
                        <span>Sao chép</span>
                      </>
                    )}
                  </button>

                  {/* Delete note button */}
                  <button
                    type="button"
                    onClick={() => deleteNote(activeNote.id)}
                    className="w-8 h-8 rounded-full hover:bg-rose-500/10 text-[#76767b] hover:text-rose-600 flex items-center justify-center transition-colors cursor-pointer"
                    title="Xóa ghi chú này"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-[#76767b]">
              <FileText className="w-10 h-10 opacity-30 mb-2" />
              <p className="text-sm font-medium">Chưa có ghi chú nào</p>
              <button
                type="button"
                onClick={() => createNote()}
                className="mt-3 px-4 py-1.5 rounded-full bg-[#0071e3] text-white text-xs font-semibold shadow-xs hover:bg-[#0077ed] transition-all cursor-pointer active:scale-95"
              >
                Tạo ghi chú ngay
              </button>
            </div>
          )}

          {/* ─────────────────── Apple Liquid Glass Reminder Popover ─────────────────── */}
          {showReminderModal && (
            <div className="absolute inset-0 z-30 bg-black/40 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150">
              <div className="w-full max-w-md bg-white/95 dark:bg-[#1c1c24]/95 backdrop-blur-3xl rounded-[24px] border border-white/80 dark:border-white/15 shadow-[0_20px_60px_rgba(0,0,0,0.3)] p-5 space-y-4 text-left animate-in zoom-in-95 duration-150">
                {/* Header */}
                <div className="flex items-center justify-between pb-3 border-b border-black/[0.06] dark:border-white/10">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                      <BellRing className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-[14.5px] text-[#1d1d1f] dark:text-white">
                        Cài Lịch Nhắc Nhở & Email
                      </h4>
                      <p className="text-[11px] text-[#86868b] dark:text-[#a1a1a6]">
                        Hệ thống sẽ phát chuông kính Apple và báo nhắc đúng giờ
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowReminderModal(false)}
                    className="w-7 h-7 rounded-full hover:bg-black/5 dark:hover:bg-white/10 flex items-center justify-center text-[#76767b] cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Quick Presets */}
                <div className="space-y-1.5">
                  <label className="text-[11.5px] font-semibold text-[#86868b] dark:text-[#a1a1a6] uppercase tracking-wider">
                    Gợi ý thời gian nhanh
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleApplyPreset(30)}
                      className="px-3 py-2 rounded-xl text-[12px] font-medium bg-black/[0.03] dark:bg-white/[0.05] hover:bg-amber-500/10 hover:text-amber-600 dark:hover:text-amber-400 transition-colors text-left border border-black/[0.04] dark:border-white/[0.06] cursor-pointer"
                    >
                      ⚡ Sau 30 phút nữa
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyPresetTime(15, 0)}
                      className="px-3 py-2 rounded-xl text-[12px] font-medium bg-black/[0.03] dark:bg-white/[0.05] hover:bg-amber-500/10 hover:text-amber-600 dark:hover:text-amber-400 transition-colors text-left border border-black/[0.04] dark:border-white/[0.06] cursor-pointer"
                    >
                      ☀️ Chiều nay 15:00
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyPresetTime(9, 0, true)}
                      className="px-3 py-2 rounded-xl text-[12px] font-medium bg-black/[0.03] dark:bg-white/[0.05] hover:bg-amber-500/10 hover:text-amber-600 dark:hover:text-amber-400 transition-colors text-left border border-black/[0.04] dark:border-white/[0.06] cursor-pointer"
                    >
                      🌅 Sáng mai 09:00
                    </button>
                    <button
                      type="button"
                      onClick={handleApplyNextMonday}
                      className="px-3 py-2 rounded-xl text-[12px] font-medium bg-black/[0.03] dark:bg-white/[0.05] hover:bg-amber-500/10 hover:text-amber-600 dark:hover:text-amber-400 transition-colors text-left border border-black/[0.04] dark:border-white/[0.06] cursor-pointer"
                    >
                      📅 Thứ Hai tới 08:30
                    </button>
                  </div>
                </div>

                {/* Custom Date & Time Picker */}
                <div className="space-y-1.5">
                  <label className="text-[11.5px] font-semibold text-[#86868b] dark:text-[#a1a1a6] uppercase tracking-wider">
                    Chọn thời gian cụ thể
                  </label>
                  <input
                    type="datetime-local"
                    value={reminderDate}
                    onChange={(e) => setReminderDate(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl text-[13px] font-medium bg-white dark:bg-white/10 border border-black/15 dark:border-white/15 focus:border-[#0071e3] outline-none text-[#1d1d1f] dark:text-white"
                  />
                </div>

                {/* Notification Channels */}
                <div className="space-y-2 pt-1 border-t border-black/[0.06] dark:border-white/10">
                  <label className="text-[11.5px] font-semibold text-[#86868b] dark:text-[#a1a1a6] uppercase tracking-wider">
                    Kênh nhận thông báo
                  </label>

                  {/* Desktop Push Notification Toggle */}
                  <label className="flex items-center gap-3 p-2 rounded-xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.04] dark:border-white/[0.06] cursor-pointer hover:bg-black/[0.04]">
                    <input
                      type="checkbox"
                      checked={reminderDesktop}
                      onChange={(e) => setReminderDesktop(e.target.checked)}
                      className="w-4 h-4 rounded text-[#0071e3] accent-[#0071e3] cursor-pointer"
                    />
                    <div className="flex-1 text-[12.5px]">
                      <span className="font-medium text-[#1d1d1f] dark:text-white">
                        Thông báo màn hình & Chuông Apple
                      </span>
                      <p className="text-[11px] text-[#86868b] dark:text-[#a1a1a6]">
                        Hiển thị banner máy tính và phát âm thanh chuông kính
                      </p>
                    </div>
                  </label>

                  {/* Email Notification Toggle */}
                  <label className="flex items-center gap-3 p-2 rounded-xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.04] dark:border-white/[0.06] cursor-pointer hover:bg-black/[0.04]">
                    <input
                      type="checkbox"
                      checked={reminderEmail}
                      onChange={(e) => setReminderEmail(e.target.checked)}
                      className="w-4 h-4 rounded text-[#0071e3] accent-[#0071e3] cursor-pointer"
                    />
                    <div className="flex-1 text-[12.5px]">
                      <span className="font-medium text-[#1d1d1f] dark:text-white">
                        Gửi thông báo nhắc qua Email
                      </span>
                      <p className="text-[11px] text-[#86868b] dark:text-[#a1a1a6]">
                        Soạn sẵn thư qua ứng dụng Mail / Outlook / Webmail
                      </p>
                    </div>
                  </label>

                  {/* Email address input when email is enabled */}
                  {reminderEmail && (
                    <div className="pl-7 space-y-1.5 animate-in fade-in duration-150">
                      <div className="flex items-center gap-2">
                        <input
                          type="email"
                          placeholder="Nhập email (vd: thumua@farmersmarket.vn)"
                          value={reminderEmailInput}
                          onChange={(e) => setReminderEmailInput(e.target.value)}
                          className="flex-1 px-3 py-1.5 rounded-lg text-[12px] bg-white dark:bg-white/10 border border-black/15 dark:border-white/15 text-[#1d1d1f] dark:text-white placeholder:text-[#86868b]"
                        />
                        <button
                          type="button"
                          onClick={handleSendTestEmail}
                          className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-[#0071e3]/10 text-[#0066cc] dark:text-[#2997ff] hover:bg-[#0071e3] hover:text-white transition-colors cursor-pointer shrink-0"
                          title="Mở thử email ngay bây giờ"
                        >
                          Gửi thử ngay
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer Actions */}
                <div className="pt-3 border-t border-black/[0.06] dark:border-white/10 flex items-center justify-between gap-2">
                  {activeNote.reminderAt ? (
                    <button
                      type="button"
                      onClick={handleRemoveReminder}
                      className="px-3 py-1.5 rounded-full text-[12px] font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                    >
                      Hủy lịch hẹn
                    </button>
                  ) : <div />}

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowReminderModal(false)}
                      className="px-3.5 py-1.5 rounded-full text-[12px] font-medium text-[#76767b] hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
                    >
                      Đóng
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveReminder}
                      className="px-4 py-1.5 rounded-full text-[12px] font-semibold bg-[#0071e3] hover:bg-[#0077ed] text-white shadow-xs transition-all cursor-pointer active:scale-95"
                    >
                      Lưu lịch nhắc
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
