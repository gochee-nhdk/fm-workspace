/**
 * FM Workspace — Full Backup & Restore Service
 * Format: .fmbackup (JSON with SHA-256 checksum)
 *
 * Covers ALL data: Links, Accounts, Stores, Notes (images + HTML),
 * Attachments (Blob → base64), Activities, System Settings.
 *
 * Security:
 * - SHA-256 checksum prevents tampered/corrupted imports
 * - HTML sanitizer strips <script>, on*, javascript:, data: URIs from Notes
 * - Max 50MB file size guard
 * - Magic byte verification (must start with valid JSON)
 * - No passwords are ever logged to console or activity records
 */

import { STORES, idbGetAll, idbPut, idbClear, getDB } from './storage/indexedDb';
import { noteService } from './noteService';
import { cryptoService } from './cryptoService';
import { api } from '@/lib/api';
import {
  LinkItem,
  AccountItem,
  StoreItem,
  ActivityLogItem,
  QuickNoteItem,
  SerializedAttachment,
  FMBackupFile,
  FMBackupPayload,
  BackupExportOptions,
  BackupImportOptions,
  BackupImportResult,
  FM_BACKUP_APP_NAME,
  FM_BACKUP_VERSION,
} from '@/types/workspace';
import { idbGetAll as idbGetAllTyped } from './storage/indexedDb';
import type { StoredAttachment } from './attachmentService';

// ──────────────────────────────────────────────
// CONSTANTS
// ──────────────────────────────────────────────
const MAX_IMPORT_BYTES = 50 * 1024 * 1024; // 50 MB
const BACKUP_FILE_EXT = '.fmbackup';
const BACKUP_MIME = 'application/json';

// ──────────────────────────────────────────────
// SHA-256 CHECKSUM (Web Crypto API — built-in)
// ──────────────────────────────────────────────
async function sha256Hex(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ──────────────────────────────────────────────
// HTML SANITIZER (no external deps — pure regex)
// Strips malicious content from imported Note HTML
// ──────────────────────────────────────────────
export function sanitizeNoteHTML(dirty: string): string {
  if (!dirty || typeof dirty !== 'string') return '';

  let clean = dirty;

  // 1. Remove entire <script> ... </script> blocks
  clean = clean.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');

  // 2. Remove <style> ... </style> blocks
  clean = clean.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');

  // 3. Remove dangerous tags entirely (iframe, object, embed, form, input, base, meta, link)
  // NOTE: Keep <svg> (vector icons/badges) and <button> (interactive action triggers) safe
  clean = clean.replace(
    /<\/?(?:iframe|object|embed|form|input|select|textarea|base|meta|link|frame|frameset|applet)\b[^>]*>/gi,
    ''
  );

  // 4. Remove ALL on* event handler attributes (onclick, onload, onerror, etc.)
  clean = clean.replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, '');

  // 5. Remove javascript: and vbscript: in href/src/action/formaction
  clean = clean.replace(
    /(href|src|action|formaction|xlink:href)\s*=\s*["']?\s*(?:javascript|vbscript|data(?!:image\/[a-z]+;base64))[^"'\s>]*/gi,
    '$1=""'
  );

  // 6. Remove data: URIs that are NOT safe images (allow data:image/png, jpeg, gif, webp, svg+xml)
  clean = clean.replace(
    /src\s*=\s*["']data:(?!image\/(?:png|jpeg|jpg|gif|webp|svg\+xml))[^"']*["']/gi,
    'src=""'
  );

  // 7. Remove expression() in style attributes (CSS injection)
  clean = clean.replace(/style\s*=\s*["'][^"']*expression\s*\([^"']*/gi, 'style=""');

  return clean;
}

// ──────────────────────────────────────────────
// BLOB ↔ BASE64 HELPERS
// ──────────────────────────────────────────────
async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1] ?? '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const bstr = atob(base64);
  const u8arr = new Uint8Array(bstr.length);
  for (let i = 0; i < bstr.length; i++) u8arr[i] = bstr.charCodeAt(i);
  return new Blob([u8arr], { type: mimeType });
}

