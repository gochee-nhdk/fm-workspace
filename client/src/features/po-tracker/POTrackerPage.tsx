import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { usePOTrackerStore } from '@/stores/po-tracker-store';
import { poTrackerService } from '@/services/poTrackerService';
import { POFolderSidebar } from './components/POFolderSidebar';
import { POStatsBar } from './components/POStatsBar';
import { POListTable } from './components/POListTable';
import { POUploadDrawer } from './components/POUploadDrawer';
import { PODetailDrawer } from './components/PODetailDrawer';
import { POTrackerPO } from '@/types/po-tracker';
import { Button } from '@/components/ui/button';
import {
  SFArrowUpDocumentFill,
  SFMagnifyingglass,
  SFSidebarLeft,
  SFFolderFill,
  SFXmark
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

  // Fetch folders and stats on mount
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
        search: search.trim() || undefined,
      }).catch(() => ({ data: { data: [] } }));
      const poList = Array.isArray(res?.data?.data) ? res.data.data : [];
      setPos(poList);
    } catch (err) {
      console.warn('Notice fetching PO list:', err);
      setPos([]);
    } finally {
      setLoading(false);
    }
  }, [activeFolderId, activeStatus, search, setLoading, setPos]);

  useEffect(() => {
    fetchFoldersAndStats();
  }, [fetchFoldersAndStats]);

  useEffect(() => {
    fetchPOs();
  }, [fetchPOs]);

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
        <div className="px-5 py-3 border-b border-black/[0.06] dark:border-white/[0.08] bg-white/70 dark:bg-[#16161c]/70 backdrop-blur-2xl flex flex-wrap items-center justify-between gap-3 shrink-0 z-10 shadow-2xs">
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
              <h1 className="text-[18px] sm:text-[20px] font-bold text-slate-900 dark:text-white flex items-center gap-2 truncate tracking-tight">
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
              <p className="text-[12.5px] font-semibold text-slate-700 dark:text-zinc-200 truncate mt-0.5 tracking-normal">
                Tải file PO (PDF hoặc ảnh scan/chụp), tự động đọc dữ liệu và quản lý tiến độ giao nhận
              </p>
            </div>
          </div>

          {/* Actions & Search */}
          <div className="flex items-center gap-2.5 shrink-0">
            {/* Search Input - Apple Spotlight Style */}
            <div className="relative flex items-center">
              <div className="absolute left-3 text-[#0088FF] dark:text-[#0091FF] pointer-events-none flex items-center justify-center">
                <SFMagnifyingglass size={13} />
              </div>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm số PO, NCC, kho..."
                className="w-48 sm:w-64 h-9 pl-8 pr-7 rounded-full bg-white dark:bg-[#1a1a1e] border border-black/15 dark:border-white/15 text-[12.5px] font-medium text-slate-900 dark:text-white placeholder-[#86868b] focus:outline-none focus:ring-2 focus:ring-[#0088FF]/30 transition-all shadow-2xs"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 text-xs text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-white cursor-pointer"
                >
                  <SFXmark size={11} />
                </button>
              )}
            </div>

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
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Stats Summary Bar */}
          <POStatsBar
            stats={stats}
            loading={loading && !stats}
            activeStatus={activeStatus}
            onStatusFilter={(st) => setActiveStatus(st)}
          />

          {/* Active Filter Chips */}
          {(activeStatus || activeFolderId || search) && (
            <div className="flex items-center gap-2 flex-wrap text-[12px] p-2 px-3 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.05] dark:border-white/[0.05]">
              <span className="text-[#86868b] font-medium">Bộ lọc:</span>
              {activeStatus && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 font-semibold text-[11px]">
                  Trạng thái: {activeStatus}
                  <button onClick={() => setActiveStatus(null)} className="hover:opacity-75 cursor-pointer">✕</button>
                </span>
              )}
              {activeFolderId && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 font-semibold text-[11px]">
                  Nhóm: {currentFolder?.name || 'Chưa phân nhóm'}
                  <button onClick={() => setActiveFolderId(null)} className="hover:opacity-75 cursor-pointer">✕</button>
                </span>
              )}
              {search && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-semibold text-[11px]">
                  Từ khóa: "{search}"
                  <button onClick={() => setSearch('')} className="hover:opacity-75 cursor-pointer">✕</button>
                </span>
              )}
              <button
                onClick={() => {
                  setActiveStatus(null);
                  setActiveFolderId(null);
                  setSearch('');
                }}
                className="text-[#0088FF] hover:underline font-semibold text-[11.5px] cursor-pointer ml-auto"
              >
                Xóa bộ lọc
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
