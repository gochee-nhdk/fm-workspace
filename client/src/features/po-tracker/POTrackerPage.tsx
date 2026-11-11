import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { usePOTrackerStore } from '@/stores/po-tracker-store';
import { poTrackerService } from '@/services/poTrackerService';
import { POFolderSidebar } from './components/POFolderSidebar';
import { POStatsBar } from './components/POStatsBar';
import { POListTable } from './components/POListTable';
import { POUploadDrawer } from './components/POUploadDrawer';
import { PODetailDrawer } from './components/PODetailDrawer';
import { PO_STATUS_CONFIG_MAP } from './components/POStatusPill';
import { POTrackerPO, POStatus } from '@/types/po-tracker';
import { Button } from '@/components/ui/button';
import {
  SFArrowUpDocumentFill,
  SFMagnifyingglass,
  SFSidebarLeft,
  SFFolderFill,
  SFXmark,
  SFArrowClockwise,
  SFArrowDownDocumentFill
} from 'sf-symbols-lib';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

export const POTrackerPage: React.FC = () => {
  const {
    folders,
    pos,
    stats,
    activeFolderId,
    activeStatus,
    search,
    loading,
    setFolders,
    setPos,
    setStats,
    setActiveFolderId,
    setActiveStatus,
    setSearch,
    setLoading,
  } = usePOTrackerStore();

  const [uploadDrawerOpen, setUploadDrawerOpen] = useState(false);
  const [detailPOId, setDetailPOId] = useState<string | null>(null);
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const [refreshing, setRefreshing] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Debounce search 300ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Global Keyboard shortcuts: '/' to search, 'Escape' to clear
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === 'Escape' && document.activeElement === searchInputRef.current) {
        setSearch('');
        searchInputRef.current?.blur();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setSearch]);

  // Fetch folders and stats
  const fetchFoldersAndStats = useCallback(async () => {
    try {
      const [foldersRes, statsRes] = await Promise.all([
        poTrackerService.getFolders().catch(() => ({ data: { data: [] } })),
        poTrackerService.getStats(activeFolderId || undefined).catch(() => ({ data: { data: null } })),
      ]);
      const folderList = Array.isArray(foldersRes?.data?.data) ? foldersRes.data.data : [];
      setFolders(folderList);
      if (statsRes?.data?.data) {
        setStats(statsRes.data.data);
      }
    } catch (err) {
      console.warn('Notice loading PO folders/stats:', err);
      setFolders([]);
    }
  }, [activeFolderId, setFolders, setStats]);

  // Fetch POs whenever folder/status/search changes
  const fetchPOs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await poTrackerService.getPOs({
        folder_id: activeFolderId || undefined,
        status: activeStatus || undefined,
        search: debouncedSearch.trim() || undefined,
      }).catch(() => ({ data: { data: [] } }));
      const poList = Array.isArray(res?.data?.data) ? res.data.data : [];
      setPos(poList);
    } catch (err) {
      console.warn('Notice fetching PO list:', err);
      setPos([]);
    } finally {
      setLoading(false);
    }
  }, [activeFolderId, activeStatus, debouncedSearch, setLoading, setPos]);

  useEffect(() => {
    fetchFoldersAndStats();
  }, [fetchFoldersAndStats]);

  useEffect(() => {
    fetchPOs();
  }, [fetchPOs]);

  // Quick refresh all data
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([fetchFoldersAndStats(), fetchPOs()]);
      toast.success('Đã làm mới dữ liệu theo dõi PO.');
    } catch {
      toast.error('Không thể làm mới dữ liệu.');
    } finally {
      setRefreshing(false);
    }
  };

  // Export current filtered list to CSV (UTF-8 with BOM for Excel)
  const handleExportCSV = () => {
    if (!pos || pos.length === 0) {
      toast.error('Không có dữ liệu PO để xuất báo cáo.');
      return;
    }

    const headers = [
      'Số PO',
      'Nhà cung cấp',
      'Mã NCC',
      'Kho tiếp nhận',
      'Thư mục',
      'Ngày lập PO',
      'Hạn giao dự kiến',
      'Ngày giao thực tế',
      'Tổng tiền (VND)',
      'Trạng thái',
      'Ghi chú',
    ];

    const escapeCSV = (val?: string | number | null) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = pos.map((p) => [
      escapeCSV(p.po_number),
      escapeCSV(p.supplier_name),
      escapeCSV(p.supplier_code),
      escapeCSV(p.warehouse),
      escapeCSV(p.folder_name || 'Chưa phân nhóm'),
      escapeCSV(p.po_date),
      escapeCSV(p.expected_delivery_date),
      escapeCSV(p.actual_delivery_date),
      escapeCSV(p.total_value),
      escapeCSV(PO_STATUS_CONFIG_MAP[p.status]?.label || p.status),
      escapeCSV(p.notes),
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `PO_Tracker_Report_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(`Đã xuất file báo cáo ${pos.length} đơn hàng PO thành công!`);
  };

  // Handler for row detail click
  const handleViewDetail = (po: POTrackerPO) => {
    setDetailPOId(po.id);
    setDetailDrawerOpen(true);
  };

  const currentFolder = useMemo(() => {
    if (!activeFolderId) return null;
    return folders.find((f) => f.id === activeFolderId);
  }, [folders, activeFolderId]);

  return (
    <div className="flex -m-4 sm:-m-5 lg:-m-6 h-[calc(100vh-3.75rem)] overflow-hidden select-none font-sans">
      {/* Left Folders Sidebar */}
      <POFolderSidebar
        onSelectFolder={(id) => setActiveFolderId(id)}
        collapsed={sidebarCollapsed}
      />

      {/* Main Tracking Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-transparent">
        {/* Top Control Bar with Glass Effect */}
        <div className="px-4 sm:px-5 py-3 border-b border-black/[0.06] dark:border-white/[0.08] bg-white/70 dark:bg-[#16161c]/70 backdrop-blur-2xl flex flex-wrap items-center justify-between gap-3 shrink-0 z-10 shadow-2xs">
          {/* Title & Folder Breadcrumb */}
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-[#555558] dark:text-[#a1a1a6] hover:text-[#0088FF] dark:hover:text-[#0091FF] hover:bg-black/5 dark:hover:bg-white/10 active:scale-95 transition-all cursor-pointer shrink-0"
              title={sidebarCollapsed ? 'Mở rộng thanh nhóm' : 'Thu gọn thanh nhóm'}
            >
              <SFSidebarLeft size={16} className={cn('transition-transform duration-200', sidebarCollapsed && 'rotate-180')} />
            </button>
            <div className="truncate">
              <h1 className="text-[17px] sm:text-[19px] font-bold text-slate-900 dark:text-white flex items-center gap-2 truncate tracking-tight">
                <span>Theo dõi đơn hàng (PO Tracker)</span>
                {currentFolder && (
                  <span className="text-[12px] font-semibold px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-500/20 text-[#0088FF] dark:text-[#0091FF] border border-blue-200/60 dark:border-blue-500/30 flex items-center gap-1">
                    <SFFolderFill size={11} />
                    <span>{currentFolder.name}</span>
                  </span>
                )}
                {activeFolderId === 'unassigned' && (
                  <span className="text-[11.5px] font-semibold px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                    Chưa phân nhóm
                  </span>
                )}
              </h1>
              <p className="text-[12px] font-semibold text-slate-700 dark:text-zinc-200 truncate mt-0.5 tracking-normal">
                Tự động nhận diện dữ liệu PO từ file PDF / ảnh scan và giám sát tiến độ giao nhận kho
              </p>
            </div>
          </div>

          {/* Actions & Search */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Search Input - Apple Spotlight Style with shortcut tooltip */}
            <div className="relative flex items-center">
              <div className="absolute left-3 text-[#0088FF] dark:text-[#0091FF] pointer-events-none flex items-center justify-center">
                <SFMagnifyingglass size={13} />
              </div>
              <input
                ref={searchInputRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm số PO, NCC, kho... (Nhấn /)"
                className="w-44 sm:w-60 h-9 pl-8 pr-7 rounded-full bg-white dark:bg-[#1a1a1e] border border-black/15 dark:border-white/15 text-[12.5px] font-medium text-slate-900 dark:text-white placeholder-[#86868b] focus:outline-none focus:ring-2 focus:ring-[#0088FF]/30 transition-all shadow-2xs"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 text-xs text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-white cursor-pointer"
                  title="Xóa từ khóa"
                >
                  <SFXmark size={11} />
                </button>
              )}
            </div>

            {/* Refresh Button */}
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              className="w-9 h-9 rounded-full bg-white dark:bg-[#1a1a1e] border border-black/15 dark:border-white/15 flex items-center justify-center text-[#555558] dark:text-[#a1a1a6] hover:text-[#0088FF] hover:bg-black/5 transition-all cursor-pointer shadow-2xs active:scale-95"
              title="Làm mới danh sách PO"
            >
              <SFArrowClockwise size={13} className={cn(refreshing && 'animate-spin text-[#0088FF]')} />
            </button>

            {/* Export CSV Button */}
            <button
              type="button"
              onClick={handleExportCSV}
              className="h-9 px-3 rounded-full bg-white dark:bg-[#1a1a1e] border border-black/15 dark:border-white/15 text-[#555558] dark:text-[#a1a1a6] hover:text-[#0088FF] text-[12px] font-bold flex items-center gap-1.5 shadow-2xs active:scale-95 transition-all cursor-pointer"
              title="Xuất bảng Excel / CSV"
            >
              <SFArrowDownDocumentFill size={12} className="text-[#0088FF]" />
              <span className="hidden sm:inline">Xuất CSV</span>
            </button>

            {/* Nút "Tải lên PO" với icon SF Symbol chuẩn Apple */}
            <Button
              variant="primary"
              size="sm"
              onClick={() => setUploadDrawerOpen(true)}
              className="fm-primary-pill-surface shadow-xs text-white h-9 px-4 rounded-full font-bold text-[13px] gap-1.5 active:scale-95 transition-transform"
            >
              <SFArrowUpDocumentFill size={14} />
              <span>Tải lên PO</span>
            </Button>
          </div>
        </div>

        {/* Scrollable Viewport */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5">
          {/* Stats Summary Bar */}
          <POStatsBar
            stats={stats}
            loading={loading && !stats}
            activeStatus={activeStatus}
            onStatusFilter={(st) => setActiveStatus(st)}
          />

          {/* Active Filter Chips */}
          {(activeStatus || activeFolderId || search) && (
            <div className="flex items-center gap-2 flex-wrap text-[12px] p-2.5 px-3.5 rounded-2xl bg-white/85 dark:bg-[#1a1a22]/85 backdrop-blur-md border border-black/[0.08] dark:border-white/10 shadow-2xs animate-in fade-in slide-in-from-top-2 duration-300">
              <span className="text-[#48484a] dark:text-[#a1a1a6] font-bold text-[12.5px] mr-1">Bộ lọc:</span>

              {activeStatus && (
                <span
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-bold text-[12px] shadow-2xs',
                    activeStatus === 'upcoming_7_days'
                      ? 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-500/25'
                      : 'bg-[#0088FF]/10 text-[#0088FF] dark:text-[#0A84FF] border border-[#0088FF]/25'
                  )}
                >
                  <span className="text-[#48484a] dark:text-[#a1a1a6] font-medium text-[11.5px]">Trạng thái:</span>
                  <span>
                    {activeStatus === 'upcoming_7_days'
                      ? 'Hạn 7 ngày tới'
                      : (PO_STATUS_CONFIG_MAP[activeStatus as POStatus]?.label || activeStatus)}
                  </span>
                  <button
                    onClick={() => setActiveStatus(null)}
                    className="w-4 h-4 rounded-full flex items-center justify-center hover:bg-black/10 dark:hover:bg-white/10 active:scale-90 transition-all cursor-pointer ml-0.5"
                    title="Bỏ lọc trạng thái"
                  >
                    <SFXmark size={10} />
                  </button>
                </span>
              )}

              {activeFolderId && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/25 font-bold text-[12px] shadow-2xs">
                  <span className="text-[#48484a] dark:text-[#a1a1a6] font-medium text-[11.5px]">Nhóm:</span>
                  <span>{currentFolder?.name || 'Chưa phân nhóm'}</span>
                  <button
                    onClick={() => setActiveFolderId(null)}
                    className="w-4 h-4 rounded-full flex items-center justify-center hover:bg-amber-500/20 active:scale-90 transition-all cursor-pointer ml-0.5"
                    title="Bỏ lọc nhóm"
                  >
                    <SFXmark size={10} />
                  </button>
                </span>
              )}

              {search && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/[0.04] dark:bg-white/[0.08] text-[#1d1d1f] dark:text-white border border-black/10 dark:border-white/10 font-bold text-[12px] shadow-2xs">
                  <span className="text-[#48484a] dark:text-[#a1a1a6] font-medium text-[11.5px]">Từ khóa:</span>
                  <span>"{search}"</span>
                  <button
                    onClick={() => setSearch('')}
                    className="w-4 h-4 rounded-full flex items-center justify-center hover:bg-black/10 dark:hover:bg-white/10 active:scale-90 transition-all cursor-pointer ml-0.5"
                    title="Xóa từ khóa tìm kiếm"
                  >
                    <SFXmark size={10} />
                  </button>
                </span>
              )}

              <button
                onClick={() => {
                  setActiveStatus(null);
                  setActiveFolderId(null);
                  setSearch('');
                }}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[12px] font-bold text-[#0088FF] dark:text-[#0A84FF] hover:bg-[#0088FF]/10 active:scale-95 transition-all cursor-pointer ml-auto"
              >
                <SFXmark size={11} />
                <span>Xóa bộ lọc</span>
              </button>
            </div>
          )}

          {/* PO Table */}
          <POListTable
            pos={pos}
            loading={loading}
            onViewDetail={handleViewDetail}
            onEdit={handleViewDetail}
          />
        </div>
      </div>

      {/* Upload & Create PO Drawer */}
      <POUploadDrawer
        isOpen={uploadDrawerOpen}
        onClose={() => setUploadDrawerOpen(false)}
        onSuccess={() => {
          fetchFoldersAndStats();
          fetchPOs();
        }}
      />

      {/* PO Detail & Tracking Drawer */}
      <PODetailDrawer
        poId={detailPOId}
        isOpen={detailDrawerOpen}
        onClose={() => {
          setDetailDrawerOpen(false);
          setDetailPOId(null);
          fetchFoldersAndStats();
          fetchPOs();
        }}
      />
    </div>
  );
};
export default POTrackerPage;
