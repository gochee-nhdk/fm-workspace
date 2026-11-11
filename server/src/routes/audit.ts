import { FastifyInstance } from 'fastify';
import { getDb } from '../db/connection.js';
import { requireRole } from '../middleware/auth.js';
import { sanitizeAuditData } from '../middleware/audit.js';
import { validatePagination } from '../middleware/validate.js';

export default async function auditRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', requireRole('admin', 'manager'));

  fastify.get('/', async (request: any, reply) => {
    const { pageQuery = 1, limitQuery = 10, user_id, entity_type, action } = request.query || {};
    const { page, limit, offset } = validatePagination(request.query?.page || pageQuery, request.query?.limit || limitQuery, 100);
    const db = getDb();
    
    let query = 'SELECT * FROM audit_logs WHERE 1=1';
    const params: any[] = [];
    
    if (user_id && typeof user_id === 'string') {
      query += ' AND user_id = ?';
      params.push(user_id.trim());
    }
    if (entity_type && typeof entity_type === 'string') {
      query += ' AND entity_type = ?';
      params.push(entity_type.trim());
    }
    if (action && typeof action === 'string') {
      query += ' AND action = ?';
      params.push(action.trim());
    }
    
    const countRes = (await db.prepare(`SELECT COUNT(*) as total FROM (${query})`).get(...params)) as any;
    const count = Number(countRes?.total || 0);
    const rawData = (await db.prepare(`${query} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...params, limit, offset)) as any[];
    
    // Ensure all outgoing audit logs are strictly sanitized of any sensitive data
    const sanitizedData = rawData.map((row: any) => {
      let before = row.before_data;
      let after = row.after_data;
      try {
        if (before) before = JSON.stringify(sanitizeAuditData(JSON.parse(before)));
      } catch (_) {}
      try {
        if (after) after = JSON.stringify(sanitizeAuditData(JSON.parse(after)));
      } catch (_) {}
      return {
        ...row,
        before_data: before,
        after_data: after,
      };
    });

    return {
      success: true,
      data: sanitizedData,
      pagination: {
        page,
        limit,
        total: count,
        total_pages: Math.ceil(count / limit) || 1,
      },
    };
  });
}
