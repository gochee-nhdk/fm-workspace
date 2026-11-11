import { FastifyInstance } from 'fastify';
import { getDb } from '../db/connection.js';
import { verifyToken } from '../middleware/auth.js';
import { v4 as uuidv4 } from 'uuid';

export default async function suppliersRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', verifyToken);

  fastify.get('/', async (request: any, reply) => {
    const { page = 1, limit = 10, search = '' } = request.query;
    const offset = (page - 1) * limit;
    const db = getDb();
    
    let query = 'SELECT * FROM suppliers WHERE is_active = 1';
    const params: any[] = [];
    if (search) {
      query += ' AND (name LIKE ? OR code LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    
    const countRes = (await db.prepare(`SELECT COUNT(*) as total FROM (${query})`).get(...params)) as any;
    const count = Number(countRes?.total || 0);
    const data = await db.prepare(`${query} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...params, Number(limit), Number(offset));
    
    return { success: true, data, pagination: { page: Number(page), limit: Number(limit), total: count, total_pages: Math.ceil(count / limit) } };
  });

  fastify.get('/:id', async (request: any, reply) => {
    const db = getDb();
    const data = await db.prepare('SELECT * FROM suppliers WHERE id = ?').get(request.params.id);
    return data ? { success: true, data } : reply.code(404).send({ success: false, message: 'Không tìm thấy nhà cung cấp.' });
  });

  fastify.post('/', async (request: any, reply) => {
    const db = getDb();
    const id = uuidv4();
    const { name, code, contact_name, phone, email, address, lead_time_days, payment_terms } = request.body || {};
    const now = new Date().toISOString();

    if (!name || typeof name !== 'string' || !name.trim()) {
      return reply.code(400).send({ success: false, message: 'Tên nhà cung cấp không được để trống.' });
    }
    if (!code || typeof code !== 'string' || !code.trim()) {
      return reply.code(400).send({ success: false, message: 'Mã nhà cung cấp không được để trống.' });
    }

    const cleanCode = code.trim().toUpperCase();
    const existing = await db.prepare('SELECT id FROM suppliers WHERE code = ?').get(cleanCode);
    if (existing) {
      return reply.code(409).send({ success: false, message: `Mã nhà cung cấp "${cleanCode}" đã tồn tại trong hệ thống.` });
    }

    const leadTime = lead_time_days !== undefined && lead_time_days !== null && !isNaN(Number(lead_time_days))
      ? Math.max(0, Number(lead_time_days))
      : 3;
    
    await db.prepare(`
      INSERT INTO suppliers (id, name, code, contact_name, phone, email, address, lead_time_days, payment_terms, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, name.trim(), cleanCode, contact_name || '', phone || '', email || '', address || '', leadTime, payment_terms || '', now, now);
    
    return { success: true, data: { id, name: name.trim(), code: cleanCode } };
  });

  fastify.put('/:id', async (request: any, reply) => {
    const db = getDb();
    const { id } = request.params;
    const existing = (await db.prepare('SELECT * FROM suppliers WHERE id = ?').get(id)) as any;
    if (!existing) {
      return reply.code(404).send({ success: false, message: 'Không tìm thấy nhà cung cấp.' });
    }

    const { name, contact_name, phone, lead_time_days, is_active } = request.body || {};
    const newName = name !== undefined ? String(name).trim() : existing.name;
    const newContact = contact_name !== undefined ? String(contact_name) : existing.contact_name;
    const newPhone = phone !== undefined ? String(phone) : existing.phone;
    const newLeadTime = lead_time_days !== undefined && !isNaN(Number(lead_time_days))
      ? Math.max(0, Number(lead_time_days))
      : existing.lead_time_days;
    const newActive = is_active !== undefined ? (is_active ? 1 : 0) : existing.is_active;

    await db.prepare(`
      UPDATE suppliers SET name=?, contact_name=?, phone=?, lead_time_days=?, is_active=?, updated_at=? WHERE id=?
    `).run(newName, newContact, newPhone, newLeadTime, newActive, new Date().toISOString(), id);

    return { success: true, data: { id, name: newName } };
  });

  fastify.get('/:id/products', async (request: any, reply) => {
    const db = getDb();
    const data = await db.prepare(`
      SELECT p.*, ps.cost_price, ps.moq 
      FROM products p 
      JOIN product_suppliers ps ON p.id = ps.product_id 
      WHERE ps.supplier_id = ?
    `).all(request.params.id);
    return { success: true, data };
  });

  fastify.get('/:id/orders', async (request: any, reply) => {
    const db = getDb();
    const data = await db.prepare('SELECT * FROM purchase_orders WHERE supplier_id = ? ORDER BY created_at DESC LIMIT 50').all(request.params.id);
    return { success: true, data };
  });

  fastify.get('/:id/performance', async (request: any, reply) => {
    const db = getDb();
    const data = await db.prepare(`
      SELECT COUNT(*) as total_orders, 
             SUM(CASE WHEN status IN ('completed', 'received') THEN 1 ELSE 0 END) as completed_orders,
             AVG(julianday(received_date) - julianday(order_date)) as avg_lead_time_actual
      FROM purchase_orders 
      WHERE supplier_id = ?
    `).get(request.params.id);
    return { success: true, data };
  });
}
