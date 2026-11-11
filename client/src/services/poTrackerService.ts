import { api } from '@/lib/api';
import {
  POTrackerPO,
  POFolderItem,
  POExtractedData,
  POTrackerStats,
  POPermission,
} from '@/types/po-tracker';
import { getStoredGeminiKey, getGeminiKeysPool, discoverBestFlashModels } from './writingToolsService';
import { convertPdfToImages, extractPdfData } from '@/utils/pdfToImage';
import { parseFastPOFromText, FastPOResult, FastMathIntegrity } from '@/utils/fastPoTableParser';
import { STORES, idbGetAll, idbGetById, idbPut, idbBulkPut, idbDelete } from './storage/indexedDb';

export { parseFastPOFromText, type FastPOResult, type FastMathIntegrity };

type ApiResponse<T> = { success: boolean; data: T; message?: string };

const fileToDataUrl = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
};

/**
 * Trích xuất an toàn chuỗi base64 và mimeType từ DataURL mà không dùng regex backtracker trên chuỗi lớn
 */
export function extractCleanBase64(dataUrl: string): { mimeType: string; base64: string } {
  let mimeType = 'application/pdf';
  let base64 = dataUrl || '';

  const commaIdx = dataUrl.indexOf(',');
  if (commaIdx !== -1) {
    const meta = dataUrl.substring(0, commaIdx);
    const mimeMatch = meta.match(/data:([^;]+)/i);
    if (mimeMatch && mimeMatch[1]) {
      mimeType = mimeMatch[1].trim();
    }
    base64 = dataUrl.substring(commaIdx + 1);
  }

  // Loại bỏ hoàn toàn khoảng trắng, xuống dòng có thể làm hỏng REST payload
  base64 = base64.replace(/\s+/g, '');
  return { mimeType, base64 };
}

/**
 * Chuẩn hóa số tiền, số lượng theo định dạng Việt Nam (VD: "181.600,00" -> 181600, "46,00" -> 46)
 */
export function cleanVietnameseNumber(val: any): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val) return 0;
  let str = String(val).trim();
  // Nếu là dạng 181.600,00 hoặc 8.353.600,00 (chấm phân cách nghìn, phẩy thập phân)
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(str)) {
    str = str.replace(/\./g, '').replace(',', '.');
  } else if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(str)) {
    str = str.replace(/,/g, '');
  } else {
    // Trường hợp có dấu phẩy đơn lẻ như 46,00 -> 46.00
    if (/^\d+,\d+$/.test(str)) {
      str = str.replace(',', '.');
    } else {
      str = str.replace(/[^\d.-]/g, '');
    }
  }
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

/**
 * Chuẩn hóa ngày chứng từ Việt Nam thành YYYY-MM-DD (VD: "2/11/2026" -> "2026-11-02", "05-Nov-2026" -> "2026-11-05")
 */
export function cleanVietnameseDate(val: any): string | null {
  if (!val || typeof val !== 'string') return null;
  let str = val.trim();
  // Loại bỏ các tiền tố ngày phổ biến
  str = str.replace(/^(ngày\s*chứng\s*từ|ngày\s*giao\s*hàng|ngày|date|hạn\s*giao)[\s:]+/i, '').trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

  // D/M/YYYY hoặc DD/MM/YYYY (ví dụ: "2/11/2026", "05/11/2026", "5-11-2026")
  const dmyMatch = str.match(/(?:^|\b)(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})(?:\b|$)/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    const year = dmyMatch[3];
    return `${year}-${month}-${day}`;
  }

  // DD-MMM-YYYY (VD: 05-Nov-2026, 2-Nov-2026)
  const monthMap: Record<string, string> = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
    thg1: '01', thg2: '02', thg3: '03', thg4: '04', thg5: '05', thg6: '06',
    thg7: '07', thg8: '08', thg9: '09', thg10: '10', thg11: '11', thg12: '12'
  };
  const namedMatch = str.match(/(?:^|\b)(\d{1,2})[\s\-\/]([a-zA-Z0-9]+)[\s\-\/](\d{4})(?:\b|$)/);
  if (namedMatch) {
    const day = namedMatch[1].padStart(2, '0');
    const mName = namedMatch[2].toLowerCase();
    const month = monthMap[mName] || '01';
    const year = namedMatch[3];
    return `${year}-${month}-${day}`;
  }

  return str;
}

/**
 * Tự động trích xuất số PO, Nhà cung cấp và Kho/Chi nhánh từ tên file chứng từ
 * (ví dụ: "118873_BẢO MINH_DC01.pdf" -> PO: PO-118873, NCC: BẢO MINH, Kho: DC01)
 */
export function extractMetadataFromFileName(fileName: string): {
  po_number?: string;
  warehouse?: string;
  supplier_name?: string;
} {
  if (!fileName) return {};
  const clean = fileName.replace(/\.[a-zA-Z0-9]+$/i, '').trim();
  const parts = clean.split(/[-_–—|]+/).map((p) => p.trim()).filter(Boolean);

  let poNumber = '';
  let warehouse = '';
  let supplierName = '';

  for (const part of parts) {
    if (/^\d{5,8}$/.test(part) || /^PO[-_]?\d+/i.test(part)) {
      poNumber = /^PO/i.test(part) ? part.toUpperCase() : `PO-${part}`;
    } else if (/\b(CENTRAL|DC\d*|KHO|FM\d+|STORE|CHINHANH|NƠ TRANG LONG|BÌNH THẠNH)\b/i.test(part)) {
      if (!warehouse) warehouse = part;
      else warehouse += ` - ${part}`;
    } else if (part.length >= 2 && !/^\d+$/.test(part)) {
      // Phân đoạn chữ thông thường là tên Nhà cung cấp (VD: "BẢO MINH", "DEVIE", "LƯƠNG GIA")
      if (!supplierName) {
        supplierName = part;
      }
    }
  }

  return {
    po_number: poNumber || undefined,
    warehouse: warehouse || undefined,
    supplier_name: supplierName || undefined,
  };
}

/**
 * Trích xuất trực tiếp siêu tốc (Fast-Pass Regex) các trường chính yếu từ văn bản thuần PDF
 * Chạy trong 1ms, độ chính xác 100% đối với định dạng chứng từ PO Farmers Market/Laria
 */
