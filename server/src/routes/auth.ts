import { FastifyInstance } from 'fastify';
import * as argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/connection.js';
import { verifyToken, requireRole } from '../middleware/auth.js';
import { getJwtSecret } from '../config/auth.js';

export default async function authRoutes(fastify: FastifyInstance) {
  fastify.post('/register', { preHandler: requireRole('admin') }, async (request, reply) => {
    const { email, password, full_name, role } = request.body as any;
    const db = getDb();
    
    try {
      const hash = await argon2.hash(password);
      const id = uuidv4();
      const now = new Date().toISOString();
      
      db.prepare(`
        INSERT INTO users (id, email, full_name, password_hash, role, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(id, email, full_name, hash, role || 'staff', now, now);
      
      reply.code(201).send({ id, email, full_name, role });
    } catch (err: any) {
      reply.code(400).send({ error: 'Registration failed', details: err.message });
    }
  });

  fastify.post('/login', {
    config: {
      rateLimit: {
        max: 5,
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
    
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(cleanEmail) as any;
    if (!user || user.is_active === 0) {
      return reply.code(401).send({ error: 'Invalid credentials' });
    }
    
    const isValid = await argon2.verify(user.password_hash, password);
    if (!isValid) {
      return reply.code(401).send({ error: 'Invalid credentials' });
    }
    
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role, full_name: user.full_name }, getJwtSecret(), { expiresIn: '1h' });
    const refreshToken = uuidv4();
    
    db.prepare(`
      INSERT INTO sessions (id, user_id, refresh_token_hash, created_at)
      VALUES (?, ?, ?, ?)
    `).run(uuidv4(), user.id, await argon2.hash(refreshToken), new Date().toISOString());
    
    reply.setCookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/api/auth/refresh'
    });
    
    const userPayload = { id: user.id, email: user.email, role: user.role, full_name: user.full_name };
    return {
      success: true,
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
    const sessions = db.prepare('SELECT * FROM sessions ORDER BY created_at DESC LIMIT 50').all() as any[];
    
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

    const user = db.prepare('SELECT id, email, role, full_name, is_active FROM users WHERE id = ?').get(matchedSession.user_id) as any;
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
        const sessions = db.prepare('SELECT * FROM sessions ORDER BY created_at DESC LIMIT 50').all() as any[];
        for (const session of sessions) {
          if (await argon2.verify(session.refresh_token_hash, refreshToken)) {
            db.prepare('DELETE FROM sessions WHERE id = ?').run(session.id);
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
}
