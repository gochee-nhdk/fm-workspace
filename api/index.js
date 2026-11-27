const { checkDbHealth } = require('./_lib/db');
const {
  sanitizeObject,
  applyCorsAndSecurityHeaders,
  sendError,
} = require('./_lib/http');
const { handleAuthRoute } = require('./_routes/auth');
const { handleSettingsRoute } = require('./_routes/settings');
const { handleAiRoute } = require('./_routes/ai');
const { handleNotificationsRoute } = require('./_routes/notifications');
const { handleSyncRoute } = require('./_routes/sync');

function resolvePathname(req, forcedPath) {
  let pathname = forcedPath || '';
  if (!pathname) {
    const rawUrl = req.url || '';
    const cleanUrl = rawUrl.split('?')[0].replace(/^\/api/, '');
    if (cleanUrl && cleanUrl !== '/' && !cleanUrl.startsWith('/[...slug]')) {
      pathname = cleanUrl;
    } else if (req.query && req.query.slug) {
      const slugPath = Array.isArray(req.query.slug)
        ? req.query.slug.join('/')
        : req.query.slug;
      pathname = `/${slugPath}`;
    } else {
      pathname = cleanUrl || '/';
    }
  }
  if (!pathname.startsWith('/')) {
    pathname = '/' + pathname;
  }
  return pathname;
}

module.exports = async function handler(req, res, forcedPath) {
  const { isAllowedOrigin } = applyCorsAndSecurityHeaders(req, res);

  if (req.method === 'OPTIONS') {
    if (!isAllowedOrigin && req.headers.origin) {
      return sendError(res, 403, 'Forbidden', 'Origin không nằm trong danh sách cho phép');
    }
    return res.status(200).end();
  }

  if (req.headers.origin && !isAllowedOrigin) {
    return sendError(res, 403, 'Forbidden', 'Origin không nằm trong danh sách cho phép');
  }

  // Parse string body if received as raw text
  if (req.body && typeof req.body === 'string') {
    try {
      req.body = JSON.parse(req.body);
    } catch (_) {
      return sendError(res, 400, 'BadRequest', 'Payload JSON không hợp lệ');
    }
  }

  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }
  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeObject(req.query);
  }

  const pathname = resolvePathname(req, forcedPath);

  try {
    // 1. Health Check (verifies Turso connectivity without leaking secrets)
    if (pathname === '/health' || pathname === '' || pathname === '/') {
      try {
        const dbHealth = await checkDbHealth();
        return res.status(200).json({
          status: 'ok',
          service: 'FM Workspace Vercel Cloud Serverless API',
          db: dbHealth,
          timestamp: new Date().toISOString(),
        });
      } catch (dbErr) {
        return res.status(503).json({
          status: 'error',
          service: 'FM Workspace Vercel Cloud Serverless API',
          db: { connected: false },
          message: 'Không thể kết nối cơ sở dữ liệu',
          timestamp: new Date().toISOString(),
        });
      }
    }

    // 2. Auth Routes
    if (pathname.startsWith('/auth/')) {
      return await handleAuthRoute(req, res, pathname);
    }

    // 3. Settings Routes
    if (pathname.startsWith('/settings/')) {
      return await handleSettingsRoute(req, res, pathname);
    }

    // 4. AI Routes
    if (pathname.startsWith('/ai/')) {
      return await handleAiRoute(req, res, pathname);
    }

    // 5. Notifications / SMTP Routes
    if (pathname.startsWith('/notifications/')) {
      return await handleNotificationsRoute(req, res, pathname);
    }

    // 6. Sync / Backup Routes
    if (pathname.startsWith('/sync/')) {
      return await handleSyncRoute(req, res, pathname);
    }

    return sendError(
      res,
      404,
      'NotFound',
      `Endpoint ${pathname} không tồn tại trên Cloud API`
    );
  } catch (error) {
    console.error('API Serverless Error:', error?.message || error);
    return sendError(
      res,
      500,
      error?.name || 'ServerError',
      error?.message || 'Lỗi xử lý yêu cầu phía máy chủ'
    );
  }
};
