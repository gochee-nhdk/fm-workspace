import { useState, useCallback, useEffect } from 'react';
import { dataService } from '@/services/dataService';
import { LinkItem, AccountItem, StoreItem } from '@/types/workspace';
import toast from 'react-hot-toast';

export type WorkspaceTabType = 'links' | 'accounts' | 'stores';

export interface DeleteTarget {
  type: WorkspaceTabType;
  id: string;
  label: string;
}

function reorderList<T extends { id: string }>(
  list: T[],
  sourceId: string,
  targetId: string,
  position: 'top' | 'bottom'
): T[] | null {
  const sourceIndex = list.findIndex((item) => item.id === sourceId);
  const targetIndex = list.findIndex((item) => item.id === targetId);
  if (sourceIndex === -1 || targetIndex === -1) return null;

  const updated = [...list];
  const [moved] = updated.splice(sourceIndex, 1);
  const newTargetIndex = updated.findIndex((item) => item.id === targetId);
  const insertIndex = position === 'bottom' ? newTargetIndex + 1 : newTargetIndex;
  updated.splice(insertIndex, 0, moved);
  return updated;
}

export function useWorkspaceData() {
  const [links, setLinks] = useState<LinkItem[]>([]);
  const [accounts, setAccounts] = useState<AccountItem[]>([]);
  const [stores, setStores] = useState<StoreItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const [l, a, s] = await Promise.all([
        dataService.getLinks(),
        dataService.getAccounts(),
        dataService.getStores(),
      ]);
      setLinks(l);
      setAccounts(a);
      setStores(s);
    } catch (err: any) {
      const msg = err?.message || 'Không thể nạp dữ liệu từ bộ nhớ';
      console.error('Lỗi khi tải dữ liệu workspace:', err);
      setLoadError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleReorder = useCallback(
    async (
      type: WorkspaceTabType,
      sourceId: string,
      targetId: string,
      position: 'top' | 'bottom'
    ) => {
      if (!sourceId || !targetId || sourceId === targetId) return;

      if (type === 'accounts') {
        const updated = reorderList(accounts, sourceId, targetId, position);
        if (!updated) return;
        setAccounts(updated);
        try {
          await dataService.reorderAccounts(updated);
          toast.success('Đã lưu thứ tự mới!', { id: 'reorder-toast', duration: 1200 });
        } catch {
          toast.error('Không thể lưu thứ tự');
          loadData();
        }
      } else if (type === 'links') {
        const updated = reorderList(links, sourceId, targetId, position);
        if (!updated) return;
        setLinks(updated);
        try {
          await dataService.reorderLinks(updated);
          toast.success('Đã lưu thứ tự mới!', { id: 'reorder-toast', duration: 1200 });
        } catch {
          toast.error('Không thể lưu thứ tự');
          loadData();
        }
      } else if (type === 'stores') {
        const updated = reorderList(stores, sourceId, targetId, position);
        if (!updated) return;
        setStores(updated);
        try {
          await dataService.reorderStores(updated);
          toast.success('Đã lưu thứ tự mới!', { id: 'reorder-toast', duration: 1200 });
        } catch {
          toast.error('Không thể lưu thứ tự');
          loadData();
        }
      }
    },
    [accounts, links, stores, loadData]
  );

  const handleToggleFavorite = useCallback(async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const updated = await dataService.toggleFavoriteLink(id);
      if (updated) {
        setLinks((prev) => prev.map((l) => (l.id === id ? updated : l)));
        toast.success(updated.favorite ? 'Đã thêm vào yêu thích' : 'Đã bỏ yêu thích', {
          id: 'favorite-status',
        });
      }
    } catch {
      toast.error('Lỗi khi cập nhật trạng thái', { id: 'favorite-status' });
    }
  }, []);

  const deleteSingleItem = useCallback(
    async (target: DeleteTarget) => {
      if (target.type === 'links') {
        await dataService.deleteLink(target.id);
      } else if (target.type === 'accounts') {
        await dataService.deleteAccount(target.id);
      } else {
        await dataService.deleteStore(target.id);
      }
      toast.success(`Đã xóa "${target.label}"`, { id: 'delete-status' });
      await loadData();
    },
    [loadData]
  );

  const deleteBatchItems = useCallback(
    async (type: WorkspaceTabType, ids: string[]) => {
      if (type === 'links') {
        await Promise.all(ids.map((id) => dataService.deleteLink(id)));
      } else if (type === 'accounts') {
        await Promise.all(ids.map((id) => dataService.deleteAccount(id)));
      } else {
        await Promise.all(ids.map((id) => dataService.deleteStore(id)));
      }
      toast.success(`Đã xóa ${ids.length} mục đã chọn!`);
      await loadData();
    },
    [loadData]
  );

  return {
    links,
    accounts,
    stores,
    loading,
    loadError,
    loadData,
    handleReorder,
    handleToggleFavorite,
    deleteSingleItem,
    deleteBatchItems,
  };
}
