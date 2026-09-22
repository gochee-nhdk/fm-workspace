import { getDb } from '../db/connection.js';
import { v4 as uuidv4 } from 'uuid';

export async function generateAlerts() {
  const db = getDb();
  const now = new Date().toISOString();

  // Stockout Risk Check
  const recommendations = db.prepare("SELECT id, store_id, product_id FROM purchase_recommendations WHERE status = 'pending'").all() as any[];
  
  for (const rec of recommendations) {
    db.prepare(`
      INSERT INTO notifications (id, user_id, type, title, message, severity, entity_type, entity_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      uuidv4(),
      'system', // broadcast to relevant roles later
      'stockout_risk',
      'Stockout Risk Detected',
      `Product requires reordering at store.`,
      'warning',
      'product',
      rec.product_id,
      now
    );
  }

  // Near Expiry Check
  const nearExpiry = db.prepare(`
    SELECT id, product_id, expiry_date 
    FROM expiry_lots 
    WHERE status = 'active' AND expiry_date <= date('now', '+7 days')
  `).all() as any[];

  for (const lot of nearExpiry) {
    db.prepare(`
      INSERT INTO notifications (id, user_id, type, title, message, severity, entity_type, entity_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      uuidv4(),
      'system',
      'near_expiry',
      'Lot Nearing Expiry',
      `Lot expiring on ${lot.expiry_date}.`,
      'high',
      'expiry_lot',
      lot.id,
      now
    );
  }
}
