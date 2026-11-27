import React from 'react';
import { cn } from '@/lib/utils';
import {
  SFArrowUturnBackward,
  SFArrowUturnForward,
  SFArrowClockwise,
  SFArrowCounterclockwise,
  SFCheckmark,
  SFArrowDownToLine,
  SFSquareOnSquare,
  SFTrash,
  SFPhoto,
} from '@/components/ui/AppleIcon';
import { formatFileSize } from '@/services/noteImageService';
import { CloseButton } from '@/components/ui/close-button';

interface ImageEditorHeaderProps {
  imageName?: string;
  imageSize?: number;
  naturalSize: { w: number; h: number };
  annotationCount: number;
  canUndo: boolean;
  canRedo: boolean;
  hasSelectedAnnotation: boolean;
  isSaving: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onRotate: () => void;
  onResetOriginal: () => void;
  onDeleteSelected: () => void;
  onClearAll: () => void;
  onCopy: () => void;
  onDownload: () => void;
  onSave: () => void;
  onClose: () => void;
}

export const ImageEditorHeader: React.FC<ImageEditorHeaderProps> = React.memo(
  ({
    imageName,
    imageSize,
    naturalSize,
    annotationCount,
    canUndo,
    canRedo,
    hasSelectedAnnotation,
    isSaving,
    onUndo,
    onRedo,
    onRotate,
    onResetOriginal,
    onDeleteSelected,
    onClearAll,
    onCopy,
    onDownload,
    onSave,
    onClose,
  }) => {
    return (
      <header className="h-14 sm:h-16 grid grid-cols-3 items-center px-4 sm:px-6 border-b border-white/10 shrink-0 z-30">
        <div className="flex items-center gap-2.5 min-w-0 justify-self-start">
          <div className="w-8 h-8 rounded-full bg-white/10 text-white flex items-center justify-center shrink-0">
            <SFPhoto size={16} />
          </div>
          <div className="min-w-0">
            <h3 className="text-[13.5px] font-semibold text-white truncate max-w-[180px] sm:max-w-xs">
              Chỉnh sửa: {imageName || 'Hình ảnh'}
            </h3>
            <p className="text-[11px] text-white/60">
              {naturalSize.w} × {naturalSize.h}px • {imageSize ? formatFileSize(imageSize) : 'Ảnh ghi chú'} • {annotationCount} ghi chú
            </p>
          </div>
        </div>

        <div className="justify-self-center flex items-center gap-1 sm:gap-1.5 px-2.5 py-1 rounded-full bg-white/10 border border-white/15 backdrop-blur-xl shadow-xs">
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            className={cn(
              'w-8 h-8 rounded-full flex items-center justify-center text-white/90 hover:text-white hover:bg-white/15 transition-[transform,opacity,background-color,border-color,color,box-shadow] active:scale-90 cursor-pointer',
              !canUndo && 'opacity-35 pointer-events-none'
            )}
            title="Hoàn tác (Ctrl+Z)"
          >
            <SFArrowUturnBackward size={14} />
          </button>

          <button
            type="button"
            onClick={onRedo}
            disabled={!canRedo}
            className={cn(
              'w-8 h-8 rounded-full flex items-center justify-center text-white/90 hover:text-white hover:bg-white/15 transition-[transform,opacity,background-color,border-color,color,box-shadow] active:scale-90 cursor-pointer',
              !canRedo && 'opacity-35 pointer-events-none'
            )}
            title="Làm lại (Ctrl+Y)"
          >
            <SFArrowUturnForward size={14} />
          </button>

          <span className="w-[1px] h-4 bg-white/20 mx-0.5" />

          <button
            type="button"
            onClick={onRotate}
            className="w-8 h-8 rounded-full flex items-center justify-center text-white/90 hover:text-white hover:bg-white/15 transition-[transform,opacity,background-color,border-color,color,box-shadow] active:scale-90 cursor-pointer"
            title="Xoay ảnh 90° (Phím R)"
          >
            <SFArrowClockwise size={14} />
          </button>

          <button
            type="button"
            onClick={onResetOriginal}
            className="w-8 h-8 rounded-full flex items-center justify-center text-white/90 hover:text-white hover:bg-white/15 transition-[transform,opacity,background-color,border-color,color,box-shadow] active:scale-90 cursor-pointer"
            title="Khôi phục ảnh gốc ban đầu"
          >
            <SFArrowCounterclockwise size={14} />
          </button>

          {hasSelectedAnnotation && (
            <button
              type="button"
              onClick={onDeleteSelected}
              className="w-8 h-8 rounded-full flex items-center justify-center text-red-400 hover:text-red-300 hover:bg-red-500/20 transition-[transform,opacity,background-color,border-color,color,box-shadow] active:scale-90 cursor-pointer"
              title="Xóa đối tượng đang chọn (Phím Del)"
            >
              <SFTrash size={14} />
            </button>
          )}

          <button
            type="button"
            onClick={onClearAll}
            disabled={annotationCount === 0}
            className={cn(
              'w-8 h-8 rounded-full flex items-center justify-center text-white/90 hover:text-white hover:bg-white/15 transition-[transform,opacity,background-color,border-color,color,box-shadow] active:scale-90 cursor-pointer',
              annotationCount === 0 && 'opacity-35 pointer-events-none'
            )}
            title="Xóa tất cả ghi chú"
          >
            <SFTrash size={14} />
          </button>
        </div>

        <div className="flex items-center gap-2 justify-self-end">
          <button
            type="button"
            onClick={onCopy}
            className="w-9 h-9 rounded-full hidden sm:flex items-center justify-center bg-white/10 hover:bg-white/20 active:scale-90 text-white/90 hover:text-white border border-white/15 transition-[transform,opacity,background-color,border-color,color,box-shadow] shadow-xs cursor-pointer"
            title="Sao chép ảnh đã chỉnh sửa (Clipboard)"
          >
            <SFSquareOnSquare size={15} />
          </button>

          <button
            type="button"
            onClick={onDownload}
            className="w-9 h-9 rounded-full hidden sm:flex items-center justify-center bg-white/10 hover:bg-white/20 active:scale-90 text-white/90 hover:text-white border border-white/15 transition-[transform,opacity,background-color,border-color,color,box-shadow] shadow-xs cursor-pointer"
            title="Tải ảnh về máy"
          >
            <SFArrowDownToLine size={15} />
          </button>

          <button
            type="button"
            onClick={onSave}
            disabled={isSaving}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[13px] font-semibold text-white bg-[#0071e3] hover:bg-[#0077ed] shadow-[0_4px_16px_rgba(0,113,227,0.35)] transition-[transform,opacity,background-color,border-color,color,box-shadow] active:scale-95 disabled:opacity-50 cursor-pointer"
            title="Lưu thay đổi vào ghi chú (Ctrl+S)"
          >
            <SFCheckmark size={14} />
            <span>{isSaving ? 'Đang lưu...' : 'Lưu ảnh'}</span>
          </button>

          <CloseButton
            onClick={onClose}
            size="md"
            className="bg-white/10 hover:bg-white/20 active:bg-white/30 text-white/80 hover:text-white"
            title="Đóng trình sửa ảnh (Esc)"
          />
        </div>
      </header>
    );
  }
);
