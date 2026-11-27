import React, { useState, useEffect, useMemo, useCallback, startTransition } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  SFLink,
  SFShieldFill,
  SFStorefront,
  SFPlus,
  SFArrowDownDocument,
  SFArrowUpDocument,
} from 'sf-symbols-lib';
import { Button } from '@/components/ui/button';
import { dataService } from '@/services/dataService';
import { excelService } from '@/services/excelService';
import { LinkItem, AccountItem, StoreItem } from '@/types/workspace';
import { LinkDrawerForm } from '@/components/forms/LinkDrawerForm';
import { AccountDrawerForm } from '@/components/forms/AccountDrawerForm';
import { StoreDrawerForm } from '@/components/forms/StoreDrawerForm';
import { ConfirmDeleteDialog } from '@/components/ui/ConfirmDeleteDialog';
import { MapPreviewModal } from '@/components/ui/MapPreviewModal';
import { SegmentedNavigation } from '@/components/ui/SegmentedNavigation';
import { useDirectionalTab } from '@/lib/motion';
import toast from 'react-hot-toast';
import { useWorkspaceData, type WorkspaceTabType, type DeleteTarget } from './hooks/useWorkspaceData';
import { useTableDragAndDrop } from './hooks/useTableDragAndDrop';
import { WorkspaceSearchBar } from './components/WorkspaceSearchBar';
import { WorkspaceTables } from './components/WorkspaceTables';
import { BatchActionBar } from './components/BatchActionBar';

const TAB_ORDER = ['accounts', 'links', 'stores'] as const;

