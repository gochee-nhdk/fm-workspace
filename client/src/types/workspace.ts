export interface LinkItem {
  id: string;
  stt?: number | null;
  hangMuc: string;
  link: string;
  note?: string;
  category?: string;
  favorite?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AccountItem {
  id: string;
  stt?: number | null;
  software: string;
  username: string;
  password?: string;
  link?: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StoreItem {
  id: string;
  stt?: number | null;
  storeCode: string;
  address: string;
  googleMaps?: string;
  type?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ActivityLogItem {
  id: string;
  timestamp: string;
  action: 'create' | 'update' | 'delete' | 'import' | 'export';
  dataset: 'LINK' | 'ACCOUNT' | 'STORE' | 'ALL';
  recordId: string;
  details: string; // Strictly NO credentials/passwords here!
}

export type DuplicateStrategy = 'skip' | 'update' | 'duplicate';

export interface SheetPreview {
  sheetName: string;
  targetDataset: 'LINK' | 'ACCOUNT' | 'STORE' | 'IGNORE';
  totalRows: number;
  validCount: number;
  invalidCount: number;
  duplicateCount: number;
  rows: any[];
  errors: string[];
}

export interface ImportPreviewResult {
  fileName: string;
  fileSize: number;
  sheets: SheetPreview[];
}

export interface WorkspaceSummary {
  totalLinks: number;
  totalAccounts: number;
  totalStores: number;
  favoriteLinks: LinkItem[];
  recentStores: StoreItem[];
  recentActivities: ActivityLogItem[];
}

export type QuickNoteColor = 'amber' | 'blue' | 'emerald' | 'purple' | 'rose';

export interface TaskReminder {
  id: string; // unique task identifier (e.g. task-0, or hash)
  taskText: string;
  reminderAt: string; // ISO datetime string
  reminderCompleted?: boolean;
}

export type EmailProviderType = 'gmail' | 'outlook' | 'mailto';

export interface NoteImageAttachment {
  id: string;
  url: string; // Base64 data URL
  name?: string;
  size?: number; // Size in bytes
  createdAt: string;
}

export interface QuickNoteItem {
  id: string;
  title: string;
  content: string;
  checklistContent?: string;
  noteType?: 'note' | 'checklist';
  pinned?: boolean;
  color?: QuickNoteColor;
  tags?: string[];
  images?: NoteImageAttachment[];
  reminderAt?: string | null;
  reminderEmail?: string | null;
  reminderNotifyDesktop?: boolean;
  reminderNotifyEmail?: boolean;
  reminderCompleted?: boolean;
  taskReminders?: TaskReminder[];
  emailProvider?: EmailProviderType;
  isLocked?: boolean;
  password?: string;
  createdAt: string;
  updatedAt: string;
}


// ==================== BACKUP SYSTEM (.fmbackup) ====================

export const FM_BACKUP_APP_NAME = 'FM_WORKSPACE' as const;
export const FM_BACKUP_VERSION = '1.0' as const;

/** Serialized representation of a binary attachment (Blob → base64) */
export interface SerializedAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  dataBase64: string; // Blob converted to base64
  createdAt: string;
}

/** Backup file payload (all user data) */
export interface FMBackupPayload {
  links: LinkItem[];
  accounts: AccountItem[];
  stores: StoreItem[];
  notes: QuickNoteItem[]; // images[] stay as base64 data URLs
  attachments: SerializedAttachment[];
  activities: ActivityLogItem[];
  settings: {
    theme: string;
  };
}

/** Top-level .fmbackup file structure */
export interface FMBackupFile {
  header: {
    version: typeof FM_BACKUP_VERSION;
    appName: typeof FM_BACKUP_APP_NAME;
    exportedAt: string; // ISO timestamp
    checksum: string;   // SHA-256 hex of serialized payload string
    encrypted: boolean;
    totalItems: {
      links: number;
      accounts: number;
      stores: number;
      notes: number;
      attachments: number;
    };
  };
  payload: string; // JSON string of FMBackupPayload
}

/** Options for export */
export interface BackupExportOptions {
  includeActivities?: boolean; // default: true
}

/** Options for import */
export interface BackupImportOptions {
  conflictStrategy: 'skip' | 'overwrite' | 'merge';
  restoreSettings?: boolean; // default: false (safer)
}

/** Result summary of an import operation */
export interface BackupImportResult {
  success: boolean;
  links: number;
  accounts: number;
  stores: number;
  notes: number;
  attachments: number;
  skipped: number;
  errors: string[];
}
