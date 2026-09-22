import { FastifyRequest } from 'fastify';
import { getDb } from '../db/connection.js';
import { v4 as uuidv4 } from 'uuid';

export function auditLog(
  request: FastifyRequest,
  action: string,
  entityType: string,
  entityId: string | null,
  beforeData: any = null,
  afterData: any = null,
  reason: string | null = null
) {
  const db = getDb();
  const userId = request.user?.id || 'system';
  const userName = request.user?.full_name || 'System';
  const ipAddress = request.ip || 'unknown';
  
  try {
    db.prepare(`
      INSERT INTO audit_logs (id, user_id, user_name, action, entity_type, entity_id, before_data, after_data, reason, ip_address, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      uuidv4(),
      userId,
      userName,
      action,
      entityType,
      entityId,
      beforeData ? JSON.stringify(beforeData) : null,
      afterData ? JSON.stringify(afterData) : null,
      reason,
      ipAddress,
      new Date().toISOString()
    );
  } catch (err) {
    console.error('Error writing audit log:', err);
  }
}
