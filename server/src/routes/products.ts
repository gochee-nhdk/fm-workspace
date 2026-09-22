import { FastifyInstance } from 'fastify';
import { getDb } from '../db/connection.js';
import { verifyToken } from '../middleware/auth.js';
import { v4 as uuidv4 } from 'uuid';

export default async function productRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', verifyToken);

  fastify.get('/', async (request, reply) => {
    const db = getDb();
    const products = db.prepare(`
      SELECT p.*, c.name as category_name, b.name as brand_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN brands b ON p.brand_id = b.id
      WHERE p.is_active = 1
      LIMIT 100
    `).all();
    return { data: products };
  });

  fastify.get('/:id', async (request: any, reply) => {
    const db = getDb();
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(request.params.id);
    if (!product) return reply.code(404).send({ error: 'Not found' });
    return product;
  });

  fastify.post('/', async (request: any, reply) => {
    const db = getDb();
    const { sku_code, name, category_id, brand_id, shelf_life_days } = request.body;
    const id = uuidv4();
    const now = new Date().toISOString();
    
    db.prepare(`
      INSERT INTO products (id, sku_code, name, category_id, brand_id, shelf_life_days, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, sku_code, name, category_id, brand_id, shelf_life_days, now, now);
    
    return { id, sku_code, name };
  });
}
