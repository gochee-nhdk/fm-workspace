import { FastifyInstance } from 'fastify';
import { getDb } from '../db/connection.js';
import { verifyToken } from '../middleware/auth.js';
import { auditLog } from '../middleware/audit.js';
import { calculateAverageDailySales, calculateDaysOfCover } from '../services/calculations.js';

export default async function inventoryRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', verifyToken);

  /**
   * 1. GET /: List inventory with product, store, ADS and calculated Days of Cover
   */
  fastify.get('/', async (request: any, reply) => {
    const { page = 1, limit = 20, store_id, search } = request.query;
    const offset = (Number(page) - 1) * Number(limit);
    const db = getDb();

    let whereClause = ' WHERE 1=1';
    const params: any[] = [];

    if (store_id) {
      whereClause += ' AND i.store_id = ?';
      params.push(store_id);
    }
    if (search) {
      whereClause += ' AND (p.name LIKE ? OR p.sku_code LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    const baseQuery = `
      FROM inventory i
      JOIN products p ON i.product_id = p.id
      JOIN stores s ON i.store_id = s.id
      LEFT JOIN categories c ON p.category_id = c.id
      ${whereClause}
    `;

    const count = (db.prepare(`SELECT COUNT(*) as total ${baseQuery}`).get(...params) as any)?.total || 0;

    const selectQuery = `
      SELECT i.*, p.sku_code, p.name as product_name, p.unit, s.name as store_name, c.name as category_name
      ${baseQuery}
      ORDER BY i.available_qty ASC
      LIMIT ? OFFSET ?
    `;

    const rawRows = db.prepare(selectQuery).all(...params, Number(limit), Number(offset)) as any[];

    // Calculate dynamic ADS and DoC for each row
    const enrichedRows = rawRows.map((row) => {
      const ads = calculateAverageDailySales(row.product_id, row.store_id, 30);
      const doc = calculateDaysOfCover(row.available_qty, ads);

      let status = 'healthy';
      if (row.available_qty <= 0) status = 'out_of_stock';
      else if (doc <= 3) status = 'critical';
      else if (doc <= 7) status = 'warning';
      else if (doc >= 35) status = 'overstock';

      return {
        ...row,
        ads: Number(ads.toFixed(2)),
        days_of_cover: doc >= 999 ? 'N/A' : Number(doc.toFixed(1)),
        status
      };
    });

    return {
      success: true,
      data: enrichedRows,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: count,
        total_pages: Math.ceil(count / Number(limit))
      }
    };
  });

  /**
   * 2. GET /days-of-cover: Calculated Days of Cover for top items
   */
  fastify.get('/days-of-cover', async (request: any, reply) => {
    const db = getDb();
    const rows = db.prepare(`
      SELECT i.product_id, i.store_id, p.sku_code, p.name as product_name, s.name as store_name, i.available_qty
      FROM inventory i
      JOIN products p ON i.product_id = p.id
      JOIN stores s ON i.store_id = s.id
      LIMIT 100
    `).all() as any[];

    const result = rows.map((r) => {
      const ads = calculateAverageDailySales(r.product_id, r.store_id, 30);
      const doc = calculateDaysOfCover(r.available_qty, ads);
      return {
        ...r,
        ads: Number(ads.toFixed(2)),
        days_of_cover: doc >= 999 ? 999 : Number(doc.toFixed(1))
      };
    });

    return { success: true, data: result };
  });

  /**
   * 3. GET /stockout-risk: Items with stockout or critical coverage
   */
  fastify.get('/stockout-risk', async (request: any, reply) => {
    const db = getDb();
    const rows = db.prepare(`
      SELECT i.*, p.sku_code, p.name as product_name, s.name as store_name, sup.name as supplier_name, ps.lead_time_days
      FROM inventory i
      JOIN products p ON i.product_id = p.id
      JOIN stores s ON i.store_id = s.id
      LEFT JOIN product_suppliers ps ON p.id = ps.product_id AND ps.is_primary = 1
      LEFT JOIN suppliers sup ON ps.supplier_id = sup.id
      WHERE i.available_qty <= 5
      ORDER BY i.available_qty ASC
      LIMIT 50
    `).all() as any[];

    const data = rows.map((r) => {
      const ads = calculateAverageDailySales(r.product_id, r.store_id, 30);
      const doc = calculateDaysOfCover(r.available_qty, ads);
      return {
        ...r,
        ads: Number(ads.toFixed(2)),
        days_of_cover: doc >= 999 ? 0 : Number(doc.toFixed(1)),
        risk_level: r.available_qty <= 0 ? 'critical' : 'warning'
      };
    });

    return { success: true, data };
  });

  /**
   * 4. GET /overstock: Items with excessive stock relative to sales
   */
  fastify.get('/overstock', async (request: any, reply) => {
    const db = getDb();
    const rows = db.prepare(`
      SELECT i.*, p.sku_code, p.name as product_name, s.name as store_name
      FROM inventory i
      JOIN products p ON i.product_id = p.id
      JOIN stores s ON i.store_id = s.id
      WHERE i.available_qty > 20
      LIMIT 100
    `).all() as any[];

    // Filter items where DoC > 30 days
    const overstocked = rows
      .map((r) => {
        const ads = calculateAverageDailySales(r.product_id, r.store_id, 30);
        const doc = calculateDaysOfCover(r.available_qty, ads);
        return {
          ...r,
          ads: Number(ads.toFixed(2)),
          days_of_cover: doc >= 999 ? 999 : Number(doc.toFixed(1))
        };
      })
      .filter((r) => r.days_of_cover > 30);

    return { success: true, data: overstocked.slice(0, 50) };
  });

  /**
   * 5. GET /near-expiry: Active lots approaching expiry
   */
  fastify.get('/near-expiry', async (request: any, reply) => {
    const db = getDb();
    const now = new Date();
    const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const data = db.prepare(`
      SELECT el.*, p.sku_code, p.name as product_name, s.name as store_name,
             CAST((julianday(el.expiry_date) - julianday('now')) AS INTEGER) as days_remaining
      FROM expiry_lots el
      JOIN products p ON el.product_id = p.id
      JOIN stores s ON el.store_id = s.id
      WHERE el.status = 'active' AND el.expiry_date <= ?
      ORDER BY el.expiry_date ASC
      LIMIT 100
    `).all(thirtyDaysLater);

    return { success: true, data };
  });

  /**
   * 6. PUT /:id: Adjust inventory balances
   */
  fastify.put('/:id', async (request: any, reply) => {
    const db = getDb();
    const { available_qty, reserved_qty, damaged_qty, reason } = request.body || {};
    const { id } = request.params;
    const now = new Date().toISOString();

    const existing = db.prepare('SELECT * FROM inventory WHERE id = ?').get(id) as any;
    if (!existing) {
      return reply.code(404).send({ success: false, message: 'Không tìm thấy dòng tồn kho.' });
    }

    const newAvail = available_qty !== undefined ? Number(available_qty) : existing.available_qty;
    const newRes = reserved_qty !== undefined ? Number(reserved_qty) : existing.reserved_qty;
    const newDam = damaged_qty !== undefined ? Number(damaged_qty) : existing.damaged_qty;
    const newTotal = newAvail + newRes + newDam;

    db.prepare(`
      UPDATE inventory
      SET quantity = ?, available_qty = ?, reserved_qty = ?, damaged_qty = ?, updated_at = ?
      WHERE id = ?
    `).run(newTotal, newAvail, newRes, newDam, now, id);

    auditLog(request, 'ADJUST_INVENTORY', 'inventory', id, existing, {
      available_qty: newAvail,
      reason: reason || 'Điều chỉnh thủ công'
    });

    return { success: true, message: 'Đã cập nhật số lượng tồn kho thành công.' };
  });
}
