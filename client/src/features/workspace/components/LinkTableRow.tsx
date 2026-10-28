import React from 'react';
import {
  SFLine3Horizontal,
  SFStar,
  SFStarFill,
  SFArrowUpRightSquare,
  SFCheckmark,
  SFSquareOnSquare,
  SFPencil,
  SFTrash,
} from 'sf-symbols-lib';
import { LinkItem } from '@/types/workspace';
import { sanitizeUrl } from '@/lib/utils';

export interface LinkTableRowProps {
  item: LinkItem;
  isDragged: boolean;
  isDragOver: boolean;
  dropPosition: 'top' | 'bottom' | null;
  copiedKey: string | null;
  onDragStart: (id: string, e: React.DragEvent) => void;
  onDragOver: (id: string, e: React.DragEvent) => void;
  onDragLeave: (id: string, e: React.DragEvent) => void;
  onDrop: (id: string, e: React.DragEvent) => void;
  onDragEnd: () => void;
  onToggleFavorite: (id: string, e: React.MouseEvent) => void;
  onCopy: (text: string, label: string, key: string) => void;
  onEdit: (item: LinkItem) => void;
  onDelete: (item: LinkItem) => void;
}

export const LinkTableRow = React.memo<LinkTableRowProps>(({
  item,
  isDragged,
  isDragOver,
  dropPosition,
  copiedKey,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  onToggleFavorite,
  onCopy,
  onEdit,
  onDelete,
}) => {
  return (
    <tr
      draggable
      onDragStart={(e) => onDragStart(item.id, e)}
      onDragOver={(e) => onDragOver(item.id, e)}
      onDragLeave={(e) => onDragLeave(item.id, e)}
      onDrop={(e) => onDrop(item.id, e)}
      onDragEnd={onDragEnd}
      className={`content-auto transition-colors duration-150 group relative ${
        isDragged
          ? 'opacity-30 bg-[#0066cc]/5 dark:bg-[#2997ff]/5'
          : 'hover:bg-black/[0.025] dark:hover:bg-white/[0.04]'
      } ${
        isDragOver && !isDragged
          ? dropPosition === 'top'
            ? 'shadow-[inset_0_2px_0_#0066cc] dark:shadow-[inset_0_2px_0_#2997ff] bg-[#0066cc]/[0.04] dark:bg-[#2997ff]/[0.06]'
            : 'shadow-[inset_0_-2px_0_#0066cc] dark:shadow-[inset_0_-2px_0_#2997ff] bg-[#0066cc]/[0.04] dark:bg-[#2997ff]/[0.06]'
          : ''
      }`}
    >
      {/* Drag Handle */}
      <td className="w-9 pl-3 pr-1 py-3 text-center cursor-grab active:cursor-grabbing text-[#8e8e93] hover:text-[#0066cc] dark:hover:text-[#2997ff] transition-colors select-none">
        <div
          className="inline-flex items-center justify-center p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 active:scale-95 transition-transform duration-100"
          title="Kéo thả để sắp xếp thứ tự tùy ý"
        >
          <SFLine3Horizontal size={14} className="opacity-40 group-hover:opacity-100 transition-opacity duration-150" />
        </div>
      </td>

      {/* Star */}
      <td className="px-2 py-3 text-center">
        <button
          type="button"
          onClick={(e) => onToggleFavorite(item.id, e)}
          className="text-[#cccccc] hover:text-amber-500 transition-colors duration-150 cursor-pointer p-1"
          title={item.favorite ? 'Bỏ yêu thích' : 'Đánh dấu yêu thích'}
        >
          {item.favorite ? (
            <SFStarFill size={16} className="text-amber-500" />
          ) : (
            <SFStar size={16} className="text-[#cccccc] hover:text-amber-500" />
          )}
        </button>
      </td>

      {/* Hang Muc */}
      <td className="px-4 py-3 font-semibold text-[#1d1d1f] dark:text-white min-w-[140px] max-w-[220px]">
        <div className="flex items-center gap-2 truncate">
          <span className="w-2 h-2 rounded-full bg-[#0066cc] dark:bg-[#2997ff] shrink-0" />
          <span className="truncate" title={item.hangMuc}>{item.hangMuc}</span>
        </div>
      </td>

      {/* Link 1-Click Action */}
      <td className="px-3.5 py-3 min-w-[130px]">
        {sanitizeUrl(item.link) ? (
          <div className="flex items-center gap-1.5">
            <a
              href={sanitizeUrl(item.link)}
              target="_blank"
              rel="noopener noreferrer"
              className="group/link inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-semibold transition-colors duration-150 active:scale-[0.97] cursor-pointer bg-white/70 dark:bg-white/[0.08] hover:bg-white dark:hover:bg-white/[0.16] text-[#1d1d1f] dark:text-[#f5f5f7] hover:text-[#0071e3] dark:hover:text-[#2997ff] border border-black/[0.08] dark:border-white/12 shadow-[0_1px_3px_rgba(0,0,0,0.04),inset_0_1px_0.5px_rgba(255,255,255,0.9)] hover:shadow-[0_4px_14px_rgba(0,113,227,0.18)] backdrop-blur-md"
              title="Mở liên kết trong tab mới"
            >
              <span>Mở link</span>
              <span className="w-3.5 h-3.5 rounded-full bg-[#0071e3]/12 dark:bg-[#2997ff]/20 flex items-center justify-center text-[#0066cc] dark:text-[#2997ff] group-hover/link:bg-[#0071e3] group-hover/link:text-white transition-colors duration-150 shrink-0">
                <SFArrowUpRightSquare size={10} />
              </span>
            </a>
            <button
              type="button"
              onClick={() => onCopy(item.link, 'đường dẫn', `link-${item.id}`)}
              className="w-6 h-6 rounded-full flex items-center justify-center text-[#76767b] hover:text-[#0071e3] dark:hover:text-[#2997ff] hover:bg-black/5 dark:hover:bg-white/10 transition-colors duration-150 active:scale-95 cursor-pointer shrink-0"
              title="Sao chép link"
            >
              {copiedKey === `link-${item.id}` ? (
                <SFCheckmark size={14} className="text-[#34c759]" />
              ) : (
                <SFSquareOnSquare size={14} className="opacity-70 hover:opacity-100 transition-opacity duration-150" />
              )}
            </button>
          </div>
        ) : (
          <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
            Chưa có URL
          </span>
        )}
      </td>

      {/* Category */}
      <td className="px-3.5 py-3 min-w-[110px]">
        {item.category ? (
          <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-black/[0.04] dark:bg-white/[0.08] text-[#76767b] dark:text-[#a1a1a6] font-medium border border-black/5 dark:border-white/10 truncate inline-block max-w-[140px]" title={item.category}>
            {item.category}
          </span>
        ) : (
          <span className="text-xs text-[#a1a1a6] opacity-50">—</span>
        )}
      </td>

      {/* Note */}
      <td className="px-3.5 py-3 text-slate-500 dark:text-slate-400 min-w-[130px] max-w-[240px]">
        <span className="truncate block" title={item.note || ''}>
          {item.note || <span className="opacity-40 text-xs">—</span>}
        </span>
      </td>

      {/* Actions */}
      <td className="sticky right-0 z-10 px-3 sm:px-4 py-2.5 text-right whitespace-nowrap w-[96px] min-w-[96px] bg-white/95 dark:bg-[#141418] group-hover:bg-[#f6f7fa] dark:group-hover:bg-[#1a1a20] backdrop-blur-xl border-l border-black/[0.04] dark:border-white/[0.06] transition-colors duration-150">
        <div className="inline-flex items-center justify-end gap-1 opacity-90 group-hover:opacity-100 transition-opacity duration-150">
          <button
            type="button"
            onClick={() => onEdit(item)}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/10 text-[#76767b] hover:text-[#1d1d1f] dark:hover:text-white transition-all duration-150 active:scale-90 touch-manipulation"
            title="Chỉnh sửa"
            aria-label="Chỉnh sửa"
          >
            <SFPencil size={15} />
          </button>
          <button
            type="button"
            onClick={() => onDelete(item)}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-rose-500/10 text-[#76767b] hover:text-rose-600 transition-all duration-150 active:scale-90 touch-manipulation"
            title="Xóa link"
            aria-label="Xóa link"
          >
            <SFTrash size={15} />
          </button>
        </div>
      </td>
    </tr>
  );
});

LinkTableRow.displayName = 'LinkTableRow';
