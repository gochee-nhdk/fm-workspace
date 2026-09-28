import ExcelJS from 'exceljs';
import Papa from 'papaparse';

export interface ColumnProfile {
  header: string;
  detectedType: 'string' | 'number' | 'date' | 'boolean' | 'unknown';
  sampleValues: any[];
  nullCount: number;
  uniqueCount: number;
  suggestedMapping?: string;
  mappingConfidence?: number;
}

export interface SheetProfile {
  sheetName: string;
  rowCount: number;
  columnCount: number;
  columns: ColumnProfile[];
  previewRows: Record<string, any>[];
}

export interface DataProfile {
  fileName: string;
  fileType: 'excel' | 'csv';
  sheets: SheetProfile[];
  totalRows: number;
  potentialIssues: string[];
}

// Semantic Dictionary for Vietnamese and English Retail FMCG
const SEMANTIC_DICTIONARY: Record<string, string[]> = {
  sku_code: [
    'mã sp', 'ma sp', 'mã sku', 'ma sku', 'sku', 'mã sản phẩm', 'ma san pham',
    'item code', 'product code', 'mã hàng', 'ma hang', 'barcode', 'mã vạch'
  ],
  product_name: [
    'tên sp', 'ten sp', 'tên sản phẩm', 'ten san pham', 'tên hàng', 'ten hang',
    'product name', 'item name', 'description', 'diễn giải', 'tên mặt hàng'
  ],
  store_code: [
    'mã ch', 'ma ch', 'mã cửa hàng', 'ma cua hang', 'mã kho', 'ma kho',
    'store code', 'store id', 'warehouse', 'chi nhánh', 'mã chi nhánh'
  ],
  store_name: [
    'tên ch', 'ten ch', 'tên cửa hàng', 'ten cua hang', 'tên kho', 'ten kho',
    'store name', 'tên chi nhánh'
  ],
  category: [
    'ngành hàng', 'nganh hang', 'nhóm hàng', 'nhom hang', 'loại hàng', 'loai hang',
    'category', 'nhóm sản phẩm', 'phân loại'
  ],
  supplier: [
    'nhà cung cấp', 'nha cung cap', 'ncc', 'mã ncc', 'tên ncc', 'supplier',
    'vendor', 'nhà phân phối'
  ],
  inventory_qty: [
    'tồn kho', 'ton kho', 'sl tồn', 'sl ton', 'số lượng tồn', 'so luong ton',
    'stock', 'inventory', 'on hand', 'tồn cuối', 'ton cuoi', 'sl hiện tại'
  ],
  sales_qty: [
    'sl bán', 'sl ban', 'số lượng bán', 'so luong ban', 'sales qty',
    'sold', 'lượng bán', 'luong ban', 'xuất bán'
  ],
  sales_revenue: [
    'doanh thu', 'doanh số', 'doanh so', 'tiền bán', 'thành tiền', 'thanh tien',
    'revenue', 'sales amount', 'tổng tiền bán'
  ],
  date: [
    'ngày', 'ngay', 'ngày bán', 'ngay ban', 'ngày giao', 'ngay giao',
    'sale date', 'transaction date', 'date', 'ngày ghi nhận'
  ],
  expiry_date: [
    'hạn sử dụng', 'han su dung', 'hsd', 'exp date', 'expiry', 'date',
    'ngày hết hạn', 'ngay het han', 'hạn dùng'
  ],
  unit_price: [
    'đơn giá', 'don gia', 'giá mua', 'gia mua', 'cost', 'cost price',
    'giá vốn', 'gia von', 'giá nhập', 'gia nhap'
  ],
  unit: [
    'đơn vị tính', 'don vi tinh', 'dvt', 'uom', 'unit'
  ]
};

export function isSafeKey(key: string): boolean {
  if (!key || typeof key !== 'string') return false;
  const lower = key.trim().toLowerCase();
  return lower !== '__proto__' && lower !== 'constructor' && lower !== 'prototype';
}

export class ExcelParserService {
  /**
   * Guess semantic target field for a given column header
   */
  static guessFieldMapping(header: string): { mapping: string; confidence: number } | null {
    const normalized = header.toLowerCase().trim().replace(/[_.-]/g, ' ');

    for (const [targetField, keywords] of Object.entries(SEMANTIC_DICTIONARY)) {
      for (const kw of keywords) {
        if (normalized === kw) {
          return { mapping: targetField, confidence: 0.95 };
        }
        if (normalized.includes(kw) || kw.includes(normalized)) {
          return { mapping: targetField, confidence: 0.75 };
        }
      }
    }

    return null;
  }

