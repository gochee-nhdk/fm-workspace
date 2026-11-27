import type {
  Annotation,
  NoteAnnotation,
  PathAnnotation,
  Point,
  ShapeAnnotation,
  TextAnnotation,
} from './types';

export function hexToRgba(hex: string, alpha: number): string {
  const cleanHex = hex.replace('#', '');
  let r = 0;
  let g = 0;
  let b = 0;
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
}

export function drawArrowhead(
  ctx: CanvasRenderingContext2D,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  size: number
): void {
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
}

export function distToSegment(p: Point, v: Point, w: Point): number {
  const l2 = (w.x - v.x) ** 2 + (w.y - v.y) ** 2;
  if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (v.x + t * (w.x - v.x)), p.y - (v.y + t * (w.y - v.y)));
}

function measureTextBox(
  ctx: CanvasRenderingContext2D,
  t: TextAnnotation
): { textW: number; textH: number } {
  ctx.font = `${t.isItalic ? 'italic' : 'normal'} ${t.isBold ? '700' : '500'} ${t.fontSize}px ${
    t.fontFamily || 'sans-serif'
  }`;
  const lines = t.text.split('\n');
  let maxW = 0;
  lines.forEach((l) => {
    const w = ctx.measureText(l).width;
    if (w > maxW) maxW = w;
  });
  return {
    textW: Math.max(maxW, t.width || 100),
    textH: lines.length * (t.fontSize * 1.35),
  };
}

export function isHitResizeHandle(
  canvas: HTMLCanvasElement | null,
  pt: Point,
  t: TextAnnotation
): boolean {
  const ctx = canvas?.getContext('2d');
  if (!ctx) return false;
  const { textW, textH } = measureTextBox(ctx, t);
  const handleX = t.x + textW + 6;
  const handleY = t.y + textH + 6;
  return Math.hypot(pt.x - handleX, pt.y - handleY) <= 16;
}

export function isHitTextCloseBtn(
  canvas: HTMLCanvasElement | null,
  pt: Point,
  t: TextAnnotation
): boolean {
  const ctx = canvas?.getContext('2d');
  if (!ctx) return false;
  const { textW } = measureTextBox(ctx, t);
  const closeX = t.x + textW + 6;
  const closeY = t.y - 6;
  return Math.hypot(pt.x - closeX, pt.y - closeY) <= 16;
}

export function findAnnotationAt(
  canvas: HTMLCanvasElement | null,
  annotations: Annotation[],
  pt: Point
): Annotation | null {
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
      if (
        pt.x >= minX - threshold &&
        pt.x <= maxX + threshold &&
        pt.y >= minY - threshold &&
        pt.y <= maxY + threshold
      ) {
        return a;
      }
    } else if (a.type === 'arrow') {
      const shape = a as ShapeAnnotation;
      if (
        distToSegment(pt, { x: shape.startX, y: shape.startY }, { x: shape.endX, y: shape.endY }) <
        threshold + a.strokeWidth
      ) {
        return a;
      }
    } else if (a.type === 'text') {
      const t = a as TextAnnotation;
      const ctx = canvas?.getContext('2d');
      if (ctx) {
        const { textW, textH } = measureTextBox(ctx, t);
        if (
          pt.x >= t.x - 8 &&
          pt.x <= t.x + textW + 16 &&
          pt.y >= t.y - 8 &&
          pt.y <= t.y + textH + 16
        ) {
          return a;
        }
      }
    } else if (a.type === 'note') {
      const n = a as NoteAnnotation;
      if (Math.hypot(pt.x - n.anchorX, pt.y - n.anchorY) <= 20) {
        return a;
      }
    }
  }
  return null;
}