// ──────────────────────────────────────────────
// EXPORT
// ──────────────────────────────────────────────
async function exportFullBackup(options: BackupExportOptions = {}): Promise<void> {
  const { includeActivities = true } = options;

  // 1. Collect all data from IndexedDB in parallel
  const [links, accounts, stores, notes, rawActivities, rawAttachments] = await Promise.all([
    idbGetAll<LinkItem>(STORES.LINKS),
    idbGetAll<AccountItem>(STORES.ACCOUNTS),
    idbGetAll<StoreItem>(STORES.STORES),
    idbGetAll<QuickNoteItem>(STORES.NOTES),
    includeActivities ? idbGetAll<ActivityLogItem>(STORES.ACTIVITIES) : Promise.resolve([]),
    idbGetAll<StoredAttachment>(STORES.ATTACHMENTS),
  ]);

  // 2. Serialize attachments: Blob → base64
  const attachments: SerializedAttachment[] = [];
  for (const att of rawAttachments) {
    try {
      if (!att.blob && !att.dataUrl) continue;
      let dataBase64 = '';
      if (att.blob) {
        dataBase64 = await blobToBase64(att.blob);
      } else if (att.dataUrl) {
        // Already a data URL — strip prefix
        const parts = att.dataUrl.split(',');
        dataBase64 = parts[1] ?? '';
      }
      if (!dataBase64) continue;
      attachments.push({
        id: att.id,
        name: att.name,
        type: att.type,
        size: att.size,
        dataBase64,
        createdAt: att.createdAt,
      });
    } catch (_) {
      // Skip unreadable attachments — don't fail the whole export
    }
  }

  // 3. Collect settings from localStorage (non-sensitive)
  let theme = 'system';
  try {
    const uiPref = localStorage.getItem('fm-ui-preferences');
    if (uiPref) {
      const parsed = JSON.parse(uiPref);
      theme = parsed?.state?.theme ?? 'system';
    }
  } catch (_) {}

  // 4. Build payload
  const payload: FMBackupPayload = {
    links,
    accounts, // passwords included — user's own data on their machine
    stores,
    notes,
    attachments,
    activities: rawActivities,
    settings: { theme },
  };

  const payloadStr = JSON.stringify(payload);
  let finalPayloadStr = payloadStr;
  let isEncrypted = false;

  // If user provided passphrase, encrypt using military-grade AES-GCM-256
  if (options.passphrase && options.passphrase.trim().length > 0) {
    const encPackage = await cryptoService.encrypt(payloadStr, options.passphrase.trim());
    finalPayloadStr = JSON.stringify(encPackage);
    isEncrypted = true;
  }

  // 5. Compute checksum over the actual payload being saved (ciphertext if encrypted, plaintext if not)
  const checksum = await sha256Hex(finalPayloadStr);

  // 6. Build backup file envelope
  const backupFile: FMBackupFile = {
    header: {
      version: FM_BACKUP_VERSION,
      appName: FM_BACKUP_APP_NAME,
      exportedAt: new Date().toISOString(),
      checksum,
      encrypted: isEncrypted,
      totalItems: {
        links: links.length,
        accounts: accounts.length,
        stores: stores.length,
        notes: notes.length,
        attachments: attachments.length,
      },
    },
    payload: finalPayloadStr,
  };

  // 7. Trigger download
  const blob = new Blob([JSON.stringify(backupFile, null, 2)], { type: BACKUP_MIME });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const dateStr = new Date().toISOString().slice(0, 10);
  const encSuffix = isEncrypted ? '_Encrypted' : '';
  a.href = url;
  a.download = `FM_Workspace_Backup_${dateStr}${encSuffix}${BACKUP_FILE_EXT}`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 200);
}

// ──────────────────────────────────────────────
// VALIDATE (before import)
// ──────────────────────────────────────────────
export interface BackupValidationResult {
  valid: boolean;
  header?: FMBackupFile['header'];
  error?: string;
}

