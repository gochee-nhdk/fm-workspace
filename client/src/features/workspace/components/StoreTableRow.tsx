import React from 'react';
import {
  SFLine3Horizontal,
  SFCheckmark,
  SFSquareOnSquare,
  SFMappinAndEllipse,
  SFArrowUpRightSquare,
  SFPencil,
  SFTrash,
} from 'sf-symbols-lib';
import { StoreItem } from '@/types/workspace';
import { sanitizeUrl } from '@/lib/utils';

export interface StoreTableRowProps {
  item: StoreItem;
  isDragged: boolean;
  isDragOver: boolean;
  dropPosition: 'top' | 'bottom' | null;
  copiedKey: string | null;
  onDragStart: (id: string, e: React.DragEvent) => void;
  onDragOver: (id: string, e: React.DragEvent) => void;
  onDragLeave: (id: string, e: React.DragEvent) => void;
  onDrop: (id: string, e: React.DragEvent) => void;
  onDragEnd: () => void;
  onCopy: (text: string, label: string, key: string) => void;
  onPreviewMap: (item: StoreItem) => void;
  onEdit: (item: StoreItem) => void;
  onDelete: (item: StoreItem) => void;
}

export const StoreTableRow = React.memo<StoreTableRowProps>(({
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
  onCopy,
  onPreviewMap,
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

      {/* Store Code (Plain bold text, neutral color) */}
      <td className="px-4 py-3 font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] min-w-[100px] select-text">
        {item.storeCode}
      </td>

      {/* Address (Neutral normal text by default, highlights with Apple blue on hover) */}
      <td className="px-3.5 py-3 min-w-[260px] max-w-[550px]">
        <button
          type="button"
          onClick={() => onCopy(item.address || '', 'địa chỉ', `store-${item.id}`)}
          className="inline-flex items-center gap-2 px-2.5 py-1 -ml-2.5 rounded-xl bg-transparent hover:bg-[#0066cc]/[0.08] dark:hover:bg-[#2997ff]/15 text-[#1d1d1f] dark:text-[#f5f5f7] hover:text-[#0066cc] dark:hover:text-[#2997ff] text-[13px] font-[450] transition-colors duration-150 active:scale-[0.98] text-left cursor-pointer group/store max-w-full"
          title={`Bấm để sao chép Địa chỉ: ${item.address}`}
        >
          <span className="truncate max-w-[480px]">
            {item.address}
          </span>
          {copiedKey === `store-${item.id}` ? (
            <SFCheckmark size={14} className="text-[#34c759] shrink-0" />
          ) : (
            <SFSquareOnSquare size={13} className="text-[#86868b] opacity-0 group-hover/store:opacity-100 group-hover/store:text-[#0066cc] dark:group-hover/store:text-[#2997ff] transition-opacity duration-150 shrink-0" />
          )}
        </button>
      </td>

      {/* Type */}
      <td className="px-3.5 py-3 min-w-[110px]">
        {item.type ? (
          <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-black/[0.04] dark:bg-white/[0.08] text-[#76767b] dark:text-[#a1a1a6] font-medium">
            {item.type}
          </span>
        ) : (
          <span className="text-xs text-[#a1a1a6] opacity-50">—</span>
        )}
      </td>

      {/* Google Maps Link / In-app Preview */}
      <td className="px-3.5 py-3 min-w-[130px]">
        {item.googleMaps || item.address ? (
          <div className="inline-flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onPreviewMap(item)}
              className="group/map inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-semibold transition-colors duration-150 active:scale-[0.97] cursor-pointer bg-white/70 dark:bg-white/[0.08] hover:bg-white dark:hover:bg-white/[0.16] text-[#1d1d1f] dark:text-[#f5f5f7] hover:text-[#0071e3] dark:hover:text-[#2997ff] border border-black/[0.08] dark:border-white/12 shadow-[0_1px_3px_rgba(0,0,0,0.04),inset_0_1px_0.5px_rgba(255,255,255,0.9)] hover:shadow-[0_4px_14px_rgba(0,113,227,0.18)] backdrop-blur-md"
              title="Xem trước bản đồ Google Maps trong web app"
            >
              <span className="w-3.5 h-3.5 rounded-full bg-[#0071e3]/12 dark:bg-[#2997ff]/20 flex items-center justify-center text-[#0066cc] dark:text-[#2997ff] group-hover/map:bg-[#0071e3] group-hover/map:text-white transition-colors duration-150 shrink-0">
                <SFMappinAndEllipse size={10} />
              </span>
              <span>Xem bản đồ</span>
            </button>
            {sanitizeUrl(item.googleMaps) && (
              <a
                href={sanitizeUrl(item.googleMaps)}
                target="_blank"
                rel="noopener noreferrer"
                className="w-6 h-6 rounded-full flex items-center justify-center text-[#76767b] hover:text-[#0071e3] dark:hover:text-[#2997ff] hover:bg-black/5 dark:hover:bg-white/10 transition-colors duration-150 shrink-0"
                title="Mở trang Google Maps ngoài tab mới"
              >
                <SFArrowUpRightSquare size={12} className="opacity-70 hover:opacity-100" />
              </a>
            )}
          </div>
        ) : (
          <span className="text-xs text-[#a1a1a6] opacity-50">Chưa có vị trí</span>
        )}
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
            title="Xóa cửa hàng"
          >
            <SFTrash size={14} />
          </button>
        </div>
      </td>
    </tr>
  );
});

StoreTableRow.displayName = 'StoreTableRow';