  /**
   * Clean and normalize cell values (Dates, RichText, Formulas, DD/MM/YYYY)
   */
  static cleanCellValue(val: any): any {
    if (val === null || val === undefined) return null;
    if (val instanceof Date) {
      return val.toISOString().split('T')[0];
    }
    if (typeof val === 'object') {
      if ('result' in val) return ExcelParserService.cleanCellValue(val.result);
      if ('richText' in val && Array.isArray(val.richText)) {
        return val.richText.map((t: any) => t.text || '').join('');
      }
      if ('text' in val) return ExcelParserService.cleanCellValue(val.text);
    }
    if (typeof val === 'string') {
      const trimmed = val.trim();
      // Sanitize potential formula injection triggers (=, +, -, @)
      if (/^[=\+\-@\t\r]/.test(trimmed) && trimmed.length > 1 && !/^-?\d+(\.\d+)?$/.test(trimmed)) {
        return "'" + trimmed;
      }
      // Detect DD/MM/YYYY or DD-MM-YYYY format
      const ddmmyyyy = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/;
      const m = trimmed.match(ddmmyyyy);
      if (m) {
        const day = m[1].padStart(2, '0');
        const month = m[2].padStart(2, '0');
        const year = m[3];
        return `${year}-${month}-${day}`;
      }
      return trimmed;
    }
    return val;
  }

  /**
   * Retrieve ALL data rows from buffer for both Excel and CSV
   */
  static async getAllRows(buffer: Buffer, fileName: string, sheetName?: string): Promise<Record<string, any>[]> {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (ext === 'csv') {
      const text = buffer.toString('utf-8');
      const parsed = Papa.parse<Record<string, any>>(text, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: true
      });
      return (parsed.data || []).map((row) => {
        const cleanedRow: Record<string, any> = {};
        for (const [k, v] of Object.entries(row)) {
          if (isSafeKey(k)) {
            cleanedRow[k] = ExcelParserService.cleanCellValue(v);
          }
        }
        return cleanedRow;
      });
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);
    const worksheet = sheetName ? workbook.getWorksheet(sheetName) : workbook.worksheets[0];
    const allRows: Record<string, any>[] = [];

