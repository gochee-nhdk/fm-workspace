import * as XLSX from 'xlsx';
import {
  LinkItem,
  AccountItem,
  StoreItem,
  DuplicateStrategy,
  SheetPreview,
  ImportPreviewResult,
} from '@/types/workspace';
import { idbGetAll, idbBulkPut, idbPut, STORES } from './storage/indexedDb';
import { dataService } from './dataService';

// Helper to normalize header string for fuzzy matching
const norm = (str: any): string => {
  if (!str) return '';
  return String(str)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
};

// Sanitize cell input to prevent oversized payloads and control character glitches
export const sanitizeCellInput = (val: any, maxLength = 1000): string => {
  if (val === undefined || val === null) return '';
  let str = String(val).trim();
  str = str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  if (str.length > maxLength) {
    str = str.slice(0, maxLength);
  }
  return str;
};

// Shield strings against spreadsheet formula injection (=, +, -, @)
export const shieldFormula = (val: string): string => {
  if (!val) return '';
  if (/^[=+\-@\t\r]/.test(val)) {
    return `'${val}`;
  }
  return val;
};

// Automatic detection of target dataset from sheet name
export const detectDatasetFromSheetName = (
  sheetName: string
): 'LINK' | 'ACCOUNT' | 'STORE' | 'IGNORE' => {
  const clean = norm(sheetName);
  if (clean.includes('link') || clean.includes('lienket') || clean.includes('shortcut')) {
    return 'LINK';
  }
  if (
    clean.includes('account') ||
    clean.includes('taikhoan') ||
    clean.includes('matkhau') ||
    clean.includes('credential') ||
    clean.includes('pass')
  ) {
    return 'ACCOUNT';
  }
  if (
    clean.includes('dsch') ||
    clean.includes('cuahang') ||
    clean.includes('store') ||
    clean.includes('shop')
  ) {
    return 'STORE';
  }
  return 'IGNORE';
};

interface ColWidthRule {
  min?: number;
  max?: number;
  defaultWidth?: number;
}

// Calculates visually balanced, proportioned column widths
export const calculateAutoFitCols = (
  rows: Record<string, any>[],
  rules: Record<string, ColWidthRule> = {}
): XLSX.ColInfo[] => {
  if (!rows || rows.length === 0) return [];
  const keys = Object.keys(rows[0]);

  return keys.map((key) => {
    const rule = rules[key] || {};
    const minW = rule.min ?? 12;
    const maxW = rule.max ?? 70;

    let maxChar = key.length;
    for (const row of rows) {
      const val = row[key];
      if (val !== undefined && val !== null) {
        const len = String(val).length;
        if (len > maxChar) maxChar = len;
      }
    }

    // Add +4 chars padding for breathing room
    const calculated = Math.min(Math.max(maxChar + 4, minW), maxW);
    return { wch: rule.defaultWidth ? Math.max(rule.defaultWidth, calculated) : calculated };
  });
};

// Formats a worksheet with proper freeze pane, autofilter, and auto column widths
export const applyWorksheetStyles = (
  ws: XLSX.WorkSheet,
  rows: Record<string, any>[],
  colRules: Record<string, ColWidthRule> = {}
) => {
  // 1. Proportional Column Widths
  ws['!cols'] = calculateAutoFitCols(rows, colRules);

  // 2. AutoFilter across entire data table
  if (ws['!ref']) {
    ws['!autofilter'] = { ref: ws['!ref'] };
  }

  // 3. Freeze Header Row (Row 1 stays fixed when scrolling)
  ws['!views'] = [{ state: 'frozen', ySplit: 1 }];
};

class ExcelService {
  // Read and parse uploaded file into SheetJS workbook
  async readWorkbook(file: File): Promise<XLSX.WorkBook> {
    const arrayBuffer = await file.arrayBuffer();
    return XLSX.read(arrayBuffer, { type: 'array' });
  }

