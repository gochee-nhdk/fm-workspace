import { FastifyRequest } from 'fastify';
import { getDb } from '../db/connection.js';
import { v4 as uuidv4 } from 'uuid';

const SENSITIVE_KEYWORDS = [
  'password',
  'password_hash',
  'pass',
  'pwd',
  'hash',
  'salt',
  'secret',
  'jwt_secret',
  'jwt',
  'token',
  'refresh_token',
  'access_token',
  'authorization',
  'cookie',
  'credential',
  'smtp_pass',
  'smtp_password',
  'gemini_api_key',
  'api_key',
  'apikey',
  'private_key',
  'bearer',
];

export function sanitizeAuditData(data: any): any {
  if (data === null || data === undefined) return data;
  if (typeof data === 'string') {
    // Redact raw JWT patterns (header.payload.signature)
    if (/^eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+$/.test(data.trim())) {
      return '[REDACTED_JWT]';
    }
    // Redact argon2 / bcrypt hashes
    if (data.startsWith('$argon2') || data.startsWith('$2a$') || data.startsWith('$2b$')) {
      return '[REDACTED_HASH]';
    }
    return data;
  }
  if (typeof data !== 'object') return data;
  if (Array.isArray(data)) {
    return data.map(sanitizeAuditData);
  }

  const copy: Record<string, any> = { ...data };

  // Check if object represents a key-value setting pair e.g. { key: 'smtp_pass', value: 'secret' }
  const settingKeyName = typeof copy.key === 'string' ? copy.key.toLowerCase() : '';
  const settingSettingName = typeof copy.setting === 'string' ? copy.setting.toLowerCase() : '';
  const keyIdentifier = settingKeyName || settingSettingName;

  if (keyIdentifier && SENSITIVE_KEYWORDS.some(sk => keyIdentifier.includes(sk))) {
    if ('value' in copy) copy.value = '[REDACTED]';
    if ('val' in copy) copy.val = '[REDACTED]';
  }

  for (const k of Object.keys(copy)) {
    const lowerKey = k.toLowerCase();
    if (SENSITIVE_KEYWORDS.some(sk => lowerKey.includes(sk))) {
      copy[k] = '[REDACTED]';
    } else if (typeof copy[k] === 'object' && copy[k] !== null) {
      copy[k] = sanitizeAuditData(copy[k]);
    } else if (typeof copy[k] === 'string') {
      if (/^eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+$/.test(copy[k].trim())) {
        copy[k] = '[REDACTED_JWT]';
      } else if (copy[k].startsWith('$argon2') || copy[k].startsWith('$2a$') || copy[k].startsWith('$2b$')) {
        copy[k] = '[REDACTED_HASH]';
      }
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
    ).catch((err) => {
      console.error('Error writing audit log:', err);
    });
  } catch (err) {
    console.error('Error preparing audit log:', err);
  }
}
