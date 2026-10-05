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
      return reply.code(401).send({ error: 'Unauthorized', message: 'Missing or invalid token' });
    }

    const decoded = jwt.verify(token, getJwtSecret()) as AuthUser;
    
    // Check if user is active
    const db = getDb();
    const user = db.prepare('SELECT id, is_active FROM users WHERE id = ?').get(decoded.id) as any;
    
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
      const user = db.prepare('SELECT id, is_active FROM users WHERE id = ?').get(decoded.id) as any;
      if (!user || user.is_active === 0) {
        return reply.code(401).send({ error: 'Unauthorized', message: 'User inactive or not found' });
      }
      request.user = decoded;
    }
  } catch (error) {
    return reply.code(401).send({ error: 'Unauthorized', message: 'Invalid or expired token' });
  }
}
