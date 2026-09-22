import { getDb } from '../db/connection.js';

export function calculateAverageDailySales(productId: string, storeId: string, days: number = 30): number {
  const db = getDb();
  const query = `
    SELECT SUM(quantity) as total_qty
    FROM sales 
    WHERE product_id = ? AND store_id = ? AND sale_date >= date('now', '-' || ? || ' days')
  `;
  const result = db.prepare(query).get(productId, storeId, days) as any;
  return result?.total_qty ? result.total_qty / days : 0;
}

export function calculateDaysOfCover(currentStock: number, avgDailySales: number): number {
  if (avgDailySales <= 0) return 999;
  return currentStock / avgDailySales;
}

export function calculateSafetyStock(avgDailySales: number, safetyDays: number): number {
  return avgDailySales * safetyDays;
}

export function calculateReorderPoint(avgDailySales: number, leadTime: number, safetyStock: number): number {
  return (avgDailySales * leadTime) + safetyStock;
}

export function calculateRecommendedOrderQty(productId: string, storeId: string): any {
  const db = getDb();
  
  // Get supplier info (lead time, moq)
  const productInfo = db.prepare(`
    SELECT p.*, ps.moq, ps.order_multiple, s.lead_time_days
    FROM products p
    JOIN product_suppliers ps ON ps.product_id = p.id
    JOIN suppliers s ON s.id = ps.supplier_id
    WHERE p.id = ? LIMIT 1
  `).get(productId) as any;

  // Get current stock
  const stock = db.prepare('SELECT available_qty FROM inventory WHERE product_id = ? AND store_id = ?').get(productId, storeId) as any;
  const currentStock = stock ? stock.available_qty : 0;

  const avgSales = calculateAverageDailySales(productId, storeId, 30);
  const leadTime = productInfo?.lead_time_days || 3;
  const moq = productInfo?.moq || 1;
  const orderMultiple = productInfo?.order_multiple || 1;
  
  const settings = db.prepare('SELECT key, value FROM system_settings').all() as any[];
  const getSetting = (key: string, def: number) => {
    const s = settings.find(s => s.key === key);
    return s ? parseFloat(s.value) : def;
  };

  const safetyDays = getSetting('default_safety_days', 3);
  const reviewPeriod = getSetting('default_review_period', 7);

  const safetyStock = calculateSafetyStock(avgSales, safetyDays);
  const reorderPoint = calculateReorderPoint(avgSales, leadTime, safetyStock);

  let recommendedQty = 0;
  if (avgSales > 0 && currentStock <= reorderPoint) {
    const targetStock = avgSales * (leadTime + reviewPeriod + safetyDays);
    const rawNeed = targetStock - currentStock;
    if (rawNeed > 0) {
      const qty = Math.max(moq, rawNeed);
      recommendedQty = Math.ceil(qty / orderMultiple) * orderMultiple;
    }
  }

  return {
    recommendedQty,
    metrics: { avgSales, currentStock, leadTime, safetyStock, reorderPoint, moq, orderMultiple }
  };
}
