const crypto = require('crypto');
const zlib = require('zlib');
const { z } = require('zod');
const { getDb } = require('../_lib/db');
const { sendError, parseZodError, verifyAuth } = require('../_lib/http');

// Vercel Hobby serverless request body limit is 4.5 MB
const MAX_VERCEL_BODY_BYTES = 4.5 * 1024 * 1024;
const MAX_STORED_PAYLOAD_BYTES = 16 * 1024 * 1024;

const backupBodySchema = z.object({
  backupType: z.enum(['auto', 'manual', 'snapshot']).optional().default('auto'),
  deviceName: z.string().max(200).optional(),
  checksum: z.string().min(1, 'Checksum là bắt buộc.').max(128),
  itemCounts: z.union([z.record(z.unknown()), z.string()]).optional(),
  payload: z.union([z.string().min(1), z.record(z.unknown())]),
  payloadEncoding: z.enum(['plain', 'gzip-base64']).optional().default('plain'),
  isEncrypted: z.boolean().optional().default(false),
});

function decodeStoredPayload(payload, encoding) {
  if (!payload || typeof payload !== 'string') return '';
  if (encoding === 'gzip-base64') {
    const compressedBuf = Buffer.from(payload, 'base64');
    return zlib.gunzipSync(compressedBuf).toString('utf8');
  }
  return payload;
}

function parseItemCounts(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch (_) {
    return {};
  }
}

