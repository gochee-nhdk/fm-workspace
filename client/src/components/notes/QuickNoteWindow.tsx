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
  ExternalLink,
} from 'lucide-react';
import { useNoteStore } from '@/stores/note-store';
import { QuickNoteColor, QuickNoteItem, TaskReminder, EmailProviderType } from '@/types/workspace';
import { reminderService, playAppleChime } from '@/services/reminderService';
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
 * Format badge text for task reminder chip
 */
const formatReminderBadge = (isoString?: string | null): string => {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const timeStr = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    if (isToday) return `${timeStr} Hôm nay`;
    return `${timeStr} ${d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}`;
  } catch (_) {
    return '';
  }
};

/**
 * Subtle tactile pop sound when clicking checkbox
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
  taskId: string;
  completed: boolean;
  text: string;
  reminderAt?: string | null;
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

  // Main reminder modal state
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [reminderScope, setReminderScope] = useState<'note' | 'checklist'>('note');
  const [reminderDate, setReminderDate] = useState('');
  const [reminderDesktop, setReminderDesktop] = useState(true);
  const [reminderEmail, setReminderEmail] = useState(false);
  const [reminderEmailInput, setReminderEmailInput] = useState('');
  const [reminderProvider, setReminderProvider] = useState<EmailProviderType>('gmail');
  const [isSendingTestEmail, setIsSendingTestEmail] = useState(false);

  // SMTP configuration state
  const [smtpConfigured, setSmtpConfigured] = useState<boolean | null>(null);
  const [smtpSenderUser, setSmtpSenderUser] = useState<string>('');
  const [showSmtpSetup, setShowSmtpSetup] = useState<boolean>(false);
  const [smtpInputUser, setSmtpInputUser] = useState<string>('');
  const [smtpInputPass, setSmtpInputPass] = useState<string>('');
  const [smtpInputSenderName, setSmtpInputSenderName] = useState<string>('Trợ Lý Thu Mua');
  const [isVerifyingSmtp, setIsVerifyingSmtp] = useState<boolean>(false);

  // Individual task reminder popover state
  const [taskReminderPopover, setTaskReminderPopover] = useState<{
    lineIndex: number;
    taskId: string;
    taskText: string;
    reminderAt: string;
  } | null>(null);

  const contentRef = useRef<HTMLTextAreaElement>(null);

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

        // Sync note-level reminder state
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
        setReminderProvider(activeNote.emailProvider || reminderService.getPreferredProvider() || 'gmail');
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

  // ──────── Parse Checklist Rows & match taskReminders ────────
  const checklistRows: ChecklistRow[] = useMemo(() => {
    const lines = localContent.split('\n');
    const rows: ChecklistRow[] = [];
    const taskReminders = activeNote?.taskReminders || [];

    lines.forEach((line, idx) => {
      const match = line.match(/^-\s*\[([ xX])\]\s*(.*)$/);
      if (match) {
        const taskId = `task-${idx}`;
        const taskText = match[2];
        const reminder = taskReminders.find(
          (tr) => (tr.id === taskId || tr.taskText === taskText) && !tr.reminderCompleted
        );

        rows.push({
          lineIndex: idx,
          taskId,
          completed: match[1].toLowerCase() === 'x',
          text: taskText,
          reminderAt: reminder?.reminderAt || null,
        });
      }
    });
    return rows;
  }, [localContent, activeNote?.taskReminders]);

  const checklistTotal = checklistRows.length;
  const checklistCompleted = checklistRows.filter((r) => r.completed).length;
  const checklistPercent = checklistTotal > 0 ? Math.round((checklistCompleted / checklistTotal) * 100) : 0;
  const activeTaskRemindersCount = (activeNote?.taskReminders || []).filter((tr) => !tr.reminderCompleted).length;

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

    // Clean up task reminder for this deleted row
    const taskId = `task-${lineIndex}`;
    const filteredReminders = (activeNote?.taskReminders || []).filter((tr) => tr.id !== taskId);
    updateActiveNote({ content: newContent, taskReminders: filteredReminders });
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

  // Switch to text mode & strip checklist markdown so no raw '- [ ]' shows up
  const handleSwitchToTextMode = () => {
    if (editorMode === 'text') return;
    const cleaned = localContent
      .split('\n')
      .map((l) => l.replace(/^-\s*\[[ xX]\]\s*/, ''))
      .join('\n');
    setLocalContent(cleaned);
    updateActiveNote({ content: cleaned });
    setEditorMode('text');
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

  // ──────── Individual Task Reminder Handlers ────────
  const handleSaveIndividualTaskReminder = async (
    lineIndex: number,
    taskId: string,
    taskText: string,
    datetimeStr: string | null
  ) => {
    if (!activeNote) return;

    if (reminderDesktop) {
      await reminderService.requestNotificationPermission();
    }

    const currentReminders = [...(activeNote.taskReminders || [])];
    const filtered = currentReminders.filter((tr) => tr.id !== taskId && tr.taskText !== taskText);

    if (datetimeStr) {
      const iso = new Date(datetimeStr).toISOString();
      filtered.push({
        id: taskId,
        taskText: taskText.trim() || 'Việc cần làm',
        reminderAt: iso,
        reminderCompleted: false,
      });

      toast.success(
        `⏰ Đã đặt giờ nhắc: "${(taskText.trim() || 'Mục này').slice(0, 24)}" lúc ${new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`,
        { id: 'task-reminder' }
      );
    } else {
      toast.success('Đã hủy lịch nhắc việc này', { id: 'task-reminder-cancel' });
    }

    updateActiveNote({ taskReminders: filtered });
    setTaskReminderPopover(null);
  };

  // ──────── Main Note Reminder Handlers ────────
  const handleOpenReminderModal = () => {
    setReminderScope('note');
    if (activeNote?.reminderAt) {
      try {
        setReminderDate(toDatetimeLocal(new Date(activeNote.reminderAt)));
      } catch (_) {
        setReminderDate(toDatetimeLocal(new Date(Date.now() + 30 * 60 * 1000)));
      }
    } else {
      setReminderDate(toDatetimeLocal(new Date(Date.now() + 30 * 60 * 1000)));
    }
    setReminderDesktop(activeNote?.reminderNotifyDesktop ?? true);
    setReminderEmail(activeNote?.reminderNotifyEmail ?? false);
    const initialEmail = activeNote?.reminderEmail || reminderService.getPreferredEmail() || 'kaka.nhdk@gmail.com';
    setReminderEmailInput(initialEmail);
    setReminderProvider(activeNote?.emailProvider || reminderService.getPreferredProvider() || 'gmail');
    setShowReminderModal(true);

    // Fetch live SMTP configuration status
    reminderService.getSmtpStatus().then((status) => {
      setSmtpConfigured(status.configured);
      setSmtpSenderUser(status.fullUser || status.smtpUser || '');
      if (!smtpInputUser) {
        setSmtpInputUser(status.fullUser || initialEmail);
      }
    });
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

    if (reminderDesktop) {
      const granted = await reminderService.requestNotificationPermission();
      if (!granted) {
        toast('Hãy cấp quyền thông báo trên trình duyệt để nhận chuông nhắc', { icon: '🔔' });
      }
    }

    const emailToSave = reminderEmailInput.trim() || reminderService.getPreferredEmail() || 'kaka.nhdk@gmail.com';
    if (reminderEmail && emailToSave) {
      reminderService.setPreferredEmail(emailToSave);
    }
    reminderService.setPreferredProvider(reminderProvider);

    updateActiveNote({
      reminderAt: reminderIso,
      reminderNotifyDesktop: reminderDesktop,
      reminderNotifyEmail: reminderEmail,
      reminderEmail: emailToSave,
      emailProvider: reminderProvider,
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

  const handleRemoveNoteReminder = () => {
    if (!activeNote) return;
    updateActiveNote({
      reminderAt: null,
      reminderCompleted: false,
    });
    setShowReminderModal(false);
    toast.success('Đã hủy lịch nhắc nhở toàn bộ ghi chú', { id: 'reminder-removed' });
  };

  const handleSaveSmtpConfig = async () => {
    if (!smtpInputUser.trim() || !smtpInputPass.trim()) {
      toast.error('Vui lòng nhập Email Gmail và Mật khẩu ứng dụng 16 ký tự');
      return;
    }
    setIsVerifyingSmtp(true);
    try {
      const res = await reminderService.configureSmtp({
        user: smtpInputUser.trim(),
        pass: smtpInputPass.trim(),
        senderName: smtpInputSenderName.trim() || 'Trợ Lý Thu Mua Farmers Market',
      });
      if (res.success) {
        setSmtpConfigured(true);
        setSmtpSenderUser(smtpInputUser.trim());
        setShowSmtpSetup(false);
        toast.success('🎉 Đã xác thực & kết nối máy chủ gửi mail Google SMTP thành công!');
      } else {
        toast.error(res.message, { duration: 6500 });
      }
    } finally {
      setIsVerifyingSmtp(false);
    }
  };

  const handleSendTestEmail = async () => {
    if (!activeNote) return;
    const target = reminderEmailInput.trim() || reminderService.getPreferredEmail();
    if (!target) {
      toast.error('Vui lòng nhập địa chỉ email người nhận trước');
      return;
    }

    if (smtpConfigured === false) {
      setShowSmtpSetup(true);
      toast('Vui lòng thiết lập tài khoản Gmail SMTP trước để hệ thống có thể gửi email thực tế.', { icon: '⚙️', duration: 5000 });
      return;
    }

    setIsSendingTestEmail(true);
    try {
      const res = await reminderService.sendAutomatedEmail({
        to: target,
        noteTitle: localTitle || activeNote.title || 'Ghi chú công việc',
        content: localContent,
        taskText: reminderScope === 'checklist' ? 'Kiểm tra thông báo checklist' : undefined,
      });

      if (res.success) {
        reminderService.setPreferredEmail(target);
        toast.success(`✉️ Hệ thống đã gửi email thực tế tới ${target}! Kiểm tra hộp thư đến (hoặc thư mục Spam).`, {
          id: 'test-email-sent',
          duration: 6000,
        });
      } else {
        if (res.configured === false) {
          setSmtpConfigured(false);
          setShowSmtpSetup(true);
        }
        toast.error(res.message || 'Không thể gửi email tự động', { id: 'test-email-error', duration: 7000 });
      }
    } finally {
      setIsSendingTestEmail(false);
    }
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
          {(activeNote?.reminderAt && !activeNote?.reminderCompleted) || activeTaskRemindersCount > 0 ? (
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" title="Có lịch nhắc việc" />
          ) : null}
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
                const hasNoteReminder = Boolean(note.reminderAt && !note.reminderCompleted);
                const hasTaskReminder = Boolean((note.taskReminders || []).some((tr) => !tr.reminderCompleted));

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
                        {(hasNoteReminder || hasTaskReminder) && (
                          <span title="Có lịch nhắc việc">
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

            {/* Right Window Controls: Pin, Minimize, Close */}
            <div className="flex items-center gap-1.5 shrink-0 pl-2">
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

              {/* Note Metadata Row: Timestamp, Auto-save status, Per-Note Reminder Button, Color Tags */}
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

                <div className="flex items-center gap-2 shrink-0">
                  {/* Note-Level Reminder Action: Clean Apple pill */}
                  {activeNote.reminderAt && !activeNote.reminderCompleted ? (
                    <button
                      type="button"
                      onClick={handleOpenReminderModal}
                      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-800 dark:text-amber-200 border border-amber-500/30 hover:bg-amber-500/25 transition-all cursor-pointer shadow-2xs group"
                      title="Nhấp để đổi giờ hoặc hủy nhắc hẹn cho ghi chú này"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                      <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                      <span>
                        {new Date(activeNote.reminderAt).toLocaleTimeString('vi-VN', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}{' '}
                        {new Date(activeNote.reminderAt).toLocaleDateString('vi-VN', {
                          day: '2-digit',
                          month: '2-digit',
                        })}
                      </span>
                      {activeNote.reminderNotifyEmail && <span className="opacity-75">✉️</span>}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleOpenReminderModal}
                      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-black/[0.03] dark:bg-white/[0.05] hover:bg-amber-500/10 text-[#76767b] hover:text-amber-600 dark:hover:text-amber-400 border border-black/[0.04] dark:border-white/[0.06] transition-all cursor-pointer"
                      title="Cài đặt lịch nhắc & gửi email cho ghi chú này"
                    >
                      <Bell className="w-3 h-3" />
                      <span>Hẹn giờ nhắc</span>
                    </button>
                  )}

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
                    {checklistRows.map((row) => (
                      <div
                        key={`row-${row.lineIndex}`}
                        className={`group flex items-center gap-2.5 p-2.5 rounded-xl border transition-all duration-200 ${
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

                        {/* Individual Task Reminder Chip / Clock Button */}
                        {row.reminderAt ? (
                          <button
                            type="button"
                            onClick={() =>
                              setTaskReminderPopover({
                                lineIndex: row.lineIndex,
                                taskId: row.taskId,
                                taskText: row.text,
                                reminderAt: toDatetimeLocal(new Date(row.reminderAt!)),
                              })
                            }
                            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 hover:bg-amber-500/25 transition-all cursor-pointer shrink-0 shadow-2xs"
                            title="Nhấp để đổi giờ hoặc hủy nhắc cho việc này"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                            <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                            <span>{formatReminderBadge(row.reminderAt)}</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              setTaskReminderPopover({
                                lineIndex: row.lineIndex,
                                taskId: row.taskId,
                                taskText: row.text,
                                reminderAt: toDatetimeLocal(new Date(Date.now() + 30 * 60 * 1000)),
                              })
                            }
                            className="opacity-0 group-hover:opacity-100 p-1 text-[#86868b] hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-500/10 rounded-full transition-all cursor-pointer shrink-0"
                            title="Hẹn giờ nhắc riêng cho mục việc này"
                          >
                            <Clock className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Delete row button */}
                        <button
                          type="button"
                          onClick={() => handleDeleteChecklistRow(row.lineIndex)}
                          className="opacity-0 group-hover:opacity-100 hover:text-rose-600 transition-opacity p-1 text-[#86868b] cursor-pointer shrink-0"
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
                    onClick={handleSwitchToTextMode}
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

                {/* Right Utility Actions: Copy & Delete */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleCopyNote}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[12px] font-medium bg-black/[0.03] dark:bg-white/[0.06] hover:bg-black/[0.06] dark:hover:bg-white/[0.1] text-[#1d1d1f] dark:text-[#f5f5f7] transition-all cursor-pointer active:scale-95 border border-black/[0.04] dark:border-white/[0.08]"
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

          {/* ─────────────────── Individual Task Reminder Mini Popover ─────────────────── */}
          {taskReminderPopover && (
            <div
              onClick={() => setTaskReminderPopover(null)}
              className="absolute inset-0 z-40 bg-black/25 dark:bg-black/55 flex items-center justify-center p-4 animate-in fade-in duration-150"
            >
              <div
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-sm bg-white dark:bg-[#1c1c24] rounded-[24px] border border-black/10 dark:border-white/15 shadow-[0_24px_70px_rgba(0,0,0,0.3)] p-5 space-y-4 text-left animate-in zoom-in-95 duration-150"
              >
                <div className="flex items-center justify-between pb-2.5 border-b border-black/[0.06] dark:border-white/10">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                      <Clock className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-[13.5px] text-[#1d1d1f] dark:text-white">
                        Hẹn Giờ Nhắc Việc
                      </h4>
                      <p className="text-[11px] text-[#86868b] dark:text-[#a1a1a6] truncate max-w-[200px]">
                        {taskReminderPopover.taskText || 'Mục việc cần làm'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTaskReminderPopover(null)}
                    className="w-6 h-6 rounded-full hover:bg-black/5 dark:hover:bg-white/10 flex items-center justify-center text-[#76767b] cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Quick Presets for this task */}
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      const d = new Date(Date.now() + 30 * 60 * 1000);
                      setTaskReminderPopover({ ...taskReminderPopover, reminderAt: toDatetimeLocal(d) });
                    }}
                    className="px-2.5 py-1.5 rounded-xl text-[11.5px] font-medium bg-black/[0.03] dark:bg-white/[0.05] hover:bg-amber-500/10 hover:text-amber-600 dark:hover:text-amber-400 transition-colors text-left border border-black/[0.04] dark:border-white/[0.06] cursor-pointer"
                  >
                    ⚡ Sau 30 phút
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const d = new Date();
                      d.setHours(15, 0, 0, 0);
                      if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1);
                      setTaskReminderPopover({ ...taskReminderPopover, reminderAt: toDatetimeLocal(d) });
                    }}
                    className="px-2.5 py-1.5 rounded-xl text-[11.5px] font-medium bg-black/[0.03] dark:bg-white/[0.05] hover:bg-amber-500/10 hover:text-amber-600 dark:hover:text-amber-400 transition-colors text-left border border-black/[0.04] dark:border-white/[0.06] cursor-pointer"
                  >
                    ☀️ Chiều nay 15h
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const d = new Date();
                      d.setDate(d.getDate() + 1);
                      d.setHours(9, 0, 0, 0);
                      setTaskReminderPopover({ ...taskReminderPopover, reminderAt: toDatetimeLocal(d) });
                    }}
                    className="px-2.5 py-1.5 rounded-xl text-[11.5px] font-medium bg-black/[0.03] dark:bg-white/[0.05] hover:bg-amber-500/10 hover:text-amber-600 dark:hover:text-amber-400 transition-colors text-left border border-black/[0.04] dark:border-white/[0.06] cursor-pointer"
                  >
                    🌅 Sáng mai 9h
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const d = new Date();
                      const day = d.getDay();
                      d.setDate(d.getDate() + ((7 - day + 1) % 7 || 7));
                      d.setHours(8, 30, 0, 0);
                      setTaskReminderPopover({ ...taskReminderPopover, reminderAt: toDatetimeLocal(d) });
                    }}
                    className="px-2.5 py-1.5 rounded-xl text-[11.5px] font-medium bg-black/[0.03] dark:bg-white/[0.05] hover:bg-amber-500/10 hover:text-amber-600 dark:hover:text-amber-400 transition-colors text-left border border-black/[0.04] dark:border-white/[0.06] cursor-pointer"
                  >
                    📅 Thứ Hai 8h30
                  </button>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-[#86868b] dark:text-[#a1a1a6]">
                    Chọn giờ cụ thể:
                  </label>
                  <input
                    type="datetime-local"
                    value={taskReminderPopover.reminderAt}
                    onChange={(e) => setTaskReminderPopover({ ...taskReminderPopover, reminderAt: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-xl text-[12.5px] bg-white dark:bg-white/10 border border-black/15 dark:border-white/15 outline-none focus:border-[#0071e3] text-[#1d1d1f] dark:text-white"
                  />
                </div>

                <div className="pt-2 border-t border-black/[0.06] dark:border-white/10 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      handleSaveIndividualTaskReminder(
                        taskReminderPopover.lineIndex,
                        taskReminderPopover.taskId,
                        taskReminderPopover.taskText,
                        null
                      )
                    }
                    className="text-[11.5px] text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
                  >
                    Hủy nhắc việc
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setTaskReminderPopover(null)}
                      className="px-3 py-1 rounded-full text-[11.5px] text-[#76767b] hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
                    >
                      Đóng
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleSaveIndividualTaskReminder(
                          taskReminderPopover.lineIndex,
                          taskReminderPopover.taskId,
                          taskReminderPopover.taskText,
                          taskReminderPopover.reminderAt
                        )
                      }
                      className="px-3.5 py-1 rounded-full text-[11.5px] font-semibold bg-[#0071e3] text-white hover:bg-[#0077ed] cursor-pointer active:scale-95 shadow-xs"
                    >
                      Lưu hẹn giờ
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ─────────────────── Apple Liquid Glass Master Reminder Modal ─────────────────── */}
          {showReminderModal && (
            <div
              onClick={() => setShowReminderModal(false)}
              className="absolute inset-0 z-30 bg-black/20 dark:bg-black/50 flex items-center justify-center p-3 sm:p-4 rounded-[28px] animate-in fade-in duration-150"
            >
              <div
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-[440px] max-h-[500px] flex flex-col bg-white dark:bg-[#1c1c24] rounded-[24px] border border-black/10 dark:border-white/15 shadow-[0_24px_70px_rgba(0,0,0,0.25)] overflow-hidden text-left animate-in zoom-in-95 duration-150"
              >
                {/* Fixed Header */}
                <div className="p-4 sm:px-5 border-b border-black/[0.06] dark:border-white/10 flex items-center justify-between shrink-0 bg-white/40 dark:bg-white/[0.02]">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                      <BellRing className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-[14px] text-[#1d1d1f] dark:text-white truncate">
                        Cài Lịch Nhắc Nhở & Email
                      </h4>
                      <p className="text-[11px] text-[#86868b] dark:text-[#a1a1a6] truncate">
                        {activeNote.title ? `Cho "${activeNote.title}"` : 'Hẹn giờ thông báo tự động'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowReminderModal(false)}
                    className="w-7 h-7 rounded-full hover:bg-black/5 dark:hover:bg-white/10 flex items-center justify-center text-[#76767b] cursor-pointer shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Scrollable Body with Ultra-Thin Apple Scrollbar */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-black/15 dark:[&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-black/25">
                  {/* Section 1: Quick Presets */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-[#86868b] dark:text-[#a1a1a6] uppercase tracking-wider block">
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

                  {/* Section 2: Custom Date & Time Picker */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-[#86868b] dark:text-[#a1a1a6] uppercase tracking-wider block">
                      Thời gian nhắc hẹn cụ thể
                    </label>
                    <input
                      type="datetime-local"
                      value={reminderDate}
                      onChange={(e) => setReminderDate(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl text-[13px] font-medium bg-black/[0.02] dark:bg-white/10 border border-black/15 dark:border-white/15 focus:border-[#0071e3] outline-none text-[#1d1d1f] dark:text-white"
                    />
                  </div>

                  {/* Section 3: Checklist Tasks List (ONLY if this note actually has checklist rows!) */}
                  {checklistRows.length > 0 && (
                    <div className="pt-3 border-t border-black/[0.06] dark:border-white/10 space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-semibold text-[#86868b] dark:text-[#a1a1a6] uppercase tracking-wider">
                          Hoặc hẹn giờ riêng từng mục việc ({checklistRows.length} việc)
                        </label>
                      </div>
                      <div className="space-y-1 max-h-[140px] overflow-y-auto pr-1 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-black/15 [&::-webkit-scrollbar-thumb]:rounded-full">
                        {checklistRows.map((row) => (
                          <div
                            key={`modal-task-${row.lineIndex}`}
                            className="flex items-center justify-between p-2 rounded-xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.04] dark:border-white/[0.06] text-[12px]"
                          >
                            <span className="truncate flex-1 pr-2 text-[#1d1d1f] dark:text-[#f5f5f7]">
                              {row.completed ? '☑ ' : '☐ '} {row.text || '(Mục việc chưa đặt tên)'}
                            </span>
                            {row.reminderAt ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setShowReminderModal(false);
                                  setTaskReminderPopover({
                                    lineIndex: row.lineIndex,
                                    taskId: row.taskId,
                                    taskText: row.text,
                                    reminderAt: toDatetimeLocal(new Date(row.reminderAt!)),
                                  });
                                }}
                                className="px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 shrink-0 cursor-pointer"
                              >
                                ⏰ {formatReminderBadge(row.reminderAt)}
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setShowReminderModal(false);
                                  setTaskReminderPopover({
                                    lineIndex: row.lineIndex,
                                    taskId: row.taskId,
                                    taskText: row.text,
                                    reminderAt: toDatetimeLocal(new Date(Date.now() + 30 * 60 * 1000)),
                                  });
                                }}
                                className="px-2 py-0.5 rounded-full text-[10.5px] font-medium bg-black/[0.04] dark:bg-white/[0.08] hover:bg-amber-500/10 hover:text-amber-600 text-[#76767b] shrink-0 cursor-pointer"
                              >
                                + Hẹn giờ
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Section 4: Notification Channels & Automated Email */}
                  <div className="space-y-2 pt-3 border-t border-black/[0.06] dark:border-white/10">
                    <label className="text-[11px] font-semibold text-[#86868b] dark:text-[#a1a1a6] uppercase tracking-wider block">
                      Kênh nhận thông báo
                    </label>

                    {/* Desktop Push Notification Toggle */}
                    <label className="flex items-center gap-3 p-2.5 rounded-xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.04] dark:border-white/[0.06] cursor-pointer hover:bg-black/[0.04]">
                      <input
                        type="checkbox"
                        checked={reminderDesktop}
                        onChange={(e) => setReminderDesktop(e.target.checked)}
                        className="w-4 h-4 rounded text-[#0071e3] accent-[#0071e3] cursor-pointer"
                      />
                      <div className="flex-1 text-[12.5px]">
                        <span className="font-semibold text-[#1d1d1f] dark:text-white">
                          Thông báo màn hình Desktop & Chuông kính Apple
                        </span>
                        <p className="text-[11px] text-[#86868b] dark:text-[#a1a1a6]">
                          Hiển thị pop-up trên máy tính và phát âm thanh chuông tinh thể
                        </p>
                      </div>
                    </label>

                    {/* Automated Email Notification Toggle */}
                    <label className="flex items-start gap-3 p-2.5 rounded-xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.04] dark:border-white/[0.06] cursor-pointer hover:bg-black/[0.04]">
                      <input
                        type="checkbox"
                        checked={reminderEmail}
                        onChange={(e) => setReminderEmail(e.target.checked)}
                        className="w-4 h-4 mt-0.5 rounded text-[#0071e3] accent-[#0071e3] cursor-pointer"
                      />
                      <div className="flex-1 text-[12.5px]">
                        <span className="font-semibold text-[#1d1d1f] dark:text-white">
                          Hệ thống tự động gửi thông báo qua Email
                        </span>
                        <p className="text-[11px] text-[#86868b] dark:text-[#a1a1a6] mt-0.5">
                          Hệ thống tự động gửi email thông báo về hòm thư khi đến giờ hẹn mà bạn không cần thao tác
                        </p>
                      </div>
                    </label>

                    {/* Email Recipient & Automated Test Send */}
                    {reminderEmail && (
                      <div className="pl-6 space-y-2.5 animate-in fade-in duration-150">
                        <div>
                          <label className="text-[11px] font-medium text-[#76767b] dark:text-[#a1a1a6] block mb-1">
                            Địa chỉ Email nhận thông báo:
                          </label>
                          <input
                            type="email"
                            placeholder="kaka.nhdk@gmail.com"
                            value={reminderEmailInput}
                            onChange={(e) => setReminderEmailInput(e.target.value)}
                            className="w-full px-3 py-1.5 rounded-xl text-[12.5px] bg-white dark:bg-white/10 border border-black/15 dark:border-white/15 text-[#1d1d1f] dark:text-white placeholder:text-[#86868b] focus:border-[#0071e3] outline-none"
                          />
                        </div>

                        {/* SMTP Status Indicator */}
                        {smtpConfigured === false && (
                          <div className="p-3 rounded-2xl bg-amber-500/[0.08] border border-amber-500/25 space-y-2 text-left">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5 text-[12px] font-semibold text-amber-800 dark:text-amber-300">
                                <span>⚠️ Chưa kết nối tài khoản gửi mail (SMTP)</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => setShowSmtpSetup(!showSmtpSetup)}
                                className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-600 text-white hover:bg-amber-700 cursor-pointer transition-colors shadow-2xs shrink-0"
                              >
                                {showSmtpSetup ? 'Thu gọn' : '⚙️ Cấu hình gửi Gmail'}
                              </button>
                            </div>
                            <p className="text-[11px] text-[#76767b] dark:text-[#a1a1a6] leading-relaxed">
                              Hệ thống cần tài khoản Gmail & Mật khẩu ứng dụng (App Password) để gửi email thực tế đến hòm thư của bạn.
                            </p>
                          </div>
                        )}

                        {smtpConfigured === true && (
                          <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-500/[0.06] border border-emerald-500/20 text-[11.5px] text-emerald-800 dark:text-emerald-300">
                            <span className="flex items-center gap-1.5 truncate">
                              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                              <span>Đã kết nối gửi mail: <strong className="font-semibold">{smtpSenderUser || 'Gmail SMTP'}</strong></span>
                            </span>
                            <button
                              type="button"
                              onClick={() => setShowSmtpSetup(!showSmtpSetup)}
                              className="text-[11px] text-[#0071e3] dark:text-[#2997ff] hover:underline cursor-pointer ml-2 shrink-0 font-medium"
                            >
                              {showSmtpSetup ? 'Đóng' : 'Đổi tài khoản'}
                            </button>
                          </div>
                        )}

                        {/* Inline SMTP Setup Form */}
                        {showSmtpSetup && (
                          <div className="p-3.5 rounded-2xl bg-white dark:bg-[#25252d] border border-black/10 dark:border-white/15 shadow-sm space-y-3 animate-in fade-in slide-in-from-top-2 duration-150 text-left">
                            <div className="flex items-center justify-between pb-2 border-b border-black/[0.06] dark:border-white/10">
                              <div className="flex items-center gap-2">
                                <span className="text-sm">📧</span>
                                <span className="text-[12.5px] font-bold text-[#1d1d1f] dark:text-white">
                                  Thiết lập tài khoản gửi Gmail SMTP
                                </span>
                              </div>
                              <a
                                href="https://myaccount.google.com/apppasswords"
                                target="_blank"
                                rel="noreferrer"
                                className="text-[11px] text-[#0071e3] dark:text-[#2997ff] hover:underline cursor-pointer font-medium"
                              >
                                Tạo App Password ↗
                              </a>
                            </div>

                            <div className="space-y-2">
                              <div>
                                <label className="text-[11px] font-medium text-[#76767b] dark:text-[#a1a1a6] block mb-1">
                                  Tài khoản Gmail gửi đi (Email của bạn):
                                </label>
                                <input
                                  type="email"
                                  placeholder="vd: kaka.nhdk@gmail.com"
                                  value={smtpInputUser}
                                  onChange={(e) => setSmtpInputUser(e.target.value)}
                                  className="w-full px-3 py-1.5 rounded-xl text-[12px] bg-black/[0.02] dark:bg-white/10 border border-black/15 dark:border-white/15 outline-none focus:border-[#0071e3] text-[#1d1d1f] dark:text-white"
                                />
                              </div>

                              <div>
                                <label className="text-[11px] font-medium text-[#76767b] dark:text-[#a1a1a6] block mb-1">
                                  Mật khẩu ứng dụng (Google App Password 16 chữ cái):
                                </label>
                                <input
                                  type="password"
                                  placeholder="vd: abcd efgh ijkl mnop"
                                  value={smtpInputPass}
                                  onChange={(e) => setSmtpInputPass(e.target.value)}
                                  className="w-full px-3 py-1.5 rounded-xl text-[12px] bg-black/[0.02] dark:bg-white/10 border border-black/15 dark:border-white/15 outline-none focus:border-[#0071e3] text-[#1d1d1f] dark:text-white tracking-widest font-mono"
                                />
                                <p className="text-[10px] text-[#86868b] dark:text-[#a1a1a6] mt-1 leading-normal">
                                  * Không phải mật khẩu Gmail thường. Bật xác minh 2 bước và tạo tại <span className="font-mono text-[#0071e3]">myaccount.google.com/apppasswords</span>.
                                </p>
                              </div>

                              <div>
                                <label className="text-[11px] font-medium text-[#76767b] dark:text-[#a1a1a6] block mb-1">
                                  Tên người gửi hiển thị:
                                </label>
                                <input
                                  type="text"
                                  placeholder="Trợ Lý Thu Mua • Farmers Market"
                                  value={smtpInputSenderName}
                                  onChange={(e) => setSmtpInputSenderName(e.target.value)}
                                  className="w-full px-3 py-1.5 rounded-xl text-[12px] bg-black/[0.02] dark:bg-white/10 border border-black/15 dark:border-white/15 outline-none focus:border-[#0071e3] text-[#1d1d1f] dark:text-white"
                                />
                              </div>
                            </div>

                            <div className="pt-2 flex items-center justify-end gap-2 border-t border-black/[0.06] dark:border-white/10">
                              <button
                                type="button"
                                onClick={() => setShowSmtpSetup(false)}
                                className="px-3 py-1.5 rounded-full text-[11.5px] text-[#76767b] hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
                              >
                                Đóng
                              </button>
                              <button
                                type="button"
                                onClick={handleSaveSmtpConfig}
                                disabled={isVerifyingSmtp}
                                className="px-3.5 py-1.5 rounded-full text-[11.5px] font-semibold bg-[#0071e3] hover:bg-[#0077ed] text-white cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shadow-xs"
                              >
                                {isVerifyingSmtp ? 'Đang kiểm tra kết nối...' : 'Lưu & Kiểm tra kết nối'}
                              </button>
                            </div>
                          </div>
                        )}

                        <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-amber-500/[0.06] border border-amber-500/20 text-[11.5px] text-amber-800 dark:text-amber-200">
                          <span className="truncate">⚡ Tự động gửi email khi đến giờ hẹn</span>
                          <button
                            type="button"
                            onClick={handleSendTestEmail}
                            disabled={isSendingTestEmail}
                            className="px-3 py-1 rounded-full text-[11px] font-semibold bg-[#0071e3] text-white hover:bg-[#0077ed] transition-colors cursor-pointer disabled:opacity-50 shrink-0"
                          >
                            {isSendingTestEmail ? 'Đang gửi...' : 'Gửi thử 1 mail ngay'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Fixed Pinned Footer */}
                <div className="p-3.5 sm:px-5 border-t border-black/[0.06] dark:border-white/10 shrink-0 bg-black/[0.02] dark:bg-white/[0.02] flex items-center justify-between gap-2">
                  {activeNote.reminderAt ? (
                    <button
                      type="button"
                      onClick={handleRemoveNoteReminder}
                      className="px-3 py-1.5 rounded-full text-[12px] font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                    >
                      Hủy lịch ghi chú
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