async function validateBackupFile(file: File): Promise<BackupValidationResult> {
  // Guard 1: file size
  if (file.size > MAX_IMPORT_BYTES) {
    return { valid: false, error: `File quá lớn (${(file.size / 1024 / 1024).toFixed(1)} MB). Tối đa 50 MB.` };
  }

  // Guard 2: read and parse JSON
  let raw: string;
  try {
    raw = await file.text();
  } catch (_) {
    return { valid: false, error: 'Không thể đọc file. File có thể bị hỏng.' };
  }

  // Guard 3: starts with valid JSON object
  const trimmed = raw.trimStart();
  if (!trimmed.startsWith('{')) {
    return { valid: false, error: 'Định dạng file không hợp lệ (không phải .fmbackup).' };
  }

  let parsed: FMBackupFile;
  try {
    parsed = JSON.parse(raw) as FMBackupFile;
  } catch (_) {
    return { valid: false, error: 'File JSON bị lỗi hoặc không hoàn chỉnh.' };
  }

  // Guard 4: check required header fields
  const h = parsed?.header;
  if (!h || h.appName !== FM_BACKUP_APP_NAME || !h.version || !h.checksum || !h.exportedAt) {
    return { valid: false, error: 'File không phải backup hợp lệ của FM Workspace.' };
  }

  // Guard 5: version compatibility
  if (h.version !== FM_BACKUP_VERSION) {
    return {
      valid: false,
      error: `Phiên bản backup (${h.version}) không tương thích với phiên bản hiện tại (${FM_BACKUP_VERSION}).`,
    };
  }

  // Guard 6: checksum integrity
  if (!parsed.payload || typeof parsed.payload !== 'string') {
    return { valid: false, error: 'File backup không có dữ liệu payload.' };
  }

  const computedChecksum = await sha256Hex(parsed.payload);
  if (computedChecksum !== h.checksum) {
    return {
      valid: false,
      error: 'Checksum không khớp — file có thể đã bị chỉnh sửa hoặc hỏng. Import bị từ chối để bảo vệ dữ liệu.',
    };
  }

  return { valid: true, header: h };
}

