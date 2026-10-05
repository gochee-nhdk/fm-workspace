import { FastifyRequest } from 'fastify';
import { getDb } from '../db/connection.js';
import { v4 as uuidv4 } from 'uuid';

function sanitizeAuditData(data: any): any {
  if (!data || typeof data !== 'object') return data;
  if (Array.isArray(data)) {
    return data.map(sanitizeAuditData);
  }
  const copy: Record<string, any> = { ...data };
  const sensitiveKeys = ['password', 'password_hash', 'pass', 'smtp_pass', 'gemini_api_key', 'api_key', 'secret', 'token', 'refresh_token'];
  for (const k of Object.keys(copy)) {
    if (sensitiveKeys.some(sk => k.toLowerCase().includes(sk))) {
      copy[k] = '[REDACTED]';
    } else if (typeof copy[k] === 'object' && copy[k] !== null) {
      copy[k] = sanitizeAuditData(copy[k]);
    }
  }
  return copy;
}

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
    const cleanBefore = sanitizeAuditData(beforeData);
    const cleanAfter = sanitizeAuditData(afterData);
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
      cleanBefore ? JSON.stringify(cleanBefore) : null,
      cleanAfter ? JSON.stringify(cleanAfter) : null,
      reason,
      ipAddress,
      new Date().toISOString()
    );
  } catch (err) {
    console.error('Error writing audit log:', err);
  }
}
