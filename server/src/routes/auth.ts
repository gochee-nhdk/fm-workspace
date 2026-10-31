import { FastifyInstance } from 'fastify';
import * as argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/connection.js';
import { verifyToken, requireRole } from '../middleware/auth.js';
import { getJwtSecret } from '../config/auth.js';

export default async function authRoutes(fastify: FastifyInstance) {
  fastify.post('/register', async (request, reply) => {
    const { email, password, full_name, role } = (request.body || {}) as any;
    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
      return reply.code(400).send({ error: 'Email và mật khẩu không được để trống' });
    }
    const cleanEmail = email.toLowerCase().trim();
    if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      return reply.code(400).send({ error: 'Định dạng email không hợp lệ' });
    }
    if (password.length < 6) {
      return reply.code(400).send({ error: 'Mật khẩu phải chứa ít nhất 6 ký tự để đảm bảo an toàn' });
    }

    const db = getDb();
    const existing = (await db.prepare('SELECT * FROM users WHERE email = ?').get(cleanEmail)) as any;
    if (existing && existing.password_hash) {
      return reply.code(409).send({ error: 'Email này đã có tài khoản. Vui lòng chuyển sang tab Đăng Nhập.' });
    }

    const assignedRole = (request as any).user?.role === 'admin' && role ? role : 'staff';
    const name = (full_name && typeof full_name === 'string' && full_name.trim()) 
      ? full_name.trim() 
      : cleanEmail.split('@')[0];
    const avatarUrl = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}&backgroundColor=10b981,0ea5e9,6366f1&textColor=ffffff`;
    const now = new Date().toISOString();

    try {
      const hash = await argon2.hash(password);
      let userId: string;

      if (existing) {
        userId = existing.id;
        await db.prepare(`
          UPDATE users 
          SET password_hash = ?, full_name = COALESCE(?, full_name), avatar_url = COALESCE(?, avatar_url), updated_at = ?
          WHERE id = ?
        `).run(hash, name, avatarUrl, now, userId);
      } else {
        userId = uuidv4();
        await db.prepare(`
          INSERT INTO users (id, email, full_name, password_hash, role, avatar_url, is_active, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
        `).run(userId, cleanEmail, name, hash, assignedRole, avatarUrl, now, now);
      }

      const userPayload = {
        id: userId,
        email: cleanEmail,
        role: assignedRole,
        full_name: name,
        avatar_url: avatarUrl,
      };

      const token = jwt.sign(
        { id: userId, email: cleanEmail, role: assignedRole, full_name: name, avatar_url: avatarUrl },
        getJwtSecret(),
        { expiresIn: '30d' }
      );

      reply.code(201).send({
        success: true,
        message: 'Đăng ký tài khoản thành công',
        token,
        user: userPayload,
        data: { token, user: userPayload },
      });
    } catch (err: any) {
      reply.code(400).send({ error: 'Đăng ký tài khoản thất bại', details: err.message });
    }
  });

  fastify.post('/login', {
    config: {
      rateLimit: {
        max: 8,
        timeWindow: '1 minute',
        errorResponseBuilder: () => ({
          statusCode: 429,
          error: 'Too Many Requests',
          message: 'Bạn đã thử đăng nhập quá nhiều lần. Vui lòng đợi 1 phút rồi thử lại để bảo vệ an toàn tài khoản.'
        })
      }
    }
  }, async (request, reply) => {
    const { email, password } = (request.body || {}) as any;
    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
      return reply.code(400).send({ error: 'Email và mật khẩu không được để trống' });
    }
    const cleanEmail = email.toLowerCase().trim();
    const db = getDb();
    const user = (await db.prepare('SELECT * FROM users WHERE email = ?').get(cleanEmail)) as any;
    if (!user || user.is_active === 0) {
      return reply.code(401).send({ error: 'Email hoặc mật khẩu không chính xác' });
    }
    
    // If account was created without password previously (e.g. quick profile migration), set it now
    if (!user.password_hash) {
      const newHash = await argon2.hash(password);
      await db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(
        newHash,
        new Date().toISOString(),
        user.id
      );
    } else {
      const isValid = await argon2.verify(user.password_hash, password);
      if (!isValid) {
        return reply.code(401).send({ error: 'Email hoặc mật khẩu không chính xác' });
      }
    }
    
    const userPayload = {
      id: user.id,
      email: user.email,
      role: user.role,
      full_name: user.full_name,
      avatar_url: user.avatar_url,
      google_id: user.google_id || null,
    };

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, full_name: user.full_name, avatar_url: user.avatar_url },
      getJwtSecret(),
      { expiresIn: '30d' }
    );
    const refreshToken = uuidv4();
    
    await db.prepare(`
      INSERT INTO sessions (id, user_id, refresh_token_hash, created_at)
      VALUES (?, ?, ?, ?)
    `).run(uuidv4(), user.id, await argon2.hash(refreshToken), new Date().toISOString());
    
    reply.setCookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/api/auth/refresh'
    });
    
    return {
      success: true,
      message: 'Đăng nhập thành công',
      token,
      user: userPayload,
      data: {
        token,
        user: userPayload
      }
    };
  });

  fastify.post('/refresh', async (request, reply) => {
    const refreshToken = (request as any).cookies?.refresh_token;
    if (!refreshToken) {
      return reply.code(401).send({ error: 'Unauthorized', message: 'No refresh token provided' });
    }

    const db = getDb();
    const sessions = (await db.prepare('SELECT * FROM sessions ORDER BY created_at DESC LIMIT 50').all()) as any[];
    
    let matchedSession: any = null;
    for (const session of sessions) {
      try {
        if (await argon2.verify(session.refresh_token_hash, refreshToken)) {
          matchedSession = session;
          break;
        }
      } catch (_) {}
    }

    if (!matchedSession) {
      reply.clearCookie('refresh_token', { path: '/api/auth/refresh' });
      return reply.code(401).send({ error: 'Unauthorized', message: 'Invalid or expired session' });
    }

    const user = (await db.prepare('SELECT id, email, role, full_name, is_active FROM users WHERE id = ?').get(matchedSession.user_id)) as any;
    if (!user || user.is_active === 0) {
      reply.clearCookie('refresh_token', { path: '/api/auth/refresh' });
      return reply.code(401).send({ error: 'Unauthorized', message: 'User inactive' });
    }

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role, full_name: user.full_name }, getJwtSecret(), { expiresIn: '1h' });
    const userPayload = { id: user.id, email: user.email, role: user.role, full_name: user.full_name };

    return {
      success: true,
      token,
      user: userPayload,
      data: { token, user: userPayload }
    };
  });

  fastify.post('/logout', async (request, reply) => {
    const refreshToken = (request as any).cookies?.refresh_token;
    if (refreshToken) {
      try {
        const db = getDb();
        const sessions = (await db.prepare('SELECT * FROM sessions ORDER BY created_at DESC LIMIT 50').all()) as any[];
        for (const session of sessions) {
          if (await argon2.verify(session.refresh_token_hash, refreshToken)) {
            await db.prepare('DELETE FROM sessions WHERE id = ?').run(session.id);
            break;
          }
        }
      } catch (_) {}
    }

    reply.clearCookie('refresh_token', { path: '/api/auth/refresh' });
    return { success: true, message: 'Đăng xuất thành công' };
  });

  fastify.get('/me', { preHandler: verifyToken }, async (request, reply) => {
    return {
      success: true,
      user: request.user,
      data: request.user
    };
  });

  // Google OAuth2 Sign-In: Verifies Google ID Token & creates/links local user
  fastify.post('/google', async (request, reply) => {
    const { credential } = (request.body || {}) as { credential?: string };
    if (!credential || typeof credential !== 'string') {
      return reply.code(400).send({ error: 'Mã xác thực Google không hợp lệ' });
    }

    let googleProfile: { sub: string; email: string; name: string; picture?: string } | null = null;

    try {
      // 1. Verify with Google's public tokeninfo endpoint
      const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`, {
        signal: AbortSignal.timeout(6000),
      });
      if (res.ok) {
        const data = (await res.json()) as any;
        if (data.email && data.sub) {
          googleProfile = {
            sub: data.sub,
            email: String(data.email).toLowerCase().trim(),
            name: data.name || String(data.email).split('@')[0],
            picture: data.picture,
          };
        }
      }
    } catch (netErr) {
      // SECURITY HARDENING: Strictly reject unverified credentials.
      // Never fall back to unverified jwt.decode(credential) as it would allow forging arbitrary identities.
      googleProfile = null;
    }

    if (!googleProfile || !googleProfile.email) {
      return reply.code(401).send({ error: 'Không thể xác thực danh tính với Google. Vui lòng kiểm tra lại tài khoản hoặc kết nối mạng.' });
    }

    const db = getDb();
    const now = new Date().toISOString();

    let user = (await db.prepare('SELECT * FROM users WHERE email = ? OR google_id = ?').get(googleProfile.email, googleProfile.sub)) as any;

    if (user) {
      await db.prepare(`
        UPDATE users 
        SET google_id = ?, avatar_url = COALESCE(?, avatar_url), full_name = COALESCE(?, full_name), updated_at = ?
        WHERE id = ?
      `).run(googleProfile.sub, googleProfile.picture || null, googleProfile.name, now, user.id);
      user = (await db.prepare('SELECT * FROM users WHERE id = ?').get(user.id)) as any;
    } else {
      const newId = uuidv4();
      await db.prepare(`
        INSERT INTO users (id, email, full_name, role, google_id, avatar_url, is_active, created_at, updated_at)
        VALUES (?, ?, ?, 'staff', ?, ?, 1, ?, ?)
      `).run(newId, googleProfile.email, googleProfile.name, googleProfile.sub, googleProfile.picture || null, now, now);
      user = (await db.prepare('SELECT * FROM users WHERE id = ?').get(newId)) as any;
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, full_name: user.full_name, avatar_url: user.avatar_url },
      getJwtSecret(),
      { expiresIn: '30d' }
    );

    const userPayload = {
      id: user.id,
      email: user.email,
      role: user.role,
      full_name: user.full_name,
      avatar_url: user.avatar_url,
      google_id: user.google_id,
    };

    return {
      success: true,
      token,
      user: userPayload,
      data: { token, user: userPayload },
    };
  });

  // Quick Profile: Enables local offline personal workspace bootstrap
  // SECURITY GUARD: Strictly restricted to local desktop/electron loopback.
  // Never permits passwordless access to admin accounts or password-protected accounts.
  fastify.post('/quick-profile', async (request, reply) => {
    const isDesktop = process.env.ELECTRON_RUN === 'true';
    const isLocalDev = process.env.LOCAL_DEV === 'true' && process.env.NODE_ENV !== 'production';
    const clientIp = request.ip;
    const isLoopback = clientIp === '127.0.0.1' || clientIp === '::1' || clientIp === '::ffff:127.0.0.1';
    const db = getDb();
    const isHosted = db.isRemote() || process.env.RENDER === 'true' || process.env.HOSTED === 'true' || (!isDesktop && process.env.NODE_ENV === 'production');

    if (isHosted || (!isDesktop && !isLocalDev) || !isLoopback) {
      return reply.code(403).send({
        error: 'Forbidden',
        message: 'Endpoint đăng nhập nhanh không khả dụng trên môi trường mạng công khai. Vui lòng đăng nhập bằng tài khoản và mật khẩu.',
      });
    }

    const { email, full_name, avatar_url } = (request.body || {}) as {
      email?: string;
      full_name?: string;
      avatar_url?: string;
    };

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return reply.code(400).send({ error: 'Email không hợp lệ. Vui lòng nhập đúng định dạng email.' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const name = (full_name && typeof full_name === 'string' && full_name.trim()) 
      ? full_name.trim() 
      : cleanEmail.split('@')[0];

    const now = new Date().toISOString();

    let user = (await db.prepare('SELECT * FROM users WHERE email = ?').get(cleanEmail)) as any;

    if (user) {
      // SECURITY GUARD: Never allow passwordless sign-in for users with a password or admin privileges
      if (user.password_hash || user.role === 'admin') {
        return reply.code(403).send({
          error: 'Forbidden',
          message: 'Tài khoản này có mật khẩu bảo vệ hoặc quyền quản trị viên. Vui lòng đăng nhập bằng mật khẩu.',
        });
      }
      if (user.is_active === 0) {
        return reply.code(401).send({ error: 'Unauthorized', message: 'Tài khoản đã bị vô hiệu hóa.' });
      }

      await db.prepare(`
        UPDATE users 
        SET full_name = COALESCE(?, full_name), avatar_url = COALESCE(?, avatar_url), updated_at = ?
        WHERE id = ?
      `).run(name, avatar_url || null, now, user.id);
      user = (await db.prepare('SELECT * FROM users WHERE id = ?').get(user.id)) as any;
    } else {
      const newId = uuidv4();
      await db.prepare(`
        INSERT INTO users (id, email, full_name, role, avatar_url, is_active, created_at, updated_at)
        VALUES (?, ?, ?, 'staff', ?, 1, ?, ?)
      `).run(newId, cleanEmail, name, avatar_url || null, now, now);
      user = (await db.prepare('SELECT * FROM users WHERE id = ?').get(newId)) as any;
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, full_name: user.full_name, avatar_url: user.avatar_url },
      getJwtSecret(),
      { expiresIn: '30d' }
    );

    const userPayload = {
      id: user.id,
      email: user.email,
      role: user.role,
      full_name: user.full_name,
      avatar_url: user.avatar_url,
      google_id: user.google_id || null,
    };

    return {
      success: true,
      token,
      user: userPayload,
      data: { token, user: userPayload },
    };
  });

  // Local/Offline-first bootstrap session endpoint:
  // Restricted strictly to local desktop/electron runtime. Disabled in hosted deployments.
  fastify.post('/local-token', async (request, reply) => {
    // SECURITY GUARD: Strictly disable in hosted environments and default to deny
    const isDesktop = process.env.ELECTRON_RUN === 'true';
    const isLocalDev = process.env.LOCAL_DEV === 'true' && process.env.NODE_ENV !== 'production';
    const db = getDb();
    const isHosted = db.isRemote() || process.env.RENDER === 'true' || process.env.HOSTED === 'true' || (!isDesktop && process.env.NODE_ENV === 'production');

    if (isHosted || (!isDesktop && !isLocalDev)) {
      return reply.code(403).send({
        error: 'Forbidden',
        message: 'Endpoint cấp token cục bộ bị vô hiệu hóa trên môi trường lưu trữ công khai.',
      });
    }

    // Verify request originates from local loopback address
    const clientIp = request.ip;
    const isLoopback = clientIp === '127.0.0.1' || clientIp === '::1' || clientIp === '::ffff:127.0.0.1';
    if (!isLoopback) {
      return reply.code(403).send({
        error: 'Forbidden',
        message: 'Endpoint chỉ cho phép truy cập từ địa chỉ nội bộ (loopback).',
      });
    }

    const user = (await db.prepare(`
      SELECT id, email, role, full_name, is_active FROM users 
      WHERE role = 'admin' AND is_active = 1 
      ORDER BY created_at ASC LIMIT 1
    `).get()) as any;

    if (!user) {
      return reply.code(404).send({ error: 'No admin user configured' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, full_name: user.full_name },
      getJwtSecret(),
      { expiresIn: '30d' }
    );

    const userPayload = { id: user.id, email: user.email, role: user.role, full_name: user.full_name };
    return {
      success: true,
      token,
      user: userPayload,
      data: { token, user: userPayload }
    };
  });
}