export const UnifiedWorkspacePage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab') as WorkspaceTabType | null;

  const [activeTab, setActiveTab] = useState<WorkspaceTabType>(
    tabFromUrl === 'links' || tabFromUrl === 'stores' ? tabFromUrl : 'accounts'
  );

  const { animationClass } = useDirectionalTab(activeTab, TAB_ORDER);

  const {
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
  } = useWorkspaceData();

  const {
    draggedId,
    dragOverId,
    dropPosition,
    handleDragStart,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleDragEnd,
  } = useTableDragAndDrop(activeTab, handleReorder);

  // Search & Filter
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [onlyFavorites, setOnlyFavorites] = useState(false);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
    }, 120);
    return () => clearTimeout(handler);
  }, [search]);

  // Inline Password reveal & 1-Click Copy state
  const [showPasswordMap, setShowPasswordMap] = useState<Record<string, boolean>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Drawers & Modals
  const [linkDrawerOpen, setLinkDrawerOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<LinkItem | null>(null);

  const [accountDrawerOpen, setAccountDrawerOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<AccountItem | null>(null);

  const [storeDrawerOpen, setStoreDrawerOpen] = useState(false);
  const [editingStore, setEditingStore] = useState<StoreItem | null>(null);
  const [previewMapStore, setPreviewMapStore] = useState<StoreItem | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && selectedIds.size > 0 && !batchDeleteOpen) {
        setSelectedIds(new Set());
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIds.size, batchDeleteOpen]);

  const handleTogglePassword = useCallback((id: string) => {
    setShowPasswordMap((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const handleTabChange = useCallback(
    (tab: WorkspaceTabType) => {
      setActiveTab(tab);
      setSearch('');
      setSelectedCategory('ALL');
      setSelectedIds(new Set());
      startTransition(() => {
        setSearchParams({ tab }, { replace: true });
      });
    },
    [setSearchParams]
  );

  const handleCopy = useCallback((text: string, label: string, key: string) => {
    if (!text) {
      toast.error('Không có nội dung để sao chép');
      return;
    }
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopiedKey(key);
        toast.success(`Đã sao chép ${label}!`, { id: `copy-${key}` });
        setTimeout(() => {
          setCopiedKey((prev) => (prev === key ? null : prev));
        }, 1800);
      })
      .catch(() => {
        toast.error('Trình duyệt từ chối quyền sao chép');
      });
  }, []);

  const handleEditLink = useCallback((item: LinkItem) => {
    setEditingLink(item);
    setLinkDrawerOpen(true);
  }, []);

  const handleDeleteLink = useCallback((item: LinkItem) => {
    setDeleteTarget({ type: 'links', id: item.id, label: item.hangMuc });
  }, []);

  const handleEditAccount = useCallback((item: AccountItem) => {
    setEditingAccount(item);
    setAccountDrawerOpen(true);
  }, []);

  const handleDeleteAccount = useCallback((item: AccountItem) => {
    setDeleteTarget({ type: 'accounts', id: item.id, label: item.software });
  }, []);

  const handleEditStore = useCallback((item: StoreItem) => {
    setEditingStore(item);
    setStoreDrawerOpen(true);
  }, []);

  const handleDeleteStore = useCallback((item: StoreItem) => {
    setDeleteTarget({ type: 'stores', id: item.id, label: item.storeCode });
  }, []);

  const handlePreviewMapStore = useCallback((item: StoreItem) => {
    setPreviewMapStore(item);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await deleteSingleItem(deleteTarget);
      setDeleteTarget(null);
    } catch {
      toast.error('Lỗi khi xóa mục này', { id: 'delete-status' });
    }
  }, [deleteTarget, deleteSingleItem]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    links.forEach((l) => {
      if (l.category?.trim()) set.add(l.category.trim());
    });
    return Array.from(set).sort();
  }, [links]);

  const filteredLinks = useMemo(() => {
    let result = links;
    if (onlyFavorites) result = result.filter((l) => l.favorite);
    if (selectedCategory !== 'ALL') result = result.filter((l) => l.category === selectedCategory);
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.trim().toLowerCase();
      result = result.filter(
        (l) =>
          l.hangMuc.toLowerCase().includes(q) ||
          (l.category && l.category.toLowerCase().includes(q)) ||
          (l.note && l.note.toLowerCase().includes(q)) ||
          (l.link && l.link.toLowerCase().includes(q))
      );
    }
    return result;
  }, [links, debouncedSearch, selectedCategory, onlyFavorites]);

  const filteredAccounts = useMemo(() => {
    if (!debouncedSearch.trim()) return accounts;
    const q = debouncedSearch.trim().toLowerCase();
    return accounts.filter(
      (a) =>
        a.software.toLowerCase().includes(q) ||
        a.username.toLowerCase().includes(q) ||
        (a.link && a.link.toLowerCase().includes(q)) ||
        (a.note && a.note.toLowerCase().includes(q))
    );
  }, [accounts, debouncedSearch]);

  const filteredStores = useMemo(() => {
    if (!debouncedSearch.trim()) return stores;
    const q = debouncedSearch.trim().toLowerCase();
    return stores.filter(
      (s) =>
        s.storeCode.toLowerCase().includes(q) ||
        s.address.toLowerCase().includes(q) ||
        (s.type && s.type.toLowerCase().includes(q))
    );
  }, [stores, debouncedSearch]);

  const handleToggleSelect = useCallback((id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    const currentList =
      activeTab === 'links'
        ? filteredLinks
        : activeTab === 'accounts'
        ? filteredAccounts
        : filteredStores;
    if (selectedIds.size === currentList.length && currentList.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(currentList.map((i) => i.id)));
    }
  }, [activeTab, filteredLinks, filteredAccounts, filteredStores, selectedIds.size]);

  const handleConfirmBatchDelete = useCallback(async () => {
    if (selectedIds.size === 0) return;
    try {
      await deleteBatchItems(activeTab, Array.from(selectedIds));
      setSelectedIds(new Set());
      setBatchDeleteOpen(false);
    } catch (err) {
      console.error('Lỗi khi xóa hàng loạt:', err);
      toast.error('Lỗi khi xóa hàng loạt các mục');
    }
  }, [selectedIds, activeTab, deleteBatchItems]);

  const handleOpenAdd = useCallback(() => {
    if (activeTab === 'links') {
      setEditingLink(null);
      setLinkDrawerOpen(true);
    } else if (activeTab === 'accounts') {
      setEditingAccount(null);
      setAccountDrawerOpen(true);
    } else if (activeTab === 'stores') {
      setEditingStore(null);
      setStoreDrawerOpen(true);
    }
  }, [activeTab]);

  const handleExport = useCallback(() => {
    if (activeTab === 'links') excelService.exportDataset('LINK');
    else if (activeTab === 'accounts') excelService.exportDataset('ACCOUNT');
    else if (activeTab === 'stores') excelService.exportDataset('STORE');
  }, [activeTab]);

  const resultCount =
    activeTab === 'links'
      ? filteredLinks.length
      : activeTab === 'accounts'
      ? filteredAccounts.length
      : filteredStores.length;

  return (
    <div className="w-full pb-[calc(env(safe-area-inset-bottom,0px)+5.5rem)]">
      {/* Top Bar: Sheet Tabs & Action Bar */}
      <div className="sticky-liquid-header -mx-4 sm:-mx-5 lg:-mx-6 px-4 sm:px-5 lg:px-6 pt-4 sm:pt-5 lg:pt-6 pb-3.5 transition-[transform,opacity,background-color,border-color,color,box-shadow]">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div className="max-w-full overflow-x-auto pb-1 scrollbar-none flex-shrink-0">
            <SegmentedNavigation
              label="Danh mục bảng tính"
              activeId={activeTab}
              onChange={(tab) => handleTabChange(tab as WorkspaceTabType)}
              items={[
                { id: 'accounts', label: 'Tài khoản', icon: <SFShieldFill size={16} /> },
                { id: 'links', label: 'Links', icon: <SFLink size={16} /> },
                { id: 'stores', label: 'DS Cửa hàng', icon: <SFStorefront size={16} /> },
              ]}
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <Button
              variant="liquiGlass"
              size="sm"
              className="h-[38px] px-3.5 sm:px-4 rounded-full text-[13px] leading-none font-medium"
              onClick={handleExport}
              icon={<SFArrowUpDocument size={14} className="text-[#0066cc] dark:text-[#2997ff]" />}
              title="Xuất bảng tính hiện tại ra file Excel (.xlsx)"
            >
              Xuất
            </Button>

            <Button
              variant="liquiGlass"
              size="sm"
              className="h-[38px] px-3.5 sm:px-4 rounded-full text-[13px] leading-none font-medium"
              onClick={() => window.dispatchEvent(new CustomEvent('fm:open-import'))}
              icon={<SFArrowDownDocument size={14} className="text-emerald-600 dark:text-emerald-400" />}
              title="Nhập file Excel vào hệ thống"
            >
              Nhập
            </Button>

            <Button
              variant="primary"
              className="h-10 px-4 rounded-full text-[13px] leading-none font-semibold shadow-sm flex-1 sm:flex-initial justify-center"
              onClick={handleOpenAdd}
              icon={<SFPlus size={16} />}
            >
              {activeTab === 'accounts' && 'Thêm Tài Khoản'}
              {activeTab === 'links' && 'Thêm Link'}
              {activeTab === 'stores' && 'Thêm Cửa Hàng'}
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto space-y-5 mt-5">
        <WorkspaceSearchBar
          activeTab={activeTab}
          search={search}
          onSearchChange={setSearch}
          onlyFavorites={onlyFavorites}
          onToggleFavorites={() => setOnlyFavorites((prev) => !prev)}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
          categories={categories}
          links={links}
          resultCount={resultCount}
        />

        <WorkspaceTables
          activeTab={activeTab}
          animationClass={animationClass}
          loading={loading}
          loadError={loadError}
          onRetryLoad={loadData}
          search={search}
          onClearSearch={() => setSearch('')}
          onOpenAdd={handleOpenAdd}
          filteredLinks={filteredLinks}
          filteredAccounts={filteredAccounts}
          filteredStores={filteredStores}
          selectedIds={selectedIds}
          onToggleSelect={handleToggleSelect}
          onSelectAll={handleSelectAll}
          draggedId={draggedId}
          dragOverId={dragOverId}
          dropPosition={dropPosition}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onDragEnd={handleDragEnd}
          copiedKey={copiedKey}
          onCopy={handleCopy}
          showPasswordMap={showPasswordMap}
          onTogglePassword={handleTogglePassword}
          onToggleFavorite={handleToggleFavorite}
          onEditLink={handleEditLink}
          onDeleteLink={handleDeleteLink}
          onEditAccount={handleEditAccount}
          onDeleteAccount={handleDeleteAccount}
          onPreviewMapStore={handlePreviewMapStore}
          onEditStore={handleEditStore}
          onDeleteStore={handleDeleteStore}
        />

        <LinkDrawerForm
          isOpen={linkDrawerOpen}
          onClose={() => setLinkDrawerOpen(false)}
          onSave={async (data) => {
            if (editingLink) {
              await dataService.updateLink(editingLink.id, data);
              toast.success('Đã cập nhật link', { id: 'save-drawer-status' });
            } else {
              await dataService.createLink(data);
              toast.success('Đã tạo link mới', { id: 'save-drawer-status' });
            }
            await loadData();
          }}
          initialData={editingLink}
        />

        <AccountDrawerForm
          isOpen={accountDrawerOpen}
          onClose={() => setAccountDrawerOpen(false)}
          onSave={async (data) => {
            if (editingAccount) {
              await dataService.updateAccount(editingAccount.id, data);
              toast.success('Đã cập nhật tài khoản', { id: 'save-drawer-status' });
            } else {
              await dataService.createAccount(data);
              toast.success('Đã tạo tài khoản mới', { id: 'save-drawer-status' });
            }
            await loadData();
          }}
          initialData={editingAccount}
        />

        <StoreDrawerForm
          isOpen={storeDrawerOpen}
          onClose={() => setStoreDrawerOpen(false)}
          onSave={async (data) => {
            if (editingStore) {
              await dataService.updateStore(editingStore.id, data);
              toast.success('Đã cập nhật cửa hàng', { id: 'save-drawer-status' });
            } else {
              await dataService.createStore(data);
              toast.success('Đã thêm cửa hàng mới', { id: 'save-drawer-status' });
            }
            await loadData();
          }}
          initialData={editingStore}
        />

        <ConfirmDeleteDialog
          isOpen={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleConfirmDelete}
          title={`Xóa ${
            deleteTarget?.type === 'links'
              ? 'Liên kết'
              : deleteTarget?.type === 'accounts'
              ? 'Tài khoản'
              : 'Cửa hàng'
          }?`}
          description={`Bạn có chắc chắn muốn xóa "${deleteTarget?.label}"? Thao tác này không thể hoàn tác.`}
        />

        <BatchActionBar
          selectedCount={selectedIds.size}
          onBatchDelete={() => setBatchDeleteOpen(true)}
          onClearSelection={() => setSelectedIds(new Set())}
        />

        <MapPreviewModal
          isOpen={!!previewMapStore}
          onClose={() => setPreviewMapStore(null)}
          store={previewMapStore}
        />

        <ConfirmDeleteDialog
          isOpen={batchDeleteOpen}
          onClose={() => setBatchDeleteOpen(false)}
          onConfirm={handleConfirmBatchDelete}
          title={`Xóa hàng loạt ${selectedIds.size} mục?`}
          description={`Bạn có chắc chắn muốn xóa ${selectedIds.size} mục đã chọn trong bảng ${
            activeTab === 'links' ? 'Links' : activeTab === 'accounts' ? 'Tài khoản' : 'Cửa hàng'
          }? Thao tác này không thể hoàn tác.`}
        />
      </div>
    </div>
  );
};
