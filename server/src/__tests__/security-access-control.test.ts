import fastify, { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import rateLimit from '@fastify/rate-limit';
import path from 'path';
import fs from 'fs';

async function runSecurityTests() {
  console.log('=== FM WORKSPACE — P0 SECURITY ACCESS-CONTROL TESTS ===\n');
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

  // Setup test JWT secret
  const TEST_JWT_SECRET = 'test_super_secret_jwt_key_32_characters_long_12345';
  process.env.JWT_SECRET = TEST_JWT_SECRET;

  const testDbDir = path.resolve(process.cwd(), process.cwd().endsWith('server') ? 'data' : 'server/data');
  if (!fs.existsSync(testDbDir)) {
    fs.mkdirSync(testDbDir, { recursive: true });
  }
  const testDbPath = path.join(testDbDir, 'test_security.db');
  process.env.DATABASE_PATH = testDbPath;
  if (fs.existsSync(testDbPath)) {
    try {
      fs.unlinkSync(testDbPath);
    } catch (_) {}
  }

  const { getDb } = await import('../db/connection.js');
  const db = getDb();

  // Setup schema
  await db.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      full_name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      is_active INTEGER DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE user_workspace_backups (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      backup_type TEXT DEFAULT 'auto',
      device_name TEXT,
      checksum TEXT,
      item_counts TEXT,
      payload TEXT,
      is_encrypted INTEGER DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE system_settings (
      id TEXT PRIMARY KEY,
      key TEXT UNIQUE NOT NULL,
      value TEXT,
      category TEXT DEFAULT 'general',
      updated_at TEXT
    );

    CREATE TABLE notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      type TEXT,
      title TEXT,
      message TEXT,
      severity TEXT,
      entity_type TEXT,
      entity_id TEXT,
      is_read INTEGER DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE ai_conversations (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      title TEXT,
      created_at TEXT
    );

    CREATE TABLE ai_messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT,
      role TEXT,
      content TEXT,
      data_context TEXT,
      created_at TEXT
    );
  `);

  // Seed test users
  const userAId = 'user_aaa_111';
  const userBId = 'user_bbb_222';
  const adminId = 'admin_999_xyz';
  const now = new Date().toISOString();

  await db.prepare(`
    INSERT INTO users (id, email, full_name, password_hash, role, is_active, created_at, updated_at)
    VALUES (?, ?, ?, 'mockhash', ?, 1, ?, ?)
  `).run(userAId, 'usera@fm.vn', 'User A', 'user', now, now);

  await db.prepare(`
    INSERT INTO users (id, email, full_name, password_hash, role, is_active, created_at, updated_at)
    VALUES (?, ?, ?, 'mockhash', ?, 1, ?, ?)
  `).run(userBId, 'userb@fm.vn', 'User B', 'user', now, now);

  await db.prepare(`
    INSERT INTO users (id, email, full_name, password_hash, role, is_active, created_at, updated_at)
    VALUES (?, ?, ?, 'mockhash', ?, 1, ?, ?)
  `).run(adminId, 'admin@fm.vn', 'Admin User', 'admin', now, now);

  // Seed User A and User B backups
  const backupUserAId = 'backup_a_001';
  const backupUserBId = 'backup_b_002';
  await db.prepare(`
    INSERT INTO user_workspace_backups (id, user_id, backup_type, device_name, checksum, item_counts, payload, is_encrypted, created_at)
    VALUES (?, ?, 'auto', 'Device A', 'checksum_a', '{}', '{"notes":["private A"]}', 0, ?)
  `).run(backupUserAId, userAId, now);

  await db.prepare(`
    INSERT INTO user_workspace_backups (id, user_id, backup_type, device_name, checksum, item_counts, payload, is_encrypted, created_at)
    VALUES (?, ?, 'auto', 'Device B', 'checksum_b', '{}', '{"notes":["private B"]}', 0, ?)
  `).run(backupUserBId, userBId, now);

  // Generate valid test JWTs
  const tokenUserA = jwt.sign({ id: userAId, email: 'usera@fm.vn', role: 'user', full_name: 'User A' }, TEST_JWT_SECRET, { expiresIn: '1h' });
  const tokenUserB = jwt.sign({ id: userBId, email: 'userb@fm.vn', role: 'user', full_name: 'User B' }, TEST_JWT_SECRET, { expiresIn: '1h' });
  const tokenAdmin = jwt.sign({ id: adminId, email: 'admin@fm.vn', role: 'admin', full_name: 'Admin User' }, TEST_JWT_SECRET, { expiresIn: '1h' });
  const invalidToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature';

  // Import application routes directly
  const syncRoutes = (await import('../routes/sync.js')).default;
  const aiRoutes = (await import('../routes/ai.js')).default;
  const notificationsRoutes = (await import('../routes/notifications.js')).default;
  const authRoutes = (await import('../routes/auth.js')).default;

  // Build Fastify instance for testing
  const app = fastify();
  await app.register(rateLimit, { max: 100, timeWindow: '1 minute' });
  await app.register(syncRoutes, { prefix: '/api/sync' });
  await app.register(aiRoutes, { prefix: '/api/ai' });
  await app.register(notificationsRoutes, { prefix: '/api/notifications' });
  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.ready();

  // ── TEST 1: Request without token cannot download or overwrite backups
  console.log('--- TEST GROUP 1: Unauthenticated Backup Protection ---');
  const resNoAuthLatest = await app.inject({
    method: 'GET',
    url: '/api/sync/latest',
  });
  assert(resNoAuthLatest.statusCode === 401, '1.1: GET /api/sync/latest without token returns 401 Unauthorized');

  const resNoAuthBackup = await app.inject({
    method: 'POST',
    url: '/api/sync/backup',
    payload: {
      checksum: 'fake_check',
      payload: '{"test":"val"}',
    },
  });
  assert(resNoAuthBackup.statusCode === 401, '1.2: POST /api/sync/backup without token returns 401 Unauthorized');

  const resNoAuthDownload = await app.inject({
    method: 'GET',
    url: `/api/sync/download/${backupUserAId}`,
  });
  assert(resNoAuthDownload.statusCode === 401, '1.3: GET /api/sync/download/:id without token returns 401 Unauthorized');

  // ── TEST 2: Invalid or expired token is rejected
  console.log('\n--- TEST GROUP 2: Invalid / Expired Token Rejection ---');
  const resInvalidToken = await app.inject({
    method: 'GET',
    url: '/api/sync/latest',
    headers: { authorization: `Bearer ${invalidToken}` },
  });
  assert(resInvalidToken.statusCode === 401, '2.1: Invalid token on /api/sync/latest returns 401 Unauthorized');

  // ── TEST 3: User isolation (User A cannot access or overwrite User B)
  console.log('\n--- TEST GROUP 3: Multi-tenant / User Isolation ---');
  const resUserALatest = await app.inject({
    method: 'GET',
    url: '/api/sync/latest',
    headers: { authorization: `Bearer ${tokenUserA}` },
  });
  assert(resUserALatest.statusCode === 200, '3.1: User A gets 200 OK for their own latest backup');
  const userABackupData = JSON.parse(resUserALatest.payload);
  assert(userABackupData.data.id === backupUserAId, '3.2: User A receives User A backup, not User B');

  const resUserATryDownloadB = await app.inject({
    method: 'GET',
    url: `/api/sync/download/${backupUserBId}`,
    headers: { authorization: `Bearer ${tokenUserA}` },
  });
  assert(resUserATryDownloadB.statusCode === 404, '3.3: User A attempting to download User B backup gets 404 Not Found');

  const resUserBDownloadOwn = await app.inject({
    method: 'GET',
    url: `/api/sync/download/${backupUserBId}`,
    headers: { authorization: `Bearer ${tokenUserB}` },
  });
  assert(resUserBDownloadOwn.statusCode === 200, '3.4: User B can download their own backup');

  const resAdminDownloadB = await app.inject({
    method: 'GET',
    url: `/api/sync/download/${backupUserBId}`,
    headers: { authorization: `Bearer ${tokenAdmin}` },
  });
  assert(resAdminDownloadB.statusCode === 200, '3.5: Admin can access backup for maintenance');

  // ── TEST 4: Spoofed User ID in request body/header has no effect
  console.log('\n--- TEST GROUP 4: Identity Tampering Resistance ---');
  const resSpoofedBackup = await app.inject({
    method: 'POST',
    url: '/api/sync/backup',
    headers: { authorization: `Bearer ${tokenUserA}` },
    payload: {
      userId: userBId, // Attempting to spoof User B!
      user_id: userBId,
      checksum: 'check_spoof_1',
      payload: '{"hacked":"true"}',
    },
  });
  assert(resSpoofedBackup.statusCode === 200, '4.1: Backup creation succeeds under authenticated identity');
  // Check in DB that the record was created for User A, NOT User B
  const spoofedRecord = (await db.prepare(`SELECT user_id FROM user_workspace_backups WHERE checksum = 'check_spoof_1'`).get()) as any;
  assert(spoofedRecord?.user_id === userAId, '4.2: Backup strictly assigned to User A (server identity), ignoring spoofed user_id in payload');

  // ── TEST 5: Admin endpoint protection
  console.log('\n--- TEST GROUP 5: Role-based Access Control (RBAC) ---');
  const resUserConfigSmtp = await app.inject({
    method: 'POST',
    url: '/api/notifications/smtp-config',
    headers: { authorization: `Bearer ${tokenUserA}` },
    payload: { user: 'evil@fm.vn', pass: 'secret' },
  });
  assert(resUserConfigSmtp.statusCode === 403, '5.1: Non-admin User A cannot configure SMTP (403 Forbidden)');

  const resNoAuthSmtpConfig = await app.inject({
    method: 'POST',
    url: '/api/notifications/smtp-config',
    payload: { user: 'evil@fm.vn', pass: 'secret' },
  });
  assert(resNoAuthSmtpConfig.statusCode === 401, '5.2: Unauthenticated request to /smtp-config returns 401 Unauthorized');

  const resNoAuthSmtpStatus = await app.inject({
    method: 'GET',
    url: '/api/notifications/smtp-status',
  });
  assert(resNoAuthSmtpStatus.statusCode === 401, '5.3: Unauthenticated request to /smtp-status returns 401 Unauthorized');

  // ── TEST 6: AI endpoint protection
  console.log('\n--- TEST GROUP 6: AI Protection ---');
  const resNoAuthAi = await app.inject({
    method: 'POST',
    url: '/api/ai/writing-tool',
    payload: { text: 'Hello', action: 'summarize' },
  });
  assert(resNoAuthAi.statusCode === 401, '6.1: Unauthenticated request to /api/ai/writing-tool returns 401 Unauthorized');

  const resNoAuthAiVerifyKey = await app.inject({
    method: 'POST',
    url: '/api/ai/verify-key',
    payload: { apiKey: 'test_key' },
  });
  assert(resNoAuthAiVerifyKey.statusCode === 401, '6.2: Unauthenticated request to /api/ai/verify-key returns 401 Unauthorized');

  // ── TEST 7: Production Deployment & Hardening Verification
  console.log('\n--- TEST GROUP 7: Production Deployment & Hardening Verification ---');

  // 7.1: Hosted production rejects local-token bypass with 403 Forbidden
  const savedNodeEnv = process.env.NODE_ENV;
  const savedElectron = process.env.ELECTRON_RUN;
  const savedLocalDev = process.env.LOCAL_DEV;

  process.env.NODE_ENV = 'production';
  delete process.env.ELECTRON_RUN;
  delete process.env.LOCAL_DEV;

  const resHostedLocalToken = await app.inject({
    method: 'POST',
    url: '/api/auth/local-token',
  });
  assert(resHostedLocalToken.statusCode === 403, '7.1: Hosted production rejects local-token unauthenticated admin issuance with 403 Forbidden');

  // 7.2: Request from non-loopback IP rejected with 403 Forbidden
  process.env.ELECTRON_RUN = 'true';
  const resRemoteIpLocalToken = await app.inject({
    method: 'POST',
    url: '/api/auth/local-token',
    remoteAddress: '203.0.113.195',
  });
  assert(resRemoteIpLocalToken.statusCode === 403, '7.2: Non-loopback remote IP rejected from accessing local-token');

  // 7.3: Legitimate local desktop environment can obtain session token
  const resDesktopLocalToken = await app.inject({
    method: 'POST',
    url: '/api/auth/local-token',
    remoteAddress: '127.0.0.1',
  });
  const desktopBody = resDesktopLocalToken.json();
  assert(resDesktopLocalToken.statusCode === 200 && Boolean(desktopBody.token), '7.3: Legitimate local desktop environment (ELECTRON_RUN) can obtain session token');

  // Restore env
  process.env.NODE_ENV = savedNodeEnv;
  if (savedElectron) process.env.ELECTRON_RUN = savedElectron; else delete process.env.ELECTRON_RUN;
  if (savedLocalDev) process.env.LOCAL_DEV = savedLocalDev; else delete process.env.LOCAL_DEV;

  // 7.4 - 7.7: CORS Protection Tests using standardized config resolver
  const trustedFrontend = 'https://farmers-market-procurement.vercel.app';
  const { getAllowedOrigins, isOriginAllowed } = await import('../config/cors.js');
  const allowedOriginsList = getAllowedOrigins({
    nodeEnv: 'production',
    isDesktop: false,
    clientUrl: trustedFrontend,
  });

  const corsApp = fastify();
  const corsPlugin = (await import('@fastify/cors')).default;
  await corsApp.register(corsPlugin, {
    origin: (origin, cb) => {
      if (isOriginAllowed(origin, allowedOriginsList)) {
        cb(null, true);
        return;
      }
      cb(null, false);
    },
    credentials: true,
  });
  corsApp.get('/test-cors', async () => ({ status: 'ok' }));
  await corsApp.ready();

  const resUntrustedVercel = await corsApp.inject({
    method: 'GET',
    url: '/test-cors',
    headers: { origin: 'https://attacker-preview.vercel.app' },
  });
  assert(!resUntrustedVercel.headers['access-control-allow-origin'], '7.4: CORS rejects untrusted arbitrary vercel.app preview origin');

  const resUntrustedExternal = await corsApp.inject({
    method: 'GET',
    url: '/test-cors',
    headers: { origin: 'https://evil-site.com' },
  });
  assert(!resUntrustedExternal.headers['access-control-allow-origin'], '7.5: CORS rejects arbitrary external origin');

  const resTrustedFrontend = await corsApp.inject({
    method: 'GET',
    url: '/test-cors',
    headers: { origin: trustedFrontend },
  });
  assert(resTrustedFrontend.headers['access-control-allow-origin'] === trustedFrontend, '7.6: CORS accepts configured CLIENT_URL');

  const resNoOrigin = await corsApp.inject({
    method: 'GET',
    url: '/test-cors',
  });
  assert(resNoOrigin.statusCode === 200, '7.7: Request without Origin header allowed');
  await corsApp.close();

  // 7.8 - 7.10: DATA_DIR Storage Paths Verification
  const { getDataDir, getDatabasePath, getVaultDir, getBackupDir } = await import('../config/paths.js');
  const tempCustomDataDir = path.resolve(process.cwd(), 'temp_test_data_dir');
  process.env.DATA_DIR = tempCustomDataDir;

  const resolvedDataDir = getDataDir();
  const resolvedDbPath = getDatabasePath();
  const resolvedVault = getVaultDir('test_user_777');
  const resolvedBackup = getBackupDir();

  assert(resolvedDataDir === tempCustomDataDir, '7.8: DATA_DIR correctly overrides data storage directory');
  assert(resolvedVault.startsWith(tempCustomDataDir), '7.9: User vault path resolves inside configured DATA_DIR');
  assert(resolvedBackup.startsWith(tempCustomDataDir), '7.10: Database backup path resolves inside configured DATA_DIR');

  // Clean up temp test data dir
  delete process.env.DATA_DIR;
  try {
    if (fs.existsSync(tempCustomDataDir)) {
      fs.rmSync(tempCustomDataDir, { recursive: true, force: true });
    }
  } catch (_) {}

  await app.close();
  const { closeDb } = await import('../db/connection.js');
  await closeDb();

  try {
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  } catch (_) {}

  console.log(`\n=== KẾT QUẢ KIỂM THỬ: ${passed} ĐẠT, ${failed} THẤT BẠI ===\n`);
  if (failed > 0) {
    process.exit(1);
  }
}

runSecurityTests().catch((err) => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