  // Generate complete preview of sheets, mapping, valid rows, duplicates
  async generateImportPreview(file: File): Promise<ImportPreviewResult> {
    const workbook = await this.readWorkbook(file);
    const existingLinks = await idbGetAll<LinkItem>(STORES.LINKS);
    const existingAccounts = await idbGetAll<AccountItem>(STORES.ACCOUNTS);
    const existingStores = await idbGetAll<StoreItem>(STORES.STORES);

    const sheets: SheetPreview[] = [];

    for (const sheetName of workbook.SheetNames) {
      const targetDataset = detectDatasetFromSheetName(sheetName);
      const worksheet = workbook.Sheets[sheetName];
      const rawRows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

      const preview = this.analyzeSheetRows(
        sheetName,
        targetDataset,
        rawRows,
        existingLinks,
        existingAccounts,
        existingStores
      );
      sheets.push(preview);
    }

    return {
      fileName: file.name,
      fileSize: file.size,
      sheets,
    };
  }

  // Analyze rows for a sheet with designated dataset
  analyzeSheetRows(
    sheetName: string,
    targetDataset: 'LINK' | 'ACCOUNT' | 'STORE' | 'IGNORE',
    rawRows: any[],
    existingLinks: LinkItem[],
    existingAccounts: AccountItem[],
    existingStores: StoreItem[]
  ): SheetPreview {
    if (targetDataset === 'IGNORE' || rawRows.length === 0) {
      return {
        sheetName,
        targetDataset,
        totalRows: rawRows.length,
        validCount: 0,
        invalidCount: rawRows.length,
        duplicateCount: 0,
        rows: [],
        errors: [],
      };
    }

    let validCount = 0;
    let invalidCount = 0;
    let duplicateCount = 0;
    const errors: string[] = [];
    const parsedRows: any[] = [];

    // Find headers matching
    const sample = rawRows[0] || {};
    const headerKeys = Object.keys(sample);

    const findCol = (aliases: string[]) => {
      return headerKeys.find((k) => {
        const nk = norm(k);
        return aliases.some((a) => nk === norm(a) || nk.includes(norm(a)));
      });
    };

    if (targetDataset === 'LINK') {
      const colStt = findCol(['stt', 'no', 'sothutu']);
      const colHangMuc = findCol(['hangmuc', 'ten', 'name', 'title', 'hethong', 'linktf', 'congcu']);
      const colLink = findCol(['link', 'url', 'duongdan', 'web', 'diachiweb']);
      const colNote = findCol(['note', 'ghichu', 'mota', 'chuthich']);
      const colCategory = findCol(['category', 'nhom', 'danhmuc', 'phanloai', 'loai']);

      rawRows.forEach((row, idx) => {
        const rawHangMuc = colHangMuc ? row[colHangMuc] : Object.values(row)[0] || '';
        const hangMuc = sanitizeCellInput(rawHangMuc, 200);
        const link = sanitizeCellInput(colLink ? row[colLink] : '', 1000);
        const note = sanitizeCellInput(colNote ? row[colNote] : '', 500);
        const category = sanitizeCellInput(colCategory ? row[colCategory] : 'Chung', 100) || 'Chung';
        const stt = colStt && !isNaN(Number(row[colStt])) ? Number(row[colStt]) : idx + 1;

        if (!hangMuc && !link) {
          invalidCount++;
          return;
        }

        const isDuplicate = existingLinks.some(
          (ex) =>
            norm(ex.hangMuc) === norm(hangMuc) ||
            (link && norm(ex.link) === norm(link))
        );

        if (isDuplicate) duplicateCount++;
        validCount++;

        parsedRows.push({
          stt,
          hangMuc: hangMuc || 'Liên kết không tên',
          link,
          note,
          category: category || 'Chung',
          isDuplicate,
        });
      });
    } else if (targetDataset === 'ACCOUNT') {
      const colStt = findCol(['stt', 'no']);
      const colSoftware = findCol(['software', 'phanmem', 'hethong', 'ungdung', 'app', 'tool']);
      const colUser = findCol(['username', 'tendangnhap', 'user', 'taikhoan', 'acc', 'login']);
      const colPass = findCol(['password', 'matkhau', 'pass', 'pwd']);
      const colLink = findCol(['link', 'url', 'duongdan', 'web']);
      const colNote = findCol(['note', 'ghichu', 'chuthich']);

      rawRows.forEach((row, idx) => {
        const rawSoftware = colSoftware ? row[colSoftware] : Object.values(row)[0] || '';
        const software = sanitizeCellInput(rawSoftware, 200);
        const username = sanitizeCellInput(colUser ? row[colUser] : '', 200);
        const password = sanitizeCellInput(colPass ? row[colPass] : '', 300);
        const link = sanitizeCellInput(colLink ? row[colLink] : '', 1000);
        const note = sanitizeCellInput(colNote ? row[colNote] : '', 500);
        const stt = colStt && !isNaN(Number(row[colStt])) ? Number(row[colStt]) : idx + 1;

        if (!software && !username) {
          invalidCount++;
          return;
        }

        const isDuplicate = existingAccounts.some(
          (ex) =>
            norm(ex.software) === norm(software) &&
            norm(ex.username) === norm(username)
        );

        if (isDuplicate) duplicateCount++;
        validCount++;

        parsedRows.push({
          stt,
          software: software || 'Hệ thống',
          username,
          password,
          link,
          note,
          isDuplicate,
        });
      });
    } else if (targetDataset === 'STORE') {
      const colCode = findCol(['storecode', 'mach', 'macuahang', 'code', 'ma', 'cuahang']);
      const colAddress = findCol(['address', 'diachi', 'dia chi']);
      const colMaps = findCol(['googlemaps', 'ggmaps', 'maps', 'bando', 'map']);
      const colType = findCol(['type', 'loai', 'loaidonvi', 'phanloai']);

      rawRows.forEach((row) => {
        const rawCode = colCode ? row[colCode] : Object.values(row)[0] || '';
        const storeCode = sanitizeCellInput(rawCode, 50).toUpperCase();
        const address = sanitizeCellInput(colAddress ? row[colAddress] : '', 500);
        const googleMaps = sanitizeCellInput(colMaps ? row[colMaps] : '', 1000);
        const type = sanitizeCellInput(colType ? row[colType] : 'Standard', 100) || 'Standard';

        if (!storeCode) {
          invalidCount++;
          return;
        }

        const isDuplicate = existingStores.some(
          (ex) => norm(ex.storeCode) === norm(storeCode)
        );

        if (isDuplicate) duplicateCount++;
        validCount++;

        parsedRows.push({
          storeCode,
          address: address || 'Chưa cập nhật địa chỉ',
          googleMaps,
          type,
          isDuplicate,
        });
      });
    }

    return {
      sheetName,
      targetDataset,
      totalRows: rawRows.length,
      validCount,
      invalidCount,
      duplicateCount,
      rows: parsedRows,
      errors,
    };
  }

