import { GoogleGenAI } from '@google/genai';
import { getDb } from '../db/connection.js';

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

export class GeminiService {
  private ai: GoogleGenAI | null = null;
  private model = 'gemini-2.0-flash';

  constructor() {
    // Initial sync fallback with environment variable
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      try {
        this.ai = new GoogleGenAI({ apiKey });
      } catch (_) {}
    }
  }

  public async initClient(): Promise<void> {
    try {
      const db = getDb();
      const keySetting = (await db.prepare("SELECT value FROM system_settings WHERE key = 'gemini_api_key'").get()) as any;
      const modelSetting = (await db.prepare("SELECT value FROM system_settings WHERE key = 'gemini_model'").get()) as any;

      let apiKey = keySetting?.value;
      if (!apiKey || apiKey.includes('••••')) {
        // Fallback to active key from pool if single key is missing or masked
        try {
          const poolSetting = (await db.prepare("SELECT value FROM system_settings WHERE key = 'gemini_api_keys_pool'").get()) as any;
          if (poolSetting?.value) {
            const parsed = JSON.parse(poolSetting.value);
            if (Array.isArray(parsed)) {
              const active = parsed.find((item: any) => item?.isActive !== false && item?.key && !item.key.includes('••••'));
              if (active) apiKey = active.key;
            }
          }
        } catch (_) {}
      }

      if (!apiKey || apiKey.includes('••••')) {
        apiKey = process.env.GEMINI_API_KEY;
      }

      if (apiKey && apiKey.trim()) {
        this.ai = new GoogleGenAI({ apiKey: apiKey.trim() });
      }
      if (modelSetting && modelSetting.value && modelSetting.value !== 'gemini-2.5-flash') {
        this.model = modelSetting.value;
      } else {
        this.model = 'gemini-2.0-flash';
      }
    } catch {
      // Fallback to environment variable if system_settings table is not ready yet
      const apiKey = process.env.GEMINI_API_KEY;
      if (apiKey) {
        try {
          this.ai = new GoogleGenAI({ apiKey });
        } catch (_) {}
      }
    }
  }

  async chat(userMessage: string, dataContext: any, clientApiKey?: string): Promise<string> {
    if (clientApiKey && (clientApiKey.startsWith('AIzaSy') || clientApiKey.startsWith('AQ.') || (!clientApiKey.startsWith('sk-') && clientApiKey.length >= 20)) && !clientApiKey.includes('••••')) {
      try {
        this.ai = new GoogleGenAI({ apiKey: clientApiKey.trim() });
      } catch (_) {}
    } else if (!this.ai) {
      await this.initClient();
    }

    // If still no API key, return helpful guidance
    if (!this.ai) {
      return `⚠️ **Chưa cấu hình Gemini API Key**\n\nĐể kích hoạt Trợ lý AI Copilot phân tích dữ liệu tự động, vui lòng:\n1. Vào mục **Cài đặt hệ thống** (/settings)\n2. Nhập Gemini API Key của bạn\n3. Bấm **Lưu cài đặt**\n\nSau khi lưu key, bạn có thể hỏi đáp nghiệp vụ, nhờ AI phân tích tệp Excel, rà soát hàng cận date và đề xuất đặt hàng ngay lập tức.`;
    }

    // Zero-data awareness check
    if (dataContext?.workspaceStatus?.isZeroData) {
      const lower = userMessage.toLowerCase();
      const needsBusinessData = lower.includes('tồn kho') || lower.includes('đặt hàng') || lower.includes('sku') || lower.includes('bán') || lower.includes('hết hạn') || lower.includes('cửa hàng');
      if (needsBusinessData) {
        return `ℹ️ **Không gian làm việc đang ở trạng thái Trống (Zero-Data Workspace)**\n\nHiện tại hệ thống chưa có dữ liệu tồn kho, danh mục sản phẩm hay lịch sử bán hàng thực tế nào của công ty được nạp vào.\n\n**Để bắt đầu phân tích:**\n1. Truy cập **Trung tâm dữ liệu** (/data-center)\n2. Tải lên tệp Excel (.xlsx) hoặc CSV (.csv) chứa số liệu tồn kho hoặc doanh số của bạn\n3. Xác nhận ánh xạ cột dữ liệu\n\nNgay sau khi dữ liệu được nạp, tôi sẽ phân tích chính xác theo từng SKU và điểm bán của bạn.`;
      }
    }

    const systemPrompt = `
      Bạn là Trợ lý AI Cấp cao chuyên trách Thu mua & Merchandising (AI Procurement & Merchandising Copilot) cho Farmers Market (Việt Nam).
      
      NGUYÊN TẮC BẮT BUỘC (CRITICAL DIRECTIVES):
      1. ĐỘ CHÍNH XÁC TUYỆT ĐỐI: CHỈ trả lời và tính toán dựa trên dữ liệu thực tế được cung cấp trong [Data Context].
      2. KHÔNG BAO GIỜ BỊA ĐẶT (ZERO HALLUCINATION): Không tự tạo số liệu, không tự tạo SKU, không bịa tên cửa hàng hay số lượng tồn. Nếu thiếu thông tin để kết luận, hãy nói thẳng: "Dữ liệu hiện tại chưa đủ để kết luận" và chỉ rõ cần dữ liệu gì.
      3. THUẬT NGỮ CÔNG TY: Tuân thủ nghiêm ngặt các thuật ngữ nội bộ (Company Terminology) và quy tắc nghiệp vụ (Business Rules) có trong [Data Context].
      4. ĐỊNH DẠNG TRẢ LỜI RÕ RÀNG THEO CẤU TRÚC:
         - **Kết luận điều hành (Executive Summary)**
         - **Cơ sở dữ liệu (Data Reference & Assumptions)**
         - **Phân tích & Công thức tính (Calculation & Rationale)**
         - **Khuyến nghị hành động (Recommended Action)**
         - **Rủi ro cần theo dõi (Risk & Sensitivity)**
      5. NGÔN NGỮ: Sử dụng tiếng Việt chuẩn mực, kết hợp các thuật ngữ chuỗi cung ứng chuẩn quốc tế khi cần (SKU, MOQ, Lead Time, Days of Cover / DoC, Reorder Point).
    `;

    const prompt = `
      [Data Context]:
      ${JSON.stringify(dataContext, null, 2)}
      
      [User Question]:
      ${userMessage}
    `;

    try {
      const response = await this.ai.models.generateContent({
        model: this.model,
        contents: prompt,
        config: {
          systemInstruction: systemPrompt,
          temperature: 0.1 // Low temperature for factual precision
        }
      });

      return response.text || 'Không có phản hồi được tạo ra.';
    } catch (error: any) {
      console.error('Gemini API Error:', error);
      throw new Error(`AI generation failed: ${error.message}`);
    }
  }

  async extractPOFromPdf(base64Data: string, fileName: string, mimeType = 'application/pdf', clientKeys: string[] = []): Promise<any> {
    const dbCandidateKeys: string[] = [];
    try {
      const db = getDb();
      const poolSetting = (await db.prepare("SELECT value FROM system_settings WHERE key = 'gemini_api_keys_pool'").get()) as any;
      if (poolSetting?.value) {
        const parsed = JSON.parse(poolSetting.value);
        if (Array.isArray(parsed)) {
          parsed.forEach((k: any) => {
            if (k?.isActive !== false && k?.key && !k.key.includes('••••')) {
              dbCandidateKeys.push(k.key.trim());
            }
          });
        }
      }
      const singleKey = (await db.prepare("SELECT value FROM system_settings WHERE key = 'gemini_api_key'").get()) as any;
      if (singleKey?.value && !singleKey.value.includes('••••')) {
        dbCandidateKeys.push(singleKey.value.trim());
      }
    } catch (_) {}

    const rawKeys = [...clientKeys, ...dbCandidateKeys, process.env.GEMINI_API_KEY];
    const keys = Array.from(
      new Set(
        rawKeys
          .filter((k): k is string => typeof k === 'string' && k.trim().length > 0)
          .map((k) => k.trim())
          .filter((k) => (k.startsWith('AIzaSy') || k.startsWith('AQ.') || (!k.startsWith('sk-') && k.length >= 20)) && !k.includes('••••'))
      )
    );
    
    // First try internal initialized instance if available
    if (!this.ai) {
      await this.initClient();
    }

    const effectiveMime = mimeType && mimeType.includes('/') ? mimeType : (fileName.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');

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
7. Đơn vị tiền tệ ("currency"): Mặc định "VND" nếu không ghi khác.
8. Danh sách mặt hàng ("items"):
   Duyệt qua từng dòng trong bảng chi tiết hàng hóa:
   - "item_code": Lấy từ cột "Internal Code" hoặc "Barcode/PLU" (ví dụ: "10028694").
   - "item_name": Lấy từ cột "Mặt hàng" hoặc "Tên hàng hóa" (ví dụ: "Cam vàng phủ cacao Ohla 120 g ( Hộp )").
   - "ordered_qty": Số lượng đặt hàng (chuyển ví dụ "42,00" -> 42).
   - "unit": Đơn vị tính từ cột "DVT" (ví dụ: "Hộp", "Thùng", "Kg", "Gói", "Chai").
   - "unit_price": Lấy từ "Đơn giá chưa VAT (VND)" hoặc "Đơn giá" (chuyển ví dụ "116.364,00" -> 116364).
   - "total_price": Lấy từ "Thành tiền chưa VAT (VND)" hoặc "Thành tiền" (chuyển ví dụ "4.887.288,00" -> 4887288).
   - "warehouse": Chi nhánh hoặc kho nếu có trên dòng.
9. Ghi chú ("notes"): Lưu các điều khoản hoặc tên người đặt hàng (ví dụ: "Người đặt: Nguyễn Hùng Tiến").

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

    const models = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];

    // 1. Try with GoogleGenAI instance first if available
    if (this.ai) {
      try {
        const response = await this.ai.models.generateContent({
          model: this.model,
          contents: [{
            parts: [
              { text: prompt },
              { inlineData: { mimeType: effectiveMime, data: base64Data } }
            ]
          }],
          config: {
            temperature: 0.0,
            responseMimeType: 'application/json'
          }
        });

        const text = response.text || '{}';
        return safeParseAIJson(text);
      } catch (err: any) {
        console.warn('GoogleGenAI SDK attempt error, trying fetch fallback:', err.message);
      }
    }

    // 2. Multi-key & Multi-model REST fetch fallback
    for (const key of keys) {
      if (!key || key.startsWith('sk-') || key.includes('••••')) continue;
      for (const m of models) {
        try {
          const fetchUrl = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${key}`;
          const res = await fetch(fetchUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{
                parts: [
                  { text: prompt },
                  { inlineData: { mimeType: effectiveMime, data: base64Data } }
                ]
              }],
              generationConfig: {
                temperature: 0.0,
                responseMimeType: 'application/json'
              }
            })
          });

          if (res.ok) {
            const data: any = await res.json();
            const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
            return safeParseAIJson(text);
          }
        } catch (_) {}
      }
    }

    // Default structure if all attempts failed
    return {
      po_number: null,
      po_date: null,
      expected_delivery_date: null,
      supplier_code: null,
      supplier_name: null,
      warehouse: null,
      total_value: null,
      currency: 'VND',
      notes: null,
      items: []
    };
  }
}

export const geminiService = new GeminiService();