async function handleSyncRoute(req, res, pathname) {
  const auth = await verifyAuth(req);
  if (!auth.valid) {
    return sendError(
      res,
      401,
      'Unauthorized',
      auth.error || 'Yêu cầu đăng nhập để truy cập dữ liệu sao lưu.'
    );
  }

  const userId = auth.user?.id;
  if (!userId) {
    return sendError(res, 401, 'Unauthorized', 'Yêu cầu xác thực người dùng hợp lệ.');
  }

  // POST /sync/backup
  if (pathname === '/sync/backup' && req.method === 'POST') {
    const parsed = backupBodySchema.safeParse(req.body || {});
    if (!parsed.success) {
      return sendError(res, 400, 'ValidationError', parseZodError(parsed.error));
    }

    const { backupType, deviceName, checksum, itemCounts, payload, payloadEncoding, isEncrypted } =
      parsed.data;

    const rawPayloadStr = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const incomingBytes = Buffer.byteLength(rawPayloadStr, 'utf8');
    if (incomingBytes > MAX_VERCEL_BODY_BYTES) {
      return sendError(
        res,
        413,
        'PayloadTooLarge',
        'Dung lượng sao lưu vượt quá giới hạn 4.5 MB của Vercel Serverless. Vui lòng bật nén hoặc giảm bớt tệp đính kèm.'
      );
    }

    // Validate gzip integrity if client sent compressed payload
    let storedPayload = rawPayloadStr;
    let storedEncoding = payloadEncoding;
    let uncompressedSize = incomingBytes;

    if (payloadEncoding === 'gzip-base64') {
      try {
        const decompressed = decodeStoredPayload(rawPayloadStr, 'gzip-base64');
        uncompressedSize = Buffer.byteLength(decompressed, 'utf8');
        if (uncompressedSize > MAX_STORED_PAYLOAD_BYTES) {
          return sendError(
            res,
            413,
            'PayloadTooLarge',
            'Dung lượng dữ liệu giải nén vượt quá giới hạn cho phép.'
          );
        }
      } catch (_) {
        return sendError(res, 400, 'ValidationError', 'Dữ liệu nén gzip-base64 không hợp lệ.');
      }
    } else if (incomingBytes > 512 * 1024) {
      // Compress large plain payloads server-side to save Turso Cloud Free Tier storage
      storedPayload = zlib.gzipSync(Buffer.from(rawPayloadStr, 'utf8')).toString('base64');
      storedEncoding = 'gzip-base64';
    }

    const db = await getDb();
    const id = `backup-${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    const itemCountsStr =
      typeof itemCounts === 'string' ? itemCounts : JSON.stringify(itemCounts || {});

    await db.execute({
      sql: `INSERT INTO user_backups (
              id, user_id, backup_type, device_name, checksum, item_counts, payload, encoding, is_encrypted, size_bytes, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id,
        userId,
        backupType,
        deviceName || 'Web Client',
        checksum,
        itemCountsStr,
        storedPayload,
        storedEncoding,
        isEncrypted ? 1 : 0,
        uncompressedSize,
        now,
      ],
    });

    // Retain at most 20 recent backups per user
    await db.execute({
      sql: `DELETE FROM user_backups
            WHERE user_id = ? AND id NOT IN (
              SELECT id FROM user_backups
              WHERE user_id = ?
              ORDER BY created_at DESC
              LIMIT 20
            )`,
      args: [userId, userId],
    });

    return res.status(200).json({
      success: true,
      message: 'Đã lưu bản sao lưu an toàn thành công trên máy chủ đám mây.',
      data: {
        backupId: id,
        createdAt: now,
        checksum,
        compressed: storedEncoding === 'gzip-base64',
      },
    });
  }

  // GET /sync/latest
  if (pathname === '/sync/latest' && req.method === 'GET') {
    const db = await getDb();
    const result = await db.execute({
      sql: `SELECT id, user_id, backup_type, device_name, checksum, item_counts, payload, encoding, is_encrypted, created_at
            FROM user_backups
            WHERE user_id = ?
            ORDER BY created_at DESC
            LIMIT 1`,
      args: [userId],
    });
    const latest = result.rows[0];

    if (!latest) {
      return res.status(200).json({
        success: true,
        data: null,
        message: 'Chưa có bản sao lưu nào trên máy chủ đám mây',
      });
    }

    const decodedPayload = decodeStoredPayload(latest.payload, latest.encoding);
    return res.status(200).json({
      success: true,
      data: {
        id: latest.id,
        user_id: latest.user_id,
        backup_type: latest.backup_type,
        device_name: latest.device_name,
        checksum: latest.checksum,
        item_counts: parseItemCounts(latest.item_counts),
        payload: decodedPayload,
        is_encrypted: Boolean(latest.is_encrypted),
        created_at: latest.created_at,
      },
    });
  }

  // GET /sync/history
  if (pathname === '/sync/history' && req.method === 'GET') {
    const db = await getDb();
    const result = await db.execute({
      sql: `SELECT id, backup_type, device_name, checksum, item_counts, is_encrypted, size_bytes, created_at
            FROM user_backups
            WHERE user_id = ?
            ORDER BY created_at DESC
            LIMIT 20`,
      args: [userId],
    });

    const history = result.rows.map((row) => ({
      id: row.id,
      backup_type: row.backup_type,
      device_name: row.device_name,
      checksum: row.checksum,
      item_counts: parseItemCounts(row.item_counts),
      is_encrypted: Boolean(row.is_encrypted),
      size_bytes: Number(row.size_bytes || 0),
      created_at: row.created_at,
    }));

    return res.status(200).json({
      success: true,
      data: history,
    });
  }

  // GET /sync/download/:id
  if (pathname.startsWith('/sync/download/') && req.method === 'GET') {
    const downloadId = pathname.replace('/sync/download/', '').trim();
    if (!downloadId) {
      return sendError(res, 400, 'ValidationError', 'Thiếu ID bản sao lưu');
    }

    const db = await getDb();
    const result = await db.execute({
      sql: `SELECT id, user_id, backup_type, device_name, checksum, item_counts, payload, encoding, is_encrypted, created_at
            FROM user_backups
            WHERE id = ? AND user_id = ?
            LIMIT 1`,
      args: [downloadId, userId],
    });
    const target = result.rows[0];

    if (!target) {
      return sendError(res, 404, 'NotFound', 'Không tìm thấy bản sao lưu được yêu cầu');
    }

    const decodedPayload = decodeStoredPayload(target.payload, target.encoding);
    return res.status(200).json({
      success: true,
      data: {
        id: target.id,
        user_id: target.user_id,
        backup_type: target.backup_type,
        device_name: target.device_name,
        checksum: target.checksum,
        item_counts: parseItemCounts(target.item_counts),
        payload: decodedPayload,
        is_encrypted: Boolean(target.is_encrypted),
        created_at: target.created_at,
      },
    });
  }

  return sendError(res, 404, 'NotFound', `Endpoint ${pathname} không tồn tại`);
}

module.exports = { handleSyncRoute };
