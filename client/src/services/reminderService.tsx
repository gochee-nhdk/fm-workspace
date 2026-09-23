import React from 'react';
import { noteService } from './noteService';
import { QuickNoteItem, TaskReminder, EmailProviderType } from '@/types/workspace';
import { useNoteStore } from '@/stores/note-store';
import toast from 'react-hot-toast';

const PREFERRED_EMAIL_KEY = 'fm_user_preferred_reminder_email';
const PREFERRED_PROVIDER_KEY = 'fm_user_preferred_email_provider';

/**
 * Synthesizes a subtle Apple visionOS / iOS glass bell chime using Web Audio API
 */
export const playAppleChime = () => {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    const now = ctx.currentTime;
    // Harmonic frequencies for an ethereal crystal glass bell
    const freqs = [880, 1320, 1760]; // A5, E6, A6

    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.04);

      gain.gain.setValueAtTime(0.08 / (idx + 1), now + idx * 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.2 + idx * 0.1);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + idx * 0.04);
      osc.stop(now + 1.5);
    });
  } catch (_) {
    // Audio context may be restricted before user interaction
  }
};

class ReminderService {
  private timer: ReturnType<typeof setInterval> | null = null;
  private isChecking = false;

  /**
   * Request browser notification permission
   */
  async requestNotificationPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      return false;
    }
    if (Notification.permission === 'granted') {
      return true;
    }
    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
    return false;
  }

  /**
   * Get user's preferred email from storage
   */
  getPreferredEmail(): string {
    try {
      return localStorage.getItem(PREFERRED_EMAIL_KEY) || '';
    } catch (_) {
      return '';
    }
  }

  /**
   * Save user's preferred email
   */
  setPreferredEmail(email: string): void {
    try {
      localStorage.setItem(PREFERRED_EMAIL_KEY, email);
    } catch (_) {}
  }

  /**
   * Get preferred email client provider (gmail, outlook, mailto)
   */
  getPreferredProvider(): EmailProviderType {
    try {
      return (localStorage.getItem(PREFERRED_PROVIDER_KEY) as EmailProviderType) || 'gmail';
    } catch (_) {
      return 'gmail';
    }
  }

  /**
   * Save preferred email client provider
   */
  setPreferredProvider(provider: EmailProviderType): void {
    try {
      localStorage.setItem(PREFERRED_PROVIDER_KEY, provider);
    } catch (_) {}
  }

  /**
   * Open email client with prefilled subject, body and recipient
   * Supports Gmail Web, Outlook 365 Web, and Native Mailto without leaving empty tabs
   */
  composeEmailReminder(
    note: QuickNoteItem,
    options?: {
      targetEmail?: string;
      taskText?: string;
      provider?: EmailProviderType;
    }
  ): void {
    const to = options?.targetEmail || note.reminderEmail || this.getPreferredEmail() || '';
    const provider = options?.provider || note.emailProvider || this.getPreferredProvider() || 'gmail';

    const subjectText = options?.taskText
      ? `[Farmers Market] Nhắc việc: ${options.taskText}`
      : `[Farmers Market] Nhắc nhở công việc: ${note.title || 'Ghi chú mới'}`;

    const formattedDate = new Date().toLocaleString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

    const bodyContent = options?.taskText
      ? [
          `Kính gửi,`,
          ``,
          `Đây là thông báo nhắc nhở việc cần làm từ hệ thống Trợ Lý Thu Mua - Farmers Market.`,
          `----------------------------------------------------`,
          `📋 MỤC VIỆC CẦN LÀM: ${options.taskText}`,
          `📂 TỪ GHI CHÚ: ${note.title || 'Ghi chú mới'}`,
          `⏰ THỜI GIAN NHẮC HẸN: ${formattedDate}`,
          `----------------------------------------------------`,
          `📝 NỘI DUNG CHI TIẾT GHI CHÚ:`,
          `${note.content || '(Không có nội dung)'}`,
          ``,
          `----------------------------------------------------`,
          `Trân trọng,`,
          `Hệ thống Trợ Lý Thu Mua FM Workspace`,
        ].join('\n')
      : [
          `Kính gửi,`,
          ``,
          `Đây là thông báo nhắc nhở lịch hẹn công việc từ hệ thống Trợ Lý Thu Mua - Farmers Market.`,
          `----------------------------------------------------`,
          `📋 TIÊU ĐỀ: ${note.title || 'Ghi chú mới'}`,
          `⏰ THỜI GIAN NHẮC HẸN: ${formattedDate}`,
          `----------------------------------------------------`,
          `📝 NỘI DUNG CHI TIẾT:`,
          `${note.content || '(Không có nội dung)'}`,
          ``,
          `----------------------------------------------------`,
          `Trân trọng,`,
          `Hệ thống Trợ Lý Thu Mua FM Workspace`,
        ].join('\n');

    if (provider === 'gmail') {
      const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}&su=${encodeURIComponent(subjectText)}&body=${encodeURIComponent(bodyContent)}`;
      window.open(gmailUrl, '_blank', 'noopener,noreferrer');
    } else if (provider === 'outlook') {
      const outlookUrl = `https://outlook.office.com/mail/deeplink/compose?to=${encodeURIComponent(to)}&subject=${encodeURIComponent(subjectText)}&body=${encodeURIComponent(bodyContent)}`;
      window.open(outlookUrl, '_blank', 'noopener,noreferrer');
    } else {
      // mailto via virtual anchor (no blank about:blank tabs left behind)
      const mailtoUrl = `mailto:${to}?subject=${encodeURIComponent(subjectText)}&body=${encodeURIComponent(bodyContent)}`;
      const a = document.createElement('a');
      a.href = mailtoUrl;
      a.target = '_self';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        try {
          document.body.removeChild(a);
        } catch (_) {}
      }, 150);
    }
  }

  /**
   * Start background monitoring
   */
  startMonitoring(): () => void {
    if (this.timer) {
      return () => this.stopMonitoring();
    }

    // Check immediately on startup
    this.checkDueReminders();

    // Check every 20 seconds
    this.timer = setInterval(() => {
      this.checkDueReminders();
    }, 20000);

    return () => this.stopMonitoring();
  }

  /**
   * Stop background monitoring
   */
  stopMonitoring(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Scan for notes and individual checklist items that have reached reminder time
   */
  async checkDueReminders(): Promise<void> {
    if (this.isChecking) return;
    this.isChecking = true;

    try {
      const notes = await noteService.getAllNotes();
      const now = Date.now();

      for (const note of notes) {
        // 1. Note-level reminder check
        if (note.reminderAt && !note.reminderCompleted) {
          const reminderTime = new Date(note.reminderAt).getTime();
          if (reminderTime <= now && now - reminderTime < 24 * 60 * 60 * 1000) {
            await this.fireNoteReminder(note);
          }
        }

        // 2. Checklist task-level reminders check
        if (note.taskReminders && note.taskReminders.length > 0) {
          let updated = false;
          for (const tr of note.taskReminders) {
            if (tr.reminderAt && !tr.reminderCompleted) {
              const reminderTime = new Date(tr.reminderAt).getTime();
              if (reminderTime <= now && now - reminderTime < 24 * 60 * 60 * 1000) {
                await this.fireTaskReminder(note, tr);
                tr.reminderCompleted = true;
                updated = true;
              }
            }
          }
          if (updated) {
            await noteService.saveNote({
              id: note.id,
              taskReminders: note.taskReminders,
            });
            useNoteStore.getState().loadNotes();
          }
        }
      }
    } catch (err) {
      console.warn('Reminder check error:', err);
    } finally {
      this.isChecking = false;
    }
  }

  /**
   * Fire note-level reminder
   */
  async fireNoteReminder(note: QuickNoteItem): Promise<void> {
    await noteService.saveNote({
      id: note.id,
      reminderCompleted: true,
    });
    useNoteStore.getState().loadNotes();

    playAppleChime();

    // Desktop Notification
    if (note.reminderNotifyDesktop !== false && 'Notification' in window && Notification.permission === 'granted') {
      try {
        const notif = new Notification(`⏰ Nhắc nhở: ${note.title || 'Ghi chú công việc'}`, {
          body: note.content ? note.content.slice(0, 140) : 'Đã đến thời gian nhắc nhở công việc bạn đã đặt.',
          icon: '/logo.png',
        });
        notif.onclick = () => {
          window.focus();
          useNoteStore.getState().openNote(note.id);
        };
      } catch (_) {}
    }

    // In-App Apple HUD Alert
    const targetEmail = note.reminderEmail || this.getPreferredEmail();
    toast(
      (t) => (
        <div className="flex items-center gap-3 p-1">
          <div className="w-9 h-9 rounded-2xl bg-amber-500/15 border border-amber-500/25 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 shadow-xs">
            ⏰
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-[13px] text-[#1d1d1f] dark:text-[#f5f5f7] truncate">
              {note.title || 'Ghi chú công việc'}
            </p>
            <p className="text-[11.5px] text-[#86868b] dark:text-[#a1a1a6] truncate">
              {note.content ? note.content.slice(0, 60) : 'Đã đến giờ nhắc hẹn!'}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {note.reminderNotifyEmail && targetEmail && (
              <button
                onClick={() => {
                  this.composeEmailReminder(note);
                }}
                className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 transition-colors"
                title="Mở gửi email nhắc việc này"
              >
                ✉️ Email
              </button>
            )}
            <button
              onClick={() => {
                toast.dismiss(t.id);
                useNoteStore.getState().openNote(note.id);
              }}
              className="px-3 py-1 rounded-full text-[11.5px] font-semibold bg-[#0071e3] text-white hover:bg-[#0077ed] transition-colors"
            >
              Mở xem
            </button>
          </div>
        </div>
      ),
      {
        id: `reminder-${note.id}`,
        duration: 12000,
      }
    );
  }

  /**
   * Fire task-level reminder for a specific checklist item
   */
  async fireTaskReminder(note: QuickNoteItem, task: TaskReminder): Promise<void> {
    playAppleChime();

    // Desktop Notification
    if (note.reminderNotifyDesktop !== false && 'Notification' in window && Notification.permission === 'granted') {
      try {
        const notif = new Notification(`⏰ Nhắc việc: ${task.taskText}`, {
          body: `Ghi chú: "${note.title || 'Ghi chú mới'}" • Đã đến giờ thực hiện công việc này.`,
          icon: '/logo.png',
        });
        notif.onclick = () => {
          window.focus();
          useNoteStore.getState().openNote(note.id);
        };
      } catch (_) {}
    }

    // In-App Apple HUD Alert
    const targetEmail = note.reminderEmail || this.getPreferredEmail();
    toast(
      (t) => (
        <div className="flex items-center gap-3 p-1">
          <div className="w-9 h-9 rounded-2xl bg-emerald-500/15 border border-emerald-500/25 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 shadow-xs">
            ☑️
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Việc cần làm
            </span>
            <p className="font-bold text-[13px] text-[#1d1d1f] dark:text-[#f5f5f7] truncate">
              {task.taskText}
            </p>
            <p className="text-[11px] text-[#86868b] dark:text-[#a1a1a6] truncate">
              Trong: {note.title || 'Ghi chú mới'}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {note.reminderNotifyEmail && targetEmail && (
              <button
                onClick={() => {
                  this.composeEmailReminder(note, { taskText: task.taskText });
                }}
                className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 transition-colors"
                title="Mở gửi email nhắc việc này"
              >
                ✉️ Email
              </button>
            )}
            <button
              onClick={() => {
                toast.dismiss(t.id);
                useNoteStore.getState().openNote(note.id);
              }}
              className="px-3 py-1 rounded-full text-[11.5px] font-semibold bg-[#0071e3] text-white hover:bg-[#0077ed] transition-colors"
            >
              Mở note
            </button>
          </div>
        </div>
      ),
      {
        id: `task-reminder-${note.id}-${task.id}`,
        duration: 12000,
      }
    );
  }
}

export const reminderService = new ReminderService();
