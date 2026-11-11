import React, { useState } from 'react';
import { POFolderItem, FOLDER_COLOR_CONFIG } from '@/types/po-tracker';
import { usePOTrackerStore } from '@/stores/po-tracker-store';
import { poTrackerService } from '@/services/poTrackerService';
import {
  SFFolderFill,
  SFPlus,
  SFExclamationmarkTriangleFill,
  SFPencil,
  SFTrash,
  SFShippingbox,
  SFArchiveboxFill
} from 'sf-symbols-lib';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { POFolderDrawer } from './POFolderDrawer';
import { ConfirmDeleteDialog } from '@/components/ui/ConfirmDeleteDialog';

interface POFolderSidebarProps {
  onSelectFolder: (id: string | null) => void;
  collapsed?: boolean;
}

export const POFolderSidebar: React.FC<POFolderSidebarProps> = ({
  onSelectFolder,
  collapsed = false,
}) => {
  const {
    folders,
    activeFolderId,
    setActiveFolderId,
    activeStatus,
    setActiveStatus,
    stats,
    removeFolderFromList,
  } = usePOTrackerStore();
  const [folderDrawerOpen, setFolderDrawerOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<POFolderItem | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [folderToDelete, setFolderToDelete] = useState<POFolderItem | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const handleDelete = (folder: POFolderItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setFolderToDelete(folder);
  };

  const executeDeleteFolder = async () => {
    if (!folderToDelete) return;
    setDeletingId(folderToDelete.id);
    try {
      await poTrackerService.deleteFolder(folderToDelete.id);
      removeFolderFromList(folderToDelete.id);
      toast.success('Đã xóa nhóm thành công.');
    } catch {
      toast.error('Không thể xóa nhóm này.');
    } finally {
      setDeletingId(null);
      setFolderToDelete(null);
    }
  };

  const handleEdit = (folder: POFolderItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingFolder(folder);
    setFolderDrawerOpen(true);
  };

  const handleSelect = (id: string | null) => {
    setActiveFolderId(id);
    setActiveStatus(null);
    onSelectFolder(id);
  };

  const totalOverdue = stats
    ? (stats.overdue ?? stats.actually_overdue ?? 0)
    : 0;

  const safeFolders = Array.isArray(folders) ? folders : [];

  const unassignedCount = stats
    ? Math.max(0, (stats.total || 0) - safeFolders.reduce((sum, f) => sum + (f.po_count || 0), 0))
    : 0;

  return (
    <>
      <aside
        className={cn(
          'flex flex-col h-full glass-material border-r border-black/5 dark:border-white/10 transition-[width] duration-200 ease-spring shrink-0 z-10',
          collapsed ? 'w-[68px]' : 'w-[230px]'
        )}
      >
        {/* Header */}
        {!collapsed && (
          <div className="px-4 pt-4 pb-2.5 shrink-0 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#86868b] dark:text-[#a1a1a6]">
              Nhóm đơn PO
            </span>
          </div>
        )}

        {/* Navigation list */}
        <nav className="flex-1 overflow-y-auto px-2 py-1.5 space-y-1 scrollbar-none">
          {/* "Tất cả" */}
          <button
            onClick={() => handleSelect(null)}
            className={cn(
              'w-full flex items-center gap-2.5 px-3 h-10 rounded-xl text-[13px] font-medium transition-all duration-150 cursor-pointer active:scale-[0.98] text-left select-none',
              activeFolderId === null
                ? 'bg-[#0066cc]/10 dark:bg-[#0066cc]/20 text-[#0066cc] dark:text-[#2997ff] font-semibold border border-[#0066cc]/20 shadow-2xs'
                : 'text-[#1d1d1f] dark:text-[#f5f5f7] hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
            )}
            title={collapsed ? 'Tất cả đơn PO' : undefined}
          >
            <SFShippingbox size={16} className={cn('shrink-0', activeFolderId === null ? 'text-[#0066cc] dark:text-[#2997ff]' : 'text-[#76767b] dark:text-[#8e8e93]')} />
            {!collapsed && (
              <>
                <span className="flex-1 truncate">Tất cả đơn PO</span>
                {stats && (
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums min-w-[20px] text-center transition-colors',
                      activeFolderId === null
                        ? 'bg-[#0066cc]/15 text-[#0066cc] dark:text-[#2997ff]'
                        : 'bg-black/5 dark:bg-white/10 text-[#86868b] dark:text-[#a1a1a6]'
                    )}
                  >
                    {stats.total}
                  </span>
                )}
              </>
            )}
          </button>

          {/* Overdue quick-filter */}
          {totalOverdue > 0 && (
            <button
              onClick={() => {
                setActiveStatus(activeStatus === 'overdue' ? null : 'overdue');
              }}
              className={cn(
                'w-full flex items-center gap-2.5 px-3 h-10 rounded-xl text-[13px] font-medium transition-all duration-150 cursor-pointer active:scale-[0.98] text-left select-none',
                activeStatus === 'overdue'
                  ? 'bg-rose-500/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 font-semibold border border-rose-500/30 shadow-2xs'
                  : 'text-rose-600 dark:text-rose-400 hover:bg-rose-500/10'
              )}
              title={collapsed ? `Quá hạn (${totalOverdue})` : undefined}
            >
              <SFExclamationmarkTriangleFill size={16} className="shrink-0 text-rose-500 animate-pulse" />
              {!collapsed && (
                <>
                  <span className="flex-1 truncate font-medium">Quá hạn</span>
                  <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums min-w-[20px] text-center bg-rose-500/15 text-rose-600 dark:text-rose-400">
                    {totalOverdue}
                  </span>
                </>
              )}
            </button>
          )}

          {/* Divider */}
          {!collapsed && safeFolders.length > 0 && (
            <div className="h-px bg-black/[0.06] dark:bg-white/[0.08] mx-2 my-1.5" />
          )}

          {/* Folder list */}
          {safeFolders.map((folder) => {
            const cfg = FOLDER_COLOR_CONFIG[folder.color || 'blue'] || FOLDER_COLOR_CONFIG.blue;
            const isActive = activeFolderId === folder.id;
            const isHovered = hoveredId === folder.id;

            return (
              <div
                key={folder.id}
                className="relative group"
                onMouseEnter={() => setHoveredId(folder.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                <button
                  onClick={() => handleSelect(folder.id)}
                  className={cn(
                    'w-full flex items-center gap-2.5 px-3 h-10 rounded-xl text-[13px] font-medium transition-all duration-150 cursor-pointer active:scale-[0.98] text-left select-none',
                    isActive
                      ? `${cfg.bg} ${cfg.text} font-semibold ring-1.5 ${cfg.ring} shadow-2xs`
                      : 'text-[#1d1d1f] dark:text-[#f5f5f7] hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
                  )}
                  title={collapsed ? folder.name : undefined}
                >
                  <SFFolderFill size={16} className={cn('shrink-0', isActive ? 'opacity-100' : 'text-[#76767b] dark:text-[#8e8e93]')} />
                  {!collapsed && (
                    <>
                      <span className="flex-1 truncate">{folder.name}</span>
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums min-w-[20px] text-center transition-colors',
                          isActive ? `${cfg.bg} ${cfg.text}` : 'bg-black/5 dark:bg-white/10 text-[#86868b] dark:text-[#a1a1a6]'
                        )}
                      >
                        {folder.po_count ?? 0}
                      </span>
                    </>
                  )}
                </button>

                {/* Quick actions (edit/delete) on hover */}
                {!collapsed && isHovered && (
                  <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex gap-1 po-status-enter glass-material p-0.5 rounded-lg shadow-xs border border-black/5 dark:border-white/10">
                    <button
                      onClick={(e) => handleEdit(folder, e)}
                      className="w-6 h-6 rounded-md flex items-center justify-center text-[#555558] dark:text-[#a1a1a6] hover:bg-black/5 dark:hover:bg-white/10 hover:text-[#0066cc] dark:hover:text-[#2997ff] transition-colors cursor-pointer"
                      title="Chỉnh sửa nhóm"
                    >
                      <SFPencil size={11} />
                    </button>
                    <button
                      onClick={(e) => handleDelete(folder, e)}
                      disabled={deletingId === folder.id}
                      className="w-6 h-6 rounded-md flex items-center justify-center text-[#555558] dark:text-[#a1a1a6] hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer disabled:opacity-40"
                      title="Xóa nhóm"
                    >
                      <SFTrash size={11} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          {/* Unassigned */}
          <button
            onClick={() => handleSelect('unassigned')}
            className={cn(
              'w-full flex items-center gap-2.5 px-3 h-9 rounded-xl text-[12.5px] transition-all duration-150 cursor-pointer active:scale-[0.98] text-left select-none',
              collapsed && 'justify-center px-0',
              activeFolderId === 'unassigned'
                ? 'bg-[#0066cc]/10 dark:bg-[#0066cc]/20 text-[#0066cc] dark:text-[#2997ff] font-semibold border border-[#0066cc]/20 shadow-2xs'
                : 'text-[#86868b] dark:text-[#a1a1a6] hover:bg-black/[0.04] dark:hover:bg-white/[0.06] font-medium'
            )}
            title={collapsed ? `Chưa phân nhóm (${unassignedCount})` : undefined}
          >
            <SFArchiveboxFill size={14} className={cn('shrink-0', activeFolderId === 'unassigned' ? 'text-[#0066cc] dark:text-[#2997ff]' : 'text-zinc-400 dark:text-zinc-500')} />
            {!collapsed && (
              <>
                <span className="flex-1 truncate">Chưa phân nhóm</span>
                {stats && (
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums min-w-[20px] text-center transition-colors',
                      activeFolderId === 'unassigned'
                        ? 'bg-[#0066cc]/15 text-[#0066cc] dark:text-[#2997ff]'
                        : 'bg-black/5 dark:bg-white/10 text-[#86868b] dark:text-[#a1a1a6]'
                    )}
                  >
                    {unassignedCount}
                  </span>
                )}
              </>
            )}
          </button>
        </nav>

        {/* Add Folder Button */}
        <div className="p-2.5 border-t border-black/5 dark:border-white/10 shrink-0">
          <button
            onClick={() => { setEditingFolder(null); setFolderDrawerOpen(true); }}
            className={cn(
              'w-full flex items-center gap-2 px-3 h-10 rounded-xl text-[13px] font-medium text-[#0066cc] dark:text-[#2997ff] glass-material hover:bg-white/80 dark:hover:bg-white/10 border border-black/5 dark:border-white/10 transition-all cursor-pointer active:scale-[0.98] shadow-2xs',
              collapsed && 'justify-center px-0'
            )}
            title={collapsed ? 'Thêm nhóm' : undefined}
          >
            <SFPlus size={14} className="shrink-0 text-[#0066cc] dark:text-[#2997ff]" />
            {!collapsed && <span>Thêm nhóm</span>}
          </button>
        </div>
      </aside>

      {/* Folder drawer */}
      <POFolderDrawer
        isOpen={folderDrawerOpen}
        onClose={() => { setFolderDrawerOpen(false); setEditingFolder(null); }}
        editingFolder={editingFolder}
      />

      {/* Confirm Delete Folder Dialog */}
      <ConfirmDeleteDialog
        isOpen={Boolean(folderToDelete)}
        title="Xóa nhóm PO?"
        itemLabel={folderToDelete?.name}
        message="Bạn có chắc chắn muốn xóa nhóm này? Toàn bộ đơn hàng PO trong nhóm sẽ được chuyển sang mục 'Chưa phân nhóm' và không bị mất dữ liệu."
        confirmText="Xác nhận xóa nhóm"
        cancelText="Hủy bỏ"
        onConfirm={executeDeleteFolder}
        onClose={() => setFolderToDelete(null)}
      />
    </>
  );
};
