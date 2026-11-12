import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import {
  SFPencil,
  SFHighlighter,
  SFSquare,
  SFArrowRight,
  SFTextformat,
  SFEraser,
  SFArrowUturnBackward,
  SFArrowUturnForward,
  SFArrowClockwise,
  SFArrowCounterclockwise,
  SFCheckmark,
  SFXmark,
  SFArrowDownToLine,
  SFSquareOnSquare,
  SFTrash,
  SFPhoto,
  SFTextBubble,
  SFBold,
  SFItalic,
  SFChevronDown,
  SFEyedropper,
  SFTextAlignleft,
  SFTextAligncenter,
  SFTextAlignright,
  SFSliderHorizontal3,
  SFSparkles,
} from '@/components/ui/AppleIcon';
import { downloadImage, copyImageToClipboard, formatFileSize } from '@/services/noteImageService';
import { ConfirmDeleteDialog } from '@/components/ui/ConfirmDeleteDialog';
import { CloseButton } from '@/components/ui/close-button';
import { AppleSwitch } from '@/components/ui/AppleCheckbox';
import { motionTokens } from '@/lib/motion';
import { useAnimatedPresence } from '@/hooks/useAnimatedPresence';
import toast from 'react-hot-toast';

export type AnnotationTool = 'select' | 'pen' | 'highlighter' | 'rect' | 'arrow' | 'text' | 'note' | 'eraser' | 'crop';
export type ShapeVariant = 'rect' | 'roundRect' | 'circle' | 'ellipse' | 'triangle' | 'star';

export interface Point {
  x: number;
  y: number;
}

export interface BaseAnnotation {
  id: string;
  type: AnnotationTool;
  color: string;
  strokeWidth: number;
}

export interface PathAnnotation extends BaseAnnotation {
  type: 'pen' | 'highlighter';
  points: Point[];
}

export interface ShapeAnnotation extends BaseAnnotation {
  type: 'rect' | 'arrow';
  shapeVariant?: ShapeVariant;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

export interface TextEffects {
  shadowEnabled?: boolean;
  shadowColor?: string;
  shadowBlur?: number;
  shadowOffset?: number;
  shadowAngle?: number;
  strokeEnabled?: boolean;
  strokeColor?: string;
  strokeWidth?: number;
  blurEnabled?: boolean;
  blurRadius?: number;
}

export interface TextAnnotation extends BaseAnnotation {
  type: 'text';
  x: number;
  y: number;
  width?: number; // Resizable text bounding box width
  text: string;
  fontSize: number;
  fontFamily: string;
  textAlign?: 'left' | 'center' | 'right';
  isBold?: boolean;
  isItalic?: boolean;
  effects?: TextEffects;
}

export interface NoteAnnotation extends BaseAnnotation {
  type: 'note';
  anchorX: number; // Point on image where user clicked
  anchorY: number;
  side: 'left' | 'right';
  yOffset: number; // Vertical position along side gutter
  text: string;
  fontSize: number;
}

export type Annotation = PathAnnotation | ShapeAnnotation | TextAnnotation | NoteAnnotation;

export interface ImageEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  image: {
    id?: string;
    url: string;
    name?: string;
    size?: number;
  };
  onSave: (editedDataUrl: string, name: string, size: number) => Promise<void> | void;
}

const PRESET_COLORS = [
  { name: 'Đỏ Apple', hex: '#EF4444' },
  { name: 'Cam Amber', hex: '#F59E0B' },
  { name: 'Vàng rực', hex: '#EAB308' },
  { name: 'Xanh lá', hex: '#10B981' },
  { name: 'Xanh dương', hex: '#0071E3' },
  { name: 'Tím mộng mơ', hex: '#8B5CF6' },
  { name: 'Hồng sen', hex: '#EC4899' },
  { name: 'Trắng tinh khiết', hex: '#FFFFFF' },
  { name: 'Đen than chì', hex: '#1F2937' },
];

