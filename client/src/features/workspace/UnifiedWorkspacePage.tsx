import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
  SFLine3Horizontal,
  SFChevronDown,
} from 'sf-symbols-lib';
import { Button } from '@/components/ui/button';
import { CloseButton } from '@/components/ui/close-button';
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

  // Close category dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target as Node)) {
        setCategoryDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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
    setSearchParams({ tab });
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
    <div className="w-full pb-12">
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
                  <div className="absolute right-0 top-full mt-2 w-64 rounded-2xl bg-white dark:bg-[#1c1c24] backdrop-blur-3xl border border-black/10 dark:border-white/15 p-1.5 shadow-[0_20px_48px_-6px_rgba(0,0,0,0.25),0_6px_16px_rgba(0,0,0,0.08)] z-50 apple-popover-tr space-y-1">
                    <div className="px-3 py-2 text-[11px] font-bold text-[#1d1d1f] dark:text-[#f5f5f7] uppercase tracking-wider border-b border-black/[0.06] dark:border-white/[0.08] flex items-center justify-between">
                      <span>Phân loại danh mục</span>
                      <span className="font-mono text-[10px] font-normal text-[#86868b] dark:text-[#a1a1a6]">{categories.length} nhóm</span>
                    </div>

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
        <div key={activeTab} className={animationClass}>
          {/* 1. SHEET: QUICK LINKS */}
          {activeTab === 'links' && (
          <div className="overflow-x-auto scrollbar-thin smooth-scroll-120 overscroll-y-auto">
            <table className="w-full text-left text-[13px] text-[#1d1d1f] dark:text-[#f5f5f7]">
              <thead className="bg-[#f5f5f7]/95 dark:bg-[#181820]/95 backdrop-blur-2xl border-b border-black/[0.08] dark:border-white/[0.12] text-[12px] font-bold text-[#1d1d1f] dark:text-white select-none sticky top-0 z-10 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                <tr>
                  <th className="w-9 pl-3 pr-1 py-3.5 text-center text-[#8e8e93]" aria-label="Kéo thả sắp xếp" title="Kéo thả sắp xếp">
                    <SFLine3Horizontal size={14} className="mx-auto opacity-40" />
                  </th>
                  <th className="px-2 py-3.5 w-10 text-center whitespace-nowrap" aria-label="Đánh dấu yêu thích" title="Đánh dấu yêu thích">⭐</th>
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
                {filteredLinks.length > 0 ? (
                  filteredLinks.map((item) => (
                    <LinkTableRow
                      key={item.id}
                      item={item}
                      isDragged={draggedId === item.id}
                      isDragOver={dragOverId === item.id}
                      dropPosition={dropPosition}
                      copiedKey={copiedKey}
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
                    <td colSpan={7} className="py-14 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-[#0066cc]/8 dark:bg-[#2997ff]/12 flex items-center justify-center">
                          <SFLink size={20} className="text-[#0066cc]/60 dark:text-[#2997ff]/70" />
                        </div>
                        <div>
                          <p className="text-[14px] font-semibold text-[#1d1d1f] dark:text-white mb-0.5">
                            {search ? 'Không tìm thấy kết quả' : 'Chưa có link nào'}
                          </p>
                          <p className="text-[12.5px] text-[#76767b] dark:text-[#a1a1a6]">
                            {search ? `Thử tìm với từ khoá khác` : 'Nhấn «Thêm Link» để bắt đầu'}
                          </p>
                        </div>
                        {!search && (
                          <button
                            type="button"
                            onClick={handleOpenAdd}
                            className="mt-1 inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-[12.5px] font-semibold bg-[#0066cc] text-white hover:bg-[#0071e3] active:scale-95 transition-all shadow-[0_4px_14px_rgba(0,102,204,0.35)]"
                          >
                            <SFPlus size={14} />
                            Thêm Link đầu tiên
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* 2. SHEET: ACCOUNT VAULT */}
        {activeTab === 'accounts' && (
          <div className="overflow-x-auto scrollbar-thin smooth-scroll-120 overscroll-y-auto">
            <table className="w-full text-left text-[13px] text-[#1d1d1f] dark:text-white">
              <thead className="bg-[#f5f5f7]/95 dark:bg-[#181820]/95 backdrop-blur-2xl border-b border-black/[0.08] dark:border-white/[0.12] text-[12px] font-bold text-[#1d1d1f] dark:text-white select-none sticky top-0 z-10 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                <tr>
                  <th className="w-9 pl-3 pr-1 py-3.5 text-center text-[#8e8e93]" aria-label="Kéo thả sắp xếp" title="Kéo thả sắp xếp">
                    <SFLine3Horizontal size={14} className="mx-auto opacity-40" />
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
                {filteredAccounts.length > 0 ? (
                  filteredAccounts.map((item) => (
                    <AccountTableRow
                      key={item.id}
                      item={item}
                      isDragged={draggedId === item.id}
                      isDragOver={dragOverId === item.id}
                      dropPosition={dropPosition}
                      copiedKey={copiedKey}
                      showPassword={!!showPasswordMap[item.id]}
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
                    <td colSpan={7} className="py-14 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-[#0066cc]/8 dark:bg-[#2997ff]/12 flex items-center justify-center">
                          <SFShieldFill size={20} className="text-[#0066cc]/60 dark:text-[#2997ff]/70" />
                        </div>
                        <div>
                          <p className="text-[14px] font-semibold text-[#1d1d1f] dark:text-white mb-0.5">
                            {search ? 'Không tìm thấy tài khoản nào' : 'Chưa có tài khoản nào'}
                          </p>
                          <p className="text-[12.5px] text-[#76767b] dark:text-[#a1a1a6]">
                            {search ? 'Thử tìm với từ khoá khác' : 'Lưu trữ thông tin đăng nhập và mật khẩu an toàn'}
                          </p>
                        </div>
                        {!search && (
                          <button
                            type="button"
                            onClick={handleOpenAdd}
                            className="mt-1 inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-[12.5px] font-semibold bg-[#0066cc] text-white hover:bg-[#0071e3] active:scale-95 transition-all shadow-[0_4px_14px_rgba(0,102,204,0.35)]"
                          >
                            <SFPlus size={14} />
                            Thêm Tài khoản
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* 3. SHEET: STORE DIRECTORY */}
        {activeTab === 'stores' && (
          <div className="overflow-x-auto scrollbar-thin smooth-scroll-120 overscroll-y-auto">
            <table className="w-full text-left text-[13px] text-[#1d1d1f] dark:text-white">
              <thead className="bg-[#f5f5f7]/95 dark:bg-[#181820]/95 backdrop-blur-2xl border-b border-black/[0.08] dark:border-white/[0.12] text-[12px] font-bold text-[#1d1d1f] dark:text-white select-none sticky top-0 z-10 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                <tr>
                  <th className="w-9 pl-3 pr-1 py-3.5 text-center text-[#8e8e93]" aria-label="Kéo thả sắp xếp" title="Kéo thả sắp xếp">
                    <SFLine3Horizontal size={14} className="mx-auto opacity-40" />
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
                {filteredStores.length > 0 ? (
                  filteredStores.map((item) => (
                    <StoreTableRow
                      key={item.id}
                      item={item}
                      isDragged={draggedId === item.id}
                      isDragOver={dragOverId === item.id}
                      dropPosition={dropPosition}
                      copiedKey={copiedKey}
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
                    <td colSpan={6} className="py-14 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-[#0066cc]/8 dark:bg-[#2997ff]/12 flex items-center justify-center">
                          <SFStorefront size={20} className="text-[#0066cc]/60 dark:text-[#2997ff]/70" />
                        </div>
                        <div>
                          <p className="text-[14px] font-semibold text-[#1d1d1f] dark:text-white mb-0.5">
                            {search ? 'Không tìm thấy cửa hàng nào' : 'Chưa có cửa hàng nào'}
                          </p>
                          <p className="text-[12.5px] text-[#76767b] dark:text-[#a1a1a6]">
                            {search ? 'Thử tìm theo mã CH, địa chỉ hoặc quận/huyện' : 'Danh sách hệ thống cửa hàng và vị trí Google Maps'}
                          </p>
                        </div>
                        {!search && (
                          <button
                            type="button"
                            onClick={handleOpenAdd}
                            className="mt-1 inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-[12.5px] font-semibold bg-[#0066cc] text-white hover:bg-[#0071e3] active:scale-95 transition-all shadow-[0_4px_14px_rgba(0,102,204,0.35)]"
                          >
                            <SFPlus size={14} />
                            Thêm Cửa hàng
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
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

      {/* Google Maps In-App Preview Modal */}
      <MapPreviewModal
        isOpen={!!previewMapStore}
        onClose={() => setPreviewMapStore(null)}
        store={previewMapStore}
      />
      </div>
    </div>
  );
};
