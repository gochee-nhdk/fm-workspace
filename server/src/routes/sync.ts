import { FastifyInstance } from 'fastify';
import { getDb } from '../db/connection.js';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { verifyToken, optionalAuth } from '../middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure local file vault directory exists on server disk
function getVaultDir(userId: string): string {
  // Sanitize userId to prevent directory traversal
  const safeUserId = userId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const vaultPath = path.resolve(__dirname, '../../data/vaults', safeUserId);
  try {
    if (!fs.existsSync(vaultPath)) {
      fs.mkdirSync(vaultPath, { recursive: true });
    }
  } catch (err) {
    console.warn('Failed to ensure vault directory:', err);
  }
  return vaultPath;
}

export default async function syncRoutes(fastify: FastifyInstance) {
  // Support both authenticated multi-user isolation and local offline-first single user
  fastify.addHook('preHandler', optionalAuth);

  /**
   * 1. POST /api/sync/backup
   * Accepts workspace backup payload from authenticated client or local app, persists to SQLite and user's isolated vault
   */
  fastify.post('/backup', async (request: any, reply) => {
    try {
      const {
        backupType = 'auto',
        deviceName = 'Thiết bị người dùng',
        checksum,
        itemCounts,
        payload,
        isEncrypted = false,
      } = request.body || {};

      if (!payload || !checksum) {
        return reply.code(400).send({
          success: false,
          message: 'Payload và checksum là bắt buộc.',
        });
      }

      const userId = request.user?.id || 'default_user';

      const db = getDb();
      const id = uuidv4();
      const now = new Date().toISOString();
      const itemCountsStr = typeof itemCounts === 'string' ? itemCounts : JSON.stringify(itemCounts || {});
      const payloadStr = typeof payload === 'string' ? payload : JSON.stringify(payload);

      // 1. Lưu vào SQLite database gắn liền với user_id
      db.prepare(`
        INSERT INTO user_workspace_backups (
          id, user_id, backup_type, device_name, checksum, item_counts, payload, is_encrypted, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        userId,
        backupType,
        deviceName,
        checksum,
        itemCountsStr,
        payloadStr,
        isEncrypted ? 1 : 0,
        now
      );

      // Giữ tối đa 20 bản sao lưu gần nhất của chính user này
      db.prepare(`
        DELETE FROM user_workspace_backups
        WHERE user_id = ? AND id NOT IN (
          SELECT id FROM user_workspace_backups
          WHERE user_id = ?
          ORDER BY created_at DESC
          LIMIT 20
        )
      `).run(userId, userId);

      // 2. Lưu bản sao an toàn vào vault riêng của user trên ổ đĩa
      try {
        const userVaultDir = getVaultDir(userId);
        const diskFile = path.join(userVaultDir, 'backup_latest.json');
        fs.writeFileSync(diskFile, JSON.stringify({
          id,
          userId,
          checksum,
          isEncrypted,
          itemCounts,
          createdAt: now,
          payload: payloadStr,
        }), 'utf8');
      } catch (vaultErr) {
        console.warn('Disk vault write error (non-fatal):', vaultErr);
      }

      return {
        success: true,
        message: 'Đã lưu bản sao lưu an toàn thành công trên máy chủ.',
        data: {
          backupId: id,
          createdAt: now,
          checksum,
        },
      };
    } catch (err: any) {
      console.error('Error saving workspace backup:', err);
      return reply.code(500).send({
        success: false,
        message: err.message || 'Lỗi khi lưu sao lưu trên máy chủ.',
      });
    }
  });

  /**
   * 2. GET /api/sync/latest
   * Returns the latest backup belonging to the requesting authenticated user or default_user
   */
  fastify.get('/latest', async (request: any, reply) => {
    try {
      const userId = request.user?.id || 'default_user';

      const db = getDb();
      const latest = db.prepare(`
        SELECT id, backup_type, device_name, checksum, item_counts, payload, is_encrypted, created_at
        FROM user_workspace_backups
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT 1
      `).get(userId) as any;

      if (!latest) {
        // Fallback to user's isolated disk vault if DB record is missing
        try {
          const userVaultDir = getVaultDir(userId);
          const diskFile = path.join(userVaultDir, 'backup_latest.json');
          if (fs.existsSync(diskFile)) {
            const diskContent = JSON.parse(fs.readFileSync(diskFile, 'utf8'));
            if (diskContent.userId === userId) {
              return {
                success: true,
                data: {
                  id: diskContent.id,
                  backup_type: 'auto',
                  deviceName: 'Local Vault File',
                  checksum: diskContent.checksum,
                  item_counts: JSON.stringify(diskContent.itemCounts || {}),
                  payload: diskContent.payload,
                  is_encrypted: diskContent.isEncrypted ? 1 : 0,
                  created_at: diskContent.createdAt,
                },
              };
            }
          }
        } catch (_) {}

        return reply.code(404).send({
          success: false,
          message: 'Chưa có bản sao lưu nào của bạn trên máy chủ.',
        });
      }

      return {
        success: true,
        data: latest,
      };
    } catch (err: any) {
      console.error('Error fetching latest backup:', err);
      return reply.code(500).send({
        success: false,
        message: err.message || 'Lỗi khi lấy bản sao lưu mới nhất.',
      });
    }
  });

  /**
   * 3. GET /api/sync/history
   * Lists the most recent 10 backups metadata for the requesting user or default_user
   */
  fastify.get('/history', async (request: any, reply) => {
    try {
      const userId = request.user?.id || 'default_user';

      const db = getDb();
      const list = db.prepare(`
        SELECT id, backup_type, device_name, checksum, item_counts, is_encrypted, created_at
        FROM user_workspace_backups
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT 10
      `).all(userId) as any[];

      const parsedList = list.map((item) => ({
        ...item,
        item_counts: item.item_counts ? JSON.parse(item.item_counts) : {},
        is_encrypted: Boolean(item.is_encrypted),
      }));

      return {
        success: true,
        data: parsedList,
      };
    } catch (err: any) {
      console.error('Error fetching backup history:', err);
      return reply.code(500).send({
        success: false,
        message: err.message || 'Lỗi khi lấy lịch sử sao lưu.',
      });
    }
  });

  /**
   * 4. GET /api/sync/download/:id
   * Fetch full payload for a specific backup — verified by user ownership
   */
  fastify.get('/download/:id', async (request: any, reply) => {
    try {
      const { id } = request.params;
      const userId = request.user?.id || 'default_user';
      const userRole = request.user?.role || 'user';

      const db = getDb();
      // Ensure backup belongs to requesting user (or user is admin)
      const record = db.prepare(`
        SELECT * FROM user_workspace_backups WHERE id = ? AND (user_id = ? OR ? = 'admin')
      `).get(id, userId, userRole) as any;

      if (!record) {
        return reply.code(404).send({
          success: false,
          message: 'Không tìm thấy bản sao lưu hoặc bạn không có quyền truy cập.',
        });
      }

      return {
        success: true,
        data: record,
      };
    } catch (err: any) {
      console.error('Error downloading backup:', err);
      return reply.code(500).send({
        success: false,
        message: err.message || 'Lỗi khi tải bản sao lưu.',
      });
    }
  });
}

