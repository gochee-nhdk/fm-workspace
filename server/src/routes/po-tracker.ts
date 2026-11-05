import { FastifyInstance } from 'fastify';
import { getDb } from '../db/connection.js';
import { IDatabaseAdapter } from '../db/adapter.js';
import { verifyToken } from '../middleware/auth.js';
import { auditLog } from '../middleware/audit.js';
import { geminiService } from '../ai/gemini.js';
import { v4 as uuidv4 } from 'uuid';

// ─── Permission helpers ──────────────────────────────────────────────────────

type Permission = 'view' | 'comment' | 'edit' | 'admin';

const PERMISSION_RANK: Record<Permission, number> = {
  view: 1, comment: 2, edit: 3, admin: 4
};

function hasPermission(userPermission: Permission, required: Permission): boolean {
  return PERMISSION_RANK[userPermission] >= PERMISSION_RANK[required];
}

async function getUserPermissionOnFolder(
  db: IDatabaseAdapter,
  userId: string,
  userRole: string,
  folderId: string
): Promise<Permission | null> {
  // Admin role has full access always
  if (userRole === 'admin') return 'admin';

  const perm = await db.prepare(`
    SELECT permission FROM po_tracker_permissions
    WHERE user_id = ? AND resource_type = 'folder' AND resource_id = ?
  `).get(userId, folderId) as any;

  return perm?.permission || null;
}

async function getUserPermissionOnPO(
  db: IDatabaseAdapter,
  userId: string,
  userRole: string,
  poId: string,
  folderId: string | null
): Promise<Permission | null> {
  if (userRole === 'admin') return 'admin';

  // Check direct PO permission first
  const directPerm = await db.prepare(`
    SELECT permission FROM po_tracker_permissions
    WHERE user_id = ? AND resource_type = 'po' AND resource_id = ?
  `).get(userId, poId) as any;

  if (directPerm) return directPerm.permission as Permission;

  // Fall back to folder permission
  if (folderId) {
    const folderPerm = await db.prepare(`
      SELECT permission FROM po_tracker_permissions
      WHERE user_id = ? AND resource_type = 'folder' AND resource_id = ?
    `).get(userId, folderId) as any;
    if (folderPerm) return folderPerm.permission as Permission;
  }

  // Check global permission
  const globalPerm = await db.prepare(`
    SELECT permission FROM po_tracker_permissions
    WHERE user_id = ? AND resource_type = 'global' AND resource_id IS NULL
  `).get(userId) as any;

  return globalPerm?.permission || null;
}

// ─── Route registration ──────────────────────────────────────────────────────

