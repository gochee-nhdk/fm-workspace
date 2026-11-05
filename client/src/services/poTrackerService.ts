import { api } from '@/lib/api';
import {
  POTrackerPO,
  POFolderItem,
  POExtractedData,
  POTrackerStats,
  POPermission,
} from '@/types/po-tracker';
import { getStoredGeminiKey, getGeminiKeysPool, discoverBestFlashModels } from './writingToolsService';
import { convertPdfToImages } from '@/utils/pdfToImage';

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
  const str = val.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

  // D/M/YYYY hoặc DD/MM/YYYY
  const dmyMatch = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    const year = dmyMatch[3];
    return `${year}-${month}-${day}`;
  }

  // DD-MMM-YYYY (VD: 05-Nov-2026)
  const monthMap: Record<string, string> = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
    thg1: '01', thg2: '02', thg3: '03', thg4: '04', thg5: '05', thg6: '06',
    thg7: '07', thg8: '08', thg9: '09', thg10: '10', thg11: '11', thg12: '12'
  };
  const namedMatch = str.match(/^(\d{1,2})[\s\-\/]([a-zA-Z0-9]+)[\s\-\/](\d{4})$/);
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
  const normalized: any = {
    ...rawParsed,
    po_date: cleanVietnameseDate(rawParsed.po_date),
    expected_delivery_date: cleanVietnameseDate(rawParsed.expected_delivery_date),
    total_value: cleanVietnameseNumber(rawParsed.total_value),
  };

  // Bảo vệ: Nếu AI nhầm tên người mua "CÔNG TY TNHH THƯƠNG MẠI LARIA - FARMERS MARKET" làm NCC, xóa bỏ để lấy từ gợi ý
  if (normalized.supplier_name && /LARIA|FARMERS.*MARKET/i.test(normalized.supplier_name)) {
    normalized.supplier_name = '';
  }

  // Chuẩn hóa từng dòng mặt hàng
  if (Array.isArray(rawParsed.items)) {
    normalized.items = rawParsed.items
      .map((it: any) => {
        if (!it || typeof it !== 'object') return null;
        const ordered_qty = cleanVietnameseNumber(it.ordered_qty || 1);
        const unit_price = cleanVietnameseNumber(it.unit_price || 0);
        const total_price = cleanVietnameseNumber(it.total_price || (ordered_qty * unit_price));
        return {
          item_code: String(it.item_code || it.internal_code || it.barcode || '').trim(),
          item_name: String(it.item_name || it.description || 'Sản phẩm').trim(),
          unit: String(it.unit || 'Hộp').trim(),
          ordered_qty: ordered_qty > 0 ? ordered_qty : 1,
          unit_price: unit_price,
          total_price: total_price,
          warehouse: String(it.warehouse || normalized.warehouse || '').trim(),
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
 * Trực tiếp bóc tách PO qua Gemini Vision phía trình duyệt bằng mô hình đa phương thức mới nhất
 */
async function clientSideGeminiExtract(
  base64Data: string,
  mimeType: string,
  fileName: string,
  apiKeys: string[],
  additionalImages?: string[]
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

Hãy phân tích toàn bộ nội dung tài liệu (PDF / Hình ảnh) được cung cấp và trích xuất đầy đủ, chính xác tất cả các thông tin sau theo cấu trúc JSON:

QUY TẮC BÓC TÁCH CHUẨN XÁC:
1. "po_number" (Số hiệu PO / Mã đơn hàng):
   - Lấy sau "Số hiệu chứng từ:", "Số PO", "Số đơn đặt hàng", hoặc mã 5-8 chữ số ở đầu chứng từ (ví dụ: "PO-118292", "PO-118873", "PO-118744"). Nếu chưa có tiền tố "PO-", hãy thêm "PO-". Tham khảo tên file: "${fileName}".
2. "supplier_name" (Tên Nhà cung cấp / Đơn vị cung ứng):
   - QUAN TRỌNG: "CÔNG TY TNHH THƯƠNG MẠI LARIA - FARMERS MARKET" là BÊN MUA HÀNG (Buyer), TUYỆT ĐỐI KHÔNG LẤY TÊN NÀY LÀM NHÀ CUNG CẤP!
   - TÊN NHÀ CUNG CẤP là đơn vị nằm sau nhãn "Tên NCC:" (ví dụ: "CÔNG TY CỔ PHẦN DEVIE", "CÔNG TY TNHH BẢO MINH", "CENTRAL RETAIL").
3. "supplier_code" (Mã Nhà cung cấp):
   - Lấy sau nhãn "Mã NCC:" (ví dụ: "V0001613", "V0001834").
4. "po_date" (Ngày lập chứng từ PO):
   - Lấy sau nhãn "Ngày chứng từ:" (ví dụ: "2/11/2026" chuẩn hóa thành "2026-11-02").
5. "expected_delivery_date" (Hạn giao hàng / Ngày giao dự kiến):
   - Lấy sau nhãn "Ngày giao hàng:" (ví dụ: "5/11/2026" chuẩn hóa thành "2026-11-05").
6. "warehouse" (Kho nhận hàng / Chi nhánh yêu cầu):
   - Lấy sau "Chi nhánh yêu cầu:" hoặc "Địa chỉ giao hàng:" (ví dụ: "DC01 - Nơ Trang Long, 204 Nơ Trang Long, Phường Bình Thạnh, TP.HCM").
7. "total_value" (Tổng giá trị đơn hàng / Tổng thanh toán):
   - Lấy từ dòng "TỔNG TIỀN HÀNG" hoặc "TỔNG CỘNG TRƯỚC THUẾ VAT", là một số thực nguyên bản (bỏ các dấu phân cách chấm, phẩy). Ví dụ: 9021888 hoặc 8353600.
8. "currency": Đơn vị tiền tệ, mặc định "VND".
9. "notes": Người đặt hàng từ nhãn "Người đặt hàng:" (ví dụ: "Nguyễn Hùng Tiến").
10. "items" (Danh sách toàn bộ các dòng mặt hàng trong bảng ĐƠN MUA HÀNG):
    Bóc tách ĐẦY ĐỦ TẤT CẢ các dòng sản phẩm trong bảng chi tiết, tuyệt đối không bỏ sót dòng nào:
    - "item_code": Cột "Internal Code" hoặc "Barcode/PLU" (ví dụ: "10015745").
    - "item_name": Cột "Mặt hàng" (ví dụ: "Hạt dinh dưỡng Your SuperFood Mix nhiều loại hạt hũ 400 g").
    - "ordered_qty": Cột "Số lượng" (kiểu số thực, ví dụ: 46).
    - "unit": Cột "DVT" (ví dụ: "Hũ", "Hộp", "Thùng", "Kg", "Gói", "Chai", "Lon", "Túi", "Cái").
    - "unit_price": Cột "Đơn giá chưa VAT" hoặc "Đơn giá chưa VAT sau chiết khấu" (kiểu số, ví dụ: 181600).
    - "total_price": Cột "Thành tiền chưa VAT" (kiểu số, ví dụ: 8353600).
    - "warehouse": Kho nhận nếu có (ví dụ: "DC01 - Nơ Trang Long").

Chỉ trả về DUY NHẤT một chuỗi JSON hợp lệ, không bọc markdown fence, không kèm lời chào.`;

  // Chuẩn bị danh sách parts đa phương thức
  const contentParts: any[] = [{ text: prompt }];

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

  let lastErr = '';

  for (const k of uniqueKeys) {
    const models = await discoverBestFlashModels(k);
    // Ưu tiên các model đa phương thức mạnh nhất hiện nay
    const priorityModels = Array.from(new Set([
      'gemini-2.0-flash',
      'gemini-2.5-flash',
      ...models,
      'gemini-1.5-flash',
      'gemini-2.0-flash-lite',
    ])).filter((m) => !m.includes('pro')); // Tránh các model Pro cũ bị hạn chế quota/404

    for (const model of priorityModels) {
      for (const apiVer of ['v1beta', 'v1']) {
        try {
          const url = `https://generativelanguage.googleapis.com/${apiVer}/models/${model}:generateContent?key=${k}`;
          const isV1Beta = apiVer === 'v1beta';

          const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: contentParts }],
              generationConfig: {
                temperature: 0.1,
                maxOutputTokens: 8192,
                ...(isV1Beta ? { responseMimeType: 'application/json' } : {}),
              },
            }),
          });

          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            lastErr = errData.error?.message || `HTTP ${res.status}`;
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
  }

  throw new Error(lastErr || 'Các mô hình AI đều không thể trích xuất bảng dữ liệu từ tài liệu này.');
}

