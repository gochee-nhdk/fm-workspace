import { GoogleGenAI } from '@google/genai';
import { getDb } from '../db/connection.js';

function extractMetadataFromFileName(fileName?: string): { po_number?: string; warehouse?: string } {
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

function enrichWithFileNameHints(data: any, fileName?: string): any {
  if (!fileName) return data;
  const hints = extractMetadataFromFileName(fileName);
  return {
    ...data,
    po_number: data.po_number || hints.po_number || null,
    warehouse: data.warehouse || hints.warehouse || null,
  };
}

function safeParseAIJson(text: string, fileName?: string): any {
  if (!text || typeof text !== 'string') return {};
  let trimmed = text.trim();

  trimmed = trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === 'object') return enrichWithFileNameHints(parsed, fileName);
  } catch (_) {}

  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    try {
      const parsed = JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
      if (parsed && typeof parsed === 'object') return enrichWithFileNameHints(parsed, fileName);
    } catch (_) {}
  }

  // Truncated JSON Repair
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

  // Regex Fallback
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

const serverModelCache = new Map<string, { models: string[]; timestamp: number }>();

export function sortGeminiModelsNewestFirst(models: string[]): string[] {
  return [...models].sort((a, b) => {
    const extractVersion = (name: string): number => {
      const match = name.match(/gemini-(\d+(?:\.\d+)?)/i) || name.match(/(\d+(?:\.\d+)?)/);
      return match ? parseFloat(match[1]) : 0;
    };
    const verA = extractVersion(a);
    const verB = extractVersion(b);
    if (verB !== verA) {
      return verB - verA; // Ưu tiên phiên bản cao nhất trước
    }
    const isFlashA = a.toLowerCase().includes('flash') ? 1 : 0;
    const isFlashB = b.toLowerCase().includes('flash') ? 1 : 0;
    if (isFlashB !== isFlashA) {
      return isFlashB - isFlashA;
    }
    return a.localeCompare(b);
  });
}

