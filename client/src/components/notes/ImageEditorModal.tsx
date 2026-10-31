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
  SFCheckmark,
  SFXmark,
  SFArrowDownToLine,
  SFSquareOnSquare,
  SFTrash,
  SFPhoto,
} from '@/components/ui/AppleIcon';
import { downloadImage, copyImageToClipboard, formatFileSize } from '@/services/noteImageService';
import toast from 'react-hot-toast';

export type AnnotationTool = 'pen' | 'highlighter' | 'rect' | 'arrow' | 'text' | 'eraser';

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
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

export interface TextAnnotation extends BaseAnnotation {
  type: 'text';
  x: number;
  y: number;
  text: string;
  fontSize: number;
}

export type Annotation = PathAnnotation | ShapeAnnotation | TextAnnotation;

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
  { name: 'Đỏ', hex: '#EF4444' },
  { name: 'Vàng cam', hex: '#F59E0B' },
  { name: 'Xanh lá', hex: '#10B981' },
  { name: 'Xanh dương', hex: '#3B82F6' },
  { name: 'Đen', hex: '#1F2937' },
  { name: 'Trắng', hex: '#FFFFFF' },
];

const STROKE_WIDTHS = [
  { label: 'Mảnh', value: 3, dotSize: 4 },
  { label: 'Vừa', value: 6, dotSize: 7 },
  { label: 'Đậm', value: 12, dotSize: 11 },
];

const FONT_SIZES = [
  { label: 'S', value: 16 },
  { label: 'M', value: 24 },
  { label: 'L', value: 34 },
];

