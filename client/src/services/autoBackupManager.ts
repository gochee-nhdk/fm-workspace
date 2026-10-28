/**
 * Auto Backup Manager
 * Enterprise-grade multi-layer automated backup engine.
 * Automatically and reactively triggers dual-sync to server and local emergency storage
 * whenever workspace data, notes, attachments, or links are modified.
 * Guards against sudden crashes, power outages, and browser tab teardowns.
 */

import { backupService } from './backupService';
import { persistentStorage } from './storage/persistentStorage';

class AutoBackupManager {
  private syncTimer: ReturnType<typeof setTimeout> | null = null;
  private intervalTimer: ReturnType<typeof setInterval> | null = null;
  private isSyncing = false;
  private initialized = false;
  private lastBackupTime: Date | null = null;
  private listeners: Array<(time: Date | null, isSyncing: boolean) => void> = [];

  /**
   * Subscribe to auto-backup state changes
   */
  subscribe(callback: (time: Date | null, isSyncing: boolean) => void): () => void {
    this.listeners.push(callback);
    callback(this.lastBackupTime, this.isSyncing);
    return () => {
      this.listeners = this.listeners.filter((cb) => cb !== callback);
    };
  }

  private notify(): void {
    this.listeners.forEach((cb) => {
      try {
        cb(this.lastBackupTime, this.isSyncing);
      } catch (_) {}
    });
  }

  /**
   * Initialize auto-sync listeners and periodic snapshot timer
   */
  async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;

    // 1. Request persistent storage on startup
    try {
      await persistentStorage.requestPersistence();
    } catch (_) {}

    // 2. Perform initial background sync during idle time after app startup (defer to avoid contention)
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      window.requestIdleCallback(() => {
        this.triggerSync('auto').catch(() => {});
      }, { timeout: 15000 });
    } else {
      setTimeout(() => {
        this.triggerSync('auto').catch(() => {});
      }, 10000);
    }

    // 3. Periodic snapshot every 3 minutes (continuous background heartbeat)
    this.intervalTimer = setInterval(() => {
      this.triggerSync('snapshot').catch(() => {});
    }, 3 * 60 * 1000);

    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      // 4. Flush immediately when user switches tabs or minimizes browser
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          if (this.syncTimer) {
            clearTimeout(this.syncTimer);
            this.syncTimer = null;
          }
          this.triggerSync('auto').catch(() => {});
        }
      });

      // 5. Page Lifecycle: pagehide event (recommended by Google Chrome & W3C for reliable data preservation)
      window.addEventListener('pagehide', () => {
        if (this.syncTimer) {
          clearTimeout(this.syncTimer);
          this.syncTimer = null;
        }
        this.triggerSync('auto').catch(() => {});
      });

      // 6. Best effort fallback on beforeunload
      window.addEventListener('beforeunload', () => {
        if (this.syncTimer) {
          clearTimeout(this.syncTimer);
          this.syncTimer = null;
          this.triggerSync('auto').catch(() => {});
        }
      });
    }
  }

  /**
   * Schedule debounced auto-sync (called after note save, link edit, excel import, attachment upload)
   * Lowered to 2,000ms for rapid persistence while avoiding request flood.
   */
  scheduleSync(delayMs = 2000): void {
    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
    }

    this.syncTimer = setTimeout(() => {
      this.syncTimer = null;
      this.triggerSync('auto').catch(() => {});
    }, delayMs);
  }

  /**
   * Execute sync immediately with local emergency redundancy and server dispatch
   */
  async triggerSync(type: 'auto' | 'manual' | 'snapshot' = 'auto'): Promise<boolean> {
    if (this.isSyncing) return false;
    this.isSyncing = true;
    this.notify();

    try {
      const res = await backupService.syncToServer(type);
      if (res.success) {
        this.lastBackupTime = new Date();
      }
      return res.success;
    } catch (err) {
      console.warn('[AutoBackup] Background auto-sync attempt failed (will retry):', err);
      return false;
    } finally {
      this.isSyncing = false;
      this.notify();
    }
  }

  getLastBackupTime(): Date | null {
    return this.lastBackupTime;
  }

  getIsSyncing(): boolean {
    return this.isSyncing;
  }
}

export const autoBackupManager = new AutoBackupManager();