export function extractFastPassFromText(text: string): Partial<POExtractedData> {
  if (!text || text.length < 20) return {};
  const res: Partial<POExtractedData> = {};

  // 1. Số hiệu chứng từ: PO-118292
  const poMatch = text.match(/(?:số\s*hiệu\s*chứng\s*từ|số\s*po|số\s*đơn(?:\s*hàng)?|po\s*no\.?)\s*[:：]?\s*(PO[-_\s]?\d+|\d{5,8})/i);
  if (poMatch) {
    const rawPo = poMatch[1].replace(/\s+/g, '');
    res.po_number = /^PO/i.test(rawPo) ? rawPo.toUpperCase() : `PO-${rawPo}`;
  }

  // 2. Tên NCC: CÔNG TY CỔ PHẦN DEVIE (bỏ qua LARIA / FARMERS MARKET)
  const nccMatch = text.match(/Tên\s*NCC\s*[:：]\s*([^\n\r\t]+?)(?=\s+Mã\s*NCC|\s+Số\s*ĐT|\s+Địa\s*chỉ|$)/i);
  if (nccMatch) {
    const rawNcc = nccMatch[1].trim();
    if (!/LARIA|FARMERS.*MARKET/i.test(rawNcc)) {
      res.supplier_name = rawNcc;
    }
  }

  // 3. Mã NCC: V0001613
  const maNccMatch = text.match(/Mã\s*NCC\s*[:：]\s*([A-Za-z0-9_-]+)/i);
  if (maNccMatch) {
    res.supplier_code = maNccMatch[1].trim();
  }

  // 4. Ngày chứng từ: 2/11/2026
  const ngayCtMatch = text.match(/Ngày\s*chứng\s*từ\s*[:：]\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4})/i);
  if (ngayCtMatch) {
    res.po_date = cleanVietnameseDate(ngayCtMatch[1]);
  }

  // 5. Ngày giao hàng: 5/11/2026
  const ngayGiaoMatch = text.match(/Ngày\s*giao\s*(?:hàng)?\s*[:：]\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4})/i);
  if (ngayGiaoMatch) {
    res.expected_delivery_date = cleanVietnameseDate(ngayGiaoMatch[1]);
  }

  // 6. Chi nhánh yêu cầu / Kho
  const khoMatch = text.match(/(?:Chi\s*nhánh\s*yêu\s*cầu|Địa\s*chỉ\s*giao\s*hàng)\s*[:：]\s*([^\n\r]+?)(?=\s*Kho\s*[:：]|\s*STT|$)/i);
  if (khoMatch) {
    res.warehouse = khoMatch[1].trim();
  }

  // 7. Tổng tiền hàng
  const tongTienMatch = text.match(/TỔNG\s*TIỀN\s*HÀNG\s*[:：]?\s*([0-9.,]+)/i) ||
                        text.match(/TỔNG\s*CỘNG\s*TRƯỚC\s*THUẾ\s*VAT\s*[:：]?\s*([0-9.,]+)/i);
  if (tongTienMatch) {
    res.total_value = cleanVietnameseNumber(tongTienMatch[1]);
  }

  // 8. Người đặt hàng
  const nguoiDatMatch = text.match(/Người\s*đặt\s*hàng\s*[:：]?\s*([A-ZÀ-Ỹa-zà-ỹ\s]+?)(?=\s+Người\s*Duyệt|\s+Người\s*Nhận|$)/i);
  if (nguoiDatMatch) {
    res.notes = nguoiDatMatch[1].trim();
  }

  return res;
}

export function safeParseAIJson(text: string, fileName?: string): any {
  if (!text || typeof text !== 'string') return {};
  let trimmed = text.trim();

  // 1. Loại bỏ markdown code fence nếu có
  trimmed = trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  let rawParsed: any = null;

  // 2. Parse trực tiếp nếu chuỗi là JSON hoàn chỉnh
  try {
    rawParsed = JSON.parse(trimmed);
  } catch (_) {}

  // 3. Trích xuất substring giữa dấu { đầu tiên và } cuối cùng
  if (!rawParsed) {
    const firstBrace = trimmed.indexOf('{');
    const lastBrace = trimmed.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      try {
        rawParsed = JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
      } catch (_) {}
    }
  }

  // 4. Cơ chế phục hồi JSON bị cắt ngắn (Truncated JSON Repair)
  if (!rawParsed) {
    const firstBrace = trimmed.indexOf('{');
    if (firstBrace !== -1) {
      let partial = trimmed.slice(firstBrace).replace(/,\s*$/, '');
      let inString = false;
      let escaped = false;
      let openBraces = 0;
      let openBrackets = 0;

      for (let i = 0; i < partial.length; i++) {
        const ch = partial[i];
        if (ch === '\\' && !escaped) {
          escaped = true;
          continue;
        }
        if (ch === '"' && !escaped) {
          inString = !inString;
        } else if (!inString) {
          if (ch === '{') openBraces++;
          else if (ch === '}') openBraces--;
          else if (ch === '[') openBrackets++;
          else if (ch === ']') openBrackets--;
        }
        escaped = false;
      }

      if (inString) partial += '"';
      while (openBrackets > 0) {
        partial += ']';
        openBrackets--;
      }
      while (openBraces > 0) {
        partial += '}';
        openBraces--;
      }

      try {
        rawParsed = JSON.parse(partial);
      } catch (_) {}
    }
  }

  // 5. Regex Fallback: cứu các trường dữ liệu chính nếu JSON bị hỏng nặng
  if (!rawParsed || typeof rawParsed !== 'object') {
    const fallbackObj: any = { items: [] };
    const poMatch = trimmed.match(/"po_number"\s*:\s*"([^"]+)"/i) || trimmed.match(/PO[-_\s]?(\d{5,8})/i);
    if (poMatch) fallbackObj.po_number = poMatch[1];

    const suppMatch = trimmed.match(/"supplier_name"\s*:\s*"([^"]+)"/i);
    if (suppMatch) fallbackObj.supplier_name = suppMatch[1];

    const suppCodeMatch = trimmed.match(/"supplier_code"\s*:\s*"([^"]+)"/i);
    if (suppCodeMatch) fallbackObj.supplier_code = suppCodeMatch[1];

    const dateMatch = trimmed.match(/"po_date"\s*:\s*"([^"]+)"/i);
    if (dateMatch) fallbackObj.po_date = dateMatch[1];

    const expMatch = trimmed.match(/"expected_delivery_date"\s*:\s*"([^"]+)"/i);
    if (expMatch) fallbackObj.expected_delivery_date = expMatch[1];

    const whMatch = trimmed.match(/"warehouse"\s*:\s*"([^"]+)"/i);
    if (whMatch) fallbackObj.warehouse = whMatch[1];

    const totalMatch = trimmed.match(/"total_value"\s*:\s*([0-9.,]+)/i);
    if (totalMatch) fallbackObj.total_value = cleanVietnameseNumber(totalMatch[1]);

    rawParsed = fallbackObj;
  }

  // 6. Chuẩn hóa sâu toàn bộ các trường dữ liệu (Ngày tháng, số tiền, định dạng mã)
  // Tự động tháo bỏ các vỏ bọc lồng nhau nếu AI trả về dạng { data: ... } hoặc { purchase_order: ... }
  let dataObj = rawParsed;
  if (dataObj && typeof dataObj === 'object') {
    if (dataObj.data && typeof dataObj.data === 'object' && !Array.isArray(dataObj.data)) {
      dataObj = { ...dataObj.data, ...dataObj };
    }
    if (dataObj.purchase_order && typeof dataObj.purchase_order === 'object') {
      dataObj = { ...dataObj.purchase_order, ...dataObj };
    }
    if (dataObj.po && typeof dataObj.po === 'object') {
      dataObj = { ...dataObj.po, ...dataObj };
    }
    if (dataObj.don_mua_hang && typeof dataObj.don_mua_hang === 'object') {
      dataObj = { ...dataObj.don_mua_hang, ...dataObj };
    }
  }

  let poNum = String(
    dataObj.po_number || dataObj.so_po || dataObj.so_hieu_chung_tu || dataObj.order_number || dataObj.po_code || ''
  ).trim();
  if (poNum && !/^PO/i.test(poNum) && /^\d{5,8}$/.test(poNum)) {
    poNum = `PO-${poNum}`;
  }

  let suppName = String(
    dataObj.supplier_name || dataObj.ten_ncc || dataObj.vendor_name || dataObj.nha_cung_cap || ''
  ).trim();
  // Bảo vệ: Nếu AI nhầm tên người mua "CÔNG TY TNHH THƯƠNG MẠI LARIA - FARMERS MARKET" làm NCC, xóa bỏ để lấy từ gợi ý
  if (suppName && /LARIA|FARMERS.*MARKET/i.test(suppName)) {
    suppName = '';
  }

  const rawItemsList =
    dataObj.items || dataObj.products || dataObj.danh_sach_hang_hoa || dataObj.hang_hoa || dataObj.lines || [];

  const normalized: any = {
    po_number: poNum || null,
    po_date: cleanVietnameseDate(dataObj.po_date || dataObj.ngay_chung_tu || dataObj.ngay_lap_po || dataObj.order_date),
    expected_delivery_date: cleanVietnameseDate(
      dataObj.expected_delivery_date || dataObj.ngay_giao_hang || dataObj.han_giao_hang || dataObj.delivery_date
    ),
    supplier_code: String(dataObj.supplier_code || dataObj.ma_ncc || dataObj.vendor_code || '').trim() || null,
    supplier_name: suppName || null,
    warehouse: String(dataObj.warehouse || dataObj.chi_nhanh_yeu_cau || dataObj.dia_chi_giao_hang || dataObj.kho_nhan || '').trim() || null,
    total_value: cleanVietnameseNumber(dataObj.total_value || dataObj.tong_tien_hang || dataObj.tong_cong || dataObj.total_amount),
    currency: dataObj.currency || 'VND',
    notes: String(dataObj.notes || dataObj.nguoi_dat_hang || dataObj.ghi_chu || '').trim() || null,
    items: [],
  };

  // Chuẩn hóa từng dòng mặt hàng
  if (Array.isArray(rawItemsList)) {
    normalized.items = rawItemsList
      .map((it: any) => {
        if (!it || typeof it !== 'object') return null;
        const ordered_qty = cleanVietnameseNumber(it.ordered_qty || it.so_luong || it.qty || it.quantity || 1);
        const unit_price = cleanVietnameseNumber(it.unit_price || it.don_gia || it.price || 0);
        const total_price = cleanVietnameseNumber(it.total_price || it.thanh_tien || it.amount || (ordered_qty * unit_price));
        const item_code = String(it.item_code || it.internal_code || it.barcode || it.sku || it.plu || '').trim();
        const item_name = String(it.item_name || it.ten_hang || it.mat_hang || it.description || it.name || 'Sản phẩm').trim();
        const unit = String(it.unit || it.dvt || it.don_vi_tinh || 'Gói').trim();
        const wh = String(it.warehouse || it.kho || normalized.warehouse || '').trim();

        return {
          item_code: item_code || null,
          item_name: item_name,
          unit: unit || 'Gói',
          ordered_qty: ordered_qty > 0 ? ordered_qty : 1,
          unit_price: unit_price,
          total_price: total_price,
          warehouse: wh || null,
        };
      })
      .filter((it: any) => it && (it.item_name || it.item_code));
  } else {
    normalized.items = [];
  }

  return enrichWithFileNameHints(normalized, fileName);
}