export async function discoverBestGeminiModels(apiKey: string): Promise<string[]> {
  const cleanKey = apiKey.trim();
  if (!cleanKey || cleanKey.includes('••••')) {
    return ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];
  }

  const cached = serverModelCache.get(cleanKey);
  if (cached && Date.now() - cached.timestamp < 10 * 60 * 1000) {
    return cached.models;
  }

  const fallback = [
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-1.5-flash',
    'gemini-2.0-flash-lite',
    'gemini-2.5-pro',
    'gemini-1.5-pro',
  ];

  try {
    for (const apiVer of ['v1beta', 'v1']) {
      const res = await fetch(`https://generativelanguage.googleapis.com/${apiVer}/models?key=${cleanKey}`);
      if (res.ok) {
        const data: any = await res.json();
        const serverModels = (data.models || [])
          .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
          .map((m: any) => m.name?.replace(/^models\//, ''))
          .filter(Boolean);

        if (serverModels.length > 0) {
          const sorted = sortGeminiModelsNewestFirst(serverModels);
          serverModelCache.set(cleanKey, { models: sorted, timestamp: Date.now() });
          return sorted;
        }
      }
    }
  } catch (_) {}

  return fallback;
}

export class GeminiService {
  private ai: GoogleGenAI | null = null;
  private currentApiKey: string | null = null;
  private model = 'gemini-2.5-flash';

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
        this.currentApiKey = apiKey.trim();
        this.ai = new GoogleGenAI({ apiKey: apiKey.trim() });
      }
      if (modelSetting && modelSetting.value) {
        this.model = modelSetting.value;
      } else {
        this.model = 'gemini-2.5-flash';
      }
    } catch {
      // Fallback to environment variable if system_settings table is not ready yet
      const apiKey = process.env.GEMINI_API_KEY;
      if (apiKey) {
        try {
          this.currentApiKey = apiKey;
          this.ai = new GoogleGenAI({ apiKey });
        } catch (_) {}
      }
    }
  }

  async chat(userMessage: string, dataContext: any, clientApiKey?: string): Promise<string> {
    const rawKey = clientApiKey || this.currentApiKey || process.env.GEMINI_API_KEY;
    if (clientApiKey && (clientApiKey.startsWith('AIzaSy') || clientApiKey.startsWith('AQ.') || (!clientApiKey.startsWith('sk-') && clientApiKey.length >= 20)) && !clientApiKey.includes('••••')) {
      try {
        this.currentApiKey = clientApiKey.trim();
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

    const effectiveKey = rawKey;
    const candidateModels = effectiveKey ? await discoverBestGeminiModels(effectiveKey) : [this.model];
    let lastError: any = null;

    for (const m of candidateModels) {
      try {
        const response = await this.ai.models.generateContent({
          model: m,
          contents: prompt,
          config: {
            systemInstruction: systemPrompt,
            temperature: 0.1 // Low temperature for factual precision
          }
        });

        if (response.text) return response.text;
      } catch (error: any) {
        lastError = error;
        console.warn(`Gemini Chat error with ${m}:`, error.message);
        if (error.status === 429) continue;
      }
    }

    throw new Error(`AI generation failed: ${lastError?.message || 'Không có phản hồi'}`);
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
    const cleanBase64 = (base64Data || '').replace(/\s+/g, '');

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
8. "currency": Đơn vị tiền tệ, mặc định "VND" nếu không ghi khác.
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

    // 1. Try dynamic models for each available key
    for (const key of keys) {
      if (!key || key.startsWith('sk-') || key.includes('••••')) continue;
      const cleanKey = key.trim();
      const discoveredModels = await discoverBestGeminiModels(cleanKey);

      for (const m of discoveredModels) {
        for (const apiVer of ['v1beta', 'v1']) {
          try {
            const fetchUrl = `https://generativelanguage.googleapis.com/${apiVer}/models/${m}:generateContent?key=${cleanKey}`;
            const isV1Beta = apiVer === 'v1beta';

            const res = await fetch(fetchUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{
                  parts: [
                    { text: prompt },
                    { inlineData: { mimeType: effectiveMime, data: cleanBase64 } }
                  ]
                }],
                generationConfig: {
                  temperature: 0.1,
                  maxOutputTokens: 8192,
                  ...(isV1Beta ? { responseMimeType: 'application/json' } : {})
                }
              })
            });

            if (res.ok) {
              const data: any = await res.json();
              const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
              const parsed = safeParseAIJson(text, fileName);
              if (parsed && (parsed.po_number || parsed.supplier_name || (parsed.items && parsed.items.length > 0))) {
                return parsed;
              }
            }
          } catch (_) {}
        }
      }
    }

    // 2. Try with GoogleGenAI instance if available
    if (this.ai) {
      try {
        const response = await this.ai.models.generateContent({
          model: this.model,
          contents: [{
            parts: [
              { text: prompt },
              { inlineData: { mimeType: effectiveMime, data: cleanBase64 } }
            ]
          }],
          config: {
            temperature: 0.1,
            responseMimeType: 'application/json'
          }
        });

        const text = response.text || '{}';
        return safeParseAIJson(text, fileName);
      } catch (err: any) {
        console.warn('GoogleGenAI SDK attempt error:', err.message);
      }
    }

    // Fallback: cứu thông tin nhận diện cơ bản từ tên file
    const hints = extractMetadataFromFileName(fileName);
    return {
      po_number: hints.po_number || null,
      po_date: new Date().toISOString().split('T')[0],
      expected_delivery_date: null,
      supplier_code: null,
      supplier_name: null,
      warehouse: hints.warehouse || null,
      total_value: null,
      currency: 'VND',
      notes: `Trích xuất từ tệp: ${fileName}`,
      items: []
    };
  }
}

export const geminiService = new GeminiService();
