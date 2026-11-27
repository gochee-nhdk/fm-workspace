const { verifyJwt, hashToken } = require('./crypto');
const { getDb } = require('./db');

const DANGEROUS_PROTO_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function sanitizeObject(obj, depth = 0) {
  if (depth > 12 || obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObject(item, depth + 1));
  }
  const clean = {};
  for (const [key, value] of Object.entries(obj)) {
    if (DANGEROUS_PROTO_KEYS.has(key)) continue;
    clean[key] = sanitizeObject(value, depth + 1);
  }
  return clean;
}

function applyCorsAndSecurityHeaders(req, res) {
  const origin = req.headers.origin;
  const clientUrl = process.env.CLIENT_URL || '';
  const allowedOriginsEnv = process.env.ALLOWED_ORIGINS || '';
  const vercelUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '';

  const envOrigins = allowedOriginsEnv
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean);

  if (clientUrl) envOrigins.push(clientUrl.trim().replace(/\/+$/, ''));
  if (vercelUrl) envOrigins.push(vercelUrl.trim().replace(/\/+$/, ''));

  let isAllowedOrigin = false;
  if (!origin) {
    isAllowedOrigin = true; // Same-origin, server-to-server, curl
  } else {
    const normalizedOrigin = origin.replace(/\/+$/, '');
    if (
      envOrigins.includes(normalizedOrigin) ||
      /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(normalizedOrigin) ||
      /^https:\/\/fm-workspace[a-z0-9-]*\.vercel\.app$/.test(normalizedOrigin)
    ) {
      isAllowedOrigin = true;
    }
  }

  if (isAllowedOrigin && origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  // Hardened Security Headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Cache-Control', 'no-store');

  return { isAllowedOrigin };
}

function sendError(res, status, error, message, details) {
  const payload = {
    success: false,
    error,
    message,
  };
  if (details !== undefined) {
    payload.details = details;
  }
  return res.status(status).json(payload);
}

function parseZodError(zodErr) {
  if (!zodErr || !Array.isArray(zodErr.issues)) return 'Dữ liệu đầu vào không hợp lệ.';
  return zodErr.issues.map((i) => i.message).join('; ');
}

function escapeHtml(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getClientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length > 0) {
    return fwd.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || req.ip || '';
}

function isLoopbackIp(ip) {
  return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
}

async function verifyAuth(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { valid: false, error: 'Thiếu Authorization Bearer token' };
  }
  const token = authHeader.slice(7).trim();
  const check = verifyJwt(token);
  if (!check.valid) return check;

  // Check token revocation blacklist in Turso/SQLite
  try {
    const db = await getDb();
    const tokenHash = hashToken(token);
    const revoked = await db.execute({
      sql: 'SELECT token_hash FROM revoked_tokens WHERE token_hash = ? LIMIT 1',
      args: [tokenHash],
    });
    if (revoked.rows.length > 0) {
      return { valid: false, error: 'Phiên đăng nhập đã bị thu hồi' };
    }
  } catch (err) {
    return { valid: false, error: 'Không thể xác minh phiên đăng nhập' };
  }

  return check;
}

module.exports = {
  sanitizeObject,
  applyCorsAndSecurityHeaders,
  sendError,
  parseZodError,
  escapeHtml,
  getClientIp,
  isLoopbackIp,
  verifyAuth,
};
