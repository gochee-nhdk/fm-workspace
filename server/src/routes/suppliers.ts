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
    
    const count = (db.prepare(`SELECT COUNT(*) as total FROM (${query})`).get(...params) as any).total;
    const data = db.prepare(`${query} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...params, Number(limit), Number(offset));
    
    return { success: true, data, pagination: { page: Number(page), limit: Number(limit), total: count, total_pages: Math.ceil(count / limit) } };
  });

  fastify.get('/:id', async (request: any, reply) => {
    const data = getDb().prepare('SELECT * FROM suppliers WHERE id = ?').get(request.params.id);
    return data ? { success: true, data } : reply.code(404).send({ success: false, error: 'Not found' });
  });

  fastify.post('/', async (request: any, reply) => {
    const db = getDb();
    const id = uuidv4();
    const { name, code, contact_name, phone, email, address, lead_time_days, payment_terms } = request.body;
    const now = new Date().toISOString();
    
    db.prepare(`
      INSERT INTO suppliers (id, name, code, contact_name, phone, email, address, lead_time_days, payment_terms, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, name, code, contact_name, phone, email, address, lead_time_days, payment_terms, now, now);
    
    return { success: true, data: { id, name } };
  });

  fastify.put('/:id', async (request: any, reply) => {
    const db = getDb();
    const { name, contact_name, phone, lead_time_days, is_active } = request.body;
    db.prepare(`
      UPDATE suppliers SET name=?, contact_name=?, phone=?, lead_time_days=?, is_active=?, updated_at=? WHERE id=?
    `).run(name, contact_name, phone, lead_time_days, is_active, new Date().toISOString(), request.params.id);
    return { success: true, data: { id: request.params.id } };
  });

  fastify.get('/:id/products', async (request: any, reply) => {
    const data = getDb().prepare(`
      SELECT p.*, ps.cost_price, ps.moq 
      FROM products p 
      JOIN product_suppliers ps ON p.id = ps.product_id 
      WHERE ps.supplier_id = ?
    `).all(request.params.id);
    return { success: true, data };
  });

  fastify.get('/:id/orders', async (request: any, reply) => {
    const data = getDb().prepare('SELECT * FROM purchase_orders WHERE supplier_id = ? ORDER BY created_at DESC LIMIT 50').all(request.params.id);
    return { success: true, data };
  });

  fastify.get('/:id/performance', async (request: any, reply) => {
    const db = getDb();
    const data = db.prepare(`
      SELECT COUNT(*) as total_orders, 
             SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) as completed_orders,
             AVG(julianday(received_date) - julianday(order_date)) as avg_lead_time_actual
      FROM purchase_orders 
      WHERE supplier_id = ?
    `).get(request.params.id);
    return { success: true, data };
  });
}
