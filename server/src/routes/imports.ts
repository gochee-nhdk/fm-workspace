import { FastifyInstance } from 'fastify';
import { verifyToken } from '../middleware/auth.js';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/connection.js';
import { ExcelParserService } from '../services/excel-parser.js';
import { DataQualityService } from '../services/data-quality.js';
import ExcelJS from 'exceljs';

// In-memory bounded temporary cache for uploaded parsed workbooks (15 mins TTL, max 20 entries)
interface CachedUpload {
  fileName: string;
  buffer: Buffer;
  profile: any;
  createdAt: number;
}

class BoundedUploadCache {
  private cache = new Map<string, CachedUpload>();
  private readonly maxEntries = 20;
  private readonly ttlMs = 15 * 60 * 1000; // 15 minutes TTL

  set(id: string, entry: Omit<CachedUpload, 'createdAt'>) {
    this.evictExpired();
    if (this.cache.size >= this.maxEntries) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }
    this.cache.set(id, { ...entry, createdAt: Date.now() });
  }

  get(id: string): CachedUpload | undefined {
    this.evictExpired();
    const item = this.cache.get(id);
    if (!item) return undefined;
    if (Date.now() - item.createdAt > this.ttlMs) {
      this.cache.delete(id);
      return undefined;
    }
    return item;
  }

  has(id: string): boolean {
    return this.get(id) !== undefined;
  }

  delete(id: string): boolean {
    return this.cache.delete(id);
  }

  private evictExpired() {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.createdAt > this.ttlMs) {
        this.cache.delete(key);
      }
    }
  }
}

const uploadCache = new BoundedUploadCache();

