import { FastifyInstance } from 'fastify';
import { getDb } from '../db/connection.js';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { verifyToken } from '../middleware/auth.js';
import { getVaultDir } from '../config/paths.js';

export default async function syncRoutes(fastify: FastifyInstance) {
  // Enforce verified authentication across all workspace backup and sync endpoints
  fastify.addHook('preHandler', verifyToken);

  /**
   * 1. POST /api/sync/backup
   * Accepts workspace backup payload from authenticated client or local app, persists to SQLite/Turso and user's isolated vault
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

      const userId = request.user?.id;
      if (!userId) {
        return reply.code(401).send({
          success: false,
          error: 'Unauthorized',
          message: 'Yêu cầu xác thực người dùng hợp lệ.',
        });
      }

      const db = getDb();
      const id = uuidv4();
      const now = new Date().toISOString();
      const itemCountsStr = typeof itemCounts === 'string' ? itemCounts : JSON.stringify(itemCounts || {});
      const payloadStr = typeof payload === 'string' ? payload : JSON.stringify(payload);

      // 1. Lưu vào database (Turso hoặc local SQLite) gắn liền với user_id trong một transaction ACID
      await db.transaction(async (tx) => {
        await tx.prepare(`
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
        await tx.prepare(`
          DELETE FROM user_workspace_backups
          WHERE user_id = ? AND id NOT IN (
            SELECT id FROM user_workspace_backups
            WHERE user_id = ?
            ORDER BY created_at DESC
            LIMIT 20
          )
        `).run(userId, userId);

        // 1b. Khôi phục/đồng bộ PO Tracker và PO Folders vào database nếu các bảng quan hệ tồn tại
        try {
          if (!isEncrypted && payloadStr) {
            const parsedPayload = typeof payload === 'object' ? payload : JSON.parse(payloadStr);
            const tableCheck = (await tx.prepare(`
              SELECT name FROM sqlite_master WHERE type='table' AND name IN ('po_tracker_folders', 'po_tracker_pos')
            `).all()) as any[];
            const existingTableNames = new Set(tableCheck.map((t) => t.name));

            if (existingTableNames.has('po_tracker_folders') && Array.isArray(parsedPayload.poFolders)) {
              for (const f of parsedPayload.poFolders) {
                if (!f || !f.id) continue;
                const exists = await tx.prepare('SELECT id FROM po_tracker_folders WHERE id = ?').get(f.id);
                if (exists) {
                  await tx.prepare(`
                    UPDATE po_tracker_folders SET name = ?, description = ?, color = ?, icon = ?, sort_order = ?, updated_at = ?
                    WHERE id = ?
                  `).run(f.name || 'Nhóm', f.description || '', f.color || 'blue', f.icon || 'shippingbox', f.sort_order || 0, f.updated_at || now, f.id);
                } else {
                  await tx.prepare(`
                    INSERT INTO po_tracker_folders (id, name, description, color, icon, sort_order, created_by, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                  `).run(f.id, f.name || 'Nhóm', f.description || '', f.color || 'blue', f.icon || 'shippingbox', f.sort_order || 0, userId, f.created_at || now, f.updated_at || now);
                }
              }
            }

            if (existingTableNames.has('po_tracker_pos') && Array.isArray(parsedPayload.poOrders)) {
              for (const po of parsedPayload.poOrders) {
                if (!po || !po.id) continue;
                const exists = await tx.prepare('SELECT id FROM po_tracker_pos WHERE id = ?').get(po.id);
                if (exists) {
                  await tx.prepare(`
                    UPDATE po_tracker_pos SET
                      folder_id = ?, po_number = ?, po_date = ?, expected_delivery_date = ?,
                      actual_delivery_date = ?, supplier_code = ?, supplier_name = ?,
                      warehouse = ?, status = ?, total_value = ?, currency = ?, notes = ?, updated_at = ?
                    WHERE id = ?
                  `).run(
                    po.folder_id || null, po.po_number || null, po.po_date || null,
                    po.expected_delivery_date || null, po.actual_delivery_date || null,
                    po.supplier_code || null, po.supplier_name || null,
                    po.warehouse || null, po.status || 'pending', Number(po.total_value || 0),
                    po.currency || 'VND', po.notes || null, po.updated_at || now, po.id
                  );
                } else {
                  await tx.prepare(`
                    INSERT INTO po_tracker_pos (
                      id, folder_id, po_number, po_date, expected_delivery_date, actual_delivery_date,
                      supplier_code, supplier_name, warehouse, status, total_value, currency,
                      notes, created_by, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                  `).run(
                    po.id, po.folder_id || null, po.po_number || null, po.po_date || null,
                    po.expected_delivery_date || null, po.actual_delivery_date || null,
                    po.supplier_code || null, po.supplier_name || null,
                    po.warehouse || null, po.status || 'pending', Number(po.total_value || 0),
                    po.currency || 'VND', po.notes || null, userId, po.created_at || now, po.updated_at || now
                  );
                }
              }
            }
          }
        } catch (_) {}
      });

      // 2. Lưu bản sao an toàn vào vault riêng của user trên ổ đĩa (nếu môi trường hỗ trợ lưu trữ tệp cục bộ)
      try {
        const userVaultDir = getVaultDir(userId);
        const backupData = JSON.stringify({
          id,
          userId,
          checksum,
          isEncrypted,
          itemCounts,
          createdAt: now,
          payload: payloadStr,
        }, null, 2);

        // Luôn ghi đè bản mới nhất
        const diskFile = path.join(userVaultDir, 'backup_latest.json');
        fs.writeFileSync(diskFile, backupData, 'utf8');

        // Đồng thời lưu bản lịch sử luân phiên (tối đa 10 tệp) để phục hồi khẩn cấp
        const histFile = path.join(userVaultDir, `backup_${Date.now()}.json`);
        fs.writeFileSync(histFile, backupData, 'utf8');

        const vaultFiles = fs.readdirSync(userVaultDir)
          .filter((f) => f.startsWith('backup_') && f.endsWith('.json') && f !== 'backup_latest.json')
          .map((f) => ({ path: path.join(userVaultDir, f), mtime: fs.statSync(path.join(userVaultDir, f)).mtimeMs }))
          .sort((a, b) => b.mtime - a.mtime);

        if (vaultFiles.length > 10) {
          vaultFiles.slice(10).forEach((vf) => {
            try { fs.unlinkSync(vf.path); } catch (_) {}
          });
        }
      } catch (vaultErr) {
        // In hosted cloud environments (e.g. Render Free ephemeral disk), disk writes may be ephemeral or fail
        // The remote database backup record above is the authoritative durable store.
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
      const userId = request.user?.id;
      if (!userId) {
        return reply.code(401).send({
          success: false,
          error: 'Unauthorized',
          message: 'Yêu cầu xác thực người dùng hợp lệ.',
        });
      }

      const db = getDb();
      // SECURITY ISOLATION: Strictly isolate workspace backup by requesting user ID.
      // Never fall back to returning another user's backup or default_user vault.
      let latest = (await db.prepare(`
        SELECT id, backup_type, device_name, checksum, item_counts, payload, is_encrypted, created_at
        FROM user_workspace_backups
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT 1
      `).get(userId)) as any;

      if (!latest) {
        // Fallback strictly to requesting user's own isolated disk vault file if available
        const userVaultFile = path.join(getVaultDir(userId), 'backup_latest.json');
        try {
          if (fs.existsSync(userVaultFile)) {
            const diskContent = JSON.parse(fs.readFileSync(userVaultFile, 'utf8'));
            if (diskContent && diskContent.payload && diskContent.userId === userId) {
              return {
                success: true,
                data: {
                  id: diskContent.id || 'recovered-backup',
                  backup_type: 'auto',
                  deviceName: 'Local Vault File',
                  checksum: diskContent.checksum || '',
                  item_counts: typeof diskContent.itemCounts === 'string' ? diskContent.itemCounts : JSON.stringify(diskContent.itemCounts || {}),
                  payload: diskContent.payload,
                  is_encrypted: diskContent.isEncrypted ? 1 : 0,
                  created_at: diskContent.createdAt || new Date().toISOString(),
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
   * Lists the most recent 10 backups metadata for the requesting authenticated user
   */
  fastify.get('/history', async (request: any, reply) => {
    try {
      const userId = request.user?.id;
      if (!userId) {
        return reply.code(401).send({
          success: false,
          error: 'Unauthorized',
          message: 'Yêu cầu xác thực người dùng hợp lệ.',
        });
      }

      const db = getDb();
      const list = (await db.prepare(`
        SELECT id, backup_type, device_name, checksum, item_counts, is_encrypted, created_at
        FROM user_workspace_backups
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT 10
      `).all(userId)) as any[];

      const parsedList = list.map((item) => {
        let parsedCounts = {};
        try {
          if (item.item_counts) parsedCounts = JSON.parse(item.item_counts);
        } catch (_) {}
        return {
          ...item,
          item_counts: parsedCounts,
          is_encrypted: Boolean(item.is_encrypted),
        };
      });

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
   * Fetch full payload for a specific backup — verified strictly by user ownership
   */
  fastify.get('/download/:id', async (request: any, reply) => {
    try {
      const { id } = request.params;
      const userId = request.user?.id;
      const userRole = request.user?.role || 'user';

      if (!userId) {
        return reply.code(401).send({
          success: false,
          error: 'Unauthorized',
          message: 'Yêu cầu xác thực người dùng hợp lệ.',
        });
      }

      const db = getDb();
      // Ensure backup belongs to requesting user (or user is admin)
      const record = (await db.prepare(`
        SELECT * FROM user_workspace_backups WHERE id = ? AND (user_id = ? OR ? = 'admin')
      `).get(id, userId, userRole)) as any;

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

  /**
   * 5. POST /api/sync/restore
   * Restores workspace data and PO Tracker orders & folders from cloud backup
   */
  fastify.post('/restore', async (request: any, reply) => {
    try {
      const userId = request.user?.id;
      if (!userId) {
        return reply.code(401).send({
          success: false,
          error: 'Unauthorized',
          message: 'Yêu cầu xác thực người dùng hợp lệ.',
        });
      }

      const { backupId, conflictStrategy = 'overwrite' } = request.body || {};
      const db = getDb();

      let backupRecord: any = null;
      if (backupId) {
        backupRecord = (await db.prepare(`
          SELECT * FROM user_workspace_backups WHERE id = ? AND user_id = ?
        `).get(backupId, userId)) as any;
      } else {
        backupRecord = (await db.prepare(`
          SELECT * FROM user_workspace_backups WHERE user_id = ? ORDER BY created_at DESC LIMIT 1
        `).get(userId)) as any;
      }

      if (!backupRecord || !backupRecord.payload) {
        return reply.code(404).send({
          success: false,
          message: 'Không tìm thấy bản sao lưu hợp lệ để phục hồi.',
        });
      }

      let poOrdersCount = 0;
      let poFoldersCount = 0;

      if (!backupRecord.is_encrypted) {
        try {
          const payload = typeof backupRecord.payload === 'object' ? backupRecord.payload : JSON.parse(backupRecord.payload);
          const now = new Date().toISOString();

          await db.transaction(async (tx) => {
            const tableCheck = (await tx.prepare(`
              SELECT name FROM sqlite_master WHERE type='table' AND name IN ('po_tracker_folders', 'po_tracker_pos')
            `).all()) as any[];
            const existingTableNames = new Set(tableCheck.map((t) => t.name));

            if (existingTableNames.has('po_tracker_folders') && Array.isArray(payload.poFolders)) {
              for (const f of payload.poFolders) {
                if (!f || !f.id) continue;
                const exists = await tx.prepare('SELECT id FROM po_tracker_folders WHERE id = ?').get(f.id);
                if (exists) {
                  if (conflictStrategy === 'skip') continue;
                  await tx.prepare(`
                    UPDATE po_tracker_folders SET name = ?, description = ?, color = ?, icon = ?, sort_order = ?, updated_at = ?
                    WHERE id = ?
                  `).run(f.name || 'Nhóm', f.description || '', f.color || 'blue', f.icon || 'shippingbox', f.sort_order || 0, f.updated_at || now, f.id);
                } else {
                  await tx.prepare(`
                    INSERT INTO po_tracker_folders (id, name, description, color, icon, sort_order, created_by, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                  `).run(f.id, f.name || 'Nhóm', f.description || '', f.color || 'blue', f.icon || 'shippingbox', f.sort_order || 0, userId, f.created_at || now, f.updated_at || now);
                }
                poFoldersCount++;
              }
            }

            if (existingTableNames.has('po_tracker_pos') && Array.isArray(payload.poOrders)) {
              for (const po of payload.poOrders) {
                if (!po || !po.id) continue;
                const exists = await tx.prepare('SELECT id FROM po_tracker_pos WHERE id = ?').get(po.id);
                if (exists) {
                  if (conflictStrategy === 'skip') continue;
                  await tx.prepare(`
                    UPDATE po_tracker_pos SET
                      folder_id = ?, po_number = ?, po_date = ?, expected_delivery_date = ?,
                      actual_delivery_date = ?, supplier_code = ?, supplier_name = ?,
                      warehouse = ?, status = ?, total_value = ?, currency = ?, notes = ?, updated_at = ?
                    WHERE id = ?
                  `).run(
                    po.folder_id || null, po.po_number || null, po.po_date || null,
                    po.expected_delivery_date || null, po.actual_delivery_date || null,
                    po.supplier_code || null, po.supplier_name || null,
                    po.warehouse || null, po.status || 'pending', Number(po.total_value || 0),
                    po.currency || 'VND', po.notes || null, po.updated_at || now, po.id
                  );
                } else {
                  await tx.prepare(`
                    INSERT INTO po_tracker_pos (
                      id, folder_id, po_number, po_date, expected_delivery_date, actual_delivery_date,
                      supplier_code, supplier_name, warehouse, status, total_value, currency,
                      notes, created_by, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                  `).run(
                    po.id, po.folder_id || null, po.po_number || null, po.po_date || null,
                    po.expected_delivery_date || null, po.actual_delivery_date || null,
                    po.supplier_code || null, po.supplier_name || null,
                    po.warehouse || null, po.status || 'pending', Number(po.total_value || 0),
                    po.currency || 'VND', po.notes || null, userId, po.created_at || now, po.updated_at || now
                  );
                }
                poOrdersCount++;
              }
            }
          });
        } catch (err: any) {
          console.warn('[Sync] Non-fatal restore error:', err);
        }
      }

      return {
        success: true,
        message: 'Đã phục hồi dữ liệu từ bản sao lưu thành công.',
        data: {
          backupId: backupRecord.id,
          poOrdersRestored: poOrdersCount,
          poFoldersRestored: poFoldersCount,
          backup: backupRecord,
        },
      };
    } catch (err: any) {
      console.error('Error restoring from backup:', err);
      return reply.code(500).send({
        success: false,
        message: err.message || 'Lỗi khi phục hồi từ sao lưu.',
      });
    }
  });
}
