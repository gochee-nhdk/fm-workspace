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
  SFPointerArrow,
  SFTextBubble,
  SFBold,
  SFItalic,
} from '@/components/ui/AppleIcon';
import { downloadImage, copyImageToClipboard, formatFileSize } from '@/services/noteImageService';
import toast from 'react-hot-toast';

export type AnnotationTool = 'select' | 'pen' | 'highlighter' | 'rect' | 'arrow' | 'text' | 'note' | 'eraser';

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
  fontFamily: string;
  isBold?: boolean;
  isItalic?: boolean;
}

export interface NoteAnnotation extends BaseAnnotation {
  type: 'note';
  x: number;
  y: number;
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
  { name: 'Đỏ', hex: '#EF4444' },
  { name: 'Vàng cam', hex: '#F59E0B' },
  { name: 'Xanh lá', hex: '#10B981' },
  { name: 'Xanh dương', hex: '#3B82F6' },
  { name: 'Đen', hex: '#1F2937' },
  { name: 'Trắng', hex: '#FFFFFF' },
];

const FONT_FAMILIES = [
  { label: 'Hệ thống (San Francisco)', value: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
  { label: 'Serif (New York)', value: 'Georgia, Cambria, "Times New Roman", serif' },
  { label: 'Mono (SF Mono)', value: '"SF Mono", Menlo, Monaco, Consolas, monospace' },
  { label: 'Viết tay (Caveat)', value: 'cursive, "Brush Script MT", sans-serif' },
];

export const ImageEditorModal: React.FC<ImageEditorModalProps> = ({
  isOpen,
  onClose,
  image,
  onSave,
}) => {
  // Current active tool (toggling active tool off switches to 'select')
  const [activeTool, setActiveTool] = useState<AnnotationTool>('pen');
  const [selectedColor, setSelectedColor] = useState<string>('#EF4444');
  const [selectedStrokeWidth, setSelectedStrokeWidth] = useState<number>(6);
  const [selectedFontSize, setSelectedFontSize] = useState<number>(24);
  const [selectedFontFamily, setSelectedFontFamily] = useState<string>(FONT_FAMILIES[0].value);
  const [isBold, setIsBold] = useState<boolean>(true);
  const [isItalic, setIsItalic] = useState<boolean>(false);
  const [rotation, setRotation] = useState<number>(0); // 0, 90, 180, 270

  // Annotation states
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [history, setHistory] = useState<Annotation[][]>([[]]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);

  // Selected annotation for moving / dragging in 'select' mode
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);
  const [isDraggingSelected, setIsDraggingSelected] = useState<boolean>(false);
  const dragStartPointRef = useRef<Point | null>(null);
  const dragOriginalAnnotationRef = useRef<Annotation | null>(null);

  // Active drawing interaction
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const currentPathRef = useRef<Point[]>([]);
  const shapeStartRef = useRef<Point | null>(null);
  const activeAnnotationRef = useRef<Annotation | null>(null);

  // Active Text / Note typing box overlay
  const [activeTextInput, setActiveTextInput] = useState<{
    id?: string;
    type: 'text' | 'note';
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

  // Tool toggle handler: clicking the active tool toggles it off and switches back to 'select' mode
  const handleSelectTool = (tool: AnnotationTool) => {
    if (activeTool === tool) {
      setActiveTool('select');
      toast('Chuyển sang chế độ chọn & di chuyển', { icon: '👆', duration: 1800 });
    } else {
      setActiveTool(tool);
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
    setActiveTextInput(null);
    setSelectedAnnotationId(null);
    setActiveTool('pen');

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
    setRotation((r) => (r + 90) % 360);
  }, []);

  const handleClearAll = useCallback(() => {
    if (annotations.length === 0) return;
    pushState([]);
    setSelectedAnnotationId(null);
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

          // Subtle tinted fill for high visibility
          ctx.fillStyle = hexToRgba(shape.color, 0.12);
          ctx.beginPath();
          ctx.roundRect(x, y, w, h, 8);
          ctx.fill();
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
          // Pure typographic text (customizable font, size, bold, italic, color)
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

          // Shadow for readability on complex backgrounds
          ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
          ctx.shadowBlur = 6;
          ctx.shadowOffsetX = 1;
          ctx.shadowOffsetY = 1;

          ctx.fillStyle = textItem.color;
          ctx.textBaseline = 'top';
          lines.forEach((line, index) => {
            ctx.fillText(line, textItem.x, textItem.y + index * lineHeight);
          });

          ctx.restore();
        } else if (item.type === 'note') {
          // Apple sticky note callout card / badge
          const noteItem = item as NoteAnnotation;
          if (!noteItem.text.trim()) continue;

          ctx.save();
          const fontSize = noteItem.fontSize || 20;
          ctx.font = `600 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;

          const lines = noteItem.text.split('\n');
          let maxLineWidth = 0;
          lines.forEach((l) => {
            const w = ctx.measureText(l).width;
            if (w > maxLineWidth) maxLineWidth = w;
          });

          const lineHeight = fontSize * 1.35;
          const totalTextHeight = lines.length * lineHeight;
          const padX = 14;
          const padY = 10;
          const boxX = noteItem.x;
          const boxY = noteItem.y;
          const boxW = Math.max(120, maxLineWidth + padX * 2);
          const boxH = totalTextHeight + padY * 2 + 6;

          // Sticky note container (Apple Warm Yellow or Frosted Dark Card with Drop Shadow)
          ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
          ctx.shadowBlur = 16;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 6;

          // Background fill
          ctx.fillStyle = '#FEF3C7'; // Apple classic sticky note amber-100
          ctx.beginPath();
          ctx.roundRect(boxX, boxY, boxW, boxH, 12);
          ctx.fill();

          // Sticky note top accent line
          ctx.shadowColor = 'transparent';
          ctx.fillStyle = '#F59E0B'; // amber-500 top strip
          ctx.beginPath();
          ctx.roundRect(boxX, boxY, boxW, 5, [12, 12, 0, 0]);
          ctx.fill();

          // Border
          ctx.strokeStyle = '#FCD34D';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(boxX, boxY, boxW, boxH, 12);
          ctx.stroke();

          // Sticky note content text
          ctx.fillStyle = '#78350F'; // warm dark amber text
          ctx.textBaseline = 'top';
          lines.forEach((line, index) => {
            ctx.fillText(line, boxX + padX, boxY + padY + 6 + index * lineHeight);
          });

          ctx.restore();
        }

        // Selection highlight ring when in 'select' mode
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
            ctx.strokeRect(t.x - 4, t.y - 4, 150, 40);
          } else if (item.type === 'note') {
            const n = item as NoteAnnotation;
            ctx.strokeRect(n.x - 4, n.y - 4, 160, 50);
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
          ctx.font = `${t.isItalic ? 'italic' : 'normal'} ${t.isBold ? '700' : '500'} ${t.fontSize}px sans-serif`;
          const lines = t.text.split('\n');
          let maxW = 0;
          lines.forEach((l) => {
            const w = ctx.measureText(l).width;
            if (w > maxW) maxW = w;
          });
          const boxW = maxW + 20;
          const boxH = lines.length * (t.fontSize * 1.35) + 16;
          if (pt.x >= t.x - 10 && pt.x <= t.x + boxW + 10 && pt.y >= t.y - 10 && pt.y <= t.y + boxH + 10) {
            return a;
          }
        }
      } else if (a.type === 'note') {
        const n = a as NoteAnnotation;
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (ctx) {
          ctx.font = `600 ${n.fontSize || 20}px sans-serif`;
          const lines = n.text.split('\n');
          let maxW = 0;
          lines.forEach((l) => {
            const w = ctx.measureText(l).width;
            if (w > maxW) maxW = w;
          });
          const boxW = Math.max(120, maxW + 28);
          const boxH = lines.length * ((n.fontSize || 20) * 1.35) + 32;
          if (pt.x >= n.x - 10 && pt.x <= n.x + boxW + 10 && pt.y >= n.y - 10 && pt.y <= n.y + boxH + 10) {
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
      if (selectedAnnotationId === hit.id) {
        setSelectedAnnotationId(null);
      }
    }
  };

  // Pointer Down (Start drawing / Text click / Eraser / Select & Move)
  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
    const pt = getCanvasCoords(e);
    if (!pt) return;

    // Commit any currently open text input before starting a new action
    if (activeTextInput) {
      commitActiveText();
      return;
    }

    // ── SELECT / MOVE MODE ──
    if (activeTool === 'select') {
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

    // ── TEXT MODE ──
    if (activeTool === 'text') {
      const hit = findAnnotationAt(pt);
      const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

      if (hit && hit.type === 'text') {
        const t = hit as TextAnnotation;
        setActiveTextInput({
          id: t.id,
          type: 'text',
          canvasX: t.x,
          canvasY: t.y,
          screenX: clientX,
          screenY: clientY,
          text: t.text,
        });
        setAnnotations((prev) => prev.filter((a) => a.id !== t.id));
      } else {
        setActiveTextInput({
          type: 'text',
          canvasX: pt.x,
          canvasY: pt.y,
          screenX: clientX,
          screenY: clientY,
          text: '',
        });
      }
      return;
    }

    // ── NOTE (STICKY CALLOUT) MODE ──
    if (activeTool === 'note') {
      const hit = findAnnotationAt(pt);
      const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

      if (hit && hit.type === 'note') {
        const n = hit as NoteAnnotation;
        setActiveTextInput({
          id: n.id,
          type: 'note',
          canvasX: n.x,
          canvasY: n.y,
          screenX: clientX,
          screenY: clientY,
          text: n.text,
        });
        setAnnotations((prev) => prev.filter((a) => a.id !== n.id));
      } else {
        setActiveTextInput({
          type: 'note',
          canvasX: pt.x,
          canvasY: pt.y,
          screenX: clientX,
          screenY: clientY,
          text: '',
        });
      }
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

  // Pointer Move (Drawing update / Move selected / Continuous Eraser)
  const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
    const pt = getCanvasCoords(e);
    if (!pt) return;

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
              x: nOrig.x + dx,
              y: nOrig.y + dy,
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

  // Pointer Up (Commit drawn shape/path or finish dragging)
  const handlePointerUp = () => {
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

  // Commit typed text or note
  const commitActiveText = () => {
    if (!activeTextInput) return;
    const trimmed = activeTextInput.text.trim();
    if (trimmed) {
      if (activeTextInput.type === 'text') {
        const textAnn: TextAnnotation = {
          id: activeTextInput.id || 'ann_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
          type: 'text',
          color: selectedColor,
          strokeWidth: 2,
          x: activeTextInput.canvasX,
          y: activeTextInput.canvasY,
          text: trimmed,
          fontSize: selectedFontSize,
          fontFamily: selectedFontFamily,
          isBold,
          isItalic,
        };
        pushState([...annotations, textAnn]);
      } else {
        const noteAnn: NoteAnnotation = {
          id: activeTextInput.id || 'ann_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
          type: 'note',
          color: '#FEF3C7',
          strokeWidth: 1,
          x: activeTextInput.canvasX,
          y: activeTextInput.canvasY,
          text: trimmed,
          fontSize: Math.min(22, selectedFontSize),
        };
        pushState([...annotations, noteAnn]);
      }
    }
    setActiveTextInput(null);
  };

  // Keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const isTyping = document.activeElement?.tagName === 'TEXTAREA' || document.activeElement?.tagName === 'INPUT';

      if (e.key === 'Escape') {
        e.preventDefault();
        if (activeTextInput) {
          commitActiveText();
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
        if (k === 'v') setActiveTool('select');
        else if (k === 'p') handleSelectTool('pen');
        else if (k === 'h') handleSelectTool('highlighter');
        else if (k === 'r') handleSelectTool('rect');
        else if (k === 'a') handleSelectTool('arrow');
        else if (k === 't') handleSelectTool('text');
        else if (k === 'n') handleSelectTool('note');
        else if (k === 'e') handleSelectTool('eraser');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, activeTextInput, handleUndo, handleRedo, annotations, activeTool, selectedAnnotationId]);

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
    await copyImageToClipboard(res.dataUrl);
    toast.success('Đã sao chép ảnh vào clipboard!');
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Chỉnh sửa hình ảnh Apple Markup"
      className="fixed inset-0 z-[10020] flex flex-col bg-black/85 backdrop-blur-3xl select-none animate-in fade-in duration-200 overflow-hidden"
    >
      {/* ────────────────── TOP BAR (Header Actions) ────────────────── */}
      <header className="h-14 sm:h-16 flex items-center justify-between px-4 sm:px-6 border-b border-white/10 shrink-0 z-30">
        {/* Left: Info & Filename */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-full bg-white/10 text-white flex items-center justify-center shrink-0">
            <SFPhoto size={16} />
          </div>
          <div className="min-w-0">
            <h3 className="text-[13.5px] font-semibold text-white truncate max-w-[200px] sm:max-w-xs">
              Chỉnh sửa: {image.name || 'Hình ảnh'}
            </h3>
            <p className="text-[11px] text-white/60">
              {naturalSize.w} × {naturalSize.h}px • {image.size ? formatFileSize(image.size) : 'Ảnh ghi chú'} • {annotations.length} ghi chú
            </p>
          </div>
        </div>

        {/* Center: History (Undo, Redo, Rotate, Delete Selected, Clear All) */}
        <div className="flex items-center gap-1 sm:gap-1.5 px-2 py-1 rounded-full bg-white/10 border border-white/15 backdrop-blur-xl shadow-xs">
          <button
            type="button"
            onClick={handleUndo}
            disabled={historyIndex === 0}
            className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center text-white/90 hover:text-white hover:bg-white/15 transition-all active:scale-90",
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
              "w-8 h-8 rounded-full flex items-center justify-center text-white/90 hover:text-white hover:bg-white/15 transition-all active:scale-90",
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
            className="w-8 h-8 rounded-full flex items-center justify-center text-white/90 hover:text-white hover:bg-white/15 transition-all active:scale-90"
            title="Xoay ảnh 90°"
          >
            <SFArrowClockwise size={14} />
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
              className="w-8 h-8 rounded-full flex items-center justify-center text-red-400 hover:text-red-300 hover:bg-red-500/20 transition-all active:scale-90"
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
              "w-8 h-8 rounded-full flex items-center justify-center text-white/90 hover:text-white hover:bg-white/15 transition-all active:scale-90",
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
            onClick={onClose}
            className="px-4 py-1.5 rounded-full text-[13px] font-medium text-white/80 hover:text-white bg-white/10 hover:bg-white/20 border border-white/15 transition-all active:scale-95 cursor-pointer"
            title="Hủy bỏ (Esc)"
          >
            Hủy
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
        </div>
      </header>

      {/* ────────────────── CANVAS WORKSPACE STAGE ────────────────── */}
      <main
        ref={containerRef}
        className="flex-1 w-full relative flex items-center justify-center overflow-auto p-4 sm:p-6"
        style={{
          cursor:
            activeTool === 'select'
              ? isDraggingSelected
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

          {/* Floating inline text / note box overlay while typing */}
          {activeTextInput && (
            <div
              className={cn(
                "absolute z-40 backdrop-blur-2xl rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(255,255,255,0.2)] p-3 flex flex-col gap-2.5 animate-scale-up border",
                activeTextInput.type === 'note'
                  ? "bg-[#FEF3C7] border-[#FCD34D] text-[#78350F]"
                  : "bg-black/75 dark:bg-black/85 border-white/20 text-white"
              )}
              style={{
                left: Math.max(10, Math.min(window.innerWidth - 320, activeTextInput.screenX - 80)),
                top: Math.max(70, Math.min(window.innerHeight - 170, activeTextInput.screenY - 40)),
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between text-[11px] font-semibold opacity-70 border-b border-black/10 dark:border-white/10 pb-1">
                <span>{activeTextInput.type === 'note' ? '📌 Ghi chú Sticky Note' : '🔤 Thêm chữ vào ảnh'}</span>
                <span>Ctrl+Enter xong</span>
              </div>

              <textarea
                ref={textInputRef}
                value={activeTextInput.text}
                onChange={(e) =>
                  setActiveTextInput({ ...activeTextInput, text: e.target.value })
                }
                placeholder={activeTextInput.type === 'note' ? 'Nhập nội dung ghi chú callout...' : 'Nhập chữ chèn vào ảnh...'}
                rows={2}
                style={{
                  color: activeTextInput.type === 'note' ? '#78350F' : selectedColor === '#1F2937' ? '#FFFFFF' : selectedColor,
                  fontSize: `${Math.max(14, selectedFontSize * 0.75)}px`,
                  fontFamily: activeTextInput.type === 'text' ? selectedFontFamily : 'inherit',
                  fontWeight: activeTextInput.type === 'text' && isBold ? 700 : 500,
                  fontStyle: activeTextInput.type === 'text' && isItalic ? 'italic' : 'normal',
                }}
                className={cn(
                  "w-72 bg-transparent outline-none resize-none leading-relaxed border-none focus:ring-0 p-1 placeholder-black/30 dark:placeholder-white/40",
                  activeTextInput.type === 'note' ? "text-[#78350F]" : "text-white"
                )}
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
              <div className="flex items-center justify-between pt-1 border-t border-black/10 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => setActiveTextInput(null)}
                  className="px-2.5 py-0.5 rounded-full text-[11px] opacity-70 hover:opacity-100 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={commitActiveText}
                  className="px-3 py-1 rounded-full bg-[#0071e3] hover:bg-[#0077ed] text-white font-medium text-[12px] shadow-sm transition-all active:scale-95 cursor-pointer"
                >
                  Xong
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ────────────────── BOTTOM FLOATING MARKUP TOOLBAR (Apple Liquid Glass Pill) ────────────────── */}
      <footer className="h-20 sm:h-24 flex flex-col items-center justify-center px-4 pb-3 pt-1 shrink-0 z-30 gap-1.5">
        <div className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 rounded-full bg-black/65 dark:bg-white/[0.08] backdrop-blur-3xl border border-white/20 shadow-[0_16px_50px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(255,255,255,0.3)] text-white flex-wrap justify-center">
          {/* Tool: Chọn & Di chuyển (Pointer / Select) */}
          <button
            type="button"
            onClick={() => setActiveTool('select')}
            className={cn(
              "w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 active:scale-90 cursor-pointer",
              activeTool === 'select'
                ? "bg-white/30 text-white scale-105 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_2px_8px_rgba(0,0,0,0.3)]"
                : "text-white/70 hover:text-white hover:bg-white/10"
            )}
            title="Trỏ chuột: Chọn & kéo di chuyển đối tượng (Phím V hoặc nhấp lại công cụ đang chọn)"
          >
            <SFPointerArrow size={16} />
          </button>

          <span className="w-[1px] h-5 bg-white/20 mx-0.5" />

          {/* Tool: Bút vẽ (Pen) - Click again to toggle to select */}
          <button
            type="button"
            onClick={() => handleSelectTool('pen')}
            className={cn(
              "w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 active:scale-90 cursor-pointer",
              activeTool === 'pen'
                ? "bg-white/25 text-white scale-105 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_2px_8px_rgba(0,0,0,0.3)]"
                : "text-white/70 hover:text-white hover:bg-white/10"
            )}
            title="Bút vẽ tự do (Phím P — Nhấp lần nữa để tắt)"
          >
            <SFPencil size={16} />
          </button>

          {/* Tool: Dạ quang (Highlighter) */}
          <button
            type="button"
            onClick={() => handleSelectTool('highlighter')}
            className={cn(
              "w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 active:scale-90 cursor-pointer",
              activeTool === 'highlighter'
                ? "bg-white/25 text-white scale-105 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_2px_8px_rgba(0,0,0,0.3)]"
                : "text-white/70 hover:text-white hover:bg-white/10"
            )}
            title="Bút dạ quang (Phím H — Nhấp lần nữa để tắt)"
          >
            <SFHighlighter size={16} />
          </button>

          {/* Tool: Khung chữ nhật (Rectangle) */}
          <button
            type="button"
            onClick={() => handleSelectTool('rect')}
            className={cn(
              "w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 active:scale-90 cursor-pointer",
              activeTool === 'rect'
                ? "bg-white/25 text-white scale-105 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_2px_8px_rgba(0,0,0,0.3)]"
                : "text-white/70 hover:text-white hover:bg-white/10"
            )}
            title="Khung chữ nhật (Phím R — Nhấp lần nữa để tắt)"
          >
            <SFSquare size={16} />
          </button>

          {/* Tool: Mũi tên (Arrow) */}
          <button
            type="button"
            onClick={() => handleSelectTool('arrow')}
            className={cn(
              "w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 active:scale-90 cursor-pointer",
              activeTool === 'arrow'
                ? "bg-white/25 text-white scale-105 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_2px_8px_rgba(0,0,0,0.3)]"
                : "text-white/70 hover:text-white hover:bg-white/10"
            )}
            title="Mũi tên chỉ dẫn (Phím A — Nhấp lần nữa để tắt)"
          >
            <SFArrowRight size={16} />
          </button>

          {/* Tool: Văn bản thuần (Text) */}
          <button
            type="button"
            onClick={() => handleSelectTool('text')}
            className={cn(
              "w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 active:scale-90 cursor-pointer",
              activeTool === 'text'
                ? "bg-white/25 text-white scale-105 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_2px_8px_rgba(0,0,0,0.3)]"
                : "text-white/70 hover:text-white hover:bg-white/10"
            )}
            title="Thêm văn bản chữ vào ảnh (Phím T — Tùy chỉnh font, cỡ, đậm/nghiêng)"
          >
            <SFTextformat size={16} />
          </button>

          {/* Tool: Ghi chú Sticky Note (Note) */}
          <button
            type="button"
            onClick={() => handleSelectTool('note')}
            className={cn(
              "w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 active:scale-90 cursor-pointer",
              activeTool === 'note'
                ? "bg-amber-400 text-amber-950 scale-105 shadow-[0_2px_10px_rgba(245,158,11,0.5)] font-bold"
                : "text-white/70 hover:text-white hover:bg-white/10"
            )}
            title="Chèn thẻ ghi chú dán (Sticky Note) trên ảnh (Phím N)"
          >
            <SFTextBubble size={16} />
          </button>

          {/* Tool: Tẩy (Eraser) */}
          <button
            type="button"
            onClick={() => handleSelectTool('eraser')}
            className={cn(
              "w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 active:scale-90 cursor-pointer",
              activeTool === 'eraser'
                ? "bg-white/25 text-white scale-105 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_2px_8px_rgba(0,0,0,0.3)]"
                : "text-white/70 hover:text-white hover:bg-white/10"
            )}
            title="Tẩy xóa nét vẽ / chữ (Phím E — Nhấp lần nữa để tắt)"
          >
            <SFEraser size={16} />
          </button>

          <span className="w-[1px] h-5 bg-white/20 mx-0.5" />

          {/* Preset Colors */}
          <div className="flex items-center gap-1.5">
            {PRESET_COLORS.map((col) => (
              <button
                key={col.hex}
                type="button"
                onClick={() => setSelectedColor(col.hex)}
                className={cn(
                  "w-5 h-5 sm:w-6 sm:h-6 rounded-full transition-all duration-200 cursor-pointer relative flex items-center justify-center border",
                  selectedColor === col.hex
                    ? "scale-125 border-white shadow-[0_0_8px_rgba(255,255,255,0.6)]"
                    : "border-black/30 hover:scale-110 opacity-80 hover:opacity-100"
                )}
                style={{ backgroundColor: col.hex }}
                title={col.name}
              />
            ))}
          </div>

          <span className="w-[1px] h-5 bg-white/20 mx-0.5" />

          {/* Brush Thickness Horizontal Slider with Live Dot & Px Badge */}
          {activeTool !== 'text' && activeTool !== 'note' ? (
            <div className="flex items-center gap-2 pl-1 pr-1.5">
              <span className="text-[11px] text-white/60 font-medium">Nét:</span>
              <input
                type="range"
                min={1}
                max={40}
                value={selectedStrokeWidth}
                onChange={(e) => setSelectedStrokeWidth(Number(e.target.value))}
                className="w-20 sm:w-28 accent-[#0071e3] cursor-pointer h-1.5 bg-white/20 rounded-lg outline-none"
                title={`Kích thước nét vẽ: ${selectedStrokeWidth}px`}
              />
              {/* Live Preview Dot & Size Label */}
              <div className="flex items-center gap-1.5 pl-0.5">
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center bg-white/10 border border-white/20 shrink-0"
                  title={`Xem trước: ${selectedStrokeWidth}px`}
                >
                  <span
                    className="rounded-full transition-all shrink-0"
                    style={{
                      width: Math.min(18, Math.max(2, selectedStrokeWidth * 0.7)),
                      height: Math.min(18, Math.max(2, selectedStrokeWidth * 0.7)),
                      backgroundColor: selectedColor,
                    }}
                  />
                </div>
                <span className="text-[11px] font-mono text-white/80 min-w-[24px]">
                  {selectedStrokeWidth}px
                </span>
              </div>
            </div>
          ) : activeTool === 'text' ? (
            /* Font & Typography Controls for Text Tool */
            <div className="flex items-center gap-1.5 pl-1">
              <select
                value={selectedFontFamily}
                onChange={(e) => setSelectedFontFamily(e.target.value)}
                className="bg-black/40 border border-white/20 text-white text-[11px] rounded-lg px-2 py-1 outline-none cursor-pointer"
                title="Chọn phông chữ"
              >
                {FONT_FAMILIES.map((f) => (
                  <option key={f.value} value={f.value} className="bg-[#1c1c1e] text-white">
                    {f.label}
                  </option>
                ))}
              </select>

              {/* Bold Toggle */}
              <button
                type="button"
                onClick={() => setIsBold(!isBold)}
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
                onClick={() => setIsItalic(!isItalic)}
                className={cn(
                  "w-7 h-7 rounded-lg flex items-center justify-center transition-all cursor-pointer",
                  isItalic ? "bg-white/25 text-white" : "text-white/60 hover:text-white hover:bg-white/10"
                )}
                title="In nghiêng (Italic)"
              >
                <SFItalic size={13} />
              </button>

              {/* Font Size Selector */}
              <div className="flex items-center gap-1">
                {[16, 24, 32, 44].map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => setSelectedFontSize(size)}
                    className={cn(
                      "w-6 h-6 rounded-md flex items-center justify-center text-[10.5px] font-bold transition-all cursor-pointer",
                      selectedFontSize === size ? "bg-white/25 text-white shadow-xs" : "text-white/60 hover:text-white hover:bg-white/10"
                    )}
                    title={`Cỡ chữ: ${size}px`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Sticky Note Controls */
            <div className="flex items-center gap-1.5 pl-1 text-[11.5px] text-amber-200">
              <span>Thẻ ghi chú vàng nổi bật trên ảnh</span>
            </div>
          )}
        </div>
      </footer>
    </div>,
    document.body
  );
};
