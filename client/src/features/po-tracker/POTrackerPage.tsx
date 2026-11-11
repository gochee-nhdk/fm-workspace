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
  SFArrowDownDocumentFill,
  SFTablecells
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

  // Export PO list to 2-sheet Excel file (.xlsx)
  const [exportingExcel, setExportingExcel] = useState(false);

  const handleExportExcel = async () => {
    if (!pos || pos.length === 0) {
      toast.error('Không có dữ liệu PO để xuất báo cáo.');
      return;
    }

    setExportingExcel(true);
    toast.loading('Đang chuẩn bị file Excel 2 sheets...', { id: 'export-excel-toast' });
    try {
      const XLSX = await import('xlsx');

      // 1. Sheet 1: Tổng hợp PO
      const summaryRows = pos.map((p, idx) => {
        const ordered = Number(p.total_ordered_qty) || p.items?.reduce((s: number, it: any) => s + (it.ordered_qty || 0), 0) || 0;
        const received = Number(p.total_received_qty) || p.items?.reduce((s: number, it: any) => s + (it.received_qty || 0), 0) || 0;
        const progressStr = ordered > 0
          ? `${Math.min(100, Math.round((received / ordered) * 100))}% (${received}/${ordered})`
          : (p.status === 'received' ? '100%' : '0%');

        return {
          'STT': idx + 1,
          'Số PO': p.po_number || '',
          'Nhà cung cấp': p.supplier_name || '',
          'Mã NCC': p.supplier_code || '',
          'Kho tiếp nhận': p.warehouse || '',
          'Thư mục': p.folder_name || 'Chưa phân nhóm',
          'Ngày lập PO': p.po_date || '',
          'Hạn giao dự kiến': p.expected_delivery_date || '',
          'Ngày giao thực tế': p.actual_delivery_date || '',
          'Tổng giá trị đơn (VNĐ)': Number(p.total_value) || 0,
          'Trạng thái': PO_STATUS_CONFIG_MAP[p.status]?.label || p.status,
          'Tiến độ nhận hàng': progressStr,
          'Ghi chú': p.notes || '',
        };
      });

      // 2. Sheet 2: Chi tiết dòng hàng PO
      const posWithItems = await Promise.all(
        pos.map(async (p) => {
          if (p.items && p.items.length > 0) return p;
          try {
            const res = await poTrackerService.getPO(p.id);
            const detail = (res as any)?.data?.data || (res as any)?.data || res;
            if (detail?.items) {
              return { ...p, items: detail.items };
            }
          } catch (_) {}
          return p;
        })
      );

      const itemRows: any[] = [];
      let itemStt = 1;

      posWithItems.forEach((p) => {
        if (p.items && p.items.length > 0) {
          p.items.forEach((it: any) => {
            const ordered = Number(it.ordered_qty || 0);
            const received = Number(it.received_qty || 0);
            const unitPrice = Number(it.unit_price || 0);
            const lineTotal = Number(it.total_price || (ordered * unitPrice));
            const lineStatus = received >= ordered && ordered > 0
              ? 'Đã nhận đủ'
              : received > 0
              ? 'Nhận một phần'
              : 'Chưa nhận';

            itemRows.push({
              'STT': itemStt++,
              'Số PO': p.po_number || '',
              'Nhà cung cấp': p.supplier_name || '',
              'Mã hàng': it.item_code || '',
              'Tên mặt hàng': it.item_name || '',
              'ĐVT': it.unit || '',
              'Số lượng đặt': ordered,
              'Số lượng đã nhận': received,
              'Đơn giá (VNĐ)': unitPrice,
              'Thành tiền (VNĐ)': lineTotal,
              'Kho nhận': it.warehouse || p.warehouse || '',
              'Trạng thái dòng hàng': lineStatus,
            });
          });
        }
      });

      const wb = XLSX.utils.book_new();

      const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Tổng hợp PO');

      const wsItems = XLSX.utils.json_to_sheet(
        itemRows.length > 0
          ? itemRows
          : [{ 'Thông báo': 'Chưa có dữ liệu dòng hàng chi tiết' }]
      );
      XLSX.utils.book_append_sheet(wb, wsItems, 'Chi tiết dòng hàng PO');

      const dateStr = new Date().toISOString().split('T')[0];
      XLSX.writeFile(wb, `Bao_Cao_PO_Tracker_${dateStr}.xlsx`);
      toast.success(`Đã xuất Excel PO thành công (${pos.length} đơn, ${itemRows.length} mặt hàng)!`, { id: 'export-excel-toast' });
    } catch (err: any) {
      console.error('Export Excel PO error:', err);
      toast.error('Lỗi khi xuất file Excel PO.', { id: 'export-excel-toast' });
    } finally {
      setExportingExcel(false);
    }
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
        {/* Top Control Bar with Apple Liquid Glass Style */}
        <div className="px-4 sm:px-6 py-3 border-b border-black/5 dark:border-white/10 glass-material flex flex-wrap items-center justify-between gap-3 shrink-0 z-10 shadow-xs">
          {/* Title & Folder Breadcrumb */}
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="w-9 h-9 rounded-full glass-material border border-black/5 dark:border-white/10 flex items-center justify-center text-[#555558] dark:text-[#a1a1a6] hover:text-[#0066cc] dark:hover:text-[#2997ff] hover:bg-black/5 dark:hover:bg-white/10 active:scale-95 transition-all cursor-pointer shrink-0 shadow-2xs"
              title={sidebarCollapsed ? 'Mở rộng thanh nhóm' : 'Thu gọn thanh nhóm'}
            >
              <SFSidebarLeft size={16} className={cn('transition-transform duration-200', sidebarCollapsed && 'rotate-180')} />
            </button>
            <div className="truncate">
              <h1 className="text-[17px] sm:text-[19px] font-bold text-[#1d1d1f] dark:text-white flex items-center gap-2 truncate tracking-tight">
                <span>Theo dõi đơn hàng (PO Tracker)</span>
                {currentFolder && (
                  <span className="text-[12px] font-semibold px-2.5 py-0.5 rounded-full bg-[#0066cc]/10 dark:bg-[#0066cc]/20 text-[#0066cc] dark:text-[#2997ff] border border-[#0066cc]/20 flex items-center gap-1 shadow-2xs">
                    <SFFolderFill size={11} />
                    <span>{currentFolder.name}</span>
                  </span>
                )}
                {activeFolderId === 'unassigned' && (
                  <span className="text-[11.5px] font-semibold px-2.5 py-0.5 rounded-full bg-black/5 dark:bg-white/10 text-[#555558] dark:text-[#a1a1a6] border border-black/5 dark:border-white/10">
                    Chưa phân nhóm
                  </span>
                )}
              </h1>
              <p className="text-[12px] font-normal text-[#86868b] dark:text-[#a1a1a6] truncate mt-0.5">
                Tự động nhận diện dữ liệu PO từ file PDF / ảnh scan và giám sát tiến độ giao nhận kho
              </p>
            </div>
          </div>

          {/* Unified Apple Liquid Glass Actions & Search Toolbar */}
          <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
            {/* Search Input - Apple Spotlight Style with shortcut tooltip & full text visibility */}
            <div className="relative w-56 sm:w-72 lg:w-80 group">
              <SFMagnifyingglass
                size={15}
                className="text-[#76767b] dark:text-[#a1a1a6] group-focus-within:text-[#0066cc] dark:group-focus-within:text-[#2997ff] absolute left-3.5 top-3 pointer-events-none transition-colors"
              />
              <input
                ref={searchInputRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm số PO, NCC, kho... (Nhấn /)"
                className="glass-input w-full h-[38px] text-[13px] rounded-full pl-9 pr-8 placeholder:text-[#86868b] dark:placeholder:text-[#6e6e73]"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-2.5 text-xs text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-white cursor-pointer"
                  title="Xóa từ khóa"
                >
                  <SFXmark size={12} />
                </button>
              )}
            </div>

            {/* Refresh Button */}
            <Button
              variant="liquiGlass"
              size="sm"
              className="h-[38px] w-[38px] p-0 rounded-full text-[#555558] dark:text-[#a1a1a6] hover:text-[#0066cc] dark:hover:text-[#2997ff]"
              onClick={handleRefresh}
              disabled={refreshing}
              title="Làm mới danh sách PO"
              icon={<SFArrowClockwise size={14} className={cn(refreshing && 'animate-spin text-[#0066cc] dark:text-[#2997ff]')} />}
            />

            {/* Export Excel PO (.xlsx) with 2 sheets */}
            <Button
              variant="liquiGlass"
              size="sm"
              className="h-[38px] px-3.5 sm:px-4 rounded-full text-[13px] leading-none font-medium text-[#1d1d1f] dark:text-[#f5f5f7]"
              onClick={handleExportExcel}
              disabled={exportingExcel}
              icon={<SFTablecells size={14} className="text-emerald-600 dark:text-emerald-400" />}
              title="Xuất file Excel gồm 2 sheets: Tổng hợp PO & Chi tiết dòng hàng PO"
            >
              <span className="hidden sm:inline">Xuất Excel</span>
              <span className="sm:hidden">Excel</span>
            </Button>

            {/* Export CSV Button */}
            <Button
              variant="liquiGlass"
              size="sm"
              className="h-[38px] px-3.5 sm:px-4 rounded-full text-[13px] leading-none font-medium text-[#1d1d1f] dark:text-[#f5f5f7]"
              onClick={handleExportCSV}
              icon={<SFArrowDownDocumentFill size={14} className="text-[#0066cc] dark:text-[#2997ff]" />}
              title="Xuất bảng Excel / CSV"
            >
              <span className="hidden sm:inline">Xuất CSV</span>
              <span className="sm:hidden">CSV</span>
            </Button>

            {/* Primary Action Button: "Tải lên PO" */}
            <Button
              variant="primary"
              size="sm"
              onClick={() => setUploadDrawerOpen(true)}
              className="h-[38px] px-4 sm:px-5 rounded-full font-semibold text-[13px] leading-none shadow-sm flex items-center gap-1.5"
              icon={<SFArrowUpDocumentFill size={15} />}
              title="Tải lên hóa đơn / tệp PO mới"
            >
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
            <div className="flex items-center gap-2 flex-wrap text-[12px] p-2.5 px-4 rounded-[20px] glass-material border border-black/5 dark:border-white/10 shadow-xs animate-in fade-in slide-in-from-top-2 duration-300">
              <span className="text-[#86868b] dark:text-[#a1a1a6] font-semibold text-[12px] mr-1">Bộ lọc:</span>

              {activeStatus && (
                <span
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-semibold text-[12px] shadow-2xs border',
                    activeStatus === 'upcoming_7_days'
                      ? 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20'
                      : 'bg-[#0066cc]/10 text-[#0066cc] dark:text-[#2997ff] border-[#0066cc]/20'
                  )}
                >
                  <span className="text-[#86868b] dark:text-[#a1a1a6] font-normal text-[11px]">Trạng thái:</span>
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
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 font-semibold text-[12px] shadow-2xs">
                  <span className="text-[#86868b] dark:text-[#a1a1a6] font-normal text-[11px]">Nhóm:</span>
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
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/5 dark:bg-white/10 text-[#1d1d1f] dark:text-white border border-black/5 dark:border-white/10 font-semibold text-[12px] shadow-2xs">
                  <span className="text-[#86868b] dark:text-[#a1a1a6] font-normal text-[11px]">Từ khóa:</span>
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
                className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[12px] font-semibold text-[#0066cc] dark:text-[#2997ff] hover:bg-[#0066cc]/10 active:scale-95 transition-all cursor-pointer ml-auto"
              >
                <SFXmark size={11} />
                <span>Xóa tất cả</span>
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
