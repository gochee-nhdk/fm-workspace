import { FastifyInstance } from 'fastify';
import { getDb } from '../db/connection.js';
import { verifyToken } from '../middleware/auth.js';
import { auditLog } from '../middleware/audit.js';
import { v4 as uuidv4 } from 'uuid';
import { calculateAverageDailySales, calculateDaysOfCover } from '../services/calculations.js';

export default async function transfersRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', verifyToken);

  /**
   * 1. GET /: List transfers with pagination
   */
  fastify.get('/', async (request: any, reply) => {
    const rawPage = Number(request.query?.page || 1);
    const rawLimit = Number(request.query?.limit || 20);
    const page = isNaN(rawPage) || rawPage < 1 ? 1 : Math.floor(rawPage);
    const limit = isNaN(rawLimit) || rawLimit < 1 ? 20 : Math.min(100, Math.floor(rawLimit));

    const db = getDb();
    const offset = (page - 1) * limit;

    const query = `
      SELECT t.*, sf.name as from_store, st.name as to_store,
             (SELECT COUNT(*) FROM transfer_items WHERE transfer_id = t.id) as item_count
      FROM stock_transfers t
      JOIN stores sf ON t.from_store_id = sf.id
      JOIN stores st ON t.to_store_id = st.id
    `;
    const count = (db.prepare('SELECT COUNT(*) as total FROM stock_transfers').get() as any).total;
    const data = db.prepare(`${query} ORDER BY t.created_at DESC LIMIT ? OFFSET ?`).all(limit, offset);

    return {
      success: true,
      data,
      pagination: {
        page,
        limit,
        total: count,
        total_pages: Math.ceil(count / limit)
      }
    };
  });

  /**
   * 2. POST /: Create transfer request
   */
  fastify.post('/', async (request: any, reply) => {
    const db = getDb();
    const id = uuidv4();
    const { from_store_id, to_store_id, notes, items } = request.body || {};
    const now = new Date().toISOString();
    const transferNumber = `TRF-${Date.now().toString().slice(-8)}`;

    if (!from_store_id || !to_store_id || !Array.isArray(items) || !items.length) {
      return reply.code(400).send({ success: false, message: 'Vui lòng cung cấp kho đi, kho đến và danh sách hàng.' });
    }

    if (from_store_id === to_store_id) {
      return reply.code(400).send({ success: false, message: 'Kho đi và kho đến không thể trùng nhau.' });
    }

    for (const item of items) {
      const qty = Number(item.quantity);
      if (isNaN(qty) || qty <= 0) {
        return reply.code(400).send({ success: false, message: 'Số lượng điều chuyển của mỗi sản phẩm phải lớn hơn 0.' });
      }
    }

    const tx = db.transaction(() => {
      db.prepare(`
        INSERT INTO stock_transfers (id, transfer_number, from_store_id, to_store_id, status, requested_by, notes, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'draft', ?, ?, ?, ?)
      `).run(id, transferNumber, from_store_id, to_store_id, request.user?.id || 'admin', notes || '', now, now);

      const insertItem = db.prepare(`
        INSERT INTO transfer_items (id, transfer_id, product_id, quantity, reason)
        VALUES (?, ?, ?, ?, ?)
      `);

      for (const item of items) {
        insertItem.run(uuidv4(), id, item.product_id, Number(item.quantity), item.reason || 'Cân đối tồn kho');
      }
    });

    tx();
    auditLog(request, 'CREATE_TRANSFER', 'stock_transfers', id, null, { transferNumber, totalItems: items.length });

    return { success: true, data: { id, transferNumber, message: 'Đã tạo yêu cầu điều chuyển.' } };
  });

  /**
   * 3. GET /:id: Get transfer detail & items
   */
  fastify.get('/:id', async (request: any, reply) => {
    const db = getDb();
    const transfer = db.prepare(`
      SELECT t.*, sf.name as from_store, st.name as to_store, u.full_name as requester_name
      FROM stock_transfers t
      JOIN stores sf ON t.from_store_id = sf.id
      JOIN stores st ON t.to_store_id = st.id
      LEFT JOIN users u ON t.requested_by = u.id
      WHERE t.id = ?
    `).get(request.params.id);

    if (!transfer) return reply.code(404).send({ success: false, message: 'Không tìm thấy yêu cầu điều chuyển.' });

    const items = db.prepare(`
      SELECT ti.*, p.name as product_name, p.sku_code, p.unit
      FROM transfer_items ti
      JOIN products p ON ti.product_id = p.id
      WHERE ti.transfer_id = ?
    `).all(request.params.id);

    return { success: true, data: { ...transfer, items } };
  });

  /**
   * 4. GET /suggestions: Intelligent cross-store stock balancing suggestions
   */
  fastify.get('/suggestions', async (request: any, reply) => {
    const db = getDb();

    // Query distinct products that exist in multiple stores
    const candidateProducts = db.prepare(`
      SELECT DISTINCT product_id
      FROM inventory
      GROUP BY product_id
      HAVING COUNT(store_id) >= 2
    `).all() as any[];

    const suggestions: any[] = [];

    for (const { product_id } of candidateProducts) {
      const storeInventories = db.prepare(`
        SELECT i.store_id, i.available_qty, s.name as store_name, p.name as product_name, p.sku_code
        FROM inventory i
        JOIN stores s ON i.store_id = s.id
        JOIN products p ON i.product_id = p.id
        WHERE i.product_id = ?
      `).all(product_id) as any[];

      // Calculate Days of Cover for each store
      const analyzedStores = storeInventories.map((inv) => {
        const ads = calculateAverageDailySales(product_id, inv.store_id, 30);
        const doc = calculateDaysOfCover(inv.available_qty, ads);
        return { ...inv, ads, doc };
      });

      // Find excess stores (doc > 20 and available_qty >= 10)
      const excess = analyzedStores.filter((s) => s.doc > 20 && s.available_qty >= 10);
      // Find shortage stores (doc < 5 or available_qty <= 2)
      const shortage = analyzedStores.filter((s) => s.doc < 5 || s.available_qty <= 2);

      for (const src of excess) {
        for (const dst of shortage) {
          const transferableQty = Math.min(
            Math.floor(src.available_qty / 2),
            Math.max(1, Math.ceil(dst.ads * 7)) // transfer enough for 7 days
          );

          if (transferableQty > 0) {
            suggestions.push({
              product_id,
              product_name: src.product_name,
              sku_code: src.sku_code,
              from_store_id: src.store_id,
              from_store_name: src.store_name,
              from_stock: src.available_qty,
              from_doc: Math.round(src.doc),
              to_store_id: dst.store_id,
              to_store_name: dst.store_name,
              to_stock: dst.available_qty,
              to_doc: Math.round(dst.doc),
              suggested_qty: transferableQty,
              reason: `Kho "${src.store_name}" tồn nhiều (${src.available_qty} cái ~ ${Math.round(src.doc)} ngày), trong khi "${dst.store_name}" sắp hết hàng (${dst.available_qty} cái ~ ${Math.round(dst.doc)} ngày).`,
              impact: 'Giảm nguy cơ đứt hàng và hạn chế lưu kho quá lâu.'
            });
          }
        }
      }
    }

    return { success: true, data: suggestions.slice(0, 20) };
  });

  /**
   * 5. PUT /:id/status: Transition status with automated inventory balance adjustments
   */
  fastify.put('/:id/status', async (request: any, reply) => {
    const { status } = request.body || {};
    const { id } = request.params;
    const db = getDb();
    const now = new Date().toISOString();

    const transfer = db.prepare('SELECT * FROM stock_transfers WHERE id = ?').get(id) as any;
    if (!transfer) return reply.code(404).send({ success: false, message: 'Không tìm thấy yêu cầu điều chuyển.' });

    // Validate state machine transitions
    const validTransitions: Record<string, string[]> = {
      draft: ['in_transit', 'cancelled'],
      in_transit: ['received', 'cancelled'],
      received: [], // Terminal state
      cancelled: [], // Terminal state
    };

    const allowedNext = validTransitions[transfer.status] || [];
    if (!allowedNext.includes(status)) {
      return reply.code(400).send({
        success: false,
        message: `Chuyển đổi trạng thái không hợp lệ từ "${transfer.status}" sang "${status}". Các trạng thái hợp lệ tiếp theo: [${allowedNext.join(', ')}]`
      });
    }

    const items = db.prepare('SELECT * FROM transfer_items WHERE transfer_id = ?').all(id) as any[];

    const statusTx = db.transaction(() => {
      // 1. If moving to 'in_transit', deduct stock from source store
      if (status === 'in_transit' && transfer.status === 'draft') {
        const deductStmt = db.prepare(`
          UPDATE inventory
          SET available_qty = MAX(0, available_qty - ?),
              quantity = MAX(0, quantity - ?),
              updated_at = ?
          WHERE store_id = ? AND product_id = ?
        `);
        for (const item of items) {
          deductStmt.run(item.quantity, item.quantity, now, transfer.from_store_id, item.product_id);
        }
      }

      // 2. If moving to 'received', add stock to destination store (must have been in_transit)
      if (status === 'received' && transfer.status === 'in_transit') {
        const addStmt = db.prepare(`
          INSERT INTO inventory (id, store_id, product_id, quantity, available_qty, updated_at)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(store_id, product_id) DO UPDATE SET
            quantity = quantity + excluded.quantity,
            available_qty = available_qty + excluded.available_qty,
            updated_at = excluded.updated_at
        `);
        for (const item of items) {
          addStmt.run(uuidv4(), transfer.to_store_id, item.product_id, item.quantity, item.quantity, now);
        }
      }

      // 3. If cancelling from in_transit, rollback deducted inventory back to source store
      if (status === 'cancelled' && transfer.status === 'in_transit') {
        const rollbackStmt = db.prepare(`
          INSERT INTO inventory (id, store_id, product_id, quantity, available_qty, updated_at)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(store_id, product_id) DO UPDATE SET
            quantity = quantity + excluded.quantity,
            available_qty = available_qty + excluded.available_qty,
            updated_at = excluded.updated_at
        `);
        for (const item of items) {
          rollbackStmt.run(uuidv4(), transfer.from_store_id, item.product_id, item.quantity, item.quantity, now);
        }
      }

      db.prepare('UPDATE stock_transfers SET status = ?, updated_at = ? WHERE id = ?').run(status, now, id);
    });

    statusTx();
    auditLog(request, 'UPDATE_TRANSFER_STATUS', 'stock_transfers', id, transfer, { status });

    return { success: true, message: `Đã cập nhật trạng thái điều chuyển sang ${status}.` };
  });
}
