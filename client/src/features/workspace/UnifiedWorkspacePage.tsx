import React, { useState, useEffect, useMemo, useCallback, useRef, startTransition } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import {
  SFLink,
  SFShieldFill,
  SFStorefront,
  SFMagnifyingglass,
  SFPlus,
  SFArrowDownDocument,
  SFArrowUpDocument,
  SFArrowUpRightSquare,
  SFSquareOnSquare,
  SFCheckmark,
  SFEye,
  SFEyeSlash,
  SFPencil,
  SFTrash,
  SFStar,
  SFStarFill,
  SFMappinAndEllipse,
  SFLine3HorizontalDecreaseCircle,
  SFChevronDown,
} from 'sf-symbols-lib';
import { Button } from '@/components/ui/button';
import { CloseButton } from '@/components/ui/close-button';
import { StatCard } from '@/components/ui/stat-card';
import { EmptyState } from '@/components/ui/empty-state';
import { dataService } from '@/services/dataService';
import { excelService } from '@/services/excelService';
import { LinkItem, AccountItem, StoreItem } from '@/types/workspace';
import { LinkDrawerForm } from '@/components/forms/LinkDrawerForm';
import { AccountDrawerForm } from '@/components/forms/AccountDrawerForm';
import { StoreDrawerForm } from '@/components/forms/StoreDrawerForm';
import { ConfirmDeleteDialog } from '@/components/ui/ConfirmDeleteDialog';
import { MapPreviewModal } from '@/components/ui/MapPreviewModal';
import { SegmentedNavigation } from '@/components/ui/SegmentedNavigation';
import { TableSkeleton } from '@/components/ui/loading';
import { useDirectionalTab } from '@/lib/motion';
import { sanitizeUrl } from '@/lib/utils';
import { LinkTableRow } from './components/LinkTableRow';
import { AccountTableRow } from './components/AccountTableRow';
import { StoreTableRow } from './components/StoreTableRow';
import toast from 'react-hot-toast';

type TabType = 'links' | 'accounts' | 'stores';

const TAB_ORDER = ['accounts', 'links', 'stores'] as const;

