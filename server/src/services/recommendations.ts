import { getDb } from '../db/connection.js';
import { calculateRecommendedOrderQty } from './calculations.js';
import { v4 as uuidv4 } from 'uuid';

export async function generateOrderRecommendations(storeId?: string): Promise<number> {
  const db = getDb();
  let count = 0;
  
  // Clean up previous pending recommendations to prevent duplication
  if (storeId) {
    db.prepare("DELETE FROM purchase_recommendations WHERE status = 'pending' AND store_id = ?").run(storeId);
  } else {
    db.prepare("DELETE FROM purchase_recommendations WHERE status = 'pending'").run();
  }

  const storeFilter = storeId ? `WHERE id = ?` : ``;
  const stores = db.prepare(`SELECT id FROM stores ${storeFilter}`).all(storeId ? [storeId] : []) as any[];

  for (const store of stores) {
    const products = db.prepare('SELECT id FROM products WHERE is_active = 1').all() as any[];
    
    for (const product of products) {
      const calc = calculateRecommendedOrderQty(product.id, store.id);
      
      if (calc.recommendedQty > 0) {
        db.prepare(`
          INSERT INTO purchase_recommendations 
          (id, store_id, product_id, recommended_qty, reason, confidence, risk_level, calculation_data, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          uuidv4(),
          store.id,
          product.id,
          calc.recommendedQty,
          `Tồn kho dưới điểm đặt hàng (${calc.metrics.currentStock} <= ${calc.metrics.reorderPoint})`,
          'high',
          'high',
          JSON.stringify(calc.metrics),
          new Date().toISOString()
        );
        count++;
      }
    }
  }

  return count;
}
