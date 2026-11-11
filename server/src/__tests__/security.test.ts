import Fastify, { FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import * as argon2 from 'argon2';
import path from 'path';
import fs from 'fs';

// Force test environment
process.env.NODE_ENV = 'test';
process.env.APP_ENV = 'test';
const TEST_JWT_SECRET = 'test_super_secret_jwt_key_32_characters_long_sec_test';
process.env.JWT_SECRET = TEST_JWT_SECRET;

const testDbDir = path.resolve(process.cwd(), process.cwd().endsWith('server') ? 'data' : 'server/data');
if (!fs.existsSync(testDbDir)) {
  fs.mkdirSync(testDbDir, { recursive: true });
}
const testDbPath = path.join(testDbDir, 'test_security_suite.db');
process.env.DATABASE_PATH = testDbPath;
if (fs.existsSync(testDbPath)) {
  try { fs.unlinkSync(testDbPath); } catch (_) {}
}

import { getDb } from '../db/connection.js';
import { globalRateLimitOptions, authRateLimitConfig } from '../middleware/rateLimit.js';
import { sanitizeAuditData, auditLog } from '../middleware/audit.js';
import { sanitizeObject, validatePagination, isValidEmail, escapeHtml } from '../middleware/validate.js';
import { secureErrorHandler } from '../middleware/errorHandler.js';
import { registerSecurityMiddleware } from '../middleware/security.js';
import { revokeToken, isTokenRevoked } from '../middleware/auth.js';
import authRoutes from '../routes/auth.js';
import settingsRoutes from '../routes/settings.js';
import auditRoutes from '../routes/audit.js';

async function runSecurityTestSuite() {
  console.log('=== FM WORKSPACE — COMPREHENSIVE SECURITY AUDIT & DEFENSE TEST SUITE ===\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}`);
      failed++;
    }
  }

  const db = getDb();

  // Create necessary schema
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE,
      full_name TEXT,
      password_hash TEXT,
      role TEXT DEFAULT 'staff',
      google_id TEXT,
      avatar_url TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id),
      refresh_token_hash TEXT,
      token_family TEXT,
      expires_at TEXT,
      created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS token_blacklist (
      id TEXT PRIMARY KEY,
      token_hash TEXT UNIQUE NOT NULL,
      user_id TEXT,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS system_settings (
      id TEXT PRIMARY KEY,
      key TEXT UNIQUE,
      value TEXT,
      category TEXT,
      updated_by TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      user_name TEXT,
      action TEXT,
      entity_type TEXT,
      entity_id TEXT,
      before_data TEXT,
      after_data TEXT,
      reason TEXT,
      ip_address TEXT,
      created_at TEXT
    );
  `);

  // Seed Admin and Staff users
  const adminId = uuidv4();
  const staffId = uuidv4();
  const inactiveId = uuidv4();
  const now = new Date().toISOString();
  const adminHash = await argon2.hash('Admin@123456');
  const staffHash = await argon2.hash('Staff@123456');

  await db.prepare(`
    INSERT INTO users (id, email, full_name, password_hash, role, is_active, created_at, updated_at)
    VALUES (?, 'admin@test.com', 'Admin User', ?, 'admin', 1, ?, ?),
           (?, 'staff@test.com', 'Staff User', ?, 'staff', 1, ?, ?),
           (?, 'inactive@test.com', 'Inactive User', ?, 'staff', 0, ?, ?)
  `).run(adminId, adminHash, now, now, staffId, staffHash, now, now, inactiveId, staffHash, now, now);

  // Seed system settings (including secrets)
  await db.prepare(`
    INSERT INTO system_settings (id, key, value, category, updated_at)
    VALUES (?, 'company_name', 'Farmers Market VN', 'general', ?),
           (?, 'gemini_api_key', 'AIzaSyASecretKey1234567890abcdef', 'ai', ?),
           (?, 'smtp_pass', 'SuperSecretSmtpPass!@#', 'smtp', ?),
           (?, 'jwt_secret', 'ForbiddenJwtSecretToLeak', 'security', ?)
  `).run(uuidv4(), now, uuidv4(), now, uuidv4(), now, uuidv4(), now);

  const adminToken = jwt.sign({ id: adminId, email: 'admin@test.com', role: 'admin', full_name: 'Admin User' }, TEST_JWT_SECRET, { expiresIn: '1h' });
  const staffToken = jwt.sign({ id: staffId, email: 'staff@test.com', role: 'staff', full_name: 'Staff User' }, TEST_JWT_SECRET, { expiresIn: '1h' });
  const inactiveToken = jwt.sign({ id: inactiveId, email: 'inactive@test.com', role: 'staff', full_name: 'Inactive User' }, TEST_JWT_SECRET, { expiresIn: '1h' });

  // Initialize Fastify Test Server
  const app: FastifyInstance = Fastify({ logger: false });
  registerSecurityMiddleware(app);
  await app.register(cookie);
  await app.register(rateLimit, globalRateLimitOptions);
  app.setErrorHandler(secureErrorHandler);

  app.register(authRoutes, { prefix: '/api/auth' });
  app.register(settingsRoutes, { prefix: '/api/settings' });
  app.register(auditRoutes, { prefix: '/api/audit-logs' });
  await app.ready();

  // ==========================================
  // GROUP 1: SENSITIVE DATA LEAK PREVENTION
  // ==========================================
  console.log('--- TEST GROUP 1: Sensitive Data Leak Prevention ---');

  // 1.1 GET /api/settings should NEVER return sensitive keys
  const settingsRes = await app.inject({
    method: 'GET',
    url: '/api/settings',
    headers: { authorization: `Bearer ${adminToken}` },
  });
  const settingsBody = JSON.parse(settingsRes.body);
  assert(settingsRes.statusCode === 200, '1.1: GET /api/settings returns 200 OK');
  const leakedKey = settingsBody.data?.find((s: any) =>
    s.key === 'gemini_api_key' || s.key === 'smtp_pass' || s.key === 'jwt_secret' || s.key.includes('pass')
  );
  assert(!leakedKey, '1.2: Sensitive settings (gemini_api_key, smtp_pass, jwt_secret) strictly excluded from API response');

  // 1.3 Audit Log Sanitization: Key-value objects like { key: 'smtp_pass', value: 'secret' }
  const dirtyAuditData = {
    key: 'smtp_pass',
    value: 'P@ssword123',
    nested: {
      password: 'PlainPassword',
      safe_field: 'NormalValue',
      arbitrary_field: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.t-IDcSemACt8x4iTMCda8Yhe3iZaWbvV5XKSTbuAn0M',
    },
  };
  const sanitized = sanitizeAuditData(dirtyAuditData);
  assert(sanitized.value === '[REDACTED]', '1.3: AuditLog redacts value when key="smtp_pass"');
  assert(sanitized.nested.password === '[REDACTED]', '1.4: AuditLog redacts nested password');
  assert(sanitized.nested.safe_field === 'NormalValue', '1.5: AuditLog preserves non-sensitive fields');
  assert(sanitized.nested.arbitrary_field === '[REDACTED_JWT]', '1.6: AuditLog automatically redacts raw JWT tokens regardless of key name');

  // 1.7 Error Handler never exposes internal database schema or stack traces
  const errRes = await app.inject({
    method: 'GET',
    url: '/api/settings/users',
    headers: { authorization: 'Bearer invalid_signature_token' },
  });
  assert(errRes.statusCode === 401, '1.7: Invalid token returns 401 without leaking stack trace');
  const errBody = JSON.parse(errRes.body);
  assert(!errBody.stack, '1.8: Stack trace strictly absent in error response');

  // ==========================================
  // GROUP 2: REFRESH TOKEN ROTATION & SESSION INTEGRITY
  // ==========================================
  console.log('\n--- TEST GROUP 2: Refresh Token Rotation & Session Integrity ---');

  // 2.1 Login issues HttpOnly cookie
  const loginRes = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: 'admin@test.com', password: 'Admin@123456' },
  });
  assert(loginRes.statusCode === 200, '2.1: Login succeeds with 200');
  const setCookieHeader = loginRes.headers['set-cookie'];
  assert(typeof setCookieHeader === 'string' && setCookieHeader.includes('refresh_token='), '2.2: Login sets refresh_token cookie');
  assert(typeof setCookieHeader === 'string' && setCookieHeader.includes('HttpOnly'), '2.3: refresh_token cookie is HttpOnly');

  // Extract refresh token from cookie
  const cookieMatch = typeof setCookieHeader === 'string' ? setCookieHeader.match(/refresh_token=([^;]+)/) : null;
  const initialRefreshToken = cookieMatch ? cookieMatch[1] : '';

  // 2.4 Refresh token rotation: calling /refresh returns rotated cookie
  const refreshRes1 = await app.inject({
    method: 'POST',
    url: '/api/auth/refresh',
    headers: {
      cookie: `refresh_token=${initialRefreshToken}`,
    },
  });
  assert(refreshRes1.statusCode === 200, '2.4: First refresh succeeds with 200');
  const newCookieHeader = refreshRes1.headers['set-cookie'];
  const newCookieMatch = typeof newCookieHeader === 'string' ? newCookieHeader.match(/refresh_token=([^;]+)/) : null;
  const rotatedRefreshToken = newCookieMatch ? newCookieMatch[1] : '';
  assert(rotatedRefreshToken !== initialRefreshToken, '2.5: Refresh Token was rotated (new token !== initial token)');

  // 2.6 Attempting to reuse old refresh token MUST fail
  const reuseRes = await app.inject({
    method: 'POST',
    url: '/api/auth/refresh',
    headers: {
      cookie: `refresh_token=${initialRefreshToken}`,
    },
  });
  assert(reuseRes.statusCode === 401, '2.6: Reusing already-rotated refresh token fails with 401 Unauthorized');

  // ==========================================
  // GROUP 3: JWT LOGOUT BLACKLIST & REVOCATION
  // ==========================================
  console.log('\n--- TEST GROUP 3: JWT Logout Blacklist & Revocation ---');

  // Generate a distinct token for revocation test
  const testRevokeUserToken = jwt.sign(
    { id: staffId, email: 'staff@test.com', role: 'staff', full_name: 'Staff User', jti: uuidv4() },
    TEST_JWT_SECRET,
    { expiresIn: '1h' }
  );

  // Verify token works before logout
  const beforeLogoutRes = await app.inject({
    method: 'GET',
    url: '/api/auth/me',
    headers: { authorization: `Bearer ${testRevokeUserToken}` },
  });
  assert(beforeLogoutRes.statusCode === 200, '3.1: Token valid before logout');

  // Call logout
  const logoutRes = await app.inject({
    method: 'POST',
    url: '/api/auth/logout',
    headers: { authorization: `Bearer ${testRevokeUserToken}` },
  });
  assert(logoutRes.statusCode === 200, '3.2: Logout returns 200');

  // Verify blacklisted token is now strictly REJECTED
  const afterLogoutRes = await app.inject({
    method: 'GET',
    url: '/api/auth/me',
    headers: { authorization: `Bearer ${testRevokeUserToken}` },
  });
  assert(afterLogoutRes.statusCode === 401, '3.3: Blacklisted access token rejected with 401 Unauthorized');

  // 3.4 Inactive user token rejected
  const inactiveRes = await app.inject({
    method: 'GET',
    url: '/api/auth/me',
    headers: { authorization: `Bearer ${inactiveToken}` },
  });
  assert(inactiveRes.statusCode === 401, '3.4: Inactive user token rejected with 401');

  // ==========================================
  // GROUP 4: RBAC & PRIVILEGE ESCALATION (IDOR)
  // ==========================================
  console.log('\n--- TEST GROUP 4: RBAC & Privilege Escalation (IDOR) ---');

  // 4.1 Staff cannot access Gemini keys pool
  const staffKeysRes = await app.inject({
    method: 'GET',
    url: '/api/settings/gemini-keys-pool',
    headers: { authorization: `Bearer ${staffToken}` },
  });
  assert(staffKeysRes.statusCode === 403, '4.1: Non-admin staff cannot access /gemini-keys-pool (403 Forbidden)');

  // 4.2 Admin can access Gemini keys pool, but keys are strictly masked
  const adminKeysRes = await app.inject({
    method: 'GET',
    url: '/api/settings/gemini-keys-pool',
    headers: { authorization: `Bearer ${adminToken}` },
  });
  assert(adminKeysRes.statusCode === 200, '4.2: Admin can access /gemini-keys-pool');
  const adminKeysBody = JSON.parse(adminKeysRes.body);
  const rawKeyLeak = adminKeysBody.data?.some((k: any) => k.key.length > 20 && !k.key.includes('••••'));
  assert(!rawKeyLeak, '4.3: Gemini keys in pool are strictly masked (no raw key leakage)');

  // 4.3 Non-admin cannot bulk update settings
  const staffUpdateSettings = await app.inject({
    method: 'PUT',
    url: '/api/settings',
    headers: { authorization: `Bearer ${staffToken}` },
    payload: { settings: [{ key: 'company_name', value: 'Hacked' }] },
  });
  assert(staffUpdateSettings.statusCode === 403, '4.4: Non-admin staff cannot bulk update settings (403 Forbidden)');

  // 4.4 Non-admin cannot access audit logs
  const staffAuditRes = await app.inject({
    method: 'GET',
    url: '/api/audit-logs',
    headers: { authorization: `Bearer ${staffToken}` },
  });
  assert(staffAuditRes.statusCode === 403, '4.5: Non-admin staff cannot access audit logs (403 Forbidden)');

  // 4.5 Admin updating user role with invalid role is rejected
  const invalidRoleRes = await app.inject({
    method: 'PUT',
    url: `/api/settings/users/${staffId}`,
    headers: { authorization: `Bearer ${adminToken}` },
    payload: { role: 'super_hacker_role<script>' },
  });
  assert(invalidRoleRes.statusCode === 400, '4.6: Invalid user role assignment rejected with 400 Bad Request');

  // ==========================================
  // GROUP 5: SQL INJECTION & INPUT SANITIZATION
  // ==========================================
  console.log('\n--- TEST GROUP 5: SQL Injection & Input Sanitization ---');

  // 5.1 SQL Injection in login email
  const sqliLoginRes = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: "' OR '1'='1' --", password: 'any' },
  });
  assert(sqliLoginRes.statusCode === 401, '5.1: SQL injection in email safely rejected with 401');

  // 5.2 Prototype pollution injection in body
  const protoRes = sanitizeObject({
    __proto__: { polluted: true },
    constructor: { prototype: { admin: true } },
    normalField: 'safeValue',
  });
  assert((protoRes as any).normalField === 'safeValue', '5.2: Prototype pollution sanitization retains normal fields');
  assert(!(Object.prototype as any).polluted, '5.3: Object.prototype was NOT polluted');

  // 5.3 Linear-time email validation (ReDoS-safe)
  assert(isValidEmail('user@domain.com') === true, '5.4: Valid email recognized');
  assert(isValidEmail('invalid-email-no-at') === false, '5.5: Missing @ rejected');
  assert(isValidEmail('user@@multiple.com') === false, '5.6: Multiple @ rejected');
  assert(isValidEmail('a'.repeat(300) + '@evil.com') === false, '5.7: Oversized email rejected without ReDoS');

  // 5.4 Pagination validation prevents NaN and unbounded limit DoS
  const safePagination = validatePagination('NaN', '9999999', 50);
  assert(safePagination.page === 1, '5.8: NaN page normalized to 1');
  assert(safePagination.limit === 50, '5.9: Unbounded limit capped at maxLimit (50)');

  // 5.5 XSS character escaping
  const escaped = escapeHtml('<script>alert("XSS")</script>');
  assert(escaped === '&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;', '5.10: XSS characters properly escaped');

  // ==========================================
  // GROUP 6: SECURITY HEADERS & HOST HEADER PROTECTION
  // ==========================================
  console.log('\n--- TEST GROUP 6: Security Headers & Host Header Protection ---');

  // 6.1 Check security headers on normal request
  const headerRes = await app.inject({
    method: 'GET',
    url: '/api/settings',
    headers: {
      authorization: `Bearer ${adminToken}`,
      host: 'localhost:3000',
    },
  });
  assert(headerRes.headers['x-content-type-options'] === 'nosniff', '6.1: X-Content-Type-Options: nosniff present');
  assert(headerRes.headers['x-frame-options'] === 'DENY', '6.2: X-Frame-Options: DENY present');
  assert(typeof headerRes.headers['content-security-policy'] === 'string' && headerRes.headers['content-security-policy'].includes("frame-ancestors 'none'"), '6.3: CSP frame-ancestors: none present');

  // 6.4 Spoofed Host header rejected (Anti-DNS Rebinding)
  const rebindingRes = await app.inject({
    method: 'GET',
    url: '/api/settings',
    headers: {
      authorization: `Bearer ${adminToken}`,
      host: 'malicious-attacker-host.com',
    },
  });
  assert(rebindingRes.statusCode === 403, '6.4: DNS rebinding / host spoofing blocked with 403');

  // ==========================================
  // SUMMARY
  // ==========================================
  console.log(`\n=== KẾT QUẢ KIỂM THỬ BẢO MẬT: ${passed} ĐẠT, ${failed} THẤT BẠI ===\n`);

  await app.close();
  if (fs.existsSync(testDbPath)) {
    try { fs.unlinkSync(testDbPath); } catch (_) {}
  }

  if (failed > 0) {
    process.exit(1);
  }
}

runSecurityTestSuite().catch((err) => {
  console.error('Fatal error during security test suite:', err);
  process.exit(1);
});
