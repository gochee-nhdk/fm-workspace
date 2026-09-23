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

export interface QuickNoteItem {
  id: string;
  title: string;
  content: string;
  pinned?: boolean;
  color?: QuickNoteColor;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}
