import React from 'react';
import { noteService } from './noteService';
import { QuickNoteItem, TaskReminder, EmailProviderType } from '@/types/workspace';
import { useNoteStore } from '@/stores/note-store';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

const PREFERRED_EMAIL_KEY = 'fm_user_preferred_reminder_email';
const PREFERRED_PROVIDER_KEY = 'fm_user_preferred_email_provider';
const DEFAULT_REMINDER_EMAIL = 'kaka.nhdk@gmail.com';

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
   * Get user's preferred email from storage (defaults to user's specified email)
   */
  getPreferredEmail(): string {
    try {
      return localStorage.getItem(PREFERRED_EMAIL_KEY) || DEFAULT_REMINDER_EMAIL;
    } catch (_) {
      return DEFAULT_REMINDER_EMAIL;
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
   * Get preferred email client provider (stored for compatibility)
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
   * Get SMTP configuration status
   */
  async getSmtpStatus(): Promise<{
    configured: boolean;
    smtpHost?: string;
    smtpPort?: number;
    smtpUser?: string | null;
    fullUser?: string | null;
    senderName?: string;
  }> {
    try {
      const res = await api.get('/notifications/smtp-status');
      return {
        configured: Boolean(res.data?.configured),
        smtpHost: res.data?.smtpHost,
        smtpPort: res.data?.smtpPort,
        smtpUser: res.data?.smtpUser,
        fullUser: res.data?.fullUser,
        senderName: res.data?.senderName,
      };
    } catch (err) {
      console.warn('getSmtpStatus error:', err);
      return { configured: false };
    }
  }

  /**
   * Save and verify SMTP configuration
   */
  async configureSmtp(config: {
    user: string;
    pass: string;
    host?: string;
    port?: number;
    senderName?: string;
  }): Promise<{ success: boolean; message: string; configured?: boolean }> {
    try {
      const res = await api.post('/notifications/smtp-config', config);
      return {
        success: res.data?.success ?? true,
        message: res.data?.message || 'Cấu hình SMTP thành công',
        configured: res.data?.configured ?? true,
      };
    } catch (err: any) {
      return {
        success: false,
        message: err.response?.data?.message || err.message || 'Lỗi khi kết nối máy chủ SMTP',
      };
    }
  }

  /**
   * Send automated system email notification via backend
   * No user manual clicking or external webmail window required!
   */
  async sendAutomatedEmail(options: {
    to: string;
    subject?: string;
    content?: string;
    noteTitle?: string;
    taskText?: string;
  }): Promise<{ success: boolean; message?: string; configured?: boolean }> {
    try {
      const res = await api.post('/notifications/send-reminder-email', options);
      return {
        success: res.data?.success ?? true,
        message: res.data?.message || 'Đã gửi email thông báo thành công',
        configured: res.data?.configured ?? true,
      };
    } catch (err: any) {
      console.warn('sendAutomatedEmail backend dispatch error:', err);
      return {
        success: false,
        configured: err.response?.data?.configured ?? false,
        message: err.response?.data?.message || 'Không thể kết nối máy chủ gửi email',
      };
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
          if (reminderTime <= now) {
            const isOverdue = now - reminderTime > 4 * 60 * 60 * 1000;
            await this.fireNoteReminder(note, isOverdue);
          }
        }

        // 2. Checklist task-level reminders check
        if (note.taskReminders && note.taskReminders.length > 0) {
          let updated = false;
          for (const tr of note.taskReminders) {
            if (tr.reminderAt && !tr.reminderCompleted) {
              const reminderTime = new Date(tr.reminderAt).getTime();
              if (reminderTime <= now) {
                const isOverdue = now - reminderTime > 4 * 60 * 60 * 1000;
                await this.fireTaskReminder(note, tr, isOverdue);
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
  async fireNoteReminder(note: QuickNoteItem, isOverdue = false): Promise<void> {
    await noteService.saveNote({
      id: note.id,
      reminderCompleted: true,
    });
    useNoteStore.getState().loadNotes();

    playAppleChime();

    const titlePrefix = isOverdue ? '⚠️ Nhắc nhở quá hạn: ' : '⏰ Nhắc nhở: ';

    // 1. Desktop Notification
    if (note.reminderNotifyDesktop !== false && 'Notification' in window && Notification.permission === 'granted') {
      try {
        const notif = new Notification(`${titlePrefix}${note.title || 'Ghi chú công việc'}`, {
          body: note.content ? note.content.slice(0, 140) : (isOverdue ? 'Công việc này đã quá hạn bạn đặt.' : 'Đã đến thời gian nhắc nhở công việc bạn đã đặt.'),
          icon: '/logo.png',
        });
        notif.onclick = () => {
          window.focus();
          useNoteStore.getState().openNote(note.id);
        };
      } catch (_) {}
    }

    // 2. In-App Apple HUD Alert
    toast(
      (t) => (
        <div className="flex items-center gap-3 p-1">
          <div className={`w-9 h-9 rounded-2xl ${isOverdue ? 'bg-rose-500/15 border-rose-500/25 text-rose-600' : 'bg-amber-500/15 border-amber-500/25 text-amber-600'} border flex items-center justify-center shrink-0 shadow-xs`}>
            {isOverdue ? '⚠️' : '⏰'}
          </div>
          <div className="flex-1 min-w-0">
            <span className={`text-[10px] font-bold uppercase tracking-wider ${isOverdue ? 'text-rose-600' : 'text-amber-600'}`}>
              {isOverdue ? 'Đã quá hạn' : 'Đến giờ nhắc hẹn'}
            </span>
            <p className="font-bold text-[13px] text-[#1d1d1f] dark:text-[#f5f5f7] truncate">
              {note.title || 'Ghi chú công việc'}
            </p>
            <p className="text-[11.5px] text-[#86868b] dark:text-[#a1a1a6] truncate">
              {note.content ? note.content.slice(0, 60) : 'Nhấp để mở xem chi tiết công việc'}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => {
                toast.dismiss(t.id);
                useNoteStore.getState().openNote(note.id);
              }}
              className="px-3 py-1 rounded-full text-[11.5px] font-semibold bg-[#0071e3] text-white hover:bg-[#0077ed] transition-colors cursor-pointer"
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

    // 3. Automated Email Notification
    const targetEmail = (note.reminderEmail && note.reminderEmail.trim()) || this.getPreferredEmail();
    if (note.reminderNotifyEmail && targetEmail) {
      this.sendAutomatedEmail({
        to: targetEmail,
        subject: `${titlePrefix}${note.title || 'Ghi chú công việc'}`,
        content: note.content ? note.content.replace(/<[^>]*>?/gm, '').slice(0, 500) : 'Đã đến thời gian nhắc nhở công việc bạn đã hẹn.',
        noteTitle: note.title || 'Ghi chú công việc',
      }).then((res) => {
        if (res.success) {
          toast.success(`📧 Đã gửi email nhắc việc tới ${targetEmail}`, { id: `email-sent-${note.id}` });
        }
      }).catch((err) => {
        console.warn('Auto send note reminder email failed:', err);
      });
    }
  }

  /**
   * Fire task-level reminder for a specific checklist item
   */
  async fireTaskReminder(note: QuickNoteItem, task: TaskReminder, isOverdue = false): Promise<void> {
    playAppleChime();

    const titlePrefix = isOverdue ? '⚠️ Nhắc việc quá hạn: ' : '⏰ Nhắc việc: ';

    // 1. Desktop Notification
    if (note.reminderNotifyDesktop !== false && 'Notification' in window && Notification.permission === 'granted') {
      try {
        const notif = new Notification(`${titlePrefix}${task.taskText}`, {
          body: `Ghi chú: "${note.title || 'Ghi chú mới'}" • ${isOverdue ? 'Đầu việc này đã quá hạn!' : 'Đã đến giờ thực hiện.'}`,
          icon: '/logo.png',
        });
        notif.onclick = () => {
          window.focus();
          useNoteStore.getState().openNote(note.id);
        };
      } catch (_) {}
    }

    // 2. In-App Apple HUD Alert
    toast(
      (t) => (
        <div className="flex items-center gap-3 p-1">
          <div className={`w-9 h-9 rounded-2xl ${isOverdue ? 'bg-rose-500/15 border-rose-500/25 text-rose-600' : 'bg-emerald-500/15 border-emerald-500/25 text-emerald-600'} border flex items-center justify-center shrink-0 shadow-xs`}>
            {isOverdue ? '⚠️' : '☑️'}
          </div>
          <div className="flex-1 min-w-0">
            <span className={`text-[10px] font-bold uppercase tracking-wider ${isOverdue ? 'text-rose-600' : 'text-emerald-600'}`}>
              {isOverdue ? 'Việc đã quá hạn' : 'Việc cần làm'}
            </span>
            <p className="font-bold text-[13px] text-[#1d1d1f] dark:text-[#f5f5f7] truncate">
              {task.taskText}
            </p>
            <p className="text-[11px] text-[#86868b] dark:text-[#a1a1a6] truncate">
              Trong: {note.title || 'Ghi chú mới'}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => {
                toast.dismiss(t.id);
                useNoteStore.getState().openNote(note.id);
              }}
              className="px-3 py-1 rounded-full text-[11.5px] font-semibold bg-[#0071e3] text-white hover:bg-[#0077ed] transition-colors cursor-pointer"
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

    // 3. Automated Email Notification
    const targetEmail = (note.reminderEmail && note.reminderEmail.trim()) || this.getPreferredEmail();
    if (note.reminderNotifyEmail && targetEmail) {
      this.sendAutomatedEmail({
        to: targetEmail,
        subject: `${titlePrefix}${task.taskText}`,
        content: `Mục việc: "${task.taskText}" trong ghi chú "${note.title || 'Ghi chú công việc'}" đã đến hạn hoàn thành.`,
        noteTitle: note.title || 'Ghi chú công việc',
        taskText: task.taskText,
      }).then((res) => {
        if (res.success) {
          toast.success(`📧 Đã gửi email nhắc việc tới ${targetEmail}`, { id: `email-sent-task-${task.id}` });
        }
      }).catch((err) => {
        console.warn('Auto send task reminder email failed:', err);
      });
    }
  }
}

export const reminderService = new ReminderService();
