import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

/**
 * Enterprise Security Middleware Suite
 * Includes Host Header Validation (Anti-DNS Rebinding) & Hardened HTTP Security Headers
 */

export async function antiDnsRebindingHook(request: FastifyRequest, reply: FastifyReply) {
  const rawHost = request.headers.host || '';
  const hostname = rawHost.split(':')[0].toLowerCase();
  const isProd = process.env.NODE_ENV === 'production';
  const isLocalOrDesktop = !isProd || process.env.ELECTRON_RUN === 'true' || process.env.LOCAL_DEV === 'true';

  // In local development or local desktop app, strictly only accept localhost and 127.0.0.1
  if (isLocalOrDesktop) {
    const allowedLocalHosts = ['localhost', '127.0.0.1', '::1'];
    if (!allowedLocalHosts.includes(hostname)) {
      reply.status(403).send({
        success: false,
        error: 'SecurityBlocked',
        message: 'DNS Rebinding Protection: Host header blocked.',
      });
      return;
    }
  }
}

export async function securityHeadersHook(request: FastifyRequest, reply: FastifyReply) {
  reply.header('X-Content-Type-Options', 'nosniff');
  reply.header('X-Frame-Options', 'DENY');
  reply.header('X-XSS-Protection', '1; mode=block');
  reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  reply.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  reply.header('Cross-Origin-Opener-Policy', 'same-origin');
  reply.header(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: blob: https:; connect-src 'self' https: http: ws: wss:; frame-ancestors 'none';"
  );

  // Security: Only send HSTS over true HTTPS in production web deployment, never on local desktop HTTP
  const isDesktop = process.env.ELECTRON_RUN === 'true' || process.env.LOCAL_DEV === 'true';
  if (process.env.NODE_ENV === 'production' && !isDesktop && (request.protocol === 'https' || request.headers['x-forwarded-proto'] === 'https')) {
    reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
}

export function registerSecurityMiddleware(fastify: FastifyInstance) {
  fastify.addHook('onRequest', antiDnsRebindingHook);
  fastify.addHook('onSend', securityHeadersHook);
}
