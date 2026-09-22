import { FastifyInstance } from 'fastify';
import { getDb } from '../db/connection.js';
import { verifyToken } from '../middleware/auth.js';

export default async function analyticsRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', verifyToken);

  fastify.get('/sku-performance', async (request: any, reply) => {
    const db = getDb();
    const data = db.prepare(`
      SELECT p.name, p.sku_code, SUM(s.quantity) as total_sold, SUM(s.revenue) as total_revenue
      FROM sales s
      JOIN products p ON s.product_id = p.id
      GROUP BY p.id
      ORDER BY total_revenue DESC LIMIT 50
    `).all();
    return { success: true, data };
  });

  fastify.get('/store-performance', async (request: any, reply) => {
    const db = getDb();
    const data = db.prepare(`
      SELECT st.name, SUM(s.revenue) as revenue
      FROM sales s
      JOIN stores st ON s.store_id = st.id
      GROUP BY st.id
      ORDER BY revenue DESC
    `).all();
    return { success: true, data };
  });

  fastify.get('/category-performance', async (request: any, reply) => {
    const db = getDb();
    const data = db.prepare(`
      SELECT c.name, SUM(s.revenue) as revenue
      FROM sales s
      JOIN products p ON s.product_id = p.id
      JOIN categories c ON p.category_id = c.id
      GROUP BY c.id
      ORDER BY revenue DESC
    `).all();
    return { success: true, data };
  });

  fastify.get('/sales', async (request: any, reply) => {
    const db = getDb();
    const data = db.prepare(`
      SELECT sale_date, SUM(revenue) as daily_revenue
      FROM sales
      GROUP BY sale_date
      ORDER BY sale_date DESC LIMIT 30
    `).all();
    return { success: true, data };
  });

  fastify.get('/supplier-performance', async (request: any, reply) => {
    const db = getDb();
    const data = db.prepare(`
      SELECT su.name, COUNT(po.id) as total_orders
      FROM purchase_orders po
      JOIN suppliers su ON po.supplier_id = su.id
      GROUP BY su.id
    `).all();
    return { success: true, data };
  });
}
