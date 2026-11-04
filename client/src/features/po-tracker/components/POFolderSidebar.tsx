import React, { useState } from 'react';
import { POFolderItem, FOLDER_COLOR_CONFIG } from '@/types/po-tracker';
import { usePOTrackerStore } from '@/stores/po-tracker-store';
import { poTrackerService } from '@/services/poTrackerService';
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
  const { folders, activeFolderId, setActiveFolderId, stats, removeFolderFromList } =
    usePOTrackerStore();
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
    onSelectFolder(id);
  };

  const totalOverdue = stats
    ? (stats.actually_overdue || 0) + (stats.overdue || 0)
    : 0;

  return (
    <>
      <aside
        className={cn(
          'flex flex-col h-full bg-white/30 dark:bg-[#18181c]/40 backdrop-blur-xl border-r border-black/[0.06] dark:border-white/[0.07] transition-[width] duration-[260ms] ease-[cubic-bezier(0.16,1,0.3,1)] shrink-0',
          collapsed ? 'w-[64px]' : 'w-[220px]'
        )}
      >
        {/* Header */}
        {!collapsed && (
          <div className="px-4 pt-4 pb-2 shrink-0">
            <p className="text-[11px] font-bold uppercase tracking-widest text-[#555558] dark:text-[#a1a1a6]">
              Nhóm PO
            </p>
          </div>
        )}

        {/* "Tất cả" item */}
        <nav className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5 scrollbar-none">
          <button
            onClick={() => handleSelect(null)}
            className={cn(
              'w-full flex items-center gap-2.5 px-2.5 h-9 rounded-xl text-[13px] font-medium transition-all duration-150 cursor-pointer active:scale-[0.98] text-left select-none',
              activeFolderId === null
                ? 'fm-primary-pill-surface text-white shadow-sm'
                : 'text-[#555558] dark:text-[#a1a1a6] hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
            )}
          >
            <span className={cn('shrink-0 text-base leading-none', activeFolderId === null ? 'opacity-100' : 'opacity-70')}>
              📋
            </span>
            {!collapsed && (
              <>
                <span className="flex-1 truncate">Tất cả</span>
                {stats && (
                  <span
                    className={cn(
                      'text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center tabular-nums',
                      activeFolderId === null
                        ? 'bg-white/20 text-white'
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
                setActiveFolderId(null);
                onSelectFolder(null);
              }}
              className={cn(
                'w-full flex items-center gap-2.5 px-2.5 h-9 rounded-xl text-[13px] font-medium transition-all duration-150 cursor-pointer active:scale-[0.98] text-left select-none',
                'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10'
              )}
            >
              <span className="shrink-0 text-base leading-none animate-pulse">⚠️</span>
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
          {!collapsed && folders.length > 0 && (
            <div className="h-px bg-black/[0.05] dark:bg-white/[0.06] mx-2 my-1" />
          )}

          {/* Folder list */}
          {folders.map((folder) => {
            const cfg = FOLDER_COLOR_CONFIG[folder.color || 'blue'];
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
                    'w-full flex items-center gap-2.5 px-2.5 h-9 rounded-xl text-[13px] font-medium transition-all duration-150 cursor-pointer active:scale-[0.98] text-left select-none',
                    isActive
                      ? `${cfg.bg} ${cfg.text} ring-1 ${cfg.ring}`
                      : 'text-[#555558] dark:text-[#a1a1a6] hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
                  )}
                  title={collapsed ? folder.name : undefined}
                >
                  <span className={cn('w-2.5 h-2.5 rounded-full shrink-0', cfg.dot)} />
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
                  <div className="absolute right-1 top-1/2 -translate-y-1/2 flex gap-0.5 po-status-enter">
                    <button
                      onClick={(e) => handleEdit(folder, e)}
                      className="w-6 h-6 rounded-lg flex items-center justify-center text-[#555558] dark:text-[#a1a1a6] hover:bg-black/[0.08] dark:hover:bg-white/[0.1] hover:text-[#1d1d1f] dark:hover:text-white transition-colors cursor-pointer"
                      title="Chỉnh sửa nhóm"
                    >
                      <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M8.5 1.5l2 2L4 10 1 11l1-3 6.5-6.5z" />
                      </svg>
                    </button>
                    <button
                      onClick={(e) => handleDelete(folder, e)}
                      disabled={deletingId === folder.id}
                      className="w-6 h-6 rounded-lg flex items-center justify-center text-[#555558] dark:text-[#a1a1a6] hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400 transition-colors cursor-pointer disabled:opacity-40"
                      title="Xóa nhóm"
                    >
                      <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                        <polyline points="1 3 11 3" /><path d="M4 3V2h4v1" /><path d="M2 3l1 8h6l1-8" />
                      </svg>
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
                'w-full flex items-center gap-2.5 px-2.5 h-9 rounded-xl text-[13px] font-medium transition-all duration-150 cursor-pointer active:scale-[0.98] text-left select-none',
                activeFolderId === 'unassigned'
                  ? 'fm-primary-pill-surface text-white shadow-sm'
                  : 'text-[#555558] dark:text-[#a1a1a6] hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
              )}
            >
              <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-zinc-300 dark:bg-zinc-600" />
              <span className="flex-1 truncate text-[12px]">Chưa phân nhóm</span>
            </button>
          )}
        </nav>

        {/* Add Folder Button */}
        <div className="p-2 border-t border-black/[0.06] dark:border-white/[0.07] shrink-0">
          <button
            onClick={() => { setEditingFolder(null); setFolderDrawerOpen(true); }}
            className={cn(
              'w-full flex items-center gap-2 px-2.5 h-9 rounded-xl text-[12px] font-medium text-[#0088FF] dark:text-[#0091FF] hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors cursor-pointer active:scale-[0.98]',
              collapsed && 'justify-center px-0'
            )}
            title={collapsed ? 'Thêm nhóm' : undefined}
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="6.5" y1="1" x2="6.5" y2="12" /><line x1="1" y1="6.5" x2="12" y2="6.5" />
            </svg>
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
