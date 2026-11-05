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
  SFListBullet
} from 'sf-symbols-lib';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { POFolderDrawer } from './POFolderDrawer';

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
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const handleDelete = async (folder: POFolderItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Xóa nhóm "${folder.name}"? Các PO trong nhóm sẽ được giữ lại.`)) return;
    setDeletingId(folder.id);
    try {
      await poTrackerService.deleteFolder(folder.id);
      removeFolderFromList(folder.id);
      toast.success('Đã xóa nhóm.');
    } catch {
      toast.error('Không thể xóa nhóm này.');
    } finally {
      setDeletingId(null);
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
    ? (stats.actually_overdue || 0) + (stats.overdue || 0)
    : 0;

  const safeFolders = Array.isArray(folders) ? folders : [];

  return (
    <>
      <aside
        className={cn(
          'flex flex-col h-full bg-white/60 dark:bg-[#16161c]/60 backdrop-blur-2xl border-r border-black/[0.08] dark:border-white/10 transition-[width] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] shrink-0 z-10',
          collapsed ? 'w-[68px]' : 'w-[230px]'
        )}
      >
        {/* Header */}
        {!collapsed && (
          <div className="px-4 pt-4 pb-2 shrink-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#1d1d1f] dark:text-white">
              Nhóm PO
            </span>
          </div>
        )}

        {/* Navigation list */}
        <nav className="flex-1 overflow-y-auto px-2 py-1 space-y-1 scrollbar-none">
          {/* "Tất cả" */}
          <button
            onClick={() => handleSelect(null)}
            className={cn(
              'w-full flex items-center gap-2.5 px-3 h-10 rounded-xl text-[13px] font-semibold transition-all duration-150 cursor-pointer active:scale-[0.98] text-left select-none',
              activeFolderId === null
                ? 'bg-[#007AFF]/12 dark:bg-[#0A84FF]/20 text-[#007AFF] dark:text-[#0A84FF]'
                : 'text-[#1d1d1f] dark:text-[#f5f5f7] hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
            )}
          >
            <SFShippingbox size={16} className={cn('shrink-0', activeFolderId === null ? 'text-[#007AFF] dark:text-[#0A84FF]' : 'text-[#76767b] dark:text-[#8e8e93]')} />
            {!collapsed && (
              <>
                <span className="flex-1 truncate">Tất cả đơn PO</span>
                {stats && (
                  <span
                    className={cn(
                      'text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center tabular-nums',
                      activeFolderId === null
                        ? 'bg-[#007AFF]/20 text-[#007AFF] dark:text-[#0A84FF]'
                        : 'bg-black/[0.06] dark:bg-white/[0.08] text-[#555558] dark:text-[#a1a1a6]'
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
                'w-full flex items-center gap-2.5 px-3 h-10 rounded-xl text-[13px] font-semibold transition-all duration-150 cursor-pointer active:scale-[0.98] text-left select-none',
                activeStatus === 'overdue'
                  ? 'bg-red-50 dark:bg-red-500/20 text-red-600 dark:text-red-400 ring-1.5 ring-red-400/40 shadow-2xs font-bold'
                  : 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10'
              )}
            >
              <SFExclamationmarkTriangleFill size={16} className="shrink-0 text-red-500 animate-pulse" />
              {!collapsed && (
                <>
                  <span className="flex-1 truncate">Quá hạn</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 dark:bg-red-500/15 text-red-600 dark:text-red-400 min-w-[20px] text-center tabular-nums">
                    {totalOverdue}
                  </span>
                </>
              )}
            </button>
          )}

          {/* Divider */}
          {!collapsed && safeFolders.length > 0 && (
            <div className="h-px bg-black/[0.06] dark:border-white/10 mx-2 my-1.5" />
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
                    'w-full flex items-center gap-2.5 px-3 h-10 rounded-xl text-[13px] font-semibold transition-all duration-150 cursor-pointer active:scale-[0.98] text-left select-none',
                    isActive
                      ? `${cfg.bg} ${cfg.text} ring-1.5 ${cfg.ring} shadow-2xs`
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
                          'text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center tabular-nums',
                          isActive ? `${cfg.bg} ${cfg.text}` : 'bg-black/[0.06] dark:bg-white/[0.08] text-[#555558] dark:text-[#a1a1a6]'
                        )}
                      >
                        {folder.po_count ?? 0}
                      </span>
                    </>
                  )}
                </button>

                {/* Quick actions (edit/delete) on hover */}
                {!collapsed && isHovered && (
                  <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex gap-1 po-status-enter bg-white dark:bg-zinc-800 p-0.5 rounded-lg shadow-xs border border-black/10 dark:border-white/10">
                    <button
                      onClick={(e) => handleEdit(folder, e)}
                      className="w-6 h-6 rounded-md flex items-center justify-center text-[#555558] dark:text-[#a1a1a6] hover:bg-black/[0.08] dark:hover:bg-white/[0.1] hover:text-[#1d1d1f] dark:hover:text-white transition-colors cursor-pointer"
                      title="Chỉnh sửa nhóm"
                    >
                      <SFPencil size={11} />
                    </button>
                    <button
                      onClick={(e) => handleDelete(folder, e)}
                      disabled={deletingId === folder.id}
                      className="w-6 h-6 rounded-md flex items-center justify-center text-[#555558] dark:text-[#a1a1a6] hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400 transition-colors cursor-pointer disabled:opacity-40"
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
          {!collapsed && (
            <button
              onClick={() => handleSelect('unassigned')}
              className={cn(
                'w-full flex items-center gap-2.5 px-3 h-9 rounded-xl text-[12.5px] transition-all duration-150 cursor-pointer active:scale-[0.98] text-left select-none',
                activeFolderId === 'unassigned'
                  ? 'bg-[#007AFF]/12 dark:bg-[#0A84FF]/20 text-[#007AFF] dark:text-[#0A84FF] font-semibold'
                  : 'text-[#555558] dark:text-[#a1a1a6] hover:bg-black/[0.04] dark:hover:bg-white/[0.06] font-medium'
              )}
            >
              <span className={cn('w-2 h-2 rounded-full shrink-0', activeFolderId === 'unassigned' ? 'bg-[#007AFF] dark:bg-[#0A84FF]' : 'bg-zinc-400 dark:bg-zinc-600')} />
              <span className="flex-1 truncate">Chưa phân nhóm</span>
            </button>
          )}
        </nav>

        {/* Add Folder Button */}
        <div className="p-2.5 border-t border-black/[0.08] dark:border-white/10 shrink-0">
          <button
            onClick={() => { setEditingFolder(null); setFolderDrawerOpen(true); }}
            className={cn(
              'w-full flex items-center gap-2 px-3 h-10 rounded-xl text-[12.5px] font-semibold text-[#0088FF] dark:text-[#0091FF] hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors cursor-pointer active:scale-[0.98]',
              collapsed && 'justify-center px-0'
            )}
            title={collapsed ? 'Thêm nhóm' : undefined}
          >
            <SFPlus size={14} className="shrink-0" />
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
    </>
  );
};
