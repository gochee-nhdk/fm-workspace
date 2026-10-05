import { FastifyInstance } from 'fastify';
import { getDb } from '../db/connection.js';
import { verifyToken } from '../middleware/auth.js';
import { v4 as uuidv4 } from 'uuid';
import { generateOrderRecommendations } from '../services/recommendations.js';
import { auditLog } from '../middleware/audit.js';

export default async function procurementRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', verifyToken);

  /**
   * 1. GET /recommendations: List purchase recommendations with product details
   */
  fastify.get('/recommendations', async (request: any, reply) => {
    const db = getDb();
    const { store_id, status } = request.query as { store_id?: string; status?: string };

    let query = `
      SELECT pr.*, p.name as product_name, p.sku_code, s.name as store_name,
             COALESCE(i.available_qty, 0) as current_stock,
             ps.cost_price, ps.moq, sup.name as supplier_name
      FROM purchase_recommendations pr
      JOIN products p ON pr.product_id = p.id
      JOIN stores s ON pr.store_id = s.id
      LEFT JOIN inventory i ON pr.store_id = i.store_id AND pr.product_id = i.product_id
      LEFT JOIN product_suppliers ps ON pr.product_id = ps.product_id AND ps.is_primary = 1
      LEFT JOIN suppliers sup ON ps.supplier_id = sup.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (store_id) {
      query += ' AND pr.store_id = ?';
      params.push(store_id);
    }
    if (status) {
      query += ' AND pr.status = ?';
      params.push(status);
    }

    query += ' ORDER BY pr.created_at DESC';

    const records = db.prepare(query).all(...params);
    return { success: true, data: records };
  });

  /**
   * 2. POST /recommendations/generate: Run deterministic calculation engine
   */
  fastify.post('/recommendations/generate', async (request: any, reply) => {
    const { store_id } = request.body || {};
    const count = await generateOrderRecommendations(store_id);
    return { success: true, message: `Đã tạo ${count} gợi ý đặt hàng dựa trên tính toán tồn kho và tốc độ bán.` };
  });

  /**
   * 3. PUT /recommendations/:id: Update recommendation status
   */
  fastify.put('/recommendations/:id', async (request: any, reply) => {
    const db = getDb();
    const { status, notes } = request.body || {};
    const { id } = request.params;

    const existing = db.prepare('SELECT * FROM purchase_recommendations WHERE id = ?').get(id);
    if (!existing) {
      return reply.code(404).send({ success: false, message: 'Không tìm thấy gợi ý.' });
    }

    db.prepare('UPDATE purchase_recommendations SET status = ? WHERE id = ?').run(status, id);

    auditLog(request, 'UPDATE_RECOMMENDATION', 'purchase_recommendations', id, existing, { status, notes });
    return { success: true, message: 'Đã cập nhật trạng thái gợi ý.' };
  });

  /**
   * 4. GET /purchase-orders: List purchase orders
   */
  fastify.get('/purchase-orders', async (request: any, reply) => {
    const db = getDb();
    const pos = db.prepare(`
      SELECT po.*, s.name as supplier_name, st.name as store_name,
             (SELECT COUNT(*) FROM po_items WHERE po_id = po.id) as item_count
      FROM purchase_orders po
      LEFT JOIN suppliers s ON po.supplier_id = s.id
      LEFT JOIN stores st ON po.store_id = st.id
      ORDER BY po.created_at DESC
    `).all();
    return { success: true, data: pos };
  });

  /**
   * 5. GET /purchase-orders/:id: Get PO details and items
   */
  fastify.get('/purchase-orders/:id', async (request: any, reply) => {
    const db = getDb();
    const { id } = request.params;

    const po = db.prepare(`
      SELECT po.*, s.name as supplier_name, st.name as store_name, u.full_name as creator_name
      FROM purchase_orders po
      LEFT JOIN suppliers s ON po.supplier_id = s.id
      LEFT JOIN stores st ON po.store_id = st.id
      LEFT JOIN users u ON po.created_by = u.id
      WHERE po.id = ?
    `).get(id);

    if (!po) {
      return reply.code(404).send({ success: false, message: 'Không tìm thấy đơn đặt hàng.' });
    }

    const items = db.prepare(`
      SELECT poi.*, p.sku_code, p.name as product_name, p.unit
      FROM po_items poi
      JOIN products p ON poi.product_id = p.id
      WHERE poi.po_id = ?
    `).all(id);

    return { success: true, data: { ...po, items } };
  });

  /**
   * 6. POST /purchase-orders: Create PO with items
   */
  fastify.post('/purchase-orders', async (request: any, reply) => {
    const db = getDb();
    const { supplier_id, store_id, notes, items } = request.body || {};

    if (!supplier_id || !store_id || !items || !items.length) {
      return reply.code(400).send({ success: false, message: 'Vui lòng cung cấp nhà cung cấp, cửa hàng và danh sách sản phẩm.' });
    }

    const poId = uuidv4();
    const now = new Date().toISOString();
    const poNumber = `PO-${Date.now().toString().slice(-8)}`;

    const createTransaction = db.transaction(() => {
      let totalValue = 0;
      for (const item of items) {
        const qty = Number(item.ordered_qty || 0);
        const price = Number(item.unit_price || 0);
        totalValue += qty * price;
      }

      // 1. Insert parent purchase_orders first to satisfy foreign key constraint
      db.prepare(`
        INSERT INTO purchase_orders (id, po_number, supplier_id, store_id, status, total_value, notes, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?)
      `).run(poId, poNumber, supplier_id, store_id, totalValue, notes || '', request.user?.id || 'admin', now, now);

      // 2. Insert child po_items
      const insertItem = db.prepare(`
        INSERT INTO po_items (id, po_id, product_id, ordered_qty, unit_price, status)
        VALUES (?, ?, ?, ?, ?, 'pending')
      `);

      for (const item of items) {
        const qty = Number(item.ordered_qty || 0);
        const price = Number(item.unit_price || 0);
        insertItem.run(uuidv4(), poId, item.product_id, qty, price);
      }
    });

    createTransaction();
    auditLog(request, 'CREATE_PO', 'purchase_orders', poId, null, { poNumber, totalItems: items.length });

    return { success: true, data: { id: poId, poNumber, message: 'Đã tạo đơn đặt hàng thành công.' } };
  });

  /**
   * 7. PUT /purchase-orders/:id/status: Change PO status
   */
  fastify.put('/purchase-orders/:id/status', async (request: any, reply) => {
    const db = getDb();
    const { status } = request.body || {};
    const { id } = request.params;
    const now = new Date().toISOString();

    const validStatuses = ['draft', 'submitted', 'approved', 'ordered', 'partial_received', 'received', 'cancelled'];
    if (!status || !validStatuses.includes(status)) {
      return reply.code(400).send({
        success: false,
        message: `Trạng thái PO không hợp lệ. Các trạng thái cho phép: ${validStatuses.join(', ')}`
      });
    }

    const existing = db.prepare('SELECT * FROM purchase_orders WHERE id = ?').get(id) as any;
    if (!existing) {
      return reply.code(404).send({ success: false, message: 'Không tìm thấy đơn hàng.' });
    }

    db.prepare('UPDATE purchase_orders SET status = ?, updated_at = ? WHERE id = ?').run(status, now, id);
    auditLog(request, 'UPDATE_PO_STATUS', 'purchase_orders', id, existing, { status });

    return { success: true, message: `Đã cập nhật trạng thái PO sang ${status}.` };
  });

  /**
   * 8. POST /purchase-orders/:id/receive: Goods Receipt -> update inventory & expiry lots
   */
  fastify.post('/purchase-orders/:id/receive', async (request: any, reply) => {
    const db = getDb();
    const { id } = request.params;
    const { received_items } = request.body || {}; // array of { product_id, received_qty, lot_number?, expiry_date? }
    const now = new Date().toISOString();

    const po = db.prepare('SELECT * FROM purchase_orders WHERE id = ?').get(id) as any;
    if (!po) {
      return reply.code(404).send({ success: false, message: 'Không tìm thấy đơn hàng.' });
    }

    if (po.status === 'received') {
      return reply.code(400).send({ success: false, message: 'Đơn hàng này đã được nhập kho đầy đủ trước đó (không thể nhận thêm).' });
    }
    if (po.status === 'cancelled') {
      return reply.code(400).send({ success: false, message: 'Không thể nhận hàng cho đơn hàng đã hủy.' });
    }

    if (!Array.isArray(received_items) || received_items.length === 0) {
      return reply.code(400).send({ success: false, message: 'Danh sách sản phẩm nhận hàng không hợp lệ.' });
    }

    // Get current po_items to validate and track remaining quantities
    const existingPoItems = db.prepare('SELECT * FROM po_items WHERE po_id = ?').all(id) as any[];
    const poItemsMap = new Map<string, any>();
    for (const pi of existingPoItems) {
      poItemsMap.set(pi.product_id, pi);
    }

    // Validate that all received items belong to this PO
    for (const item of received_items) {
      if (!poItemsMap.has(item.product_id)) {
        return reply.code(400).send({
          success: false,
          message: `Sản phẩm ID ${item.product_id} không có trong danh sách đặt hàng của PO này.`
        });
      }
      const qty = Number(item.received_qty);
      if (isNaN(qty) || qty <= 0) {
        return reply.code(400).send({
          success: false,
          message: `Số lượng nhận cho sản phẩm ID ${item.product_id} phải là số dương lớn hơn 0.`
        });
      }
    }

    let allFullyReceived = true;

    const receiveTransaction = db.transaction(() => {
      const updatePoItem = db.prepare(`
        UPDATE po_items SET received_qty = ?, status = ? WHERE po_id = ? AND product_id = ?
      `);

      const upsertInventory = db.prepare(`
        INSERT INTO inventory (id, store_id, product_id, quantity, available_qty, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(store_id, product_id) DO UPDATE SET
          quantity = quantity + excluded.quantity,
          available_qty = available_qty + excluded.available_qty,
          updated_at = excluded.updated_at
      `);

      const insertExpiryLot = db.prepare(`
        INSERT INTO expiry_lots (id, store_id, product_id, lot_number, quantity, expiry_date, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 'active', ?)
      `);

      for (const item of received_items) {
        const addQty = Number(item.received_qty || 0);
        const pi = poItemsMap.get(item.product_id);
        const currentReceived = Number(pi.received_qty || 0);
        const newTotalReceived = currentReceived + addQty;
        const ordered = Number(pi.ordered_qty || 0);
        const itemStatus = newTotalReceived >= ordered ? 'received' : 'partial';

        updatePoItem.run(newTotalReceived, itemStatus, id, item.product_id);
        upsertInventory.run(uuidv4(), po.store_id, item.product_id, addQty, addQty, now);

        if (item.expiry_date) {
          insertExpiryLot.run(
            uuidv4(), po.store_id, item.product_id,
            item.lot_number || `LOT-${Date.now()}`, addQty, item.expiry_date, now
          );
        }

        // Update local map state
        pi.received_qty = newTotalReceived;
      }

      // Check if all items in PO are fully received
      for (const pi of poItemsMap.values()) {
        const received = Number(pi.received_qty || 0);
        const ordered = Number(pi.ordered_qty || 0);
        if (received < ordered) {
          allFullyReceived = false;
        }
      }

      const finalPoStatus = allFullyReceived ? 'received' : 'partial_received';
      db.prepare(`
        UPDATE purchase_orders SET status = ?, received_date = ?, updated_at = ? WHERE id = ?
      `).run(finalPoStatus, now, now, id);
    });

    receiveTransaction();
    auditLog(request, 'RECEIVE_PO_GOODS', 'purchase_orders', id, po, { receivedItemsCount: received_items.length });

    return {
      success: true,
      message: allFullyReceived ? 'Đã nhập kho đầy đủ đơn hàng thành công.' : 'Đã nhập kho một phần đơn hàng thành công.'
    };
  });
}