export default async function poTrackerRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', verifyToken);

  // ─────────────────────────────────────────────────────────
  // PDF & IMAGE UPLOAD & AI EXTRACTION
  // ─────────────────────────────────────────────────────────

  const handleUploadExtraction = async (request: any, reply: any) => {
    let base64Data = '';
    let fileName = 'po-document.pdf';
    let mimeType = 'application/pdf';
    let apiKeys: string[] = [];

    // Check if body was sent as JSON (base64 DataURL)
    if (request.body && typeof request.body === 'object') {
      const { fileDataUrl, fileName: bFileName, mimeType: bMime, apiKeys: bKeys } = request.body;
      if (fileDataUrl && typeof fileDataUrl === 'string') {
        const match = fileDataUrl.match(/^data:([^;]+);base64,(.+)$/s);
        if (match) {
          mimeType = match[1];
          base64Data = match[2];
        } else {
          base64Data = fileDataUrl;
        }
        if (bFileName) fileName = bFileName;
        if (bMime) mimeType = bMime;
        if (Array.isArray(bKeys)) apiKeys = bKeys;
      }
    }

    // Fall back to multipart streaming if not JSON
    if (!base64Data && request.file) {
      try {
        const data = await request.file();
        if (data) {
          fileName = data.filename || 'po-document.pdf';
          mimeType = data.mimetype || (fileName.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');
          const chunks: Buffer[] = [];
          for await (const chunk of data.file) {
            chunks.push(chunk);
          }
          const buffer = Buffer.concat(chunks);
          base64Data = buffer.toString('base64');
        }
      } catch (_) {}
    }

    if (!base64Data) {
      return reply.code(400).send({ success: false, message: 'Không tìm thấy dữ liệu tệp được tải lên.' });
    }

    try {
      const extractedData = await geminiService.extractPOFromPdf(base64Data, fileName, mimeType, apiKeys);
      return { success: true, data: { ...extractedData, pdf_file_name: fileName } };
    } catch (error: any) {
      return reply.code(500).send({
        success: false,
        message: error.message || 'Không thể đọc nội dung đơn hàng. Vui lòng kiểm tra lại file.'
      });
    }
  };

  /**
   * POST /upload-pdf & POST /upload-file — Upload PO (PDF hoặc hình ảnh), trích xuất qua Gemini AI
   */
  fastify.post('/upload-pdf', handleUploadExtraction);
  fastify.post('/upload-file', handleUploadExtraction);

  // ─────────────────────────────────────────────────────────
  // FOLDERS
  // ─────────────────────────────────────────────────────────

  /**
   * GET /folders — List folders accessible to current user
   */
  fastify.get('/folders', async (request: any, reply) => {
    const db = getDb();
    const userId = request.user?.id;
    const userRole = request.user?.role;

    let folders: any[];

    if (userRole === 'admin') {
      folders = await db.prepare(`
        SELECT f.*,
               COUNT(DISTINCT p.id) as po_count,
               u.full_name as creator_name
        FROM po_tracker_folders f
        LEFT JOIN po_tracker_pos p ON p.folder_id = f.id
        LEFT JOIN users u ON f.created_by = u.id
        GROUP BY f.id
        ORDER BY f.sort_order ASC, f.created_at ASC
      `).all() as any[];
    } else {
      // Only folders where user has explicit permission or created by them
      folders = await db.prepare(`
        SELECT DISTINCT f.*,
               COUNT(DISTINCT p.id) as po_count,
               u.full_name as creator_name
        FROM po_tracker_folders f
        LEFT JOIN po_tracker_pos p ON p.folder_id = f.id
        LEFT JOIN users u ON f.created_by = u.id
        WHERE f.created_by = ?
           OR EXISTS (
             SELECT 1 FROM po_tracker_permissions perm
             WHERE perm.user_id = ?
               AND (
                 (perm.resource_type = 'folder' AND perm.resource_id = f.id)
                 OR perm.resource_type = 'global'
               )
           )
        GROUP BY f.id
        ORDER BY f.sort_order ASC, f.created_at ASC
      `).all(userId, userId) as any[];
    }

    return { success: true, data: folders };
  });

  /**
   * POST /folders — Create a new folder (any authenticated user)
   */
  fastify.post('/folders', async (request: any, reply) => {
    const db = getDb();
    const { name, description, color, icon, sort_order } = (request.body as any) || {};

    if (!name || !name.trim()) {
      return reply.code(400).send({ success: false, message: 'Tên nhóm không được để trống.' });
    }

    const id = uuidv4();
    const now = new Date().toISOString();
    const userId = request.user?.id;

    await db.prepare(`
      INSERT INTO po_tracker_folders (id, name, description, color, icon, sort_order, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, name.trim(), description || null, color || 'blue', icon || 'shippingbox', sort_order ?? 0, userId, now, now);

    // Auto-grant admin permission to creator
    await db.prepare(`
      INSERT INTO po_tracker_permissions (id, user_id, resource_type, resource_id, permission, granted_by, created_at)
      VALUES (?, ?, 'folder', ?, 'admin', ?, ?)
    `).run(uuidv4(), userId, id, userId, now);

    auditLog(request, 'CREATE_PO_FOLDER', 'po_tracker_folders', id, null, { name });

    const folder = await db.prepare('SELECT * FROM po_tracker_folders WHERE id = ?').get(id);
    return { success: true, data: { ...folder, po_count: 0 } };
  });

  /**
   * PUT /folders/:id — Update folder
   */
  fastify.put('/folders/:id', async (request: any, reply) => {
    const db = getDb();
    const { id } = request.params as any;
    const userId = request.user?.id;
    const userRole = request.user?.role;

    const existing = await db.prepare('SELECT * FROM po_tracker_folders WHERE id = ?').get(id) as any;
    if (!existing) return reply.code(404).send({ success: false, message: 'Nhóm không tồn tại.' });

    const perm = await getUserPermissionOnFolder(db, userId, userRole, id);
    if (!perm || !hasPermission(perm, 'edit')) {
      return reply.code(403).send({ success: false, message: 'Bạn không có quyền chỉnh sửa nhóm này.' });
    }

    const { name, description, color, icon, sort_order } = (request.body as any) || {};
    const now = new Date().toISOString();

    await db.prepare(`
      UPDATE po_tracker_folders
      SET name = ?, description = ?, color = ?, icon = ?, sort_order = ?, updated_at = ?
      WHERE id = ?
    `).run(
      name?.trim() || existing.name,
      description ?? existing.description,
      color || existing.color,
      icon || existing.icon,
      sort_order ?? existing.sort_order,
      now,
      id
    );

    auditLog(request, 'UPDATE_PO_FOLDER', 'po_tracker_folders', id, existing, request.body);
    const updated = await db.prepare('SELECT * FROM po_tracker_folders WHERE id = ?').get(id);
    return { success: true, data: updated };
  });

  /**
   * DELETE /folders/:id — Delete folder (admin permission required)
   */
  fastify.delete('/folders/:id', async (request: any, reply) => {
    const db = getDb();
    const { id } = request.params as any;
    const userId = request.user?.id;
    const userRole = request.user?.role;

    const existing = await db.prepare('SELECT * FROM po_tracker_folders WHERE id = ?').get(id) as any;
    if (!existing) return reply.code(404).send({ success: false, message: 'Nhóm không tồn tại.' });

    const perm = await getUserPermissionOnFolder(db, userId, userRole, id);
    if (!perm || !hasPermission(perm, 'admin')) {
      return reply.code(403).send({ success: false, message: 'Bạn cần quyền Quản trị để xóa nhóm này.' });
    }

    // Unlink POs from this folder (don't delete the POs)
    await db.prepare('UPDATE po_tracker_pos SET folder_id = NULL WHERE folder_id = ?').run(id);
    // Delete permissions for this folder
    await db.prepare("DELETE FROM po_tracker_permissions WHERE resource_type = 'folder' AND resource_id = ?").run(id);
    await db.prepare('DELETE FROM po_tracker_folders WHERE id = ?').run(id);

    auditLog(request, 'DELETE_PO_FOLDER', 'po_tracker_folders', id, existing, null);
    return { success: true, message: 'Đã xóa nhóm. Các PO trong nhóm được giữ lại.' };
  });

  // ─────────────────────────────────────────────────────────
  // PURCHASE ORDERS
  // ─────────────────────────────────────────────────────────

  /**
   * GET /pos — List POs with filters
   */
  fastify.get('/pos', async (request: any, reply) => {
    const db = getDb();
    const userId = request.user?.id;
    const userRole = request.user?.role;
    const { folder_id, status, search } = request.query as any;

    let query = `
      SELECT p.*,
             f.name as folder_name, f.color as folder_color,
             u.full_name as creator_name,
             COUNT(DISTINCT pi.id) as item_count,
             CAST(julianday('now') - julianday(p.expected_delivery_date) AS INTEGER) as days_overdue
      FROM po_tracker_pos p
      LEFT JOIN po_tracker_folders f ON p.folder_id = f.id
      LEFT JOIN users u ON p.created_by = u.id
      LEFT JOIN po_tracker_items pi ON pi.po_id = p.id
      WHERE 1=1
    `;
    const params: any[] = [];

    // Permission filter for non-admins
    if (userRole !== 'admin') {
      query += `
        AND (
          p.created_by = ?
          OR EXISTS (
            SELECT 1 FROM po_tracker_permissions perm
            WHERE perm.user_id = ?
              AND (
                (perm.resource_type = 'po' AND perm.resource_id = p.id)
                OR (perm.resource_type = 'folder' AND perm.resource_id = p.folder_id)
                OR perm.resource_type = 'global'
              )
          )
        )
      `;
      params.push(userId, userId);
    }

    if (folder_id === 'unassigned') {
      query += ' AND p.folder_id IS NULL';
    } else if (folder_id) {
      query += ' AND p.folder_id = ?';
      params.push(folder_id);
    }

    if (status) {
      query += ' AND p.status = ?';
      params.push(status);
    }

    if (search) {
      query += ' AND (p.po_number LIKE ? OR p.supplier_name LIKE ? OR p.supplier_code LIKE ? OR p.warehouse LIKE ?)';
      const like = `%${search}%`;
      params.push(like, like, like, like);
    }

    query += ' GROUP BY p.id ORDER BY p.created_at DESC';

    const records = await db.prepare(query).all(...params) as any[];

    // Parse tags JSON
    const data = records.map((r: any) => ({
      ...r,
      tags: r.tags ? JSON.parse(r.tags) : []
    }));

    return { success: true, data };
  });

  /**
   * GET /pos/:id — Get PO detail with items
   */
  fastify.get('/pos/:id', async (request: any, reply) => {
    const db = getDb();
    const { id } = request.params as any;
    const userId = request.user?.id;
    const userRole = request.user?.role;

    const po = await db.prepare(`
      SELECT p.*, f.name as folder_name, f.color as folder_color, u.full_name as creator_name
      FROM po_tracker_pos p
      LEFT JOIN po_tracker_folders f ON p.folder_id = f.id
      LEFT JOIN users u ON p.created_by = u.id
      WHERE p.id = ?
    `).get(id) as any;

    if (!po) return reply.code(404).send({ success: false, message: 'Không tìm thấy đơn hàng.' });

    const perm = await getUserPermissionOnPO(db, userId, userRole, id, po.folder_id);
    if (!perm) {
      return reply.code(403).send({ success: false, message: 'Bạn không có quyền xem đơn hàng này.' });
    }

    const items = await db.prepare('SELECT * FROM po_tracker_items WHERE po_id = ? ORDER BY rowid').all(id) as any[];
    const permissions = userRole === 'admin' ? await db.prepare(`
      SELECT perm.*, u.full_name as user_name, u.email
      FROM po_tracker_permissions perm
      JOIN users u ON perm.user_id = u.id
      WHERE perm.resource_type = 'po' AND perm.resource_id = ?
    `).all(id) : [];

    return {
      success: true,
      data: {
        ...po,
        tags: po.tags ? JSON.parse(po.tags) : [],
        items,
        permissions,
        user_permission: perm
      }
    };
  });

  /**
   * POST /pos — Create a new PO
   */
  fastify.post('/pos', async (request: any, reply) => {
    const db = getDb();
    const userId = request.user?.id;
    const userRole = request.user?.role;
    const body = (request.body as any) || {};

    const {
      folder_id, po_number, po_date, expected_delivery_date,
      supplier_code, supplier_name, warehouse,
      total_value, currency, notes, tags,
      extracted_data, pdf_file_name, items = []
    } = body;

    // If folder specified, check user has at least view permission to it
    if (folder_id) {
      const folderPerm = await getUserPermissionOnFolder(db, userId, userRole, folder_id);
      if (!folderPerm || !hasPermission(folderPerm, 'view')) {
        return reply.code(403).send({ success: false, message: 'Bạn không có quyền thêm PO vào nhóm này.' });
      }
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    await db.transaction(async (tx: IDatabaseAdapter) => {
      await tx.prepare(`
        INSERT INTO po_tracker_pos (
          id, folder_id, po_number, po_date, expected_delivery_date,
          supplier_code, supplier_name, warehouse, status, total_value, currency,
          notes, tags, extracted_data, pdf_file_name, created_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id, folder_id || null, po_number || null, po_date || null,
        expected_delivery_date || null, supplier_code || null,
        supplier_name || null, warehouse || null,
        total_value ? Number(total_value) : 0,
        currency || 'VND', notes || null,
        tags ? JSON.stringify(tags) : null,
        extracted_data ? JSON.stringify(extracted_data) : null,
        pdf_file_name || null,
        userId, now, now
      );

      // Auto-grant admin to creator
      await tx.prepare(`
        INSERT INTO po_tracker_permissions (id, user_id, resource_type, resource_id, permission, granted_by, created_at)
        VALUES (?, ?, 'po', ?, 'admin', ?, ?)
      `).run(uuidv4(), userId, id, userId, now);

      // Insert line items
      if (items.length > 0) {
        for (const item of items) {
          await tx.prepare(`
            INSERT INTO po_tracker_items (id, po_id, item_code, item_name, unit, ordered_qty, received_qty, unit_price, total_price, warehouse, notes, status)
            VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, 'pending')
          `).run(
            uuidv4(), id,
            item.item_code || null,
            item.item_name || '',
            item.unit || 'thùng',
            Number(item.ordered_qty || 0),
            Number(item.unit_price || 0),
            Number(item.total_price || (item.ordered_qty * item.unit_price) || 0),
            item.warehouse || null,
            item.notes || null
          );
        }
      }
    });

    auditLog(request, 'CREATE_PO_TRACKER', 'po_tracker_pos', id, null, { po_number, supplier_name });
    const created = await db.prepare('SELECT * FROM po_tracker_pos WHERE id = ?').get(id) as any;
    return { success: true, data: { ...created, tags: tags || [] } };
  });

  /**
   * PUT /pos/:id — Update PO metadata
   */
  fastify.put('/pos/:id', async (request: any, reply) => {
    const db = getDb();
    const { id } = request.params as any;
    const userId = request.user?.id;
    const userRole = request.user?.role;

    const existing = await db.prepare('SELECT * FROM po_tracker_pos WHERE id = ?').get(id) as any;
    if (!existing) return reply.code(404).send({ success: false, message: 'Không tìm thấy đơn hàng.' });

    const perm = await getUserPermissionOnPO(db, userId, userRole, id, existing.folder_id);
    if (!perm || !hasPermission(perm, 'edit')) {
      return reply.code(403).send({ success: false, message: 'Bạn không có quyền chỉnh sửa đơn hàng này.' });
    }

    const body = (request.body as any) || {};
    const now = new Date().toISOString();

    await db.prepare(`
      UPDATE po_tracker_pos
      SET folder_id = ?, po_number = ?, po_date = ?, expected_delivery_date = ?,
          actual_delivery_date = ?, supplier_code = ?, supplier_name = ?,
          warehouse = ?, total_value = ?, currency = ?, notes = ?, tags = ?,
          pdf_file_name = ?, updated_at = ?
      WHERE id = ?
    `).run(
      body.folder_id ?? existing.folder_id,
      body.po_number ?? existing.po_number,
      body.po_date ?? existing.po_date,
      body.expected_delivery_date ?? existing.expected_delivery_date,
      body.actual_delivery_date ?? existing.actual_delivery_date,
      body.supplier_code ?? existing.supplier_code,
      body.supplier_name ?? existing.supplier_name,
      body.warehouse ?? existing.warehouse,
      body.total_value != null ? Number(body.total_value) : existing.total_value,
      body.currency ?? existing.currency,
      body.notes ?? existing.notes,
      body.tags != null ? JSON.stringify(body.tags) : existing.tags,
      body.pdf_file_name ?? existing.pdf_file_name,
      now, id
    );

    // Handle items update if provided
    if (Array.isArray(body.items)) {
      await db.prepare('DELETE FROM po_tracker_items WHERE po_id = ?').run(id);
      if (body.items.length > 0) {
        for (const item of body.items) {
          await db.prepare(`
            INSERT INTO po_tracker_items (id, po_id, item_code, item_name, unit, ordered_qty, received_qty, unit_price, total_price, warehouse, notes, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            item.id || uuidv4(), id,
            item.item_code || null, item.item_name || '',
            item.unit || 'thùng',
            Number(item.ordered_qty || 0), Number(item.received_qty || 0),
            Number(item.unit_price || 0), Number(item.total_price || 0),
            item.warehouse || null, item.notes || null,
            item.status || 'pending'
          );
        }
      }
    }

    auditLog(request, 'UPDATE_PO_TRACKER', 'po_tracker_pos', id, existing, body);
    const updated = await db.prepare('SELECT * FROM po_tracker_pos WHERE id = ?').get(id) as any;
    return { success: true, data: { ...updated, tags: updated.tags ? JSON.parse(updated.tags) : [] } };
  });

  /**
   * PATCH /pos/:id/status — Update PO delivery status
   */
  fastify.patch('/pos/:id/status', async (request: any, reply) => {
    const db = getDb();
    const { id } = request.params as any;
    const userId = request.user?.id;
    const userRole = request.user?.role;

    const existing = await db.prepare('SELECT * FROM po_tracker_pos WHERE id = ?').get(id) as any;
    if (!existing) return reply.code(404).send({ success: false, message: 'Không tìm thấy đơn hàng.' });

    const perm = await getUserPermissionOnPO(db, userId, userRole, id, existing.folder_id);
    if (!perm || !hasPermission(perm, 'edit')) {
      return reply.code(403).send({ success: false, message: 'Bạn không có quyền cập nhật trạng thái đơn hàng này.' });
    }

    const { status, actual_delivery_date, notes } = (request.body as any) || {};
    const validStatuses = ['pending', 'confirmed', 'shipping', 'partial_received', 'received', 'cancelled', 'overdue'];
    if (!status || !validStatuses.includes(status)) {
      return reply.code(400).send({ success: false, message: `Trạng thái không hợp lệ. Các giá trị: ${validStatuses.join(', ')}` });
    }

    const now = new Date().toISOString();
    const updateNotes = notes != null ? notes : existing.notes;
    const updateDelivery = actual_delivery_date || (status === 'received' ? now.split('T')[0] : existing.actual_delivery_date);

    await db.prepare(`
      UPDATE po_tracker_pos SET status = ?, actual_delivery_date = ?, notes = ?, updated_at = ? WHERE id = ?
    `).run(status, updateDelivery, updateNotes, now, id);

    auditLog(request, 'UPDATE_PO_STATUS', 'po_tracker_pos', id, { status: existing.status }, { status });
    return { success: true, message: `Đã cập nhật trạng thái PO sang "${status}".` };
  });

  /**
   * DELETE /pos/:id — Delete PO
   */
  fastify.delete('/pos/:id', async (request: any, reply) => {
    const db = getDb();
    const { id } = request.params as any;
    const userId = request.user?.id;
    const userRole = request.user?.role;

    const existing = await db.prepare('SELECT * FROM po_tracker_pos WHERE id = ?').get(id) as any;
    if (!existing) return reply.code(404).send({ success: false, message: 'Không tìm thấy đơn hàng.' });

    const perm = await getUserPermissionOnPO(db, userId, userRole, id, existing.folder_id);
    if (!perm || !hasPermission(perm, 'admin')) {
      return reply.code(403).send({ success: false, message: 'Bạn cần quyền Quản trị để xóa đơn hàng này.' });
    }

    await db.prepare('DELETE FROM po_tracker_items WHERE po_id = ?').run(id);
    await db.prepare("DELETE FROM po_tracker_permissions WHERE resource_type = 'po' AND resource_id = ?").run(id);
    await db.prepare('DELETE FROM po_tracker_pos WHERE id = ?').run(id);

    auditLog(request, 'DELETE_PO_TRACKER', 'po_tracker_pos', id, existing, null);
    return { success: true, message: 'Đã xóa đơn hàng thành công.' };
  });

  // ─────────────────────────────────────────────────────────
  // PERMISSIONS MANAGEMENT
  // ─────────────────────────────────────────────────────────

  /**
   * GET /permissions/:resourceType/:resourceId — List permissions for a resource
   */
  fastify.get('/permissions/:resourceType/:resourceId', async (request: any, reply) => {
    const db = getDb();
    const { resourceType, resourceId } = request.params as any;
    const userId = request.user?.id;
    const userRole = request.user?.role;

    // Only admin or resource admin can view permissions
    if (userRole !== 'admin') {
      const perm = resourceType === 'folder'
        ? await getUserPermissionOnFolder(db, userId, userRole, resourceId)
        : await getUserPermissionOnPO(db, userId, userRole, resourceId, null);
      if (!perm || !hasPermission(perm, 'admin')) {
        return reply.code(403).send({ success: false, message: 'Bạn không có quyền xem danh sách phân quyền.' });
      }
    }

    const perms = await db.prepare(`
      SELECT perm.*, u.full_name as user_name, u.email,
             gb.full_name as granted_by_name
      FROM po_tracker_permissions perm
      JOIN users u ON perm.user_id = u.id
      LEFT JOIN users gb ON perm.granted_by = gb.id
      WHERE perm.resource_type = ? AND perm.resource_id = ?
      ORDER BY perm.created_at DESC
    `).all(resourceType, resourceId);

    return { success: true, data: perms };
  });

  /**
   * POST /permissions — Grant permission to a user
   */
  fastify.post('/permissions', async (request: any, reply) => {
    const db = getDb();
    const userId = request.user?.id;
    const userRole = request.user?.role;
    const { target_user_id, resource_type, resource_id, permission } = (request.body as any) || {};

    if (!target_user_id || !resource_type || !permission) {
      return reply.code(400).send({ success: false, message: 'Thiếu thông tin cấp quyền.' });
    }

    const validPerms = ['view', 'comment', 'edit', 'admin'];
    if (!validPerms.includes(permission)) {
      return reply.code(400).send({ success: false, message: 'Quyền không hợp lệ.' });
    }

    // Check granting user has admin permission on the resource
    if (userRole !== 'admin') {
      const myPerm = resource_type === 'folder'
        ? await getUserPermissionOnFolder(db, userId, userRole, resource_id)
        : await getUserPermissionOnPO(db, userId, userRole, resource_id, null);
      if (!myPerm || !hasPermission(myPerm, 'admin')) {
        return reply.code(403).send({ success: false, message: 'Bạn cần quyền Quản trị để cấp quyền cho người khác.' });
      }
    }

    // Verify target user exists
    const targetUser = await db.prepare('SELECT id FROM users WHERE id = ?').get(target_user_id);
    if (!targetUser) return reply.code(404).send({ success: false, message: 'Không tìm thấy người dùng.' });

    const now = new Date().toISOString();

    // Upsert: if permission exists, update it
    const existing = await db.prepare(`
      SELECT id FROM po_tracker_permissions WHERE user_id = ? AND resource_type = ? AND resource_id IS ?
    `).get(target_user_id, resource_type, resource_id || null) as any;

    if (existing) {
      await db.prepare(`UPDATE po_tracker_permissions SET permission = ?, granted_by = ?, created_at = ? WHERE id = ?`).run(permission, userId, now, existing.id);
    } else {
      await db.prepare(`
        INSERT INTO po_tracker_permissions (id, user_id, resource_type, resource_id, permission, granted_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(uuidv4(), target_user_id, resource_type, resource_id || null, permission, userId, now);
    }

    return { success: true, message: 'Đã cấp quyền thành công.' };
  });

  /**
   * DELETE /permissions/:id — Revoke a permission
   */
  fastify.delete('/permissions/:id', async (request: any, reply) => {
    const db = getDb();
    const { id } = request.params as any;
    const userId = request.user?.id;
    const userRole = request.user?.role;

    const perm = await db.prepare('SELECT * FROM po_tracker_permissions WHERE id = ?').get(id) as any;
    if (!perm) return reply.code(404).send({ success: false, message: 'Quyền không tồn tại.' });

    if (userRole !== 'admin') {
      const myPerm = perm.resource_type === 'folder'
        ? await getUserPermissionOnFolder(db, userId, userRole, perm.resource_id)
        : await getUserPermissionOnPO(db, userId, userRole, perm.resource_id, null);
      if (!myPerm || !hasPermission(myPerm, 'admin')) {
        return reply.code(403).send({ success: false, message: 'Bạn không có quyền thu hồi phân quyền này.' });
      }
    }

    await db.prepare('DELETE FROM po_tracker_permissions WHERE id = ?').run(id);
    return { success: true, message: 'Đã thu hồi quyền thành công.' };
  });

  // ─────────────────────────────────────────────────────────
  // STATS & DASHBOARD
  // ─────────────────────────────────────────────────────────

  /**
   * GET /stats — Aggregated statistics
   */
  fastify.get('/stats', async (request: any, reply) => {
    const db = getDb();
    const userId = request.user?.id;
    const userRole = request.user?.role;
    const { folder_id } = request.query as any;

    let baseFilter = '';
    const params: any[] = [];

    if (userRole !== 'admin') {
      baseFilter += `
        AND (
          p.created_by = ?
          OR EXISTS (
            SELECT 1 FROM po_tracker_permissions perm
            WHERE perm.user_id = ?
              AND (
                (perm.resource_type = 'po' AND perm.resource_id = p.id)
                OR (perm.resource_type = 'folder' AND perm.resource_id = p.folder_id)
                OR perm.resource_type = 'global'
              )
          )
        )
      `;
      params.push(userId, userId);
    }

    if (folder_id === 'unassigned') {
      baseFilter += ' AND p.folder_id IS NULL';
    } else if (folder_id) {
      baseFilter += ' AND p.folder_id = ?';
      params.push(folder_id);
    }

    const today = new Date().toISOString().split('T')[0];
    const in7Days = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const rows = await db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) as confirmed,
        SUM(CASE WHEN status = 'shipping' THEN 1 ELSE 0 END) as shipping,
        SUM(CASE WHEN status = 'partial_received' THEN 1 ELSE 0 END) as partial_received,
        SUM(CASE WHEN status = 'received' THEN 1 ELSE 0 END) as received,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
        SUM(CASE WHEN status = 'overdue' THEN 1 ELSE 0 END) as overdue,
        SUM(CASE WHEN status NOT IN ('received','cancelled') AND expected_delivery_date < ? THEN 1 ELSE 0 END) as actually_overdue,
        SUM(CASE WHEN status NOT IN ('received','cancelled') AND expected_delivery_date BETWEEN ? AND ? THEN 1 ELSE 0 END) as upcoming_7_days,
        COALESCE(SUM(total_value), 0) as total_value
      FROM po_tracker_pos p
      WHERE 1=1 ${baseFilter}
    `).get(today, today, in7Days, ...params) as any;

    return { success: true, data: rows || {} };
  });
}