  // Execute the import process according to duplicate strategy
  async executeImport(
    sheets: SheetPreview[],
    strategy: DuplicateStrategy
  ): Promise<{ importedLinks: number; importedAccounts: number; importedStores: number }> {
    const existingLinks = await idbGetAll<LinkItem>(STORES.LINKS);
    const existingAccounts = await idbGetAll<AccountItem>(STORES.ACCOUNTS);
    const existingStores = await idbGetAll<StoreItem>(STORES.STORES);

    let importedLinks = 0;
    let importedAccounts = 0;
    let importedStores = 0;

    const now = new Date().toISOString();

    for (const sheet of sheets) {
      if (sheet.targetDataset === 'IGNORE' || !sheet.rows || sheet.rows.length === 0) {
        continue;
      }

      if (sheet.targetDataset === 'LINK') {
        const linksToSave: LinkItem[] = [];

        for (const row of sheet.rows) {
          const existing = existingLinks.find(
            (l) => norm(l.hangMuc) === norm(row.hangMuc) || (row.link && norm(l.link) === norm(row.link))
          );

          if (existing) {
            if (strategy === 'skip') {
              continue;
            } else if (strategy === 'update') {
              existing.hangMuc = row.hangMuc;
              existing.link = row.link;
              existing.note = row.note || existing.note;
              existing.category = row.category || existing.category;
              existing.updatedAt = now;
              await idbPut(STORES.LINKS, existing);
              importedLinks++;
              continue;
            }
          }

          // Strategy is 'duplicate' or new record
          linksToSave.push({
            id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
            stt: row.stt,
            hangMuc: row.hangMuc,
            link: row.link,
            note: row.note,
            category: row.category,
            favorite: false,
            createdAt: now,
            updatedAt: now,
          });
          importedLinks++;
        }

        if (linksToSave.length > 0) {
          await idbBulkPut(STORES.LINKS, linksToSave);
        }
      } else if (sheet.targetDataset === 'ACCOUNT') {
        const accsToSave: AccountItem[] = [];

        for (const row of sheet.rows) {
          const existing = existingAccounts.find(
            (a) => norm(a.software) === norm(row.software) && norm(a.username) === norm(row.username)
          );

          if (existing) {
            if (strategy === 'skip') {
              continue;
            } else if (strategy === 'update') {
              existing.software = row.software;
              existing.username = row.username;
              if (row.password) existing.password = row.password;
              if (row.link) existing.link = row.link;
              if (row.note) existing.note = row.note;
              existing.updatedAt = now;
              await idbPut(STORES.ACCOUNTS, existing);
              importedAccounts++;
              continue;
            }
          }

          accsToSave.push({
            id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
            stt: row.stt,
            software: row.software,
            username: row.username,
            password: row.password,
            link: row.link,
            note: row.note,
            createdAt: now,
            updatedAt: now,
          });
          importedAccounts++;
        }

        if (accsToSave.length > 0) {
          await idbBulkPut(STORES.ACCOUNTS, accsToSave);
        }
      } else if (sheet.targetDataset === 'STORE') {
        const storesToSave: StoreItem[] = [];

        for (const row of sheet.rows) {
          const existing = existingStores.find(
            (s) => norm(s.storeCode) === norm(row.storeCode)
          );

          if (existing) {
            if (strategy === 'skip') {
              continue;
            } else if (strategy === 'update') {
              existing.address = row.address;
              if (row.googleMaps) existing.googleMaps = row.googleMaps;
              if (row.type) existing.type = row.type;
              existing.updatedAt = now;
              await idbPut(STORES.STORES, existing);
              importedStores++;
              continue;
            }
          }

          storesToSave.push({
            id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
            storeCode: row.storeCode,
            address: row.address,
            googleMaps: row.googleMaps,
            type: row.type,
            createdAt: now,
            updatedAt: now,
          });
          importedStores++;
        }

        if (storesToSave.length > 0) {
          await idbBulkPut(STORES.STORES, storesToSave);
        }
      }
    }

    await dataService.logActivity(
      'import',
      'ALL',
      'import-excel',
      `Import Excel hoàn tất: ${importedLinks} links, ${importedAccounts} tài khoản, ${importedStores} cửa hàng`
    );

    return { importedLinks, importedAccounts, importedStores };
  }

