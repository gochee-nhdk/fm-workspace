/**
 * Auto Backup Manager
 * Periodically and reactively triggers dual-sync to server
 * whenever workspace data or notes are modified.
 * Debounced to prevent excessive network requests.
 */

import { backupService } from './backupService';
import { persistentStorage } from './storage/persistentStorage';

class AutoBackupManager {
  private syncTimer: ReturnType<typeof setTimeout> | null = null;
  private intervalTimer: ReturnType<typeof setInterval> | null = null;
  private isSyncing = false;
  private initialized = false;

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

    // 2. Perform initial background sync 10 seconds after app loads
    setTimeout(() => {
      this.triggerSync('auto');
    }, 10000);

    // 3. Periodic snapshot every 30 minutes
    this.intervalTimer = setInterval(() => {
      this.triggerSync('snapshot');
    }, 30 * 60 * 1000);

    // 4. Listen to window beforeunload to flush sync if pending
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        if (this.syncTimer) {
          clearTimeout(this.syncTimer);
          this.syncTimer = null;
          // Best effort sync
          backupService.syncToServer('auto').catch(() => {});
        }
      });
    }
  }

  /**
   * Schedule debounced auto-sync (e.g. called after note save, link edit, etc.)
   */
  scheduleSync(delayMs = 6000): void {
    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
    }

    this.syncTimer = setTimeout(() => {
      this.syncTimer = null;
      this.triggerSync('auto');
    }, delayMs);
  }

  /**
   * Execute sync immediately
   */
  async triggerSync(type: 'auto' | 'manual' | 'snapshot' = 'auto'): Promise<boolean> {
    if (this.isSyncing) return false;
    this.isSyncing = true;
    try {
      const res = await backupService.syncToServer(type);
      return res.success;
    } finally {
      this.isSyncing = false;
    }
  }
}

export const autoBackupManager = new AutoBackupManager();
