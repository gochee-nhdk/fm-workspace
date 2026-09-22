import { FastifyInstance } from 'fastify';
import { getDb } from '../db/connection.js';
import { verifyToken, requireRole } from '../middleware/auth.js';
import { auditLog } from '../middleware/audit.js';
import { v4 as uuidv4 } from 'uuid';
import * as argon2 from 'argon2';
import { geminiService } from '../ai/gemini.js';

export default async function settingsRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', verifyToken);

  /**
   * 1. GET /: Get all system settings (excluding Gemini key)
   */
  fastify.get('/', async (request: any, reply) => {
    const data = getDb().prepare("SELECT * FROM system_settings WHERE key != 'gemini_api_key' ORDER BY category, key").all();
    return { success: true, data };
  });

  /**
   * 2. PUT /: Bulk update settings
   */
  fastify.put('/', { preHandler: requireRole('admin') }, async (request: any, reply) => {
    const { settings } = request.body as { settings: Array<{ key: string; value: string }> };
    if (!Array.isArray(settings)) {
      return reply.code(400).send({ error: 'Settings array is required' });
    }

    const db = getDb();
    const updateStmt = db.prepare('UPDATE system_settings SET value = ?, updated_by = ?, updated_at = ? WHERE key = ?');
    const now = new Date().toISOString();
    const userId = request.user?.id || 'admin';

    db.transaction(() => {
      for (const item of settings) {
        if (item.key !== 'gemini_api_key') {
          updateStmt.run(String(item.value), userId, now, item.key);
        }
      }
    })();

    auditLog(request, 'UPDATE_SETTINGS', 'system_settings', null, null, settings);
    return { success: true, message: 'Cài đặt đã được cập nhật thành công.' };
  });

  /**
   * 3. GET /gemini-status & /gemini-key-status: Check if Gemini API key is configured
   */
  const getGeminiStatusHandler = async () => {
    const key = getDb().prepare("SELECT value FROM system_settings WHERE key = 'gemini_api_key'").get() as any;
    const isConfigured = !!(key && key.value && key.value.trim().length > 0) || !!process.env.GEMINI_API_KEY;
    return {
      success: true,
      data: {
        configured: isConfigured,
        maskedKey: isConfigured ? '••••••••••••••••••••' : null
      }
    };
  };

  fastify.get('/gemini-status', getGeminiStatusHandler);
  fastify.get('/gemini-key-status', getGeminiStatusHandler);

  /**
   * 4. PUT /gemini-key: Update Gemini API key and reinitialize service
   */
  fastify.put('/gemini-key', { preHandler: requireRole('admin') }, async (request: any, reply) => {
    const { api_key } = request.body || {};
    if (!api_key || typeof api_key !== 'string') {
      return reply.code(400).send({ success: false, message: 'Vui lòng cung cấp khóa API Gemini hợp lệ.' });
    }

    const db = getDb();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO system_settings (id, key, value, category, updated_by, updated_at)
      VALUES (?, 'gemini_api_key', ?, 'ai', ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_by = excluded.updated_by,
        updated_at = excluded.updated_at
    `).run(uuidv4(), api_key.trim(), request.user?.id || 'admin', now);

    // Reinitialize Gemini AI client immediately
    geminiService.initClient();
    auditLog(request, 'UPDATE_GEMINI_KEY', 'system_settings', 'gemini_api_key', null, { masked: 'Updated' });

    return { success: true, message: 'Đã lưu và kích hoạt Gemini API Key thành công.' };
  });

  /**
   * 5. GET /users: List users
   */
  fastify.get('/users', { preHandler: requireRole('admin') }, async (request: any, reply) => {
    const users = getDb().prepare('SELECT id, email, full_name, role, is_active, created_at, updated_at FROM users ORDER BY created_at ASC').all();
    return { success: true, data: users };
  });

  /**
   * 6. POST /users: Create a new system user
   */
  fastify.post('/users', { preHandler: requireRole('admin') }, async (request: any, reply) => {
    const { email, full_name, password, role } = request.body || {};
    if (!email || !password || !full_name) {
      return reply.code(400).send({ success: false, message: 'Vui lòng điền đầy đủ email, họ tên và mật khẩu.' });
    }

    const db = getDb();
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      return reply.code(400).send({ success: false, message: 'Email này đã được sử dụng trong hệ thống.' });
    }

    const id = uuidv4();
    const now = new Date().toISOString();
    const passwordHash = await argon2.hash(password);

    db.prepare(`
      INSERT INTO users (id, email, full_name, password_hash, role, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 1, ?, ?)
    `).run(id, email.toLowerCase().trim(), full_name.trim(), passwordHash, role || 'staff', now, now);

    auditLog(request, 'CREATE_USER', 'users', id, null, { email, role });
    return { success: true, data: { id, message: 'Đã tạo tài khoản người dùng thành công.' } };
  });

  /**
   * 7. PUT /users/:id: Update user role / status
   */
  fastify.put('/users/:id', { preHandler: requireRole('admin') }, async (request: any, reply) => {
    const { full_name, role, is_active, password } = request.body || {};
    const { id } = request.params;
    const db = getDb();
    const now = new Date().toISOString();

    const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as any;
    if (!existing) {
      return reply.code(404).send({ success: false, message: 'Không tìm thấy người dùng.' });
    }

    let passwordHash = existing.password_hash;
    if (password && password.trim().length >= 6) {
      passwordHash = await argon2.hash(password.trim());
    }

    db.prepare(`
      UPDATE users
      SET full_name = COALESCE(?, full_name),
          role = COALESCE(?, role),
          is_active = COALESCE(?, is_active),
          password_hash = ?,
          updated_at = ?
      WHERE id = ?
    `).run(
      full_name || null,
      role || null,
      is_active !== undefined ? Number(is_active) : null,
      passwordHash,
      now,
      id
    );

    auditLog(request, 'UPDATE_USER', 'users', id, existing, { role, is_active });
    return { success: true, message: 'Đã cập nhật thông tin người dùng.' };
  });
}
