import { FastifyInstance } from 'fastify';
import { getDb } from '../db/connection.js';
import { verifyToken } from '../middleware/auth.js';
import { v4 as uuidv4 } from 'uuid';

export default async function storesRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', verifyToken);

  fastify.get('/', async (request: any, reply) => {
    const { page = 1, limit = 10, search = '' } = request.query || {};
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 10));
    const offset = (pageNum - 1) * limitNum;
    const db = getDb();
    
    let query = 'SELECT * FROM stores WHERE is_active = 1';
    const params: any[] = [];
    if (search) {
      query += ' AND (name LIKE ? OR code LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    
    const countQuery = `SELECT COUNT(*) as total FROM (${query})`;
    const countRes = (await db.prepare(countQuery).get(...params)) as any;
    const total = Number(countRes?.total || 0);
    
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limitNum, offset);
    
    const data = await db.prepare(query).all(...params);
    return { success: true, data, pagination: { page: pageNum, limit: limitNum, total, total_pages: Math.ceil(total / limitNum) } };
  });

  fastify.get('/:id', async (request: any, reply) => {
    const db = getDb();
    const data = await db.prepare('SELECT * FROM stores WHERE id = ?').get(request.params.id);
    if (!data) return reply.code(404).send({ success: false, message: 'Không tìm thấy cửa hàng.' });
    return { success: true, data };
  });

  fastify.post('/', async (request: any, reply) => {
    const db = getDb();
    const { name, code, region_id, address } = request.body || {};
    const id = uuidv4();
    const now = new Date().toISOString();

    if (!name || typeof name !== 'string' || !name.trim()) {
      return reply.code(400).send({ success: false, message: 'Tên cửa hàng không được để trống.' });
    }
    if (!code || typeof code !== 'string' || !code.trim()) {
      return reply.code(400).send({ success: false, message: 'Mã cửa hàng không được để trống.' });
    }

    const cleanCode = code.trim().toUpperCase();
    const existing = await db.prepare('SELECT id FROM stores WHERE code = ?').get(cleanCode);
    if (existing) {
      return reply.code(409).send({ success: false, message: `Mã cửa hàng "${cleanCode}" đã tồn tại trong hệ thống.` });
    }
    
    await db.prepare('INSERT INTO stores (id, name, code, region_id, address, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(id, name.trim(), cleanCode, region_id || null, address || '', now, now);
      
    return { success: true, data: { id, name: name.trim(), code: cleanCode } };
  });

  fastify.put('/:id', async (request: any, reply) => {
    const db = getDb();
    const { id } = request.params;
    const existing = (await db.prepare('SELECT * FROM stores WHERE id = ?').get(id)) as any;
    if (!existing) {
      return reply.code(404).send({ success: false, message: 'Không tìm thấy cửa hàng.' });
    }

    const { name, address, is_active } = request.body || {};
    const newName = name !== undefined ? String(name).trim() : existing.name;
    const newAddress = address !== undefined ? String(address) : existing.address;
    const newActive = is_active !== undefined ? (is_active ? 1 : 0) : existing.is_active;

    await db.prepare('UPDATE stores SET name = ?, address = ?, is_active = ?, updated_at = ? WHERE id = ?')
      .run(newName, newAddress, newActive, new Date().toISOString(), id);
    return { success: true, data: { id, name: newName } };
  });

  fastify.get('/:id/inventory', async (request: any, reply) => {
    const db = getDb();
    const data = await db.prepare(`
      SELECT i.*, p.name, p.sku_code 
      FROM inventory i 
      JOIN products p ON i.product_id = p.id 
      WHERE i.store_id = ?
    `).all(request.params.id);
    return { success: true, data };
  });

  fastify.get('/:id/sales', async (request: any, reply) => {
    const db = getDb();
    const data = await db.prepare(`
      SELECT SUM(revenue) as total_revenue, SUM(quantity) as total_quantity 
      FROM sales 
      WHERE store_id = ?
    `).get(request.params.id);
    return { success: true, data };
  });
}
