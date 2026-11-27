const crypto = require('crypto');
const { z } = require('zod');
const { getDb, isHostedEnvironment, getDbMode } = require('../_lib/db');
const {
  hashPassword,
  verifyPassword,
  dummyPasswordCheck,
  signJwt,
  hashToken,
} = require('../_lib/crypto');
const {
  sendError,
  parseZodError,
  getClientIp,
  isLoopbackIp,
  verifyAuth,
} = require('../_lib/http');

const registerSchema = z.object({
  email: z.string().trim().email('Định dạng email không hợp lệ').max(254),
  password: z.string().min(6, 'Mật khẩu phải chứa ít nhất 6 ký tự để đảm bảo an toàn').max(200),
  full_name: z.string().trim().max(120).optional(),
});

const loginSchema = z.object({
  email: z.string().trim().email('Định dạng email không hợp lệ').max(254),
  password: z.string().min(1, 'Email và mật khẩu không được để trống').max(200),
});

const googleSchema = z.object({
  credential: z.string().min(10, 'Mã xác thực Google không hợp lệ'),
});

const quickProfileSchema = z.object({
  email: z.string().trim().email('Email không hợp lệ. Vui lòng nhập đúng định dạng email.').max(254),
  full_name: z.string().trim().max(120).optional(),
  avatar_url: z.string().trim().max(1000).optional(),
});

function formatUserPayload(row) {
  return {
    id: row.id,
    email: row.email,
    role: row.role || 'staff',
    full_name: row.full_name,
    avatar_url: row.avatar_url || null,
    google_id: row.google_id || null,
  };
}

