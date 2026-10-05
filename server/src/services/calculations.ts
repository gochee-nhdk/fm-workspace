import { getDb } from '../db/connection.js';

export function calculateAverageDailySales(productId: string, storeId: string, days: number = 30): number {
  if (days <= 0) return 0;
  const db = getDb();
  const query = `
    SELECT SUM(quantity) as total_qty
    FROM sales 
    WHERE product_id = ? AND store_id = ? AND sale_date >= date('now', '-' || ? || ' days')
  `;
  const result = db.prepare(query).get(productId, storeId, days) as any;
  const total = Number(result?.total_qty || 0);
  return total > 0 ? total / days : 0;
}

export function calculateDaysOfCover(currentStock: number, avgDailySales: number): number {
  if (avgDailySales <= 0) return 999;
  if (currentStock <= 0) return 0;
  return currentStock / avgDailySales;
}

export function calculateSafetyStock(avgDailySales: number, safetyDays: number): number {
  if (avgDailySales <= 0 || safetyDays <= 0) return 0;
  return avgDailySales * safetyDays;
}

export function calculateReorderPoint(avgDailySales: number, leadTime: number, safetyStock: number): number {
  const safeAvg = Math.max(0, avgDailySales || 0);
  const safeLead = Math.max(0, leadTime || 0);
  const safeStock = Math.max(0, safetyStock || 0);
  return (safeAvg * safeLead) + safeStock;
}

export function calculateRecommendedOrderQty(productId: string, storeId: string): any {
  const db = getDb();
  
  // Get supplier info (lead time, moq)
  const productInfo = db.prepare(`
    SELECT p.*, ps.moq, ps.order_multiple, s.lead_time_days
    FROM products p
    LEFT JOIN product_suppliers ps ON ps.product_id = p.id AND ps.is_primary = 1
    LEFT JOIN suppliers s ON s.id = ps.supplier_id
    WHERE p.id = ? LIMIT 1
  `).get(productId) as any;

  // Get current stock
  const stock = db.prepare('SELECT available_qty FROM inventory WHERE product_id = ? AND store_id = ?').get(productId, storeId) as any;
  const currentStock = Math.max(0, Number(stock?.available_qty || 0));

  const avgSales = calculateAverageDailySales(productId, storeId, 30);
  const rawLeadTime = productInfo?.lead_time_days;
  const leadTime = (rawLeadTime !== undefined && rawLeadTime !== null && !isNaN(Number(rawLeadTime)))
    ? Math.max(0, Number(rawLeadTime))
    : 3;
  const moq = Math.max(1, Number(productInfo?.moq) || 1);
  const orderMultiple = Math.max(1, Number(productInfo?.order_multiple) || 1);
  
  const settings = db.prepare('SELECT key, value FROM system_settings').all() as any[];
  const getSetting = (key: string, def: number) => {
    const s = settings.find(s => s.key === key);
    const parsed = s ? parseFloat(s.value) : def;
    return isNaN(parsed) || parsed < 0 ? def : parsed;
  };

  const safetyDays = getSetting('default_safety_days', 3);
  const reviewPeriod = getSetting('default_review_period', 7);

  const safetyStock = calculateSafetyStock(avgSales, safetyDays);
  const reorderPoint = calculateReorderPoint(avgSales, leadTime, safetyStock);

  // Retrieve incoming on-order stock from open purchase orders
  let incomingStock = 0;
  try {
    const onOrderRow = db.prepare(`
      SELECT COALESCE(SUM(poi.ordered_qty - COALESCE(poi.received_qty, 0)), 0) as incoming
      FROM po_items poi
      JOIN purchase_orders po ON po.id = poi.po_id
      WHERE poi.product_id = ? AND po.store_id = ? AND po.status IN ('submitted', 'approved', 'ordered', 'partial_received')
    `).get(productId, storeId) as any;
    incomingStock = Math.max(0, Number(onOrderRow?.incoming) || 0);
  } catch (_) {
    incomingStock = 0;
  }

  let recommendedQty = 0;
  const inventoryPosition = currentStock + incomingStock;
  if (avgSales > 0 && inventoryPosition <= reorderPoint) {
    const targetStock = avgSales * (leadTime + reviewPeriod + safetyDays);
    const rawNeed = targetStock - inventoryPosition;
    if (rawNeed > 0) {
      const qty = Math.max(moq, rawNeed);
      recommendedQty = Math.ceil(qty / orderMultiple) * orderMultiple;
    }
  }

  return {
    recommendedQty,
    metrics: { avgSales, currentStock, incomingStock, inventoryPosition, leadTime, safetyStock, reorderPoint, moq, orderMultiple }
  };
}
