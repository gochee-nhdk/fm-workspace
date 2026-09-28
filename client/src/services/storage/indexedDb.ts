// Native IndexedDB Engine with high-performance persistent storage
const DB_NAME = 'FM_WORKSPACE_DB';
const DB_VERSION = 3;

export const STORES = {
  LINKS: 'links',
  ACCOUNTS: 'accounts',
  STORES: 'stores',
  ACTIVITIES: 'activities',
  NOTES: 'notes',
  ATTACHMENTS: 'attachments',
} as const;

export type StoreName = (typeof STORES)[keyof typeof STORES];

let dbInstance: IDBDatabase | null = null;
let dbOpenPromise: Promise<IDBDatabase> | null = null;

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
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

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
  ]);
};
