import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import { initDb } from './db/init.js';
import { closeDb } from './db/connection.js';

// Route imports
import authRoutes from './routes/auth.js';
import dashboardRoutes from './routes/dashboard.js';
import productRoutes from './routes/products.js';
import aiRoutes from './routes/ai.js';
import procurementRoutes from './routes/procurement.js';
import storesRoutes from './routes/stores.js';
import suppliersRoutes from './routes/suppliers.js';
import inventoryRoutes from './routes/inventory.js';
import transfersRoutes from './routes/transfers.js';
import analyticsRoutes from './routes/analytics.js';
import reportsRoutes from './routes/reports.js';
import importsRoutes from './routes/imports.js';
import notificationsRoutes from './routes/notifications.js';
import auditRoutes from './routes/audit.js';
import settingsRoutes from './routes/settings.js';
import searchRoutes from './routes/search.js';
import knowledgeRoutes from './routes/knowledge.js';

const fastify = Fastify({
  bodyLimit: 100 * 1024 * 1024, // 100MB max payload
  logger: process.env.NODE_ENV === 'development'
});

async function build() {
  // Enterprise Security: Restrict CORS to trusted local origins
  const allowedOrigins = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ];

  await fastify.register(cors, {
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.includes(origin)) {
        cb(null, true);
        return;
      }
      cb(new Error('Blocked by CORS policy: Untrusted origin'), false);
    },
    credentials: true,
  });

  // Enterprise Security Headers (Anti-Clickjacking, Anti-MIME sniffing, XSS Filter)
  fastify.addHook('onSend', async (_request, reply) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('X-XSS-Protection', '1; mode=block');
    reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    reply.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  });

  await fastify.register(cookie);
  await fastify.register(rateLimit, { max: 1000, timeWindow: '1 minute' });
  await fastify.register(multipart, {
    limits: {
      fieldNameSize: 200,
      fieldSize: 100 * 1024 * 1024,
      fields: 20,
      fileSize: 100 * 1024 * 1024, // 100MB max file size
      files: 1
    }
  });

  await initDb();

  // Register routes
  fastify.register(authRoutes, { prefix: '/api/auth' });
  fastify.register(dashboardRoutes, { prefix: '/api/dashboard' });
  fastify.register(productRoutes, { prefix: '/api/products' });
  fastify.register(aiRoutes, { prefix: '/api/ai' });
  fastify.register(procurementRoutes, { prefix: '/api/procurement' });
  fastify.register(storesRoutes, { prefix: '/api/stores' });
  fastify.register(suppliersRoutes, { prefix: '/api/suppliers' });
  fastify.register(inventoryRoutes, { prefix: '/api/inventory' });
  fastify.register(transfersRoutes, { prefix: '/api/transfers' });
  fastify.register(analyticsRoutes, { prefix: '/api/analytics' });
  fastify.register(reportsRoutes, { prefix: '/api/reports' });
  fastify.register(importsRoutes, { prefix: '/api/imports' });
  fastify.register(notificationsRoutes, { prefix: '/api/notifications' });
  fastify.register(auditRoutes, { prefix: '/api/audit-logs' });
  fastify.register(settingsRoutes, { prefix: '/api/settings' });
  fastify.register(searchRoutes, { prefix: '/api/search' });
  fastify.register(knowledgeRoutes, { prefix: '/api/knowledge' });

  // Security Guardian Heartbeat & Health Check
  fastify.get('/health', async () => {
    return {
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      service: 'FM Procurement Engine',
      environment: process.env.NODE_ENV || 'production'
    };
  });

  fastify.setErrorHandler((error, request, reply) => {
    request.log.error(error);
    reply.status(500).send({ success: false, error: 'Internal Server Error', message: error.message });
  });

  fastify.addHook('onClose', async () => {
    closeDb();
  });

  return fastify;
}

const start = async () => {
  try {
    const server = await build();
    const port = Number(process.env.PORT) || 3000;
    // Security: Bind strictly to 127.0.0.1 (Localhost only) to prevent unauthorized LAN access
    const host = process.env.HOST || '127.0.0.1';
    await server.listen({ port, host });
    console.log(`[FM Security Shield] Server securely listening on http://${host}:${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
