// ============================================
// Shared Types - AI Procurement & Merchandising Assistant
// ============================================

// ---- Enums & Constants ----

export type UserRole = 'admin' | 'manager' | 'staff' | 'merchandiser' | 'viewer';

export type POStatus = 'draft' | 'submitted' | 'approved' | 'ordered' | 'partial' | 'received' | 'cancelled';

export type TransferStatus = 'draft' | 'submitted' | 'approved' | 'in_transit' | 'received' | 'cancelled';

export type RecommendationStatus = 'pending' | 'approved' | 'modified' | 'rejected';

export type RiskLevel = 'critical' | 'low' | 'healthy' | 'overstock';

export type ExpiryRisk = 'expired' | 'critical' | 'warning' | 'monitor' | 'safe';

export type SKUVelocity = 'fast' | 'normal' | 'slow' | 'non_moving';

export type AlertSeverity = 'critical' | 'warning' | 'info';

export type ImportStatus = 'pending' | 'validating' | 'validated' | 'importing' | 'completed' | 'failed';

export type ExpiryLotStatus = 'active' | 'sold' | 'expired' | 'disposed';

export type Currency = 'VND' | 'USD';

// ---- Base Types ----

export interface PaginationParams {
  page?: number;
  limit?: number;
  search?: string;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// ---- User & Auth ----

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: User;
  access_token: string;
}

// ---- Master Data ----

export interface Region {
  id: string;
  name: string;
  code: string;
}

export interface Store {
  id: string;
  name: string;
  code: string;
  region_id: string;
  region_name?: string;
  address: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  parent_id: string | null;
  level: number;
  sort_order: number;
  children?: Category[];
}

export interface Brand {
  id: string;
  name: string;
}

