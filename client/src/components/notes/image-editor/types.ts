export type AnnotationTool =
  | 'select'
  | 'pen'
  | 'highlighter'
  | 'rect'
  | 'arrow'
  | 'text'
  | 'note'
  | 'eraser'
  | 'crop';

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
  width?: number;
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
  anchorX: number;
  anchorY: number;
  side: 'left' | 'right';
  yOffset: number;
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

export const PRESET_COLORS = [
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

export const FONT_FAMILIES = [
  { label: 'San Francisco (Hệ thống)', value: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
  { label: 'New York (Serif)', value: 'Georgia, Cambria, "Times New Roman", serif' },
  { label: 'SF Mono (Mã lệnh)', value: '"SF Mono", Menlo, Monaco, Consolas, monospace' },
  { label: 'Caveat (Viết tay)', value: 'cursive, "Brush Script MT", sans-serif' },
  { label: 'Be Vietnam Pro', value: '"Be Vietnam Pro", sans-serif' },
  { label: 'Roboto', value: 'Roboto, sans-serif' },
  { label: 'Dancing Script', value: '"Dancing Script", cursive, sans-serif' },
];