    if (worksheet) {
      let headerRowIndex = 1;
      let maxScore = -1;
      const scanLimit = Math.min(10, worksheet.rowCount || 10);
      for (let r = 1; r <= scanLimit; r++) {
        const row = worksheet.getRow(r);
        let score = 0;
        row.eachCell((cell) => {
          const val = String(cell.value || '').toLowerCase().trim();
          if (val && Object.values(SEMANTIC_DICTIONARY).some(kws => kws.some(k => val === k || val.includes(k)))) {
            score++;
          }
        });
        if (score > maxScore) {
          maxScore = score;
          headerRowIndex = r;
        }
      }

      const headerRow = worksheet.getRow(headerRowIndex);
      const headers: string[] = [];
      headerRow.eachCell((cell, colNumber) => {
        headers[colNumber - 1] = String(cell.value || '').trim();
      });

      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber > headerRowIndex) {
          const rowObj: Record<string, any> = {};
          let hasVal = false;
          headers.forEach((h, idx) => {
            if (isSafeKey(h)) {
              const rawVal = row.getCell(idx + 1).value;
              const cleaned = ExcelParserService.cleanCellValue(rawVal);
              rowObj[h] = cleaned;
              if (cleaned !== null && cleaned !== '') hasVal = true;
            }
          });
          if (hasVal) {
            allRows.push(rowObj);
          }
        }
      });
    }

    return allRows;
  }

  /**
   * Parse CSV buffer using PapaParse
   */
  static async parseCsv(buffer: Buffer, fileName: string): Promise<DataProfile> {
    const text = buffer.toString('utf-8');
    const parsed = Papa.parse<Record<string, any>>(text, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true
    });

    const rows = parsed.data;
    const fields = parsed.meta.fields || [];

    const columns: ColumnProfile[] = fields.map((field) => {
      const samples: any[] = [];
      let nullCount = 0;
      const uniqueSet = new Set();

      for (let i = 0; i < Math.min(rows.length, 50); i++) {
        const val = rows[i][field];
        if (val === null || val === undefined || val === '') {
          nullCount++;
        } else {
          samples.push(val);
          uniqueSet.add(val);
        }
      }

      // Detect type
      let detectedType: ColumnProfile['detectedType'] = 'string';
      if (samples.length > 0) {
        const first = samples[0];
        if (typeof first === 'number') detectedType = 'number';
        else if (typeof first === 'boolean') detectedType = 'boolean';
        else if (!isNaN(Date.parse(first)) && String(first).includes('-') || String(first).includes('/')) {
          detectedType = 'date';
        }
      }

      const guess = this.guessFieldMapping(field);

      return {
        header: field,
        detectedType,
        sampleValues: samples.slice(0, 5),
        nullCount,
        uniqueCount: uniqueSet.size,
        suggestedMapping: guess?.mapping,
        mappingConfidence: guess?.confidence
      };
    });

    return {
      fileName,
      fileType: 'csv',
      totalRows: rows.length,
      potentialIssues: parsed.errors.map((e) => `Dòng ${e.row}: ${e.message}`),
      sheets: [
        {
          sheetName: 'Sheet1',
          rowCount: rows.length,
          columnCount: fields.length,
          columns,
          previewRows: rows.slice(0, 10)
        }
      ]
    };
  }

  /**
   * Parse Excel workbook buffer using ExcelJS
   */
  static async parseExcel(buffer: Buffer, fileName: string): Promise<DataProfile> {
    const workbook = new ExcelJS.Workbook();
    // Use Uint8Array or Buffer directly for exceljs
    await workbook.xlsx.load(buffer as any);

    const sheets: SheetProfile[] = [];
    let totalRows = 0;
    const potentialIssues: string[] = [];

    workbook.eachSheet((worksheet) => {
      const rowCount = worksheet.actualRowCount;
      totalRows += Math.max(0, rowCount - 1); // exclude header

      if (rowCount === 0) {
        potentialIssues.push(`Sheet "${worksheet.name}" trống dữ liệu.`);
        return;
      }

      let headerRowIndex = 1;
      let maxScore = -1;
      const scanLimit = Math.min(10, worksheet.rowCount || 10);
      for (let r = 1; r <= scanLimit; r++) {
        const row = worksheet.getRow(r);
        let score = 0;
        row.eachCell((cell) => {
          const val = String(cell.value || '').toLowerCase().trim();
          if (val && Object.values(SEMANTIC_DICTIONARY).some(kws => kws.some(k => val === k || val.includes(k)))) {
            score++;
          }
        });
        if (score > maxScore) {
          maxScore = score;
          headerRowIndex = r;
        }
      }

      // Extract header from detected header row
      const headerRow = worksheet.getRow(headerRowIndex);
      const headers: string[] = [];
      headerRow.eachCell((cell, colNumber) => {
        headers[colNumber - 1] = String(cell.value || `Cột_${colNumber}`).trim();
      });

      // Extract preview rows (up to 10 rows)
      const previewRows: Record<string, any>[] = [];
      const sampleLimit = Math.min(rowCount, headerRowIndex + 20);

      const colSamples: Record<number, any[]> = {};
      const colNulls: Record<number, number> = {};

      for (let r = headerRowIndex + 1; r <= sampleLimit; r++) {
        const row = worksheet.getRow(r);
        const rowObj: Record<string, any> = {};

        headers.forEach((h, idx) => {
          const cellVal = row.getCell(idx + 1).value;
          let parsedVal: any = cellVal;

          // ExcelJS formula result handling
          if (cellVal && typeof cellVal === 'object' && 'result' in cellVal) {
            parsedVal = (cellVal as any).result;
          }

          if (isSafeKey(h)) {
            rowObj[h] = parsedVal;
          }

          if (!colSamples[idx]) colSamples[idx] = [];
          if (!colNulls[idx]) colNulls[idx] = 0;

          if (parsedVal === null || parsedVal === undefined || parsedVal === '') {
            colNulls[idx]++;
          } else {
            colSamples[idx].push(parsedVal);
          }
        });

        if (r <= 11) {
          previewRows.push(rowObj);
        }
      }

      const columns: ColumnProfile[] = headers.map((header, idx) => {
        const samples = colSamples[idx] || [];
        let detectedType: ColumnProfile['detectedType'] = 'string';

        if (samples.length > 0) {
          const sample = samples[0];
          if (typeof sample === 'number') detectedType = 'number';
          else if (sample instanceof Date) detectedType = 'date';
          else if (!isNaN(Date.parse(String(sample))) && (String(sample).includes('-') || String(sample).includes('/'))) {
            detectedType = 'date';
          }
        }

        const guess = this.guessFieldMapping(header);

        return {
          header,
          detectedType,
          sampleValues: samples.slice(0, 5),
          nullCount: colNulls[idx] || 0,
          uniqueCount: new Set(samples).size,
          suggestedMapping: guess?.mapping,
          mappingConfidence: guess?.confidence
        };
      });

      sheets.push({
        sheetName: worksheet.name,
        rowCount: Math.max(0, rowCount - 1),
        columnCount: headers.length,
        columns,
        previewRows
      });
    });

    return {
      fileName,
      fileType: 'excel',
      totalRows,
      potentialIssues,
      sheets
    };
  }
}
