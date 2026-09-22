import { FastifyInstance } from 'fastify';
import { getDb } from '../db/connection.js';
import { verifyToken } from '../middleware/auth.js';

export default async function notificationsRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', verifyToken);

  fastify.get('/', async (request: any, reply) => {
    const { page = 1, limit = 10 } = request.query;
    const db = getDb();
    const offset = (page - 1) * limit;
    
    // In actual implementation we would filter by request.user.id or roles
    const query = 'SELECT * FROM notifications ORDER BY created_at DESC';
    const count = (db.prepare('SELECT COUNT(*) as total FROM notifications').get() as any).total;
    const data = db.prepare(`${query} LIMIT ? OFFSET ?`).all(Number(limit), Number(offset));
    
    return { success: true, data, pagination: { page: Number(page), limit: Number(limit), total: count, total_pages: Math.ceil(count / limit) } };
  });

  fastify.put('/:id/read', async (request: any, reply) => {
    const db = getDb();
    db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(request.params.id);
    return { success: true, data: { id: request.params.id } };
  });

  fastify.put('/read-all', async (request: any, reply) => {
    const db = getDb();
    db.prepare('UPDATE notifications SET is_read = 1 WHERE is_read = 0').run();
    return { success: true };
  });

  fastify.get('/unread-count', async (request: any, reply) => {
    const db = getDb();
    const count = (db.prepare('SELECT COUNT(*) as count FROM notifications WHERE is_read = 0').get() as any).count;
    return { success: true, data: { count } };
  });
}
