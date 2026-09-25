import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  SFCheckmark,
  SFXmark,
  SFArrowCounterclockwise,
  SFCamera,
} from 'sf-symbols-lib';

interface SnippingToolOverlayProps {
  snapshotDataUrl: string;
  onCropComplete: (croppedDataUrl: string, name: string, size: number) => void;
  onCancel: () => void;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const SnippingToolOverlay: React.FC<SnippingToolOverlayProps> = ({
  snapshotDataUrl,
  onCropComplete,
  onCancel,
}) => {
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  const [selection, setSelection] = useState<Rect | null>(null);
  const [isDraggingBox, setIsDraggingBox] = useState(false);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null);
  const [imageSize, setImageSize] = useState<{ naturalW: number; naturalH: number } | null>(null);

  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Read natural image dimensions once loaded
  const handleImageLoad = () => {
    if (!imageRef.current) return;
    setImageSize({
      naturalW: imageRef.current.naturalWidth || window.innerWidth,
      naturalH: imageRef.current.naturalHeight || window.innerHeight,
    });
  };

  // Compute exact image layout inside window (contain fit)
  const getImageBounds = useCallback(() => {
    const winW = window.innerWidth;
    const winH = window.innerHeight;
    if (!imageSize || imageSize.naturalW <= 0 || imageSize.naturalH <= 0) {
      return { left: 0, top: 0, width: winW, height: winH, scaleX: 1, scaleY: 1 };
    }

    const { naturalW, naturalH } = imageSize;
    const imgRatio = naturalW / naturalH;
    const winRatio = winW / winH;

    let width = winW;
    let height = winH;
    let left = 0;
    let top = 0;

    if (Math.abs(imgRatio - winRatio) < 0.005) {
      width = winW;
      height = winH;
      left = 0;
      top = 0;
    } else if (winRatio > imgRatio) {
      height = winH;
      width = winH * imgRatio;
      left = (winW - width) / 2;
    } else {
      width = winW;
      height = winW / imgRatio;
      top = (winH - height) / 2;
    }

    const scaleX = naturalW / width;
    const scaleY = naturalH / height;

    return { left, top, width, height, scaleX, scaleY };
  }, [imageSize]);

