// ============================================================
// PO Tracker — TypeScript Types
// ============================================================

export type POStatus =
  | 'pending'           // Chờ xác nhận
  | 'confirmed'         // Đã xác nhận
  | 'shipping'          // Đang giao hàng
  | 'partial_received'  // Nhận một phần
  | 'received'          // Đã nhận đủ
  | 'cancelled'         // Đã hủy
  | 'overdue';          // Quá hạn giao

export type POFilterStatus = POStatus | 'upcoming_7_days';

export type POPermission = 'view' | 'comment' | 'edit' | 'admin';

export type FolderColor = 'blue' | 'amber' | 'emerald' | 'rose' | 'purple' | 'gray' | 'orange' | 'cyan';

export interface POFolderItem {
  id: string;
  name: string;
  description?: string | null;
  color: FolderColor;
  icon: string;
  sort_order: number;
  po_count?: number;
  creator_name?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface POLineItem {
  id?: string;
  po_id?: string;
  item_code?: string | null;
  barcode?: string;
  item_name: string;
  unit?: string | null;
  ordered_qty: number;
  received_qty?: number;
  unit_price: number;
  discountPct?: number;
  vatPct?: number; // mặc định 8%
  linePreVatTotal?: number;
  lineVatAmount?: number;
  lineGrossTotal?: number;
  total_price?: number;
  warehouse?: string | null;
  notes?: string | null;
  status?: 'pending' | 'partial' | 'received';
}

export interface POTrackerItemLine {
  id: string;
  po_id: string;
  item_code?: string | null;
  barcode?: string | null;
  item_name: string;
  unit: string;
  ordered_qty: number;
  received_qty: number;
  unit_price: number;
  discountPct?: number;
  vatPct?: number;
  linePreVatTotal?: number;
  lineVatAmount?: number;
  lineGrossTotal?: number;
  total_price: number;
  warehouse?: string | null;
  notes?: string | null;
  status: 'pending' | 'partial' | 'received';
}

export interface POPermissionRecord {
  id: string;
  user_id: string;
  user_name: string;
  email: string;
  resource_type: 'folder' | 'po' | 'global';
  resource_id: string | null;
  permission: POPermission;
  granted_by: string;
  granted_by_name?: string;
  created_at: string;
}

export interface POTrackerPO {
  id: string;
  folder_id?: string | null;
  folder_name?: string | null;
  folder_color?: FolderColor | null;
  po_number?: string | null;
  po_date?: string | null;
  expected_delivery_date?: string | null;
  actual_delivery_date?: string | null;
  supplier_code?: string | null;
  supplier_name?: string | null;
  vendor_code?: string | null;
  vendor_name?: string | null;
  warehouse?: string | null;
  status: POStatus;
  subTotalPreVat?: number;
  orderDiscountAmount?: number;
  totalVat?: number;
  grandTotal?: number;
  total_value: number;
  currency: string;
  notes?: string | null;
  tags?: string[];
  pdf_file_name?: string | null;
  extracted_data?: string | null;
  items?: POTrackerItemLine[];
  item_count?: number;
  total_ordered_qty?: number;
  total_received_qty?: number;
  days_overdue?: number;
  user_permission?: POPermission;
  permissions?: POPermissionRecord[];
  creator_name?: string | null;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface PurchaseOrder {
  id?: string;
  folder_id?: string | null;
  folder_name?: string | null;
  folder_color?: FolderColor | null;
  po_number?: string | null;
  po_date?: string | null;
  expected_delivery_date?: string | null;
  actual_delivery_date?: string | null;
  supplier_code?: string | null;
  supplier_name?: string | null;
  vendor_code?: string | null;
  vendor_name?: string | null;
  warehouse?: string | null;
  status?: POStatus;
  subTotalPreVat?: number;
  orderDiscountAmount?: number;
  totalVat?: number;
  grandTotal?: number;
  total_value?: number;
  currency?: string;
  notes?: string | null;
  tags?: string[];
  pdf_file_name?: string | null;
  extracted_data?: string | null;
  items?: POLineItem[];
  item_count?: number;
  total_ordered_qty?: number;
  total_received_qty?: number;
  days_overdue?: number;
  user_permission?: POPermission;
  permissions?: POPermissionRecord[];
  creator_name?: string | null;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

export interface POExtractedData {
  po_number?: string | null;
  po_date?: string | null;
  expected_delivery_date?: string | null;
  supplier_code?: string | null;
  supplier_name?: string | null;
  vendor_code?: string | null;
  vendor_name?: string | null;
  warehouse?: string | null;
  subTotalPreVat?: number | null;
  orderDiscountAmount?: number | null;
  totalVat?: number | null;
  grandTotal?: number | null;
  total_value?: number | null;
  currency?: string | null;
  notes?: string | null;
  pdf_file_name?: string | null;
  isPurchaseReturn?: boolean;
  documentType?: 'PO' | 'PURCHASE_RETURN';
  warningMessage?: string | null;
  items: Array<{
    item_code?: string | null;
    barcode?: string | null;
    item_name: string;
    unit?: string | null;
    ordered_qty?: number | null;
    unit_price?: number | null;
    discountPct?: number | null;
    vatPct?: number | null;
    linePreVatTotal?: number | null;
    lineVatAmount?: number | null;
    lineGrossTotal?: number | null;
    total_price?: number | null;
    warehouse?: string | null;
  }>;
}

export interface POTrackerStats {
  total: number;
  pending: number;
  confirmed: number;
  shipping: number;
  partial_received: number;
  received: number;
  cancelled: number;
  overdue: number;
  actually_overdue: number;
  upcoming_7_days: number;
  total_value: number;
}

export const PO_STATUS_CONFIG: Record<POStatus, {
  label: string;
  color: string;
  bg: string;
  border: string;
  darkBg: string;
  darkBorder: string;
  icon: string;
  step: number;
}> = {
  pending: {
    label: 'Chờ xác nhận',
    color: 'text-amber-700 dark:text-amber-400',
    bg: 'bg-amber-50 dark:bg-amber-500/10',
    border: 'border-amber-200/60',
    darkBg: 'dark:bg-amber-500/10',
    darkBorder: 'dark:border-amber-500/20',
    icon: '⏳',
    step: 0,
  },
  confirmed: {
    label: 'Đã xác nhận',
    color: 'text-blue-700 dark:text-blue-400',
    bg: 'bg-blue-50 dark:bg-blue-500/10',
    border: 'border-blue-200/60',
    darkBg: 'dark:bg-blue-500/10',
    darkBorder: 'dark:border-blue-500/20',
    icon: '✅',
    step: 1,
  },
  shipping: {
    label: 'Đang giao hàng',
    color: 'text-indigo-700 dark:text-indigo-400',
    bg: 'bg-indigo-50 dark:bg-indigo-500/10',
    border: 'border-indigo-200/60',
    darkBg: 'dark:bg-indigo-500/10',
    darkBorder: 'dark:border-indigo-500/20',
    icon: '🚚',
    step: 2,
  },
  partial_received: {
    label: 'Nhận một phần',
    color: 'text-purple-700 dark:text-purple-400',
    bg: 'bg-purple-50 dark:bg-purple-500/10',
    border: 'border-purple-200/60',
    darkBg: 'dark:bg-purple-500/10',
    darkBorder: 'dark:border-purple-500/20',
    icon: '📦',
    step: 3,
  },
  received: {
    label: 'Đã nhận đủ',
    color: 'text-emerald-700 dark:text-emerald-400',
    bg: 'bg-emerald-50 dark:bg-emerald-500/10',
    border: 'border-emerald-200/60',
    darkBg: 'dark:bg-emerald-500/10',
    darkBorder: 'dark:border-emerald-500/20',
    icon: '✅',
    step: 4,
  },
  cancelled: {
    label: 'Đã hủy',
    color: 'text-zinc-500 dark:text-zinc-400',
    bg: 'bg-zinc-50 dark:bg-zinc-500/10',
    border: 'border-zinc-200/60',
    darkBg: 'dark:bg-zinc-500/10',
    darkBorder: 'dark:border-zinc-500/20',
    icon: '✕',
    step: -1,
  },
  overdue: {
    label: 'Quá hạn',
    color: 'text-red-700 dark:text-red-400',
    bg: 'bg-red-50 dark:bg-red-500/10',
    border: 'border-red-200/60',
    darkBg: 'dark:bg-red-500/10',
    darkBorder: 'dark:border-red-500/20',
    icon: '⚠️',
    step: -1,
  },
};

export const FOLDER_COLOR_CONFIG: Record<FolderColor, { bg: string; text: string; ring: string; dot: string }> = {
  blue:    { bg: 'bg-blue-100 dark:bg-blue-900/30',    text: 'text-blue-700 dark:text-blue-400',    ring: 'ring-blue-500/40',    dot: 'bg-blue-500' },
  amber:   { bg: 'bg-amber-100 dark:bg-amber-900/30',  text: 'text-amber-700 dark:text-amber-400',  ring: 'ring-amber-500/40',  dot: 'bg-amber-500' },
  emerald: { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400', ring: 'ring-emerald-500/40', dot: 'bg-emerald-500' },
  rose:    { bg: 'bg-rose-100 dark:bg-rose-900/30',    text: 'text-rose-700 dark:text-rose-400',    ring: 'ring-rose-500/40',    dot: 'bg-rose-500' },
  purple:  { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-400', ring: 'ring-purple-500/40', dot: 'bg-purple-500' },
  gray:    { bg: 'bg-zinc-100 dark:bg-zinc-800/50',    text: 'text-zinc-700 dark:text-zinc-400',    ring: 'ring-zinc-500/40',    dot: 'bg-zinc-400' },
  orange:  { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-400', ring: 'ring-orange-500/40', dot: 'bg-orange-500' },
  cyan:    { bg: 'bg-cyan-100 dark:bg-cyan-900/30',    text: 'text-cyan-700 dark:text-cyan-400',    ring: 'ring-cyan-500/40',    dot: 'bg-cyan-500' },
};
