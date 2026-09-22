import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Link as LinkIcon,
  Shield,
  Store,
  Search,
  Plus,
  Download,
  Upload,
  ExternalLink,
  Copy,
  Check,
  Eye,
  EyeOff,
  Edit2,
  Trash2,
  Star,
  MapPin,
  Sparkles,
  Filter,
  X,
  FileSpreadsheet,
  CheckCircle2,
  Layers,
  GripVertical,
  ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { dataService } from '@/services/dataService';
import { excelService } from '@/services/excelService';
import { LinkItem, AccountItem, StoreItem } from '@/types/workspace';
import { LinkDrawerForm } from '@/components/forms/LinkDrawerForm';
import { AccountDrawerForm } from '@/components/forms/AccountDrawerForm';
import { StoreDrawerForm } from '@/components/forms/StoreDrawerForm';
import { ConfirmDeleteDialog } from '@/components/ui/ConfirmDeleteDialog';
import toast from 'react-hot-toast';

type TabType = 'links' | 'accounts' | 'stores';

export const UnifiedWorkspacePage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab') as TabType | null;

  const [activeTab, setActiveTab] = useState<TabType>(
    tabFromUrl === 'accounts' || tabFromUrl === 'stores' ? tabFromUrl : 'links'
  );

  const [links, setLinks] = useState<LinkItem[]>([]);
  const [accounts, setAccounts] = useState<AccountItem[]>([]);
  const [stores, setStores] = useState<StoreItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);

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

  const [deleteTarget, setDeleteTarget] = useState<{
    type: TabType;
    id: string;
    label: string;
  } | null>(null);

  // Drag and drop reordering states
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [dropPosition, setDropPosition] = useState<'top' | 'bottom' | null>(null);

  // Reorder handler without needing STT input
  const handleReorder = async (
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
  };

  // Sync activeTab with URL params
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setSearch('');
    setSelectedCategory('ALL');
    setSearchParams({ tab });
  };

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

  // 1-Click Copy Helper
  const handleCopy = (text: string, label: string, key: string) => {
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
  };

  // Toggle Favorite
  const handleToggleFavorite = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const updated = await dataService.toggleFavoriteLink(id);
      if (updated) {
        setLinks((prev) => prev.map((l) => (l.id === id ? updated : l)));
        toast.success(updated.favorite ? 'Đã thêm vào yêu thích' : 'Đã bỏ yêu thích');
      }
    } catch (err) {
      toast.error('Lỗi khi cập nhật trạng thái');
    }
  };

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
      toast.success(`Đã xóa "${deleteTarget.label}"`);
      setDeleteTarget(null);
      await loadData();
    } catch (err) {
      toast.error('Lỗi khi xóa mục này');
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
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (l) =>
          l.hangMuc.toLowerCase().includes(q) ||
          (l.category && l.category.toLowerCase().includes(q)) ||
          (l.note && l.note.toLowerCase().includes(q)) ||
          (l.link && l.link.toLowerCase().includes(q))
      );
    }
    return result;
  }, [links, search, selectedCategory, onlyFavorites]);

  // Filtered accounts
  const filteredAccounts = useMemo(() => {
    if (!search.trim()) return accounts;
    const q = search.trim().toLowerCase();
    return accounts.filter(
      (a) =>
        a.software.toLowerCase().includes(q) ||
        a.username.toLowerCase().includes(q) ||
        (a.link && a.link.toLowerCase().includes(q)) ||
        (a.note && a.note.toLowerCase().includes(q))
    );
  }, [accounts, search]);

  // Filtered stores
  const filteredStores = useMemo(() => {
    if (!search.trim()) return stores;
    const q = search.trim().toLowerCase();
    return stores.filter(
      (s) =>
        s.storeCode.toLowerCase().includes(q) ||
        s.address.toLowerCase().includes(q) ||
        (s.type && s.type.toLowerCase().includes(q))
    );
  }, [stores, search]);

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
    <div className="space-y-5 max-w-7xl mx-auto pb-12">
      {/* ─────────────────── Top Bar: Sheet Tabs & Action Bar ─────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Liquid Glass Segmented Sheet Tabs */}
        <div className="liquid-glass-segmented-track p-1.5 flex items-center shadow-sm w-full lg:w-auto overflow-x-auto">
          {/* Tab 1: Links */}
          <button
            type="button"
            onClick={() => handleTabChange('links')}
            className={`flex items-center gap-2.5 px-4 py-2 rounded-full text-[13.5px] transition-all duration-200 active:scale-[0.98] cursor-pointer whitespace-nowrap ${
              activeTab === 'links'
                ? 'bg-white/90 dark:bg-white/15 text-[#0066cc] dark:text-[#2997ff] shadow-[0_2px_8px_rgba(0,0,0,0.06),inset_0_1px_1px_rgba(255,255,255,0.9)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.4),inset_0_1px_1px_rgba(255,255,255,0.15)] font-semibold'
                : 'text-[#555558] dark:text-[#a1a1a6] hover:text-[#1d1d1f] dark:hover:text-white font-medium'
            }`}
          >
            <LinkIcon className="w-4 h-4 text-[#0066cc] dark:text-[#2997ff]" />
            <span>Liên kết nhanh</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[11px] font-mono font-bold transition-colors ${
                activeTab === 'links'
                  ? 'bg-[#0066cc]/15 text-[#0066cc] dark:bg-[#2997ff]/20 dark:text-[#2997ff]'
                  : 'bg-black/5 dark:bg-white/10 text-[#76767b] dark:text-[#a1a1a6]'
              }`}
            >
              {links.length}
            </span>
          </button>

          {/* Tab 2: Accounts */}
          <button
            type="button"
            onClick={() => handleTabChange('accounts')}
            className={`flex items-center gap-2.5 px-4 py-2 rounded-full text-[13.5px] transition-all duration-200 active:scale-[0.98] cursor-pointer whitespace-nowrap ${
              activeTab === 'accounts'
                ? 'bg-white/90 dark:bg-white/15 text-emerald-600 dark:text-emerald-400 shadow-[0_2px_8px_rgba(0,0,0,0.06),inset_0_1px_1px_rgba(255,255,255,0.9)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.4),inset_0_1px_1px_rgba(255,255,255,0.15)] font-semibold'
                : 'text-[#555558] dark:text-[#a1a1a6] hover:text-[#1d1d1f] dark:hover:text-white font-medium'
            }`}
          >
            <Shield className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Tài khoản & Mật khẩu</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[11px] font-mono font-bold transition-colors ${
                activeTab === 'accounts'
                  ? 'bg-emerald-500/15 text-emerald-600 dark:bg-emerald-400/20 dark:text-emerald-300'
                  : 'bg-black/5 dark:bg-white/10 text-[#76767b] dark:text-[#a1a1a6]'
              }`}
            >
              {accounts.length}
            </span>
          </button>

          {/* Tab 3: Stores */}
          <button
            type="button"
            onClick={() => handleTabChange('stores')}
            className={`flex items-center gap-2.5 px-4 py-2 rounded-full text-[13.5px] transition-all duration-200 active:scale-[0.98] cursor-pointer whitespace-nowrap ${
              activeTab === 'stores'
                ? 'bg-white/90 dark:bg-white/15 text-amber-600 dark:text-amber-400 shadow-[0_2px_8px_rgba(0,0,0,0.06),inset_0_1px_1px_rgba(255,255,255,0.9)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.4),inset_0_1px_1px_rgba(255,255,255,0.15)] font-semibold'
                : 'text-[#555558] dark:text-[#a1a1a6] hover:text-[#1d1d1f] dark:hover:text-white font-medium'
            }`}
          >
            <Store className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span>Danh mục Cửa Hàng</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[11px] font-mono font-bold transition-colors ${
                activeTab === 'stores'
                  ? 'bg-amber-500/15 text-amber-600 dark:bg-amber-400/20 dark:text-amber-300'
                  : 'bg-black/5 dark:bg-white/10 text-[#76767b] dark:text-[#a1a1a6]'
              }`}
            >
              {stores.length}
            </span>
          </button>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <Button
            variant="glass"
            size="sm"
            onClick={handleExport}
            icon={<Download className="w-3.5 h-3.5 text-[#0066cc] dark:text-[#2997ff]" />}
            title="Tải bảng tính hiện tại về máy dạng Excel (.xlsx)"
          >
            Xuất Excel
          </Button>

          <Button
            variant="glass"
            size="sm"
            onClick={() => window.dispatchEvent(new CustomEvent('fm:open-import'))}
            icon={<Upload className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />}
            title="Nhập file Excel từ máy"
          >
            Import Excel
          </Button>

          <Button
            variant="glassProminent"
            size="sm"
            onClick={handleOpenAdd}
            icon={<Plus className="w-4 h-4" />}
          >
            {activeTab === 'links' && 'Thêm Link'}
            {activeTab === 'accounts' && 'Thêm Tài Khoản'}
            {activeTab === 'stores' && 'Thêm Cửa Hàng'}
          </Button>
        </div>
      </div>

      {/* ─────────────────── Search & Quick Filter Bar ─────────────────── */}
      <div className="relative z-30 glass-material rounded-[20px] p-3 sm:p-3.5 flex flex-col md:flex-row items-center justify-between gap-3 shadow-xs">
        {/* Instant Search Bar */}
        <div className="relative w-full md:w-96 group">
          <Search className="w-4 h-4 text-[#76767b] dark:text-[#a1a1a6] group-focus-within:text-[#0066cc] dark:group-focus-within:text-[#2997ff] absolute left-3.5 top-2.5 pointer-events-none transition-colors" />
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
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-2.5 text-[#76767b] hover:text-[#1d1d1f] dark:hover:text-white p-0.5 rounded-full"
            >
              <X className="w-3.5 h-3.5" />
            </button>
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
              <Star
                className={`w-3.5 h-3.5 transition-transform ${
                  onlyFavorites ? 'fill-amber-500 text-amber-500 scale-110' : 'text-[#8e8e93]'
                }`}
              />
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
                  <Filter
                    className={`w-3.5 h-3.5 ${
                      selectedCategory !== 'ALL' ? 'text-[#0066cc] dark:text-[#2997ff]' : 'text-[#8e8e93]'
                    }`}
                  />
                  <span className="max-w-[160px] truncate">
                    {selectedCategory === 'ALL'
                      ? `Tất cả nhóm (${links.length})`
                      : `${selectedCategory} (${links.filter((l) => l.category === selectedCategory).length})`}
                  </span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-[#8e8e93] transition-transform duration-200 shrink-0 ${
                      categoryDropdownOpen ? 'rotate-180 text-[#0066cc] dark:text-[#2997ff]' : ''
                    }`}
                  />
                </button>

                {/* Floating Liquid-Glass Popover Menu */}
                {categoryDropdownOpen && (
                  <div className="absolute right-0 top-full mt-2 w-64 rounded-2xl bg-white dark:bg-[#1c1c24] backdrop-blur-3xl border border-black/10 dark:border-white/15 p-1.5 shadow-[0_20px_48px_-6px_rgba(0,0,0,0.25),0_6px_16px_rgba(0,0,0,0.08)] z-50 animate-in fade-in zoom-in-95 duration-150 space-y-1">
                    <div className="px-3 py-2 text-[10.5px] font-bold text-[#8e8e93] dark:text-[#98989d] uppercase tracking-wider border-b border-black/[0.06] dark:border-white/[0.08] flex items-center justify-between">
                      <span>Phân loại danh mục</span>
                      <span className="font-mono text-[10px] font-normal">{categories.length} nhóm</span>
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
      <div className="rounded-[22px] border border-white/60 dark:border-white/10 bg-white/70 dark:bg-[#141418]/70 backdrop-blur-2xl overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.4)]">
        {/* 1. SHEET: QUICK LINKS */}
        {activeTab === 'links' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px] text-[#1d1d1f] dark:text-[#f5f5f7]">
              <thead className="bg-white/80 dark:bg-[#141418]/85 backdrop-blur-md border-b border-black/[0.06] dark:border-white/10 text-[11px] font-semibold text-[#76767b] dark:text-[#a1a1a6] uppercase tracking-wider select-none sticky top-0 z-10">
                <tr>
                  <th className="w-9 pl-3 pr-1 py-3.5 text-center text-[#8e8e93]">
                    <GripVertical className="w-3.5 h-3.5 mx-auto opacity-30" />
                  </th>
                  <th className="px-2 py-3.5 w-10 text-center whitespace-nowrap">⭐</th>
                  <th className="px-5 py-3.5 whitespace-nowrap min-w-[160px]">Tên Hạng Mục</th>
                  <th className="px-4 py-3.5 whitespace-nowrap min-w-[130px]">Danh Mục</th>
                  <th className="px-4 py-3.5 whitespace-nowrap min-w-[140px]">Ghi Chú</th>
                  <th className="px-4 py-3.5 whitespace-nowrap min-w-[130px]">Đường Dẫn</th>
                  <th className="pl-4 pr-6 sm:pr-8 py-3.5 text-right whitespace-nowrap min-w-[110px]">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.04] dark:divide-white/5">
                {filteredLinks.length > 0 ? (
                  filteredLinks.map((item) => (
                    <tr
                      key={item.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', item.id);
                        e.dataTransfer.effectAllowed = 'move';
                        setDraggedId(item.id);
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        if (!draggedId || draggedId === item.id) return;
                        const rect = e.currentTarget.getBoundingClientRect();
                        const isBottom = e.clientY > rect.top + rect.height / 2;
                        const pos = isBottom ? 'bottom' : 'top';
                        if (dragOverId !== item.id || dropPosition !== pos) {
                          setDragOverId(item.id);
                          setDropPosition(pos);
                        }
                      }}
                      onDragLeave={(e) => {
                        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                        if (dragOverId === item.id) {
                          setDragOverId(null);
                          setDropPosition(null);
                        }
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (draggedId && draggedId !== item.id && dropPosition) {
                          handleReorder('links', draggedId, item.id, dropPosition);
                        }
                        setDraggedId(null);
                        setDragOverId(null);
                        setDropPosition(null);
                      }}
                      onDragEnd={() => {
                        setDraggedId(null);
                        setDragOverId(null);
                        setDropPosition(null);
                      }}
                      className={`transition-colors group relative ${
                        draggedId === item.id
                          ? 'opacity-30 bg-[#0066cc]/5 dark:bg-[#2997ff]/5'
                          : 'hover:bg-black/[0.025] dark:hover:bg-white/[0.04]'
                      } ${
                        dragOverId === item.id && draggedId !== item.id
                          ? dropPosition === 'top'
                            ? 'shadow-[inset_0_2px_0_#0066cc] dark:shadow-[inset_0_2px_0_#2997ff] bg-[#0066cc]/[0.04] dark:bg-[#2997ff]/[0.06]'
                            : 'shadow-[inset_0_-2px_0_#0066cc] dark:shadow-[inset_0_-2px_0_#2997ff] bg-[#0066cc]/[0.04] dark:bg-[#2997ff]/[0.06]'
                          : ''
                      }`}
                    >
                      {/* Drag Handle */}
                      <td className="w-9 pl-3 pr-1 py-3 text-center cursor-grab active:cursor-grabbing text-[#8e8e93] hover:text-[#0066cc] dark:hover:text-[#2997ff] transition-colors select-none">
                        <div
                          className="inline-flex items-center justify-center p-1 rounded hover:bg-black/5 dark:hover:bg-white/10"
                          title="Kéo thả để sắp xếp thứ tự tùy ý"
                        >
                          <GripVertical className="w-3.5 h-3.5 opacity-35 group-hover:opacity-90 transition-opacity" />
                        </div>
                      </td>

                      {/* Star */}
                      <td className="px-2 py-3 text-center">
                        <button
                          type="button"
                          onClick={(e) => handleToggleFavorite(item.id, e)}
                          className="text-[#cccccc] hover:text-amber-500 transition-colors cursor-pointer p-1"
                          title={item.favorite ? 'Bỏ yêu thích' : 'Đánh dấu yêu thích'}
                        >
                          <Star
                            className={`w-4 h-4 ${
                              item.favorite ? 'fill-amber-500 text-amber-500' : ''
                            }`}
                          />
                        </button>
                      </td>

                      {/* Hang Muc */}
                      <td className="px-5 py-3 font-semibold text-[#1d1d1f] dark:text-white">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-[#0066cc] dark:bg-[#2997ff]" />
                          <span>{item.hangMuc}</span>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="px-4 py-3">
                        {item.category ? (
                          <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-black/[0.04] dark:bg-white/[0.08] text-[#76767b] dark:text-[#a1a1a6] font-medium border border-black/5 dark:border-white/10">
                            {item.category}
                          </span>
                        ) : (
                          <span className="text-xs text-[#a1a1a6] opacity-50">—</span>
                        )}
                      </td>

                      {/* Note */}
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400 max-w-xs truncate">
                        {item.note || <span className="opacity-40 text-xs">—</span>}
                      </td>

                      {/* Link 1-Click Action */}
                      <td className="px-4 py-3">
                        {item.link ? (
                          <div className="flex items-center gap-2">
                            <a
                              href={item.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#0066cc]/10 text-[#0066cc] dark:bg-[#2997ff]/15 dark:text-[#2997ff] text-xs font-semibold hover:bg-[#0066cc]/20 transition-all active:scale-95"
                              title="Mở liên kết trong tab mới"
                            >
                              <span>Mở link</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                            <button
                              type="button"
                              onClick={() => handleCopy(item.link, 'đường dẫn', `link-${item.id}`)}
                              className="p-1 rounded-full text-[#76767b] hover:text-[#1d1d1f] dark:hover:text-white transition-colors"
                              title="Sao chép link"
                            >
                              {copiedKey === `link-${item.id}` ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                            Chưa có URL
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="pl-4 pr-6 sm:pr-8 py-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingLink(item);
                              setLinkDrawerOpen(true);
                            }}
                            className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-[#76767b] hover:text-[#1d1d1f] dark:hover:text-white transition-all active:scale-90"
                            title="Chỉnh sửa"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setDeleteTarget({ type: 'links', id: item.id, label: item.hangMuc })
                            }
                            className="p-1.5 rounded-full hover:bg-rose-500/10 text-[#76767b] hover:text-rose-600 transition-all active:scale-90"
                            title="Xóa link"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-[#76767b]">
                      Không tìm thấy liên kết nào thỏa mãn điều kiện lọc.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* 2. SHEET: ACCOUNT VAULT */}
        {activeTab === 'accounts' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px] text-[#1d1d1f] dark:text-[#f5f5f7]">
              <thead className="bg-white/80 dark:bg-[#141418]/85 backdrop-blur-md border-b border-black/[0.06] dark:border-white/10 text-[11px] font-semibold text-[#76767b] dark:text-[#a1a1a6] uppercase tracking-wider select-none sticky top-0 z-10">
                <tr>
                  <th className="w-9 pl-3 pr-1 py-3.5 text-center text-[#8e8e93]">
                    <GripVertical className="w-3.5 h-3.5 mx-auto opacity-30" />
                  </th>
                  <th className="px-5 py-3.5 whitespace-nowrap min-w-[150px]">Phần Mềm</th>
                  <th className="px-4 py-3.5 whitespace-nowrap min-w-[150px]">Tên Đăng Nhập</th>
                  <th className="px-4 py-3.5 whitespace-nowrap min-w-[130px]">Mật Khẩu</th>
                  <th className="px-4 py-3.5 whitespace-nowrap min-w-[130px]">Trang Đăng Nhập</th>
                  <th className="px-4 py-3.5 whitespace-nowrap min-w-[130px]">Ghi Chú</th>
                  <th className="pl-4 pr-6 sm:pr-8 py-3.5 text-right whitespace-nowrap min-w-[110px]">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.04] dark:divide-white/5">
                {filteredAccounts.length > 0 ? (
                  filteredAccounts.map((item) => (
                    <tr
                      key={item.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', item.id);
                        e.dataTransfer.effectAllowed = 'move';
                        setDraggedId(item.id);
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        if (!draggedId || draggedId === item.id) return;
                        const rect = e.currentTarget.getBoundingClientRect();
                        const isBottom = e.clientY > rect.top + rect.height / 2;
                        const pos = isBottom ? 'bottom' : 'top';
                        if (dragOverId !== item.id || dropPosition !== pos) {
                          setDragOverId(item.id);
                          setDropPosition(pos);
                        }
                      }}
                      onDragLeave={(e) => {
                        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                        if (dragOverId === item.id) {
                          setDragOverId(null);
                          setDropPosition(null);
                        }
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (draggedId && draggedId !== item.id && dropPosition) {
                          handleReorder('accounts', draggedId, item.id, dropPosition);
                        }
                        setDraggedId(null);
                        setDragOverId(null);
                        setDropPosition(null);
                      }}
                      onDragEnd={() => {
                        setDraggedId(null);
                        setDragOverId(null);
                        setDropPosition(null);
                      }}
                      className={`transition-colors group relative ${
                        draggedId === item.id
                          ? 'opacity-30 bg-[#0066cc]/5 dark:bg-[#2997ff]/5'
                          : 'hover:bg-black/[0.025] dark:hover:bg-white/[0.04]'
                      } ${
                        dragOverId === item.id && draggedId !== item.id
                          ? dropPosition === 'top'
                            ? 'shadow-[inset_0_2px_0_#0066cc] dark:shadow-[inset_0_2px_0_#2997ff] bg-[#0066cc]/[0.04] dark:bg-[#2997ff]/[0.06]'
                            : 'shadow-[inset_0_-2px_0_#0066cc] dark:shadow-[inset_0_-2px_0_#2997ff] bg-[#0066cc]/[0.04] dark:bg-[#2997ff]/[0.06]'
                          : ''
                      }`}
                    >
                      {/* Drag Handle */}
                      <td className="w-9 pl-3 pr-1 py-3 text-center cursor-grab active:cursor-grabbing text-[#8e8e93] hover:text-[#0066cc] dark:hover:text-[#2997ff] transition-colors select-none">
                        <div
                          className="inline-flex items-center justify-center p-1 rounded hover:bg-black/5 dark:hover:bg-white/10"
                          title="Kéo thả để sắp xếp thứ tự tùy ý"
                        >
                          <GripVertical className="w-3.5 h-3.5 opacity-35 group-hover:opacity-90 transition-opacity" />
                        </div>
                      </td>

                      {/* Software */}
                      <td className="px-5 py-3 font-semibold text-[#1d1d1f] dark:text-white">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          <span>{item.software}</span>
                        </div>
                      </td>

                      {/* Username (1-Click Copy Badge) */}
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => handleCopy(item.username, 'tài khoản', `user-${item.id}`)}
                          className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-black/[0.04] dark:bg-white/[0.07] hover:bg-[#0066cc]/10 dark:hover:bg-[#2997ff]/15 font-mono text-[13px] font-medium transition-colors cursor-pointer group/user"
                          title="Bấm để sao chép Tên Đăng Nhập"
                        >
                          <span className="group-hover/user:text-[#0066cc] dark:group-hover/user:text-[#2997ff]">
                            {item.username}
                          </span>
                          {copiedKey === `user-${item.id}` ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3 h-3 text-[#76767b] opacity-40 group-hover/user:opacity-100" />
                          )}
                        </button>
                      </td>

                      {/* Password (1-Click Copy + Reveal) */}
                      <td className="px-4 py-3">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleCopy(item.password || '', 'mật khẩu', `pass-${item.id}`)}
                            className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-black/[0.04] dark:bg-white/[0.07] hover:bg-emerald-500/10 font-mono text-[13px] font-medium transition-colors cursor-pointer group/pass"
                            title="Bấm để sao chép Mật Khẩu"
                          >
                            <span className="group-hover/pass:text-emerald-600 dark:group-hover/pass:text-emerald-400">
                              {showPasswordMap[item.id] ? item.password : '••••••••'}
                            </span>
                            {copiedKey === `pass-${item.id}` ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3 h-3 text-[#76767b] opacity-40 group-hover/pass:opacity-100" />
                            )}
                          </button>

                          {/* Reveal/Hide Eye Button */}
                          <button
                            type="button"
                            onClick={() =>
                              setShowPasswordMap((prev) => ({
                                ...prev,
                                [item.id]: !prev[item.id],
                              }))
                            }
                            className="p-1 rounded-full text-[#76767b] hover:text-[#1d1d1f] dark:hover:text-white transition-colors"
                            title={showPasswordMap[item.id] ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                          >
                            {showPasswordMap[item.id] ? (
                              <EyeOff className="w-3.5 h-3.5" />
                            ) : (
                              <Eye className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Link */}
                      <td className="px-4 py-3">
                        {item.link ? (
                          <a
                            href={item.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-[#0066cc] dark:text-[#2997ff] hover:underline font-medium"
                          >
                            <span>Đăng nhập</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <span className="text-xs text-[#a1a1a6] opacity-50">—</span>
                        )}
                      </td>

                      {/* Note */}
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400 max-w-xs truncate">
                        {item.note || <span className="opacity-40 text-xs">—</span>}
                      </td>

                      {/* Actions */}
                      <td className="pl-4 pr-6 sm:pr-8 py-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingAccount(item);
                              setAccountDrawerOpen(true);
                            }}
                            className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-[#76767b] hover:text-[#1d1d1f] dark:hover:text-white transition-all active:scale-90"
                            title="Chỉnh sửa"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setDeleteTarget({
                                type: 'accounts',
                                id: item.id,
                                label: item.software,
                              })
                            }
                            className="p-1.5 rounded-full hover:bg-rose-500/10 text-[#76767b] hover:text-rose-600 transition-all active:scale-90"
                            title="Xóa tài khoản"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-[#76767b]">
                      Không tìm thấy tài khoản nào phù hợp.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* 3. SHEET: STORE DIRECTORY */}
        {activeTab === 'stores' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px] text-[#1d1d1f] dark:text-[#f5f5f7]">
              <thead className="bg-white/80 dark:bg-[#141418]/85 backdrop-blur-md border-b border-black/[0.06] dark:border-white/10 text-[11px] font-semibold text-[#76767b] dark:text-[#a1a1a6] uppercase tracking-wider select-none sticky top-0 z-10">
                <tr>
                  <th className="w-9 pl-3 pr-1 py-3.5 text-center text-[#8e8e93]">
                    <GripVertical className="w-3.5 h-3.5 mx-auto opacity-30" />
                  </th>
                  <th className="px-5 py-3.5 whitespace-nowrap min-w-[110px]">Mã Cửa Hàng</th>
                  <th className="px-4 py-3.5 whitespace-nowrap min-w-[220px]">Địa Chỉ Cửa Hàng</th>
                  <th className="px-4 py-3.5 whitespace-nowrap min-w-[130px]">Khu Vực / Loại</th>
                  <th className="px-4 py-3.5 whitespace-nowrap min-w-[130px]">Google Maps</th>
                  <th className="pl-4 pr-6 sm:pr-8 py-3.5 text-right whitespace-nowrap min-w-[110px]">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.04] dark:divide-white/5">
                {filteredStores.length > 0 ? (
                  filteredStores.map((item) => (
                    <tr
                      key={item.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', item.id);
                        e.dataTransfer.effectAllowed = 'move';
                        setDraggedId(item.id);
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        if (!draggedId || draggedId === item.id) return;
                        const rect = e.currentTarget.getBoundingClientRect();
                        const isBottom = e.clientY > rect.top + rect.height / 2;
                        const pos = isBottom ? 'bottom' : 'top';
                        if (dragOverId !== item.id || dropPosition !== pos) {
                          setDragOverId(item.id);
                          setDropPosition(pos);
                        }
                      }}
                      onDragLeave={(e) => {
                        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                        if (dragOverId === item.id) {
                          setDragOverId(null);
                          setDropPosition(null);
                        }
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (draggedId && draggedId !== item.id && dropPosition) {
                          handleReorder('stores', draggedId, item.id, dropPosition);
                        }
                        setDraggedId(null);
                        setDragOverId(null);
                        setDropPosition(null);
                      }}
                      onDragEnd={() => {
                        setDraggedId(null);
                        setDragOverId(null);
                        setDropPosition(null);
                      }}
                      className={`transition-colors group relative ${
                        draggedId === item.id
                          ? 'opacity-30 bg-[#0066cc]/5 dark:bg-[#2997ff]/5'
                          : 'hover:bg-black/[0.025] dark:hover:bg-white/[0.04]'
                      } ${
                        dragOverId === item.id && draggedId !== item.id
                          ? dropPosition === 'top'
                            ? 'shadow-[inset_0_2px_0_#0066cc] dark:shadow-[inset_0_2px_0_#2997ff] bg-[#0066cc]/[0.04] dark:bg-[#2997ff]/[0.06]'
                            : 'shadow-[inset_0_-2px_0_#0066cc] dark:shadow-[inset_0_-2px_0_#2997ff] bg-[#0066cc]/[0.04] dark:bg-[#2997ff]/[0.06]'
                          : ''
                      }`}
                    >
                      {/* Drag Handle */}
                      <td className="w-9 pl-3 pr-1 py-3 text-center cursor-grab active:cursor-grabbing text-[#8e8e93] hover:text-[#0066cc] dark:hover:text-[#2997ff] transition-colors select-none">
                        <div
                          className="inline-flex items-center justify-center p-1 rounded hover:bg-black/5 dark:hover:bg-white/10"
                          title="Kéo thả để sắp xếp thứ tự tùy ý"
                        >
                          <GripVertical className="w-3.5 h-3.5 opacity-35 group-hover:opacity-90 transition-opacity" />
                        </div>
                      </td>

                      {/* Store Code */}
                      <td className="px-5 py-3 font-mono font-bold text-[#0066cc] dark:text-[#2997ff]">
                        <span className="px-2.5 py-1 rounded-md bg-[#0066cc]/10 dark:bg-[#2997ff]/15">
                          {item.storeCode}
                        </span>
                      </td>

                      {/* Address (1-Click Copy Badge) */}
                      <td className="px-4 py-3 font-medium text-[#1d1d1f] dark:text-white">
                        <button
                          type="button"
                          onClick={() => handleCopy(item.address || '', 'địa chỉ', `store-${item.id}`)}
                          className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-black/[0.04] dark:bg-white/[0.07] hover:bg-amber-500/10 transition-colors text-left cursor-pointer group/store"
                          title="Bấm để sao chép Địa chỉ cửa hàng"
                        >
                          <span className="group-hover/store:text-amber-600 dark:group-hover/store:text-amber-400">
                            {item.address}
                          </span>
                          {copiedKey === `store-${item.id}` ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          ) : (
                            <Copy className="w-3 h-3 text-[#76767b] opacity-40 group-hover/store:opacity-100 shrink-0" />
                          )}
                        </button>
                      </td>

                      {/* Type */}
                      <td className="px-4 py-3">
                        {item.type ? (
                          <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-black/[0.04] dark:bg-white/[0.08] text-[#76767b] dark:text-[#a1a1a6] font-medium">
                            {item.type}
                          </span>
                        ) : (
                          <span className="text-xs text-[#a1a1a6] opacity-50">—</span>
                        )}
                      </td>

                      {/* Google Maps Link */}
                      <td className="px-4 py-3">
                        {item.googleMaps ? (
                          <a
                            href={item.googleMaps}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-semibold hover:bg-amber-500/20 transition-all active:scale-95"
                            title="Mở chỉ đường trên Google Maps"
                          >
                            <MapPin className="w-3 h-3" />
                            <span>Xem Google Maps</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <span className="text-xs text-[#a1a1a6] opacity-50">Chưa có vị trí</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="pl-4 pr-6 sm:pr-8 py-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingStore(item);
                              setStoreDrawerOpen(true);
                            }}
                            className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-[#76767b] hover:text-[#1d1d1f] dark:hover:text-white transition-all active:scale-90"
                            title="Chỉnh sửa"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setDeleteTarget({
                                type: 'stores',
                                id: item.id,
                                label: item.storeCode,
                              })
                            }
                            className="p-1.5 rounded-full hover:bg-rose-500/10 text-[#76767b] hover:text-rose-600 transition-all active:scale-90"
                            title="Xóa cửa hàng"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-[#76767b]">
                      Không tìm thấy cửa hàng nào.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─────────────────── Drawers & Confirmation Dialogs ─────────────────── */}
      <LinkDrawerForm
        isOpen={linkDrawerOpen}
        onClose={() => setLinkDrawerOpen(false)}
        onSave={async (data) => {
          if (editingLink) {
            await dataService.updateLink(editingLink.id, data);
            toast.success('Đã cập nhật link');
          } else {
            await dataService.createLink(data);
            toast.success('Đã tạo link mới');
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
            toast.success('Đã cập nhật tài khoản');
          } else {
            await dataService.createAccount(data);
            toast.success('Đã tạo tài khoản mới');
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
            toast.success('Đã cập nhật cửa hàng');
          } else {
            await dataService.createStore(data);
            toast.success('Đã thêm cửa hàng mới');
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
    </div>
  );
};
