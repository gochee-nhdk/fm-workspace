import { api } from '@/lib/api';
import {
  POTrackerPO,
  POFolderItem,
  POExtractedData,
  POTrackerStats,
  POPermission,
} from '@/types/po-tracker';
import { getStoredGeminiKey, getGeminiKeysPool, discoverBestFlashModels } from './writingToolsService';

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
 * Tự động trích xuất số PO và Kho/Chi nhánh từ tên file chứng từ (ví dụ: "118744 - CENTRAL - FM01.pdf")
 */
export function extractMetadataFromFileName(fileName: string): { po_number?: string; warehouse?: string } {
  if (!fileName) return {};
  const clean = fileName.replace(/\.[a-zA-Z0-9]+$/i, '').trim();
  const parts = clean.split(/[-_–—|]+/).map((p) => p.trim()).filter(Boolean);

  let poNumber = '';
  let warehouse = '';

  for (const part of parts) {
    if (/^\d{5,8}$/.test(part) || /^PO[-_]?\d+/i.test(part)) {
      poNumber = /^PO/i.test(part) ? part.toUpperCase() : `PO-${part}`;
    } else if (/CENTRAL|DC\d*|KHO|FM\d+|STORE|CHINHANH/i.test(part)) {
      if (!warehouse) warehouse = part;
      else warehouse += ` - ${part}`;
    }
  }

  return {
    po_number: poNumber || undefined,
    warehouse: warehouse || undefined,
  };
}

export function safeParseAIJson(text: string, fileName?: string): any {
  if (!text || typeof text !== 'string') return {};
  let trimmed = text.trim();

  // 1. Loại bỏ markdown code fence nếu có
  trimmed = trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  // 2. Parse trực tiếp nếu chuỗi là JSON hoàn chỉnh
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === 'object') return enrichWithFileNameHints(parsed, fileName);
  } catch (_) {}

  // 3. Trích xuất substring giữa dấu { đầu tiên và } cuối cùng
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    try {
      const parsed = JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
      if (parsed && typeof parsed === 'object') return enrichWithFileNameHints(parsed, fileName);
    } catch (_) {}
  }

  // 4. Cơ chế phục hồi JSON bị cắt ngắn (Truncated JSON Repair)
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
      const repaired = JSON.parse(partial);
      if (repaired && typeof repaired === 'object') return enrichWithFileNameHints(repaired, fileName);
    } catch (_) {}
  }

  // 5. Regex Fallback: cứu các trường dữ liệu chính nếu JSON bị hỏng nặng
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

  const totalMatch = trimmed.match(/"total_value"\s*:\s*([0-9.]+)/i);
  if (totalMatch) fallbackObj.total_value = parseFloat(totalMatch[1]);

  return enrichWithFileNameHints(fallbackObj, fileName);
}

function enrichWithFileNameHints(data: any, fileName?: string): any {
  if (!fileName) return data;
  const hints = extractMetadataFromFileName(fileName);
  return {
    ...data,
    po_number: data.po_number || hints.po_number || null,
    warehouse: data.warehouse || hints.warehouse || null,
  };
}

/**
 * Trực tiếp bóc tách PO qua Gemini phía trình duyệt trong trường hợp server không phản hồi
 */
