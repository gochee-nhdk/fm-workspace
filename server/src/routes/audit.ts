import { FastifyInstance } from 'fastify';
import { getDb } from '../db/connection.js';
import { verifyToken, requireRole } from '../middleware/auth.js';

export default async function auditRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', requireRole('admin', 'manager'));

  fastify.get('/', async (request: any, reply) => {
    const { page = 1, limit = 10, user_id, entity_type, action } = request.query;
    const db = getDb();
    const offset = (page - 1) * limit;
    
    let query = 'SELECT * FROM audit_logs WHERE 1=1';
    const params: any[] = [];
    
    if (user_id) { query += ' AND user_id = ?'; params.push(user_id); }
    if (entity_type) { query += ' AND entity_type = ?'; params.push(entity_type); }
    if (action) { query += ' AND action = ?'; params.push(action); }
    
    const count = (db.prepare(`SELECT COUNT(*) as total FROM (${query})`).get(...params) as any).total;
    const data = db.prepare(`${query} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...params, Number(limit), Number(offset));
    
    return { success: true, data, pagination: { page: Number(page), limit: Number(limit), total: count, total_pages: Math.ceil(count / limit) } };
  });
}