  // ==================== EXPORT EXCEL (ENHANCED & PROFESSIONAL) ====================
  // Export single dataset to .xlsx with auto-fit columns and filters
  async exportDataset(dataset: 'LINK' | 'ACCOUNT' | 'STORE'): Promise<void> {
    const wb = XLSX.utils.book_new();

    if (dataset === 'LINK') {
      const items = await dataService.getLinks();
      const exportRows = items.map((item, idx) => ({
        STT: item.stt ?? idx + 1,
        'Hạng mục': shieldFormula(item.hangMuc),
        'Đường dẫn (Link)': shieldFormula(item.link || ''),
        'Danh mục': shieldFormula(item.category || 'Chung'),
        'Ghi chú': shieldFormula(item.note || ''),
        'Yêu thích': item.favorite ? 'Có' : 'Không',
        'Ngày tạo': item.createdAt ? new Date(item.createdAt).toLocaleDateString('vi-VN') : '',
      }));
      const ws = XLSX.utils.json_to_sheet(exportRows);
      applyWorksheetStyles(ws, exportRows, {
        STT: { min: 8, max: 10 },
        'Hạng mục': { min: 28, max: 45 },
        'Đường dẫn (Link)': { min: 35, max: 70 },
        'Danh mục': { min: 16, max: 25 },
        'Ghi chú': { min: 25, max: 50 },
        'Yêu thích': { min: 12, max: 16 },
        'Ngày tạo': { min: 14, max: 18 },
      });
      XLSX.utils.book_append_sheet(wb, ws, 'LINK');
      XLSX.writeFile(wb, `FM_Workspace_Links_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } else if (dataset === 'ACCOUNT') {
      const items = await dataService.getAccounts();
      const exportRows = items.map((item, idx) => ({
        STT: item.stt ?? idx + 1,
        'Phần mềm': shieldFormula(item.software),
        'Tên đăng nhập': shieldFormula(item.username),
        'Mật khẩu': shieldFormula(item.password || ''),
        'Đường dẫn': shieldFormula(item.link || ''),
        'Ghi chú': shieldFormula(item.note || ''),
      }));
      const ws = XLSX.utils.json_to_sheet(exportRows);
      applyWorksheetStyles(ws, exportRows, {
        STT: { min: 8, max: 10 },
        'Phần mềm': { min: 24, max: 40 },
        'Tên đăng nhập': { min: 22, max: 35 },
        'Mật khẩu': { min: 18, max: 30 },
        'Đường dẫn': { min: 32, max: 65 },
        'Ghi chú': { min: 25, max: 50 },
      });
      XLSX.utils.book_append_sheet(wb, ws, 'ACCOUNT');
      XLSX.writeFile(wb, `FM_Workspace_Accounts_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } else if (dataset === 'STORE') {
      const items = await dataService.getStores();
      const exportRows = items.map((item, idx) => ({
        STT: idx + 1,
        'Mã cửa hàng': shieldFormula(item.storeCode),
        'Địa chỉ': shieldFormula(item.address),
        'Google Maps': shieldFormula(item.googleMaps || ''),
        'Loại cửa hàng': shieldFormula(item.type || 'Standard'),
      }));
      const ws = XLSX.utils.json_to_sheet(exportRows);
      applyWorksheetStyles(ws, exportRows, {
        STT: { min: 8, max: 10 },
        'Mã cửa hàng': { min: 15, max: 20 },
        'Địa chỉ': { min: 38, max: 70 },
        'Google Maps': { min: 32, max: 65 },
        'Loại cửa hàng': { min: 18, max: 25 },
      });
      XLSX.utils.book_append_sheet(wb, ws, 'DS CH');
      XLSX.writeFile(wb, `FM_Workspace_Stores_${new Date().toISOString().slice(0, 10)}.xlsx`);
    }

    await dataService.logActivity('export', dataset, 'export-single', `Xuất Excel tập dữ liệu: ${dataset}`);
  }

  // Download empty template file for offline data entry
  downloadTemplate(): void {
    const wb = XLSX.utils.book_new();

    const sampleLinks = [
      { 'Hạng mục': 'Hệ thống Bravo', 'Đường dẫn (Link)': 'https://bravo.farmersmarket.vn', 'Danh mục': 'ERP & Kế toán', 'Ghi chú': 'Hệ thống ERP nhập chứng từ' },
      { 'Hạng mục': 'Báo cáo Thu Mua', 'Đường dẫn (Link)': 'https://docs.google.com/spreadsheets/...', 'Danh mục': 'Báo cáo', 'Ghi chú': 'File theo dõi tiến độ' },
    ];
    const wsLinks = XLSX.utils.json_to_sheet(sampleLinks);
    wsLinks['!cols'] = [{ wch: 30 }, { wch: 45 }, { wch: 20 }, { wch: 35 }];
    XLSX.utils.book_append_sheet(wb, wsLinks, 'LINK');

    const sampleAccounts = [
      { 'Phần mềm': 'Bravo ERP', 'Tên đăng nhập': 'thumua01', 'Mật khẩu': 'Bravo@2026', 'Đường dẫn': 'https://bravo.farmersmarket.vn', 'Ghi chú': 'Tài khoản duyệt PO' },
    ];
    const wsAccs = XLSX.utils.json_to_sheet(sampleAccounts);
    wsAccs['!cols'] = [{ wch: 25 }, { wch: 25 }, { wch: 20 }, { wch: 40 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, wsAccs, 'ACCOUNT');

    const sampleStores = [
      { 'Mã cửa hàng': 'FM01', 'Địa chỉ': '496 Nguyễn Thị Minh Khai, P.2, Q.3', 'Google Maps': 'https://maps.google.com/?q=...', 'Loại cửa hàng': 'Standard' },
      { 'Mã cửa hàng': 'FM02', 'Địa chỉ': '218 Hai Bà Trưng, P.Tân Định, Q.1', 'Google Maps': 'https://maps.google.com/?q=...', 'Loại cửa hàng': 'Standard' },
    ];
    const wsStores = XLSX.utils.json_to_sheet(sampleStores);
    wsStores['!cols'] = [{ wch: 15 }, { wch: 45 }, { wch: 40 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, wsStores, 'DS CH');

    XLSX.writeFile(wb, 'FM_WORKSPACE_TEMPLATE_MAU.xlsx');
  }

  // Export full workspace to a multi-sheet workbook with Cover Summary + auto-fit columns
  async exportFullWorkspace(): Promise<void> {
    const wb = XLSX.utils.book_new();

    const [links, accounts, stores] = await Promise.all([
      dataService.getLinks(),
      dataService.getAccounts(),
      dataService.getStores(),
    ]);

    const exportDateStr = new Date().toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });

    // Sheet 1: TỔNG QUAN (Executive Summary & Index)
    const summaryRows = [
      {
        'DANH MỤC HỆ THỐNG': 'HỆ THỐNG TRỢ LÝ THU MUA - FARMERS MARKET',
        'THÔNG SỐ / SỐ LƯỢNG': 'PHIÊN BẢN CHÍNH THỨC',
        'CHI TIẾT & HƯỚNG DẪN': 'Báo cáo trích xuất tự động từ Workspace cá nhân',
      },
      {
        'DANH MỤC HỆ THỐNG': 'Thời gian trích xuất dữ liệu',
        'THÔNG SỐ / SỐ LƯỢNG': exportDateStr,
        'CHI TIẾT & HƯỚNG DẪN': 'Thời gian xuất file trên hệ thống máy tính người dùng',
      },
      {
        'DANH MỤC HỆ THỐNG': 'Giao diện & Kiến trúc',
        'THÔNG SỐ / SỐ LƯỢNG': 'FM Workspace OS v2.0',
        'CHI TIẾT & HƯỚNG DẪN': 'Lưu trữ IndexedDB cục bộ, bảo mật đa tầng, không lưu cloud',
      },
      {
        'DANH MỤC HỆ THỐNG': '',
        'THÔNG SỐ / SỐ LƯỢNG': '',
        'CHI TIẾT & HƯỚNG DẪN': '',
      },
      {
        'DANH MỤC HỆ THỐNG': 'PHÂN HỆ 1: LỐI TẮT LIÊN KẾT (Sheet: LINK)',
        'THÔNG SỐ / SỐ LƯỢNG': `${links.length} liên kết`,
        'CHI TIẾT & HƯỚNG DẪN': 'Danh mục links Bravo, ERP, Báo cáo, Drive, Portal, Form mẫu',
      },
      {
        'DANH MỤC HỆ THỐNG': 'PHÂN HỆ 2: KÉT BẢO MẬT TÀI KHOẢN (Sheet: ACCOUNT)',
        'THÔNG SỐ / SỐ LƯỢNG': `${accounts.length} tài khoản`,
        'CHI TIẾT & HƯỚNG DẪN': 'Thông tin tài khoản phần mềm tác nghiệp (SAP, POS, Bravo, Portal...)',
      },
      {
        'DANH MỤC HỆ THỐNG': 'PHÂN HỆ 3: DANH MỤC CỬA HÀNG (Sheet: DS CH)',
        'THÔNG SỐ / SỐ LƯỢNG': `${stores.length} chi nhánh`,
        'CHI TIẾT & HƯỚNG DẪN': 'Tra cứu mã chi nhánh FM, địa chỉ thực tế và vị trí Google Maps',
      },
      {
        'DANH MỤC HỆ THỐNG': '',
        'THÔNG SỐ / SỐ LƯỢNG': '',
        'CHI TIẾT & HƯỚNG DẪN': '',
      },
      {
        'DANH MỤC HỆ THỐNG': 'HƯỚNG DẪN SỬ DỤNG VÀ THAO TÁC',
        'THÔNG SỐ / SỐ LƯỢNG': '',
        'CHI TIẾT & HƯỚNG DẪN': '',
      },
      {
        'DANH MỤC HỆ THỐNG': '1. Xem chi tiết các sheet',
        'THÔNG SỐ / SỐ LƯỢNG': 'Nhấp vào các Tab phía dưới',
        'CHI TIẾT & HƯỚNG DẪN': 'Xem từng bảng tương ứng: [LINK] - [ACCOUNT] - [DS CH]',
      },
      {
        'DANH MỤC HỆ THỐNG': '2. Bộ lọc thông minh',
        'THÔNG SỐ / SỐ LƯỢNG': 'AutoFilter bật sẵn',
        'CHI TIẾT & HƯỚNG DẪN': 'Dòng tiêu đề đã có sẵn nút mũi tên để lọc và sắp xếp theo ý muốn',
      },
      {
        'DANH MỤC HỆ THỐNG': '3. Căn chỉnh độ rộng ô',
        'THÔNG SỐ / SỐ LƯỢNG': 'Đã tự động căn đều (Auto-fit)',
        'CHI TIẾT & HƯỚNG DẪN': 'Các cột đã được tính toán chiều rộng chuẩn, không bị che chữ hay lỗi ###',
      },
      {
        'DANH MỤC HỆ THỐNG': '4. Tương thích Import ngược',
        'THÔNG SỐ / SỐ LƯỢNG': '100% Hoàn hảo',
        'CHI TIẾT & HƯỚNG DẪN': 'File này có thể tải lên lại vào app tại mục [Excel Hub] bất cứ lúc nào',
      },
    ];
    const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
    wsSummary['!cols'] = [{ wch: 42 }, { wch: 28 }, { wch: 60 }];
    wsSummary['!views'] = [{ state: 'frozen', ySplit: 1 }];
    XLSX.utils.book_append_sheet(wb, wsSummary, 'TỔNG QUAN');

    // Sheet 2: LINK
    const linkRows = links.map((item, idx) => ({
      STT: item.stt ?? idx + 1,
      'Hạng mục': shieldFormula(item.hangMuc),
      'Đường dẫn (Link)': shieldFormula(item.link || ''),
      'Danh mục': shieldFormula(item.category || 'Chung'),
      'Ghi chú': shieldFormula(item.note || ''),
      'Yêu thích': item.favorite ? 'Có' : 'Không',
      'Ngày tạo': item.createdAt ? new Date(item.createdAt).toLocaleDateString('vi-VN') : '',
    }));
    const wsLinks = XLSX.utils.json_to_sheet(linkRows);
    applyWorksheetStyles(wsLinks, linkRows, {
      STT: { min: 8, max: 10 },
      'Hạng mục': { min: 28, max: 45 },
      'Đường dẫn (Link)': { min: 35, max: 70 },
      'Danh mục': { min: 16, max: 25 },
      'Ghi chú': { min: 25, max: 50 },
      'Yêu thích': { min: 12, max: 16 },
      'Ngày tạo': { min: 14, max: 18 },
    });
    XLSX.utils.book_append_sheet(wb, wsLinks, 'LINK');

    // Sheet 3: ACCOUNT
    const accRows = accounts.map((item, idx) => ({
      STT: item.stt ?? idx + 1,
      'Phần mềm': shieldFormula(item.software),
      'Tên đăng nhập': shieldFormula(item.username),
      'Mật khẩu': shieldFormula(item.password || ''),
      'Đường dẫn': shieldFormula(item.link || ''),
      'Ghi chú': shieldFormula(item.note || ''),
    }));
    const wsAccs = XLSX.utils.json_to_sheet(accRows);
    applyWorksheetStyles(wsAccs, accRows, {
      STT: { min: 8, max: 10 },
      'Phần mềm': { min: 24, max: 40 },
      'Tên đăng nhập': { min: 22, max: 35 },
      'Mật khẩu': { min: 18, max: 30 },
      'Đường dẫn': { min: 32, max: 65 },
      'Ghi chú': { min: 25, max: 50 },
    });
    XLSX.utils.book_append_sheet(wb, wsAccs, 'ACCOUNT');

    // Sheet 4: DS CH
    const storeRows = stores.map((item, idx) => ({
      STT: idx + 1,
      'Mã cửa hàng': shieldFormula(item.storeCode),
      'Địa chỉ': shieldFormula(item.address),
      'Google Maps': shieldFormula(item.googleMaps || ''),
      'Loại cửa hàng': shieldFormula(item.type || 'Standard'),
    }));
    const wsStores = XLSX.utils.json_to_sheet(storeRows);
    applyWorksheetStyles(wsStores, storeRows, {
      STT: { min: 8, max: 10 },
      'Mã cửa hàng': { min: 15, max: 20 },
      'Địa chỉ': { min: 38, max: 70 },
      'Google Maps': { min: 32, max: 65 },
      'Loại cửa hàng': { min: 18, max: 25 },
    });
    XLSX.utils.book_append_sheet(wb, wsStores, 'DS CH');

    const fileName = `FM_WORKSPACE_BACKUP_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, fileName);

    await dataService.logActivity(
      'export',
      'ALL',
      'export-all',
      'Xuất toàn bộ Workspace ra file Excel đa sheet chuyên nghiệp'
    );
  }
}

export const excelService = new ExcelService();