  // Crop image according to selection rectangle with subpixel-accurate coordinate scaling
  const handleConfirmCrop = useCallback(() => {
    if (!imageRef.current) return;
    const img = imageRef.current;
    const bounds = getImageBounds();
    const naturalW = img.naturalWidth || window.innerWidth;
    const naturalH = img.naturalHeight || window.innerHeight;

    let cropX = 0;
    let cropY = 0;
    let cropW = naturalW;
    let cropH = naturalH;

    if (selection && selection.w >= 15 && selection.h >= 15) {
      // Map screen coordinates relative to image bounds
      const relX = selection.x - bounds.left;
      const relY = selection.y - bounds.top;

      cropX = Math.max(0, Math.round(relX * bounds.scaleX));
      cropY = Math.max(0, Math.round(relY * bounds.scaleY));
      cropW = Math.min(naturalW - cropX, Math.round(selection.w * bounds.scaleX));
      cropH = Math.min(naturalH - cropY, Math.round(selection.h * bounds.scaleY));
    }

    if (cropW <= 0 || cropH <= 0) return;

    const canvas = document.createElement('canvas');
    canvas.width = cropW;
    canvas.height = cropH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

    const croppedDataUrl = canvas.toDataURL('image/jpeg', 0.92);
    const estimatedSize = Math.round((croppedDataUrl.length - 'data:image/jpeg;base64,'.length) * 0.75);

    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}-${String(now.getSeconds()).padStart(2, '0')}`;
    const name = `Snip_${timeStr}.jpg`;

    onCropComplete(croppedDataUrl, name, estimatedSize);
  }, [selection, getImageBounds, onCropComplete]);

  // Capture full screen directly
  const handleFullFrame = useCallback(() => {
    if (!imageRef.current) return;
    const img = imageRef.current;
    const naturalW = img.naturalWidth || window.innerWidth;
    const naturalH = img.naturalHeight || window.innerHeight;

    const canvas = document.createElement('canvas');
    canvas.width = naturalW;
    canvas.height = naturalH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(img, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    const estimatedSize = Math.round((dataUrl.length - 'data:image/jpeg;base64,'.length) * 0.75);

    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}-${String(now.getSeconds()).padStart(2, '0')}`;
    onCropComplete(dataUrl, `Screenshot_Full_${timeStr}.jpg`, estimatedSize);
  }, [onCropComplete]);

  // Keyboard navigation: Escape to cancel, Enter to confirm selection
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      } else if (e.key === 'Enter') {
        if (selection && selection.w >= 15 && selection.h >= 15) {
          e.preventDefault();
          handleConfirmCrop();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCancel, selection, handleConfirmCrop]);

  const handleMouseDown = (e: React.MouseEvent) => {
    // Only left click
    if (e.button !== 0) return;
    const x = e.clientX;
    const y = e.clientY;
    setIsMouseDown(true);
    setStartPos({ x, y });
    setSelection(null);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    // If dragging to reposition existing selection box
    if (isDraggingBox && selection && dragOffset) {
      const newX = Math.max(0, Math.min(window.innerWidth - selection.w, e.clientX - dragOffset.x));
      const newY = Math.max(0, Math.min(window.innerHeight - selection.h, e.clientY - dragOffset.y));
      setSelection({
        ...selection,
        x: newX,
        y: newY,
      });
      return;
    }

    // Dragging to create new selection
    if (!isMouseDown || !startPos) return;
    const x = e.clientX;
    const y = e.clientY;

    const rectX = Math.min(startPos.x, x);
    const rectY = Math.min(startPos.y, y);
    const rectW = Math.abs(x - startPos.x);
    const rectH = Math.abs(y - startPos.y);

    setSelection({
      x: rectX,
      y: rectY,
      w: rectW,
      h: rectH,
    });
  };

  const handleMouseUp = () => {
    setIsMouseDown(false);
    setIsDraggingBox(false);
    setDragOffset(null);
    setStartPos(null);
    // If selection is too tiny (< 15px), reset
    if (selection && (selection.w < 15 || selection.h < 15)) {
      setSelection(null);
    }
  };

  // Start dragging the existing selection box
  const handleBoxMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (e.button !== 0 || !selection) return;
    setIsDraggingBox(true);
    setDragOffset({
      x: e.clientX - selection.x,
      y: e.clientY - selection.y,
    });
  };

  const imageBounds = getImageBounds();

  // Determine whether action pill flips above selection box to stay in viewport
  const spaceBelow = selection ? window.innerHeight - (selection.y + selection.h) : 100;
  const flipActionUp = spaceBelow < 55;

  return createPortal(
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      className="fixed inset-0 z-[11000] cursor-crosshair select-none overflow-hidden bg-black/90 animate-in fade-in duration-150"
      style={{ userSelect: 'none' }}
    >
      {/* Background Frozen Snapshot Image */}
      <img
        ref={imageRef}
        src={snapshotDataUrl}
        alt="Screen Snapshot"
        onLoad={handleImageLoad}
        style={{
          position: 'absolute',
          left: `${imageBounds.left}px`,
          top: `${imageBounds.top}px`,
          width: `${imageBounds.width}px`,
          height: `${imageBounds.height}px`,
        }}
        className="select-none pointer-events-none"
      />

      {/* Dimmed Overlay with Cutout Hole via SVG Mask (Zero flickering, 100% crisp) */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none z-10"
        width="100%"
        height="100%"
      >
        <defs>
          <mask id="snipping-cutout-mask" maskUnits="userSpaceOnUse">
            {/* White background: dimmed mask is visible */}
            <rect width="100%" height="100%" fill="white" />
            {/* Black rectangle: cutout hole where screen snapshot shines through 100% */}
            {selection && selection.w > 0 && selection.h > 0 && (
              <rect
                x={selection.x}
                y={selection.y}
                width={selection.w}
                height={selection.h}
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="rgba(0, 0, 0, 0.48)"
          mask="url(#snipping-cutout-mask)"
        />
      </svg>

      {/* ───────── Top Floating Instruction Pill ───────── */}
      <div
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        className="absolute top-5 inset-x-0 mx-auto w-fit flex items-center gap-3 px-4.5 py-2 rounded-full bg-black/80 dark:bg-[#1c1c1e]/90 backdrop-blur-2xl border border-white/20 text-white shadow-2xl text-[12.5px] font-medium z-50 animate-in slide-in-from-top-4 duration-200"
      >
        <div className="w-2.5 h-2.5 rounded-full bg-[#0071e3] animate-pulse" />
        <span>Kéo chuột để vẽ khung cắt ảnh (hoặc Enter để lưu)</span>
        <span className="text-white/30">|</span>
        <button
          type="button"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            handleFullFrame();
          }}
          className="text-[#2997ff] hover:text-white transition-colors cursor-pointer font-semibold flex items-center gap-1.5"
          title="Lấy toàn bộ màn hình"
        >
          <SFCamera size={14} />
          <span>Toàn màn hình</span>
        </button>
        <span className="text-white/30">|</span>
        <button
          type="button"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onCancel();
          }}
          className="text-white/70 hover:text-rose-400 transition-colors cursor-pointer flex items-center gap-1.5"
          title="Hủy thao tác chụp (Esc)"
        >
          <SFXmark size={14} />
          <span>Hủy (Esc)</span>
        </button>
      </div>

      {/* ───────── Active Selection Box & Handles ───────── */}
      {selection && selection.w > 0 && selection.h > 0 && (
        <div
          onMouseDown={handleBoxMouseDown}
          onDoubleClick={(e) => {
            e.stopPropagation();
            handleConfirmCrop();
          }}
          className="absolute border-2 border-[#0071e3] shadow-[0_0_16px_rgba(0,113,227,0.5)] z-20 cursor-move"
          style={{
            left: `${selection.x}px`,
            top: `${selection.y}px`,
            width: `${selection.w}px`,
            height: `${selection.h}px`,
          }}
          title="Kéo để di chuyển vùng cắt, nhấp đúp để lưu ngay"
        >
          {/* Corner Grab Marks */}
          <div className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-[#0071e3] rounded-full shadow-xs pointer-events-none" />
          <div className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-[#0071e3] rounded-full shadow-xs pointer-events-none" />
          <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-[#0071e3] rounded-full shadow-xs pointer-events-none" />
          <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-[#0071e3] rounded-full shadow-xs pointer-events-none" />

          {/* Dimension Label */}
          <div className="absolute -top-7 left-0 px-2 py-0.5 rounded text-[10.5px] font-mono bg-black/85 text-white backdrop-blur-md shadow-xs pointer-events-none border border-white/15">
            {Math.round(selection.w)} × {Math.round(selection.h)} px
          </div>

          {/* Floating Actions Strip (Responsive, Never Cut Off, 100% Clickable) */}
          {!isMouseDown && !isDraggingBox && selection.w >= 20 && selection.h >= 20 && (
            <div
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              style={{
                position: 'absolute',
                ...(flipActionUp
                  ? selection.y >= 50
                    ? { top: '-48px', right: '0px' }
                    : { bottom: '8px', right: '8px' }
                  : { bottom: '-52px', right: '0px' }),
              }}
              className="flex items-center gap-1.5 p-1.5 rounded-full bg-black/85 dark:bg-[#1c1c1e]/90 backdrop-blur-2xl border border-white/20 shadow-2xl z-50 pointer-events-auto animate-in zoom-in-95 duration-150"
            >
              {/* Confirm / Done Button */}
              <button
                type="button"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  handleConfirmCrop();
                }}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#0071e3] hover:bg-[#0077ed] text-white text-[12px] font-semibold transition-all cursor-pointer shadow-md shadow-[#0071e3]/40 active:scale-95"
                title="Lưu vùng đã chọn vào ghi chú (Enter)"
              >
                <SFCheckmark size={14} className="stroke-[3]" />
                <span>Xác nhận</span>
              </button>

              {/* Redo Button */}
              <button
                type="button"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelection(null);
                }}
                className="w-8 h-8 rounded-full hover:bg-white/15 text-white/80 hover:text-white flex items-center justify-center transition-colors cursor-pointer active:scale-95"
                title="Vẽ lại khung khác"
              >
                <SFArrowCounterclockwise size={14} />
              </button>

              {/* Cancel Button */}
              <button
                type="button"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onCancel();
                }}
                className="w-8 h-8 rounded-full hover:bg-rose-500/25 text-rose-400 hover:text-rose-300 flex items-center justify-center transition-colors cursor-pointer active:scale-95"
                title="Hủy bỏ (Esc)"
              >
                <SFXmark size={15} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>,
    document.body
  );
};