export const UnifiedWorkspacePage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab') as TabType | null;

  const [activeTab, setActiveTab] = useState<TabType>(
    tabFromUrl === 'links' || tabFromUrl === 'stores' ? tabFromUrl : 'accounts'
  );

  const { animationClass } = useDirectionalTab(activeTab, TAB_ORDER);

  const [links, setLinks] = useState<LinkItem[]>([]);
  const [accounts, setAccounts] = useState<AccountItem[]>([]);
  const [stores, setStores] = useState<StoreItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);

  // Debounce search input to maintain 60-120fps typing experience
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
    }, 120);
    return () => clearTimeout(handler);
  }, [search]);

  // Close category dropdown on click outside or Escape
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target as Node)) {
        setCategoryDropdownOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setCategoryDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Inline Password reveal state
  const [showPasswordMap, setShowPasswordMap] = useState<Record<string, boolean>>({});

  // 1-Click Copy feedback state
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Drawers & Modals
  const [linkDrawerOpen, setLinkDrawerOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<LinkItem | null>(null);

  const [accountDrawerOpen, setAccountDrawerOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<AccountItem | null>(null);

  const [storeDrawerOpen, setStoreDrawerOpen] = useState(false);
  const [editingStore, setEditingStore] = useState<StoreItem | null>(null);
  const [previewMapStore, setPreviewMapStore] = useState<StoreItem | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<{
    type: TabType;
    id: string;
    label: string;
  } | null>(null);

  // Batch selection states
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false);

  // Clear batch selection on Escape key
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && selectedIds.size > 0 && !batchDeleteOpen) {
        setSelectedIds(new Set());
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIds.size, batchDeleteOpen]);

  // Drag and drop reordering states
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [dropPosition, setDropPosition] = useState<'top' | 'bottom' | null>(null);

  // Load all data from IndexedDB
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [l, a, s] = await Promise.all([
        dataService.getLinks(),
        dataService.getAccounts(),
        dataService.getStores(),
      ]);
      setLinks(l);
      setAccounts(a);
      setStores(s);
    } catch (err) {
      console.error('Lỗi khi tải dữ liệu workspace:', err);
      toast.error('Không thể nạp dữ liệu từ bộ nhớ');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Reorder handler without needing STT input
  const handleReorder = useCallback(async (
    type: TabType,
    sourceId: string,
    targetId: string,
    position: 'top' | 'bottom'
  ) => {
    if (!sourceId || !targetId || sourceId === targetId) return;

    if (type === 'accounts') {
      const sourceIndex = accounts.findIndex((a) => a.id === sourceId);
      const targetIndex = accounts.findIndex((a) => a.id === targetId);
      if (sourceIndex === -1 || targetIndex === -1) return;

      const updated = [...accounts];
      const [moved] = updated.splice(sourceIndex, 1);
      const newTargetIndex = updated.findIndex((a) => a.id === targetId);
      const insertIndex = position === 'bottom' ? newTargetIndex + 1 : newTargetIndex;
      updated.splice(insertIndex, 0, moved);

      setAccounts(updated);
      try {
        await dataService.reorderAccounts(updated);
        toast.success('Đã lưu thứ tự mới!', { id: 'reorder-toast', duration: 1200 });
      } catch (err) {
        toast.error('Không thể lưu thứ tự');
        loadData();
      }
    } else if (type === 'links') {
      const sourceIndex = links.findIndex((l) => l.id === sourceId);
      const targetIndex = links.findIndex((l) => l.id === targetId);
      if (sourceIndex === -1 || targetIndex === -1) return;

      const updated = [...links];
      const [moved] = updated.splice(sourceIndex, 1);
      const newTargetIndex = updated.findIndex((l) => l.id === targetId);
      const insertIndex = position === 'bottom' ? newTargetIndex + 1 : newTargetIndex;
      updated.splice(insertIndex, 0, moved);

      setLinks(updated);
      try {
        await dataService.reorderLinks(updated);
        toast.success('Đã lưu thứ tự mới!', { id: 'reorder-toast', duration: 1200 });
      } catch (err) {
        toast.error('Không thể lưu thứ tự');
        loadData();
      }
    } else if (type === 'stores') {
      const sourceIndex = stores.findIndex((s) => s.id === sourceId);
      const targetIndex = stores.findIndex((s) => s.id === targetId);
      if (sourceIndex === -1 || targetIndex === -1) return;

      const updated = [...stores];
      const [moved] = updated.splice(sourceIndex, 1);
      const newTargetIndex = updated.findIndex((s) => s.id === targetId);
      const insertIndex = position === 'bottom' ? newTargetIndex + 1 : newTargetIndex;
      updated.splice(insertIndex, 0, moved);

      setStores(updated);
      try {
        await dataService.reorderStores(updated);
        toast.success('Đã lưu thứ tự mới!', { id: 'reorder-toast', duration: 1200 });
      } catch (err) {
        toast.error('Không thể lưu thứ tự');
        loadData();
      }
    }
  }, [accounts, links, stores, loadData]);

  // Stable drag & drop event handlers for 120fps fluid reordering
  const handleDragStart = useCallback((id: string, e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedId(id);
  }, []);

  const handleDragOver = useCallback((id: string, e: React.DragEvent) => {
    e.preventDefault();
    if (!draggedId || draggedId === id) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const isBottom = e.clientY > rect.top + rect.height / 2;
    const pos = isBottom ? 'bottom' : 'top';
    if (dragOverId !== id || dropPosition !== pos) {
      setDragOverId(id);
      setDropPosition(pos);
    }
  }, [draggedId, dragOverId, dropPosition]);

  const handleDragLeave = useCallback((id: string, e: React.DragEvent) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    if (dragOverId === id) {
      setDragOverId(null);
      setDropPosition(null);
    }
  }, [dragOverId]);

  const handleDrop = useCallback((id: string, e: React.DragEvent) => {
    e.preventDefault();
    if (draggedId && draggedId !== id && dropPosition) {
      handleReorder(activeTab, draggedId, id, dropPosition);
    }
    setDraggedId(null);
    setDragOverId(null);
    setDropPosition(null);
  }, [activeTab, draggedId, dropPosition, handleReorder]);

  const handleDragEnd = useCallback(() => {
    setDraggedId(null);
    setDragOverId(null);
    setDropPosition(null);
  }, []);

  const handleTogglePassword = useCallback((id: string) => {
    setShowPasswordMap((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  }, []);

  // Sync activeTab with URL params
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setSearch('');
    setSelectedCategory('ALL');
    setSelectedIds(new Set());
    startTransition(() => {
      setSearchParams({ tab }, { replace: true });
    });
  };

  // 1-Click Copy Helper
  const handleCopy = useCallback((text: string, label: string, key: string) => {
    if (!text) {
      toast.error('Không có nội dung để sao chép');
      return;
    }
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success(`Đã sao chép ${label}!`, { id: `copy-${key}` });
    setTimeout(() => {
      setCopiedKey((prev) => (prev === key ? null : prev));
    }, 1800);
  }, []);

  // Toggle Favorite
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
    } catch (err) {
      toast.error('Lỗi khi cập nhật trạng thái', { id: 'favorite-status' });
    }
  }, []);

  // Stable Action handlers
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

  // Delete Action
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      if (deleteTarget.type === 'links') {
        await dataService.deleteLink(deleteTarget.id);
      } else if (deleteTarget.type === 'accounts') {
        await dataService.deleteAccount(deleteTarget.id);
      } else if (deleteTarget.type === 'stores') {
        await dataService.deleteStore(deleteTarget.id);
      }
      toast.success(`Đã xóa "${deleteTarget.label}"`, { id: 'delete-status' });
      setDeleteTarget(null);
      await loadData();
    } catch (err) {
      toast.error('Lỗi khi xóa mục này', { id: 'delete-status' });
    }
  };

  // Categories list for links
  const categories = useMemo(() => {
    const set = new Set<string>();
    links.forEach((l) => {
      if (l.category?.trim()) set.add(l.category.trim());
    });
    return Array.from(set).sort();
  }, [links]);

  // Filtered links
  const filteredLinks = useMemo(() => {
    let result = links;
    if (onlyFavorites) {
      result = result.filter((l) => l.favorite);
    }
    if (selectedCategory !== 'ALL') {
      result = result.filter((l) => l.category === selectedCategory);
    }
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

  // Filtered accounts
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

  // Filtered stores
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

  // Batch Selection Handlers
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

  const handleConfirmBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    try {
      const ids = Array.from(selectedIds);
      if (activeTab === 'links') {
        await Promise.all(ids.map((id) => dataService.deleteLink(id)));
      } else if (activeTab === 'accounts') {
        await Promise.all(ids.map((id) => dataService.deleteAccount(id)));
      } else if (activeTab === 'stores') {
        await Promise.all(ids.map((id) => dataService.deleteStore(id)));
      }
      toast.success(`Đã xóa ${ids.length} mục đã chọn!`);
      setSelectedIds(new Set());
      setBatchDeleteOpen(false);
      await loadData();
    } catch (err) {
      console.error('Lỗi khi xóa hàng loạt:', err);
      toast.error('Lỗi khi xóa hàng loạt các mục');
    }
  };

  // Quick Add handler according to current sheet
  const handleOpenAdd = () => {
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
  };

  // Export current dataset
  const handleExport = () => {
    if (activeTab === 'links') excelService.exportDataset('LINK');
    else if (activeTab === 'accounts') excelService.exportDataset('ACCOUNT');
    else if (activeTab === 'stores') excelService.exportDataset('STORE');
  };

  return (
    <div className="w-full pb-[calc(env(safe-area-inset-bottom,0px)+5.5rem)]">
      {/* ─────────────────── Top Bar: Sheet Tabs & Action Bar (Edge-to-edge Sticky Liquid Glass) ─────────────────── */}
      <div className="sticky-liquid-header -mx-4 sm:-mx-5 lg:-mx-6 px-4 sm:px-5 lg:px-6 pt-4 sm:pt-5 lg:pt-6 pb-3.5 transition-all">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div className="max-w-full overflow-x-auto pb-1 scrollbar-none flex-shrink-0">
            <SegmentedNavigation
              label="Danh mục bảng tính"
              activeId={activeTab}
              onChange={(tab) => handleTabChange(tab as TabType)}
              items={[
                { id: 'accounts', label: 'Tài khoản', icon: <SFShieldFill size={16} /> },
                { id: 'links', label: 'Links', icon: <SFLink size={16} /> },
                { id: 'stores', label: 'DS Cửa hàng', icon: <SFStorefront size={16} /> },
              ]}
            />
          </div>

          {/* Action Controls */}
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
        {/* ─────────────────── Quick Stat Overview Cards ─────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          {activeTab === 'accounts' && (
            <>
              <StatCard
                title="Tổng tài khoản"
                value={accounts.length}
                subtitle="Hệ thống đăng nhập nội bộ"
                type="actual"
                icon={<SFShieldFill size={18} />}
              />
              <StatCard
                title="Phần mềm quản lý"
                value={new Set(accounts.map((a) => a.software)).size}
                subtitle="Phần mềm & dịch vụ"
                type="calculated"
                icon={<SFStorefront size={18} />}
              />
              <StatCard
                title="Cổng truy cập"
                value={accounts.filter((a) => !!a.link).length}
                subtitle="Liên kết đăng nhập trực tiếp"
                type="actual"
                icon={<SFLink size={18} />}
              />
            </>
          )}
          {activeTab === 'links' && (
            <>
              <StatCard
                title="Tổng số liên kết"
                value={links.length}
                subtitle="Hệ thống link nghiệp vụ"
                type="actual"
                icon={<SFLink size={18} />}
              />
              <StatCard
                title="Mục yêu thích"
                value={links.filter((l) => l.favorite).length}
                subtitle="Ghim truy cập nhanh"
                type="calculated"
                icon={<SFStarFill size={18} className="text-amber-500" />}
              />
              <StatCard
                title="Phân nhóm danh mục"
                value={categories.length}
                subtitle="Danh mục phân loại"
                type="actual"
                icon={<SFShieldFill size={18} />}
              />
            </>
          )}
          {activeTab === 'stores' && (
            <>
              <StatCard
                title="Tổng cửa hàng"
                value={stores.length}
                subtitle="Hệ thống chuỗi toàn quốc"
                type="actual"
                icon={<SFStorefront size={18} />}
              />
              <StatCard
                title="Đã định vị bản đồ"
                value={stores.filter((s) => !!s.googleMaps || !!s.address).length}
                subtitle="Tọa độ Google Maps"
                type="calculated"
                icon={<SFMappinAndEllipse size={18} />}
              />
              <StatCard
                title="Phân loại cửa hàng"
                value={new Set(stores.map((s) => s.type).filter(Boolean)).size || 1}
                subtitle="Khu vực & mô hình"
                type="actual"
                icon={<SFShieldFill size={18} />}
              />
            </>
          )}
        </div>

        {/* ─────────────────── Search & Quick Filter Bar ─────────────────── */}
        <div className="relative z-10 glass-material rounded-[20px] p-3 sm:p-3.5 flex flex-col md:flex-row items-center justify-between gap-3 shadow-xs">
        {/* Instant Search Bar */}
        <div className="relative w-full md:w-96 group">
          <SFMagnifyingglass size={16} className="text-[#76767b] dark:text-[#a1a1a6] group-focus-within:text-[#0066cc] dark:group-focus-within:text-[#2997ff] absolute left-3.5 top-2.5 pointer-events-none transition-colors" />
          <input
            type="text"
            placeholder={
              activeTab === 'links'
                ? 'Tìm nhanh link, hạng mục, ghi chú...'
                : activeTab === 'accounts'
                ? 'Tìm theo phần mềm, tên đăng nhập, link...'
                : 'Tìm theo mã CH (FM01), địa chỉ, khu vực...'
            }
            className="glass-input w-full text-[13px] rounded-full pl-9 pr-8 py-2 placeholder:text-[#86868b]"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <CloseButton
              onClick={() => setSearch('')}
              size="xs"
              className="absolute right-2.5 top-2.5"
              label="Xóa"
              title="Xóa"
            />
          )}
        </div>

        {/* Secondary Filters for Links */}
        {activeTab === 'links' && (
          <div className="flex items-center gap-2.5 w-full md:w-auto justify-between md:justify-end flex-wrap">
            {/* Yêu thích Filter Button */}
            <button
              type="button"
              onClick={() => setOnlyFavorites((prev) => !prev)}
              className={`h-9 flex items-center gap-2 px-3.5 rounded-full text-[12.5px] transition-all duration-200 cursor-pointer select-none active:scale-95 border ${
                onlyFavorites
                  ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/40 shadow-[0_2px_10px_rgba(245,158,11,0.25)] font-semibold'
                  : 'bg-white/80 dark:bg-white/[0.08] hover:bg-white dark:hover:bg-white/[0.14] text-[#1d1d1f] dark:text-[#f5f5f7] border-black/[0.08] dark:border-white/[0.12] shadow-2xs'
              }`}
            >
              {onlyFavorites ? (
                <SFStarFill size={14} className="text-amber-500 scale-110 transition-transform" />
              ) : (
                <SFStar size={14} className="text-[#8e8e93] transition-transform" />
              )}
              <span>Chỉ mục Yêu thích</span>
              {links.filter((l) => l.favorite).length > 0 && (
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10.5px] font-mono leading-none ${
                    onlyFavorites
                      ? 'bg-amber-500/25 text-amber-700 dark:text-amber-300 font-bold'
                      : 'bg-black/5 dark:bg-white/10 text-[#76767b]'
                  }`}
                >
                  {links.filter((l) => l.favorite).length}
                </span>
              )}
            </button>

            {/* Custom Liquid Glass Category Dropdown */}
            {categories.length > 0 && (
              <div className="relative" ref={categoryDropdownRef}>
                <button
                  type="button"
                  onClick={() => setCategoryDropdownOpen(!categoryDropdownOpen)}
                  className={`h-9 flex items-center gap-2 px-3.5 rounded-full text-[12.5px] font-medium transition-all duration-200 cursor-pointer select-none border active:scale-95 ${
                    selectedCategory !== 'ALL'
                      ? 'bg-[#0066cc]/10 dark:bg-[#2997ff]/15 text-[#0066cc] dark:text-[#2997ff] border-[#0066cc]/35 shadow-[0_2px_10px_rgba(0,102,204,0.2)] font-semibold'
                      : 'bg-white/80 dark:bg-white/[0.08] hover:bg-white dark:hover:bg-white/[0.14] text-[#1d1d1f] dark:text-[#f5f5f7] border-black/[0.08] dark:border-white/[0.12] shadow-2xs'
                  }`}
                >
                  <SFLine3HorizontalDecreaseCircle
                    size={14}
                    className={selectedCategory !== 'ALL' ? 'text-[#0066cc] dark:text-[#2997ff]' : 'text-[#8e8e93]'}
                  />
                  <span className="max-w-[160px] truncate">
                    {selectedCategory === 'ALL'
                      ? `Tất cả nhóm (${links.length})`
                      : `${selectedCategory} (${links.filter((l) => l.category === selectedCategory).length})`}
                  </span>
                  <SFChevronDown
                    size={14}
                    className={`text-[#8e8e93] transition-transform duration-200 shrink-0 ${
                      categoryDropdownOpen ? 'rotate-180 text-[#0066cc] dark:text-[#2997ff]' : ''
                    }`}
                  />
                </button>

                {/* Floating Liquid-Glass Popover Menu originating from trigger */}
                {categoryDropdownOpen && (
                  <div className="absolute right-0 top-full mt-2 w-64 rounded-2xl bg-white dark:bg-[#1c1c24] backdrop-blur-3xl border border-black/10 dark:border-white/15 p-1.5 shadow-[0_20px_48px_-6px_rgba(0,0,0,0.25),0_6px_16px_rgba(0,0,0,0.08)] z-50 apple-popover-tr">
                    <div className="max-h-60 overflow-y-auto space-y-0.5 pr-0.5">
                      {/* Option: ALL */}
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCategory('ALL');
                          setCategoryDropdownOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-[12.5px] transition-colors cursor-pointer text-left ${
                          selectedCategory === 'ALL'
                            ? 'bg-[#0066cc]/10 dark:bg-[#2997ff]/20 text-[#0066cc] dark:text-[#2997ff] font-semibold'
                            : 'text-[#1d1d1f] dark:text-[#f5f5f7] hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-[#0066cc] dark:bg-[#2997ff]" />
                          <span>Tất cả nhóm</span>
                        </span>
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/10 text-[#76767b]">
                          {links.length}
                        </span>
                      </button>

                      {/* Dynamic categories */}
                      {categories.map((c) => {
                        const count = links.filter((l) => l.category === c).length;
                        const isSelected = selectedCategory === c;
                        return (
                          <button
                            key={c}
                            type="button"
                            onClick={() => {
                              setSelectedCategory(c);
                              setCategoryDropdownOpen(false);
                            }}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-[12.5px] transition-colors cursor-pointer text-left ${
                              isSelected
                                ? 'bg-[#0066cc]/10 dark:bg-[#2997ff]/20 text-[#0066cc] dark:text-[#2997ff] font-semibold'
                                : 'text-[#1d1d1f] dark:text-[#f5f5f7] hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
                            }`}
                          >
                            <span className="flex items-center gap-2 truncate">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#8e8e93]" />
                              <span className="truncate">{c}</span>
                            </span>
                            <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/10 text-[#76767b] shrink-0">
                              {count}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Info stats pill on active sheet */}
        <div className="hidden sm:flex items-center gap-1.5 text-xs text-[#76767b] dark:text-[#a1a1a6]">
          <span>Hiển thị:</span>
          <span className="font-mono font-bold text-[#1d1d1f] dark:text-white">
            {activeTab === 'links' && filteredLinks.length}
            {activeTab === 'accounts' && filteredAccounts.length}
            {activeTab === 'stores' && filteredStores.length}
          </span>
          <span>kết quả</span>
        </div>
      </div>

      {/* ─────────────────── Spreadsheet Table Section ─────────────────── */}
      <div className="relative rounded-[22px] border border-white/60 dark:border-white/10 bg-white/70 dark:bg-[#141418]/70 backdrop-blur-2xl overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.4)]">
        {/* Specular reflection line on top border */}
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/80 dark:via-white/20 to-transparent pointer-events-none z-30" />

        {/* Spatial Continuity Animated Content Context */}
        <div className="relative">
          {/* 1. SHEET: QUICK LINKS */}
          <div className={activeTab === 'links' ? `${animationClass} block` : 'hidden'}>
            <div className="overflow-x-auto scrollbar-thin smooth-scroll-120 overscroll-y-auto">
              <table className="w-full text-left text-[13px] text-[#1d1d1f] dark:text-[#f5f5f7]">
              <thead className="bg-[#f5f5f7]/95 dark:bg-[#181820]/95 backdrop-blur-2xl border-b border-black/[0.08] dark:border-white/[0.12] text-[12px] font-bold text-[#1d1d1f] dark:text-white select-none sticky top-0 z-10 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                <tr>
                  <th className="w-10 px-2 py-3.5 text-center">
                    <input
                      type="checkbox"
                      checked={filteredLinks.length > 0 && selectedIds.size === filteredLinks.length}
                      onChange={handleSelectAll}
                      className="w-4 h-4 rounded text-[#0066cc] dark:text-[#2997ff] border-black/20 dark:border-white/20 focus:ring-0 focus:ring-offset-0 cursor-pointer active:scale-90 transition-transform duration-100 touch-manipulation align-middle"
                      title="Chọn tất cả mục để thao tác hàng loạt"
                    />
                  </th>
                  <th className="w-10 px-2 py-3.5 text-center whitespace-nowrap" aria-label="Đánh dấu yêu thích" title="Đánh dấu yêu thích">⭐</th>
                  <th className="px-4 py-3.5 whitespace-nowrap min-w-[140px] max-w-[220px] text-[#1d1d1f] dark:text-white font-bold">Tên Hạng Mục</th>
                  <th className="px-3.5 py-3.5 whitespace-nowrap min-w-[130px] text-[#1d1d1f] dark:text-white font-bold">Đường Dẫn</th>
                  <th className="px-3.5 py-3.5 whitespace-nowrap min-w-[110px] text-[#1d1d1f] dark:text-white font-bold">Danh Mục</th>
                  <th className="px-3.5 py-3.5 whitespace-nowrap min-w-[130px] max-w-[240px] text-[#1d1d1f] dark:text-white font-bold">Ghi Chú</th>
                  <th className="px-4 py-3.5 text-right whitespace-nowrap w-[96px] min-w-[96px] text-[#1d1d1f] dark:text-white font-bold">
                    Thao Tác
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.04] dark:divide-white/5">
                {loading ? (
                  <TableSkeleton colSpan={7} rows={6} />
                ) : filteredLinks.length > 0 ? (
                  filteredLinks.map((item) => (
                    <LinkTableRow
                      key={item.id}
                      item={item}
                      isDragged={draggedId === item.id}
                      isDragOver={dragOverId === item.id}
                      dropPosition={dropPosition}
                      copiedKey={copiedKey}
                      isSelected={selectedIds.has(item.id)}
                      onToggleSelect={handleToggleSelect}
                      onDragStart={handleDragStart}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      onDragEnd={handleDragEnd}
                      onToggleFavorite={handleToggleFavorite}
                      onCopy={handleCopy}
                      onEdit={handleEditLink}
                      onDelete={handleDeleteLink}
                    />
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="py-10 px-4">
                      <EmptyState
                        icon={<SFLink size={20} />}
                        title={search ? 'Không tìm thấy kết quả' : 'Chưa có link nào'}
                        description={search ? 'Thử tìm với từ khoá khác hoặc xóa bộ lọc' : 'Nhấn «Thêm Link» hoặc nhập từ file Excel để bắt đầu'}
                        actionLabel={!search ? 'Thêm Link đầu tiên' : 'Xóa bộ lọc'}
                        onAction={!search ? handleOpenAdd : () => setSearch('')}
                        secondaryActionLabel={!search ? 'Nhập từ Excel' : undefined}
                        onSecondaryAction={!search ? () => window.dispatchEvent(new CustomEvent('fm:open-import')) : undefined}
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 2. SHEET: ACCOUNT VAULT */}
        <div className={activeTab === 'accounts' ? `${animationClass} block` : 'hidden'}>
          <div className="overflow-x-auto scrollbar-thin smooth-scroll-120 overscroll-y-auto">
            <table className="w-full text-left text-[13px] text-[#1d1d1f] dark:text-white">
              <thead className="bg-[#f5f5f7]/95 dark:bg-[#181820]/95 backdrop-blur-2xl border-b border-black/[0.08] dark:border-white/[0.12] text-[12px] font-bold text-[#1d1d1f] dark:text-white select-none sticky top-0 z-10 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                <tr>
                  <th className="w-10 px-2 py-3.5 text-center">
                    <input
                      type="checkbox"
                      checked={filteredAccounts.length > 0 && selectedIds.size === filteredAccounts.length}
                      onChange={handleSelectAll}
                      className="w-4 h-4 rounded text-[#0066cc] dark:text-[#2997ff] border-black/20 dark:border-white/20 focus:ring-0 focus:ring-offset-0 cursor-pointer active:scale-90 transition-transform duration-100 touch-manipulation align-middle"
                      title="Chọn tất cả mục để thao tác hàng loạt"
                    />
                  </th>
                  <th className="px-4 py-3.5 whitespace-nowrap min-w-[120px] max-w-[160px] text-[#1d1d1f] dark:text-white font-bold">Phần Mềm</th>
                  <th className="px-3.5 py-3.5 whitespace-nowrap min-w-[130px] max-w-[210px] text-[#1d1d1f] dark:text-white font-bold">Tên Đăng Nhập</th>
                  <th className="px-3.5 py-3.5 whitespace-nowrap min-w-[150px] max-w-[220px] text-[#1d1d1f] dark:text-white font-bold">Mật Khẩu</th>
                  <th className="px-3.5 py-3.5 whitespace-nowrap min-w-[130px] text-[#1d1d1f] dark:text-white font-bold">Trang Đăng Nhập</th>
                  <th className="px-3.5 py-3.5 whitespace-nowrap min-w-[120px] max-w-[240px] text-[#1d1d1f] dark:text-white font-bold">Ghi Chú</th>
                  <th className="px-4 py-3.5 text-right whitespace-nowrap w-[96px] min-w-[96px] text-[#1d1d1f] dark:text-white font-bold">
                    Thao Tác
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.04] dark:divide-white/5">
                {loading ? (
                  <TableSkeleton colSpan={7} rows={6} />
                ) : filteredAccounts.length > 0 ? (
                  filteredAccounts.map((item) => (
                    <AccountTableRow
                      key={item.id}
                      item={item}
                      isDragged={draggedId === item.id}
                      isDragOver={dragOverId === item.id}
                      dropPosition={dropPosition}
                      copiedKey={copiedKey}
                      showPassword={!!showPasswordMap[item.id]}
                      isSelected={selectedIds.has(item.id)}
                      onToggleSelect={handleToggleSelect}
                      onTogglePassword={handleTogglePassword}
                      onDragStart={handleDragStart}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      onDragEnd={handleDragEnd}
                      onCopy={handleCopy}
                      onEdit={handleEditAccount}
                      onDelete={handleDeleteAccount}
                    />
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="py-10 px-4">
                      <EmptyState
                        icon={<SFShieldFill size={20} />}
                        title={search ? 'Không tìm thấy tài khoản nào' : 'Chưa có tài khoản nào'}
                        description={search ? 'Thử tìm với từ khoá khác hoặc xóa bộ lọc' : 'Lưu trữ thông tin đăng nhập và mật khẩu an toàn trên thiết bị'}
                        actionLabel={!search ? 'Thêm Tài khoản' : 'Xóa bộ lọc'}
                        onAction={!search ? handleOpenAdd : () => setSearch('')}
                        secondaryActionLabel={!search ? 'Nhập từ Excel' : undefined}
                        onSecondaryAction={!search ? () => window.dispatchEvent(new CustomEvent('fm:open-import')) : undefined}
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 3. SHEET: STORE DIRECTORY */}
        <div className={activeTab === 'stores' ? `${animationClass} block` : 'hidden'}>
          <div className="overflow-x-auto scrollbar-thin smooth-scroll-120 overscroll-y-auto">
            <table className="w-full text-left text-[13px] text-[#1d1d1f] dark:text-white">
              <thead className="bg-[#f5f5f7]/95 dark:bg-[#181820]/95 backdrop-blur-2xl border-b border-black/[0.08] dark:border-white/[0.12] text-[12px] font-bold text-[#1d1d1f] dark:text-white select-none sticky top-0 z-10 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                <tr>
                  <th className="w-10 px-2 py-3.5 text-center">
                    <input
                      type="checkbox"
                      checked={filteredStores.length > 0 && selectedIds.size === filteredStores.length}
                      onChange={handleSelectAll}
                      className="w-4 h-4 rounded text-[#0066cc] dark:text-[#2997ff] border-black/20 dark:border-white/20 focus:ring-0 focus:ring-offset-0 cursor-pointer active:scale-90 transition-transform duration-100 touch-manipulation align-middle"
                      title="Chọn tất cả mục để thao tác hàng loạt"
                    />
                  </th>
                  <th className="px-4 py-3.5 whitespace-nowrap min-w-[100px] text-[#1d1d1f] dark:text-white font-bold">Mã Cửa Hàng</th>
                  <th className="px-3.5 py-3.5 whitespace-nowrap min-w-[240px] max-w-[550px] text-[#1d1d1f] dark:text-white font-bold">Địa Chỉ Cửa Hàng</th>
                  <th className="px-3.5 py-3.5 whitespace-nowrap min-w-[110px] text-[#1d1d1f] dark:text-white font-bold">Khu Vực / Loại</th>
                  <th className="px-3.5 py-3.5 whitespace-nowrap min-w-[130px] text-[#1d1d1f] dark:text-white font-bold">Google Maps</th>
                  <th className="px-4 py-3.5 text-right whitespace-nowrap w-[96px] min-w-[96px] text-[#1d1d1f] dark:text-white font-bold">
                    Thao Tác
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.04] dark:divide-white/5">
                {loading ? (
                  <TableSkeleton colSpan={6} rows={6} />
                ) : filteredStores.length > 0 ? (
                  filteredStores.map((item) => (
                    <StoreTableRow
                      key={item.id}
                      item={item}
                      isDragged={draggedId === item.id}
                      isDragOver={dragOverId === item.id}
                      dropPosition={dropPosition}
                      copiedKey={copiedKey}
                      isSelected={selectedIds.has(item.id)}
                      onToggleSelect={handleToggleSelect}
                      onDragStart={handleDragStart}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      onDragEnd={handleDragEnd}
                      onCopy={handleCopy}
                      onPreviewMap={handlePreviewMapStore}
                      onEdit={handleEditStore}
                      onDelete={handleDeleteStore}
                    />
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-10 px-4">
                      <EmptyState
                        icon={<SFStorefront size={20} />}
                        title={search ? 'Không tìm thấy cửa hàng nào' : 'Chưa có cửa hàng nào'}
                        description={search ? 'Thử tìm theo mã CH, địa chỉ hoặc quận/huyện' : 'Danh sách hệ thống cửa hàng và vị trí Google Maps'}
                        actionLabel={!search ? 'Thêm Cửa hàng' : 'Xóa bộ lọc'}
                        onAction={!search ? handleOpenAdd : () => setSearch('')}
                        secondaryActionLabel={!search ? 'Nhập từ Excel' : undefined}
                        onSecondaryAction={!search ? () => window.dispatchEvent(new CustomEvent('fm:open-import')) : undefined}
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        </div>
      </div>

      {/* ─────────────────── Drawers & Confirmation Dialogs ─────────────────── */}
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

      {/* ─────────────────── Floating Apple Liquid Batch Action Bar ─────────────────── */}
      {typeof document !== 'undefined' &&
        createPortal(
          <div
            className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 ease-spring ${
              selectedIds.size > 0
                ? 'translate-y-0 opacity-100 scale-100 pointer-events-auto'
                : 'translate-y-16 opacity-0 scale-95 pointer-events-none'
            }`}
          >
            <div className="flex items-center gap-3 px-4 py-2.5 rounded-full bg-white/95 dark:bg-[#1c1c24]/95 backdrop-blur-2xl border border-black/15 dark:border-white/20 shadow-[0_20px_50px_rgba(0,0,0,0.22)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.7)] text-[13px]">
              <span className="flex items-center gap-2 font-medium text-[#1d1d1f] dark:text-white">
                <span className="min-w-5 h-5 px-1.5 rounded-full bg-[#0066cc] dark:bg-[#2997ff] text-white flex items-center justify-center text-[11px] font-bold">
                  {selectedIds.size}
                </span>
                <span className="font-semibold">{selectedIds.size} đã chọn</span>
              </span>

              <div className="h-4 w-px bg-black/15 dark:bg-white/20" />

              <button
                type="button"
                onClick={() => setBatchDeleteOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-rose-500 hover:bg-rose-600 text-white active:scale-95 transition-all duration-150 font-medium text-[12.5px] cursor-pointer touch-manipulation shadow-xs"
              >
                <SFTrash size={13} />
                <span>Xóa {selectedIds.size} mục</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                className="px-2.5 py-1 text-xs text-[#76767b] dark:text-[#a1a1a6] hover:text-[#1d1d1f] dark:hover:text-white active:scale-95 transition-all duration-150 cursor-pointer touch-manipulation font-medium"
              >
                Bỏ chọn (Esc)
              </button>
            </div>
          </div>,
          document.body
        )}

      {/* Google Maps In-App Preview Modal */}
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
