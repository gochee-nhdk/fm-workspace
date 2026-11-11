// Native IndexedDB Engine with high-performance persistent storage
const DB_NAME = 'FM_WORKSPACE_DB';
const DB_VERSION = 4;

export const getActiveDbName = (): string => DB_NAME;

export const switchDatabaseUser = async (_newUserId?: string | null): Promise<void> => {
  // Always use the primary unified FM_WORKSPACE_DB
  if (dbInstance) {
    try {
      dbInstance.close();
    } catch (_) {}
  }
  dbInstance = null;
  dbOpenPromise = null;
  if (typeof window !== 'undefined' && window.indexedDB) {
    try {
      await getDB();
    } catch (err) {
      console.warn('Failed to open database:', err);
    }
  }
};

export const STORES = {
  LINKS: 'links',
  ACCOUNTS: 'accounts',
  STORES: 'stores',
  ACTIVITIES: 'activities',
  NOTES: 'notes',
  ATTACHMENTS: 'attachments',
  POS: 'pos',
  PO_FOLDERS: 'po_folders',
} as const;

export type StoreName = (typeof STORES)[keyof typeof STORES];

let dbInstance: IDBDatabase | null = null;
let dbOpenPromise: Promise<IDBDatabase> | null = null;
let migrationStarted = false;

export const getDB = (): Promise<IDBDatabase> => {
  if (dbInstance) {
    return Promise.resolve(dbInstance);
  }

  if (dbOpenPromise) {
    return dbOpenPromise;
  }

  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.reject(new Error('IndexedDB is not supported in this environment'));
  }

  dbOpenPromise = new Promise((resolve, reject) => {
    const dbName = getActiveDbName();
    const request = indexedDB.open(dbName, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      const upgradeTx = (event.target as IDBOpenDBRequest).transaction;

      if (!db.objectStoreNames.contains(STORES.LINKS)) {
        const linkStore = db.createObjectStore(STORES.LINKS, { keyPath: 'id' });
        linkStore.createIndex('hangMuc', 'hangMuc', { unique: false });
        linkStore.createIndex('category', 'category', { unique: false });
        linkStore.createIndex('favorite', 'favorite', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.ACCOUNTS)) {
        const accStore = db.createObjectStore(STORES.ACCOUNTS, { keyPath: 'id' });
        accStore.createIndex('software', 'software', { unique: false });
        accStore.createIndex('username', 'username', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.STORES)) {
        const storeStore = db.createObjectStore(STORES.STORES, { keyPath: 'id' });
        storeStore.createIndex('storeCode', 'storeCode', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.ACTIVITIES)) {
        const actStore = db.createObjectStore(STORES.ACTIVITIES, { keyPath: 'id' });
        actStore.createIndex('timestamp', 'timestamp', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.NOTES)) {
        const noteStore = db.createObjectStore(STORES.NOTES, { keyPath: 'id' });
        noteStore.createIndex('updatedAt', 'updatedAt', { unique: false });
        noteStore.createIndex('pinned', 'pinned', { unique: false });
        noteStore.createIndex('title', 'title', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.ATTACHMENTS)) {
        const attachStore = db.createObjectStore(STORES.ATTACHMENTS, { keyPath: 'id' });
        attachStore.createIndex('createdAt', 'createdAt', { unique: false });
        attachStore.createIndex('hash', 'hash', { unique: false });
      } else if (upgradeTx) {
        try {
          const attachStore = upgradeTx.objectStore(STORES.ATTACHMENTS);
          if (!attachStore.indexNames.contains('hash')) {
            attachStore.createIndex('hash', 'hash', { unique: false });
          }
        } catch (_) {}
      }

      // v4: PO Tracker stores with comprehensive indices
      if (!db.objectStoreNames.contains(STORES.POS)) {
        const poStore = db.createObjectStore(STORES.POS, { keyPath: 'id' });
        poStore.createIndex('poNumber', 'poNumber', { unique: false });
        poStore.createIndex('vendorCode', 'vendorCode', { unique: false });
        poStore.createIndex('status', 'status', { unique: false });
        poStore.createIndex('folderId', 'folderId', { unique: false });
        // Also add snake_case indices for maximum query resilience
        poStore.createIndex('po_number', 'po_number', { unique: false });
        poStore.createIndex('supplier_code', 'supplier_code', { unique: false });
        poStore.createIndex('folder_id', 'folder_id', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.PO_FOLDERS)) {
        db.createObjectStore(STORES.PO_FOLDERS, { keyPath: 'id' });
      }
    };

    request.onsuccess = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      dbInstance = db;
      dbOpenPromise = null;

      // Handle connection unexpected closure or version change gracefully
      db.onversionchange = () => {
        try {
          db.close();
        } catch (_) {}
        dbInstance = null;
        dbOpenPromise = null;
      };

      db.onclose = () => {
        dbInstance = null;
        dbOpenPromise = null;
      };

      db.onerror = () => {
        dbInstance = null;
        dbOpenPromise = null;
      };

      // Trigger auto-migration asynchronously without blocking the initial open
      if (!migrationStarted) {
        migrationStarted = true;
        setTimeout(() => {
          migrateLocalStorageToIndexedDB().catch((err) => {
            console.warn('[IndexedDB] Auto-migration warning:', err);
          });
        }, 20);
      }

      resolve(db);
    };

    request.onerror = (event) => {
      dbOpenPromise = null;
      console.error('IndexedDB open error:', (event.target as IDBOpenDBRequest).error);
      reject((event.target as IDBOpenDBRequest).error);
    };
  });

  return dbOpenPromise;
};