export interface Product {
  id: string;
  sku_code: string;
  name: string;
  category_id: string;
  category_name?: string;
  brand_id: string;
  brand_name?: string;
  unit: string;
  barcode: string;
  shelf_life_days: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Supplier {
  id: string;
  name: string;
  code: string;
  contact_name: string;
  phone: string;
  email: string;
  address: string;
  lead_time_days: number;
  payment_terms: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Computed
  product_count?: number;
  total_purchase_value?: number;
  on_time_rate?: number;
  fill_rate?: number;
}

export interface ProductSupplier {
  id: string;
  product_id: string;
  supplier_id: string;
  cost_price: number;
  moq: number;
  order_multiple: number;
  is_primary: boolean;
  // Joined
  product_name?: string;
  supplier_name?: string;
}

// ---- Transactional ----

export interface Sale {
  id: string;
  store_id: string;
  product_id: string;
  sale_date: string;
  quantity: number;
  revenue: number;
  created_at: string;
  // Joined
  store_name?: string;
  product_name?: string;
  sku_code?: string;
}

export interface InventoryItem {
  id: string;
  store_id: string;
  product_id: string;
  quantity: number;
  available_qty: number;
  reserved_qty: number;
  damaged_qty: number;
  updated_at: string;
  // Joined
  store_name?: string;
  product_name?: string;
  sku_code?: string;
  category_name?: string;
  // Computed
  avg_daily_sales?: number;
  days_of_cover?: number;
  risk_level?: RiskLevel;
  sales_velocity?: SKUVelocity;
}

export interface ExpiryLot {
  id: string;
  store_id: string;
  product_id: string;
  lot_number: string;
  quantity: number;
  expiry_date: string;
  status: ExpiryLotStatus;
  created_at: string;
  // Joined
  store_name?: string;
  product_name?: string;
  sku_code?: string;
  // Computed
  days_to_expiry?: number;
  expiry_risk?: ExpiryRisk;
}

// ---- Procurement ----

export interface PurchaseOrder {
  id: string;
  po_number: string;
  supplier_id: string;
  store_id: string;
  status: POStatus;
  order_date: string;
  expected_date: string;
  received_date: string | null;
  total_value: number;
  notes: string;
  created_by: string;
  approved_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  supplier_name?: string;
  store_name?: string;
  created_by_name?: string;
  approved_by_name?: string;
  items?: POItem[];
  item_count?: number;
}

export interface POItem {
  id: string;
  po_id: string;
  product_id: string;
  ordered_qty: number;
  received_qty: number;
  unit_price: number;
  status: string;
  // Joined
  product_name?: string;
  sku_code?: string;
}

export interface PurchaseRecommendation {
  id: string;
  store_id: string;
  product_id: string;
  recommended_qty: number;
  reason: string;
  confidence: string;
  risk_level: string;
  calculation_data: CalculationBreakdown;
  status: RecommendationStatus;
  created_by: string;
  created_at: string;
  // Joined
  store_name?: string;
  product_name?: string;
  sku_code?: string;
  category_name?: string;
  supplier_name?: string;
}

export interface CalculationBreakdown {
  current_stock: number;
  avg_daily_sales: number;
  lead_time_days: number;
  safety_stock: number;
  safety_days: number;
  review_period: number;
  reorder_point: number;
  target_stock: number;
  incoming_stock: number;
  recommended_qty: number;
  moq: number;
  order_multiple: number;
  final_qty: number;
  days_of_cover_current: number;
  days_of_cover_after: number;
}

// ---- Stock Transfer ----

export interface StockTransfer {
  id: string;
  transfer_number: string;
  from_store_id: string;
  to_store_id: string;
  status: TransferStatus;
  requested_by: string;
  approved_by: string | null;
  notes: string;
  created_at: string;
  updated_at: string;
  // Joined
  from_store_name?: string;
  to_store_name?: string;
  requested_by_name?: string;
  approved_by_name?: string;
  items?: TransferItem[];
  item_count?: number;
}

export interface TransferItem {
  id: string;
  transfer_id: string;
  product_id: string;
  quantity: number;
  reason: string;
  // Joined
  product_name?: string;
  sku_code?: string;
}

export interface TransferSuggestion {
  product_id: string;
  product_name: string;
  sku_code: string;
  from_store_id: string;
  from_store_name: string;
  to_store_id: string;
  to_store_name: string;
  suggested_qty: number;
  reason: string;
  from_doc: number;
  to_doc: number;
  from_stock: number;
  to_stock: number;
  expected_impact: string;
}

// ---- Analytics ----

export interface DashboardSummary {
  total_sku: number;
  active_sku: number;
  total_stores: number;
  inventory_value: number;
  sales_today: number;
  sales_7d: number;
  units_sold_today: number;
  stockout_risk_count: number;
  overstock_count: number;
  near_expiry_count: number;
  open_po_count: number;
  purchase_value_30d: number;
}

export interface SalesTrend {
  date: string;
  revenue: number;
  units: number;
}

export interface TopProduct {
  product_id: string;
  product_name: string;
  sku_code: string;
  total_revenue: number;
  total_units: number;
  avg_daily_sales: number;
}

export interface StorePerformance {
  store_id: string;
  store_name: string;
  total_revenue: number;
  total_units: number;
  sku_count: number;
  stockout_count: number;
  overstock_count: number;
  near_expiry_count: number;
}

export interface SKUPerformanceData {
  product_id: string;
  sku_code: string;
  product_name: string;
  category_name: string;
  total_revenue: number;
  total_units: number;
  avg_daily_sales: number;
  current_stock: number;
  days_of_cover: number;
  velocity: SKUVelocity;
  sell_through_rate: number;
  inventory_turnover: number;
}

export interface SupplierPerformance {
  supplier_id: string;
  supplier_name: string;
  total_orders: number;
  total_value: number;
  on_time_count: number;
  late_count: number;
  on_time_rate: number;
  avg_lead_time: number;
  fill_rate: number;
  product_count: number;
}

// ---- AI ----

export interface AIConversation {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  last_message?: string;
}

export interface AIMessage {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  data_context?: Record<string, unknown>;
  created_at: string;
}

export interface AISuggestion {
  id: string;
  text: string;
  category: string;
  icon: string;
}

// ---- System ----

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  severity: AlertSeverity;
  is_read: boolean;
  entity_type: string;
  entity_id: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  user_id: string;
  user_name: string;
  action: string;
  entity_type: string;
  entity_id: string;
  before_data: Record<string, unknown> | null;
  after_data: Record<string, unknown> | null;
  reason: string;
  ip_address: string;
  created_at: string;
}

export interface DataImport {
  id: string;
  user_id: string;
  file_name: string;
  entity_type: string;
  total_rows: number;
  success_rows: number;
  error_rows: number;
  status: ImportStatus;
  errors: ImportError[] | null;
  created_at: string;
}

export interface ImportError {
  row: number;
  column: string;
  value: string;
  error: string;
}

export interface SystemSetting {
  id: string;
  key: string;
  value: string;
  category: string;
  description: string;
  updated_by: string;
  updated_at: string;
}

export interface StoreProductSetting {
  id: string;
  store_id: string;
  product_id: string;
  safety_stock: number;
  reorder_point: number;
  target_days_of_cover: number;
  min_order_qty: number;
  max_stock: number;
}

// ---- Reports ----

export type ReportType = 
  | 'daily_procurement'
  | 'purchase_recommendation'
  | 'inventory'
  | 'near_expiry'
  | 'stock_transfer'
  | 'supplier_performance'
  | 'store_performance';

export interface ReportRequest {
  type: ReportType;
  date_from: string;
  date_to: string;
  store_id?: string;
  category_id?: string;
  supplier_id?: string;
}

export interface ReportResult {
  type: ReportType;
  title: string;
  generated_at: string;
  filters: Record<string, string>;
  data: Record<string, unknown>[];
  summary: Record<string, unknown>;
}

// ---- Search ----

export interface SearchResult {
  type: 'product' | 'store' | 'supplier' | 'purchase_order';
  id: string;
  title: string;
  subtitle: string;
  url: string;
}