export function renderEditorCanvas(params: {
  canvas: HTMLCanvasElement;
  img: HTMLImageElement;
  naturalSize: { w: number; h: number };
  rotation: number;
  annotations: Annotation[];
  selectedAnnotationId: string | null;
  extraAnnotation?: Annotation | null;
}): void {
  const { canvas, img, naturalSize, rotation, annotations, selectedAnnotationId, extraAnnotation } =
    params;
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

  ctx.save();
  ctx.translate(targetW / 2, targetH / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.drawImage(img, -naturalSize.w / 2, -naturalSize.h / 2, naturalSize.w, naturalSize.h);
  ctx.restore();

  const allToDraw = extraAnnotation ? [...annotations, extraAnnotation] : annotations;

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
        ctx.ellipse(x + w / 2, y + h / 2, Math.max(1, w / 2), Math.max(1, h / 2), 0, 0, Math.PI * 2);
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
        ctx.rect(x, y, w, h);
      }
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
      const textItem = item as TextAnnotation;
      if (!textItem.text.trim()) continue;

      ctx.save();
      const fontSize = textItem.fontSize || 24;
      const weight = textItem.isBold ? '700' : '500';
      const style = textItem.isItalic ? 'italic' : 'normal';
      const family =
        textItem.fontFamily || '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.font = `${style} ${weight} ${fontSize}px ${family}`;

      const lines = textItem.text.split('\n');
      const lineHeight = fontSize * 1.35;
      const align = textItem.textAlign || 'left';
      ctx.textAlign = align;

      let maxLineW = 0;
      lines.forEach((l) => {
        const w = ctx.measureText(l).width;
        if (w > maxLineW) maxLineW = w;
      });
      const boxW = Math.max(maxLineW, textItem.width || 100);

      const getLineX = () => {
        if (align === 'center') return textItem.x + boxW / 2;
        if (align === 'right') return textItem.x + boxW;
        return textItem.x;
      };

      const eff = textItem.effects;
      if (eff?.blurEnabled && (eff.blurRadius || 0) > 0) {
        ctx.filter = `blur(${eff.blurRadius}px)`;
      } else {
        ctx.filter = 'none';
      }

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

      if (eff?.strokeEnabled && (eff.strokeWidth || 0) > 0) {
        ctx.strokeStyle = eff.strokeColor || '#000000';
        ctx.lineWidth = (eff.strokeWidth || 2) * 2;
        ctx.lineJoin = 'round';
        ctx.textBaseline = 'top';
        lines.forEach((line, index) => {
          ctx.strokeText(line, getLineX(), textItem.y + index * lineHeight);
        });
      }

      ctx.fillStyle = textItem.color;
      ctx.textBaseline = 'top';
      lines.forEach((line, index) => {
        ctx.fillText(line, getLineX(), textItem.y + index * lineHeight);
      });
      ctx.restore();
    } else if (item.type === 'note') {
      const noteItem = item as NoteAnnotation;
      ctx.save();
      ctx.fillStyle = '#F59E0B';
      ctx.beginPath();
      ctx.arc(noteItem.anchorX, noteItem.anchorY, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(noteItem.anchorX, noteItem.anchorY, 2, 0, Math.PI * 2);
      ctx.fill();

      if (selectedAnnotationId === noteItem.id) {
        const targetX = noteItem.side === 'left' ? 10 : targetW - 10;
        const targetY = Math.max(
          20,
          Math.min(targetH - 60, noteItem.anchorY + (noteItem.yOffset || 0))
        );
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

    if (selectedAnnotationId === item.id) {
      ctx.save();
      ctx.strokeStyle = '#0071e3';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);

      if (item.type === 'rect') {
        const s = item as ShapeAnnotation;
        ctx.strokeRect(
          Math.min(s.startX, s.endX) - 6,
          Math.min(s.startY, s.endY) - 6,
          Math.abs(s.endX - s.startX) + 12,
          Math.abs(s.endY - s.startY) + 12
        );
      } else if (item.type === 'text') {
        const t = item as TextAnnotation;
        const { textW, textH } = measureTextBox(ctx, t);
        ctx.strokeRect(t.x - 6, t.y - 6, textW + 12, textH + 12);

        ctx.setLineDash([]);
        ctx.fillStyle = '#0071e3';
        ctx.beginPath();
        ctx.arc(t.x + textW + 6, t.y + textH + 6, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        const closeX = t.x + textW + 6;
        const closeY = t.y - 6;
        ctx.fillStyle = '#EF4444';
        ctx.beginPath();
        ctx.arc(closeX, closeY, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.5;
        ctx.stroke();

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
}
