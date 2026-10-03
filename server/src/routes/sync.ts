import { FastifyInstance } from 'fastify';
import { getDb } from '../db/connection.js';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure local file vault directory exists on server disk
function getVaultDir(): string {
  const vaultPath = path.resolve(__dirname, '../../data/vaults');
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
  /**
   * 1. POST /api/sync/backup
   * Accepts workspace backup payload from client, persists to SQLite and server disk file
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

      const db = getDb();
      const id = uuidv4();
      const now = new Date().toISOString();
      const userId = request.user?.id || 'default_user';
      const itemCountsStr = typeof itemCounts === 'string' ? itemCounts : JSON.stringify(itemCounts || {});
      const payloadStr = typeof payload === 'string' ? payload : JSON.stringify(payload);

      // 1. Lưu vào SQLite database
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

      // Giữ tối đa 20 bản sao lưu gần nhất trong DB để dọn dẹp bộ nhớ
      db.prepare(`
        DELETE FROM user_workspace_backups
        WHERE id NOT IN (
          SELECT id FROM user_workspace_backups
          ORDER BY created_at DESC
          LIMIT 20
        )
      `).run();

      // 2. Lưu bản sao an toàn vào file nhị phân trên ổ đĩa máy chủ (Disk File Vault)
      try {
        const vaultDir = getVaultDir();
        const diskFile = path.join(vaultDir, 'backup_latest.json');
        fs.writeFileSync(diskFile, JSON.stringify({
          id,
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
   * Returns the latest backup available on server
   */
  fastify.get('/latest', async (request: any, reply) => {
    try {
      const db = getDb();
      const latest = db.prepare(`
        SELECT id, backup_type, device_name, checksum, item_counts, payload, is_encrypted, created_at
        FROM user_workspace_backups
        ORDER BY created_at DESC
        LIMIT 1
      `).get() as any;

      if (!latest) {
        // Fallback to disk vault if DB record is missing
        try {
          const diskFile = path.join(getVaultDir(), 'backup_latest.json');
          if (fs.existsSync(diskFile)) {
            const diskContent = JSON.parse(fs.readFileSync(diskFile, 'utf8'));
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
        } catch (_) {}

        return reply.code(404).send({
          success: false,
          message: 'Chưa có bản sao lưu nào trên máy chủ.',
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
   * Lists the most recent 10 backups metadata (without heavy payload)
   */
  fastify.get('/history', async (request: any, reply) => {
    try {
      const db = getDb();
      const list = db.prepare(`
        SELECT id, backup_type, device_name, checksum, item_counts, is_encrypted, created_at
        FROM user_workspace_backups
        ORDER BY created_at DESC
        LIMIT 10
      `).all() as any[];

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
   * Fetch full payload for a specific backup
   */
  fastify.get('/download/:id', async (request: any, reply) => {
    try {
      const { id } = request.params;
      const db = getDb();
      const record = db.prepare(`
        SELECT * FROM user_workspace_backups WHERE id = ?
      `).get(id) as any;

      if (!record) {
        return reply.code(404).send({
          success: false,
          message: 'Không tìm thấy bản sao lưu yêu cầu.',
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
