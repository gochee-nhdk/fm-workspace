import { FastifyInstance } from 'fastify';
import { getDb } from '../db/connection.js';
import { verifyToken } from '../middleware/auth.js';
import { v4 as uuidv4 } from 'uuid';

export default async function storesRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', verifyToken);

  fastify.get('/', async (request: any, reply) => {
    const { page = 1, limit = 10, search = '' } = request.query;
    const offset = (page - 1) * limit;
    const db = getDb();
    
    let query = 'SELECT * FROM stores WHERE is_active = 1';
    const params: any[] = [];
    if (search) {
      query += ' AND (name LIKE ? OR code LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    
    const countQuery = `SELECT COUNT(*) as total FROM (${query})`;
    const total = (db.prepare(countQuery).get(...params) as any).total;
    
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(Number(limit), Number(offset));
    
    const data = db.prepare(query).all(...params);
    return { success: true, data, pagination: { page: Number(page), limit: Number(limit), total, total_pages: Math.ceil(total / limit) } };
  });

  fastify.get('/:id', async (request: any, reply) => {
    const db = getDb();
    const data = db.prepare('SELECT * FROM stores WHERE id = ?').get(request.params.id);
    if (!data) return reply.code(404).send({ success: false, error: 'Not found' });
    return { success: true, data };
  });

  fastify.post('/', async (request: any, reply) => {
    const db = getDb();
    const { name, code, region_id, address } = request.body;
    const id = uuidv4();
    const now = new Date().toISOString();
    
    db.prepare('INSERT INTO stores (id, name, code, region_id, address, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(id, name, code, region_id, address, now, now);
      
    return { success: true, data: { id, name, code } };
  });

  fastify.put('/:id', async (request: any, reply) => {
    const db = getDb();
    const { name, address, is_active } = request.body;
    db.prepare('UPDATE stores SET name = ?, address = ?, is_active = ?, updated_at = ? WHERE id = ?')
      .run(name, address, is_active, new Date().toISOString(), request.params.id);
    return { success: true, data: { id: request.params.id } };
  });

  fastify.get('/:id/inventory', async (request: any, reply) => {
    const db = getDb();
    const data = db.prepare(`
      SELECT i.*, p.name, p.sku_code 
      FROM inventory i 
      JOIN products p ON i.product_id = p.id 
      WHERE i.store_id = ?
    `).all(request.params.id);
    return { success: true, data };
  });

  fastify.get('/:id/sales', async (request: any, reply) => {
    const db = getDb();
    const data = db.prepare(`
      SELECT SUM(revenue) as total_revenue, SUM(quantity) as total_quantity 
      FROM sales 
      WHERE store_id = ?
    `).get(request.params.id);
    return { success: true, data };
  });
}
