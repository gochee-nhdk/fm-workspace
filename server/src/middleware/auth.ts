import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import jwt from 'jsonwebtoken';
import { getDb } from '../db/connection.js';
import { getJwtSecret } from '../config/auth.js';

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  full_name: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthUser;
  }
}

export async function verifyToken(request: FastifyRequest, reply: FastifyReply) {
  try {
    let token: string | undefined;
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }

    if (!token) {
      // In local-first / offline-first desktop mode (when not hosted and not running tests),
      // strictly verify both loopback IP and trusted local host to prevent DNS rebinding / host spoofing
      const isLoopbackIp = request.ip === '127.0.0.1' || request.ip === '::1' || request.ip === '::ffff:127.0.0.1';
      const cleanHost = (request.hostname || '').split(':')[0].toLowerCase();
      const isLoopbackHost = cleanHost === 'localhost' || cleanHost === '127.0.0.1';
      const isLocalHost = isLoopbackIp && isLoopbackHost;
      const isTestEnv = process.env.NODE_ENV === 'test' || process.env.DATABASE_PATH?.includes('test_security');
      const db = getDb();
      const isHosted = db.isRemote() || process.env.APP_ENV === 'hosted' || (process.env.NODE_ENV === 'production' && !process.env.ELECTRON_RUN_AS_NODE);
      
      if (!isHosted && !isTestEnv && isLocalHost) {
        const localAdmin = (await db.prepare(`
          SELECT id, email, role, full_name, is_active FROM users 
          WHERE role = 'admin' AND is_active = 1 
          ORDER BY created_at ASC LIMIT 1
        `).get()) as any;

        if (localAdmin) {
          request.user = {
            id: localAdmin.id,
            email: localAdmin.email,
            role: localAdmin.role,
            full_name: localAdmin.full_name,
          };
          return;
        }
      }

      return reply.code(401).send({ error: 'Unauthorized', message: 'Missing or invalid token' });
    }

    const decoded = jwt.verify(token, getJwtSecret()) as AuthUser;
    
    // Check if user is active
    const db = getDb();
    const user = (await db.prepare('SELECT id, is_active FROM users WHERE id = ?').get(decoded.id)) as any;
    
    if (!user || user.is_active === 0) {
      return reply.code(401).send({ error: 'Unauthorized', message: 'User inactive or not found' });
    }

    request.user = decoded;
  } catch (error) {
    return reply.code(401).send({ error: 'Unauthorized', message: 'Invalid or expired token' });
  }
}

export function requireRole(...roles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    await verifyToken(request, reply);
    
    if (request.user && !roles.includes(request.user.role)) {
      return reply.code(403).send({ error: 'Forbidden', message: 'Insufficient permissions' });
    }
  };
}

export async function optionalAuth(request: FastifyRequest, reply: FastifyReply) {
  try {
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      if (!token) {
        return reply.code(401).send({ error: 'Unauthorized', message: 'Missing token' });
      }
      const decoded = jwt.verify(token, getJwtSecret()) as AuthUser;
      
      const db = getDb();
      const user = (await db.prepare('SELECT id, is_active FROM users WHERE id = ?').get(decoded.id)) as any;
      if (!user || user.is_active === 0) {
        return reply.code(401).send({ error: 'Unauthorized', message: 'User inactive or not found' });
      }
      request.user = decoded;
    }
  } catch (error) {
    return reply.code(401).send({ error: 'Unauthorized', message: 'Invalid or expired token' });
  }
}
