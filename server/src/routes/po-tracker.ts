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

  // Creator always has full access to their own PO
  const po = await db.prepare('SELECT created_by FROM po_tracker_pos WHERE id = ?').get(poId) as any;
  if (po && po.created_by === userId) return 'admin';

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

const VALID_STATUSES = ['pending', 'confirmed', 'shipping', 'partial_received', 'received', 'cancelled', 'overdue'] as const;

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
    let textContent = '';

    // Check if body was sent as JSON (base64 DataURL, direct base64, or digital text)
    if (request.body && typeof request.body === 'object') {
      const {
        fileDataUrl,
        dataUrl,
        base64,
        file,
        fileName: bFileName,
        mimeType: bMime,
        apiKeys: bKeys,
        textContent: bText,
        digitalText: bDigitalText,
      } = request.body;

      if (bText && typeof bText === 'string') textContent = bText;
      else if (bDigitalText && typeof bDigitalText === 'string') textContent = bDigitalText;

      const rawUrl = fileDataUrl || dataUrl || base64 || file;
      if (rawUrl && typeof rawUrl === 'string') {
        const commaIdx = rawUrl.indexOf(',');
        if (commaIdx !== -1 && rawUrl.startsWith('data:')) {
          const meta = rawUrl.slice(0, commaIdx);
          const mimeMatch = meta.match(/data:([^;]+)/i);
          if (mimeMatch && mimeMatch[1]) {
            mimeType = mimeMatch[1].trim();
          }
          base64Data = rawUrl.slice(commaIdx + 1);
        } else {
          base64Data = rawUrl;
        }
        // Eliminate whitespace and newlines that break decoding
        base64Data = base64Data.replace(/\s+/g, '');
      }

      if (bFileName) fileName = bFileName;
      if (bMime) mimeType = bMime;
      if (Array.isArray(bKeys)) apiKeys = bKeys;
    }

    // Fall back to multipart streaming if not JSON
    if (!base64Data && !textContent && request.file) {
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

    if (!base64Data && !textContent) {
      return reply.code(400).send({ success: false, message: 'Không tìm thấy dữ liệu tệp hoặc văn bản được tải lên.' });
    }

    try {
      const extractedData = await geminiService.extractPOFromPdf(base64Data, fileName, mimeType, apiKeys, textContent);
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
      folders = await db.prepare(`
        SELECT f.*,
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

    await db.transaction(async (tx: IDatabaseAdapter) => {
      await tx.prepare(`
        INSERT INTO po_tracker_folders (id, name, description, color, icon, sort_order, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, name.trim(), description || null, color || 'blue', icon || 'shippingbox', sort_order ?? 0, userId, now, now);

      // Auto-grant admin permission to creator
      await tx.prepare(`
        INSERT INTO po_tracker_permissions (id, user_id, resource_type, resource_id, permission, granted_by, created_at)
        VALUES (?, ?, 'folder', ?, 'admin', ?, ?)
      `).run(uuidv4(), userId, id, userId, now);
    });

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
      description !== undefined ? description : existing.description,
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

    await db.transaction(async (tx: IDatabaseAdapter) => {
      // Unlink POs from this folder (don't delete the POs)
      await tx.prepare('UPDATE po_tracker_pos SET folder_id = NULL WHERE folder_id = ?').run(id);
      // Delete permissions for this folder
      await tx.prepare("DELETE FROM po_tracker_permissions WHERE resource_type = 'folder' AND resource_id = ?").run(id);
      await tx.prepare('DELETE FROM po_tracker_folders WHERE id = ?').run(id);
    });

    auditLog(request, 'DELETE_PO_FOLDER', 'po_tracker_folders', id, existing, null);
    return { success: true, message: 'Đã xóa nhóm. Các PO trong nhóm được giữ lại.' };
  });

  // ─────────────────────────────────────────────────────────
  // PURCHASE ORDERS
  // ─────────────────────────────────────────────────────────

  /**
   * GET /pos — List POs with filters & progress %
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
             COALESCE(SUM(pi.ordered_qty), 0) as total_ordered_qty,
             COALESCE(SUM(pi.received_qty), 0) as total_received_qty,
             CASE
               WHEN p.status IN ('received', 'cancelled') THEN 0
               WHEN p.expected_delivery_date IS NULL THEN 0
               WHEN date('now', 'localtime') > date(p.expected_delivery_date)
                 THEN CAST(julianday(date('now', 'localtime')) - julianday(p.expected_delivery_date) AS INTEGER)
               ELSE 0
             END as days_overdue
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
    } else if (folder_id && folder_id !== 'all') {
      query += ' AND p.folder_id = ?';
      params.push(folder_id);
    }

    if (status === 'overdue') {
      query += " AND (p.status = 'overdue' OR (p.status NOT IN ('received', 'cancelled') AND p.expected_delivery_date IS NOT NULL AND p.expected_delivery_date < ?))";
      params.push(new Date().toISOString().split('T')[0]);
    } else if (status === 'upcoming_7_days') {
      const now = new Date();
      const today = now.toISOString().split('T')[0];
      const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      query += " AND (p.status NOT IN ('received', 'cancelled') AND p.expected_delivery_date IS NOT NULL AND p.expected_delivery_date BETWEEN ? AND ?)";
      params.push(today, in7Days);
    } else if (status && status !== 'all') {
      query += ' AND p.status = ?';
      params.push(status);
    }

    if (search && search.trim()) {
      const trimmed = search.trim();
      const like = `%${trimmed}%`;
      query += ` AND (
        p.po_number LIKE ?
        OR p.supplier_name LIKE ?
        OR p.supplier_code LIKE ?
        OR p.warehouse LIKE ?
        OR p.notes LIKE ?
        OR EXISTS (
          SELECT 1 FROM po_tracker_items pi2
          WHERE pi2.po_id = p.id AND (pi2.item_code LIKE ? OR pi2.item_name LIKE ?)
        )
      )`;
      params.push(like, like, like, like, like, like, like);
    }

    query += ' GROUP BY p.id ORDER BY p.created_at DESC';

    const records = await db.prepare(query).all(...params) as any[];

    // Parse tags JSON & calculate progress percentage
    const data = records.map((r: any) => {
      const ordered = Number(r.total_ordered_qty) || 0;
      const received = Number(r.total_received_qty) || 0;
      const progress = ordered > 0
        ? Math.min(100, Math.round((received / ordered) * 100))
        : (r.status === 'received' ? 100 : 0);

      let parsedTags: string[] = [];
      if (r.tags) {
        try {
          parsedTags = typeof r.tags === 'string' ? JSON.parse(r.tags) : r.tags;
        } catch (_) {}
      }

      return {
        ...r,
        progress,
        tags: parsedTags
      };
    });

    return { success: true, data };
  });

  /**
   * GET /pos/:id — Get PO detail with items & calculated progress
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

    const totalOrdered = items.reduce((s, it) => s + (Number(it.ordered_qty) || 0), 0);
    const totalReceived = items.reduce((s, it) => s + (Number(it.received_qty) || 0), 0);
    const progress = totalOrdered > 0
      ? Math.min(100, Math.round((totalReceived / totalOrdered) * 100))
      : (po.status === 'received' ? 100 : 0);

    const todayStr = new Date().toISOString().split('T')[0];
    let daysOverdue = 0;
    if (po.expected_delivery_date && !['received', 'cancelled'].includes(po.status)) {
      const expTime = new Date(po.expected_delivery_date).getTime();
      const todayTime = new Date(todayStr).getTime();
      if (todayTime > expTime) {
        daysOverdue = Math.floor((todayTime - expTime) / (24 * 60 * 60 * 1000));
      }
    }

    let parsedTags: string[] = [];
    if (po.tags) {
      try {
        parsedTags = typeof po.tags === 'string' ? JSON.parse(po.tags) : po.tags;
      } catch (_) {}
    }

    return {
      success: true,
      data: {
        ...po,
        tags: parsedTags,
        items,
        item_count: items.length,
        total_ordered_qty: totalOrdered,
        total_received_qty: totalReceived,
        progress,
        days_overdue: daysOverdue,
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
      folder_id, po_number, po_date, expected_delivery_date, actual_delivery_date,
      supplier_code, supplier_name, warehouse, status: initialStatus,
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

    const userRow = userId ? (await db.prepare('SELECT id FROM users WHERE id = ?').get(userId) as any) : null;
    const validUserId = userRow ? userId : null;

    let computedTotalValue = total_value != null ? Number(total_value) : 0;
    if (computedTotalValue === 0 && Array.isArray(items) && items.length > 0) {
      computedTotalValue = items.reduce((sum: number, it: any) => {
        const lineTotal = Number(it.total_price) || ((Number(it.ordered_qty) || 0) * (Number(it.unit_price) || 0));
        return sum + lineTotal;
      }, 0);
    }

    const validInitialStatus = initialStatus && VALID_STATUSES.includes(initialStatus) ? initialStatus : 'pending';
    const finalDeliveryDate = actual_delivery_date || (validInitialStatus === 'received' ? now.split('T')[0] : null);

    const subTotalPreVat = Number(body.subTotalPreVat || body.sub_total_pre_vat || computedTotalValue || 0);
    const orderDiscountAmount = Number(body.orderDiscountAmount || body.order_discount_amount || 0);
    const totalVat = Number(body.totalVat || body.total_vat || Math.round(subTotalPreVat * 0.08));
    const grandTotal = Number(body.grandTotal || body.grand_total || (subTotalPreVat + totalVat));

    await db.transaction(async (tx: IDatabaseAdapter) => {
      await tx.prepare(`
        INSERT INTO po_tracker_pos (
          id, folder_id, po_number, po_date, expected_delivery_date, actual_delivery_date,
          supplier_code, supplier_name, warehouse, status, sub_total_pre_vat, order_discount_amount,
          total_vat, grand_total, total_value, currency,
          notes, tags, extracted_data, pdf_file_name, created_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id, folder_id || null, po_number || null, po_date || null,
        expected_delivery_date || null, finalDeliveryDate, supplier_code || null,
        supplier_name || null, warehouse || null,
        validInitialStatus,
        subTotalPreVat, orderDiscountAmount, totalVat, grandTotal,
        computedTotalValue,
        currency || 'VND', notes || null,
        tags ? JSON.stringify(tags) : null,
        extracted_data ? (typeof extracted_data === 'string' ? extracted_data : JSON.stringify(extracted_data)) : null,
        pdf_file_name || null,
        validUserId, now, now
      );

      // Insert line items
      if (Array.isArray(items) && items.length > 0) {
        for (const item of items) {
          const ordQty = Number(item.ordered_qty || 0);
          const recQty = Number(item.received_qty || 0);
          const uPrice = Number(item.unit_price || 0);
          const discountPct = Number(item.discountPct ?? item.discount_pct ?? 0);
          const vatPct = Number(item.vatPct ?? item.vat_pct ?? 8);
          const tPrice = Number(item.total_price || (ordQty * uPrice * (1 - discountPct / 100)) || 0);
          const linePreVat = Number(item.linePreVatTotal ?? item.line_pre_vat_total ?? tPrice);
          const lineVat = Number(item.lineVatAmount ?? item.line_vat_amount ?? Math.round((linePreVat * vatPct) / 100));
          const lineGross = Number(item.lineGrossTotal ?? item.line_gross_total ?? (linePreVat + lineVat));
          const itemStatus = item.status || (recQty >= ordQty && ordQty > 0 ? 'received' : recQty > 0 ? 'partial' : 'pending');

          await tx.prepare(`
            INSERT INTO po_tracker_items (
              id, po_id, item_code, barcode, item_name, unit, ordered_qty, received_qty,
              unit_price, discount_pct, vat_pct, line_pre_vat_total, line_vat_amount, line_gross_total,
              total_price, warehouse, notes, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            item.id || uuidv4(), id,
            item.item_code || null,
            item.barcode || null,
            item.item_name || '',
            item.unit || 'thùng',
            ordQty, recQty,
            uPrice, discountPct, vatPct, linePreVat, lineVat, lineGross,
            tPrice,
            item.warehouse || null,
            item.notes || null,
            itemStatus
          );
        }
      }

      // Auto-grant admin permission to creator if valid user
      if (validUserId) {
        await tx.prepare(`
          INSERT INTO po_tracker_permissions (id, user_id, resource_type, resource_id, permission, granted_by, created_at)
          VALUES (?, ?, 'po', ?, 'admin', ?, ?)
        `).run(uuidv4(), validUserId, id, validUserId, now);
      }
    });

    auditLog(request, 'CREATE_PO_TRACKER', 'po_tracker_pos', id, null, { po_number, supplier_name });
    const created = await db.prepare('SELECT * FROM po_tracker_pos WHERE id = ?').get(id) as any;
    const insertedItems = await db.prepare('SELECT * FROM po_tracker_items WHERE po_id = ? ORDER BY rowid').all(id) as any[];

    return {
      success: true,
      data: {
        ...created,
        tags: tags || [],
        items: insertedItems,
        item_count: insertedItems.length
      }
    };
  });

  /**
   * PUT /pos/:id — Update PO metadata and line items
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

    let newStatus = body.status && VALID_STATUSES.includes(body.status) ? body.status : existing.status;
    let newDeliveryDate = existing.actual_delivery_date;

    if (body.actual_delivery_date !== undefined) {
      newDeliveryDate = body.actual_delivery_date || null;
    } else if (newStatus === 'received') {
      newDeliveryDate = existing.actual_delivery_date || now.split('T')[0];
    } else if (['pending', 'confirmed', 'shipping'].includes(newStatus) && existing.status === 'received') {
      newDeliveryDate = null;
    }

    await db.transaction(async (tx: IDatabaseAdapter) => {
      // Handle items update if provided
      if (Array.isArray(body.items)) {
        await tx.prepare('DELETE FROM po_tracker_items WHERE po_id = ?').run(id);
        if (body.items.length > 0) {
          for (const item of body.items) {
            const ordQty = Number(item.ordered_qty || 0);
            const recQty = Number(item.received_qty || 0);
            const uPrice = Number(item.unit_price || 0);
            const discountPct = Number(item.discountPct ?? item.discount_pct ?? 0);
            const vatPct = Number(item.vatPct ?? item.vat_pct ?? 8);
            const tPrice = Number(item.total_price || (ordQty * uPrice * (1 - discountPct / 100)) || 0);
            const linePreVat = Number(item.linePreVatTotal ?? item.line_pre_vat_total ?? tPrice);
            const lineVat = Number(item.lineVatAmount ?? item.line_vat_amount ?? Math.round((linePreVat * vatPct) / 100));
            const lineGross = Number(item.lineGrossTotal ?? item.line_gross_total ?? (linePreVat + lineVat));
            const itemStat = item.status || (recQty >= ordQty && ordQty > 0 ? 'received' : recQty > 0 ? 'partial' : 'pending');

            await tx.prepare(`
              INSERT INTO po_tracker_items (
                id, po_id, item_code, barcode, item_name, unit, ordered_qty, received_qty,
                unit_price, discount_pct, vat_pct, line_pre_vat_total, line_vat_amount, line_gross_total,
                total_price, warehouse, notes, status
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
              item.id || uuidv4(), id,
              item.item_code || null,
              item.barcode || null,
              item.item_name || '',
              item.unit || 'thùng',
              ordQty, recQty,
              uPrice, discountPct, vatPct, linePreVat, lineVat, lineGross,
              tPrice,
              item.warehouse || null, item.notes || null,
              itemStat
            );
          }

          // Auto-adjust PO status based on items if body.status was not explicitly provided
          if (!body.status) {
            const allItemsRec = body.items.every((it: any) => Number(it.received_qty || 0) >= Number(it.ordered_qty || 0) && Number(it.ordered_qty || 0) > 0);
            const someItemsRec = body.items.some((it: any) => Number(it.received_qty || 0) > 0);
            if (allItemsRec) {
              newStatus = 'received';
              if (!newDeliveryDate) newDeliveryDate = now.split('T')[0];
            } else if (someItemsRec && ['pending', 'confirmed', 'shipping'].includes(existing.status)) {
              newStatus = 'partial_received';
            }
          }
        }
      } else if (newStatus === 'received' && existing.status !== 'received') {
        // If items were not passed, but status changed to received, sync item received quantities
        await tx.prepare(`
          UPDATE po_tracker_items
          SET received_qty = ordered_qty, status = 'received'
          WHERE po_id = ? AND (received_qty = 0 OR received_qty < ordered_qty)
        `).run(id);
      }

      const subTotalPreVat = body.subTotalPreVat !== undefined ? Number(body.subTotalPreVat) : (body.sub_total_pre_vat !== undefined ? Number(body.sub_total_pre_vat) : existing.sub_total_pre_vat);
      const orderDiscountAmount = body.orderDiscountAmount !== undefined ? Number(body.orderDiscountAmount) : (body.order_discount_amount !== undefined ? Number(body.order_discount_amount) : existing.order_discount_amount);
      const totalVat = body.totalVat !== undefined ? Number(body.totalVat) : (body.total_vat !== undefined ? Number(body.total_vat) : existing.total_vat);
      const grandTotal = body.grandTotal !== undefined ? Number(body.grandTotal) : (body.grand_total !== undefined ? Number(body.grand_total) : existing.grand_total);

      await tx.prepare(`
        UPDATE po_tracker_pos
        SET folder_id = ?, po_number = ?, po_date = ?, expected_delivery_date = ?,
            actual_delivery_date = ?, supplier_code = ?, supplier_name = ?,
            warehouse = ?, status = ?, sub_total_pre_vat = ?, order_discount_amount = ?,
            total_vat = ?, grand_total = ?, total_value = ?, currency = ?, notes = ?, tags = ?,
            pdf_file_name = ?, updated_at = ?
        WHERE id = ?
      `).run(
        body.folder_id !== undefined ? (body.folder_id || null) : existing.folder_id,
        body.po_number ?? existing.po_number,
        body.po_date ?? existing.po_date,
        body.expected_delivery_date ?? existing.expected_delivery_date,
        newDeliveryDate,
        body.supplier_code ?? existing.supplier_code,
        body.supplier_name ?? existing.supplier_name,
        body.warehouse ?? existing.warehouse,
        newStatus,
        subTotalPreVat, orderDiscountAmount, totalVat, grandTotal,
        body.total_value != null ? Number(body.total_value) : existing.total_value,
        body.currency ?? existing.currency,
        body.notes ?? existing.notes,
        body.tags != null ? (typeof body.tags === 'string' ? body.tags : JSON.stringify(body.tags)) : existing.tags,
        body.pdf_file_name ?? existing.pdf_file_name,
        now, id
      );
    });

    auditLog(request, 'UPDATE_PO_TRACKER', 'po_tracker_pos', id, existing, body);
    const updated = await db.prepare('SELECT * FROM po_tracker_pos WHERE id = ?').get(id) as any;
    const items = await db.prepare('SELECT * FROM po_tracker_items WHERE po_id = ? ORDER BY rowid').all(id) as any[];

    return {
      success: true,
      data: {
        ...updated,
        tags: updated.tags ? (typeof updated.tags === 'string' ? JSON.parse(updated.tags) : updated.tags) : [],
        items
      }
    };
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

    const { status, actual_delivery_date, notes, sync_items } = (request.body as any) || {};
    if (!status || !VALID_STATUSES.includes(status)) {
      return reply.code(400).send({ success: false, message: `Trạng thái không hợp lệ. Các giá trị: ${VALID_STATUSES.join(', ')}` });
    }

    const now = new Date().toISOString();
    const updateNotes = notes != null ? notes : existing.notes;
    let updateDelivery = existing.actual_delivery_date;

    if (actual_delivery_date !== undefined) {
      updateDelivery = actual_delivery_date || null;
    } else if (status === 'received') {
      updateDelivery = existing.actual_delivery_date || now.split('T')[0];
    } else if (['pending', 'confirmed', 'shipping'].includes(status) && existing.status === 'received') {
      updateDelivery = null;
    }

    await db.transaction(async (tx: IDatabaseAdapter) => {
      await tx.prepare(`
        UPDATE po_tracker_pos SET status = ?, actual_delivery_date = ?, notes = ?, updated_at = ? WHERE id = ?
      `).run(status, updateDelivery, updateNotes, now, id);

      // When marking PO as received, synchronize items unless sync_items is false
      if (status === 'received' && sync_items !== false) {
        await tx.prepare(`
          UPDATE po_tracker_items
          SET received_qty = ordered_qty, status = 'received'
          WHERE po_id = ? AND (received_qty = 0 OR received_qty < ordered_qty)
        `).run(id);
      }
    });

    auditLog(request, 'UPDATE_PO_STATUS', 'po_tracker_pos', id, { status: existing.status }, { status });
    return { success: true, message: `Đã cập nhật trạng thái PO sang "${status}".` };
  });

  /**
   * PATCH /pos/:id/receive — Khớp số lượng giao hàng (delivery matching) & tự động chuyển trạng thái
   */
  fastify.patch('/pos/:id/receive', async (request: any, reply) => {
    const db = getDb();
    const { id } = request.params as any;
    const userId = request.user?.id;
    const userRole = request.user?.role;

    const existing = await db.prepare('SELECT * FROM po_tracker_pos WHERE id = ?').get(id) as any;
    if (!existing) return reply.code(404).send({ success: false, message: 'Không tìm thấy đơn hàng.' });

    const perm = await getUserPermissionOnPO(db, userId, userRole, id, existing.folder_id);
    if (!perm || !hasPermission(perm, 'edit')) {
      return reply.code(403).send({ success: false, message: 'Bạn không có quyền cập nhật nhận hàng cho PO này.' });
    }

    const { items: receivedItems, receive_all, actual_delivery_date, notes } = (request.body as any) || {};
    const now = new Date().toISOString();

    await db.transaction(async (tx: IDatabaseAdapter) => {
      if (receive_all) {
        // Mark all items as fully received
        await tx.prepare(`
          UPDATE po_tracker_items
          SET received_qty = ordered_qty, status = 'received'
          WHERE po_id = ?
        `).run(id);
      } else if (Array.isArray(receivedItems)) {
        for (const item of receivedItems) {
          if (!item.id && !item.item_code) continue;
          const currentItem = await tx.prepare(`
            SELECT * FROM po_tracker_items WHERE po_id = ? AND (id = ? OR item_code = ?)
          `).get(id, item.id || '', item.item_code || '') as any;

          if (currentItem) {
            const newRecQty = Number(item.received_qty != null ? item.received_qty : currentItem.ordered_qty);
            const ordQty = Number(currentItem.ordered_qty || 0);
            const itemStatus = newRecQty >= ordQty && ordQty > 0 ? 'received' : newRecQty > 0 ? 'partial' : 'pending';

            await tx.prepare(`
              UPDATE po_tracker_items
              SET received_qty = ?, status = ?, notes = COALESCE(?, notes)
              WHERE id = ?
            `).run(newRecQty, itemStatus, item.notes || null, currentItem.id);
          }
        }
      }

      // Check overall progress
      const allItems = await tx.prepare('SELECT * FROM po_tracker_items WHERE po_id = ?').all(id) as any[];
      const totalOrdered = allItems.reduce((s, it) => s + (Number(it.ordered_qty) || 0), 0);
      const totalReceived = allItems.reduce((s, it) => s + (Number(it.received_qty) || 0), 0);

      const allFull = allItems.length > 0 && allItems.every(it => Number(it.received_qty) >= Number(it.ordered_qty) && Number(it.ordered_qty) > 0);
      const someRec = totalReceived > 0;

      let nextStatus = existing.status;
      let deliveryDate = existing.actual_delivery_date;

      if (receive_all || allFull) {
        nextStatus = 'received';
        deliveryDate = actual_delivery_date || now.split('T')[0];
      } else if (someRec && ['pending', 'confirmed', 'shipping'].includes(existing.status)) {
        nextStatus = 'partial_received';
      }

      await tx.prepare(`
        UPDATE po_tracker_pos
        SET status = ?, actual_delivery_date = ?, notes = COALESCE(?, notes), updated_at = ?
        WHERE id = ?
      `).run(nextStatus, deliveryDate, notes || null, now, id);
    });

    auditLog(request, 'RECEIVE_PO_ITEMS', 'po_tracker_pos', id, existing, request.body);

    const updated = await db.prepare('SELECT * FROM po_tracker_pos WHERE id = ?').get(id) as any;
    const items = await db.prepare('SELECT * FROM po_tracker_items WHERE po_id = ? ORDER BY rowid').all(id) as any[];
    const totalOrdered = items.reduce((s, it) => s + (Number(it.ordered_qty) || 0), 0);
    const totalReceived = items.reduce((s, it) => s + (Number(it.received_qty) || 0), 0);
    const progress = totalOrdered > 0 ? Math.min(100, Math.round((totalReceived / totalOrdered) * 100)) : (updated.status === 'received' ? 100 : 0);

    return {
      success: true,
      message: 'Cập nhật số lượng giao hàng thành công.',
      data: {
        ...updated,
        tags: updated.tags ? (typeof updated.tags === 'string' ? JSON.parse(updated.tags) : updated.tags) : [],
        items,
        item_count: items.length,
        total_ordered_qty: totalOrdered,
        total_received_qty: totalReceived,
        progress,
        user_permission: perm
      }
    };
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

    await db.transaction(async (tx: IDatabaseAdapter) => {
      await tx.prepare('DELETE FROM po_tracker_items WHERE po_id = ?').run(id);
      await tx.prepare("DELETE FROM po_tracker_permissions WHERE resource_type = 'po' AND resource_id = ?").run(id);
      await tx.prepare('DELETE FROM po_tracker_pos WHERE id = ?').run(id);
    });

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
      LEFT JOIN users u ON perm.user_id = u.id
      LEFT JOIN users gb ON perm.granted_by = gb.id
      WHERE perm.resource_type = ? AND perm.resource_id = ?
      ORDER BY perm.created_at DESC
    `).all(resourceType, resourceId);

    return { success: true, data: perms };
  });

  /**
   * GET /users — List assignable active users for permissions
   */
  fastify.get('/users', async (request: any, reply) => {
    const db = getDb();
    const users = await db.prepare('SELECT id, email, full_name, role FROM users WHERE is_active = 1 OR is_active IS NULL ORDER BY full_name ASC').all() as any[];
    return { success: true, data: users };
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

    // Verify target user exists by ID, email or full name
    const cleanTarget = String(target_user_id).trim();
    const targetUser = await db.prepare(`
      SELECT id, email, full_name FROM users
      WHERE id = ? OR LOWER(email) = LOWER(?) OR LOWER(full_name) = LOWER(?)
    `).get(cleanTarget, cleanTarget, cleanTarget) as any;

    if (!targetUser) {
      return reply.code(404).send({
        success: false,
        message: `Không tìm thấy tài khoản với "${cleanTarget}". Hãy đảm bảo người dùng đã tạo tài khoản.`
      });
    }

    const actualTargetId = targetUser.id;
    const now = new Date().toISOString();

    // Upsert: if permission exists, update it
    const existing = await db.prepare(`
      SELECT id FROM po_tracker_permissions WHERE user_id = ? AND resource_type = ? AND resource_id IS ?
    `).get(actualTargetId, resource_type, resource_id || null) as any;

    if (existing) {
      await db.prepare(`UPDATE po_tracker_permissions SET permission = ?, granted_by = ?, created_at = ? WHERE id = ?`).run(permission, userId, now, existing.id);
    } else {
      await db.prepare(`
        INSERT INTO po_tracker_permissions (id, user_id, resource_type, resource_id, permission, granted_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(uuidv4(), actualTargetId, resource_type, resource_id || null, permission, userId, now);
    }

    auditLog(request, 'GRANT_PO_PERMISSION', 'po_tracker_permissions', actualTargetId, existing, { resource_type, resource_id, permission });
    return { success: true, message: `Đã cấp quyền cho ${targetUser.full_name || targetUser.email} thành công.` };
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
    auditLog(request, 'REVOKE_PO_PERMISSION', 'po_tracker_permissions', id, perm, null);
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
    } else if (folder_id && folder_id !== 'all') {
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
        SUM(CASE WHEN status = 'overdue' OR (status NOT IN ('received','cancelled') AND expected_delivery_date IS NOT NULL AND expected_delivery_date < ?) THEN 1 ELSE 0 END) as overdue,
        SUM(CASE WHEN status = 'overdue' OR (status NOT IN ('received','cancelled') AND expected_delivery_date IS NOT NULL AND expected_delivery_date < ?) THEN 1 ELSE 0 END) as actually_overdue,
        SUM(CASE WHEN status NOT IN ('received','cancelled') AND expected_delivery_date BETWEEN ? AND ? THEN 1 ELSE 0 END) as upcoming_7_days,
        COALESCE(SUM(total_value), 0) as total_value
      FROM po_tracker_pos p
      WHERE 1=1 ${baseFilter}
    `).get(today, today, today, in7Days, ...params) as any;

    return { success: true, data: rows || {} };
  });
}