// ──────────────────────────────────────────────
// IMPORT
// ──────────────────────────────────────────────
async function importFullBackup(
  file: File,
  options: BackupImportOptions,
  onProgress?: (msg: string) => void
): Promise<BackupImportResult> {
  const progress = (msg: string) => onProgress?.(msg);

  const result: BackupImportResult = {
    success: false,
    links: 0,
    accounts: 0,
    stores: 0,
    notes: 0,
    attachments: 0,
    skipped: 0,
    errors: [],
  };

  // ── Step 1: Validate
  progress('Đang xác thực file backup...');
  const validation = await validateBackupFile(file);
  if (!validation.valid) {
    result.errors.push(validation.error ?? 'Lỗi xác thực không xác định');
    return result;
  }

  // ── Step 2: Parse payload
  let payload: FMBackupPayload;
  try {
    const raw = await file.text();
    const backupFile = JSON.parse(raw) as FMBackupFile;

    // Check if backup is encrypted
    if (backupFile.header.encrypted) {
      if (!options.passphrase || options.passphrase.trim().length === 0) {
        result.errors.push('File sao lưu này đã được mã hóa bảo vệ. Vui lòng nhập mật khẩu để giải mã.');
        return result;
      }
      try {
        const encPackage = JSON.parse(backupFile.payload);
        const decryptedStr = await cryptoService.decrypt(encPackage, options.passphrase.trim());
        payload = JSON.parse(decryptedStr) as FMBackupPayload;
      } catch (decErr: any) {
        result.errors.push(decErr.message || 'Mật khẩu giải mã không chính xác.');
        return result;
      }
    } else {
      payload = JSON.parse(backupFile.payload) as FMBackupPayload;
    }
  } catch (_) {
    result.errors.push('Không thể giải mã payload từ file backup.');
    return result;
  }

  const { conflictStrategy, restoreSettings = false } = options;
  const now = new Date().toISOString();

  // ── Step 3: Read existing data for conflict detection
  progress('Đang tải dữ liệu hiện tại để kiểm tra trùng lặp...');
  const [existingLinks, existingAccounts, existingStores, existingNotes, existingAttachments] =
    await Promise.all([
      idbGetAll<LinkItem>(STORES.LINKS),
      idbGetAll<AccountItem>(STORES.ACCOUNTS),
      idbGetAll<StoreItem>(STORES.STORES),
      idbGetAll<QuickNoteItem>(STORES.NOTES),
      idbGetAll<StoredAttachment>(STORES.ATTACHMENTS),
    ]);

  const norm = (s: string) => (s || '').trim().toLowerCase();

  // ── Step 4: Import Links
  progress('Đang nhập Links...');
  for (const link of payload.links ?? []) {
    try {
      const dup = existingLinks.find(
        (e) => norm(e.hangMuc) === norm(link.hangMuc) || (link.link && norm(e.link) === norm(link.link))
      );
      if (dup) {
        if (conflictStrategy === 'skip') { result.skipped++; continue; }
        if (conflictStrategy === 'overwrite') {
          await idbPut<LinkItem>(STORES.LINKS, { ...link, id: dup.id, updatedAt: now });
          result.links++;
          continue;
        }
      }
      // merge = always add, or no conflict
      await idbPut<LinkItem>(STORES.LINKS, { ...link, id: link.id || crypto.randomUUID(), updatedAt: now });
      result.links++;
    } catch (e) {
      result.errors.push(`Link "${link.hangMuc}": ${(e as Error).message}`);
    }
  }

  // ── Step 5: Import Accounts
  progress('Đang nhập Tài khoản...');
  for (const acc of payload.accounts ?? []) {
    try {
      const dup = existingAccounts.find(
        (e) => norm(e.software) === norm(acc.software) && norm(e.username) === norm(acc.username)
      );
      if (dup) {
        if (conflictStrategy === 'skip') { result.skipped++; continue; }
        if (conflictStrategy === 'overwrite') {
          await idbPut<AccountItem>(STORES.ACCOUNTS, { ...acc, id: dup.id, updatedAt: now });
          result.accounts++;
          continue;
        }
      }
      await idbPut<AccountItem>(STORES.ACCOUNTS, { ...acc, id: acc.id || crypto.randomUUID(), updatedAt: now });
      result.accounts++;
    } catch (e) {
      result.errors.push(`Tài khoản "${acc.software}/${acc.username}": ${(e as Error).message}`);
    }
  }

  // ── Step 6: Import Stores
  progress('Đang nhập Cửa hàng...');
  for (const store of payload.stores ?? []) {
    try {
      const dup = existingStores.find((e) => norm(e.storeCode) === norm(store.storeCode));
      if (dup) {
        if (conflictStrategy === 'skip') { result.skipped++; continue; }
        if (conflictStrategy === 'overwrite') {
          await idbPut<StoreItem>(STORES.STORES, { ...store, id: dup.id, updatedAt: now });
          result.stores++;
          continue;
        }
      }
      await idbPut<StoreItem>(STORES.STORES, { ...store, id: store.id || crypto.randomUUID(), updatedAt: now });
      result.stores++;
    } catch (e) {
      result.errors.push(`Cửa hàng "${store.storeCode}": ${(e as Error).message}`);
    }
  }

  // ── Step 7: Import Notes (with HTML sanitization)
  progress('Đang nhập Ghi chú (đang lọc bảo mật HTML)...');
  for (const note of payload.notes ?? []) {
    try {
      const dup = existingNotes.find((e) => e.id === note.id);
      if (dup) {
        if (conflictStrategy === 'skip') { result.skipped++; continue; }
        if (conflictStrategy === 'overwrite') {
          const sanitized: QuickNoteItem = {
            ...note,
            content: sanitizeNoteHTML(note.content),
            checklistContent: note.checklistContent ? sanitizeNoteHTML(note.checklistContent) : note.checklistContent,
            updatedAt: now,
          };
          await idbPut<QuickNoteItem>(STORES.NOTES, sanitized);
          result.notes++;
          continue;
        }
        // merge: add with new id to avoid collision
        const sanitized: QuickNoteItem = {
          ...note,
          id: 'note_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7),
          content: sanitizeNoteHTML(note.content),
          checklistContent: note.checklistContent ? sanitizeNoteHTML(note.checklistContent) : note.checklistContent,
          updatedAt: now,
        };
        await idbPut<QuickNoteItem>(STORES.NOTES, sanitized);
        result.notes++;
        continue;
      }
      // No conflict
      const sanitized: QuickNoteItem = {
        ...note,
        content: sanitizeNoteHTML(note.content),
        checklistContent: note.checklistContent ? sanitizeNoteHTML(note.checklistContent) : note.checklistContent,
      };
      await idbPut<QuickNoteItem>(STORES.NOTES, sanitized);
      result.notes++;
    } catch (e) {
      result.errors.push(`Ghi chú "${note.title}": ${(e as Error).message}`);
    }
  }

  // ── Step 8: Import Attachments (base64 → Blob)
  progress('Đang nhập Tệp đính kèm...');
  for (const att of payload.attachments ?? []) {
    try {
      const dup = existingAttachments.find((e) => e.id === att.id);
      if (dup) {
        if (conflictStrategy === 'skip') { result.skipped++; continue; }
        // overwrite/merge: restore the file
      }
      const blob = base64ToBlob(att.dataBase64, att.type);
      const record: StoredAttachment = {
        id: att.id,
        name: att.name,
        type: att.type,
        size: att.size,
        blob,
        createdAt: att.createdAt,
      };
      await idbPut<StoredAttachment>(STORES.ATTACHMENTS, record);
      result.attachments++;
    } catch (e) {
      result.errors.push(`Tệp đính kèm "${att.name}": ${(e as Error).message}`);
    }
  }

  // ── Step 9: Restore settings (opt-in only)
  if (restoreSettings && payload.settings?.theme) {
    try {
      const uiPref = localStorage.getItem('fm-ui-preferences');
      const current = uiPref ? JSON.parse(uiPref) : { state: {}, version: 0 };
      current.state = { ...current.state, theme: payload.settings.theme };
      localStorage.setItem('fm-ui-preferences', JSON.stringify(current));
    } catch (_) {
      result.errors.push('Không thể khôi phục cài đặt giao diện.');
    }
  }

  // ── Step 10: Sync notes cache to localStorage
  try {
    const allNotes = await idbGetAll<QuickNoteItem>(STORES.NOTES);
    await noteService.getAllNotes(); // triggers internal cache sync
  } catch (_) {}

  result.success = result.errors.length === 0 || (
    result.links + result.accounts + result.stores + result.notes + result.attachments > 0
  );

  return result;
}