const LOCAL_POS_KEY = 'po_tracker_local_pos_v2';
const LOCAL_FOLDERS_KEY = 'po_tracker_local_folders_v2';

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
    const raw = localStorage.getItem(LOCAL_FOLDERS_KEY);
    return raw ? JSON.parse(raw) : defaultLocalFolders;
  } catch (_) {
    return defaultLocalFolders;
  }
}

export function saveLocalFolders(folders: POFolderItem[]): void {
  try {
    localStorage.setItem(LOCAL_FOLDERS_KEY, JSON.stringify(folders));
  } catch (_) {}
}

function wrapAxios<T>(payload: ApiResponse<T>): { data: ApiResponse<T> } {
  return { data: payload };
}

export const poTrackerService = {
  // ─── Folders ───────────────────────────────────────────────────────────────
  getFolders: async (): Promise<{ data: ApiResponse<POFolderItem[]> }> => {
    try {
      const res = await api.get<ApiResponse<POFolderItem[]>>('/po-tracker/folders');
      if (res.data?.success && Array.isArray(res.data.data) && res.data.data.length > 0) {
        saveLocalFolders(res.data.data);
        return res;
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
        const current = getLocalFolders().filter((f) => f.id !== res.data.data.id);
        saveLocalFolders([...current, res.data.data]);
        return res;
      }
    } catch (_) {}
    const current = getLocalFolders();
    saveLocalFolders([...current, newFolder]);
    return wrapAxios({ success: true, data: newFolder });
  },

  updateFolder: async (id: string, data: Partial<POFolderItem>): Promise<{ data: ApiResponse<POFolderItem> }> => {
    try {
      const res = await api.put<ApiResponse<POFolderItem>>(`/po-tracker/folders/${id}`, data);
      if (res.data?.success && res.data?.data) {
        const current = getLocalFolders().map((f) => (f.id === id ? { ...f, ...res.data.data } : f));
        saveLocalFolders(current);
        return res;
      }
    } catch (_) {}
    const current = getLocalFolders().map((f) => (f.id === id ? { ...f, ...data, updated_at: new Date().toISOString() } : f));
    saveLocalFolders(current);
    const updated = current.find((f) => f.id === id) as POFolderItem;
    return wrapAxios({ success: true, data: updated });
  },

  deleteFolder: async (id: string): Promise<{ data: ApiResponse<null> }> => {
    try {
      await api.delete<ApiResponse<null>>(`/po-tracker/folders/${id}`);
    } catch (_) {}
    const current = getLocalFolders().filter((f) => f.id !== id);
    saveLocalFolders(current);
    return wrapAxios({ success: true, data: null });
  },

  // ─── PO Document Upload (PDF / JPG / PNG) ──────────────────────────────────
  uploadPOFile: async (file: File): Promise<ApiResponse<POExtractedData>> => {
    const dataUrl = await fileToDataUrl(file);
    const { mimeType: detectedMime, base64: cleanBase64 } = extractCleanBase64(dataUrl);
    const isPdf = file.name.toLowerCase().endsWith('.pdf') || detectedMime.includes('pdf');
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

    // BƯỚC 1: Nếu là tệp PDF, chuyển đổi sang hình ảnh Canvas độ nét cao (2x DPI)
    let renderedImages: string[] = [];
    if (isPdf) {
      try {
        renderedImages = await convertPdfToImages(file, 2);
      } catch (pdfErr) {
        console.warn('Could not render PDF pages to images:', pdfErr);
      }
    }

    // BƯỚC 2: Ưu tiên bóc tách trực tiếp phía Client nếu có API Key
    if (uniqueKeys.length > 0) {
      try {
        const clientExtracted = await clientSideGeminiExtract(
          cleanBase64,
          effectiveMime,
          file.name,
          uniqueKeys,
          renderedImages.length > 0 ? renderedImages : undefined
        );
        if (clientExtracted && (clientExtracted.items?.length > 0 || clientExtracted.supplier_name)) {
          return {
            success: true,
            data: {
              ...clientExtracted,
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
        fileDataUrl: renderedImages[0] || dataUrl,
        fileName: file.name,
        mimeType: renderedImages.length > 0 ? 'image/jpeg' : effectiveMime,
        apiKeys: uniqueKeys,
      }, { timeout: 60_000 });

      const d = res.data?.data;
      if (res.data?.success && d && (d.items && d.items.length > 0)) {
        return res.data;
      }
      if (res.data?.success && d && d.supplier_name && d.supplier_name !== 'CÔNG TY TNHH THƯƠNG MẠI LARIA - FARMERS MARKET') {
        return res.data;
      }
    } catch (err: any) {
      console.warn('Backend extraction endpoint unhandled or error:', err?.message);
    }

    // BƯỚC 4: Fallback thông minh từ tên file nếu cả Client và Server đều không đọc được bảng mặt hàng
    const fileHints = extractMetadataFromFileName(file.name);
    return {
      success: true,
      data: {
        po_number: fileHints.po_number || null,
        po_date: new Date().toISOString().split('T')[0],
        expected_delivery_date: null,
        supplier_code: null,
        supplier_name: fileHints.supplier_name || null,
        warehouse: fileHints.warehouse || null,
        total_value: null,
        currency: 'VND',
        notes: `Bóc tách từ tên tệp: ${file.name}`,
        items: [],
        pdf_file_name: file.name,
      },
    };
  },

  uploadPdf: (file: File) => poTrackerService.uploadPOFile(file),

  // ─── Purchase Orders ───────────────────────────────────────────────────────
  getPOs: async (params?: { folder_id?: string; status?: string; search?: string }): Promise<{ data: ApiResponse<POTrackerPO[]> }> => {
    let serverList: POTrackerPO[] = [];
    try {
      const res = await api.get<ApiResponse<POTrackerPO[]>>('/po-tracker/pos', { params });
      if (res.data?.success && Array.isArray(res.data.data)) {
        serverList = res.data.data;
      }
    } catch (_) {}

    const localList = getLocalPOs();
    const map = new Map<string, POTrackerPO>();
    for (const p of serverList) {
      if (p.id) map.set(p.id, p);
    }
    for (const p of localList) {
      if (p.id && !map.has(p.id)) map.set(p.id, p);
    }

    let merged = Array.from(map.values());
    if (params?.folder_id) merged = merged.filter((p) => p.folder_id === params.folder_id);
    if (params?.status) merged = merged.filter((p) => p.status === params.status);
    if (params?.search) {
      const q = params.search.toLowerCase();
      merged = merged.filter((p) =>
        (p.po_number && p.po_number.toLowerCase().includes(q)) ||
        (p.supplier_name && p.supplier_name.toLowerCase().includes(q)) ||
        (p.warehouse && p.warehouse.toLowerCase().includes(q))
      );
    }
    merged.sort((a, b) => new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime());
    saveLocalPOs(merged);
    return wrapAxios({ success: true, data: merged });
  },

  getPO: async (id: string): Promise<{ data: ApiResponse<POTrackerPO> }> => {
    try {
      const res = await api.get<ApiResponse<POTrackerPO>>(`/po-tracker/pos/${id}`);
      if (res.data?.success && res.data.data) {
        return res;
      }
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
        const current = getLocalPOs().filter((p) => p.id !== tempId && p.id !== res.data.data.id);
        saveLocalPOs([res.data.data, ...current]);
        return res;
      }
    } catch (err) {
      console.warn('Backend createPO unhandled, using local storage resilience:', err);
    }

    const current = getLocalPOs().filter((p) => p.id !== tempId);
    saveLocalPOs([localRecord, ...current]);
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
        const current = getLocalPOs().map((p) => (p.id === id ? { ...p, ...res.data.data } : p));
        saveLocalPOs(current);
        return res;
      }
    } catch (_) {}
    const current = getLocalPOs().map((p) => (p.id === id ? { ...p, ...data, updated_at: new Date().toISOString() } : p));
    saveLocalPOs(current);
    const updated = current.find((p) => p.id === id) as POTrackerPO;
    return wrapAxios({ success: true, data: updated });
  },

  deletePO: async (id: string): Promise<{ data: ApiResponse<null> }> => {
    try {
      await api.delete<ApiResponse<null>>(`/po-tracker/pos/${id}`);
    } catch (_) {}
    const current = getLocalPOs().filter((p) => p.id !== id);
    saveLocalPOs(current);
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
    const current = getLocalPOs().map((p) =>
      p.id === id
        ? {
            ...p,
            status: status as any,
            actual_delivery_date: actual_delivery_date || p.actual_delivery_date,
            notes: notes !== undefined ? notes : p.notes,
            updated_at: new Date().toISOString(),
          }
        : p
    );
    saveLocalPOs(current);
    return wrapAxios({ success: true, data: null });
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

    // Calculate stats locally from local POs
    const pos = getLocalPOs().filter((p) => (!folder_id ? true : p.folder_id === folder_id));
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
          p.status !== 'received' &&
          p.status !== 'cancelled' &&
          p.expected_delivery_date &&
          p.expected_delivery_date < todayStr
      ).length,
      actually_overdue: pos.filter(
        (p) =>
          p.status !== 'received' &&
          p.status !== 'cancelled' &&
          p.expected_delivery_date &&
          p.expected_delivery_date < todayStr
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
};
