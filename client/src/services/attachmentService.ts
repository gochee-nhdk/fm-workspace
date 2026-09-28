import { STORES, idbGetById, idbPut, idbDelete } from './storage/indexedDb';
import { formatFileSize } from './noteImageService';

export interface StoredAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  blob?: Blob;
  dataUrl?: string;
  createdAt: string;
}

// In-memory URL cache for instantaneous zero-latency preview & download
const objectUrlCache = new Map<string, string>();

export const attachmentService = {
  /**
   * Save a heavy file or blob directly into IndexedDB without blocking the main UI thread.
   * Returns a lightweight ID and formatted size string to embed in HTML.
   */
  async saveAttachment(file: File | Blob, name: string): Promise<{ id: string; size: number; sizeStr: string; url: string }> {
    const id = 'att_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 8);
    const record: StoredAttachment = {
      id,
      name,
      type: file.type || 'application/octet-stream',
      size: file.size,
      blob: file,
      createdAt: new Date().toISOString(),
    };

    await idbPut<StoredAttachment>(STORES.ATTACHMENTS, record);

    // Cache the object URL in memory
    let bUrl = '';
    try {
      bUrl = URL.createObjectURL(file);
      objectUrlCache.set(id, bUrl);
    } catch (_) {}

    return {
      id,
      size: file.size,
      sizeStr: formatFileSize(file.size),
      url: bUrl,
    };
  },

  /**
   * Retrieves an attachment by ID from IndexedDB with in-memory Blob URL caching.
   */
  async getAttachment(id: string): Promise<{ blob: Blob; url: string; name: string; size: number; sizeStr?: string } | null> {
    const cachedUrl = objectUrlCache.get(id);

    try {
      const record = await idbGetById<StoredAttachment>(STORES.ATTACHMENTS, id);
      if (!record) return null;

      let blob = record.blob;
      if (!blob && record.dataUrl) {
        try {
          const parts = record.dataUrl.split(',');
          const mime = parts[0].match(/:(.*?);/)?.[1] || 'application/octet-stream';
          const bstr = atob(parts[1]);
          const u8arr = new Uint8Array(bstr.length);
          for (let i = 0; i < bstr.length; i++) u8arr[i] = bstr.charCodeAt(i);
          blob = new Blob([u8arr], { type: mime });
        } catch (_) {}
      }

      if (!blob) return null;

      let url = cachedUrl;
      if (!url) {
        url = URL.createObjectURL(blob);
        objectUrlCache.set(id, url);
      }

      return {
        blob,
        url,
        name: record.name,
        size: record.size,
        sizeStr: formatFileSize(record.size),
      };
    } catch (err) {
      console.error('Lỗi khi truy xuất tệp từ IndexedDB:', err);
      return null;
    }
  },

  /**
   * Directly triggers download for an attachment
   */
  async downloadAttachment(id: string, fallbackName?: string): Promise<void> {
    const att = await this.getAttachment(id);
    if (!att) return;
    const a = document.createElement('a');
    a.href = att.url;
    a.download = fallbackName || att.name || 'tep_tin';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      if (document.body.contains(a)) {
        document.body.removeChild(a);
      }
    }, 150);
  },

  /**
   * Delete an attachment from IndexedDB and release its object URL.
   */
  async deleteAttachment(id: string): Promise<boolean> {
    const cachedUrl = objectUrlCache.get(id);
    if (cachedUrl) {
      URL.revokeObjectURL(cachedUrl);
      objectUrlCache.delete(id);
    }
    try {
      await idbDelete(STORES.ATTACHMENTS, id);
      return true;
    } catch (_) {
      return false;
    }
  },
};
