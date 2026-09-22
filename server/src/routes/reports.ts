import { FastifyInstance } from 'fastify';
import { getDb } from '../db/connection.js';
import { verifyToken } from '../middleware/auth.js';
import ExcelJS from 'exceljs';
import Papa from 'papaparse';
import { calculateAverageDailySales, calculateDaysOfCover } from '../services/calculations.js';

export default async function reportsRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', verifyToken);

  /**
   * Helper function to fetch data for report type
   */
  function getReportData(type: string, db: any) {
    if (type === 'inventory') {
      const rows = db.prepare(`
        SELECT p.sku_code, p.name as product_name, s.name as store_name,
               i.available_qty, ps.cost_price, (i.available_qty * COALESCE(ps.cost_price, 0)) as total_value
        FROM inventory i
        JOIN products p ON i.product_id = p.id
        JOIN stores s ON i.store_id = s.id
        LEFT JOIN product_suppliers ps ON p.id = ps.product_id AND ps.is_primary = 1
        ORDER BY total_value DESC
      `).all();
      return {
        title: 'Báo cáo Định giá Tồn kho',
        headers: ['Mã SKU', 'Tên Sản Phẩm', 'Điểm Bán', 'Tồn Khả Dụng', 'Đơn Giá Vốn', 'Giá Trị Tồn (VND)'],
        keys: ['sku_code', 'product_name', 'store_name', 'available_qty', 'cost_price', 'total_value'],
        rows
      };
    } else if (type === 'near_expiry') {
      const rows = db.prepare(`
        SELECT p.sku_code, p.name as product_name, s.name as store_name,
               el.lot_number, el.quantity, el.expiry_date,
               CAST((julianday(el.expiry_date) - julianday('now')) AS INTEGER) as days_left
        FROM expiry_lots el
        JOIN products p ON el.product_id = p.id
        JOIN stores s ON el.store_id = s.id
        WHERE el.status = 'active'
        ORDER BY el.expiry_date ASC
      `).all();
      return {
        title: 'Báo cáo Hàng Cận Hạn Sử Dụng',
        headers: ['Mã SKU', 'Tên Sản Phẩm', 'Điểm Bán', 'Số Lô', 'Số Lượng', 'Hạn Sử Dụng', 'Số Ngày Còn Lại'],
        keys: ['sku_code', 'product_name', 'store_name', 'lot_number', 'quantity', 'expiry_date', 'days_left'],
        rows
      };
    } else if (type === 'procurement_recommendations') {
      const rows = db.prepare(`
        SELECT p.sku_code, p.name as product_name, s.name as store_name,
               pr.recommended_qty, pr.reason, pr.risk_level, pr.status, pr.created_at
        FROM purchase_recommendations pr
        JOIN products p ON pr.product_id = p.id
        JOIN stores s ON pr.store_id = s.id
        ORDER BY pr.created_at DESC
      `).all();
      return {
        title: 'Báo cáo Khuyến nghị Đặt hàng',
        headers: ['Mã SKU', 'Tên Sản Phẩm', 'Điểm Bán', 'Số Lượng Gợi Ý', 'Lý Do Đặt', 'Mức Độ Rủi Ro', 'Trạng Thái', 'Ngày Tạo'],
        keys: ['sku_code', 'product_name', 'store_name', 'recommended_qty', 'reason', 'risk_level', 'status', 'created_at'],
        rows
      };
    } else {
      // Default / Daily procurement report
      const rows = db.prepare(`
        SELECT p.sku_code, p.name as product_name, s.name as store_name, i.available_qty
        FROM inventory i
        JOIN products p ON i.product_id = p.id
        JOIN stores s ON i.store_id = s.id
        ORDER BY p.name ASC
      `).all();
      return {
        title: 'Báo cáo Tổng hợp Thu mua Hàng ngày',
        headers: ['Mã SKU', 'Tên Sản Phẩm', 'Điểm Bán', 'Tồn Kho'],
        keys: ['sku_code', 'product_name', 'store_name', 'available_qty'],
        rows
      };
    }
  }

  /**
   * 1. POST /generate: Generate JSON report data for UI preview
   */
  fastify.post('/generate', async (request: any, reply) => {
    const { type = 'daily_procurement' } = request.body || {};
    const db = getDb();
    const data = getReportData(type, db);

    return {
      success: true,
      data: {
        reportType: type,
        generatedAt: new Date().toISOString(),
        ...data
      }
    };
  });

  /**
   * 2. GET /export/excel & /export/xlsx: Stream formatted Excel file
   */
  const exportExcelHandler = async (request: any, reply: any) => {
    const { type = 'daily_procurement' } = request.query as { type?: string };
    const db = getDb();
    const report = getReportData(type, db);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Farmers Market AI Procurement Copilot';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('Báo Cáo', {
      views: [{ showGridLines: true }]
    });

    // Title Block
    worksheet.mergeCells('A1:E1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = `FARMERS MARKET — ${report.title.toUpperCase()}`;
    titleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FF0D9488' } };
    titleCell.alignment = { vertical: 'middle' };
    worksheet.getRow(1).height = 30;

    // Subtitle
    worksheet.getCell('A2').value = `Thời gian xuất: ${new Date().toLocaleString('vi-VN')} | Người tạo: ${request.user?.full_name || 'System'}`;
    worksheet.getCell('A2').font = { size: 9, italic: true, color: { argb: 'FF64748B' } };
    worksheet.getRow(2).height = 18;

    // Blank row
    worksheet.addRow([]);

    // Table Columns & Header
    worksheet.columns = report.headers.map((h, i) => ({
      header: h,
      key: report.keys[i],
      width: Math.max(h.length + 5, 16)
    }));

    // Style header row (Row 4)
    const headerRow = worksheet.getRow(4);
    headerRow.values = report.headers;
    headerRow.height = 24;
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF0F766E' } // Teal-700
      };
      cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'medium', color: { argb: 'FF0D9488' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
      };
    });

    // Add Data Rows
    report.rows.forEach((rowObj: any, index: number) => {
      const rowData = report.keys.map((k) => rowObj[k] ?? '');
      const dataRow = worksheet.addRow(rowData);
      dataRow.height = 20;

      // Alternating row background
      const isEven = index % 2 === 0;
      dataRow.eachCell((cell, colNumber) => {
        cell.font = { name: 'Arial', size: 9.5 };
        cell.alignment = { vertical: 'middle' };
        if (!isEven) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF8FAFC' }
          };
        }
        cell.border = {
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        };
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    reply.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    reply.header('Content-Disposition', `attachment; filename="farmers_market_${type}_${Date.now()}.xlsx"`);
    return reply.send(buffer);
  };

  fastify.get('/export/excel', exportExcelHandler);
  fastify.get('/export/xlsx', exportExcelHandler);

  /**
   * 3. GET /export/csv: Stream CSV file
   */
  fastify.get('/export/csv', async (request: any, reply) => {
    const { type = 'daily_procurement' } = request.query as { type?: string };
    const db = getDb();
    const report = getReportData(type, db);

    const csvData = report.rows.map((rowObj: any) => {
      const obj: Record<string, any> = {};
      report.headers.forEach((h, i) => {
        obj[h] = rowObj[report.keys[i]] ?? '';
      });
      return obj;
    });

    const csvText = Papa.unparse(csvData);
    reply.header('Content-Type', 'text/csv; charset=utf-8');
    reply.header('Content-Disposition', `attachment; filename="farmers_market_${type}_${Date.now()}.csv"`);
    return reply.send('\uFEFF' + csvText); // Include BOM for Excel UTF-8 display
  });
}