export const ImageEditorModal: React.FC<ImageEditorModalProps> = ({
  isOpen,
  onClose,
  image,
  onSave,
}) => {
  const [activeTool, setActiveTool] = useState<AnnotationTool>('pen');
  const [selectedColor, setSelectedColor] = useState<string>('#EF4444');
  const [selectedStrokeWidth, setSelectedStrokeWidth] = useState<number>(6);
  const [selectedFontSize, setSelectedFontSize] = useState<number>(24);
  const [rotation, setRotation] = useState<number>(0); // 0, 90, 180, 270

  // Annotation states
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [history, setHistory] = useState<Annotation[][]>([[]]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);

  // Active drawing interaction
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const currentPathRef = useRef<Point[]>([]);
  const shapeStartRef = useRef<Point | null>(null);
  const activeAnnotationRef = useRef<Annotation | null>(null);

  // Active Text typing box overlay
  const [activeTextInput, setActiveTextInput] = useState<{
    id?: string;
    canvasX: number;
    canvasY: number;
    screenX: number;
    screenY: number;
    text: string;
  } | null>(null);

  // Loaded Image state
  const [imgLoaded, setImgLoaded] = useState<boolean>(false);
  const imageElementRef = useRef<HTMLImageElement | null>(null);
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });

  // Canvas DOM refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const textInputRef = useRef<HTMLTextAreaElement | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Load image element
  useEffect(() => {
    if (!isOpen || !image.url) return;

    setImgLoaded(false);
    setAnnotations([]);
    setHistory([[]]);
    setHistoryIndex(0);
    setRotation(0);
    setActiveTextInput(null);

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

  // Focus text input when opened
  useEffect(() => {
    if (activeTextInput && textInputRef.current) {
      textInputRef.current.focus();
      textInputRef.current.select();
    }
  }, [activeTextInput]);

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
    }
  }, [history, historyIndex]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextIndex = historyIndex + 1;
      setHistoryIndex(nextIndex);
      setAnnotations(history[nextIndex]);
    }
  }, [history, historyIndex]);

  const handleRotate = useCallback(() => {
    setRotation((r) => (r + 90) % 360);
  }, []);

  const handleClearAll = useCallback(() => {
    if (annotations.length === 0) return;
    pushState([]);
    toast.success('Đã xóa tất cả ghi chú trên ảnh');
  }, [annotations.length, pushState]);

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
          ctx.globalAlpha = 0.38;
          ctx.strokeStyle = path.color;
          ctx.lineWidth = path.strokeWidth * 3.2;
          ctx.lineCap = 'square';
          ctx.lineJoin = 'miter';

          ctx.beginPath();
          ctx.moveTo(path.points[0].x, path.points[0].y);
          for (let i = 1; i < path.points.length; i++) {
            ctx.lineTo(path.points[i].x, path.points[i].y);
          }
          ctx.stroke();
          ctx.restore();
        } else if (item.type === 'rect') {
          const shape = item as ShapeAnnotation;
          const x = Math.min(shape.startX, shape.endX);
          const y = Math.min(shape.startY, shape.endY);
          const w = Math.abs(shape.endX - shape.startX);
          const h = Math.abs(shape.endY - shape.startY);

          ctx.save();
          // Subtle fill for highlighting
          ctx.fillStyle = hexToRgba(shape.color, 0.1);
          ctx.fillRect(x, y, w, h);
          // Border
          ctx.strokeStyle = shape.color;
          ctx.lineWidth = shape.strokeWidth;
          ctx.lineJoin = 'round';
          ctx.strokeRect(x, y, w, h);
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
          const textItem = item as TextAnnotation;
          if (!textItem.text.trim()) continue;

          ctx.save();
          const fontSize = textItem.fontSize || 24;
          ctx.font = `600 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif`;

          const lines = textItem.text.split('\n');
          let maxLineWidth = 0;
          lines.forEach((l) => {
            const w = ctx.measureText(l).width;
            if (w > maxLineWidth) maxLineWidth = w;
          });

          const lineHeight = fontSize * 1.35;
          const totalTextHeight = lines.length * lineHeight;
          const padX = 10;
          const padY = 8;
          const boxX = textItem.x;
          const boxY = textItem.y;
          const boxW = maxLineWidth + padX * 2;
          const boxH = totalTextHeight + padY * 2;

          // Background pill/badge so text is always readable regardless of image behind it
          ctx.fillStyle = 'rgba(18, 18, 22, 0.72)';
          ctx.beginPath();
          const radius = 8;
          ctx.roundRect(boxX, boxY, boxW, boxH, radius);
          ctx.fill();

          ctx.strokeStyle = hexToRgba(textItem.color, 0.65);
          ctx.lineWidth = 1.5;
          ctx.stroke();

          // Text content
          ctx.fillStyle = textItem.color === '#1F2937' ? '#FFFFFF' : textItem.color;
          ctx.textBaseline = 'top';
          lines.forEach((line, index) => {
            ctx.fillText(line, boxX + padX, boxY + padY + index * lineHeight);
          });

          ctx.restore();
        }
      }
    },
    [annotations, naturalSize, rotation, imgLoaded]
  );

  // Trigger render on changes
  useEffect(() => {
    renderCanvas();
  }, [renderCanvas]);

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

  // Distance helper between point and line segment
  const distToSegment = (p: Point, v: Point, w: Point) => {
    const l2 = (w.x - v.x) ** 2 + (w.y - v.y) ** 2;
    if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
    let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p.x - (v.x + t * (w.x - v.x)), p.y - (v.y + t * (w.y - v.y)));
  };

  // Find annotation at coordinate (for Eraser or Text selection)
  const findAnnotationAt = (pt: Point): Annotation | null => {
    const threshold = 16;
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
        // Text box approximate bounds
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (ctx) {
          ctx.font = `600 ${t.fontSize}px sans-serif`;
          const lines = t.text.split('\n');
          let maxW = 0;
          lines.forEach((l) => {
            const w = ctx.measureText(l).width;
            if (w > maxW) maxW = w;
          });
          const boxW = maxW + 20;
          const boxH = lines.length * (t.fontSize * 1.35) + 16;
          if (pt.x >= t.x && pt.x <= t.x + boxW && pt.y >= t.y && pt.y <= t.y + boxH) {
            return a;
          }
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
    }
  };

  // Pointer Down (Start drawing / Text click / Eraser)
  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
    const pt = getCanvasCoords(e);
    if (!pt) return;

    // Commit any currently open text input before starting a new action
    if (activeTextInput) {
      commitActiveText();
      return;
    }

    if (activeTool === 'eraser') {
      eraseAt(pt);
      setIsDrawing(true);
      return;
    }

    if (activeTool === 'text') {
      // Check if clicking existing text to edit
      const hit = findAnnotationAt(pt);
      const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

      if (hit && hit.type === 'text') {
        const t = hit as TextAnnotation;
        setActiveTextInput({
          id: t.id,
          canvasX: t.x,
          canvasY: t.y,
          screenX: clientX,
          screenY: clientY,
          text: t.text,
        });
        // Remove temporarily while editing
        setAnnotations((prev) => prev.filter((a) => a.id !== t.id));
      } else {
        // Create new text box
        setActiveTextInput({
          canvasX: pt.x,
          canvasY: pt.y,
          screenX: clientX,
          screenY: clientY,
          text: '',
        });
      }
      return;
    }

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

  // Pointer Move (Drawing update / Continuous Eraser)
  const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const pt = getCanvasCoords(e);
    if (!pt) return;

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

  // Pointer Up (Commit drawn shape/path)
  const handlePointerUp = () => {
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
  const commitActiveText = () => {
    if (!activeTextInput) return;
    const trimmed = activeTextInput.text.trim();
    if (trimmed) {
      const textAnn: TextAnnotation = {
        id: activeTextInput.id || 'ann_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        type: 'text',
        color: selectedColor,
        strokeWidth: 2,
        x: activeTextInput.canvasX,
        y: activeTextInput.canvasY,
        text: trimmed,
        fontSize: selectedFontSize,
      };
      pushState([...annotations, textAnn]);
    }
    setActiveTextInput(null);
  };

  // Keyboard shortcuts (Undo, Redo, Save, Tools, Escape)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't capture single-letter tool hotkeys when typing in textarea
      const isTyping = document.activeElement?.tagName === 'TEXTAREA' || document.activeElement?.tagName === 'INPUT';

      if (e.key === 'Escape') {
        e.preventDefault();
        if (activeTextInput) {
          commitActiveText();
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

      if (!isTyping && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const k = e.key.toLowerCase();
        if (k === 'p') setActiveTool('pen');
        else if (k === 'h') setActiveTool('highlighter');
        else if (k === 'r') setActiveTool('rect');
        else if (k === 'a') setActiveTool('arrow');
        else if (k === 't') setActiveTool('text');
        else if (k === 'e') setActiveTool('eraser');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, activeTextInput, handleUndo, handleRedo, annotations]);

  // Export full-res dataURL from canvas
  const exportEditedImage = async (): Promise<{ dataUrl: string; size: number } | null> => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    // Render final clean state without helper overlays
    renderCanvas(null);

    const dataUrl = canvas.toDataURL('image/png', 0.95);
    // Estimate byte size from dataUrl base64 length
    const head = 'data:image/png;base64,';
    const base64Len = dataUrl.length - head.length;
    const size = Math.round((base64Len * 3) / 4);

    return { dataUrl, size };
  };

  // Action: Save to note
  const handleSave = async () => {
    try {
      setIsSaving(true);
      commitActiveText();

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
    commitActiveText();
    const res = await exportEditedImage();
    if (!res) return;
    const filename = (image.name ? image.name.replace(/\.[^/.]+$/, '') : 'note-image') + '_markup.png';
    downloadImage(res.dataUrl, filename);
    toast.success('Đã tải hình ảnh đã chỉnh sửa về máy!');
  };

  // Action: Copy to clipboard
  const handleCopy = async () => {
    commitActiveText();
    const res = await exportEditedImage();
    if (!res) return;
    const ok = await copyImageToClipboard(res.dataUrl);
    if (ok) {
      toast.success('Đã sao chép ảnh vào bộ nhớ tạm (Clipboard)!');
    } else {
      toast.error('Không thể sao chép ảnh vào Clipboard');
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[10020] bg-black/85 backdrop-blur-2xl flex flex-col select-none overflow-hidden animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isDrawing) {
          commitActiveText();
        }
      }}
    >
      {/* ────────────────── TOP CONTROL BAR (Apple Dark Liquid Glass) ────────────────── */}
      <header className="h-14 sm:h-16 px-4 sm:px-6 flex items-center justify-between border-b border-white/10 bg-white/[0.04] backdrop-blur-3xl shrink-0 z-30">
        {/* Left: Info */}
        <div className="flex items-center gap-3 min-w-0 pr-4">
          <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/90 shrink-0">
            <SFPhoto size={16} />
          </div>
          <div className="min-w-0">
            <h3 className="text-[13.5px] font-semibold text-white truncate max-w-xs sm:max-w-md">
              Chỉnh sửa: {image.name || 'Ảnh ghi chú'}
            </h3>
            <p className="text-[11px] font-mono text-white/60">
              {rotation % 180 === 0 ? `${naturalSize.w} × ${naturalSize.h}px` : `${naturalSize.h} × ${naturalSize.w}px`}
              {image.size ? ` • ${formatFileSize(image.size)}` : ''}
              {annotations.length > 0 ? ` • ${annotations.length} ghi chú` : ''}
            </p>
          </div>
        </div>

        {/* Center: Utility Controls (Undo, Redo, Rotate, Clear) */}
        <div className="flex items-center gap-1.5 shrink-0 bg-white/10 px-2.5 py-1 rounded-full border border-white/15">
          <button
            type="button"
            onClick={handleUndo}
            disabled={historyIndex <= 0}
            className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center transition-all duration-150 active:scale-90 text-white/90 hover:text-white hover:bg-white/15",
              historyIndex <= 0 && "opacity-35 pointer-events-none"
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
              "w-8 h-8 rounded-full flex items-center justify-center transition-all duration-150 active:scale-90 text-white/90 hover:text-white hover:bg-white/15",
              historyIndex >= history.length - 1 && "opacity-35 pointer-events-none"
            )}
            title="Làm lại (Ctrl+Y)"
          >
            <SFArrowUturnForward size={14} />
          </button>

          <span className="w-[1px] h-4 bg-white/20 mx-1" />

          <button
            type="button"
            onClick={handleRotate}
            className="w-8 h-8 rounded-full flex items-center justify-center transition-all duration-150 active:scale-90 text-white/90 hover:text-white hover:bg-white/15"
            title="Xoay ảnh 90° theo chiều kim đồng hồ"
          >
            <SFArrowClockwise size={14} />
          </button>

          <button
            type="button"
            onClick={handleClearAll}
            disabled={annotations.length === 0}
            className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center transition-all duration-150 active:scale-90 text-white/90 hover:text-red-400 hover:bg-white/15",
              annotations.length === 0 && "opacity-35 pointer-events-none"
            )}
            title="Xóa tất cả ghi chú"
          >
            <SFTrash size={14} />
          </button>
        </div>

        {/* Right: Actions (Copy, Download, Cancel, Save) */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleCopy}
            className="w-9 h-9 rounded-full hidden sm:flex items-center justify-center bg-white/10 hover:bg-white/20 active:scale-90 text-white/90 hover:text-white border border-white/15 transition-all shadow-xs"
            title="Sao chép ảnh đã chỉnh sửa (Clipboard)"
          >
            <SFSquareOnSquare size={15} />
          </button>

          <button
            type="button"
            onClick={handleDownload}
            className="w-9 h-9 rounded-full hidden sm:flex items-center justify-center bg-white/10 hover:bg-white/20 active:scale-90 text-white/90 hover:text-white border border-white/15 transition-all shadow-xs"
            title="Tải ảnh về máy"
          >
            <SFArrowDownToLine size={15} />
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-full text-[13px] font-medium text-white/80 hover:text-white bg-white/10 hover:bg-white/20 border border-white/15 transition-all active:scale-95"
            title="Hủy bỏ (Esc)"
          >
            Hủy
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[13px] font-semibold text-white bg-emerald-600 hover:bg-emerald-500 shadow-[0_4px_16px_rgba(16,185,129,0.35)] transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
            title="Lưu thay đổi vào ghi chú (Ctrl+S)"
          >
            <SFCheckmark size={14} />
            <span>{isSaving ? 'Đang lưu...' : 'Lưu ảnh'}</span>
          </button>
        </div>
      </header>

      {/* ────────────────── CANVAS WORKSPACE STAGE ────────────────── */}
      <main
        ref={containerRef}
        className="flex-1 w-full relative flex items-center justify-center overflow-auto p-4 sm:p-6"
        style={{
          cursor:
            activeTool === 'pen'
              ? 'crosshair'
              : activeTool === 'highlighter'
              ? 'crosshair'
              : activeTool === 'eraser'
              ? 'cell'
              : activeTool === 'text'
              ? 'text'
              : 'crosshair',
        }}
      >
        <div className="relative inline-flex items-center justify-center max-w-full max-h-full">
          <canvas
            ref={canvasRef}
            onMouseDown={handlePointerDown}
            onMouseMove={handlePointerMove}
            onMouseUp={handlePointerUp}
            onTouchStart={handlePointerDown}
            onTouchMove={handlePointerMove}
            onTouchEnd={handlePointerUp}
            className="max-h-[calc(100vh-180px)] max-w-[90vw] object-contain rounded-xl shadow-[0_20px_70px_rgba(0,0,0,0.85)] border border-white/15 select-none touch-none"
          />

          {/* Floating inline text box overlay while typing */}
          {activeTextInput && (
            <div
              className="absolute z-40 bg-[#1c1c24] border border-amber-500/80 rounded-xl shadow-2xl p-2 flex flex-col gap-1.5 animate-scale-up"
              style={{
                left: Math.max(10, Math.min(window.innerWidth - 300, activeTextInput.screenX - 80)),
                top: Math.max(70, Math.min(window.innerHeight - 150, activeTextInput.screenY - 40)),
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <textarea
                ref={textInputRef}
                value={activeTextInput.text}
                onChange={(e) =>
                  setActiveTextInput({ ...activeTextInput, text: e.target.value })
                }
                placeholder="Nhập ghi chú trực tiếp..."
                rows={2}
                style={{
                  color: selectedColor === '#1F2937' ? '#FFFFFF' : selectedColor,
                  fontSize: `${Math.max(14, selectedFontSize * 0.75)}px`,
                }}
                className="w-64 bg-transparent outline-none resize-none font-semibold leading-relaxed border-none focus:ring-0 p-1 placeholder-white/40"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    commitActiveText();
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    commitActiveText();
                  }
                }}
              />
              <div className="flex items-center justify-between pt-1 border-t border-white/10 text-[11px] text-white/60">
                <span>Nhấn Ctrl+Enter để xong</span>
                <button
                  type="button"
                  onClick={commitActiveText}
                  className="px-2.5 py-0.5 rounded-full bg-amber-500 hover:bg-amber-400 text-black font-semibold transition-all active:scale-95"
                >
                  Xong
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ────────────────── BOTTOM FLOATING MARKUP TOOLBAR (Apple Liquid Glass Pill) ────────────────── */}
      <footer className="h-16 sm:h-20 flex items-center justify-center px-4 pb-3 pt-1 shrink-0 z-30">
        <div className="flex items-center gap-1.5 sm:gap-2.5 px-3 sm:px-4 py-2 rounded-full bg-black/60 dark:bg-white/[0.08] backdrop-blur-3xl border border-white/20 shadow-[0_16px_50px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(255,255,255,0.3)] text-white">
          {/* Tool: Bút vẽ (Pen) */}
          <button
            type="button"
            onClick={() => setActiveTool('pen')}
            className={cn(
              "w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 active:scale-90 cursor-pointer",
              activeTool === 'pen'
                ? "bg-white/25 text-white scale-105 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_2px_8px_rgba(0,0,0,0.3)]"
                : "text-white/70 hover:text-white hover:bg-white/10"
            )}
            title="Bút vẽ tự do (Phím P)"
          >
            <SFPencil size={16} />
          </button>

          {/* Tool: Dạ quang (Highlighter) */}
          <button
            type="button"
            onClick={() => setActiveTool('highlighter')}
            className={cn(
              "w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 active:scale-90 cursor-pointer",
              activeTool === 'highlighter'
                ? "bg-white/25 text-white scale-105 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_2px_8px_rgba(0,0,0,0.3)]"
                : "text-white/70 hover:text-white hover:bg-white/10"
            )}
            title="Bút dạ quang đánh dấu (Phím H)"
          >
            <SFHighlighter size={16} />
          </button>

          {/* Tool: Khung chữ nhật (Rectangle) */}
          <button
            type="button"
            onClick={() => setActiveTool('rect')}
            className={cn(
              "w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 active:scale-90 cursor-pointer",
              activeTool === 'rect'
                ? "bg-white/25 text-white scale-105 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_2px_8px_rgba(0,0,0,0.3)]"
                : "text-white/70 hover:text-white hover:bg-white/10"
            )}
            title="Khung chữ nhật (Phím R)"
          >
            <SFSquare size={16} />
          </button>

          {/* Tool: Mũi tên (Arrow) */}
          <button
            type="button"
            onClick={() => setActiveTool('arrow')}
            className={cn(
              "w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 active:scale-90 cursor-pointer",
              activeTool === 'arrow'
                ? "bg-white/25 text-white scale-105 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_2px_8px_rgba(0,0,0,0.3)]"
                : "text-white/70 hover:text-white hover:bg-white/10"
            )}
            title="Mũi tên chỉ dẫn (Phím A)"
          >
            <SFArrowRight size={16} />
          </button>

          {/* Tool: Văn bản (Text) */}
          <button
            type="button"
            onClick={() => setActiveTool('text')}
            className={cn(
              "w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 active:scale-90 cursor-pointer",
              activeTool === 'text'
                ? "bg-white/25 text-white scale-105 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_2px_8px_rgba(0,0,0,0.3)]"
                : "text-white/70 hover:text-white hover:bg-white/10"
            )}
            title="Chèn ghi chú chữ (Phím T)"
          >
            <SFTextformat size={16} />
          </button>

          {/* Tool: Tẩy (Eraser) */}
          <button
            type="button"
            onClick={() => setActiveTool('eraser')}
            className={cn(
              "w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 active:scale-90 cursor-pointer",
              activeTool === 'eraser'
                ? "bg-white/25 text-white scale-105 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_2px_8px_rgba(0,0,0,0.3)]"
                : "text-white/70 hover:text-white hover:bg-white/10"
            )}
            title="Tẩy xóa nét vẽ / chữ (Phím E)"
          >
            <SFEraser size={16} />
          </button>

          <span className="w-[1px] h-6 bg-white/20 mx-1" />

          {/* Preset Colors */}
          <div className="flex items-center gap-1.5">
            {PRESET_COLORS.map((col) => (
              <button
                key={col.hex}
                type="button"
                onClick={() => setSelectedColor(col.hex)}
                className={cn(
                  "w-6 h-6 rounded-full transition-all duration-200 cursor-pointer relative flex items-center justify-center border",
                  selectedColor === col.hex
                    ? "scale-125 border-white shadow-[0_0_8px_rgba(255,255,255,0.6)]"
                    : "border-black/30 hover:scale-110 opacity-80 hover:opacity-100"
                )}
                style={{ backgroundColor: col.hex }}
                title={col.name}
              />
            ))}
          </div>

          <span className="w-[1px] h-6 bg-white/20 mx-1" />

          {/* Stroke Width Selector (When not in text mode) */}
          {activeTool !== 'text' ? (
            <div className="flex items-center gap-1">
              {STROKE_WIDTHS.map((sw) => (
                <button
                  key={sw.value}
                  type="button"
                  onClick={() => setSelectedStrokeWidth(sw.value)}
                  className={cn(
                    "w-7 h-7 rounded-full flex items-center justify-center transition-all duration-150 cursor-pointer",
                    selectedStrokeWidth === sw.value
                      ? "bg-white/25 text-white shadow-xs"
                      : "text-white/60 hover:text-white hover:bg-white/10"
                  )}
                  title={`Độ dày: ${sw.label}`}
                >
                  <span
                    className="rounded-full bg-current transition-all"
                    style={{ width: sw.dotSize, height: sw.dotSize }}
                  />
                </button>
              ))}
            </div>
          ) : (
            /* Font Size Selector (When in text mode) */
            <div className="flex items-center gap-1">
              {FONT_SIZES.map((fs) => (
                <button
                  key={fs.value}
                  type="button"
                  onClick={() => setSelectedFontSize(fs.value)}
                  className={cn(
                    "w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-bold transition-all duration-150 cursor-pointer",
                    selectedFontSize === fs.value
                      ? "bg-white/25 text-white shadow-xs"
                      : "text-white/60 hover:text-white hover:bg-white/10"
                  )}
                  title={`Cỡ chữ: ${fs.label}`}
                >
                  {fs.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </footer>
    </div>,
    document.body
  );
};