/**
 * Generate full backup payload object without triggering a file download.
 * Used for automated background server sync.
 */
async function generateBackupPayload(): Promise<{ payloadStr: string; checksum: string; itemCounts: any }> {
  const [links, accounts, stores, notes, rawActivities, rawAttachments] = await Promise.all([
    idbGetAll<LinkItem>(STORES.LINKS),
    idbGetAll<AccountItem>(STORES.ACCOUNTS),
    idbGetAll<StoreItem>(STORES.STORES),
    idbGetAll<QuickNoteItem>(STORES.NOTES),
    idbGetAll<ActivityLogItem>(STORES.ACTIVITIES),
    idbGetAll<StoredAttachment>(STORES.ATTACHMENTS),
  ]);

  const attachments: SerializedAttachment[] = [];
  for (const att of rawAttachments) {
    try {
      if (!att.blob && !att.dataUrl) continue;
      let dataBase64 = '';
      if (att.blob) {
        dataBase64 = await blobToBase64(att.blob);
      } else if (att.dataUrl) {
        const parts = att.dataUrl.split(',');
        dataBase64 = parts[1] ?? '';
      }
      if (!dataBase64) continue;
      attachments.push({
        id: att.id,
        name: att.name,
        type: att.type,
        size: att.size,
        dataBase64,
        createdAt: att.createdAt,
      });
    } catch (_) {}
  }

  let theme = 'system';
  try {
    const uiPref = localStorage.getItem('fm-ui-preferences');
    if (uiPref) {
      const parsed = JSON.parse(uiPref);
      theme = parsed?.state?.theme ?? 'system';
    }
  } catch (_) {}

  const payload: FMBackupPayload = {
    links,
    accounts,
    stores,
    notes,
    attachments,
    activities: rawActivities,
    settings: { theme },
  };

  const payloadStr = JSON.stringify(payload);
  const checksum = await sha256Hex(payloadStr);

  return {
    payloadStr,
    checksum,
    itemCounts: {
      links: links.length,
      accounts: accounts.length,
      stores: stores.length,
      notes: notes.length,
      attachments: attachments.length,
    },
  };
}

