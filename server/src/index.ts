import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { initDb } from './db/init.js';
import { closeDb } from './db/connection.js';
import { getJwtSecret } from './config/auth.js';
import { getAllowedOrigins, isOriginAllowed } from './config/cors.js';
import { startDbAutoBackup, stopDbAutoBackup } from './services/dbBackupManager.js';
import { globalRateLimitOptions } from './middleware/rateLimit.js';
import { preventPrototypePollution } from './middleware/validate.js';
import { secureErrorHandler } from './middleware/errorHandler.js';
import { registerSecurityMiddleware } from './middleware/security.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
import syncRoutes from './routes/sync.js';

const fastify = Fastify({
  bodyLimit: 100 * 1024 * 1024, // 100MB max payload
  logger: process.env.NODE_ENV === 'development'
});

async function build() {
  const isProd = process.env.NODE_ENV === 'production';
  const isDesktop = process.env.ELECTRON_RUN === 'true' || process.env.LOCAL_DEV === 'true';

  // Enterprise Security: Restrict CORS strictly to explicitly trusted origins
  const allowedOrigins = getAllowedOrigins();

  await fastify.register(cors, {
    origin: (origin, cb) => {
      if (isOriginAllowed(origin, allowedOrigins)) {
        cb(null, true);
        return;
      }

      // Deny untrusted origins (including arbitrary third-party .vercel.app preview URLs)
      cb(null, false);
    },
    credentials: true,
  });

  // Fail-fast JWT Secret verification
  getJwtSecret();

  // Register Host Header Validation (Anti-DNS Rebinding) & Enterprise Security Headers
  registerSecurityMiddleware(fastify);

  // Prototype Pollution Prevention Hook
  fastify.addHook('preValidation', (request, reply, done) => {
    preventPrototypePollution(request, reply, done);
  });

  await fastify.register(cookie);
  // Tiered global rate limit (200 req/min with structured 429 response)
  await fastify.register(rateLimit, globalRateLimitOptions);
  await fastify.register(multipart, {
    limits: {
      fieldNameSize: 100,
      fieldSize: 50 * 1024 * 1024,
      fields: 20,
      fileSize: 50 * 1024 * 1024, // 50MB max file size (aligned with backup max size)
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
  fastify.register(syncRoutes, { prefix: '/api/sync' });

  // Security Guardian Heartbeat & Health Check (Redacted in production)
  fastify.get('/health', async () => {
    const isProd = process.env.NODE_ENV === 'production';
    return {
      status: 'ok',
      service: 'FM Procurement Engine',
      ...(isProd ? {} : { uptime: process.uptime(), environment: 'development' }),
    };
  });

  // Serve Single-Page App static bundle if client/dist exists (Production, Desktop & Render support)
  const clientDist = process.env.CLIENT_DIST_PATH || path.resolve(__dirname, '../../client/dist');
  if (fs.existsSync(clientDist)) {
    await fastify.register(fastifyStatic, {
      root: clientDist,
      prefix: '/',
    });

    fastify.setNotFoundHandler(async (request, reply) => {
      if (request.raw.url && request.raw.url.startsWith('/api')) {
        reply.status(404).send({
          success: false,
          error: 'NotFound',
          message: 'Endpoint API không tồn tại',
        });
        return;
      }
      return reply.sendFile('index.html');
    });
  }

  fastify.setErrorHandler((error: any, request, reply) => {
    secureErrorHandler(error, request, reply);
  });

  fastify.addHook('onClose', async () => {
    await stopDbAutoBackup();
    closeDb();
  });

  return fastify;
}

const start = async () => {
  try {
    const server = await build();
    const port = Number(process.env.PORT) || 3000;
    // Security: Bind strictly to 127.0.0.1 in local dev and desktop app, avoiding 0.0.0.0 public interface exposure
    const isDesktop = process.env.ELECTRON_RUN === 'true' || process.env.LOCAL_DEV === 'true';
    const host = process.env.HOST || (isDesktop ? '127.0.0.1' : (process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1'));
    await server.listen({ port, host });
    console.log(`[FM Security Shield] Server securely listening on http://${host}:${port}`);
    startDbAutoBackup();
  } catch (err) {
    console.error('Server failed to start:', err);
    process.exit(1);
  }
};

start();
