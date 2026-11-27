const crypto = require('crypto');
const { z } = require('zod');
const { getDb } = require('../_lib/db');
const { encryptSecret, decryptSecret, maskSecret } = require('../_lib/crypto');
const { sendError, parseZodError, verifyAuth } = require('../_lib/http');

const GEMINI_POOL_KEY = 'gemini_api_keys_pool';
const GEMINI_SINGLE_KEY = 'gemini_api_key';

const poolItemSchema = z.object({
  id: z.string().optional(),
  name: z.string().max(120).optional(),
  key: z.string().max(500).optional(),
  provider: z.string().max(50).optional(),
  isActive: z.boolean().optional(),
  status: z.string().max(50).optional(),
  statusMessage: z.string().max(500).optional(),
  model: z.string().max(120).optional(),
  lastCheckedAt: z.string().max(100).optional(),
});

const putPoolSchema = z.object({
  pool: z.array(poolItemSchema).max(50),
});

const putSingleKeySchema = z.object({
  api_key: z.string().trim().min(1, 'Vui lòng cung cấp khóa API Gemini hợp lệ.').max(500),
});

async function getUserSetting(userId, settingKey) {
  const db = await getDb();
  const res = await db.execute({
    sql: 'SELECT encrypted_value FROM user_settings WHERE user_id = ? AND setting_key = ? LIMIT 1',
    args: [userId, settingKey],
  });
  const row = res.rows[0];
  if (!row || !row.encrypted_value) return null;
  try {
    return decryptSecret(row.encrypted_value);
  } catch (_) {
    return null;
  }
}

async function setUserSetting(userId, settingKey, plaintextValue) {
  const db = await getDb();
  const encrypted = encryptSecret(plaintextValue);
  const now = new Date().toISOString();
  await db.execute({
    sql: `INSERT INTO user_settings (id, user_id, setting_key, encrypted_value, updated_at)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(user_id, setting_key) DO UPDATE SET
            encrypted_value = excluded.encrypted_value,
            updated_at = excluded.updated_at`,
    args: [crypto.randomUUID(), userId, settingKey, encrypted, now],
  });
}

async function getUserGeminiPool(userId) {
  const raw = await getUserSetting(userId, GEMINI_POOL_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    } catch (_) {}
  }
  const single = await getUserSetting(userId, GEMINI_SINGLE_KEY);
  if (single && single.trim()) {
    return [
      {
        id: 'key_primary',
        name: 'Khóa chính (Mặc định)',
        key: single.trim(),
        isActive: true,
        status: 'unchecked',
        model: 'gemini-2.0-flash',
        lastCheckedAt: new Date().toISOString(),
      },
    ];
  }
  return [];
}

async function getUserGeminiKeysList(userId) {
  if (!userId) return [];
  try {
    const pool = await getUserGeminiPool(userId);
    return pool
      .filter((k) => k && k.isActive !== false && typeof k.key === 'string' && k.key.trim() && !k.key.includes('••••'))
      .map((k) => k.key.trim());
  } catch (_) {
    return [];
  }
}

async function handleSettingsRoute(req, res, pathname) {
  const auth = await verifyAuth(req);
  if (!auth.valid) {
    return sendError(res, 401, 'Unauthorized', auth.error || 'Yêu cầu đăng nhập để quản lý cài đặt API Key.');
  }
  const userId = auth.user.id;

  // GET /settings/gemini-keys-pool
  if (pathname === '/settings/gemini-keys-pool' && req.method === 'GET') {
    const pool = await getUserGeminiPool(userId);
    const maskedPool = pool.map((item) => ({
      ...item,
      key: item.key ? maskSecret(item.key, 6, 4) : '',
      rawKeyPreview: item.key ? `${item.key.substring(0, 8)}...` : '',
    }));
    return res.status(200).json({ success: true, data: maskedPool });
  }

  // PUT /settings/gemini-keys-pool
  if (pathname === '/settings/gemini-keys-pool' && req.method === 'PUT') {
    const parsed = putPoolSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return sendError(res, 400, 'ValidationError', parseZodError(parsed.error));
    }

    const existingPool = await getUserGeminiPool(userId);
    const existingMap = new Map();
    existingPool.forEach((item) => {
      if (item.id && item.key) existingMap.set(item.id, item.key);
    });

    const now = new Date().toISOString();
    const sanitizedPool = parsed.data.pool.map((item, idx) => {
      let finalKey = (item.key || '').trim();
      if (finalKey.includes('••••') && item.id && existingMap.has(item.id)) {
        finalKey = existingMap.get(item.id);
      }
      return {
        id: item.id || `key_${Date.now()}_${idx}`,
        name: item.name || (idx === 0 ? 'Khóa chính' : `Khóa dự phòng #${idx}`),
        key: finalKey,
        provider: item.provider,
        isActive: item.isActive !== false,
        status: item.status || 'unchecked',
        statusMessage: item.statusMessage || '',
        model: item.model || 'gemini-2.0-flash',
        lastCheckedAt: item.lastCheckedAt || now,
      };
    });

    await setUserSetting(userId, GEMINI_POOL_KEY, JSON.stringify(sanitizedPool));
    const activePrimary = sanitizedPool.find((k) => k.isActive && k.key && !k.key.includes('••••'));
    if (activePrimary) {
      await setUserSetting(userId, GEMINI_SINGLE_KEY, activePrimary.key);
    }

    return res.status(200).json({
      success: true,
      message: 'Đã cập nhật danh sách Khóa API Gemini thành công.',
    });
  }

  // PUT /settings/gemini-key
  if (pathname === '/settings/gemini-key' && req.method === 'PUT') {
    const parsed = putSingleKeySchema.safeParse(req.body || {});
    if (!parsed.success) {
      return sendError(res, 400, 'ValidationError', parseZodError(parsed.error));
    }

    const apiKey = parsed.data.api_key;
    if (!apiKey.includes('••••')) {
      await setUserSetting(userId, GEMINI_SINGLE_KEY, apiKey);
      const existingPool = await getUserGeminiPool(userId);
      const now = new Date().toISOString();
      if (existingPool.length === 0) {
        existingPool.push({
          id: 'key_primary',
          name: 'Khóa chính (Mặc định)',
          key: apiKey,
          isActive: true,
          status: 'active',
          model: 'gemini-2.0-flash',
          lastCheckedAt: now,
        });
      } else {
        existingPool[0] = { ...existingPool[0], key: apiKey, lastCheckedAt: now };
      }
      await setUserSetting(userId, GEMINI_POOL_KEY, JSON.stringify(existingPool));
    }

    return res.status(200).json({
      success: true,
      message: 'Đã lưu khóa API Gemini thành công.',
    });
  }

  return sendError(res, 404, 'NotFound', `Endpoint ${pathname} không tồn tại`);
}

module.exports = {
  handleSettingsRoute,
  getUserGeminiKeysList,
};