async function handleAuthRoute(req, res, pathname) {
  // POST /auth/register
  if (pathname === '/auth/register' && req.method === 'POST') {
    const parsed = registerSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return sendError(res, 400, 'ValidationError', parseZodError(parsed.error));
    }

    const cleanEmail = parsed.data.email.toLowerCase();
    const db = await getDb();
    const existingRes = await db.execute({
      sql: 'SELECT id, password_hash FROM users WHERE email = ? LIMIT 1',
      args: [cleanEmail],
    });
    const existing = existingRes.rows[0];

    if (existing && existing.password_hash) {
      return sendError(
        res,
        409,
        'Conflict',
        'Email này đã có tài khoản. Vui lòng chuyển sang tab Đăng Nhập.'
      );
    }

    const name =
      parsed.data.full_name && parsed.data.full_name.length > 0
        ? parsed.data.full_name
        : cleanEmail.split('@')[0];
    const avatarUrl = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}&backgroundColor=10b981,0ea5e9,6366f1&textColor=ffffff`;
    const now = new Date().toISOString();
    const pwHash = hashPassword(parsed.data.password);
    const assignedRole = 'staff';

    let userId;
    if (existing) {
      userId = existing.id;
      await db.execute({
        sql: `UPDATE users
              SET password_hash = ?, full_name = COALESCE(?, full_name), avatar_url = COALESCE(?, avatar_url), updated_at = ?
              WHERE id = ?`,
        args: [pwHash, name, avatarUrl, now, userId],
      });
    } else {
      userId = crypto.randomUUID();
      await db.execute({
        sql: `INSERT INTO users (id, email, full_name, password_hash, role, avatar_url, is_active, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
        args: [userId, cleanEmail, name, pwHash, assignedRole, avatarUrl, now, now],
      });
    }

    const userPayload = {
      id: userId,
      email: cleanEmail,
      role: assignedRole,
      full_name: name,
      avatar_url: avatarUrl,
      google_id: null,
    };
    const token = signJwt({
      id: userId,
      email: cleanEmail,
      role: assignedRole,
      full_name: name,
      avatar_url: avatarUrl,
    });

    return res.status(201).json({
      success: true,
      message: 'Đăng ký tài khoản thành công',
      token,
      user: userPayload,
      data: { token, user: userPayload },
    });
  }

  // POST /auth/login
  if (pathname === '/auth/login' && req.method === 'POST') {
    const parsed = loginSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return sendError(res, 400, 'ValidationError', parseZodError(parsed.error));
    }

    const cleanEmail = parsed.data.email.toLowerCase();
    const db = await getDb();
    const userRes = await db.execute({
      sql: 'SELECT * FROM users WHERE email = ? LIMIT 1',
      args: [cleanEmail],
    });
    const user = userRes.rows[0];

    if (!user || Number(user.is_active) === 0) {
      dummyPasswordCheck(parsed.data.password);
      return sendError(res, 401, 'Unauthorized', 'Email hoặc mật khẩu không chính xác');
    }

    if (!user.password_hash) {
      const newHash = hashPassword(parsed.data.password);
      await db.execute({
        sql: 'UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?',
        args: [newHash, new Date().toISOString(), user.id],
      });
    } else if (!verifyPassword(parsed.data.password, user.password_hash)) {
      return sendError(res, 401, 'Unauthorized', 'Email hoặc mật khẩu không chính xác');
    }

    const userPayload = formatUserPayload(user);
    const token = signJwt({
      id: user.id,
      email: user.email,
      role: user.role,
      full_name: user.full_name,
      avatar_url: user.avatar_url || null,
    });

    return res.status(200).json({
      success: true,
      message: 'Đăng nhập thành công',
      token,
      user: userPayload,
      data: { token, user: userPayload },
    });
  }

  // POST /auth/google
  if (pathname === '/auth/google' && req.method === 'POST') {
    const parsed = googleSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return sendError(res, 400, 'ValidationError', parseZodError(parsed.error));
    }

    let googleProfile = null;
    try {
      const verifyRes = await fetch(
        `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(parsed.data.credential)}`,
        { signal: AbortSignal.timeout(6000) }
      );
      if (verifyRes.ok) {
        const data = await verifyRes.json();
        if (data.email && data.sub && (data.email_verified === true || data.email_verified === 'true')) {
          googleProfile = {
            sub: String(data.sub),
            email: String(data.email).toLowerCase().trim(),
            name: data.name || String(data.email).split('@')[0],
            picture: data.picture || null,
          };
        }
      }
    } catch (_) {
      googleProfile = null;
    }

    if (!googleProfile || !googleProfile.email) {
      return sendError(
        res,
        401,
        'Unauthorized',
        'Không thể xác thực danh tính với Google. Vui lòng kiểm tra lại tài khoản hoặc kết nối mạng.'
      );
    }

    const db = await getDb();
    const now = new Date().toISOString();
    const existingRes = await db.execute({
      sql: 'SELECT * FROM users WHERE email = ? OR google_id = ? LIMIT 1',
      args: [googleProfile.email, googleProfile.sub],
    });
    let user = existingRes.rows[0];

    if (user) {
      await db.execute({
        sql: `UPDATE users
              SET google_id = ?, avatar_url = COALESCE(?, avatar_url), full_name = COALESCE(?, full_name), updated_at = ?
              WHERE id = ?`,
        args: [googleProfile.sub, googleProfile.picture, googleProfile.name, now, user.id],
      });
      const updatedRes = await db.execute({
        sql: 'SELECT * FROM users WHERE id = ? LIMIT 1',
        args: [user.id],
      });
      user = updatedRes.rows[0];
    } else {
      const newId = crypto.randomUUID();
      await db.execute({
        sql: `INSERT INTO users (id, email, full_name, role, google_id, avatar_url, is_active, created_at, updated_at)
              VALUES (?, ?, ?, 'staff', ?, ?, 1, ?, ?)`,
        args: [newId, googleProfile.email, googleProfile.name, googleProfile.sub, googleProfile.picture, now, now],
      });
      const createdRes = await db.execute({
        sql: 'SELECT * FROM users WHERE id = ? LIMIT 1',
        args: [newId],
      });
      user = createdRes.rows[0];
    }

    if (Number(user.is_active) === 0) {
      return sendError(res, 401, 'Unauthorized', 'Tài khoản đã bị vô hiệu hóa.');
    }

    const userPayload = formatUserPayload(user);
    const token = signJwt({
      id: user.id,
      email: user.email,
      role: user.role,
      full_name: user.full_name,
      avatar_url: user.avatar_url || null,
    });

    return res.status(200).json({
      success: true,
      token,
      user: userPayload,
      data: { token, user: userPayload },
    });
  }

  // POST /auth/quick-profile (Strictly restricted to local dev loopback)
  if (pathname === '/auth/quick-profile' && req.method === 'POST') {
    const isDesktop = process.env.ELECTRON_RUN === 'true';
    const isLocalDev = process.env.LOCAL_DEV === 'true' && process.env.NODE_ENV !== 'production';
    const hosted = isHostedEnvironment() || getDbMode() === 'turso';
    const clientIp = getClientIp(req);
    const loopback = isLoopbackIp(clientIp);

    if (hosted || (!isDesktop && !isLocalDev) || !loopback) {
      return sendError(
        res,
        403,
        'Forbidden',
        'Endpoint đăng nhập nhanh không khả dụng trên môi trường mạng công khai. Vui lòng đăng nhập bằng tài khoản và mật khẩu.'
      );
    }

    const parsed = quickProfileSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return sendError(res, 400, 'ValidationError', parseZodError(parsed.error));
    }

    const cleanEmail = parsed.data.email.toLowerCase();
    const name =
      parsed.data.full_name && parsed.data.full_name.length > 0
        ? parsed.data.full_name
        : cleanEmail.split('@')[0];
    const now = new Date().toISOString();

    const db = await getDb();
    const existingRes = await db.execute({
      sql: 'SELECT * FROM users WHERE email = ? LIMIT 1',
      args: [cleanEmail],
    });
    let user = existingRes.rows[0];

    if (user) {
      if (user.password_hash || user.role === 'admin') {
        return sendError(
          res,
          403,
          'Forbidden',
          'Tài khoản này có mật khẩu bảo vệ hoặc quyền quản trị viên. Vui lòng đăng nhập bằng mật khẩu.'
        );
      }
      if (Number(user.is_active) === 0) {
        return sendError(res, 401, 'Unauthorized', 'Tài khoản đã bị vô hiệu hóa.');
      }
      await db.execute({
        sql: `UPDATE users
              SET full_name = COALESCE(?, full_name), avatar_url = COALESCE(?, avatar_url), updated_at = ?
              WHERE id = ?`,
        args: [name, parsed.data.avatar_url || null, now, user.id],
      });
      const updatedRes = await db.execute({
        sql: 'SELECT * FROM users WHERE id = ? LIMIT 1',
        args: [user.id],
      });
      user = updatedRes.rows[0];
    } else {
      const newId = crypto.randomUUID();
      await db.execute({
        sql: `INSERT INTO users (id, email, full_name, role, avatar_url, is_active, created_at, updated_at)
              VALUES (?, ?, ?, 'staff', ?, 1, ?, ?)`,
        args: [newId, cleanEmail, name, parsed.data.avatar_url || null, now, now],
      });
      const createdRes = await db.execute({
        sql: 'SELECT * FROM users WHERE id = ? LIMIT 1',
        args: [newId],
      });
      user = createdRes.rows[0];
    }

    const userPayload = formatUserPayload(user);
    const token = signJwt({
      id: user.id,
      email: user.email,
      role: user.role,
      full_name: user.full_name,
      avatar_url: user.avatar_url || null,
    });

    return res.status(200).json({
      success: true,
      token,
      user: userPayload,
      data: { token, user: userPayload },
    });
  }

  // POST /auth/logout
  if (pathname === '/auth/logout' && req.method === 'POST') {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7).trim();
      if (token) {
        try {
          const auth = await verifyAuth(req);
          const db = await getDb();
          const tokenHash = hashToken(token);
          const expiresAt = auth.user?.exp
            ? new Date(auth.user.exp * 1000).toISOString()
            : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
          await db.execute({
            sql: `INSERT OR IGNORE INTO revoked_tokens (token_hash, user_id, expires_at, created_at)
                  VALUES (?, ?, ?, ?)`,
            args: [tokenHash, auth.user?.id || null, expiresAt, new Date().toISOString()],
          });
        } catch (_) {}
      }
    }
    return res.status(200).json({
      success: true,
      message: 'Đăng xuất thành công',
    });
  }

  // GET /auth/me
  if (pathname === '/auth/me' && req.method === 'GET') {
    const auth = await verifyAuth(req);
    if (!auth.valid) {
      return sendError(res, 401, 'Unauthorized', auth.error || 'Chưa đăng nhập');
    }

    const db = await getDb();
    const userRes = await db.execute({
      sql: 'SELECT id, email, full_name, role, avatar_url, google_id, is_active FROM users WHERE id = ? LIMIT 1',
      args: [auth.user.id],
    });
    const user = userRes.rows[0];
    if (!user || Number(user.is_active) === 0) {
      return sendError(res, 401, 'Unauthorized', 'Tài khoản không tồn tại hoặc đã bị vô hiệu hóa');
    }

    const userPayload = formatUserPayload(user);
    return res.status(200).json({
      success: true,
      user: userPayload,
      data: userPayload,
    });
  }

  return sendError(res, 404, 'NotFound', `Endpoint ${pathname} không tồn tại`);
}

module.exports = { handleAuthRoute };
