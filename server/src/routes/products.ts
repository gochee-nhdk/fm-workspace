import { FastifyInstance } from 'fastify';
import { getDb } from '../db/connection.js';
import { verifyToken } from '../middleware/auth.js';
import { v4 as uuidv4 } from 'uuid';

export default async function productRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', verifyToken);

  fastify.get('/', async (request: any, reply) => {
    const { page = 1, limit = 50, search = '' } = request.query || {};
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 50));
    const offset = (pageNum - 1) * limitNum;
    const db = getDb();

    let whereClause = ' WHERE p.is_active = 1';
    const params: any[] = [];
    if (search) {
      whereClause += ' AND (p.name LIKE ? OR p.sku_code LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    const countRes = (await db.prepare(`SELECT COUNT(*) as total FROM products p ${whereClause}`).get(...params)) as any;
    const total = Number(countRes?.total || 0);

    const query = `
      SELECT p.*, c.name as category_name, b.name as brand_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN brands b ON p.brand_id = b.id
      ${whereClause}
      ORDER BY p.name ASC
      LIMIT ? OFFSET ?
    `;
    params.push(limitNum, offset);

    const products = await db.prepare(query).all(...params);
    return {
      success: true,
      data: products,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        total_pages: Math.ceil(total / limitNum)
      }
    };
  });

  fastify.get('/:id', async (request: any, reply) => {
    const db = getDb();
    const product = await db.prepare('SELECT * FROM products WHERE id = ?').get(request.params.id);
    if (!product) return reply.code(404).send({ success: false, message: 'Không tìm thấy sản phẩm.' });
    return { success: true, data: product };
  });

  fastify.post('/', async (request: any, reply) => {
    const db = getDb();
    const { sku_code, name, category_id, brand_id, shelf_life_days } = request.body || {};
    const id = uuidv4();
    const now = new Date().toISOString();

    if (!sku_code || typeof sku_code !== 'string' || !sku_code.trim()) {
      return reply.code(400).send({ success: false, message: 'Mã SKU sản phẩm không được để trống.' });
    }
    if (!name || typeof name !== 'string' || !name.trim()) {
      return reply.code(400).send({ success: false, message: 'Tên sản phẩm không được để trống.' });
    }

    const cleanSku = sku_code.trim().toUpperCase();
    const existing = await db.prepare('SELECT id FROM products WHERE sku_code = ?').get(cleanSku);
    if (existing) {
      return reply.code(409).send({ success: false, message: `Mã SKU "${cleanSku}" đã tồn tại trong hệ thống.` });
    }
    
    await db.prepare(`
      INSERT INTO products (id, sku_code, name, category_id, brand_id, shelf_life_days, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, cleanSku, name.trim(), category_id || null, brand_id || null, Number(shelf_life_days) || 30, now, now);
    
    return { success: true, data: { id, sku_code: cleanSku, name: name.trim() } };
  });
}