const FONT_FAMILIES = [
  { label: 'San Francisco (Hệ thống)', value: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
  { label: 'New York (Serif)', value: 'Georgia, Cambria, "Times New Roman", serif' },
  { label: 'SF Mono (Mã lệnh)', value: '"SF Mono", Menlo, Monaco, Consolas, monospace' },
  { label: 'Caveat (Viết tay)', value: 'cursive, "Brush Script MT", sans-serif' },
  { label: 'Be Vietnam Pro', value: '"Be Vietnam Pro", sans-serif' },
  { label: 'Roboto', value: 'Roboto, sans-serif' },
  { label: 'Dancing Script', value: '"Dancing Script", cursive, sans-serif' },
];

export const ImageEditorModal: React.FC<ImageEditorModalProps> = ({
  isOpen,
  onClose,
  image,
  onSave,
}) => {
  const { shouldRender, isExiting } = useAnimatedPresence(isOpen, motionTokens.duration.exit + 10);

  // Lock body scroll while editor modal is active
  useEffect(() => {
    if (shouldRender) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [shouldRender]);

  // Current active tool (toggling off active tool switches directly to 'select' mode)
  const [activeTool, setActiveTool] = useState<AnnotationTool>('pen');
  const [selectedShapeVariant, setSelectedShapeVariant] = useState<ShapeVariant>('rect');
  const [isShapeMenuOpen, setIsShapeMenuOpen] = useState<boolean>(false);
  const shapeMenuRef = useRef<HTMLDivElement>(null);
  const [selectedColor, setSelectedColor] = useState<string>('#EF4444');
  const [selectedStrokeWidth, setSelectedStrokeWidth] = useState<number>(6);
  const strokeWidthDisplayRef = useRef<HTMLSpanElement | null>(null);
  const strokeWidthDotRef = useRef<HTMLSpanElement | null>(null);

  // Advanced Color Picker state
  const [isColorPickerOpen, setIsColorPickerOpen] = useState<boolean>(false);
  const [customHexInput, setCustomHexInput] = useState<string>('#EF4444');
  const colorPickerRef = useRef<HTMLDivElement>(null);

  // Text Typography & Effects state
  const [selectedFontSize, setSelectedFontSize] = useState<number>(24);
  const [selectedFontFamily, setSelectedFontFamily] = useState<string>(FONT_FAMILIES[0].value);
  const [selectedTextAlign, setSelectedTextAlign] = useState<'left' | 'center' | 'right'>('left');
  const [isFontDropdownOpen, setIsFontDropdownOpen] = useState<boolean>(false);
  const fontDropdownRef = useRef<HTMLDivElement>(null);
  const [isBold, setIsBold] = useState<boolean>(true);
  const [isItalic, setIsItalic] = useState<boolean>(false);

  // Text Effects Popover state
  const [isTextEffectsOpen, setIsTextEffectsOpen] = useState<boolean>(false);
  const textEffectsRef = useRef<HTMLDivElement>(null);
  const [textEffects, setTextEffects] = useState<TextEffects>({
    shadowEnabled: false,
    shadowColor: 'rgba(0,0,0,0.7)',
    shadowBlur: 6,
    shadowOffset: 2,
    shadowAngle: 45,
    strokeEnabled: false,
    strokeColor: '#000000',
    strokeWidth: 2,
    blurEnabled: false,
    blurRadius: 0,
  });

  const [rotation, setRotation] = useState<number>(0); // 0, 90, 180, 270

  // Annotation states
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [history, setHistory] = useState<Annotation[][]>([[]]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);

  // Selected annotation for moving / dragging / resizing in 'select' mode
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);
  const [isDraggingSelected, setIsDraggingSelected] = useState<boolean>(false);
  const [isResizingText, setIsResizingText] = useState<boolean>(false);
  const dragStartPointRef = useRef<Point | null>(null);
  const dragOriginalAnnotationRef = useRef<Annotation | null>(null);

  // Active drawing interaction
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const currentPathRef = useRef<Point[]>([]);
  const shapeStartRef = useRef<Point | null>(null);
  const activeAnnotationRef = useRef<Annotation | null>(null);

  // In-image inline direct text editing state
  const [activeInlineText, setActiveInlineText] = useState<{
    id?: string;
    type: 'text';
    canvasX: number;
    canvasY: number;
    width: number;
    text: string;
  } | null>(null);

  // Loaded Image state
  const [imgLoaded, setImgLoaded] = useState<boolean>(false);
  const imageElementRef = useRef<HTMLImageElement | null>(null);
  const originalImageUrlRef = useRef<string>('');
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });

  // Crop states
  const [cropBox, setCropBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [cropAspectRatio, setCropAspectRatio] = useState<number | null>(null);
  const [cropDragMode, setCropDragMode] = useState<
    'move' | 'nw' | 'ne' | 'se' | 'sw' | 'n' | 'e' | 's' | 'w' | null
  >(null);
  const cropDragStartRef = useRef<{ pt: Point; initialBox: { x: number; y: number; w: number; h: number } } | null>(null);

  // Canvas DOM refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inlineTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);

  // Close dropdowns & popovers when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (fontDropdownRef.current && !fontDropdownRef.current.contains(target)) {
        setIsFontDropdownOpen(false);
      }
      if (colorPickerRef.current && !colorPickerRef.current.contains(target)) {
        setIsColorPickerOpen(false);
      }
      if (textEffectsRef.current && !textEffectsRef.current.contains(target)) {
        setIsTextEffectsOpen(false);
      }
      if (shapeMenuRef.current && !shapeMenuRef.current.contains(target)) {
        setIsShapeMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Tool toggle handler: clicking the active tool toggles it off and switches back to 'select' mode
  const handleSelectTool = (tool: AnnotationTool) => {
    if (activeTool === tool && tool !== 'select') {
      setActiveTool('select');
      toast('Đã về chế độ trỏ chuột di chuyển', { icon: '👆', duration: 1500 });
    } else {
      if (tool !== 'crop') {
        setCropBox(null);
      }
      setActiveTool(tool);
    }
  };

  const handleColorChange = (col: string) => {
    setSelectedColor(col);
    setCustomHexInput(col);
    if (selectedAnnotationId) {
      const updated = annotations.map((a) => (a.id === selectedAnnotationId ? { ...a, color: col } : a));
      pushState(updated);
    }
  };

  const handleStrokeWidthChange = (val: number) => {
    setSelectedStrokeWidth(val);
    if (strokeWidthDisplayRef.current) {
      strokeWidthDisplayRef.current.textContent = `${val}px`;
    }
    if (strokeWidthDotRef.current) {
      const sz = Math.min(18, Math.max(2, val * 0.7));
      strokeWidthDotRef.current.style.width = `${sz}px`;
      strokeWidthDotRef.current.style.height = `${sz}px`;
    }
    if (selectedAnnotationId) {
      const updated = annotations.map((a) => (a.id === selectedAnnotationId ? { ...a, strokeWidth: val } : a));
      pushState(updated);
    }
  };

  // Load image element
  useEffect(() => {
    if (!isOpen || !image.url) return;

    setImgLoaded(false);
    setAnnotations([]);
    setHistory([[]]);
    setHistoryIndex(0);
    setRotation(0);
    setActiveInlineText(null);
    setSelectedAnnotationId(null);
    setCropBox(null);
    setCropAspectRatio(null);
    setActiveTool('select');
    originalImageUrlRef.current = image.url;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imageElementRef.current = img;
      setNaturalSize({ w: img.naturalWidth || 800, h: img.naturalHeight || 600 });
      setImgLoaded(true);
    };
    img.onerror = () => {
      toast.error('Không thể nạp hình ảnh để chỉnh sửa');
    };
    img.src = image.url;
  }, [isOpen, image.url]);

  // Focus inline textarea when opened
  useEffect(() => {
    if (activeInlineText && inlineTextareaRef.current) {
      inlineTextareaRef.current.focus();
    }
  }, [activeInlineText]);

  // Handle undo/redo state management
  const pushState = useCallback((newAnnotations: Annotation[]) => {
    setHistory((prev) => {
      const trimmed = prev.slice(0, historyIndex + 1);
      return [...trimmed, newAnnotations];
    });
    setHistoryIndex((prev) => prev + 1);
    setAnnotations(newAnnotations);
  }, [historyIndex]);

  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const prevIndex = historyIndex - 1;
      setHistoryIndex(prevIndex);
      setAnnotations(history[prevIndex]);
      setSelectedAnnotationId(null);
    }
  }, [history, historyIndex]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextIndex = historyIndex + 1;
      setHistoryIndex(nextIndex);
      setAnnotations(history[nextIndex]);
      setSelectedAnnotationId(null);
    }
  }, [history, historyIndex]);

  const handleRotate = useCallback(() => {
    setRotation((r) => ((r + 90) % 360) as 0 | 90 | 180 | 270);
  }, []);

  const handleResetOriginal = useCallback(() => {
    if (!originalImageUrlRef.current) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imageElementRef.current = img;
      setNaturalSize({ w: img.naturalWidth || 800, h: img.naturalHeight || 600 });
      setAnnotations([]);
      setHistory([[]]);
      setHistoryIndex(0);
      setRotation(0);
      setSelectedAnnotationId(null);
      setCropBox(null);
      setCropAspectRatio(null);
      setActiveTool('select');
      toast.success('Đã khôi phục ảnh về trạng thái ban đầu');
    };
    img.src = originalImageUrlRef.current;
  }, []);

  const handleCancelCrop = useCallback(() => {
    setCropBox(null);
    setCropAspectRatio(null);
    setActiveTool('select');
  }, []);

  const setCropRatio = useCallback((ratio: number | null) => {
    setCropAspectRatio(ratio);
    if (!cropBox) return;
    if (ratio) {
      let newH = cropBox.w / ratio;
      const isRot90 = rotation === 90 || rotation === 270;
      const maxH = isRot90 ? naturalSize.w : naturalSize.h;
      if (cropBox.y + newH > maxH) {
        newH = maxH - cropBox.y;
        const newW = newH * ratio;
        setCropBox((prev) => prev ? { ...prev, w: newW, h: newH } : null);
      } else {
        setCropBox((prev) => prev ? { ...prev, h: newH } : null);
      }
    }
  }, [cropBox, rotation, naturalSize]);

  const startCropDrag = (e: React.MouseEvent, mode: 'move' | 'nw' | 'ne' | 'se' | 'sw' | 'n' | 'e' | 's' | 'w') => {
    e.stopPropagation();
    e.preventDefault();
    if (!cropBox) return;
    setCropDragMode(mode);
    cropDragStartRef.current = {
      pt: { x: e.clientX, y: e.clientY },
      initialBox: { ...cropBox },
    };
  };

  const startCropDragTouch = (e: React.TouchEvent, mode: 'move' | 'nw' | 'ne' | 'se' | 'sw' | 'n' | 'e' | 's' | 'w') => {
    e.stopPropagation();
    if (!cropBox || !e.touches[0]) return;
    setCropDragMode(mode);
    cropDragStartRef.current = {
      pt: { x: e.touches[0].clientX, y: e.touches[0].clientY },
      initialBox: { ...cropBox },
    };
  };

  const updateCropWithDelta = useCallback((clientX: number, clientY: number) => {
    if (!cropDragMode || !cropDragStartRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const dx = (clientX - cropDragStartRef.current.pt.x) * scaleX;
    const dy = (clientY - cropDragStartRef.current.pt.y) * scaleY;
    const init = cropDragStartRef.current.initialBox;

    const maxW = canvas.width;
    const maxH = canvas.height;

    let newX = init.x;
    let newY = init.y;
    let newW = init.w;
    let newH = init.h;

    if (cropDragMode === 'move') {
      newX = Math.max(0, Math.min(maxW - init.w, init.x + dx));
      newY = Math.max(0, Math.min(maxH - init.h, init.y + dy));
    } else if (cropDragMode === 'se') {
      newW = Math.max(30, Math.min(maxW - init.x, init.w + dx));
      newH = cropAspectRatio ? newW / cropAspectRatio : Math.max(30, Math.min(maxH - init.y, init.h + dy));
      if (init.y + newH > maxH) {
        newH = maxH - init.y;
        if (cropAspectRatio) newW = newH * cropAspectRatio;
      }
    } else if (cropDragMode === 'sw') {
      const targetW = Math.max(30, init.w - dx);
      newX = Math.max(0, init.x + (init.w - targetW));
      newW = init.x + init.w - newX;
      newH = cropAspectRatio ? newW / cropAspectRatio : Math.max(30, Math.min(maxH - init.y, init.h + dy));
    } else if (cropDragMode === 'ne') {
      newW = Math.max(30, Math.min(maxW - init.x, init.w + dx));
      const targetH = cropAspectRatio ? newW / cropAspectRatio : Math.max(30, init.h - dy);
      newY = Math.max(0, init.y + (init.h - targetH));
      newH = init.y + init.h - newY;
    } else if (cropDragMode === 'nw') {
      const targetW = Math.max(30, init.w - dx);
      newX = Math.max(0, init.x + (init.w - targetW));
      newW = init.x + init.w - newX;
      const targetH = cropAspectRatio ? newW / cropAspectRatio : Math.max(30, init.h - dy);
      newY = Math.max(0, init.y + (init.h - targetH));
      newH = init.y + init.h - newY;
    } else if (cropDragMode === 'n') {
      const targetH = Math.max(30, init.h - dy);
      newY = Math.max(0, init.y + (init.h - targetH));
      newH = init.y + init.h - newY;
    } else if (cropDragMode === 's') {
      newH = Math.max(30, Math.min(maxH - init.y, init.h + dy));
    } else if (cropDragMode === 'w') {
      const targetW = Math.max(30, init.w - dx);
      newX = Math.max(0, init.x + (init.w - targetW));
      newW = init.x + init.w - newX;
    } else if (cropDragMode === 'e') {
      newW = Math.max(30, Math.min(maxW - init.x, init.w + dx));
    }

    setCropBox({ x: Math.round(newX), y: Math.round(newY), w: Math.round(newW), h: Math.round(newH) });
  }, [cropDragMode, cropAspectRatio]);

  const handleCropMouseMove = (e: React.MouseEvent) => {
    updateCropWithDelta(e.clientX, e.clientY);
  };

  const handleCropTouchMove = (e: React.TouchEvent) => {
    if (e.touches[0]) {
      updateCropWithDelta(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  const handleCropMouseUp = () => {
    setCropDragMode(null);
    cropDragStartRef.current = null;
  };

  useEffect(() => {
    const handleGlobalUp = () => {
      if (cropDragMode) {
        setCropDragMode(null);
        cropDragStartRef.current = null;
      }
    };
    window.addEventListener('mouseup', handleGlobalUp);
    window.addEventListener('touchend', handleGlobalUp);
    return () => {
      window.removeEventListener('mouseup', handleGlobalUp);
      window.removeEventListener('touchend', handleGlobalUp);
    };
  }, [cropDragMode]);

  const handleClearAll = useCallback(() => {
    if (annotations.length === 0) return;
    setConfirmClearOpen(true);
  }, [annotations.length]);

  const executeClearAll = useCallback(() => {
    pushState([]);
    setSelectedAnnotationId(null);
    setConfirmClearOpen(false);
    toast.success('Đã xóa tất cả nét vẽ và chú thích trên ảnh');
  }, [pushState]);

  // Draw arrow helper
  const drawArrowhead = (
    ctx: CanvasRenderingContext2D,
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    size: number
  ) => {
    const angle = Math.atan2(toY - fromY, toX - fromX);
    const headLength = Math.max(14, size * 2.8);

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(toX, toY);
    ctx.lineTo(
      toX - headLength * Math.cos(angle - Math.PI / 6),
      toY - headLength * Math.sin(angle - Math.PI / 6)
    );
    ctx.lineTo(
      toX - headLength * Math.cos(angle + Math.PI / 6),
      toY - headLength * Math.sin(angle + Math.PI / 6)
    );
    ctx.closePath();
    ctx.fillStyle = ctx.strokeStyle;
    ctx.fill();
    ctx.restore();
  };

  // Convert hex color to rgba with opacity
  const hexToRgba = (hex: string, alpha: number) => {
    const cleanHex = hex.replace('#', '');
    let r = 0, g = 0, b = 0;
    if (cleanHex.length === 3) {
      r = parseInt(cleanHex[0] + cleanHex[0], 16);
      g = parseInt(cleanHex[1] + cleanHex[1], 16);
      b = parseInt(cleanHex[2] + cleanHex[2], 16);
    } else if (cleanHex.length === 6) {
      r = parseInt(cleanHex.substring(0, 2), 16);
      g = parseInt(cleanHex.substring(2, 4), 16);
      b = parseInt(cleanHex.substring(4, 6), 16);
    }
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  // Redraw canvas with full resolution
  const renderCanvas = useCallback(
    (extraAnnotation?: Annotation | null) => {
      const canvas = canvasRef.current;
      const img = imageElementRef.current;
      if (!canvas || !img || !imgLoaded) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const isRotated90or270 = rotation === 90 || rotation === 270;
      const targetW = isRotated90or270 ? naturalSize.h : naturalSize.w;
      const targetH = isRotated90or270 ? naturalSize.w : naturalSize.h;

      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }

      ctx.clearRect(0, 0, targetW, targetH);

      // 1. Draw base image with rotation
      ctx.save();
      ctx.translate(targetW / 2, targetH / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.drawImage(img, -naturalSize.w / 2, -naturalSize.h / 2, naturalSize.w, naturalSize.h);
      ctx.restore();

      // 2. Combine permanent annotations + in-progress active annotation
      const allToDraw = [...annotations];
      if (extraAnnotation) {
        allToDraw.push(extraAnnotation);
      }

      // 3. Render all annotations
      for (const item of allToDraw) {
        if (item.type === 'pen') {
          const path = item as PathAnnotation;
          if (path.points.length < 2) continue;
          ctx.save();
          ctx.strokeStyle = path.color;
          ctx.lineWidth = path.strokeWidth;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';

          ctx.beginPath();
          ctx.moveTo(path.points[0].x, path.points[0].y);
          for (let i = 1; i < path.points.length; i++) {
            ctx.lineTo(path.points[i].x, path.points[i].y);
          }
          ctx.stroke();
          ctx.restore();
        } else if (item.type === 'highlighter') {
          const path = item as PathAnnotation;
          if (path.points.length < 2) continue;
          ctx.save();
          ctx.globalCompositeOperation = 'multiply';
          ctx.strokeStyle = hexToRgba(path.color, 0.45);
          ctx.lineWidth = Math.max(16, path.strokeWidth * 3);
          ctx.lineCap = 'square';
          ctx.lineJoin = 'bevel';

          ctx.beginPath();
          ctx.moveTo(path.points[0].x, path.points[0].y);
          for (let i = 1; i < path.points.length; i++) {
            ctx.lineTo(path.points[i].x, path.points[i].y);
          }
          ctx.stroke();
          ctx.restore();
        } else if (item.type === 'rect') {
          const shape = item as ShapeAnnotation;
          ctx.save();
          ctx.strokeStyle = shape.color;
          ctx.lineWidth = shape.strokeWidth;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';

          const x = Math.min(shape.startX, shape.endX);
          const y = Math.min(shape.startY, shape.endY);
          const w = Math.abs(shape.endX - shape.startX);
          const h = Math.abs(shape.endY - shape.startY);
          const variant = shape.shapeVariant || 'rect';

          ctx.beginPath();
          if (variant === 'roundRect') {
            ctx.roundRect(x, y, w, h, Math.min(16, w / 4, h / 4));
          } else if (variant === 'circle' || variant === 'ellipse') {
            const cx = x + w / 2;
            const cy = y + h / 2;
            ctx.ellipse(cx, cy, Math.max(1, w / 2), Math.max(1, h / 2), 0, 0, Math.PI * 2);
          } else if (variant === 'triangle') {
            ctx.moveTo(x + w / 2, y);
            ctx.lineTo(x + w, y + h);
            ctx.lineTo(x, y + h);
            ctx.closePath();
          } else if (variant === 'star') {
            const cx = x + w / 2;
            const cy = y + h / 2;
            const outerR = Math.min(w, h) / 2;
            const innerR = outerR * 0.42;
            const points = 5;
            for (let pIdx = 0; pIdx < points * 2; pIdx++) {
              const r = pIdx % 2 === 0 ? outerR : innerR;
              const angle = (pIdx * Math.PI) / points - Math.PI / 2;
              const px = cx + r * Math.cos(angle);
              const py = cy + r * Math.sin(angle);
              if (pIdx === 0) ctx.moveTo(px, py);
              else ctx.lineTo(px, py);
            }
            ctx.closePath();
          } else {
            // Pure rectangle without fill
            ctx.rect(x, y, w, h);
          }

          // Strict user requirement: Không đổ màu bên trong khung hình
          ctx.stroke();
          ctx.restore();
        } else if (item.type === 'arrow') {
          const shape = item as ShapeAnnotation;
          ctx.save();
          ctx.strokeStyle = shape.color;
          ctx.lineWidth = shape.strokeWidth;
          ctx.lineCap = 'round';

          ctx.beginPath();
          ctx.moveTo(shape.startX, shape.startY);
          ctx.lineTo(shape.endX, shape.endY);
          ctx.stroke();

          drawArrowhead(ctx, shape.startX, shape.startY, shape.endX, shape.endY, shape.strokeWidth);
          ctx.restore();
        } else if (item.type === 'text') {
          // Pure typographic text (customizable font, size, bold, italic, alignment, effects)
          const textItem = item as TextAnnotation;
          if (!textItem.text.trim()) continue;

          ctx.save();
          const fontSize = textItem.fontSize || 24;
          const weight = textItem.isBold ? '700' : '500';
          const style = textItem.isItalic ? 'italic' : 'normal';
          const family = textItem.fontFamily || '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
          ctx.font = `${style} ${weight} ${fontSize}px ${family}`;

          const lines = textItem.text.split('\n');
          const lineHeight = fontSize * 1.35;
          const align = textItem.textAlign || 'left';
          ctx.textAlign = align;

          // Compute max width
          let maxLineW = 0;
          lines.forEach((l) => {
            const w = ctx.measureText(l).width;
            if (w > maxLineW) maxLineW = w;
          });
          const boxW = Math.max(maxLineW, textItem.width || 100);

          // X base per alignment
          const getLineX = (line: string) => {
            if (align === 'center') return textItem.x + boxW / 2;
            if (align === 'right') return textItem.x + boxW;
            return textItem.x;
          };

          // Apply text blur if enabled
          const eff = textItem.effects;
          if (eff?.blurEnabled && (eff.blurRadius || 0) > 0) {
            ctx.filter = `blur(${eff.blurRadius}px)`;
          } else {
            ctx.filter = 'none';
          }

          // Apply drop shadow if enabled (NO DEFAULT BLUR OR SHADOW)
          if (eff?.shadowEnabled) {
            const angleRad = ((eff.shadowAngle || 45) * Math.PI) / 180;
            const dist = eff.shadowOffset || 2;
            ctx.shadowColor = eff.shadowColor || 'rgba(0,0,0,0.7)';
            ctx.shadowBlur = eff.shadowBlur ?? 4;
            ctx.shadowOffsetX = Math.round(dist * Math.cos(angleRad));
            ctx.shadowOffsetY = Math.round(dist * Math.sin(angleRad));
          } else {
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
          }

          // If text stroke/outline is enabled, stroke first then fill
          if (eff?.strokeEnabled && (eff.strokeWidth || 0) > 0) {
            ctx.strokeStyle = eff.strokeColor || '#000000';
            ctx.lineWidth = (eff.strokeWidth || 2) * 2;
            ctx.lineJoin = 'round';
            ctx.textBaseline = 'top';
            lines.forEach((line, index) => {
              ctx.strokeText(line, getLineX(line), textItem.y + index * lineHeight);
            });
          }

          ctx.fillStyle = textItem.color;
          ctx.textBaseline = 'top';
          lines.forEach((line, index) => {
            ctx.fillText(line, getLineX(line), textItem.y + index * lineHeight);
          });

          ctx.restore();
        } else if (item.type === 'note') {
          // Sticky Note: Anchor Pin on Image + Dashed connecting line to side callout card
          const noteItem = item as NoteAnnotation;
          ctx.save();

          // Draw anchor pin on image
          ctx.fillStyle = '#F59E0B';
          ctx.beginPath();
          ctx.arc(noteItem.anchorX, noteItem.anchorY, 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 2;
          ctx.stroke();

          // Inner pin pulse dot
          ctx.fillStyle = '#FFFFFF';
          ctx.beginPath();
          ctx.arc(noteItem.anchorX, noteItem.anchorY, 2, 0, Math.PI * 2);
          ctx.fill();

          // When selected, draw delicate elegant dashed connecting line from anchor to card
          if (selectedAnnotationId === noteItem.id) {
            const targetX = noteItem.side === 'left' ? 10 : (targetW - 10);
            const targetY = Math.max(20, Math.min(targetH - 60, noteItem.anchorY + (noteItem.yOffset || 0)));

            ctx.strokeStyle = 'rgba(245, 158, 11, 0.75)';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(noteItem.anchorX, noteItem.anchorY);
            ctx.lineTo(targetX, targetY + 20);
            ctx.stroke();
          }

          ctx.restore();
        }

        // Selection highlight ring & Resizing Handle in 'select' mode
        if (selectedAnnotationId === item.id) {
          ctx.save();
          ctx.strokeStyle = '#0071e3';
          ctx.lineWidth = 2;
          ctx.setLineDash([5, 5]);

          if (item.type === 'rect') {
            const s = item as ShapeAnnotation;
            const x = Math.min(s.startX, s.endX) - 6;
            const y = Math.min(s.startY, s.endY) - 6;
            const w = Math.abs(s.endX - s.startX) + 12;
            const h = Math.abs(s.endY - s.startY) + 12;
            ctx.strokeRect(x, y, w, h);
          } else if (item.type === 'text') {
            const t = item as TextAnnotation;
            const lines = t.text.split('\n');
            ctx.font = `${t.isItalic ? 'italic' : 'normal'} ${t.isBold ? '700' : '500'} ${t.fontSize}px ${t.fontFamily || 'sans-serif'}`;
            let maxW = 0;
            lines.forEach((l) => {
              const w = ctx.measureText(l).width;
              if (w > maxW) maxW = w;
            });
            const textW = Math.max(maxW, t.width || 100);
            const textH = lines.length * (t.fontSize * 1.35);

            // Bounding box only drawn when selected
            ctx.strokeRect(t.x - 6, t.y - 6, textW + 12, textH + 12);

            // Interactive Resize Handle on Bottom-Right corner
            ctx.setLineDash([]);
            ctx.fillStyle = '#0071e3';
            ctx.beginPath();
            ctx.arc(t.x + textW + 6, t.y + textH + 6, 7, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // Quick Delete Button (✕) on Top-Right corner
            const closeX = t.x + textW + 6;
            const closeY = t.y - 6;
            ctx.fillStyle = '#EF4444';
            ctx.beginPath();
            ctx.arc(closeX, closeY, 8, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // Draw white '✕' inside close button
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 1.8;
            ctx.beginPath();
            ctx.moveTo(closeX - 3.5, closeY - 3.5);
            ctx.lineTo(closeX + 3.5, closeY + 3.5);
            ctx.moveTo(closeX + 3.5, closeY - 3.5);
            ctx.lineTo(closeX - 3.5, closeY + 3.5);
            ctx.stroke();
          } else if (item.type === 'note') {
            const n = item as NoteAnnotation;
            // Draw highlight ring on anchor pin
            ctx.strokeStyle = '#F59E0B';
            ctx.lineWidth = 2;
            ctx.setLineDash([3, 3]);
            ctx.beginPath();
            ctx.arc(n.anchorX, n.anchorY, 14, 0, Math.PI * 2);
            ctx.stroke();
          }
          ctx.restore();
        }
      }
    },
    [annotations, naturalSize, rotation, imgLoaded, selectedAnnotationId]
  );

  // Trigger render on changes
  useEffect(() => {
    renderCanvas();
  }, [renderCanvas]);

  const handleApplyCrop = useCallback(() => {
    if (!cropBox || !imageElementRef.current || !canvasRef.current) return;
    renderCanvas(null);
    const cropCanvas = document.createElement('canvas');
    const cropW = Math.max(10, Math.round(cropBox.w));
    const cropH = Math.max(10, Math.round(cropBox.h));
    cropCanvas.width = cropW;
    cropCanvas.height = cropH;
    const ctx = cropCanvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(
      canvasRef.current,
      Math.round(cropBox.x),
      Math.round(cropBox.y),
      cropW,
      cropH,
      0,
      0,
      cropW,
      cropH
    );

    const croppedDataUrl = cropCanvas.toDataURL('image/png');
    const newImg = new Image();
    newImg.crossOrigin = 'anonymous';
    newImg.onload = () => {
      imageElementRef.current = newImg;
      setNaturalSize({ w: newImg.naturalWidth, h: newImg.naturalHeight });
      setAnnotations([]);
      setHistory([[]]);
      setHistoryIndex(0);
      setRotation(0);
      setCropBox(null);
      setCropAspectRatio(null);
      setActiveTool('select');
      toast.success('Đã cắt hình ảnh thành công');
    };
    newImg.src = croppedDataUrl;
  }, [cropBox, renderCanvas]);

  const handleFontFamilyChange = (font: string) => {
    setSelectedFontFamily(font);
    if (selectedAnnotationId) {
      const updated = annotations.map((a) =>
        a.id === selectedAnnotationId && a.type === 'text' ? { ...a, fontFamily: font } : a
      );
      pushState(updated);
    }
  };

  const handleToggleBold = () => {
    const nextVal = !isBold;
    setIsBold(nextVal);
    if (selectedAnnotationId) {
      const updated = annotations.map((a) =>
        a.id === selectedAnnotationId && a.type === 'text' ? { ...a, isBold: nextVal } : a
      );
      pushState(updated);
    }
  };

  const handleToggleItalic = () => {
    const nextVal = !isItalic;
    setIsItalic(nextVal);
    if (selectedAnnotationId) {
      const updated = annotations.map((a) =>
        a.id === selectedAnnotationId && a.type === 'text' ? { ...a, isItalic: nextVal } : a
      );
      pushState(updated);
    }
  };

  const handleTextAlignChange = (align: 'left' | 'center' | 'right') => {
    setSelectedTextAlign(align);
    if (selectedAnnotationId) {
      const updated = annotations.map((a) =>
        a.id === selectedAnnotationId && a.type === 'text' ? { ...a, textAlign: align } : a
      );
      pushState(updated);
    }
  };

  // Convert mouse/touch event coordinates into canvas natural image coordinates
  const getCanvasCoords = (e: React.MouseEvent | React.TouchEvent): Point | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  // Convert canvas coords to viewport screen pixels (for inline textarea overlay positioning)
  const getScreenCoords = (canvasPt: Point): { x: number; y: number } | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = rect.width / canvas.width;
    const scaleY = rect.height / canvas.height;
    return {
      x: rect.left + canvasPt.x * scaleX,
      y: rect.top + canvasPt.y * scaleY,
    };
  };

  // Distance helper between point and line segment
  const distToSegment = (p: Point, v: Point, w: Point) => {
    const l2 = (w.x - v.x) ** 2 + (w.y - v.y) ** 2;
    if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
    let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p.x - (v.x + t * (w.x - v.x)), p.y - (v.y + t * (w.y - v.y)));
  };

  // Check if click hit resize handle of selected text
  const isHitResizeHandle = (pt: Point, t: TextAnnotation): boolean => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return false;
    ctx.font = `${t.isItalic ? 'italic' : 'normal'} ${t.isBold ? '700' : '500'} ${t.fontSize}px ${t.fontFamily || 'sans-serif'}`;
    const lines = t.text.split('\n');
    let maxW = 0;
    lines.forEach((l) => {
      const w = ctx.measureText(l).width;
      if (w > maxW) maxW = w;
    });
    const textW = Math.max(maxW, t.width || 100);
    const textH = lines.length * (t.fontSize * 1.35);
    const handleX = t.x + textW + 6;
    const handleY = t.y + textH + 6;
    return Math.hypot(pt.x - handleX, pt.y - handleY) <= 16;
  };

  // Check if click hit quick close button of selected text
  const isHitTextCloseBtn = (pt: Point, t: TextAnnotation): boolean => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return false;
    ctx.font = `${t.isItalic ? 'italic' : 'normal'} ${t.isBold ? '700' : '500'} ${t.fontSize}px ${t.fontFamily || 'sans-serif'}`;
    const lines = t.text.split('\n');
    let maxW = 0;
    lines.forEach((l) => {
      const w = ctx.measureText(l).width;
      if (w > maxW) maxW = w;
    });
    const textW = Math.max(maxW, t.width || 100);
    const closeX = t.x + textW + 6;
    const closeY = t.y - 6;
    return Math.hypot(pt.x - closeX, pt.y - closeY) <= 16;
  };

  // Find annotation at coordinate (for Select, Move, Eraser or Text edit)
  const findAnnotationAt = (pt: Point): Annotation | null => {
    const threshold = 18;
    for (let i = annotations.length - 1; i >= 0; i--) {
      const a = annotations[i];
      if (a.type === 'pen' || a.type === 'highlighter') {
        const path = a as PathAnnotation;
        for (let j = 0; j < path.points.length - 1; j++) {
          if (distToSegment(pt, path.points[j], path.points[j + 1]) < threshold + a.strokeWidth) {
            return a;
          }
        }
      } else if (a.type === 'rect') {
        const shape = a as ShapeAnnotation;
        const minX = Math.min(shape.startX, shape.endX);
        const maxX = Math.max(shape.startX, shape.endX);
        const minY = Math.min(shape.startY, shape.endY);
        const maxY = Math.max(shape.startY, shape.endY);
        if (pt.x >= minX - threshold && pt.x <= maxX + threshold && pt.y >= minY - threshold && pt.y <= maxY + threshold) {
          return a;
        }
      } else if (a.type === 'arrow') {
        const shape = a as ShapeAnnotation;
        if (distToSegment(pt, { x: shape.startX, y: shape.startY }, { x: shape.endX, y: shape.endY }) < threshold + a.strokeWidth) {
          return a;
        }
      } else if (a.type === 'text') {
        const t = a as TextAnnotation;
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (ctx) {
          ctx.font = `${t.isItalic ? 'italic' : 'normal'} ${t.isBold ? '700' : '500'} ${t.fontSize}px ${t.fontFamily || 'sans-serif'}`;
          const lines = t.text.split('\n');
          let maxW = 0;
          lines.forEach((l) => {
            const w = ctx.measureText(l).width;
            if (w > maxW) maxW = w;
          });
          const boxW = Math.max(maxW, t.width || 100) + 16;
          const boxH = lines.length * (t.fontSize * 1.35) + 16;
          if (pt.x >= t.x - 8 && pt.x <= t.x + boxW && pt.y >= t.y - 8 && pt.y <= t.y + boxH) {
            return a;
          }
        }
      } else if (a.type === 'note') {
        const n = a as NoteAnnotation;
        // Hit-test on anchor pin on image
        if (Math.hypot(pt.x - n.anchorX, pt.y - n.anchorY) <= 20) {
          return a;
        }
      }
    }
    return null;
  };

  // Erase annotation at coordinate
  const eraseAt = (pt: Point) => {
    const hit = findAnnotationAt(pt);
    if (hit) {
      const remaining = annotations.filter((a) => a.id !== hit.id);
      pushState(remaining);
      if (selectedAnnotationId === hit.id) {
        setSelectedAnnotationId(null);
      }
    }
  };

  // Pointer Down (Start drawing / In-image Text click / Eraser / Select & Move)
  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
    if (activeTool === 'crop') return;
    const pt = getCanvasCoords(e);
    if (!pt) return;

    // Commit any currently open inline text before starting a new action
    if (activeInlineText) {
      commitActiveInlineText();
      return;
    }

    // ── SELECT / MOVE / RESIZE MODE ──
    if (activeTool === 'select') {
      // Check if clicking close button of selected text -> Quick delete
      if (selectedAnnotationId) {
        const selected = annotations.find((a) => a.id === selectedAnnotationId);
        if (selected && selected.type === 'text' && isHitTextCloseBtn(pt, selected as TextAnnotation)) {
          const remaining = annotations.filter((a) => a.id !== selectedAnnotationId);
          pushState(remaining);
          setSelectedAnnotationId(null);
          toast.success('Đã xóa hộp chữ');
          return;
        }

        // Check if clicking resize handle of an already selected text
        if (selected && selected.type === 'text' && isHitResizeHandle(pt, selected as TextAnnotation)) {
          setIsResizingText(true);
          dragStartPointRef.current = pt;
          dragOriginalAnnotationRef.current = JSON.parse(JSON.stringify(selected));
          return;
        }
      }

      const hit = findAnnotationAt(pt);
      if (hit) {
        setSelectedAnnotationId(hit.id);
        setIsDraggingSelected(true);
        dragStartPointRef.current = pt;
        dragOriginalAnnotationRef.current = JSON.parse(JSON.stringify(hit));
      } else {
        setSelectedAnnotationId(null);
      }
      return;
    }

    if (activeTool === 'eraser') {
      eraseAt(pt);
      setIsDrawing(true);
      return;
    }

    // ── DIRECT IN-IMAGE TEXT MODE ──
    if (activeTool === 'text') {
      const hit = findAnnotationAt(pt);

      if (hit && hit.type === 'text') {
        const t = hit as TextAnnotation;
        setActiveInlineText({
          id: t.id,
          type: 'text',
          canvasX: t.x,
          canvasY: t.y,
          width: t.width || 220,
          text: t.text,
        });
        setAnnotations((prev) => prev.filter((a) => a.id !== t.id));
      } else {
        // Direct inline in-image text box
        setActiveInlineText({
          type: 'text',
          canvasX: pt.x,
          canvasY: pt.y,
          width: 240,
          text: '',
        });
      }
      return;
    }

    // ── NOTE (SIDE CALLOUT STICKY) MODE ──
    if (activeTool === 'note') {
      const isRotated90or270 = rotation === 90 || rotation === 270;
      const targetW = isRotated90or270 ? naturalSize.h : naturalSize.w;
      const side = pt.x < (targetW / 2) ? 'left' : 'right';

      const newNote: NoteAnnotation = {
        id: 'ann_note_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        type: 'note',
        anchorX: pt.x,
        anchorY: pt.y,
        side,
        yOffset: 0,
        color: '#FEF3C7',
        strokeWidth: 1,
        text: 'Nhập ghi chú mới...',
        fontSize: 14,
      };

      pushState([...annotations, newNote]);
      setSelectedAnnotationId(newNote.id);
      toast.success(side === 'left' ? 'Đã thêm thẻ ghi chú cạnh trái' : 'Đã thêm thẻ ghi chú cạnh phải');
      return;
    }

    // DRAWING: Pen, Highlighter, Rect, Arrow
    setIsDrawing(true);
    shapeStartRef.current = pt;

    if (activeTool === 'pen' || activeTool === 'highlighter') {
      currentPathRef.current = [pt];
      const newPathAnnotation: PathAnnotation = {
        id: 'ann_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        type: activeTool,
        color: selectedColor,
        strokeWidth: selectedStrokeWidth,
        points: [pt],
      };
      activeAnnotationRef.current = newPathAnnotation;
      renderCanvas(newPathAnnotation);
    } else if (activeTool === 'rect' || activeTool === 'arrow') {
      const newShapeAnnotation: ShapeAnnotation = {
        id: 'ann_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        type: activeTool,
        shapeVariant: activeTool === 'rect' ? selectedShapeVariant : undefined,
        color: selectedColor,
        strokeWidth: selectedStrokeWidth,
        startX: pt.x,
        startY: pt.y,
        endX: pt.x,
        endY: pt.y,
      };
      activeAnnotationRef.current = newShapeAnnotation;
      renderCanvas(newShapeAnnotation);
    }
  };

  // Pointer Move (Drawing update / Move selected / Resize Text / Continuous Eraser)
  const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (activeTool === 'crop') return;
    const pt = getCanvasCoords(e);
    if (!pt) return;

    // ── RESIZE SELECTED TEXT (Expand box directly on image) ──
    if (activeTool === 'select' && isResizingText && dragStartPointRef.current && dragOriginalAnnotationRef.current) {
      const orig = dragOriginalAnnotationRef.current as TextAnnotation;
      const dx = pt.x - dragStartPointRef.current.x;
      const dy = pt.y - dragStartPointRef.current.y;
      const newWidth = Math.max(80, (orig.width || 120) + dx);
      // Scale font size proportionally if dragging vertically
      const newFontSize = Math.min(80, Math.max(12, Math.round(orig.fontSize + dy * 0.15)));

      setAnnotations((prev) =>
        prev.map((item) => {
          if (item.id !== orig.id) return item;
          return {
            ...item,
            width: newWidth,
            fontSize: newFontSize,
          } as TextAnnotation;
        })
      );
      return;
    }

    // ── MOVE SELECTED ANNOTATION ──
    if (activeTool === 'select' && isDraggingSelected && dragStartPointRef.current && dragOriginalAnnotationRef.current) {
      const dx = pt.x - dragStartPointRef.current.x;
      const dy = pt.y - dragStartPointRef.current.y;
      const orig = dragOriginalAnnotationRef.current;

      setAnnotations((prev) =>
        prev.map((item) => {
          if (item.id !== orig.id) return item;

          if (orig.type === 'pen' || orig.type === 'highlighter') {
            const pOrig = orig as PathAnnotation;
            return {
              ...pOrig,
              points: pOrig.points.map((p) => ({ x: p.x + dx, y: p.y + dy })),
            };
          } else if (orig.type === 'rect' || orig.type === 'arrow') {
            const sOrig = orig as ShapeAnnotation;
            return {
              ...sOrig,
              startX: sOrig.startX + dx,
              startY: sOrig.startY + dy,
              endX: sOrig.endX + dx,
              endY: sOrig.endY + dy,
            };
          } else if (orig.type === 'text') {
            const tOrig = orig as TextAnnotation;
            return {
              ...tOrig,
              x: tOrig.x + dx,
              y: tOrig.y + dy,
            };
          } else if (orig.type === 'note') {
            const nOrig = orig as NoteAnnotation;
            return {
              ...nOrig,
              anchorX: nOrig.anchorX + dx,
              anchorY: nOrig.anchorY + dy,
            };
          }
          return item;
        })
      );
      return;
    }

    if (!isDrawing) return;

    if (activeTool === 'eraser') {
      eraseAt(pt);
      return;
    }

    if (activeTool === 'pen' || activeTool === 'highlighter') {
      currentPathRef.current.push(pt);
      if (activeAnnotationRef.current && 'points' in activeAnnotationRef.current) {
        (activeAnnotationRef.current as PathAnnotation).points = [...currentPathRef.current];
        renderCanvas(activeAnnotationRef.current);
      }
    } else if (activeTool === 'rect' || activeTool === 'arrow') {
      if (activeAnnotationRef.current && 'startX' in activeAnnotationRef.current) {
        const shape = activeAnnotationRef.current as ShapeAnnotation;
        shape.endX = pt.x;
        shape.endY = pt.y;
        renderCanvas(shape);
      }
    }
  };

  // Pointer Up (Commit drawn shape/path or finish dragging/resizing)
  const handlePointerUp = () => {
    if (activeTool === 'crop') return;
    // ── FINISH RESIZING TEXT ──
    if (isResizingText) {
      setIsResizingText(false);
      dragStartPointRef.current = null;
      dragOriginalAnnotationRef.current = null;
      pushState([...annotations]);
      return;
    }

    // ── FINISH DRAGGING IN SELECT MODE ──
    if (isDraggingSelected) {
      setIsDraggingSelected(false);
      dragStartPointRef.current = null;
      dragOriginalAnnotationRef.current = null;
      pushState([...annotations]);
      return;
    }

    if (!isDrawing) return;
    setIsDrawing(false);

    if (activeTool === 'eraser') {
      return;
    }

    if (activeAnnotationRef.current) {
      const finished = activeAnnotationRef.current;
      activeAnnotationRef.current = null;
      currentPathRef.current = [];
      shapeStartRef.current = null;

      // Discard trivial click dots for shapes
      if (finished.type === 'rect' || finished.type === 'arrow') {
        const s = finished as ShapeAnnotation;
        if (Math.hypot(s.endX - s.startX, s.endY - s.startY) < 6) {
          renderCanvas(null);
          return;
        }
      }

      pushState([...annotations, finished]);
    }
  };

  // Commit typed text
  const commitActiveInlineText = () => {
    if (!activeInlineText) return;
    const trimmed = activeInlineText.text.trim();
    if (trimmed) {
      const textAnn: TextAnnotation = {
        id: activeInlineText.id || 'ann_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        type: 'text',
        color: selectedColor,
        strokeWidth: 2,
        x: activeInlineText.canvasX,
        y: activeInlineText.canvasY,
        width: activeInlineText.width,
        text: trimmed,
        fontSize: selectedFontSize,
        fontFamily: selectedFontFamily,
        textAlign: selectedTextAlign,
        isBold,
        isItalic,
        effects: { ...textEffects },
      };
      pushState([...annotations, textAnn]);
      setSelectedAnnotationId(textAnn.id);
    }
    setActiveInlineText(null);
  };

  // Keyboard shortcuts
  useEffect(() => {
    if (!shouldRender || isExiting) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const isTyping = document.activeElement?.tagName === 'TEXTAREA' || document.activeElement?.tagName === 'INPUT';

      if (e.key === 'Escape') {
        e.preventDefault();
        if (activeInlineText) {
          commitActiveInlineText();
        } else if (activeTool !== 'select') {
          setActiveTool('select');
        } else {
          onClose();
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSave();
        return;
      }

      // Delete selected annotation in select mode
      if (!isTyping && (e.key === 'Delete' || e.key === 'Backspace') && selectedAnnotationId) {
        e.preventDefault();
        const remaining = annotations.filter((a) => a.id !== selectedAnnotationId);
        pushState(remaining);
        setSelectedAnnotationId(null);
        toast.success('Đã xóa đối tượng được chọn');
        return;
      }

      if (!isTyping && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const k = e.key.toLowerCase();
        if (k === 'v' || k === 's') setActiveTool('select');
        else if (k === 'p') handleSelectTool('pen');
        else if (k === 'h') handleSelectTool('highlighter');
        else if (k === 'r') handleRotate();
        else if (k === 'u') handleSelectTool('rect');
        else if (k === 'a') handleSelectTool('arrow');
        else if (k === 't') handleSelectTool('text');
        else if (k === 'n') handleSelectTool('note');
        else if (k === 'e') handleSelectTool('eraser');
        else if (k === 'c') {
          if (activeTool === 'crop') {
            setActiveTool('select');
            setCropBox(null);
          } else {
            setActiveTool('crop');
            const isRot90 = rotation === 90 || rotation === 270;
            const curW = isRot90 ? naturalSize.h : naturalSize.w;
            const curH = isRot90 ? naturalSize.w : naturalSize.h;
            const initW = Math.round(curW * 0.85);
            const initH = Math.round(curH * 0.85);
            setCropBox({
              x: Math.round((curW - initW) / 2),
              y: Math.round((curH - initH) / 2),
              w: initW,
              h: initH,
            });
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shouldRender, isExiting, activeInlineText, handleUndo, handleRedo, annotations, activeTool, selectedAnnotationId, onClose]);

  // Export full-res dataURL from canvas
  const exportEditedImage = async (): Promise<{ dataUrl: string; size: number } | null> => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    // Render final clean state without selection boxes or helper overlays
    renderCanvas(null);

    const dataUrl = canvas.toDataURL('image/png', 0.95);
    const head = 'data:image/png;base64,';
    const base64Len = dataUrl.length - head.length;
    const size = Math.round((base64Len * 3) / 4);

    return { dataUrl, size };
  };

  // Action: Save to note
  const handleSave = async () => {
    try {
      setIsSaving(true);
      commitActiveInlineText();

      const res = await exportEditedImage();
      if (!res) {
        toast.error('Không thể xuất dữ liệu hình ảnh');
        setIsSaving(false);
        return;
      }

      const originalName = image.name || 'annotated-image.png';
      const cleanName = originalName.replace(/\.[^/.]+$/, '') + '_edited.png';

      await onSave(res.dataUrl, cleanName, res.size);
      toast.success('Đã lưu chỉnh sửa ảnh vào ghi chú!');
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khi lưu ảnh');
    } finally {
      setIsSaving(false);
    }
  };

  // Action: Download
  const handleDownload = async () => {
    commitActiveInlineText();
    const res = await exportEditedImage();
    if (!res) return;
    const filename = (image.name ? image.name.replace(/\.[^/.]+$/, '') : 'note-image') + '_markup.png';
    downloadImage(res.dataUrl, filename);
    toast.success('Đã tải hình ảnh đã chỉnh sửa về máy!');
  };

  // Action: Copy to clipboard
  const handleCopy = async () => {
    commitActiveInlineText();
    const res = await exportEditedImage();
    if (!res) return;
    await copyImageToClipboard(res.dataUrl);
    toast.success('Đã sao chép ảnh vào clipboard!');
  };

  if (!shouldRender) return null;

  // Compute screen position of active inline text directly on top of image
  const inlineScreenPos = activeInlineText ? getScreenCoords({ x: activeInlineText.canvasX, y: activeInlineText.canvasY }) : null;
  const canvasScale = canvasRef.current && naturalSize.w > 0 ? canvasRef.current.getBoundingClientRect().width / canvasRef.current.width : 1;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Chỉnh sửa hình ảnh Apple Markup"
      className={cn(
        "fixed inset-0 z-[10020] flex flex-col bg-black/85 backdrop-blur-3xl select-none overflow-hidden will-change-[transform,opacity] [transform:translateZ(0)]",
        isExiting ? "liquid-backdrop-exit pointer-events-none" : "liquid-backdrop-enter pointer-events-auto"
      )}
    >
      {/* ────────────────── TOP BAR (Header Actions - Perfectly Centered) ────────────────── */}
      <header className="h-14 sm:h-16 grid grid-cols-3 items-center px-4 sm:px-6 border-b border-white/10 shrink-0 z-30">
        {/* Left: Info & Filename */}
        <div className="flex items-center gap-2.5 min-w-0 justify-self-start">
          <div className="w-8 h-8 rounded-full bg-white/10 text-white flex items-center justify-center shrink-0">
            <SFPhoto size={16} />
          </div>
          <div className="min-w-0">
            <h3 className="text-[13.5px] font-semibold text-white truncate max-w-[180px] sm:max-w-xs">
              Chỉnh sửa: {image.name || 'Hình ảnh'}
            </h3>
            <p className="text-[11px] text-white/60">
              {naturalSize.w} × {naturalSize.h}px • {image.size ? formatFileSize(image.size) : 'Ảnh ghi chú'} • {annotations.length} ghi chú
            </p>
          </div>
        </div>

        {/* Center: History (Undo, Redo, Rotate, Reset, Delete Selected, Clear All) - Strictly Centered via Grid */}
        <div className="justify-self-center flex items-center gap-1 sm:gap-1.5 px-2.5 py-1 rounded-full bg-white/10 border border-white/15 backdrop-blur-xl shadow-xs">
          <button
            type="button"
            onClick={handleUndo}
            disabled={historyIndex === 0}
            className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center text-white/90 hover:text-white hover:bg-white/15 transition-all active:scale-90 cursor-pointer",
              historyIndex === 0 && "opacity-35 pointer-events-none"
            )}
            title="Hoàn tác (Ctrl+Z)"
          >
            <SFArrowUturnBackward size={14} />
          </button>

          <button
            type="button"
            onClick={handleRedo}
            disabled={historyIndex >= history.length - 1}
            className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center text-white/90 hover:text-white hover:bg-white/15 transition-all active:scale-90 cursor-pointer",
              historyIndex >= history.length - 1 && "opacity-35 pointer-events-none"
            )}
            title="Làm lại (Ctrl+Y)"
          >
            <SFArrowUturnForward size={14} />
          </button>

          <span className="w-[1px] h-4 bg-white/20 mx-0.5" />

          <button
            type="button"
            onClick={handleRotate}
            className="w-8 h-8 rounded-full flex items-center justify-center text-white/90 hover:text-white hover:bg-white/15 transition-all active:scale-90 cursor-pointer"
            title="Xoay ảnh 90° (Phím R)"
          >
            <SFArrowClockwise size={14} />
          </button>

          <button
            type="button"
            onClick={handleResetOriginal}
            className="w-8 h-8 rounded-full flex items-center justify-center text-white/90 hover:text-white hover:bg-white/15 transition-all active:scale-90 cursor-pointer"
            title="Khôi phục ảnh gốc ban đầu"
          >
            <SFArrowCounterclockwise size={14} />
          </button>

          {selectedAnnotationId && (
            <button
              type="button"
              onClick={() => {
                const remaining = annotations.filter((a) => a.id !== selectedAnnotationId);
                pushState(remaining);
                setSelectedAnnotationId(null);
                toast.success('Đã xóa đối tượng được chọn');
              }}
              className="w-8 h-8 rounded-full flex items-center justify-center text-red-400 hover:text-red-300 hover:bg-red-500/20 transition-all active:scale-90 cursor-pointer"
              title="Xóa đối tượng đang chọn (Phím Del)"
            >
              <SFTrash size={14} />
            </button>
          )}

          <button
            type="button"
            onClick={handleClearAll}
            disabled={annotations.length === 0}
            className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center text-white/90 hover:text-white hover:bg-white/15 transition-all active:scale-90 cursor-pointer",
              annotations.length === 0 && "opacity-35 pointer-events-none"
            )}
            title="Xóa tất cả ghi chú"
          >
            <SFTrash size={14} />
          </button>
        </div>

        {/* Right: Actions (Copy, Download, Cancel, Save) */}
        <div className="flex items-center gap-2 justify-self-end">
          <button
            type="button"
            onClick={handleCopy}
            className="w-9 h-9 rounded-full hidden sm:flex items-center justify-center bg-white/10 hover:bg-white/20 active:scale-90 text-white/90 hover:text-white border border-white/15 transition-all shadow-xs cursor-pointer"
            title="Sao chép ảnh đã chỉnh sửa (Clipboard)"
          >
            <SFSquareOnSquare size={15} />
          </button>

          <button
            type="button"
            onClick={handleDownload}
            className="w-9 h-9 rounded-full hidden sm:flex items-center justify-center bg-white/10 hover:bg-white/20 active:scale-90 text-white/90 hover:text-white border border-white/15 transition-all shadow-xs cursor-pointer"
            title="Tải ảnh về máy"
          >
            <SFArrowDownToLine size={15} />
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[13px] font-semibold text-white bg-[#0071e3] hover:bg-[#0077ed] shadow-[0_4px_16px_rgba(0,113,227,0.35)] transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
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

      {/* ────────────────── CANVAS WORKSPACE STAGE ────────────────── */}
      <main
        ref={containerRef}
        className="flex-1 w-full relative flex items-center justify-center overflow-auto p-4 sm:p-6"
        style={{
          cursor:
            activeTool === 'select'
              ? isResizingText
                ? 'nwse-resize'
                : isDraggingSelected
                ? 'grabbing'
                : 'default'
              : activeTool === 'pen'
              ? 'crosshair'
              : activeTool === 'highlighter'
              ? 'crosshair'
              : activeTool === 'eraser'
              ? 'cell'
              : activeTool === 'text'
              ? 'text'
              : activeTool === 'note'
              ? 'copy'
              : 'crosshair',
        }}
      >
        <div className="relative inline-flex items-center justify-center max-w-full max-h-full">
          {/* Left Side Sticky Notes - Anchored near clicked points outside the canvas */}
          {annotations
            .filter((a) => a.type === 'note' && (a as NoteAnnotation).side === 'left')
            .map((item) => {
              const note = item as NoteAnnotation;
              const isSelected = selectedAnnotationId === note.id;
              const topPos = note.anchorY * canvasScale;

              return (
                <div
                  key={note.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedAnnotationId(note.id);
                  }}
                  style={{
                    top: `${Math.max(10, topPos - 35)}px`,
                  }}
                  className={cn(
                    "absolute right-[calc(100%+16px)] w-56 p-3 rounded-2xl transition-all duration-200 cursor-pointer shadow-[0_12px_36px_rgba(0,0,0,0.18)] backdrop-blur-2xl border select-none group z-40 text-left",
                    isSelected
                      ? "bg-amber-100/95 dark:bg-amber-950/80 border-amber-400 dark:border-amber-500 ring-2 ring-amber-400/50 scale-[1.02]"
                      : "bg-white/95 dark:bg-[#1e1e24]/95 hover:bg-amber-50/90 dark:hover:bg-[#282830] border-black/10 dark:border-white/15"
                  )}
                >
                  <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-black/10 dark:border-white/10 text-[11px] font-semibold text-[#1d1d1f] dark:text-white">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                      <span>Ghi chú</span>
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const rem = annotations.filter((a) => a.id !== note.id);
                        pushState(rem);
                        if (selectedAnnotationId === note.id) setSelectedAnnotationId(null);
                      }}
                      className="w-5 h-5 rounded-full flex items-center justify-center text-[#86868b] hover:text-[#ff3b30] hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                      title="Xóa ghi chú"
                    >
                      <SFXmark size={11} />
                    </button>
                  </div>
                  <textarea
                    value={note.text}
                    onChange={(e) => {
                      const newText = e.target.value;
                      setAnnotations((prev) =>
                        prev.map((a) => (a.id === note.id ? { ...a, text: newText } : a))
                      );
                    }}
                    onBlur={() => pushState([...annotations])}
                    className="w-full bg-transparent border-none outline-none resize-none text-[12px] leading-relaxed text-[#1d1d1f] dark:text-[#f5f5f7] placeholder-[#86868b] font-sans"
                    rows={Math.max(2, note.text.split('\n').length)}
                    placeholder="Gõ nội dung ghi chú..."
                  />
                </div>
              );
            })}

          <canvas
            ref={canvasRef}
            onMouseDown={handlePointerDown}
            onMouseMove={handlePointerMove}
            onMouseUp={handlePointerUp}
            onTouchStart={handlePointerDown}
            onTouchMove={handlePointerMove}
            onTouchEnd={handlePointerUp}
            className="max-h-[calc(100vh-190px)] max-w-[90vw] object-contain rounded-xl shadow-[0_20px_70px_rgba(0,0,0,0.85)] border border-white/15 select-none touch-none"
          />

          {/* Interactive Crop Overlay */}
          {activeTool === 'crop' && cropBox && (
            <div
              className="absolute inset-0 select-none overflow-hidden touch-none pointer-events-auto rounded-xl"
              onMouseMove={handleCropMouseMove}
              onMouseUp={handleCropMouseUp}
              onTouchMove={handleCropTouchMove}
              onTouchEnd={handleCropMouseUp}
            >
              {(() => {
                const isRot90 = rotation === 90 || rotation === 270;
                const canvasW = isRot90 ? naturalSize.h : naturalSize.w;
                const canvasH = isRot90 ? naturalSize.w : naturalSize.h;
                if (!canvasW || !canvasH) return null;
                const leftPct = (cropBox.x / canvasW) * 100;
                const topPct = (cropBox.y / canvasH) * 100;
                const widthPct = (cropBox.w / canvasW) * 100;
                const heightPct = (cropBox.h / canvasH) * 100;

                return (
                  <div
                    style={{
                      left: `${leftPct}%`,
                      top: `${topPct}%`,
                      width: `${widthPct}%`,
                      height: `${heightPct}%`,
                      boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.65)',
                    }}
                    className="absolute border-2 border-white/95 shadow-xl"
                  >
                    {/* 3x3 Grid Lines */}
                    <div className="absolute inset-x-0 top-1/3 border-t border-dashed border-white/40 pointer-events-none" />
                    <div className="absolute inset-x-0 top-2/3 border-t border-dashed border-white/40 pointer-events-none" />
                    <div className="absolute inset-y-0 left-1/3 border-l border-dashed border-white/40 pointer-events-none" />
                    <div className="absolute inset-y-0 left-2/3 border-l border-dashed border-white/40 pointer-events-none" />

                    {/* Corner Handles */}
                    <div
                      onMouseDown={(e) => startCropDrag(e, 'nw')}
                      onTouchStart={(e) => startCropDragTouch(e, 'nw')}
                      className="absolute -top-1.5 -left-1.5 w-4 h-4 border-t-3 border-l-3 border-white cursor-nwse-resize z-20"
                    />
                    <div
                      onMouseDown={(e) => startCropDrag(e, 'ne')}
                      onTouchStart={(e) => startCropDragTouch(e, 'ne')}
                      className="absolute -top-1.5 -right-1.5 w-4 h-4 border-t-3 border-r-3 border-white cursor-nesw-resize z-20"
                    />
                    <div
                      onMouseDown={(e) => startCropDrag(e, 'sw')}
                      onTouchStart={(e) => startCropDragTouch(e, 'sw')}
                      className="absolute -bottom-1.5 -left-1.5 w-4 h-4 border-b-3 border-l-3 border-white cursor-nesw-resize z-20"
                    />
                    <div
                      onMouseDown={(e) => startCropDrag(e, 'se')}
                      onTouchStart={(e) => startCropDragTouch(e, 'se')}
                      className="absolute -bottom-1.5 -right-1.5 w-4 h-4 border-b-3 border-r-3 border-white cursor-nwse-resize z-20"
                    />

                    {/* Edge Handles */}
                    <div
                      onMouseDown={(e) => startCropDrag(e, 'n')}
                      onTouchStart={(e) => startCropDragTouch(e, 'n')}
                      className="absolute -top-1 left-1/2 -translate-x-1/2 w-8 h-1.5 bg-white/90 rounded-full cursor-ns-resize z-20 shadow-xs"
                    />
                    <div
                      onMouseDown={(e) => startCropDrag(e, 's')}
                      onTouchStart={(e) => startCropDragTouch(e, 's')}
                      className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-8 h-1.5 bg-white/90 rounded-full cursor-ns-resize z-20 shadow-xs"
                    />
                    <div
                      onMouseDown={(e) => startCropDrag(e, 'w')}
                      onTouchStart={(e) => startCropDragTouch(e, 'w')}
                      className="absolute -left-1 top-1/2 -translate-y-1/2 w-1.5 h-8 bg-white/90 rounded-full cursor-ew-resize z-20 shadow-xs"
                    />
                    <div
                      onMouseDown={(e) => startCropDrag(e, 'e')}
                      onTouchStart={(e) => startCropDragTouch(e, 'e')}
                      className="absolute -right-1 top-1/2 -translate-y-1/2 w-1.5 h-8 bg-white/90 rounded-full cursor-ew-resize z-20 shadow-xs"
                    />

                    {/* Pan/Move Area */}
                    <div
                      onMouseDown={(e) => startCropDrag(e, 'move')}
                      onTouchStart={(e) => startCropDragTouch(e, 'move')}
                      className="w-full h-full cursor-move"
                    />
                  </div>
                );
              })()}
            </div>
          )}

          {/* Right Side Sticky Notes - Anchored near clicked points outside the canvas */}
          {annotations
            .filter((a) => a.type === 'note' && (a as NoteAnnotation).side === 'right')
            .map((item) => {
              const note = item as NoteAnnotation;
              const isSelected = selectedAnnotationId === note.id;
              const topPos = note.anchorY * canvasScale;

              return (
                <div
                  key={note.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedAnnotationId(note.id);
                  }}
                  style={{
                    top: `${Math.max(10, topPos - 35)}px`,
                  }}
                  className={cn(
                    "absolute left-[calc(100%+16px)] w-56 p-3 rounded-2xl transition-all duration-200 cursor-pointer shadow-[0_12px_36px_rgba(0,0,0,0.18)] backdrop-blur-2xl border select-none group z-40 text-left",
                    isSelected
                      ? "bg-amber-100/95 dark:bg-amber-950/80 border-amber-400 dark:border-amber-500 ring-2 ring-amber-400/50 scale-[1.02]"
                      : "bg-white/95 dark:bg-[#1e1e24]/95 hover:bg-amber-50/90 dark:hover:bg-[#282830] border-black/10 dark:border-white/15"
                  )}
                >
                  <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-black/10 dark:border-white/10 text-[11px] font-semibold text-[#1d1d1f] dark:text-white">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                      <span>Ghi chú</span>
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const rem = annotations.filter((a) => a.id !== note.id);
                        pushState(rem);
                        if (selectedAnnotationId === note.id) setSelectedAnnotationId(null);
                      }}
                      className="w-5 h-5 rounded-full flex items-center justify-center text-[#86868b] hover:text-[#ff3b30] hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                      title="Xóa ghi chú"
                    >
                      <SFXmark size={11} />
                    </button>
                  </div>
                  <textarea
                    value={note.text}
                    onChange={(e) => {
                      const newText = e.target.value;
                      setAnnotations((prev) =>
                        prev.map((a) => (a.id === note.id ? { ...a, text: newText } : a))
                      );
                    }}
                    onBlur={() => pushState([...annotations])}
                    className="w-full bg-transparent border-none outline-none resize-none text-[12px] leading-relaxed text-[#1d1d1f] dark:text-[#f5f5f7] placeholder-[#86868b] font-sans"
                    rows={Math.max(2, note.text.split('\n').length)}
                    placeholder="Gõ nội dung ghi chú..."
                  />
                </div>
              );
            })}

          {/* Direct In-Image Inline Textarea Editor (Designed to match Figure 4 - Floating Mini Toolbar + Dashed Selection Handle) */}
          {activeInlineText && inlineScreenPos && (
            <div
              className="fixed z-50 transition-all select-none"
              style={{
                left: inlineScreenPos.x - 6,
                top: inlineScreenPos.y - 42,
                minWidth: Math.max(180, (activeInlineText.width || 200) * canvasScale + 24),
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Apple Floating Quick Formatting Bar on Top (Figure 4) */}
              <div className="flex items-center gap-1.5 px-3 py-1.5 mb-1.5 rounded-2xl bg-white/95 dark:bg-[#1e1e24]/95 backdrop-blur-2xl border border-black/10 dark:border-white/15 shadow-[0_12px_36px_rgba(0,0,0,0.22)] w-max">
                {/* Font Color Preview Indicator */}
                <div className="flex items-center gap-1 pr-1 border-r border-black/10 dark:border-white/10">
                  <span className="text-[12px] font-bold text-[#1d1d1f] dark:text-white">A</span>
                  <span
                    className="w-3.5 h-1 rounded-full shadow-2xs"
                    style={{ backgroundColor: selectedColor === '#1F2937' ? '#0071E3' : selectedColor }}
                  />
                </div>

                {/* Font Size Up / Down */}
                <div className="flex items-center gap-0.5 pr-1 border-r border-black/10 dark:border-white/10">
                  <button
                    type="button"
                    onClick={() => setSelectedFontSize((prev) => Math.min(80, prev + 2))}
                    className="px-1.5 py-0.5 rounded-lg text-[11px] font-semibold text-[#1d1d1f] dark:text-white hover:bg-black/5 dark:hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
                    title="Tăng cỡ chữ"
                  >
                    A<span className="text-[9px] align-super">^</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedFontSize((prev) => Math.max(10, prev - 2))}
                    className="px-1.5 py-0.5 rounded-lg text-[11px] font-semibold text-[#1d1d1f] dark:text-white hover:bg-black/5 dark:hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
                    title="Giảm cỡ chữ"
                  >
                    A<span className="text-[9px] align-sub">v</span>
                  </button>
                </div>

                {/* Alignment */}
                <div className="flex items-center gap-0.5 pr-1 border-r border-black/10 dark:border-white/10">
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedTextAlign((prev) =>
                        prev === 'left' ? 'center' : prev === 'center' ? 'right' : 'left'
                      )
                    }
                    className="p-1 rounded-lg text-[#1d1d1f] dark:text-white hover:bg-black/5 dark:hover:bg-white/10 active:scale-95 transition-all cursor-pointer text-[11px] font-semibold"
                    title="Căn chỉnh lề văn bản"
                  >
                    AV
                  </button>
                </div>

                {/* Delete / Cancel Button */}
                <button
                  type="button"
                  onClick={() => setActiveInlineText(null)}
                  className="p-1 rounded-lg text-[#86868b] hover:text-[#ff3b30] hover:bg-rose-500/10 active:scale-95 transition-all cursor-pointer"
                  title="Hủy bỏ văn bản này"
                >
                  <SFTrash size={13} />
                </button>

                {/* Quick Confirm Checkmark Button */}
                <button
                  type="button"
                  onClick={commitActiveInlineText}
                  className="ml-0.5 px-2.5 py-0.5 rounded-full bg-[#0071e3] hover:bg-[#0077ed] text-white text-[11px] font-semibold shadow-xs active:scale-95 transition-all cursor-pointer"
                  title="Hoàn tất nhập chữ (Ctrl+Enter)"
                >
                  Xong
                </button>
              </div>

              {/* Text Input Container with Blue Drag Grip and Dashed Border (Figure 4) */}
              <div className="relative flex items-stretch rounded-lg border-2 border-dashed border-[#0071e3] bg-white/10 dark:bg-black/20 backdrop-blur-2xs shadow-lg group">
                {/* Drag Handle on Left with Dots */}
                <div
                  className="w-5 bg-[#0071e3] rounded-l-[4px] flex items-center justify-center text-white shrink-0 cursor-move"
                  title="Kéo di chuyển vị trí"
                >
                  <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor" className="opacity-90">
                    <circle cx="2" cy="2" r="1.2" />
                    <circle cx="8" cy="2" r="1.2" />
                    <circle cx="2" cy="7" r="1.2" />
                    <circle cx="8" cy="7" r="1.2" />
                    <circle cx="2" cy="12" r="1.2" />
                    <circle cx="8" cy="12" r="1.2" />
                  </svg>
                </div>

                {/* Pure Input Area with custom Typography */}
                <textarea
                  ref={inlineTextareaRef}
                  value={activeInlineText.text}
                  onChange={(e) =>
                    setActiveInlineText({ ...activeInlineText, text: e.target.value })
                  }
                  placeholder="Start typing here..."
                  rows={Math.max(1, activeInlineText.text.split('\n').length)}
                  style={{
                    color: selectedColor === '#1F2937' ? '#FFFFFF' : selectedColor,
                    fontSize: `${Math.max(14, selectedFontSize * canvasScale)}px`,
                    fontFamily: selectedFontFamily,
                    textAlign: selectedTextAlign,
                    fontWeight: isBold ? 700 : 500,
                    fontStyle: isItalic ? 'italic' : 'normal',
                  }}
                  className="flex-1 min-w-[140px] bg-transparent outline-none resize-none leading-relaxed border-none focus:ring-0 px-2.5 py-1.5 placeholder-white/50 text-white"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                      e.preventDefault();
                      commitActiveInlineText();
                    } else if (e.key === 'Escape') {
                      e.preventDefault();
                      commitActiveInlineText();
                    }
                  }}
                />

                {/* Circle Resize Handle on Right Edge (Figure 4) */}
                <div
                  className="absolute right-[-8px] top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white border-2 border-[#0071e3] shadow-xs cursor-ew-resize flex items-center justify-center z-10"
                  title="Kéo thay đổi chiều rộng ô nhập"
                />
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ────────────────── BOTTOM FLOATING MARKUP TOOLBAR (Apple Liquid Glass Pill) ────────────────── */}
      <footer className="h-20 sm:h-24 flex flex-col items-center justify-center px-4 pb-3 pt-1 shrink-0 z-30 gap-1.5">
        <div className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 rounded-full bg-black/65 dark:bg-white/[0.08] backdrop-blur-3xl border border-white/20 shadow-[0_16px_50px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(255,255,255,0.3)] text-white flex-wrap justify-center">
          {/* Tool 1: Con trỏ chọn & di chuyển (Select) */}
          <button
            type="button"
            onClick={() => setActiveTool('select')}
            className={cn(
              "w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 active:scale-90 cursor-pointer",
              activeTool === 'select'
                ? "bg-[#0071e3] text-white scale-105 shadow-[0_4px_16px_rgba(0,113,227,0.45),inset_0_1px_1px_rgba(255,255,255,0.3)]"
                : "text-white/70 hover:text-white hover:bg-white/10"
            )}
            title="Công cụ chọn & di chuyển (Phím V hoặc S)"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
              <path d="M13 13l6 6" />
            </svg>
          </button>

          {/* Tool 2: Bút vẽ (Pen) */}
          <button
            type="button"
            onClick={() => handleSelectTool('pen')}
            className={cn(
              "w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 active:scale-90 cursor-pointer",
              activeTool === 'pen'
                ? "bg-[#0071e3] text-white scale-105 shadow-[0_4px_16px_rgba(0,113,227,0.45),inset_0_1px_1px_rgba(255,255,255,0.3)]"
                : "text-white/70 hover:text-white hover:bg-white/10"
            )}
            title="Bút vẽ tự do (Phím P)"
          >
            <SFPencil size={16} />
          </button>

          {/* Tool 3: Dạ quang (Highlighter) */}
          <button
            type="button"
            onClick={() => handleSelectTool('highlighter')}
            className={cn(
              "w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 active:scale-90 cursor-pointer",
              activeTool === 'highlighter'
                ? "bg-[#0071e3] text-white scale-105 shadow-[0_4px_16px_rgba(0,113,227,0.45),inset_0_1px_1px_rgba(255,255,255,0.3)]"
                : "text-white/70 hover:text-white hover:bg-white/10"
            )}
            title="Bút dạ quang (Phím H)"
          >
            <SFHighlighter size={16} />
          </button>

          {/* Tool 4: Khung hình học đa dạng (Geometric Shapes Popover) */}
          <div className="relative" ref={shapeMenuRef}>
            <button
              type="button"
              onClick={() => {
                if (activeTool === 'rect') {
                  setIsShapeMenuOpen(!isShapeMenuOpen);
                } else {
                  setActiveTool('rect');
                  setIsShapeMenuOpen(true);
                }
              }}
              className={cn(
                "w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 active:scale-90 cursor-pointer relative",
                activeTool === 'rect'
                  ? "bg-[#0071e3] text-white scale-105 shadow-[0_4px_16px_rgba(0,113,227,0.45),inset_0_1px_1px_rgba(255,255,255,0.3)]"
                  : "text-white/70 hover:text-white hover:bg-white/10"
              )}
              title="Kẻ khung hình học (Phím U — Vuông, Bo góc, Tròn, Elip, Tam giác, Ngôi sao)"
            >
              {selectedShapeVariant === 'circle' || selectedShapeVariant === 'ellipse' ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <circle cx="12" cy="12" r="9" />
                </svg>
              ) : selectedShapeVariant === 'roundRect' ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <rect x="3" y="3" width="18" height="18" rx="5" />
                </svg>
              ) : selectedShapeVariant === 'triangle' ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <polygon points="12 3 22 21 2 21" />
                </svg>
              ) : selectedShapeVariant === 'star' ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
              ) : (
                <SFSquare size={16} />
              )}
            </button>

            {/* Pop-up ô nhỏ ngay phía trên nút khung hình - Animation Apple Liquid Glass mượt mà */}
            {isShapeMenuOpen && (
              <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 rounded-2xl bg-[#1c1c24]/95 backdrop-blur-2xl border border-white/20 shadow-[0_20px_50px_rgba(0,0,0,0.7),inset_0_1px_1px_rgba(255,255,255,0.25)] p-2 z-50 flex items-center gap-1.5 animate-in fade-in slide-in-from-bottom-2 zoom-in-95 duration-200 select-none">
                {[
                  {
                    id: 'rect' as ShapeVariant,
                    label: 'Chữ nhật',
                    icon: (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="4" width="18" height="16" />
                      </svg>
                    ),
                  },
                  {
                    id: 'roundRect' as ShapeVariant,
                    label: 'Bo tròn góc',
                    icon: (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="4" width="18" height="16" rx="5" />
                      </svg>
                    ),
                  },
                  {
                    id: 'circle' as ShapeVariant,
                    label: 'Hình tròn / Elip',
                    icon: (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="9" />
                      </svg>
                    ),
                  },
                  {
                    id: 'triangle' as ShapeVariant,
                    label: 'Tam giác',
                    icon: (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polygon points="12 3 22 21 2 21" />
                      </svg>
                    ),
                  },
                  {
                    id: 'star' as ShapeVariant,
                    label: 'Ngôi sao',
                    icon: (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                      </svg>
                    ),
                  },
                ].map((s) => {
                  const isActive = selectedShapeVariant === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        setSelectedShapeVariant(s.id);
                        setActiveTool('rect');
                        setIsShapeMenuOpen(false);
                      }}
                      className={cn(
                        "w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-150 cursor-pointer",
                        isActive
                          ? "bg-[#0071e3] text-white shadow-xs scale-105"
                          : "text-white/70 hover:text-white hover:bg-white/15"
                      )}
                      title={s.label}
                    >
                      {s.icon}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Tool 5: Mũi tên (Arrow) */}
          <button
            type="button"
            onClick={() => handleSelectTool('arrow')}
            className={cn(
              "w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 active:scale-90 cursor-pointer",
              activeTool === 'arrow'
                ? "bg-[#0071e3] text-white scale-105 shadow-[0_4px_16px_rgba(0,113,227,0.45),inset_0_1px_1px_rgba(255,255,255,0.3)]"
                : "text-white/70 hover:text-white hover:bg-white/10"
            )}
            title="Mũi tên chỉ dẫn (Phím A)"
          >
            <SFArrowRight size={16} />
          </button>

          {/* Tool 6: Văn bản thuần (Text) */}
          <button
            type="button"
            onClick={() => handleSelectTool('text')}
            className={cn(
              "w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 active:scale-90 cursor-pointer",
              activeTool === 'text'
                ? "bg-[#0071e3] text-white scale-105 shadow-[0_4px_16px_rgba(0,113,227,0.45),inset_0_1px_1px_rgba(255,255,255,0.3)]"
                : "text-white/70 hover:text-white hover:bg-white/10"
            )}
            title="Thêm văn bản chữ vào ảnh (Phím T)"
          >
            <SFTextformat size={16} />
          </button>

          {/* Tool 7: Ghi chú Sticky Note (Note) */}
          <button
            type="button"
            onClick={() => handleSelectTool('note')}
            className={cn(
              "w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 active:scale-90 cursor-pointer",
              activeTool === 'note'
                ? "bg-amber-400 text-amber-950 scale-105 shadow-[0_4px_16px_rgba(245,158,11,0.5)] font-bold"
                : "text-white/70 hover:text-white hover:bg-white/10"
            )}
            title="Chèn thẻ ghi chú dán Sticky Note (Phím N)"
          >
            <SFTextBubble size={16} />
          </button>

          {/* Tool 8: Tẩy (Eraser) */}
          <button
            type="button"
            onClick={() => handleSelectTool('eraser')}
            className={cn(
              "w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 active:scale-90 cursor-pointer",
              activeTool === 'eraser'
                ? "bg-[#0071e3] text-white scale-105 shadow-[0_4px_16px_rgba(0,113,227,0.45),inset_0_1px_1px_rgba(255,255,255,0.3)]"
                : "text-white/70 hover:text-white hover:bg-white/10"
            )}
            title="Tẩy xóa nét vẽ / chữ (Phím E)"
          >
            <SFEraser size={16} />
          </button>

          {/* Tool 9: Cắt xén ảnh (Crop) */}
          <button
            type="button"
            onClick={() => {
              if (activeTool === 'crop') {
                setActiveTool('select');
                setCropBox(null);
              } else {
                setActiveTool('crop');
                const isRot90 = rotation === 90 || rotation === 270;
                const curW = isRot90 ? naturalSize.h : naturalSize.w;
                const curH = isRot90 ? naturalSize.w : naturalSize.h;
                const initW = Math.round(curW * 0.85);
                const initH = Math.round(curH * 0.85);
                setCropBox({
                  x: Math.round((curW - initW) / 2),
                  y: Math.round((curH - initH) / 2),
                  w: initW,
                  h: initH,
                });
              }
            }}
            className={cn(
              "w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 active:scale-90 cursor-pointer",
              activeTool === 'crop'
                ? "bg-[#0071e3] text-white scale-105 shadow-[0_4px_16px_rgba(0,113,227,0.45),inset_0_1px_1px_rgba(255,255,255,0.3)]"
                : "text-white/70 hover:text-white hover:bg-white/10"
            )}
            title="Cắt xén hình ảnh (Phím C)"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 2v14a2 2 0 0 0 2 2h14" />
              <path d="M18 22V8a2 2 0 0 0-2-2H2" />
            </svg>
          </button>

          {/* Tool 10: Xoay ảnh 90° (Rotate) */}
          <button
            type="button"
            onClick={handleRotate}
            className="w-9 h-9 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-all duration-200 active:scale-90 cursor-pointer"
            title="Xoay ảnh 90° (Phím R)"
          >
            <SFArrowClockwise size={16} />
          </button>

          <span className="w-[1px] h-5 bg-white/20 mx-0.5" />

          {/* Inspector Panel: Crop Controls OR Color Picker & Tool Controls */}
          {activeTool === 'crop' ? (
            <div className="flex items-center gap-1.5 pl-1.5">
              <span className="text-[11px] text-white/60 font-medium">Tỷ lệ:</span>
              {[
                { label: 'Tự do', val: null },
                { label: '1:1', val: 1 },
                { label: '4:3', val: 4 / 3 },
                { label: '16:9', val: 16 / 9 },
              ].map((r) => (
                <button
                  key={r.label}
                  type="button"
                  onClick={() => setCropRatio(r.val)}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer",
                    cropAspectRatio === r.val
                      ? "bg-white/25 text-white font-semibold shadow-xs"
                      : "text-white/60 hover:text-white hover:bg-white/10"
                  )}
                >
                  {r.label}
                </button>
              ))}
              <span className="w-[1px] h-4 bg-white/20 mx-0.5" />
              <button
                type="button"
                onClick={handleCancelCrop}
                className="px-3 py-1 rounded-full text-[11.5px] font-medium text-white/70 hover:text-white hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleApplyCrop}
                className="flex items-center gap-1 px-3.5 py-1 rounded-full text-[11.5px] font-semibold text-white bg-[#0071e3] hover:bg-[#0077ed] shadow-xs active:scale-95 transition-all cursor-pointer"
              >
                <SFCheckmark size={12} />
                <span>Áp dụng</span>
              </button>
            </div>
          ) : (
            <>
              {/* Advanced Compact Color Trigger (Unified Apple Palette & Spectrum Picker) */}
              <div className="relative" ref={colorPickerRef}>
                <button
                  type="button"
                  onClick={() => setIsColorPickerOpen(!isColorPickerOpen)}
                  className={cn(
                    "w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer active:scale-90 relative",
                    isColorPickerOpen
                      ? "ring-2 ring-white scale-105 shadow-[0_0_12px_rgba(255,255,255,0.6)]"
                      : "hover:scale-105 hover:bg-white/10"
                  )}
                  title="Màu sắc hiện tại & Bảng chọn màu nâng cao"
                >
                  {/* Outer multi-color spectrum ring indicator */}
                  <div
                    className="w-7 h-7 rounded-full p-[2px] flex items-center justify-center shadow-xs"
                    style={{
                      background:
                        'conic-gradient(from 180deg at 50% 50%, #FF0000 0deg, #FF9900 60deg, #FFFF00 120deg, #00FF00 180deg, #00FFFF 240deg, #0000FF 300deg, #FF00FF 360deg)',
                    }}
                  >
                    {/* Inner active color dot */}
                    <div
                      className="w-full h-full rounded-full border border-black/30 dark:border-white/30 shadow-inner"
                      style={{ backgroundColor: selectedColor }}
                    />
                  </div>
                </button>

                {/* Apple Liquid Glass Advanced Color Popover */}
                {isColorPickerOpen && (
                  <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 w-72 rounded-2xl bg-[#1c1c24]/95 backdrop-blur-2xl border border-white/20 shadow-[0_20px_50px_rgba(0,0,0,0.7),inset_0_1px_1px_rgba(255,255,255,0.25)] p-3.5 z-50 animate-in fade-in slide-in-from-bottom-2 zoom-in-95 duration-200 text-white select-none">
                    <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-white/10 text-[12.5px] font-semibold text-white/95">
                      <span className="flex items-center gap-1.5">
                        <span
                          className="w-3.5 h-3.5 rounded-full border border-white/40 shadow-xs"
                          style={{ backgroundColor: selectedColor }}
                        />
                        <span>Bảng màu nâng cao</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsColorPickerOpen(false)}
                        className="w-5 h-5 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 cursor-pointer"
                      >
                        <SFXmark size={11} />
                      </button>
                    </div>

                    {/* Quick Swatches Grid (compact 9 colors) */}
                    <div className="space-y-1.5 mb-3">
                      <span className="text-[11px] text-white/60 font-medium block">Màu sắc tiêu chuẩn:</span>
                      <div className="grid grid-cols-9 gap-1.5">
                        {PRESET_COLORS.map((col) => (
                          <button
                            key={col.hex}
                            type="button"
                            onClick={() => handleColorChange(col.hex)}
                            className={cn(
                              "w-6 h-6 rounded-full transition-all duration-150 cursor-pointer relative flex items-center justify-center border",
                              selectedColor.toLowerCase() === col.hex.toLowerCase()
                                ? "scale-115 border-white ring-2 ring-white/50 shadow-[0_0_8px_rgba(255,255,255,0.8)]"
                                : "border-black/30 hover:scale-110 opacity-85 hover:opacity-100"
                            )}
                            style={{ backgroundColor: col.hex }}
                            title={col.name}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Native Full Spectrum Gradient Picker & HEX */}
                    <div className="flex flex-col gap-2.5 pt-2 border-t border-white/10">
                      <span className="text-[11px] text-white/60 font-medium block">Tùy biến dải màu quang phổ:</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={selectedColor.startsWith('#') ? selectedColor : '#EF4444'}
                          onChange={(e) => handleColorChange(e.target.value)}
                          className="w-10 h-10 rounded-xl border border-white/20 cursor-pointer bg-transparent overflow-hidden shrink-0"
                          title="Nhấp để mở bảng màu gradient tự do"
                        />
                        <div className="flex-1 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/10 border border-white/15">
                          <span className="text-[11px] font-mono text-white/50">#</span>
                          <input
                            type="text"
                            maxLength={7}
                            value={customHexInput.replace('#', '')}
                            onChange={(e) => {
                              const val = '#' + e.target.value.replace(/[^0-9A-Fa-f]/g, '');
                              setCustomHexInput(val);
                              if (/^#[0-9A-Fa-f]{6}$/.test(val) || /^#[0-9A-Fa-f]{3}$/.test(val)) {
                                handleColorChange(val);
                              }
                            }}
                            className="w-full bg-transparent text-[12px] font-mono uppercase text-white outline-none"
                            placeholder="HEX"
                          />
                        </div>
                      </div>

                      {/* EyeDropper Pipette Tool */}
                      {'EyeDropper' in window && (
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              const eyeDropper = new (window as any).EyeDropper();
                              const result = await eyeDropper.open();
                              if (result?.sRGBHex) {
                                handleColorChange(result.sRGBHex);
                                toast.success(`Đã hút màu: ${result.sRGBHex}`);
                              }
                            } catch (e) {
                              // User cancelled eyedropper
                            }
                          }}
                          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 active:scale-98 border border-white/15 text-[12px] font-medium transition-all cursor-pointer"
                          title="Bút hút màu từ bất kỳ điểm nào trên màn hình"
                        >
                          <SFEyedropper size={14} className="text-sky-400" />
                          <span>Hút màu từ ảnh / màn hình</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <span className="w-[1px] h-5 bg-white/20 mx-0.5" />

              {/* Brush Thickness Horizontal Slider with Live Dot & Px Badge (Zero-Latency Direct Synchronous Update) */}
              {activeTool !== 'text' && activeTool !== 'note' ? (
                <div className="flex items-center gap-2 pl-1 pr-1.5">
                  <span className="text-[11px] text-white/60 font-medium">Nét:</span>
                  <input
                    type="range"
                    min={1}
                    max={40}
                    value={selectedStrokeWidth}
                    onInput={(e) => {
                      const val = Number((e.target as HTMLInputElement).value);
                      handleStrokeWidthChange(val);
                    }}
                    onChange={(e) => handleStrokeWidthChange(Number(e.target.value))}
                    className="w-20 sm:w-28 accent-[#0071e3] cursor-pointer h-1.5 bg-white/20 rounded-lg outline-none"
                    title={`Kích thước nét vẽ: ${selectedStrokeWidth}px`}
                  />
                  {/* Perfectly Centered Live Preview Dot & Size Label (120 FPS Instant Sync) */}
                  <div className="flex items-center gap-1.5 pl-0.5">
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center bg-white/10 border border-white/20 shrink-0 overflow-hidden"
                      title={`Xem trước: ${selectedStrokeWidth}px`}
                    >
                      <span
                        ref={strokeWidthDotRef}
                        className="rounded-full shrink-0"
                        style={{
                          width: Math.min(18, Math.max(2, selectedStrokeWidth * 0.7)),
                          height: Math.min(18, Math.max(2, selectedStrokeWidth * 0.7)),
                          backgroundColor: selectedColor,
                        }}
                      />
                    </div>
                    <span
                      ref={strokeWidthDisplayRef}
                      className="text-[11px] font-mono text-white/80 min-w-[24px]"
                    >
                      {selectedStrokeWidth}px
                    </span>
                  </div>
                </div>
              ) : activeTool === 'text' ? (
                /* Font & Typography Controls for Text Tool */
                <div className="flex items-center gap-1.5 sm:gap-2 pl-1">
                  {/* Unified Apple Liquid Popover Listbox for Font Selection */}
                  <div className="relative" ref={fontDropdownRef}>
                    <button
                      type="button"
                      onClick={() => setIsFontDropdownOpen(!isFontDropdownOpen)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-white text-[12px] font-medium transition-all shadow-2xs active:scale-95 cursor-pointer"
                      title="Chọn phông chữ"
                    >
                      <span className="truncate max-w-[120px]">
                        {FONT_FAMILIES.find((f) => f.value === selectedFontFamily)?.label.split('(')[0].trim() || 'Phông chữ'}
                      </span>
                      <SFChevronDown size={11} className={cn("transition-transform duration-200 text-white/60", isFontDropdownOpen && "rotate-180")} />
                    </button>

                    {isFontDropdownOpen && (
                      <div className="absolute bottom-full mb-2 left-0 w-56 rounded-2xl bg-[#1c1c24]/95 backdrop-blur-2xl border border-white/15 shadow-[0_16px_40px_rgba(0,0,0,0.6)] py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                        {FONT_FAMILIES.map((f) => {
                          const isSelected = selectedFontFamily === f.value;
                          return (
                            <button
                              key={f.value}
                              type="button"
                              onClick={() => {
                                handleFontFamilyChange(f.value);
                                setIsFontDropdownOpen(false);
                              }}
                              className={cn(
                                "w-full text-left px-3 py-2 text-[12px] flex items-center justify-between transition-colors cursor-pointer",
                                isSelected
                                  ? "bg-[#0071e3] text-white font-medium"
                                  : "text-white/80 hover:bg-white/10 hover:text-white"
                              )}
                              style={{ fontFamily: f.value }}
                            >
                              <span className="truncate">{f.label}</span>
                              {isSelected && <SFCheckmark size={12} className="shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Bold Toggle */}
                  <button
                    type="button"
                    onClick={handleToggleBold}
                    className={cn(
                      "w-7 h-7 rounded-lg flex items-center justify-center transition-all cursor-pointer",
                      isBold ? "bg-white/25 text-white" : "text-white/60 hover:text-white hover:bg-white/10"
                    )}
                    title="In đậm (Bold)"
                  >
                    <SFBold size={13} />
                  </button>

                  {/* Italic Toggle */}
                  <button
                    type="button"
                    onClick={handleToggleItalic}
                    className={cn(
                      "w-7 h-7 rounded-lg flex items-center justify-center transition-all cursor-pointer",
                      isItalic ? "bg-white/25 text-white" : "text-white/60 hover:text-white hover:bg-white/10"
                    )}
                    title="In nghiêng (Italic)"
                  >
                    <SFItalic size={13} />
                  </button>

                  <span className="w-[1px] h-4 bg-white/20 mx-0.5" />

                  {/* Text Alignments: Left, Center, Right */}
                  <div className="flex items-center gap-0.5 bg-white/10 rounded-lg p-0.5 border border-white/15">
                    <button
                      type="button"
                      onClick={() => handleTextAlignChange('left')}
                      className={cn(
                        "w-6 h-6 rounded flex items-center justify-center transition-all cursor-pointer",
                        selectedTextAlign === 'left' ? "bg-white/25 text-white" : "text-white/60 hover:text-white"
                      )}
                      title="Căn lề trái"
                    >
                      <SFTextAlignleft size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTextAlignChange('center')}
                      className={cn(
                        "w-6 h-6 rounded flex items-center justify-center transition-all cursor-pointer",
                        selectedTextAlign === 'center' ? "bg-white/25 text-white" : "text-white/60 hover:text-white"
                      )}
                      title="Căn giữa"
                    >
                      <SFTextAligncenter size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTextAlignChange('right')}
                      className={cn(
                        "w-6 h-6 rounded flex items-center justify-center transition-all cursor-pointer",
                        selectedTextAlign === 'right' ? "bg-white/25 text-white" : "text-white/60 hover:text-white"
                      )}
                      title="Căn lề phải"
                    >
                      <SFTextAlignright size={12} />
                    </button>
                  </div>

                  <span className="w-[1px] h-4 bg-white/20 mx-0.5" />

                  {/* Text Effects Popover Button */}
                  <div className="relative" ref={textEffectsRef}>
                    <button
                      type="button"
                      onClick={() => setIsTextEffectsOpen(!isTextEffectsOpen)}
                      className={cn(
                        "inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11.5px] font-medium border transition-all cursor-pointer",
                        isTextEffectsOpen || textEffects.shadowEnabled || textEffects.strokeEnabled || textEffects.blurEnabled
                          ? "bg-purple-500/25 text-purple-200 border-purple-400/40 shadow-xs"
                          : "bg-white/10 text-white/80 hover:text-white border-white/20"
                      )}
                      title="Hiệu ứng chữ: Đổ bóng, Viền chữ, Làm mờ"
                    >
                      <SFSparkles size={12} />
                      <span>Hiệu ứng</span>
                    </button>

                    {/* Text Effects Menu */}
                    {isTextEffectsOpen && (
                      <div className="absolute bottom-full mb-2 right-0 w-72 rounded-2xl bg-[#1c1c24]/95 backdrop-blur-2xl border border-white/20 shadow-[0_20px_50px_rgba(0,0,0,0.7)] p-3.5 z-50 animate-in fade-in zoom-in-95 duration-150 text-white">
                        <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10 text-[12px] font-semibold text-white/90">
                          <span>Hiệu ứng chữ văn bản</span>
                          <button
                            type="button"
                            onClick={() => setIsTextEffectsOpen(false)}
                            className="w-5 h-5 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 cursor-pointer"
                          >
                            <SFXmark size={11} />
                          </button>
                        </div>

                        <div className="flex flex-col gap-3 text-[11.5px]">
                          {/* 1. Drop Shadow Controls */}
                          <div className="flex flex-col gap-1.5 p-2 rounded-xl bg-white/5 border border-white/10">
                            <div className="flex items-center justify-between font-medium">
                              <span>Đổ bóng chữ</span>
                              <AppleSwitch
                                checked={textEffects.shadowEnabled || false}
                                onChange={(checked) =>
                                  setTextEffects((prev) => ({ ...prev, shadowEnabled: checked }))
                                }
                                size="sm"
                                title="Bật/tắt đổ bóng chữ"
                              />
                            </div>
                            {textEffects.shadowEnabled && (
                              <div className="flex flex-col gap-2 pt-1 border-t border-white/10">
                                <div className="flex items-center justify-between">
                                  <span className="text-white/60">Độ nhòe:</span>
                                  <input
                                    type="range"
                                    min={0}
                                    max={20}
                                    value={textEffects.shadowBlur || 4}
                                    onChange={(e) =>
                                      setTextEffects((prev) => ({ ...prev, shadowBlur: Number(e.target.value) }))
                                    }
                                    className="w-32 accent-[#0071e3] h-1"
                                  />
                                  <span className="font-mono text-white/80 w-6 text-right">{textEffects.shadowBlur || 4}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-white/60">Khoảng cách:</span>
                                  <input
                                    type="range"
                                    min={0}
                                    max={15}
                                    value={textEffects.shadowOffset || 2}
                                    onChange={(e) =>
                                      setTextEffects((prev) => ({ ...prev, shadowOffset: Number(e.target.value) }))
                                    }
                                    className="w-32 accent-[#0071e3] h-1"
                                  />
                                  <span className="font-mono text-white/80 w-6 text-right">{textEffects.shadowOffset || 2}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-white/60">Góc đổ (°):</span>
                                  <input
                                    type="range"
                                    min={0}
                                    max={360}
                                    value={textEffects.shadowAngle || 45}
                                    onChange={(e) =>
                                      setTextEffects((prev) => ({ ...prev, shadowAngle: Number(e.target.value) }))
                                    }
                                    className="w-32 accent-[#0071e3] h-1"
                                  />
                                  <span className="font-mono text-white/80 w-7 text-right">{textEffects.shadowAngle || 45}°</span>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* 2. Text Outline / Stroke Controls */}
                          <div className="flex flex-col gap-1.5 p-2 rounded-xl bg-white/5 border border-white/10">
                            <div className="flex items-center justify-between font-medium">
                              <span>Viền chữ (Stroke)</span>
                              <AppleSwitch
                                checked={textEffects.strokeEnabled || false}
                                onChange={(checked) =>
                                  setTextEffects((prev) => ({ ...prev, strokeEnabled: checked }))
                                }
                                size="sm"
                                title="Bật/tắt viền chữ"
                              />
                            </div>
                            {textEffects.strokeEnabled && (
                              <div className="flex flex-col gap-2 pt-1 border-t border-white/10">
                                <div className="flex items-center justify-between">
                                  <span className="text-white/60">Độ dày:</span>
                                  <input
                                    type="range"
                                    min={1}
                                    max={8}
                                    value={textEffects.strokeWidth || 2}
                                    onChange={(e) =>
                                      setTextEffects((prev) => ({ ...prev, strokeWidth: Number(e.target.value) }))
                                    }
                                    className="w-32 accent-[#0071e3] h-1"
                                  />
                                  <span className="font-mono text-white/80 w-6 text-right">{textEffects.strokeWidth || 2}px</span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-white/60">Màu viền:</span>
                                  <input
                                    type="color"
                                    value={textEffects.strokeColor || '#000000'}
                                    onChange={(e) =>
                                      setTextEffects((prev) => ({ ...prev, strokeColor: e.target.value }))
                                    }
                                    className="w-6 h-6 rounded border border-white/20 bg-transparent cursor-pointer"
                                  />
                                </div>
                              </div>
                            )}
                          </div>

                          {/* 3. Text Blur Controls */}
                          <div className="flex flex-col gap-1.5 p-2 rounded-xl bg-white/5 border border-white/10">
                            <div className="flex items-center justify-between font-medium">
                              <span>Làm mờ chữ (Blur)</span>
                              <AppleSwitch
                                checked={textEffects.blurEnabled || false}
                                onChange={(checked) =>
                                  setTextEffects((prev) => ({ ...prev, blurEnabled: checked }))
                                }
                                size="sm"
                                title="Bật/tắt làm mờ chữ"
                              />
                            </div>
                            {textEffects.blurEnabled && (
                              <div className="flex items-center justify-between pt-1 border-t border-white/10">
                                <span className="text-white/60">Mức mờ:</span>
                                <input
                                  type="range"
                                  min={1}
                                  max={10}
                                  value={textEffects.blurRadius || 2}
                                  onChange={(e) =>
                                    setTextEffects((prev) => ({ ...prev, blurRadius: Number(e.target.value) }))
                                  }
                                  className="w-32 accent-[#0071e3] h-1"
                                />
                                <span className="font-mono text-white/80 w-6 text-right">{textEffects.blurRadius || 2}px</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <span className="w-[1px] h-4 bg-white/20 mx-0.5" />

                  {/* Continuous Custom Font Size Slider (From 10px to 80px) */}
                  <div className="flex items-center gap-1.5 pl-0.5">
                    <span className="text-[11px] text-white/60 font-medium">Cỡ:</span>
                    <input
                      type="range"
                      min={10}
                      max={80}
                      value={selectedFontSize}
                      onChange={(e) => setSelectedFontSize(Number(e.target.value))}
                      className="w-16 sm:w-20 accent-[#0071e3] cursor-pointer h-1.5 bg-white/20 rounded-lg outline-none"
                      title={`Tùy chọn kích thước cỡ chữ: ${selectedFontSize}px`}
                    />
                    <span className="text-[11.5px] font-mono text-white/90 min-w-[28px] font-semibold">
                      {selectedFontSize}px
                    </span>
                  </div>
                </div>
              ) : (
                /* Sticky Note Controls */
                <div className="flex items-center gap-1.5 pl-1 text-[11.5px] text-amber-200">
                  <span>Nhấn vào điểm trên ảnh để tạo thẻ ghi chú cạnh tương ứng</span>
                </div>
              )}
            </>
          )}
        </div>
      </footer>

      {/* Dialog Xác Nhận Xóa Toàn Bộ Chú Thích Trên Ảnh */}
      <ConfirmDeleteDialog
        isOpen={confirmClearOpen}
        title="Xóa tất cả chú thích?"
        message="Hành động này sẽ xóa toàn bộ các nét vẽ, khung hình, mũi tên và văn bản đã vẽ trên ảnh hiện tại."
        itemLabel={`${annotations.length} chú thích trên ảnh`}
        confirmText="Xóa tất cả"
        cancelText="Hủy"
        onConfirm={executeClearAll}
        onCancel={() => setConfirmClearOpen(false)}
      />
    </div>,
    document.body
  );
};