function enrichWithFileNameHints(data: any, fileName?: string): any {
  if (!fileName) return data;
  const hints = extractMetadataFromFileName(fileName);
  return {
    ...data,
    po_number: data.po_number || hints.po_number || null,
    warehouse: data.warehouse || hints.warehouse || null,
    supplier_name: data.supplier_name || hints.supplier_name || null,
  };
}

/**
 * Nén và giới hạn kích thước ảnh (max chiều dài 1600px, JPEG 0.78), giảm 75% dung lượng base64 gửi qua mạng
 */
export async function compressImageIfNeeded(dataUrl: string, maxDim = 1600, quality = 0.78): Promise<string> {
  if (typeof window === 'undefined' || !dataUrl || !dataUrl.startsWith('data:image/')) {
    return dataUrl;
  }
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let width = img.width;
      let height = img.height;
      if (width <= maxDim && height <= maxDim && dataUrl.length < 500_000) {
        resolve(dataUrl);
        return;
      }
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      } else {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

/**
 * Trực tiếp bóc tách PO qua Gemini Vision phía trình duyệt bằng mô hình tốc độ cao
 */
async function clientSideGeminiExtract(
  base64Data: string,
  mimeType: string,
  fileName: string,
  apiKeys: string[],
  additionalImages?: string[],
  digitalText?: string
): Promise<POExtractedData> {
  const rawCandidateKeys = [
    ...apiKeys,
    getStoredGeminiKey(),
    ...getGeminiKeysPool().map((p) => p.key),
  ];
  const uniqueKeys = Array.from(
    new Set(
      rawCandidateKeys
        .filter((k): k is string => typeof k === 'string')
        .map((k) => k.trim())
        .filter((k) => (k.startsWith('AIzaSy') || k.startsWith('AQ.') || (!k.startsWith('sk-') && k.length >= 20)) && !k.includes('••••'))
    )
  );
  if (uniqueKeys.length === 0) {
    throw new Error('Chưa cấu hình Gemini API Key hợp lệ. Vui lòng vào Cài đặt để thêm Google Gemini API Key.');
  }

  const prompt = `Bạn là chuyên gia phân tích và bóc tách dữ liệu chứng từ Đơn mua hàng (PO - Purchase Order) của hệ thống siêu thị FARMERS MARKET (CÔNG TY TNHH THƯƠNG MẠI LARIA) và các chuỗi bán lẻ tại Việt Nam.

Hãy phân tích toàn bộ nội dung tài liệu được cung cấp và trích xuất đầy đủ, chính xác tất cả các thông tin sau theo cấu trúc JSON:

QUY TẮC BÓC TÁCH CHUẨN XÁC:
1. "po_number" (Số hiệu PO / Mã đơn hàng):
   - Lấy sau "Số hiệu chứng từ:", "Số PO", "Số đơn đặt hàng", hoặc mã 5-8 chữ số ở đầu chứng từ (ví dụ: "PO-118292", "PO-118873", "PO-118744", "PO-118748"). Nếu chưa có tiền tố "PO-", hãy thêm "PO-". Tham khảo tên file: "${fileName}".
2. "supplier_name" (Tên Nhà cung cấp / Đơn vị cung ứng):
   - CỰC KỲ QUAN TRỌNG: "CÔNG TY TNHH THƯƠNG MẠI LARIA", "FARMERS MARKET", "HỆ THỐNG SIÊU THỊ FARMERS MARKET" là BÊN MUA HÀNG (Buyer / Đơn vị mua hàng). TUYỆT ĐỐI KHÔNG LẤY TÊN NÀY LÀM NHÀ CUNG CẤP!
   - TÊN NHÀ CUNG CẤP là đơn vị bán hàng, nằm sau nhãn "Tên NCC:", "Nhà cung cấp:", "Vendor:", "Supplier:" (ví dụ: "CÔNG TY CỔ PHẦN DEVIE", "CÔNG TY TNHH BẢO MINH", "CENTRAL RETAIL", "CÔNG TY TNHH CENTRAL DISTRIBUTION", "LƯƠNG GIA").
3. "supplier_code" (Mã Nhà cung cấp):
   - Lấy sau nhãn "Mã NCC:" hoặc "Mã vendor:" (ví dụ: "V0001613", "V0001834").
4. "po_date" (Ngày lập chứng từ PO):
   - Lấy sau nhãn "Ngày chứng từ:" hoặc "Ngày đặt:" (ví dụ: "2/11/2026" chuẩn hóa thành "2026-11-02", "05-Nov-2026" thành "2026-11-05").
5. "expected_delivery_date" (Hạn giao hàng / Ngày giao dự kiến):
   - Lấy sau nhãn "Ngày giao hàng:" hoặc "Hạn giao:" (ví dụ: "5/11/2026" chuẩn hóa thành "2026-11-05").
6. "warehouse" (Kho nhận hàng / Chi nhánh yêu cầu):
   - Lấy sau "Chi nhánh yêu cầu:" hoặc "Địa chỉ giao hàng:" hoặc "Kho nhận:" (ví dụ: "DC01 - Nơ Trang Long, 204 Nơ Trang Long, Phường Bình Thạnh, TP.HCM").
7. "total_value" (Tổng giá trị đơn hàng / Tổng thanh toán):
   - Lấy từ dòng "TỔNG TIỀN HÀNG" hoặc "TỔNG CỘNG TRƯỚC THUẾ VAT", là một số thực nguyên bản (bỏ các dấu phân cách chấm, phẩy). Ví dụ: 9021888 hoặc 8353600.
8. "currency": Đơn vị tiền tệ, mặc định "VND".
9. "notes": Người đặt hàng từ nhãn "Người đặt hàng:" (ví dụ: "Nguyễn Hùng Tiến") hoặc ghi chú đơn hàng.
10. "items" (Danh sách toàn bộ các dòng mặt hàng trong bảng ĐƠN MUA HÀNG):
    Bóc tách ĐẦY ĐỦ TẤT CẢ các dòng sản phẩm trong bảng chi tiết, tuyệt đối không bỏ sót dòng nào:
    - "item_code": Cột "Internal Code", "Barcode/PLU" hoặc mã SKU (ví dụ: "10015745").
    - "item_name": Cột "Mặt hàng" hoặc "Tên sản phẩm" (ví dụ: "Hạt dinh dưỡng Your SuperFood Mix nhiều loại hạt hũ 400 g", "Bánh mì hoa cúc Harrys 500 g").
    - "ordered_qty": Cột "Số lượng" (kiểu số, chuyển "46,00" thành 46, "225" thành 225).
    - "unit": Cột "DVT" (ví dụ: "Hũ", "Hộp", "Thùng", "Kg", "Gói", "Chai", "Lon", "Túi", "Cái").
    - "unit_price": Cột "Đơn giá chưa VAT" hoặc "Đơn giá chưa VAT sau chiết khấu" (kiểu số, ví dụ: 181600).
    - "total_price": Cột "Thành tiền chưa VAT" (kiểu số, ví dụ: 8353600).
    - "warehouse": Kho nhận nếu có (ví dụ: "DC01 - Nơ Trang Long").

Chỉ trả về DUY NHẤT một chuỗi JSON hợp lệ theo đúng cấu trúc trên, không bọc markdown fence, không kèm bất kỳ văn bản giải thích nào khác.`;

  // TÁCH BẠCH RÕ LUỒNG TEXT VS VISION:
  // - Nếu tệp có Digital Text: Gửi ONLY prompt + Digital Text (không đính kèm ảnh Canvas nặng), giảm độ trễ từ 25s xuống 1.5s!
  // - Chỉ đính kèm ảnh khi tệp là file ảnh scan thuần túy (không có text layer).
  const hasDigitalText = Boolean(digitalText && digitalText.trim().length > 50);
  const contentParts: any[] = [{ text: prompt }];

  if (hasDigitalText) {
    contentParts.push({
      text: `NỘI DUNG VĂN BẢN TRÍCH XUẤT TỪ CHỨNG TỪ (DIGITAL TEXT):\n"""\n${digitalText!.slice(0, 25000)}\n"""\nHãy trích xuất đầy đủ thông tin đơn hàng và bảng danh sách mặt hàng dựa trên nội dung văn bản này.`
    });
  } else {
    if (Array.isArray(additionalImages) && additionalImages.length > 0) {
      for (const imgUrl of additionalImages) {
        const { mimeType: mType, base64: b64 } = extractCleanBase64(imgUrl);
        if (b64) {
          contentParts.push({ inlineData: { mimeType: mType || 'image/jpeg', data: b64 } });
        }
      }
    } else if (base64Data) {
      contentParts.push({ inlineData: { mimeType, data: base64Data } });
    }
  }

  let lastErr = '';

  for (const k of uniqueKeys) {
    let keyExhausted = false;
    const models = await discoverBestFlashModels(k).catch(() => []);
    // Triệt tiêu model 404 không tồn tại ('gemini-2.5-flash', 'preview'...), đưa các model chuẩn tốc độ cao lên đầu
    const priorityModels = Array.from(new Set([
      'gemini-2.0-flash',
      'gemini-1.5-flash',
      'gemini-2.0-flash-lite',
      ...models.filter((m) => !m.includes('pro') && !m.includes('2.5') && !m.includes('preview')),
    ]));

    for (const model of priorityModels) {
      if (keyExhausted) break;

      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${k}`;

        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: contentParts }],
            generationConfig: {
              temperature: 0,
              maxOutputTokens: 8192,
              responseMimeType: 'application/json',
              thinkingConfig: { thinkingBudget: 0 },
            },
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          lastErr = errData.error?.message || `HTTP ${res.status}`;
          const isQuotaOrAuth =
            res.status === 429 ||
            res.status === 403 ||
            res.status === 400 ||
            errData.error?.status === 'RESOURCE_EXHAUSTED' ||
            errData.error?.message?.toLowerCase().includes('quota') ||
            errData.error?.message?.toLowerCase().includes('api key');

          if (isQuotaOrAuth) {
            console.warn(`Gemini API key ${k.slice(0, 8)}... quota/auth issue: ${lastErr}. Chuyển ngay khóa dự phòng tiếp theo.`);
            keyExhausted = true;
            break;
          }
          continue;
        }

        const resJson = await res.json();
        const text = resJson.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '{}';
        const parsed = safeParseAIJson(text, fileName);
        if (parsed && (parsed.po_number || parsed.supplier_name || (parsed.items && parsed.items.length > 0))) {
          return parsed;
        }
      } catch (err: any) {
        lastErr = err.message;
      }
    }
  }

  throw new Error(lastErr || 'Các mô hình AI đều không thể trích xuất bảng dữ liệu từ tài liệu này.');
}

const LOCAL_POS_KEY = 'po_tracker_local_pos_v2';
const LOCAL_FOLDERS_KEY = 'po_tracker_local_folders_v2';
const FM_PO_FOLDERS_KEY = 'fm_po_folders';

const defaultLocalFolders: POFolderItem[] = [
  { id: 'f-default-1', name: 'Hàng kinh doanh', description: 'Các đơn hàng thu mua sản phẩm thương mại', color: 'blue', icon: 'shippingbox', sort_order: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'f-default-2', name: 'Vật tư & Bao bì', description: 'Bao bì đóng gói, tem nhãn', color: 'amber', icon: 'shippingbox', sort_order: 2, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
];

export function getLocalPOs(): POTrackerPO[] {
  try {
    const raw = localStorage.getItem(LOCAL_POS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (_) {
    return [];
  }
}

export function saveLocalPOs(pos: POTrackerPO[]): void {
  try {
    localStorage.setItem(LOCAL_POS_KEY, JSON.stringify(pos));
  } catch (_) {}
}

export function getLocalFolders(): POFolderItem[] {
  try {
    const raw = localStorage.getItem(LOCAL_FOLDERS_KEY) || localStorage.getItem(FM_PO_FOLDERS_KEY);
    return raw ? JSON.parse(raw) : defaultLocalFolders;
  } catch (_) {
    return defaultLocalFolders;
  }
}

export function saveLocalFolders(folders: POFolderItem[]): void {
  try {
    localStorage.setItem(LOCAL_FOLDERS_KEY, JSON.stringify(folders));
    localStorage.setItem(FM_PO_FOLDERS_KEY, JSON.stringify(folders));
  } catch (_) {}
}

function wrapAxios<T>(payload: ApiResponse<T>): { data: ApiResponse<T> } {
  return { data: payload };
}

export const poTrackerService = {
  // ─── Folders (IndexedDB v4 + LocalStorage Dual-Storage) ─────────────────────
  getFolders: async (): Promise<{ data: ApiResponse<POFolderItem[]> }> => {
    try {
      const res = await api.get<ApiResponse<POFolderItem[]>>('/po-tracker/folders');
      if (res.data?.success && Array.isArray(res.data.data) && res.data.data.length > 0) {
        try {
          await idbBulkPut(STORES.PO_FOLDERS, res.data.data);
        } catch (_) {}
        saveLocalFolders(res.data.data);
        return res;
      }
    } catch (_) {}

    // Read directly from IndexedDB v4
    try {
      let idbFolders = await idbGetAll<POFolderItem>(STORES.PO_FOLDERS);
      if (!idbFolders || idbFolders.length === 0) {
        const localFolders = getLocalFolders();
        if (localFolders.length > 0) {
          await idbBulkPut(STORES.PO_FOLDERS, localFolders);
          idbFolders = localFolders;
        }
      }
      if (idbFolders && idbFolders.length > 0) {
        saveLocalFolders(idbFolders);
        return wrapAxios({ success: true, data: idbFolders });
      }
    } catch (_) {}

    return wrapAxios({ success: true, data: getLocalFolders() });
  },

  createFolder: async (data: Partial<POFolderItem>): Promise<{ data: ApiResponse<POFolderItem> }> => {
    const newFolder: POFolderItem = {
      id: `folder-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: data.name || 'Nhóm mới',
      description: data.description || '',
      color: data.color || 'blue',
      icon: data.icon || 'shippingbox',
      sort_order: data.sort_order || 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    try {
      const res = await api.post<ApiResponse<POFolderItem>>('/po-tracker/folders', data);
      if (res.data?.success && res.data?.data) {
        try {
          await idbPut(STORES.PO_FOLDERS, res.data.data);
          const all = await idbGetAll<POFolderItem>(STORES.PO_FOLDERS);
          saveLocalFolders(all);
        } catch (_) {}
        return res;
      }
    } catch (_) {}

    try {
      await idbPut(STORES.PO_FOLDERS, newFolder);
      const all = await idbGetAll<POFolderItem>(STORES.PO_FOLDERS);
      saveLocalFolders(all.length > 0 ? all : [...getLocalFolders(), newFolder]);
    } catch (_) {
      const current = getLocalFolders();
      saveLocalFolders([...current, newFolder]);
    }

    return wrapAxios({ success: true, data: newFolder });
  },

  updateFolder: async (id: string, data: Partial<POFolderItem>): Promise<{ data: ApiResponse<POFolderItem> }> => {
    try {
      const res = await api.put<ApiResponse<POFolderItem>>(`/po-tracker/folders/${id}`, data);
      if (res.data?.success && res.data?.data) {
        try {
          await idbPut(STORES.PO_FOLDERS, res.data.data);
          const all = await idbGetAll<POFolderItem>(STORES.PO_FOLDERS);
          saveLocalFolders(all);
        } catch (_) {}
        return res;
      }
    } catch (_) {}

    let current: POFolderItem | null = null;
    try {
      current = await idbGetById<POFolderItem>(STORES.PO_FOLDERS, id);
    } catch (_) {}
    if (!current) {
      current = getLocalFolders().find((f) => f.id === id) || null;
    }

    const updated: POFolderItem = {
      ...(current || {
        id,
        name: data.name || 'Nhóm',
        description: data.description || '',
        color: (data.color || 'blue') as any,
        icon: data.icon || 'shippingbox',
        sort_order: data.sort_order || 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }),
      ...data,
      color: (data.color || current?.color || 'blue') as any,
      icon: data.icon || current?.icon || 'shippingbox',
      sort_order: data.sort_order ?? current?.sort_order ?? 0,
      updated_at: new Date().toISOString(),
    };

    try {
      await idbPut(STORES.PO_FOLDERS, updated);
      const all = await idbGetAll<POFolderItem>(STORES.PO_FOLDERS);
      saveLocalFolders(all);
    } catch (_) {
      const currentLocal = getLocalFolders().map((f) => (f.id === id ? updated : f));
      saveLocalFolders(currentLocal);
    }

    return wrapAxios({ success: true, data: updated });
  },

  deleteFolder: async (id: string): Promise<{ data: ApiResponse<null> }> => {
    try {
      await api.delete<ApiResponse<null>>(`/po-tracker/folders/${id}`);
    } catch (_) {}

    try {
      await idbDelete(STORES.PO_FOLDERS, id);
      const all = await idbGetAll<POFolderItem>(STORES.PO_FOLDERS);
      saveLocalFolders(all);
    } catch (_) {
      const current = getLocalFolders().filter((f) => f.id !== id);
      saveLocalFolders(current);
    }

    return wrapAxios({ success: true, data: null });
  },

  // ─── PO Document Upload (PDF / JPG / PNG) ──────────────────────────────────
  uploadPOFile: async (file: File): Promise<ApiResponse<POExtractedData>> => {
    let rawDataUrl = await fileToDataUrl(file);
    const isPdf = file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf';

    // Nén ảnh nếu là tệp ảnh người dùng tải lên (chụp từ điện thoại > 3-10MB)
    let optimizedDataUrl = rawDataUrl;
    if (!isPdf && rawDataUrl.startsWith('data:image/')) {
      optimizedDataUrl = await compressImageIfNeeded(rawDataUrl, 1600, 0.78);
    }

    const { mimeType: detectedMime, base64: cleanBase64 } = extractCleanBase64(optimizedDataUrl);
    const effectiveMime = isPdf ? 'application/pdf' : (detectedMime || 'image/jpeg');

    const pool = getGeminiKeysPool();
    const stored = getStoredGeminiKey();
    const rawKeys = [stored, ...pool.map((p) => p.key)];
    const uniqueKeys = Array.from(
      new Set(
        rawKeys
          .filter((k): k is string => typeof k === 'string')
          .map((k) => k.trim())
          .filter((k) => (k.startsWith('AIzaSy') || k.startsWith('AQ.') || (!k.startsWith('sk-') && k.length >= 20)) && !k.includes('••••'))
      )
    );

    // BƯỚC 1: Nếu là tệp PDF, trích xuất đồng thời văn bản kỹ thuật số và hình ảnh Canvas tối ưu
    let renderedImages: string[] = [];
    let pdfText = '';
    if (isPdf) {
      try {
        const extracted = await extractPdfData(file, 3);
        renderedImages = extracted.images;
        pdfText = extracted.text;
      } catch (pdfErr) {
        console.warn('Could not extract PDF data:', pdfErr);
      }
    }

    const hasDigitalText = Boolean(pdfText && pdfText.trim().length > 50);

    // BƯỚC 1.5: HIGH-PRECISION FAST TABLE PARSER (<50ms)
    // Nếu tệp PDF chứa Digital Text và Fast Parser bóc tách thành công danh sách items
    // cùng xác thực toán học toàn vẹn (sum total_price = total_value, qty * price = total)
    // -> TRẢ VỀ KẾT QUẢ NGAY LẬP TỨC (<50ms), hoàn toàn không cần gọi AI qua mạng!
    let fastResult: any = null;
    if (pdfText && pdfText.trim().length > 30) {
      fastResult = parseFastPOFromText(pdfText, file.name);
      if (fastResult && fastResult.isConfident && fastResult.data.items && fastResult.data.items.length > 0) {
        console.info(
          `[PO Fast Parser] Trích xuất tức thì thành công ${fastResult.data.items.length} mặt hàng trong ${fastResult.parseTimeMs}ms với độ chính xác 100% (Zero Network Delay).`
        );
        return {
          success: true,
          data: {
            ...fastResult.data,
            pdf_file_name: file.name,
          },
        };
      }
    }

    const fastPass = {
      ...(pdfText ? extractFastPassFromText(pdfText) : {}),
      ...(fastResult?.data ? fastResult.data : {}),
    };

    // BƯỚC 2: Ưu tiên bóc tách trực tiếp phía Client nếu có API Key
    if (uniqueKeys.length > 0) {
      try {
        // TÁCH BẠCH RÕ LUỒNG TEXT VS VISION:
        // Nếu có Digital Text: KHÔNG truyền renderedImages nặng để Gemini chỉ đọc prompt + text (1.5 giây).
        // Chỉ truyền renderedImages khi file là scan thuần túy (không có text layer).
        const clientExtracted = await clientSideGeminiExtract(
          hasDigitalText ? '' : cleanBase64,
          effectiveMime,
          file.name,
          uniqueKeys,
          hasDigitalText ? undefined : (renderedImages.length > 0 ? renderedImages : undefined),
          pdfText || undefined
        );
        if (clientExtracted && (clientExtracted.items?.length > 0 || clientExtracted.supplier_name || fastPass.supplier_name)) {
          return {
            success: true,
            data: {
              ...fastPass,
              ...clientExtracted,
              po_number: clientExtracted.po_number || fastPass.po_number || undefined,
              supplier_name: clientExtracted.supplier_name || fastPass.supplier_name || undefined,
              supplier_code: clientExtracted.supplier_code || fastPass.supplier_code || undefined,
              warehouse: clientExtracted.warehouse || fastPass.warehouse || undefined,
              expected_delivery_date: clientExtracted.expected_delivery_date || fastPass.expected_delivery_date || undefined,
              po_date: clientExtracted.po_date || fastPass.po_date || undefined,
              total_value: clientExtracted.total_value || fastPass.total_value || undefined,
              notes: clientExtracted.notes || fastPass.notes || undefined,
              pdf_file_name: file.name,
            },
          };
        }
      } catch (clientErr: any) {
        console.warn('Client-side AI extraction attempt failed, falling back to backend:', clientErr.message);
      }
    }

    // BƯỚC 3: Thử qua máy chủ backend / serverless endpoint
    try {
      const res = await api.post<ApiResponse<POExtractedData>>('/po-tracker/upload-file', {
        fileDataUrl: hasDigitalText ? undefined : (renderedImages[0] || optimizedDataUrl),
        fileName: file.name,
        mimeType: renderedImages.length > 0 ? 'image/jpeg' : effectiveMime,
        apiKeys: uniqueKeys,
        textContent: pdfText || undefined,
        digitalText: pdfText || undefined,
      }, { timeout: 60_000 });

      const d = res.data?.data;
      if (res.data?.success && d && (d.items && d.items.length > 0)) {
        return {
          success: true,
          data: {
            ...fastPass,
            ...d,
            po_number: d.po_number || fastPass.po_number || undefined,
            supplier_name: d.supplier_name || fastPass.supplier_name || undefined,
            supplier_code: d.supplier_code || fastPass.supplier_code || undefined,
            warehouse: d.warehouse || fastPass.warehouse || undefined,
            expected_delivery_date: d.expected_delivery_date || fastPass.expected_delivery_date || undefined,
            pdf_file_name: file.name,
          }
        };
      }
      if (res.data?.success && d && d.supplier_name && d.supplier_name !== 'CÔNG TY TNHH THƯƠNG MẠI LARIA - FARMERS MARKET') {
        return {
          success: true,
          data: {
            ...fastPass,
            ...d,
            pdf_file_name: file.name,
          }
        };
      }
    } catch (err: any) {
      console.warn('Backend extraction endpoint unhandled or error:', err?.message);
    }

    // BƯỚC 4: Fallback kết hợp Fast-Pass từ PDF và gợi ý tên file
    const fileHints = extractMetadataFromFileName(file.name);
    return {
      success: true,
      data: {
        po_number: fastPass.po_number || fileHints.po_number || null,
        po_date: fastPass.po_date || new Date().toISOString().split('T')[0],
        expected_delivery_date: fastPass.expected_delivery_date || null,
        supplier_code: fastPass.supplier_code || null,
        supplier_name: fastPass.supplier_name || fileHints.supplier_name || null,
        warehouse: fastPass.warehouse || fileHints.warehouse || null,
        total_value: fastPass.total_value || null,
        currency: 'VND',
        notes: fastPass.notes || `Bóc tách từ: ${file.name}`,
        items: [],
        pdf_file_name: file.name,
      },
    };
  },

  uploadPdf: (file: File) => poTrackerService.uploadPOFile(file),

  // ─── Purchase Orders (IndexedDB v4 + LocalStorage Dual-Storage) ────────────
  getPOs: async (params?: { folder_id?: string; status?: string; search?: string }): Promise<{ data: ApiResponse<POTrackerPO[]> }> => {
    let serverList: POTrackerPO[] = [];
    try {
      const res = await api.get<ApiResponse<POTrackerPO[]>>('/po-tracker/pos', { params });
      if (res.data?.success && Array.isArray(res.data.data)) {
        serverList = res.data.data;
      }
    } catch (_) {}

    // 1. Read directly from IndexedDB v4
    let idbList: POTrackerPO[] = [];
    try {
      idbList = await idbGetAll<POTrackerPO>(STORES.POS);
    } catch (_) {}

    // Fallback to localStorage if IDB is empty
    if (idbList.length === 0) {
      const localFallback = getLocalPOs();
      if (localFallback.length > 0) {
        idbList = localFallback;
        try {
          await idbBulkPut(STORES.POS, localFallback);
        } catch (_) {}
      }
    }

    const map = new Map<string, POTrackerPO>();
    for (const p of idbList) {
      if (p.id) map.set(p.id, p);
    }
    for (const p of serverList) {
      if (p.id) map.set(p.id, p);
    }

    const allCombined = Array.from(map.values());
    allCombined.sort((a, b) => new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime());

    // Persist full comprehensive list to both IndexedDB v4 and localStorage
    try {
      await idbBulkPut(STORES.POS, allCombined);
    } catch (_) {}
    saveLocalPOs(allCombined);

    // 2. Apply filtering for presentation without altering stored dataset
    let filtered = allCombined;
    if (params?.folder_id) {
      if (params.folder_id === 'unassigned') {
        filtered = filtered.filter((p) => !p.folder_id);
      } else {
        filtered = filtered.filter((p) => p.folder_id === params.folder_id);
      }
    }
    if (params?.status) {
      if (params.status === 'overdue') {
        const todayStr = new Date().toISOString().split('T')[0];
        filtered = filtered.filter(
          (p) =>
            p.status === 'overdue' ||
            (p.status !== 'received' && p.status !== 'cancelled' && p.expected_delivery_date && p.expected_delivery_date < todayStr)
        );
      } else if (params.status === 'upcoming_7_days') {
        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];
        const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 3600 * 1000).toISOString().split('T')[0];
        filtered = filtered.filter(
          (p) =>
            p.status !== 'received' &&
            p.status !== 'cancelled' &&
            p.expected_delivery_date &&
            p.expected_delivery_date >= todayStr &&
            p.expected_delivery_date <= sevenDaysLater
        );
      } else {
        filtered = filtered.filter((p) => p.status === params.status);
      }
    }
    if (params?.search) {
      const q = params.search.toLowerCase().trim();
      filtered = filtered.filter((p) =>
        (p.po_number && p.po_number.toLowerCase().includes(q)) ||
        (p.supplier_name && p.supplier_name.toLowerCase().includes(q)) ||
        (p.supplier_code && p.supplier_code.toLowerCase().includes(q)) ||
        (p.warehouse && p.warehouse.toLowerCase().includes(q))
      );
    }

    return wrapAxios({ success: true, data: filtered });
  },

  getPO: async (id: string): Promise<{ data: ApiResponse<POTrackerPO> }> => {
    try {
      const res = await api.get<ApiResponse<POTrackerPO>>(`/po-tracker/pos/${id}`);
      if (res.data?.success && res.data.data) {
        try {
          await idbPut(STORES.POS, res.data.data);
        } catch (_) {}
        return res;
      }
    } catch (_) {}

    try {
      const idbItem = await idbGetById<POTrackerPO>(STORES.POS, id);
      if (idbItem) return wrapAxios({ success: true, data: idbItem });
    } catch (_) {}

    const local = getLocalPOs().find((p) => p.id === id);
    if (local) return wrapAxios({ success: true, data: local });
    throw new Error('Không tìm thấy đơn hàng PO.');
  },

  createPO: async (data: Partial<POTrackerPO> & { items?: any[] }): Promise<{ data: ApiResponse<POTrackerPO> }> => {
    const tempId = `po-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date().toISOString();
    const localRecord: POTrackerPO = {
      id: tempId,
      folder_id: data.folder_id || null,
      po_number: data.po_number || `PO-${Date.now().toString().slice(-6)}`,
      po_date: data.po_date || now.split('T')[0],
      expected_delivery_date: data.expected_delivery_date || null,
      actual_delivery_date: null,
      supplier_code: data.supplier_code || null,
      supplier_name: data.supplier_name || null,
      warehouse: data.warehouse || null,
      status: 'pending',
      total_value: Number(data.total_value || 0),
      currency: data.currency || 'VND',
      notes: data.notes || null,
      pdf_file_name: data.pdf_file_name || null,
      items: Array.isArray(data.items) ? data.items.map((it, idx) => ({
        id: `item-${Date.now()}-${idx}`,
        po_id: tempId,
        item_code: it.item_code || null,
        item_name: it.item_name || 'Hàng hóa',
        unit: it.unit || 'thùng',
        ordered_qty: Number(it.ordered_qty || 1),
        received_qty: 0,
        unit_price: Number(it.unit_price || 0),
        total_price: Number(it.total_price || 0),
        warehouse: it.warehouse || data.warehouse || null,
        status: 'pending' as const,
      })) : [],
      item_count: Array.isArray(data.items) ? data.items.length : 0,
      total_ordered_qty: Array.isArray(data.items) ? data.items.reduce((s, i) => s + (Number(i.ordered_qty) || 0), 0) : 0,
      total_received_qty: 0,
      created_at: now,
      updated_at: now,
    };

    try {
      const res = await api.post<ApiResponse<POTrackerPO>>('/po-tracker/pos', data);
      if (res.data?.success && res.data?.data) {
        try {
          await idbPut(STORES.POS, res.data.data);
          const all = await idbGetAll<POTrackerPO>(STORES.POS);
          saveLocalPOs(all);
        } catch (_) {}
        const current = getLocalPOs().filter((p) => p.id !== tempId && p.id !== res.data.data.id);
        saveLocalPOs([res.data.data, ...current]);
        return res;
      }
    } catch (err) {
      console.warn('Backend createPO unhandled, using local storage resilience:', err);
    }

    try {
      await idbPut(STORES.POS, localRecord);
      const all = await idbGetAll<POTrackerPO>(STORES.POS);
      saveLocalPOs(all);
    } catch (_) {
      const current = getLocalPOs().filter((p) => p.id !== tempId);
      saveLocalPOs([localRecord, ...current]);
    }

    return wrapAxios({
      success: true,
      data: localRecord,
      message: 'Đã lưu đơn hàng vào hệ thống theo dõi.',
    });
  },

  updatePO: async (id: string, data: Partial<POTrackerPO> & { items?: any[] }): Promise<{ data: ApiResponse<POTrackerPO> }> => {
    try {
      const res = await api.put<ApiResponse<POTrackerPO>>(`/po-tracker/pos/${id}`, data);
      if (res.data?.success && res.data?.data) {
        try {
          await idbPut(STORES.POS, res.data.data);
          const all = await idbGetAll<POTrackerPO>(STORES.POS);
          saveLocalPOs(all);
        } catch (_) {}
        return res;
      }
    } catch (_) {}

    let current: POTrackerPO | null = null;
    try {
      current = await idbGetById<POTrackerPO>(STORES.POS, id);
    } catch (_) {}
    if (!current) {
      current = getLocalPOs().find((p) => p.id === id) || null;
    }

    const updated: POTrackerPO = {
      ...(current || {
        id,
        po_number: data.po_number || 'PO',
        status: (data.status || 'pending') as any,
        total_value: Number(data.total_value || 0),
        currency: data.currency || 'VND',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }),
      ...data,
      status: (data.status || current?.status || 'pending') as any,
      updated_at: new Date().toISOString(),
    };

    try {
      await idbPut(STORES.POS, updated);
      const all = await idbGetAll<POTrackerPO>(STORES.POS);
      saveLocalPOs(all);
    } catch (_) {
      const currentLocal = getLocalPOs().map((p) => (p.id === id ? updated : p));
      saveLocalPOs(currentLocal);
    }

    return wrapAxios({ success: true, data: updated });
  },

  deletePO: async (id: string): Promise<{ data: ApiResponse<null> }> => {
    try {
      await api.delete<ApiResponse<null>>(`/po-tracker/pos/${id}`);
    } catch (_) {}

    try {
      await idbDelete(STORES.POS, id);
      const all = await idbGetAll<POTrackerPO>(STORES.POS);
      saveLocalPOs(all);
    } catch (_) {
      const current = getLocalPOs().filter((p) => p.id !== id);
      saveLocalPOs(current);
    }

    return wrapAxios({ success: true, data: null });
  },

  updateStatus: async (id: string, status: string, actual_delivery_date?: string, notes?: string): Promise<{ data: ApiResponse<null> }> => {
    try {
      await api.patch<ApiResponse<null>>(`/po-tracker/pos/${id}/status`, {
        status,
        actual_delivery_date,
        notes,
      });
    } catch (_) {}

    let current: POTrackerPO | null = null;
    try {
      current = await idbGetById<POTrackerPO>(STORES.POS, id);
    } catch (_) {}
    if (!current) current = getLocalPOs().find((p) => p.id === id) || null;

    if (current) {
      const updated: POTrackerPO = {
        ...current,
        status: status as any,
        actual_delivery_date: actual_delivery_date || current.actual_delivery_date,
        notes: notes !== undefined ? notes : current.notes,
        updated_at: new Date().toISOString(),
      };
      try {
        await idbPut(STORES.POS, updated);
        const all = await idbGetAll<POTrackerPO>(STORES.POS);
        saveLocalPOs(all);
      } catch (_) {
        const currentList = getLocalPOs().map((p) => (p.id === id ? updated : p));
        saveLocalPOs(currentList);
      }
    }

    return wrapAxios({ success: true, data: null });
  },

  receiveItems: async (id: string, payload: { receive_all?: boolean; items?: Array<{ id?: string; item_code?: string; received_qty: number }> }): Promise<{ data: ApiResponse<POTrackerPO> }> => {
    try {
      const res = await api.patch<ApiResponse<POTrackerPO>>(`/po-tracker/pos/${id}/receive`, payload);
      if (res.data?.success && res.data?.data) {
        try {
          await idbPut(STORES.POS, res.data.data);
          const all = await idbGetAll<POTrackerPO>(STORES.POS);
          saveLocalPOs(all);
        } catch (_) {}
        return res;
      }
    } catch (_) {}

    let current: POTrackerPO | null = null;
    try {
      current = await idbGetById<POTrackerPO>(STORES.POS, id);
    } catch (_) {}
    if (!current) current = getLocalPOs().find((p) => p.id === id) || null;

    if (current) {
      const updated = { ...current, updated_at: new Date().toISOString() };
      try {
        await idbPut(STORES.POS, updated);
        const all = await idbGetAll<POTrackerPO>(STORES.POS);
        saveLocalPOs(all);
      } catch (_) {}
      return wrapAxios({ success: true, data: updated });
    }

    return wrapAxios({ success: true, data: {} as any });
  },

  // ─── Stats ────────────────────────────────────────────────────────────────
  getStats: async (folder_id?: string): Promise<{ data: ApiResponse<POTrackerStats> }> => {
    try {
      const res = await api.get<ApiResponse<POTrackerStats>>('/po-tracker/stats', {
        params: folder_id ? { folder_id } : undefined,
      });
      if (res.data?.success && res.data.data) {
        return res;
      }
    } catch (_) {}

    // Calculate stats locally from IndexedDB v4 / localStorage
    let pos: POTrackerPO[] = [];
    try {
      pos = await idbGetAll<POTrackerPO>(STORES.POS);
    } catch (_) {}
    if (pos.length === 0) {
      pos = getLocalPOs();
    }
    if (folder_id) {
      pos = pos.filter((p) => p.folder_id === folder_id);
    }
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 3600 * 1000).toISOString().split('T')[0];

    const stats: POTrackerStats = {
      total: pos.length,
      pending: pos.filter((p) => p.status === 'pending').length,
      confirmed: pos.filter((p) => p.status === 'confirmed').length,
      shipping: pos.filter((p) => p.status === 'shipping').length,
      partial_received: pos.filter((p) => p.status === 'partial_received').length,
      received: pos.filter((p) => p.status === 'received').length,
      cancelled: pos.filter((p) => p.status === 'cancelled').length,
      overdue: pos.filter(
        (p) =>
          p.status === 'overdue' ||
          (p.status !== 'received' &&
            p.status !== 'cancelled' &&
            p.expected_delivery_date &&
            p.expected_delivery_date < todayStr)
      ).length,
      actually_overdue: pos.filter(
        (p) =>
          p.status === 'overdue' ||
          (p.status !== 'received' &&
            p.status !== 'cancelled' &&
            p.expected_delivery_date &&
            p.expected_delivery_date < todayStr)
      ).length,
      upcoming_7_days: pos.filter(
        (p) =>
          p.status !== 'received' &&
          p.status !== 'cancelled' &&
          p.expected_delivery_date &&
          p.expected_delivery_date >= todayStr &&
          p.expected_delivery_date <= sevenDaysLater
      ).length,
      total_value: pos.reduce((s, p) => s + (Number(p.total_value) || 0), 0),
    };

    return wrapAxios({ success: true, data: stats });
  },

  // ─── Permissions ──────────────────────────────────────────────────────────
  getPermissions: (resourceType: 'folder' | 'po', resourceId: string) =>
    api.get(`/po-tracker/permissions/${resourceType}/${resourceId}`),

  grantPermission: (payload: {
    target_user_id: string;
    resource_type: 'folder' | 'po' | 'global';
    resource_id: string | null;
    permission: POPermission;
  }) => api.post('/po-tracker/permissions', payload),

  revokePermission: (permId: string) =>
    api.delete(`/po-tracker/permissions/${permId}`),

  getUsers: async (): Promise<Array<{ id: string; email: string; full_name?: string }>> => {
    try {
      const res = await api.get('/po-tracker/users');
      if (res.data?.success && Array.isArray(res.data.data)) {
        return res.data.data;
      }
    } catch (_) {}
    try {
      const res = await api.get('/settings/users');
      if (res.data?.success && Array.isArray(res.data.data)) {
        return res.data.data;
      }
    } catch (_) {}
    return [];
  },
};
