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

function safeParseAIJson(text: string): any {
  if (!text || typeof text !== 'string') return {};
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch (_) {}

  const codeBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (codeBlockMatch && codeBlockMatch[1]) {
    try {
      return JSON.parse(codeBlockMatch[1].trim());
    } catch (_) {}
  }

  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    try {
      return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
    } catch (_) {}
  }

  return {};
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

  const prompt = `Bạn là chuyên gia bóc tách dữ liệu chứng từ Đơn mua hàng (PO - Purchase Order) của hệ thống FARMERS MARKET (CÔNG TY TNHH THƯƠNG MẠI LARIA).

Hãy phân tích toàn bộ tài liệu/hình ảnh/PDF được cung cấp và trích xuất đầy đủ, chính xác các thông tin sau.
Trả về định dạng JSON thuần túy (không bọc trong markdown code fence, không thêm lời chào hay giải thích).

QUY TẮC NHẬN DIỆN ĐẶC THÙ CHO FARMERS MARKET:
1. Số PO / Số chứng từ ("po_number"): Tìm sau các từ "Số hiệu chứng từ", "Số PO", "Số đơn hàng", "PO No.", ví dụ: "PO-118891".
2. Ngày lập PO ("po_date"): Tìm sau "Ngày chứng từ", "Ngày lập", ví dụ "4/11/2026" -> chuẩn hóa thành "YYYY-MM-DD" (2026-11-04).
3. Hạn giao hàng ("expected_delivery_date"): Tìm sau "Ngày giao hàng", "Hạn giao", "Giao trước ngày", ví dụ "9/11/2026" -> chuẩn hóa thành "YYYY-MM-DD" (2026-11-09).
4. Nhà cung cấp:
   - "supplier_name": Tên công ty / nhà cung cấp, tìm sau "Tên NCC:", ví dụ "CÔNG TY CỔ PHẦN CÔNG NGHỆ THỰC PHẨM LƯƠNG GIA".
   - "supplier_code": Mã nhà cung cấp, tìm sau "Mã NCC:", ví dụ "V0001834".
5. Địa điểm giao / Kho ("warehouse"):
   - Tìm sau "Chi nhánh yêu cầu:", "Địa chỉ giao hàng:", "Kho nhận:", ví dụ: "DC01 - Nơ Trang Long, 204 Nơ Trang Long...". Trích xuất mã kho/tên chi nhánh (ví dụ: "DC01 - Nơ Trang Long").
6. Tổng tiền ("total_value"):
   - Tìm ở cuối sau "TỔNG TIỀN HÀNG" hoặc "TỔNG CỘNG TRƯỚC THUẾ VAT".
   - Là số thực, bỏ dấu phân cách (ví dụ "54.770.204,00" -> 54770204).
7. Đơn vị tiền tệ ("currency"): Mặc định "VND".
8. Danh sách mặt hàng ("items"):
   Duyệt qua từng dòng trong bảng chi tiết hàng hóa:
   - "item_code": Lấy từ cột "Internal Code" hoặc "Barcode/PLU" (ví dụ: "10028694").
   - "item_name": Lấy từ cột "Mặt hàng" hoặc "Tên hàng hóa" (ví dụ: "Cam vàng phủ cacao Ohla 120 g ( Hộp )").
   - "ordered_qty": Số lượng đặt hàng (chuyển ví dụ "42,00" -> 42).
   - "unit": Đơn vị tính từ cột "DVT" (ví dụ: "Hộp", "Thùng", "Kg", "Gói", "Chai").
   - "unit_price": Lấy từ "Đơn giá chưa VAT (VND)" hoặc "Đơn giá" (chuyển ví dụ "116.364,00" -> 116364).
   - "total_price": Lấy từ "Thành tiền chưa VAT (VND)" hoặc "Thành tiền" (chuyển ví dụ "4.887.288,00" -> 4887288).
   - "warehouse": Chi nhánh hoặc kho nếu có trên dòng.
9. Ghi chú ("notes"): Lưu các điều khoản hoặc người đặt hàng (ví dụ: "Người đặt: Nguyễn Hùng Tiến").

Cấu trúc JSON cần trả về:
{
  "po_number": "PO-118891",
  "po_date": "2026-11-04",
  "expected_delivery_date": "2026-11-09",
  "supplier_code": "V0001834",
  "supplier_name": "CÔNG TY CỔ PHẦN CÔNG NGHỆ THỰC PHẨM LƯƠNG GIA",
  "warehouse": "DC01 - Nơ Trang Long",
  "total_value": 54770204,
  "currency": "VND",
  "notes": "Người đặt hàng: Nguyễn Hùng Tiến",
  "items": [
    {
      "item_code": "10028694",
      "item_name": "Cam vàng phủ cacao Ohla 120 g ( Hộp )",
      "unit": "Hộp",
      "ordered_qty": 42,
      "unit_price": 116364,
      "total_price": 4887288,
      "warehouse": "DC01"
    }
  ]
}
Tên file: ${fileName}`;

  let lastErr = '';

  for (const k of uniqueKeys) {
    // Tự động nhận diện danh sách mô hình mới nhất của API Key
    const models = await discoverBestFlashModels(k);
    for (const model of models) {
      for (const apiVer of ['v1beta', 'v1']) {
        try {
          const url = `https://generativelanguage.googleapis.com/${apiVer}/models/${model}:generateContent?key=${k}`;
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
                temperature: 0.0,
                responseMimeType: 'application/json',
              },
            }),
          });

          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            lastErr = errData.error?.message || `HTTP ${res.status}`;
            continue; // Không break khi 429 trên 1 model, tiếp tục thử model khác
          }

          const resJson = await res.json();
          const text = resJson.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '{}';
          return safeParseAIJson(text);
        } catch (err: any) {
          lastErr = err.message;
        }
      }
    }
  }

  throw new Error(lastErr || 'Không thể trích xuất PO qua AI');
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
    const mimeType = file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');

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

    // 1. Try server endpoint first
    try {
      const res = await api.post<ApiResponse<POExtractedData>>('/po-tracker/upload-file', {
        fileDataUrl: dataUrl,
        fileName: file.name,
        mimeType,
        apiKeys: uniqueKeys,
      }, { timeout: 60_000 });

      if (res.data?.success && res.data?.data) {
        return res.data;
      }
    } catch (err: any) {
      console.warn('Backend extraction endpoint unhandled or error, falling back to client-side AI:', err?.message);
    }

    // 2. Client-side Gemini fallback
    try {
      const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/s);
      const base64Data = match ? match[2] : dataUrl;
      const extracted = await clientSideGeminiExtract(base64Data, mimeType, file.name, uniqueKeys);
      return {
        success: true,
        data: {
          ...extracted,
          pdf_file_name: file.name,
        },
      };
    } catch (fallbackErr: any) {
      throw fallbackErr;
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