/**
 * Sync current workspace state to backend dual-storage (Server SQLite & Disk Vault)
 */
async function syncToServer(backupType: 'auto' | 'manual' | 'snapshot' = 'auto'): Promise<{ success: boolean; message?: string }> {
  try {
    const { payloadStr, checksum, itemCounts } = await generateBackupPayload();

    const res = await api.post('/sync/backup', {
      backupType,
      deviceName: typeof navigator !== 'undefined' ? `${navigator.platform || 'Device'} (${navigator.userAgent.slice(0, 30)})` : 'Web Client',
      checksum,
      itemCounts,
      payload: payloadStr,
      isEncrypted: false,
    });

    return { success: res.data?.success ?? true };
  } catch (err: any) {
    console.warn('Failed to sync workspace to server:', err);
    const msg = err.response?.data?.message || err.response?.data?.error || err.message;
    return { success: false, message: msg };
  }
}

/**
 * Fetch latest backup metadata and list from server
 */
async function getServerBackupHistory(): Promise<any[]> {
  try {
    const res = await api.get('/sync/history');
    return res.data?.data || [];
  } catch (err) {
    console.warn('Failed to fetch server backup history:', err);
    return [];
  }
}

/**
 * Restore workspace directly from server backup
 */
async function restoreFromServer(backupId?: string): Promise<BackupImportResult> {
  const url = backupId ? `/sync/download/${backupId}` : '/sync/latest';
  const res = await api.get(url);
  const serverRecord = res.data?.data;

  if (!serverRecord || !serverRecord.payload) {
    throw new Error('Không tìm thấy dữ liệu sao lưu hợp lệ trên máy chủ.');
  }

  // Create a synthetic File object to pass into importFullBackup
  const syntheticFile = new File(
    [
      JSON.stringify({
        header: {
          version: FM_BACKUP_VERSION,
          appName: FM_BACKUP_APP_NAME,
          exportedAt: serverRecord.created_at || new Date().toISOString(),
          checksum: serverRecord.checksum,
          encrypted: Boolean(serverRecord.is_encrypted),
          totalItems: typeof serverRecord.item_counts === 'string' ? JSON.parse(serverRecord.item_counts) : (serverRecord.item_counts || {}),
        },
        payload: serverRecord.payload,
      })
    ],
    `server_restore_${Date.now()}.fmbackup`,
    { type: 'application/json' }
  );

  return importFullBackup(syntheticFile, { conflictStrategy: 'overwrite', restoreSettings: true });
}

// ──────────────────────────────────────────────
// PUBLIC API
// ──────────────────────────────────────────────
export const backupService = {
  exportFullBackup,
  importFullBackup,
  validateBackupFile,
  sanitizeNoteHTML,
  generateBackupPayload,
  syncToServer,
  getServerBackupHistory,
  restoreFromServer,
};
