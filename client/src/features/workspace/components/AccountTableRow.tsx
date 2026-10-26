import React from 'react';
import {
  SFLine3Horizontal,
  SFCheckmark,
  SFSquareOnSquare,
  SFEye,
  SFEyeSlash,
  SFArrowUpRightSquare,
  SFPencil,
  SFTrash,
} from 'sf-symbols-lib';
import { AccountItem } from '@/types/workspace';
import { sanitizeUrl } from '@/lib/utils';

export interface AccountTableRowProps {
  item: AccountItem;
  isDragged: boolean;
  isDragOver: boolean;
  dropPosition: 'top' | 'bottom' | null;
  copiedKey: string | null;
  showPassword: boolean;
  onTogglePassword: (id: string) => void;
  onDragStart: (id: string, e: React.DragEvent) => void;
  onDragOver: (id: string, e: React.DragEvent) => void;
  onDragLeave: (id: string, e: React.DragEvent) => void;
  onDrop: (id: string, e: React.DragEvent) => void;
  onDragEnd: () => void;
  onCopy: (text: string, label: string, key: string) => void;
  onEdit: (item: AccountItem) => void;
  onDelete: (item: AccountItem) => void;
}

export const AccountTableRow = React.memo<AccountTableRowProps>(({
  item,
  isDragged,
  isDragOver,
  dropPosition,
  copiedKey,
  showPassword,
  onTogglePassword,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
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

      {/* Software */}
      <td className="px-4 py-3 font-semibold text-[#1d1d1f] dark:text-white min-w-[120px] max-w-[160px]">
        <div className="flex items-center gap-2 truncate">
          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
          <span className="truncate" title={item.software}>{item.software}</span>
        </div>
      </td>

      {/* Username (Apple 1-Click Copy Text) */}
      <td className="px-3.5 py-3 min-w-[130px] max-w-[210px]">
        <button
          type="button"
          onClick={() => onCopy(item.username, 'tài khoản', `user-${item.id}`)}
          className="inline-flex items-center gap-1.5 px-2 py-1 -ml-2 rounded-lg bg-transparent hover:bg-[#0066cc]/[0.08] dark:hover:bg-[#2997ff]/15 font-mono text-[13px] font-[450] text-[#1d1d1f] dark:text-[#f5f5f7] hover:text-[#0066cc] dark:hover:text-[#2997ff] transition-colors duration-150 active:scale-[0.98] cursor-pointer group/user max-w-full"
          title={`Bấm để sao chép Tên Đăng Nhập: ${item.username}`}
        >
          <span className="truncate max-w-[150px]">
            {item.username}
          </span>
          {copiedKey === `user-${item.id}` ? (
            <SFCheckmark size={13} className="text-[#34c759] shrink-0" />
          ) : (
            <SFSquareOnSquare size={13} className="text-[#86868b] opacity-0 group-hover/user:opacity-100 group-hover/user:text-[#0066cc] dark:group-hover/user:text-[#2997ff] transition-opacity duration-150 shrink-0" />
          )}
        </button>
      </td>

      {/* Password (Apple 1-Click Copy) */}
      <td className="px-3.5 py-3 min-w-[150px] max-w-[220px]">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onCopy(item.password || '', 'mật khẩu', `pass-${item.id}`)}
            className="inline-flex items-center gap-1.5 px-2 py-1 -ml-2 rounded-lg bg-transparent hover:bg-[#0066cc]/[0.08] dark:hover:bg-[#2997ff]/15 font-mono text-[13px] font-[450] text-[#1d1d1f] dark:text-[#f5f5f7] hover:text-[#0066cc] dark:hover:text-[#2997ff] transition-colors duration-150 active:scale-[0.98] cursor-pointer group/pass select-none"
            title="Bấm để sao chép Mật Khẩu"
          >
            <span className="truncate max-w-[130px] tracking-wide">
              {showPassword ? item.password : '••••••••'}
            </span>
            {copiedKey === `pass-${item.id}` ? (
              <SFCheckmark size={13} className="text-[#34c759] shrink-0" />
            ) : (
              <SFSquareOnSquare size={13} className="text-[#86868b] opacity-0 group-hover/pass:opacity-100 group-hover/pass:text-[#0066cc] dark:group-hover/pass:text-[#2997ff] transition-opacity duration-150 shrink-0" />
            )}
          </button>
          <button
            type="button"
            onClick={() => onTogglePassword(item.id)}
            className="w-6 h-6 rounded-full flex items-center justify-center text-[#76767b] hover:text-[#1d1d1f] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors duration-150 active:scale-95 cursor-pointer shrink-0"
            title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
          >
            {showPassword ? (
              <SFEyeSlash size={14} className="text-[#0066cc] dark:text-[#2997ff]" />
            ) : (
              <SFEye size={14} className="opacity-60 hover:opacity-100 transition-opacity duration-150" />
            )}
          </button>
        </div>
      </td>

      {/* Link */}
      <td className="px-3.5 py-3 min-w-[130px]">
        {sanitizeUrl(item.link) ? (
          <div className="flex items-center gap-1.5">
            <a
              href={sanitizeUrl(item.link)}
              target="_blank"
              rel="noopener noreferrer"
              className="group/acc inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-semibold transition-colors duration-150 active:scale-[0.97] cursor-pointer bg-white/70 dark:bg-white/[0.08] hover:bg-white dark:hover:bg-white/[0.16] text-[#1d1d1f] dark:text-[#f5f5f7] hover:text-[#0071e3] dark:hover:text-[#2997ff] border border-black/[0.08] dark:border-white/12 shadow-[0_1px_3px_rgba(0,0,0,0.04),inset_0_1px_0.5px_rgba(255,255,255,0.9)] hover:shadow-[0_4px_14px_rgba(0,113,227,0.18)] backdrop-blur-md"
              title="Mở trang đăng nhập trong tab mới"
            >
              <span>Đăng nhập</span>
              <span className="w-3.5 h-3.5 rounded-full bg-[#0071e3]/12 dark:bg-[#2997ff]/20 flex items-center justify-center text-[#0066cc] dark:text-[#2997ff] group-hover/acc:bg-[#0071e3] group-hover/acc:text-white transition-colors duration-150 shrink-0">
                <SFArrowUpRightSquare size={10} />
              </span>
            </a>
            <button
              type="button"
              onClick={() => onCopy(item.link || '', 'đường dẫn', `acc-link-${item.id}`)}
              className="w-6 h-6 rounded-full flex items-center justify-center text-[#76767b] hover:text-[#0071e3] dark:hover:text-[#2997ff] hover:bg-black/5 dark:hover:bg-white/10 transition-colors duration-150 active:scale-95 cursor-pointer shrink-0"
              title="Sao chép liên kết đăng nhập"
            >
              {copiedKey === `acc-link-${item.id}` ? (
                <SFCheckmark size={14} className="text-[#34c759]" />
              ) : (
                <SFSquareOnSquare size={12} className="opacity-70 hover:opacity-100 transition-opacity duration-150" />
              )}
            </button>
          </div>
        ) : (
          <span className="text-xs text-[#a1a1a6] opacity-50">—</span>
        )}
      </td>

      {/* Note */}
      <td className="px-3.5 py-3 text-slate-500 dark:text-slate-400 min-w-[120px] max-w-[240px]">
        <span className="truncate block" title={item.note || ''}>
          {item.note || <span className="opacity-40 text-xs">—</span>}
        </span>
      </td>

      {/* Actions */}
      <td className="sticky right-0 z-10 px-4 py-3 text-right whitespace-nowrap w-[96px] min-w-[96px] bg-white/95 dark:bg-[#141418] group-hover:bg-[#f6f7fa] dark:group-hover:bg-[#1a1a20] backdrop-blur-xl border-l border-black/[0.04] dark:border-white/[0.06] transition-colors duration-150">
        <div className="inline-flex items-center justify-end gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity duration-150">
          <button
            type="button"
            onClick={() => onEdit(item)}
            className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-[#76767b] hover:text-[#1d1d1f] dark:hover:text-white transition-colors duration-150 active:scale-90"
            title="Chỉnh sửa"
          >
            <SFPencil size={14} />
          </button>
          <button
            type="button"
            onClick={() => onDelete(item)}
            className="p-1.5 rounded-full hover:bg-rose-500/10 text-[#76767b] hover:text-rose-600 transition-colors duration-150 active:scale-90"
            title="Xóa tài khoản"
          >
            <SFTrash size={14} />
          </button>
        </div>
      </td>
    </tr>
  );
});

AccountTableRow.displayName = 'AccountTableRow';
