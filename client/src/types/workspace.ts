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

export interface QuickNoteItem {
  id: string;
  title: string;
  content: string;
  pinned?: boolean;
  color?: QuickNoteColor;
  tags?: string[];
  reminderAt?: string | null;
  reminderEmail?: string | null;
  reminderNotifyDesktop?: boolean;
  reminderNotifyEmail?: boolean;
  reminderCompleted?: boolean;
  taskReminders?: TaskReminder[];
  emailProvider?: EmailProviderType;
  createdAt: string;
  updatedAt: string;
}

