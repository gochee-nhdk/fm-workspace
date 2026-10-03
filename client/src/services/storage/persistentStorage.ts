/**
 * Persistent Storage Service
 * Activates browser's navigator.storage.persist() API
 * to prevent browser from silently clearing IndexedDB / LocalStorage
 * when disk space is tight or cache cleanup occurs.
 */

export interface StorageStatus {
  isPersisted: boolean;
  supported: boolean;
  quotaBytes?: number;
  usageBytes?: number;
  usagePercent?: number;
  isSecureContext?: boolean;
}

export type PersistenceResult = 
  | { success: true; message: string }
  | { success: false; reason: 'unsupported' | 'insecure_context' | 'browser_denied' | 'error'; message: string };

export const persistentStorage = {
  /**
   * Request persistent storage from the browser.
   * If granted, IndexedDB and LocalStorage are shielded from automatic eviction.
   */
  async requestPersistence(): Promise<PersistenceResult> {
    if (typeof navigator === 'undefined' || !navigator.storage || !navigator.storage.persist) {
      return {
        success: false,
        reason: 'unsupported',
        message: 'Trình duyệt này không hỗ trợ Storage Persistence API.',
      };
    }

    if (typeof window !== 'undefined' && !window.isSecureContext) {
      return {
        success: false,
        reason: 'insecure_context',
        message: 'Trình duyệt yêu cầu kết nối an toàn (HTTPS hoặc localhost) để cấp quyền lưu trữ bền vững.',
      };
    }

    try {
      // First check if already persisted
      if (navigator.storage.persisted) {
        const already = await navigator.storage.persisted();
        if (already) {
          return {
            success: true,
            message: 'Quyền khóa lưu trữ vĩnh viễn đã được kích hoạt từ trước!',
          };
        }
      }

      const isPersisted = await navigator.storage.persist();
      if (isPersisted) {
        return {
          success: true,
          message: '🛡️ Trình duyệt đã cấp quyền: Bộ nhớ được bảo vệ vĩnh viễn, không bao giờ bị xóa tự động!',
        };
      } else {
        return {
          success: false,
          reason: 'browser_denied',
          message: 'Trình duyệt tự động từ chối cấp quyền persist (do chưa đánh dấu Bookmark hoặc điểm tương tác chưa đủ).',
        };
      }
    } catch (err: any) {
      console.warn('Failed to request storage persistence:', err);
      return {
        success: false,
        reason: 'error',
        message: err?.message || 'Lỗi không xác định khi yêu cầu quyền lưu trữ.',
      };
    }
  },

  /**
   * Check if current origin already has persistent storage permissions,
   * plus current quota usage.
   */
  async getStatus(): Promise<StorageStatus> {
    const isSecureContext = typeof window !== 'undefined' ? window.isSecureContext : true;

    if (typeof navigator === 'undefined' || !navigator.storage) {
      return { isPersisted: false, supported: false, isSecureContext };
    }

    let isPersisted = false;
    try {
      if (navigator.storage.persisted) {
        isPersisted = await navigator.storage.persisted();
      }
    } catch (_) {}

    let quotaBytes: number | undefined;
    let usageBytes: number | undefined;
    let usagePercent: number | undefined;

    try {
      if (navigator.storage.estimate) {
        const estimate = await navigator.storage.estimate();
        quotaBytes = estimate.quota;
        usageBytes = estimate.usage;
        if (quotaBytes && usageBytes) {
          usagePercent = Math.min(100, Math.round((usageBytes / quotaBytes) * 1000) / 10);
        }
      }
    } catch (_) {}

    return {
      isPersisted,
      supported: true,
      quotaBytes,
      usageBytes,
      usagePercent,
      isSecureContext,
    };
  },

  /**
   * Format bytes to readable MB / GB
   */
  formatBytes(bytes?: number): string {
    if (!bytes || bytes <= 0) return '0 MB';
    const mb = bytes / (1024 * 1024);
    if (mb < 1024) {
      return `${mb.toFixed(1)} MB`;
    }
    const gb = mb / 1024;
    return `${gb.toFixed(2)} GB`;
  },
};
