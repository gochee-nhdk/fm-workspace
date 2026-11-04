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
    <div className="flex -m-4 sm:-m-5 lg:-m-6 h-[calc(100vh-3.75rem)] overflow-hidden select-none">
      {/* Left Folders Sidebar */}
      <POFolderSidebar
        onSelectFolder={(id) => setActiveFolderId(id)}
        collapsed={sidebarCollapsed}
      />

      {/* Main Tracking Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-transparent">
        {/* Top Control Bar */}
        <div className="px-5 py-3.5 border-b border-black/[0.06] dark:border-white/[0.06] bg-white/40 dark:bg-[#121216]/40 backdrop-blur-md flex flex-wrap items-center justify-between gap-3 shrink-0">
          {/* Title & Folder Breadcrumb */}
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="p-1.5 rounded-lg text-[#555558] dark:text-[#a1a1a6] hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
              title={sidebarCollapsed ? 'Mở rộng sidebar' : 'Thu gọn sidebar'}
            >
              📑
            </button>
            <div className="truncate">
              <h1 className="text-[16px] font-bold text-[#1d1d1f] dark:text-white flex items-center gap-2 truncate">
                <span>Theo dõi đơn hàng (PO Tracker)</span>
                {currentFolder && (
                  <span className="text-[12px] font-medium px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-200/50">
                    📁 {currentFolder.name}
                  </span>
                )}
                {activeFolderId === 'unassigned' && (
                  <span className="text-[12px] font-medium px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
                    Chưa phân nhóm
                  </span>
                )}
              </h1>
              <p className="text-[11px] text-[#76767b] dark:text-[#8e8e93] truncate">
                Tải file PDF hóa đơn PO, tự động đọc dữ liệu và quản lý tiến độ giao nhận
              </p>
            </div>
          </div>

          {/* Actions & Search */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Search Input */}
            <div className="relative">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm số PO, NCC, kho..."
                className="w-48 sm:w-60 h-9 pl-8 pr-3 rounded-full bg-white/80 dark:bg-white/[0.06] border border-black/10 dark:border-white/10 text-[12.5px] text-[#1d1d1f] dark:text-white placeholder-[#999] focus:outline-none focus:ring-2 focus:ring-[#0088FF]/30 transition-all"
              />
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[12px] text-[#999]">
                🔍
              </span>
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#999] hover:text-[#1d1d1f] dark:hover:text-white"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Upload PDF PO button */}
            <Button
              variant="primary"
              size="sm"
              onClick={() => setUploadDrawerOpen(true)}
              className="fm-primary-pill-surface shadow-xs text-white h-9 px-3.5 rounded-full font-semibold gap-1.5"
            >
              <span>📄</span>
              <span>Upload PDF / Tạo PO</span>
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
            <div className="flex items-center gap-2 flex-wrap text-[11px]">
              <span className="text-[#999] font-medium">Bộ lọc đang áp dụng:</span>
              {activeStatus && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                  Trạng thái: <b>{activeStatus}</b>
                  <button onClick={() => setActiveStatus(null)} className="hover:font-bold">✕</button>
                </span>
              )}
              {activeFolderId && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
                  Nhóm: <b>{currentFolder?.name || 'Chưa phân nhóm'}</b>
                  <button onClick={() => setActiveFolderId(null)} className="hover:font-bold">✕</button>
                </span>
              )}
              {search && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                  Từ khóa: <b>"{search}"</b>
                  <button onClick={() => setSearch('')} className="hover:font-bold">✕</button>
                </span>
              )}
              <button
                onClick={() => {
                  setActiveStatus(null);
                  setActiveFolderId(null);
                  setSearch('');
                }}
                className="text-[#0088FF] hover:underline cursor-pointer ml-1"
              >
                Xóa tất cả bộ lọc
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
        }}
      />
    </div>
  );
};
export default POTrackerPage;
