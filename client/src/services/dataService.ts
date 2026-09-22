import {
  idbGetAll,
  idbGetById,
  idbPut,
  idbBulkPut,
  idbDelete,
  idbClearAll,
  STORES,
} from './storage/indexedDb';
import {
  LinkItem,
  AccountItem,
  StoreItem,
  ActivityLogItem,
  WorkspaceSummary,
} from '@/types/workspace';
import { initialLinks, initialAccounts, initialStores } from '@/data/seedData';

const generateId = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
};

class DataService {
  private initialized = false;

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;

    try {
      const existingLinks = await idbGetAll<LinkItem>(STORES.LINKS);
      const existingAccounts = await idbGetAll<AccountItem>(STORES.ACCOUNTS);
      const existingStores = await idbGetAll<StoreItem>(STORES.STORES);

      // If initial seed data exists and database is fresh, populate
      if (existingLinks.length === 0 && initialLinks.length > 0) {
        await idbBulkPut(STORES.LINKS, initialLinks);
      }
      if (existingAccounts.length === 0 && initialAccounts.length > 0) {
        await idbBulkPut(STORES.ACCOUNTS, initialAccounts);
      }
      if (existingStores.length === 0 && initialStores.length > 0) {
        await idbBulkPut(STORES.STORES, initialStores);
      }

      this.initialized = true;
    } catch (err) {
      console.error('Failed to initialize local workspace storage:', err);
    }
  }

  // ==================== ACTIVITY LOG ====================
  // Note: NEVER pass password into details or log records!
  async logActivity(
    action: ActivityLogItem['action'],
    dataset: ActivityLogItem['dataset'],
    recordId: string,
    details: string
  ): Promise<void> {
    try {
      const activity: ActivityLogItem = {
        id: generateId(),
        timestamp: new Date().toISOString(),
        action,
        dataset,
        recordId,
        details,
      };
      await idbPut(STORES.ACTIVITIES, activity);
    } catch (err) {
      console.warn('Failed to log workspace activity:', err);
    }
  }

  async getActivities(limit = 30): Promise<ActivityLogItem[]> {
    await this.ensureInitialized();
    const items = await idbGetAll<ActivityLogItem>(STORES.ACTIVITIES);
    return items
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }

  // ==================== LINKS ====================
  async getLinks(): Promise<LinkItem[]> {
    await this.ensureInitialized();
    const items = await idbGetAll<LinkItem>(STORES.LINKS);
    return items.sort((a, b) => {
      if (a.favorite && !b.favorite) return -1;
      if (!a.favorite && b.favorite) return 1;
      return (a.stt ?? 999999) - (b.stt ?? 999999);
    });
  }

  async createLink(data: Omit<LinkItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<LinkItem> {
    await this.ensureInitialized();
    const now = new Date().toISOString();
    const newLink: LinkItem = {
      ...data,
      id: generateId(),
      favorite: !!data.favorite,
      createdAt: now,
      updatedAt: now,
    };
    await idbPut(STORES.LINKS, newLink);
    await this.logActivity('create', 'LINK', newLink.id, `Đã thêm liên kết: ${newLink.hangMuc}`);
    return newLink;
  }

  async updateLink(id: string, data: Partial<Omit<LinkItem, 'id' | 'createdAt'>>): Promise<LinkItem> {
    await this.ensureInitialized();
    const existing = await idbGetById<LinkItem>(STORES.LINKS, id);
    if (!existing) throw new Error('Liên kết không tồn tại');

    const updated: LinkItem = {
      ...existing,
      ...data,
      updatedAt: new Date().toISOString(),
    };
    await idbPut(STORES.LINKS, updated);
    await this.logActivity('update', 'LINK', updated.id, `Đã cập nhật liên kết: ${updated.hangMuc}`);
    return updated;
  }

  async toggleFavoriteLink(id: string): Promise<LinkItem> {
    const existing = await idbGetById<LinkItem>(STORES.LINKS, id);
    if (!existing) throw new Error('Liên kết không tồn tại');
    return this.updateLink(id, { favorite: !existing.favorite });
  }

  async deleteLink(id: string): Promise<void> {
    await this.ensureInitialized();
    const existing = await idbGetById<LinkItem>(STORES.LINKS, id);
    await idbDelete(STORES.LINKS, id);
    if (existing) {
      await this.logActivity('delete', 'LINK', id, `Đã xóa liên kết: ${existing.hangMuc}`);
    }
  }

  // ==================== ACCOUNTS ====================
  async getAccounts(): Promise<AccountItem[]> {
    await this.ensureInitialized();
    const items = await idbGetAll<AccountItem>(STORES.ACCOUNTS);
    return items.sort((a, b) => (a.stt ?? 999999) - (b.stt ?? 999999));
  }

  async createAccount(data: Omit<AccountItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<AccountItem> {
    await this.ensureInitialized();
    const now = new Date().toISOString();
    const newAccount: AccountItem = {
      ...data,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
    };
    await idbPut(STORES.ACCOUNTS, newAccount);
    // Security: DO NOT log password in activity details!
    await this.logActivity('create', 'ACCOUNT', newAccount.id, `Đã thêm tài khoản: ${newAccount.software} (${newAccount.username})`);
    return newAccount;
  }

  async updateAccount(id: string, data: Partial<Omit<AccountItem, 'id' | 'createdAt'>>): Promise<AccountItem> {
    await this.ensureInitialized();
    const existing = await idbGetById<AccountItem>(STORES.ACCOUNTS, id);
    if (!existing) throw new Error('Tài khoản không tồn tại');

    const updated: AccountItem = {
      ...existing,
      ...data,
      updatedAt: new Date().toISOString(),
    };
    await idbPut(STORES.ACCOUNTS, updated);
    // Security: DO NOT log password in activity details!
    await this.logActivity('update', 'ACCOUNT', updated.id, `Đã cập nhật tài khoản: ${updated.software} (${updated.username})`);
    return updated;
  }

  async deleteAccount(id: string): Promise<void> {
    await this.ensureInitialized();
    const existing = await idbGetById<AccountItem>(STORES.ACCOUNTS, id);
    await idbDelete(STORES.ACCOUNTS, id);
    if (existing) {
      await this.logActivity('delete', 'ACCOUNT', id, `Đã xóa tài khoản: ${existing.software} (${existing.username})`);
    }
  }

  // ==================== STORES ====================
  async getStores(): Promise<StoreItem[]> {
    await this.ensureInitialized();
    const items = await idbGetAll<StoreItem>(STORES.STORES);
    return items.sort((a, b) => a.storeCode.localeCompare(b.storeCode));
  }

  async createStore(data: Omit<StoreItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<StoreItem> {
    await this.ensureInitialized();
    const now = new Date().toISOString();
    const newStore: StoreItem = {
      ...data,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
    };
    await idbPut(STORES.STORES, newStore);
    await this.logActivity('create', 'STORE', newStore.id, `Đã thêm cửa hàng: ${newStore.storeCode}`);
    return newStore;
  }

  async updateStore(id: string, data: Partial<Omit<StoreItem, 'id' | 'createdAt'>>): Promise<StoreItem> {
    await this.ensureInitialized();
    const existing = await idbGetById<StoreItem>(STORES.STORES, id);
    if (!existing) throw new Error('Cửa hàng không tồn tại');

    const updated: StoreItem = {
      ...existing,
      ...data,
      updatedAt: new Date().toISOString(),
    };
    await idbPut(STORES.STORES, updated);
    await this.logActivity('update', 'STORE', updated.id, `Đã cập nhật cửa hàng: ${updated.storeCode}`);
    return updated;
  }

  async deleteStore(id: string): Promise<void> {
    await this.ensureInitialized();
    const existing = await idbGetById<StoreItem>(STORES.STORES, id);
    await idbDelete(STORES.STORES, id);
    if (existing) {
      await this.logActivity('delete', 'STORE', id, `Đã xóa cửa hàng: ${existing.storeCode}`);
    }
  }

  // ==================== WORKSPACE SUMMARY ====================
  async getWorkspaceSummary(): Promise<WorkspaceSummary> {
    await this.ensureInitialized();
    const [links, accounts, stores, activities] = await Promise.all([
      this.getLinks(),
      this.getAccounts(),
      this.getStores(),
      this.getActivities(10),
    ]);

    return {
      totalLinks: links.length,
      totalAccounts: accounts.length,
      totalStores: stores.length,
      favoriteLinks: links.filter((l) => l.favorite),
      recentStores: stores.slice(0, 5),
      recentActivities: activities,
    };
  }

  // ==================== SYSTEM ACTIONS ====================
  async clearAllData(): Promise<void> {
    // IMPORTANT: Log BEFORE clearing — after clear, the activity store is also wiped!
    await this.logActivity('delete', 'ALL', 'all', 'Đã xóa toàn bộ dữ liệu workspace');
    await idbClearAll();
    // Reset initialized flag so seed data can be repopulated if needed
    this.initialized = false;
  }

  /** Call this to re-seed from initialData after a clearAllData() */
  async resetInitialized(): Promise<void> {
    this.initialized = false;
    await this.ensureInitialized();
  }
}

export const dataService = new DataService();
