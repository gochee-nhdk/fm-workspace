import React from 'react';
import { noteService } from './noteService';
import { QuickNoteItem } from '@/types/workspace';
import { useNoteStore } from '@/stores/note-store';
import toast from 'react-hot-toast';

const PREFERRED_EMAIL_KEY = 'fm_user_preferred_reminder_email';

/**
 * Synthesizes a subtle Apple visionOS / iOS glass bell chime using Web Audio API
 */
const playAppleChime = () => {
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
   * Trigger direct email client via mailto
   */
  composeEmailReminder(note: QuickNoteItem, targetEmail?: string): void {
    const to = targetEmail || note.reminderEmail || this.getPreferredEmail() || '';
    const subject = encodeURIComponent(`[Farmers Market] Nhắc nhở công việc: ${note.title || 'Ghi chú'}`);
    
    const formattedDate = note.reminderAt
      ? new Date(note.reminderAt).toLocaleString('vi-VN', {
          hour: '2-digit',
          minute: '2-digit',
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        })
      : new Date().toLocaleString('vi-VN');

    const bodyContent = [
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

    const mailtoUrl = `mailto:${to}?subject=${subject}&body=${encodeURIComponent(bodyContent)}`;
    window.open(mailtoUrl, '_blank');
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
   * Scan for notes that have reached their reminder time
   */
  async checkDueReminders(): Promise<void> {
    if (this.isChecking) return;
    this.isChecking = true;

    try {
      const notes = await noteService.getAllNotes();
      const now = Date.now();

      for (const note of notes) {
        if (!note.reminderAt || note.reminderCompleted) continue;

        const reminderTime = new Date(note.reminderAt).getTime();
        // Trigger if time has arrived (within the last 24h)
        if (reminderTime <= now && now - reminderTime < 24 * 60 * 60 * 1000) {
          await this.fireReminder(note);
        }
      }
    } catch (err) {
      console.warn('Reminder check error:', err);
    } finally {
      this.isChecking = false;
    }
  }

  /**
   * Fire reminder notifications across enabled channels
   */
  async fireReminder(note: QuickNoteItem): Promise<void> {
    // 1. Mark as completed in DB to avoid repeated alerts
    await noteService.saveNote({
      id: note.id,
      reminderCompleted: true,
    });

    // Refresh note store if open
    useNoteStore.getState().loadNotes();

    // 2. Play subtle Apple chime
    playAppleChime();

    // 3. Desktop Notification (if permitted and enabled)
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

    // 4. In-App Apple HUD Alert
    toast(
      (t) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            ⏰
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-[13px] text-[#1d1d1f] dark:text-[#f5f5f7] truncate">
              Nhắc nhở: {note.title || 'Ghi chú'}
            </p>
            <p className="text-[12px] text-[#86868b] dark:text-[#a1a1a6] truncate">
              {note.content ? note.content.slice(0, 60) : 'Đã đến giờ nhắc việc!'}
            </p>
          </div>
          <button
            onClick={() => {
              toast.dismiss(t.id);
              useNoteStore.getState().openNote(note.id);
            }}
            className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#0071e3] text-white hover:bg-[#0077ed] transition-colors shrink-0"
          >
            Mở xem
          </button>
        </div>
      ),
      {
        id: `reminder-${note.id}`,
        duration: 10000,
      }
    );

    // 5. Email Notification (if email channel is enabled)
    if (note.reminderNotifyEmail && (note.reminderEmail || this.getPreferredEmail())) {
      // If user selected email, trigger email composition
      this.composeEmailReminder(note);
    }
  }
}

export const reminderService = new ReminderService();
