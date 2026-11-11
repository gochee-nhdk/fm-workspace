import { FastifyReply, FastifyRequest } from 'fastify';

/**
 * Enterprise Validation & Input Sanitization Middleware
 * Protects against XSS, Prototype Pollution, ReDoS, and Malformed Payloads
 */

const DANGEROUS_PROTO_KEYS = ['__proto__', 'constructor', 'prototype'];

export function sanitizeObject<T = any>(obj: T, depth = 0): T {
  if (depth > 10 || obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, depth + 1)) as any;
  }

  const clean: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (DANGEROUS_PROTO_KEYS.includes(key)) {
      continue; // Strip prototype pollution keys
    }
    clean[key] = sanitizeObject(value, depth + 1);
  }
  return clean as T;
}

export function preventPrototypePollution(request: FastifyRequest, reply: FastifyReply, done: () => void) {
  if (request.body && typeof request.body === 'object') {
    request.body = sanitizeObject(request.body);
  }
  if (request.query && typeof request.query === 'object') {
    request.query = sanitizeObject(request.query);
  }
  done();
}

/**
 * Validate pagination parameters safely (no NaN, no negatives, capped at maxLimit)
 */
export function validatePagination(pageQuery: any, limitQuery: any, maxLimit = 100) {
  let page = parseInt(String(pageQuery), 10);
  let limit = parseInt(String(limitQuery), 10);

  if (isNaN(page) || page < 1) page = 1;
  if (isNaN(limit) || limit < 1) limit = 10;
  if (limit > maxLimit) limit = maxLimit;

  return { page, limit, offset: (page - 1) * limit };
}

/**
 * Linear-time safe email format check (prevents ReDoS)
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  const trimmed = email.trim();
  if (trimmed.length > 254 || trimmed.length < 5) return false;
  const atIdx = trimmed.indexOf('@');
  if (atIdx < 1 || atIdx === trimmed.length - 1) return false;
  // Ensure only one @ symbol
  if (trimmed.indexOf('@', atIdx + 1) !== -1) return false;
  const domain = trimmed.slice(atIdx + 1);
  const dotIdx = domain.indexOf('.');
  if (dotIdx < 1 || dotIdx === domain.length - 1) return false;
  return true;
}

/**
 * Linear-time safe string sanitizer against script injections
 */
export function escapeHtml(str: string): string {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
