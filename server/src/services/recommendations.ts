import { getDb } from '../db/connection.js';
import { calculateRecommendedOrderQty } from './calculations.js';
import { v4 as uuidv4 } from 'uuid';

export async function generateOrderRecommendations(storeId?: string): Promise<number> {
  const db = getDb();
  let count = 0;
  
  // Preload system settings once to eliminate N*M redundant queries
  const settings = (await db.prepare('SELECT key, value FROM system_settings').all()) as any[];

  const stores = storeId 
    ? ((await db.prepare('SELECT id FROM stores WHERE id = ?').all(storeId)) as any[])
    : ((await db.prepare('SELECT id FROM stores WHERE is_active = 1').all()) as any[]);

  const products = (await db.prepare('SELECT id FROM products WHERE is_active = 1').all()) as any[];

  // Calculate all recommendations first
  const newRecommendations: Array<{
    id: string;
    storeId: string;
    productId: string;
    recommendedQty: number;
    reason: string;
    confidence: string;
    riskLevel: string;
    calculationData: string;
    createdAt: string;
  }> = [];

  const now = new Date().toISOString();

  for (const store of stores) {
    for (const product of products) {
      const calc = await calculateRecommendedOrderQty(product.id, store.id, settings);
      
      if (calc.recommendedQty > 0) {
        newRecommendations.push({
          id: uuidv4(),
          storeId: store.id,
          productId: product.id,
          recommendedQty: calc.recommendedQty,
          reason: `Tồn kho dưới điểm đặt hàng (${calc.metrics.currentStock} <= ${calc.metrics.reorderPoint})`,
          confidence: 'high',
          riskLevel: 'high',
          calculationData: JSON.stringify(calc.metrics),
          createdAt: now,
        });
      }
    }
  }

  // ACID transaction: delete old pending recommendations and write new ones atomically
  await db.transaction(async (tx) => {
    if (storeId) {
      await tx.prepare("DELETE FROM purchase_recommendations WHERE status = 'pending' AND store_id = ?").run(storeId);
    } else {
      await tx.prepare("DELETE FROM purchase_recommendations WHERE status = 'pending'").run();
    }

    const insertStmt = tx.prepare(`
      INSERT INTO purchase_recommendations 
      (id, store_id, product_id, recommended_qty, reason, confidence, risk_level, calculation_data, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const rec of newRecommendations) {
      await insertStmt.run(
        rec.id,
        rec.storeId,
        rec.productId,
        rec.recommendedQty,
        rec.reason,
        rec.confidence,
        rec.riskLevel,
        rec.calculationData,
        rec.createdAt
      );
    }
  });

  count = newRecommendations.length;
  return count;
}