async function clientSideGeminiExtract(
  base64Data: string,
  mimeType: string,
  fileName: string,
  apiKeys: string[]
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

  const prompt = `Bạn là chuyên gia phân tích và bóc tách dữ liệu chứng từ Đơn mua hàng (PO - Purchase Order) hàng đầu của các hệ thống bán lẻ và chuỗi cung ứng tại Việt Nam (FARMERS MARKET, CENTRAL RETAIL, BIG C, GO!, TOPS MARKET, WINMART, SAIGON CO.OP, LOTTE, AEON, v.v.).

Hãy phân tích toàn bộ nội dung tài liệu (PDF / Hình ảnh) được cung cấp và trích xuất đầy đủ, chính xác tất cả các thông tin sau theo cấu trúc JSON:

CÁC TRƯỜNG THÔNG TIN CẦN TRÍCH XUẤT:
1. "po_number" (Số hiệu PO / Mã đơn hàng): 
   - Tìm mã số sau các cụm từ: "Số hiệu chứng từ", "Số PO", "Số đơn đặt hàng", "Số chứng từ", "PO No.", "Order No.", "Mã đơn hàng", hoặc dãy số hiệu 5-8 chữ số ở đầu/tiêu đề chứng từ (ví dụ: "PO-118891", "118744", "PO-118744"). Nếu tên file có chứa số hiệu ("${fileName}"), hãy tham khảo để nhận diện chính xác.
2. "po_date" (Ngày lập chứng từ PO): 
   - Tìm sau: "Ngày chứng từ", "Ngày lập", "Ngày đặt", "Order Date", "Date". Chuẩn hóa thành định dạng: "YYYY-MM-DD" (ví dụ: 2026-11-04).
3. "expected_delivery_date" (Hạn giao hàng / Ngày giao dự kiến): 
   - Tìm sau: "Ngày giao hàng", "Hạn giao", "Giao trước ngày", "Delivery Date", "Ship Date". Chuẩn hóa thành: "YYYY-MM-DD".
4. "supplier_name" (Tên Nhà cung cấp / Đơn vị cung ứng / Bên bán): 
   - Tìm sau: "Tên NCC:", "Nhà cung cấp:", "Đơn vị bán:", "Vendor:", "Supplier:", "Bên bán:". Ví dụ: "CÔNG TY CỔ PHẦN CÔNG NGHỆ THỰC PHẨM LƯƠNG GIA", "CENTRAL RETAIL", v.v.
5. "supplier_code" (Mã Nhà cung cấp): 
   - Tìm sau: "Mã NCC:", "Mã nhà cung cấp:", "Vendor Code:", ví dụ: "V0001834".
6. "warehouse" (Kho nhận hàng / Chi nhánh nhận / Địa điểm giao hàng): 
   - Tìm sau: "Kho nhận:", "Chi nhánh yêu cầu:", "Địa chỉ giao hàng:", "Nơi nhận hàng:", "Ship to:", "DC:", "Store:". Ví dụ: "DC01 - Nơ Trang Long", "CENTRAL - FM01", "Kho Tổng".
7. "total_value" (Tổng giá trị đơn hàng / Tổng thanh toán): 
   - Tìm ở phần tổng kết: "TỔNG TIỀN HÀNG", "TỔNG CỘNG TRƯỚC THUẾ VAT", "TỔNG TIỀN THANH TOÁN", "Total Amount", "Grand Total". Là một số thực nguyên bản (bỏ các dấu phân cách nghìn).
8. "currency": Đơn vị tiền tệ, mặc định "VND".
9. "notes": Ghi chú đơn hàng, người đặt hàng ("Người đặt: ...", "Liên hệ: ...").
10. "items" (Danh sách toàn bộ các dòng mặt hàng trong bảng chi tiết):
    Với MỖI dòng sản phẩm, trích xuất đầy đủ:
    - "item_code": Mã hàng từ cột "Internal Code", "Barcode/PLU", "Mã hàng", "Mã SP", "Article", "SKU".
    - "item_name": Tên sản phẩm từ cột "Mặt hàng", "Tên hàng hóa", "Tên sản phẩm", "Description".
    - "ordered_qty": Số lượng đặt hàng (kiểu số, ví dụ 42).
    - "unit": Đơn vị tính ("Hộp", "Thùng", "Kg", "Gói", "Chai", "Lon", "Túi", "Cái"...).
    - "unit_price": Đơn giá (kiểu số).
    - "total_price": Thành tiền (kiểu số).
    - "warehouse": Kho hoặc chi nhánh của dòng nếu có.

YÊU CẦU QUAN TRỌNG:
- Bóc tách ĐẦY ĐỦ TẤT CẢ các dòng mặt hàng trong bảng, không bỏ sót dòng nào.
- Chỉ trả về duy nhất chuỗi JSON hợp lệ, không bọc markdown fence, không kèm lời chào hay giải thích.

Tên file tham chiếu: ${fileName}`;

  let lastErr = '';

  for (const k of uniqueKeys) {
    const models = await discoverBestFlashModels(k);
    for (const model of models) {
      for (const apiVer of ['v1beta', 'v1']) {
        try {
          const url = `https://generativelanguage.googleapis.com/${apiVer}/models/${model}:generateContent?key=${k}`;
          const isV1Beta = apiVer === 'v1beta';

          const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    { text: prompt },
                    { inlineData: { mimeType, data: base64Data } },
                  ],
                },
              ],
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

  // Nếu AI không đọc được, trả về ít nhất thông tin cứu từ tên file thay vì ném lỗi trắng trơn
  const fallbackHints = extractMetadataFromFileName(fileName);
  return {
    po_number: fallbackHints.po_number || null,
    po_date: new Date().toISOString().split('T')[0],
    expected_delivery_date: null,
    supplier_code: null,
    supplier_name: null,
    warehouse: fallbackHints.warehouse || null,
    total_value: null,
    currency: 'VND',
    notes: `Bóc tách tự động từ tệp: ${fileName}`,
    items: [],
  };
}

export const poTrackerService = {
  // ─── Folders ───────────────────────────────────────────────────────────────
  getFolders: () =>
    api.get<ApiResponse<POFolderItem[]>>('/po-tracker/folders'),

  createFolder: (data: Partial<POFolderItem>) =>
    api.post<ApiResponse<POFolderItem>>('/po-tracker/folders', data),

  updateFolder: (id: string, data: Partial<POFolderItem>) =>
    api.put<ApiResponse<POFolderItem>>(`/po-tracker/folders/${id}`, data),

  deleteFolder: (id: string) =>
    api.delete<ApiResponse<null>>(`/po-tracker/folders/${id}`),

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

    // 1. Thử qua máy chủ backend / serverless endpoint trước
    try {
      const res = await api.post<ApiResponse<POExtractedData>>('/po-tracker/upload-file', {
        fileDataUrl: dataUrl,
        fileName: file.name,
        mimeType: effectiveMime,
        apiKeys: uniqueKeys,
      }, { timeout: 60_000 });

      const d = res.data?.data;
      // Chỉ chấp nhận nếu máy chủ bóc tách được ít nhất số PO, tên NCC hoặc danh sách mặt hàng
      if (res.data?.success && d && (d.po_number || d.supplier_name || (d.items && d.items.length > 0))) {
        return res.data;
      }
    } catch (err: any) {
      console.warn('Backend extraction endpoint unhandled or error, falling back to client-side AI:', err?.message);
    }

    // 2. Client-side Gemini fallback (bóc tách trực tiếp tại máy người dùng với kết nối trực tiếp đến Google AI)
    try {
      const extracted = await clientSideGeminiExtract(cleanBase64, effectiveMime, file.name, uniqueKeys);
      return {
        success: true,
        data: {
          ...extracted,
          pdf_file_name: file.name,
        },
      };
    } catch (fallbackErr: any) {
      // Cứu dữ liệu cơ bản từ tên file
      const hints = extractMetadataFromFileName(file.name);
      return {
        success: true,
        data: {
          po_number: hints.po_number || null,
          po_date: new Date().toISOString().split('T')[0],
          expected_delivery_date: null,
          supplier_code: null,
          supplier_name: null,
          warehouse: hints.warehouse || null,
          total_value: null,
          currency: 'VND',
          notes: `Bóc tách từ tên tệp: ${file.name}`,
          items: [],
          pdf_file_name: file.name,
        },
      };
    }
  },

  uploadPdf: (file: File) => poTrackerService.uploadPOFile(file),

  // ─── Purchase Orders ───────────────────────────────────────────────────────
  getPOs: (params?: { folder_id?: string; status?: string; search?: string }) =>
    api.get<ApiResponse<POTrackerPO[]>>('/po-tracker/pos', { params }),

  getPO: (id: string) =>
    api.get<ApiResponse<POTrackerPO>>(`/po-tracker/pos/${id}`),

  createPO: (data: Partial<POTrackerPO> & { items?: any[] }) =>
    api.post<ApiResponse<POTrackerPO>>('/po-tracker/pos', data),

  updatePO: (id: string, data: Partial<POTrackerPO> & { items?: any[] }) =>
    api.put<ApiResponse<POTrackerPO>>(`/po-tracker/pos/${id}`, data),

  deletePO: (id: string) =>
    api.delete<ApiResponse<null>>(`/po-tracker/pos/${id}`),

  updateStatus: (id: string, status: string, actual_delivery_date?: string, notes?: string) =>
    api.patch<ApiResponse<null>>(`/po-tracker/pos/${id}/status`, {
      status,
      actual_delivery_date,
      notes,
    }),

  // ─── Stats ────────────────────────────────────────────────────────────────
  getStats: (folder_id?: string) =>
    api.get<ApiResponse<POTrackerStats>>('/po-tracker/stats', {
      params: folder_id ? { folder_id } : undefined,
    }),

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
