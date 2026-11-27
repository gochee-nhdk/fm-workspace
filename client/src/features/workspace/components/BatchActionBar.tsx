import React from 'react';
import { createPortal } from 'react-dom';
import { SFTrash } from 'sf-symbols-lib';

interface BatchActionBarProps {
  selectedCount: number;
  onBatchDelete: () => void;
  onClearSelection: () => void;
}

export const BatchActionBar: React.FC<BatchActionBarProps> = React.memo(
  ({ selectedCount, onBatchDelete, onClearSelection }) => {
    if (typeof document === 'undefined') return null;

    return createPortal(
      <div
        className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-50 transition-[transform,opacity] duration-300 ease-spring ${
          selectedCount > 0
            ? 'translate-y-0 opacity-100 scale-100 pointer-events-auto'
            : 'translate-y-16 opacity-0 scale-95 pointer-events-none'
        }`}
      >
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-full bg-white/95 dark:bg-[#1c1c24]/95 backdrop-blur-2xl border border-black/15 dark:border-white/20 shadow-[0_20px_50px_rgba(0,0,0,0.22)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.7)] text-[13px]">
          <span className="flex items-center gap-2 font-medium text-[#1d1d1f] dark:text-white">
            <span className="min-w-5 h-5 px-1.5 rounded-full bg-[#0066cc] dark:bg-[#2997ff] text-white flex items-center justify-center text-[11px] font-bold">
              {selectedCount}
            </span>
            <span className="font-semibold">{selectedCount} đã chọn</span>
          </span>

          <div className="h-4 w-px bg-black/15 dark:bg-white/20" />

          <button
            type="button"
            onClick={onBatchDelete}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-rose-500 hover:bg-rose-600 text-white active:scale-95 transition-[transform,opacity,background-color,border-color,color,box-shadow] duration-150 font-medium text-[12.5px] cursor-pointer touch-manipulation shadow-xs"
          >
            <SFTrash size={13} />
            <span>Xóa {selectedCount} mục</span>
          </button>

          <button
            type="button"
            onClick={onClearSelection}
            className="px-2.5 py-1 text-xs text-[#76767b] dark:text-[#a1a1a6] hover:text-[#1d1d1f] dark:hover:text-white active:scale-95 transition-[transform,opacity,background-color,border-color,color,box-shadow] duration-150 cursor-pointer touch-manipulation font-medium"
          >
            Bỏ chọn (Esc)
          </button>
        </div>
      </div>,
      document.body
    );
  }
);