/**
 * Auto-migration helper: Automatically migrates po_tracker_local_pos_v2 and fm_po_folders
 * from localStorage into IndexedDB v4 without losing any user records.
 * Maintains two-way compatibility between localStorage and IndexedDB.
 */
export const migrateLocalStorageToIndexedDB = async (): Promise<void> => {
  if (typeof window === 'undefined' || !window.localStorage) return;

  try {
    const rawPos = localStorage.getItem('po_tracker_local_pos_v2');
    const rawFolders =
      localStorage.getItem('fm_po_folders') ||
      localStorage.getItem('po_tracker_local_folders_v2');

    const db = await getDB();
    if (!db.objectStoreNames.contains(STORES.POS) || !db.objectStoreNames.contains(STORES.PO_FOLDERS)) {
      return;
    }

    // 1. Migrate PO Folders
    if (rawFolders) {
      try {
        const folders = JSON.parse(rawFolders);
        if (Array.isArray(folders) && folders.length > 0) {
          const existingFolders = await idbGetAll<any>(STORES.PO_FOLDERS);
          const existingFolderIds = new Set(existingFolders.map((f: any) => f.id));
          const toAdd = folders.filter((f: any) => f && f.id && !existingFolderIds.has(f.id));
          if (toAdd.length > 0) {
            await idbBulkPut(STORES.PO_FOLDERS, toAdd);
          }
        }
      } catch (fErr) {
        console.warn('[Migration] Failed to parse local folders:', fErr);
      }
    }

    // 2. Migrate Purchase Orders
    if (rawPos) {
      try {
        const pos = JSON.parse(rawPos);
        if (Array.isArray(pos) && pos.length > 0) {
          const existingPos = await idbGetAll<any>(STORES.POS);
          const existingPoIds = new Set(existingPos.map((p: any) => p.id));
          const toAdd = pos.filter((p: any) => p && p.id && !existingPoIds.has(p.id));
          if (toAdd.length > 0) {
            await idbBulkPut(STORES.POS, toAdd);
          }
        }
      } catch (pErr) {
        console.warn('[Migration] Failed to parse local POs:', pErr);
      }
    }

    // 3. Bidirectional compatibility: Sync back full sets to localStorage
    const currentIdbPos = await idbGetAll<any>(STORES.POS);
    if (currentIdbPos.length > 0) {
      try {
        localStorage.setItem('po_tracker_local_pos_v2', JSON.stringify(currentIdbPos));
      } catch (_) {}
    }

    const currentIdbFolders = await idbGetAll<any>(STORES.PO_FOLDERS);
    if (currentIdbFolders.length > 0) {
      try {
        localStorage.setItem('fm_po_folders', JSON.stringify(currentIdbFolders));
        localStorage.setItem('po_tracker_local_folders_v2', JSON.stringify(currentIdbFolders));
      } catch (_) {}
    }
  } catch (err) {
    console.warn('[Migration] Auto-migration error:', err);
  }
};

export const idbGetAll = async <T>(storeName: StoreName): Promise<T[]> => {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.getAll();

    request.onsuccess = () => resolve((request.result as T[]) || []);
    request.onerror = () => reject(request.error);
  });
};

export const idbGetById = async <T>(storeName: StoreName, id: string): Promise<T | null> => {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.get(id);

    request.onsuccess = () => resolve((request.result as T) || null);
    request.onerror = () => reject(request.error);
  });
};

export const idbPut = async <T>(storeName: StoreName, item: T): Promise<T> => {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.put(item);

    request.onsuccess = () => resolve(item);
    request.onerror = () => reject(request.error);
  });
};

export const idbBulkPut = async <T>(storeName: StoreName, items: T[]): Promise<void> => {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);

    items.forEach((item) => {
      store.put(item);
    });

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

export const idbDelete = async (storeName: StoreName, id: string): Promise<void> => {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const idbClear = async (storeName: StoreName): Promise<void> => {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const idbClearAll = async (): Promise<void> => {
  await Promise.all([
    idbClear(STORES.LINKS),
    idbClear(STORES.ACCOUNTS),
    idbClear(STORES.STORES),
    idbClear(STORES.ACTIVITIES),
    idbClear(STORES.NOTES),
    idbClear(STORES.ATTACHMENTS),
    idbClear(STORES.POS),
    idbClear(STORES.PO_FOLDERS),
  ]);
};