export default async function importsRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', verifyToken);

  /**
   * 1. POST /upload: Multipart file upload -> parse -> return data profile & suggested mappings
   */
  fastify.post('/upload', async (request: any, reply) => {
    try {
      const data = await request.file({
        limits: {
          fileSize: 100 * 1024 * 1024 // 100MB
        }
      });
      if (!data) {
        return reply.code(400).send({ success: false, message: 'Vui lòng chọn tệp để tải lên.' });
      }

      const buffer = await data.toBuffer();
      const fileName = data.filename;
      const ext = fileName.split('.').pop()?.toLowerCase();

      let profile;
      if (ext === 'csv') {
        profile = await ExcelParserService.parseCsv(buffer, fileName);
      } else if (ext === 'xlsx' || ext === 'xls') {
        profile = await ExcelParserService.parseExcel(buffer, fileName);
      } else {
        return reply.code(400).send({
          success: false,
          message: 'Định dạng tệp không được hỗ trợ. Chỉ chấp nhận .xlsx, .xls, .csv.'
        });
      }

      const uploadId = uuidv4();
      uploadCache.set(uploadId, { fileName, buffer, profile });

      return {
        success: true,
        data: {
          uploadId,
          profile
        }
      };
    } catch (err: any) {
      console.error('Upload Error:', err);
      const isTooLarge = err.message?.includes('too large') || err.code === 'FST_REQ_FILE_TOO_LARGE';
      const userMsg = isTooLarge
        ? 'Dung lượng tệp vượt quá giới hạn 100MB. Vui lòng nén hoặc chia nhỏ tệp dữ liệu.'
        : `Lỗi xử lý tệp: ${err.message}`;
      return reply.code(400).send({ success: false, message: userMsg });
    }
  });

  /**
   * 2. POST /validate: Validates parsed rows based on user column mappings
   */
  fastify.post('/validate', async (request: any, reply) => {
    const { uploadId, sheetName, columnMappings, entityType } = request.body || {};

    if (!uploadId || !uploadCache.has(uploadId)) {
      return reply.code(404).send({ success: false, message: 'Phiên tải lên không tồn tại hoặc đã hết hạn.' });
    }

    const { profile } = uploadCache.get(uploadId)!;
    const targetSheet = profile.sheets.find((s: any) => s.sheetName === sheetName) || profile.sheets[0];

    if (!targetSheet) {
      return reply.code(400).send({ success: false, message: 'Không tìm thấy sheet dữ liệu.' });
    }

    // Map preview rows using the provided column mappings
    const mappedRows = targetSheet.previewRows.map((rawRow: any) => {
      const mapped: Record<string, any> = {};
      for (const [sourceCol, targetField] of Object.entries(columnMappings || {})) {
        if (targetField && targetField !== 'ignore') {
          mapped[targetField as string] = rawRow[sourceCol];
        }
      }
      return mapped;
    });

    const qualityReport = DataQualityService.evaluate(mappedRows, entityType || 'inventory');

    return {
      success: true,
      data: {
        qualityReport,
        mappedRowsPreview: mappedRows.slice(0, 5)
      }
    };
  });

  /**
   * 3. POST /execute: Ingest the validated dataset into the database
   */
  fastify.post('/execute', async (request: any, reply) => {
    const { uploadId, sheetName, columnMappings, entityType, datasetName } = request.body || {};

    if (!uploadId || !uploadCache.has(uploadId)) {
      return reply.code(404).send({ success: false, message: 'Phiên tải lên không tồn tại hoặc đã hết hạn.' });
    }

    const allowedEntityTypes = ['inventory', 'sales', 'products', 'expiry', 'general'];
    if (!entityType || !allowedEntityTypes.includes(entityType)) {
      return reply.code(400).send({
        success: false,
        message: `Loại dữ liệu (entityType) không hợp lệ hoặc bị thiếu. Các loại được phép: ${allowedEntityTypes.join(', ')}`
      });
    }

    const { fileName, buffer, profile } = uploadCache.get(uploadId)!;
    const db = getDb();
    const now = new Date().toISOString();
    const userId = request.user?.id || 'system';

    try {
      // Re-read 100% of rows from buffer using full parser
      const allRows = await ExcelParserService.getAllRows(buffer, fileName, sheetName);

      // Map rows
      const mappedRows = allRows.map((rawRow) => {
        const mapped: Record<string, any> = {};
        for (const [sourceCol, targetField] of Object.entries(columnMappings || {})) {
          if (targetField && targetField !== 'ignore') {
            mapped[targetField as string] = rawRow[sourceCol];
          }
        }
        return mapped;
      });

      // Run quality check on full dataset
      const qualityReport = DataQualityService.evaluate(mappedRows, entityType);

      // Block import if critical data quality errors are found (e.g., negative stock, corrupt IDs)
      if (qualityReport.criticalCount > 0) {
        return reply.code(400).send({
          success: false,
          message: `Dữ liệu có ${qualityReport.criticalCount} lỗi nghiêm trọng (giá trị âm hoặc sai định dạng). Vui lòng khắc phục trước khi nạp vào hệ thống.`,
          data: { qualityReport }
        });
      }

      // Begin SQLite transaction
      let importedCount = 0;
      const runTransaction = db.transaction(() => {
        // Ensure default store exists
        let defaultStore = db.prepare("SELECT id FROM stores LIMIT 1").get() as any;
        if (!defaultStore) {
          const defStoreId = uuidv4();
          db.prepare("INSERT INTO stores (id, name, code, created_at, updated_at) VALUES (?, ?, ?, ?, ?)").run(
            defStoreId, 'Kho Tổng / Cửa hàng chính', 'STORE-DEFAULT', now, now
          );
          defaultStore = { id: defStoreId };
        }

        // Ensure default supplier exists
        let defaultSupplier = db.prepare("SELECT id FROM suppliers LIMIT 1").get() as any;
        if (!defaultSupplier) {
          const defSupId = uuidv4();
          db.prepare("INSERT INTO suppliers (id, name, code, created_at, updated_at) VALUES (?, ?, ?, ?, ?)").run(
            defSupId, 'Nhà cung cấp nội bộ / Tổng kho', 'SUP-DEFAULT', now, now
          );
          defaultSupplier = { id: defSupId };
        }

        // Ingestion logic per entity type
        if (entityType === 'inventory' || entityType === 'general') {
          const insertProduct = db.prepare(`
            INSERT OR IGNORE INTO products (id, sku_code, name, unit, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
          `);
          const insertStore = db.prepare(`
            INSERT OR IGNORE INTO stores (id, name, code, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
          `);
          const upsertInventory = db.prepare(`
            INSERT INTO inventory (id, store_id, product_id, quantity, available_qty, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(store_id, product_id) DO UPDATE SET
              quantity = excluded.quantity,
              available_qty = excluded.available_qty,
              updated_at = excluded.updated_at
          `);
          const upsertProductSupplier = db.prepare(`
            INSERT INTO product_suppliers (id, product_id, supplier_id, cost_price, is_primary)
            VALUES (?, ?, ?, ?, 1)
            ON CONFLICT(product_id, supplier_id) DO UPDATE SET
              cost_price = excluded.cost_price
          `);
          const insertExpiryLot = db.prepare(`
            INSERT INTO expiry_lots (id, store_id, product_id, lot_number, quantity, expiry_date, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, 'active', ?)
          `);

          for (const row of mappedRows) {
            const sku = row.sku_code || row.sku;
            if (!sku) continue;

            const name = row.product_name || row.name || `Sản phẩm ${sku}`;
            const unit = row.unit || 'gói';
            const qty = Number(row.inventory_qty ?? row.quantity ?? 0);
            const unitPrice = row.unit_price !== undefined && row.unit_price !== null && !isNaN(Number(row.unit_price))
              ? Number(row.unit_price)
              : null;

            // 1. Ensure product exists
            let prod = db.prepare("SELECT id FROM products WHERE sku_code = ?").get(sku) as any;
            if (!prod) {
              const prodId = uuidv4();
              insertProduct.run(prodId, sku, name, unit, now, now);
              prod = { id: prodId };
            }

            // 2. Store resolution
            let storeId = defaultStore.id;
            if (row.store_code) {
              let store = db.prepare("SELECT id FROM stores WHERE code = ?").get(row.store_code) as any;
              if (!store) {
                const newStoreId = uuidv4();
                insertStore.run(newStoreId, row.store_name || `Cửa hàng ${row.store_code}`, row.store_code, now, now);
                store = { id: newStoreId };
              }
              storeId = store.id;
            }

            // 3. Upsert inventory
            upsertInventory.run(uuidv4(), storeId, prod.id, qty, qty, now);

            // 4. Record cost price in product_suppliers if provided
            if (unitPrice !== null) {
              upsertProductSupplier.run(uuidv4(), prod.id, defaultSupplier.id, unitPrice);
            }

            // 5. Record expiry lot if provided
            if (row.expiry_date) {
              const cleanedExpiry = ExcelParserService.cleanCellValue(row.expiry_date);
              if (cleanedExpiry && String(cleanedExpiry).includes('-')) {
                const lotNum = row.lot_number || `LOT-${sku}-${String(cleanedExpiry).replace(/[^0-9]/g, '')}`;
                insertExpiryLot.run(uuidv4(), storeId, prod.id, lotNum, qty, cleanedExpiry, now);
              }
            }

            importedCount++;
          }
        } else if (entityType === 'sales') {
          const insertSale = db.prepare(`
            INSERT INTO sales (id, store_id, product_id, sale_date, quantity, revenue, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `);
          const insertStore = db.prepare(`
            INSERT OR IGNORE INTO stores (id, name, code, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
          `);

          for (const row of mappedRows) {
            const sku = row.sku_code || row.sku;
            if (!sku) continue;

            let prod = db.prepare("SELECT id FROM products WHERE sku_code = ?").get(sku) as any;
            if (!prod) {
              const prodId = uuidv4();
              db.prepare("INSERT INTO products (id, sku_code, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)").run(
                prodId, sku, row.product_name || `Sản phẩm ${sku}`, now, now
              );
              prod = { id: prodId };
            }

            // Store resolution
            let storeId = defaultStore.id;
            if (row.store_code) {
              let store = db.prepare("SELECT id FROM stores WHERE code = ?").get(row.store_code) as any;
              if (!store) {
                const newStoreId = uuidv4();
                insertStore.run(newStoreId, row.store_name || `Cửa hàng ${row.store_code}`, row.store_code, now, now);
                store = { id: newStoreId };
              }
              storeId = store.id;
            }

            const rawDate = row.date || now.split('T')[0];
            const saleDate = ExcelParserService.cleanCellValue(rawDate) || now.split('T')[0];
            const rawQty = row.sales_qty !== undefined ? row.sales_qty : (row.quantity !== undefined ? row.quantity : 1);
            const qty = Number.isFinite(Number(rawQty)) ? Number(rawQty) : 1;
            const rev = Number(row.sales_revenue || row.revenue || 0);

            insertSale.run(uuidv4(), storeId, prod.id, saleDate, qty, rev, now);
            importedCount++;
          }
        }

        // Record in datasets table
        const datasetId = uuidv4();
        db.prepare(`
          INSERT INTO datasets (
            id, name, version, file_name, file_size, row_count, entity_type,
            quality_score, status, columns_mapped, error_summary, uploaded_by, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          datasetId,
          datasetName || fileName,
          1,
          fileName,
          buffer.length,
          importedCount,
          entityType || 'inventory',
          qualityReport.qualityScore,
          'ready',
          JSON.stringify(columnMappings),
          JSON.stringify(qualityReport.summary),
          userId,
          now
        );

        // Record in data_imports table
        db.prepare(`
          INSERT INTO data_imports (
            id, user_id, file_name, entity_type, total_rows, success_rows, error_rows, status, errors, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          uuidv4(),
          userId,
          fileName,
          entityType || 'inventory',
          mappedRows.length,
          importedCount,
          mappedRows.length - importedCount,
          'completed',
          JSON.stringify(qualityReport.issues.slice(0, 10)),
          now
        );
      });

      runTransaction();
      uploadCache.delete(uploadId);

      return {
        success: true,
        data: {
          importedRows: importedCount,
          totalRows: mappedRows.length,
          qualityScore: qualityReport.qualityScore,
          datasetName: datasetName || fileName
        }
      };
    } catch (err: any) {
      console.error('Execute Import Error:', err);
      return reply.code(500).send({ success: false, message: `Lỗi nạp dữ liệu: ${err.message}` });
    }
  });

  /**
   * 4. GET /history: Retrieve import and dataset history
   */
  fastify.get('/history', async (request: any, reply) => {
    const db = getDb();
    const datasets = db.prepare('SELECT * FROM datasets ORDER BY created_at DESC LIMIT 50').all();
    const imports = db.prepare('SELECT * FROM data_imports ORDER BY created_at DESC LIMIT 50').all();

    return {
      success: true,
      data: {
        datasets,
        imports
      }
    };
  });

  /**
   * 5. GET /templates/:type: Download standard Excel/CSV templates
   */
  fastify.get('/templates/:type', async (request: any, reply) => {
    const { type } = request.params as { type: string };
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Template');

    if (type === 'inventory') {
      sheet.columns = [
        { header: 'Mã SKU', key: 'sku_code', width: 15 },
        { header: 'Tên Sản Phẩm', key: 'product_name', width: 30 },
        { header: 'Mã Cửa Hàng', key: 'store_code', width: 15 },
        { header: 'Số Lượng Tồn', key: 'inventory_qty', width: 15 },
        { header: 'Đơn Giá Vốn', key: 'unit_price', width: 15 },
        { header: 'Hạn Sử Dụng (YYYY-MM-DD)', key: 'expiry_date', width: 22 }
      ];
      sheet.addRow({
        sku_code: 'RC-001',
        product_name: 'Xà lách thủy canh Đà Lạt 500g',
        store_code: 'FM-TD',
        inventory_qty: 45,
        unit_price: 18000,
        expiry_date: '2026-10-15'
      });
    } else if (type === 'sales') {
      sheet.columns = [
        { header: 'Ngày Bán (YYYY-MM-DD)', key: 'date', width: 20 },
        { header: 'Mã SKU', key: 'sku_code', width: 15 },
        { header: 'Mã Cửa Hàng', key: 'store_code', width: 15 },
        { header: 'Số Lượng Bán', key: 'sales_qty', width: 15 },
        { header: 'Doanh Số (VND)', key: 'sales_revenue', width: 20 }
      ];
      sheet.addRow({
        date: '2026-09-15',
        sku_code: 'RC-001',
        store_code: 'FM-TD',
        sales_qty: 12,
        sales_revenue: 300000
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    reply.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    reply.header('Content-Disposition', `attachment; filename="template_${type}.xlsx"`);
    return reply.send(buffer);
  });
}
