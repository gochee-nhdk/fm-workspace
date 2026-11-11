import { GoogleGenAI } from '@google/genai';
import { getDb } from '../db/connection.js';

function cleanVietnameseNumber(val: any): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val) return 0;
  let str = String(val).trim();
  if (!str) return 0;

  str = str.replace(/[₫đ$VND\s]/gi, '').trim();

  const lastDot = str.lastIndexOf('.');
  const lastComma = str.lastIndexOf(',');

  if (lastDot !== -1 && lastComma !== -1) {
    if (lastComma > lastDot) {
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      str = str.replace(/,/g, '');
    }
  } else if (lastComma !== -1) {
    const commaCount = (str.match(/,/g) || []).length;
    if (commaCount > 1) {
      str = str.replace(/,/g, '');
    } else {
      const parts = str.split(',');
      if (parts[1].length <= 2) {
        str = parts[0] + '.' + parts[1];
      } else if (parts[1].length === 3 && parts[0].length <= 3) {
        str = parts[0] + parts[1];
      } else {
        str = str.replace(',', '.');
      }
    }
  } else if (lastDot !== -1) {
    const dotCount = (str.match(/\./g) || []).length;
    if (dotCount > 1) {
      str = str.replace(/\./g, '');
    } else {
      const parts = str.split('.');
      if (parts[1].length <= 2) {
        // Decimal dot e.g. 16.00
      } else if (parts[1].length === 3) {
        str = parts[0] + parts[1];
      }
    }
  }

  str = str.replace(/[^\d.-]/g, '');
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

function cleanVietnameseDate(val: any): string | null {
  if (!val || typeof val !== 'string') return null;
  const str = val.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

  const dmyMatch = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    const year = dmyMatch[3];
    return `${year}-${month}-${day}`;
  }

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

function extractMetadataFromFileName(fileName?: string): {
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

function safeParseAIJson(text: string, fileName?: string): any {
  if (!text || typeof text !== 'string') return {};
  let trimmed = text.trim();

  trimmed = trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  let rawParsed: any = null;

  try {
    rawParsed = JSON.parse(trimmed);
  } catch (_) {}

  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (!rawParsed && firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    try {
      rawParsed = JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
    } catch (_) {}
  }

  // Truncated JSON Repair
  if (!rawParsed && firstBrace !== -1) {
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

  // Regex Fallback
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

  // BUG-017: Nhận diện chứng từ trả hàng
  const isPurchaseReturn = /phiếu\s*xuất\s*trả|purchase\s*return|xuất\s*trả\s*(?:nhà\s*cung\s*cấp|ncc)|phiếu\s*trả\s*hàng|return\s*to\s*vendor/i.test(trimmed);

  const subTotalPreVat = cleanVietnameseNumber(rawParsed.subTotalPreVat || rawParsed.sub_total_pre_vat || rawParsed.total_value || 0);
  const totalVat = cleanVietnameseNumber(rawParsed.totalVat || rawParsed.total_vat || Math.round(subTotalPreVat * 0.08));
  const grandTotal = cleanVietnameseNumber(rawParsed.grandTotal || rawParsed.grand_total || (subTotalPreVat + totalVat));

  const normalized: any = {
    ...rawParsed,
    po_date: cleanVietnameseDate(rawParsed.po_date),
    expected_delivery_date: cleanVietnameseDate(rawParsed.expected_delivery_date),
    subTotalPreVat,
    orderDiscountAmount: cleanVietnameseNumber(rawParsed.orderDiscountAmount || rawParsed.order_discount_amount || 0),
    totalVat,
    grandTotal,
    total_value: subTotalPreVat || cleanVietnameseNumber(rawParsed.total_value),
    isPurchaseReturn: Boolean(rawParsed.isPurchaseReturn || isPurchaseReturn),
    documentType: (rawParsed.documentType || (isPurchaseReturn ? 'PURCHASE_RETURN' : 'PO')),
    warningMessage: isPurchaseReturn ? '⚠️ Cảnh báo: Đây là chứng từ Phiếu Xuất Trả (Purchase Return), không phải Đơn Mua Hàng (PO). Vui lòng kiểm tra lại trước khi nhập kho.' : (rawParsed.warningMessage || null),
  };

  if (normalized.supplier_name && /LARIA|FARMERS.*MARKET/i.test(normalized.supplier_name)) {
    normalized.supplier_name = '';
  }

  if (Array.isArray(rawParsed.items)) {
    normalized.items = rawParsed.items
      .map((it: any) => {
        if (!it || typeof it !== 'object') return null;
        const ordered_qty = cleanVietnameseNumber(it.ordered_qty || 1);
        const unit_price = cleanVietnameseNumber(it.unit_price || 0);
        const discountPct = cleanVietnameseNumber(it.discountPct || it.discount_pct || 0);
        const vatPct = cleanVietnameseNumber(it.vatPct || it.vat_pct || 8) || 8;
        const linePreVatTotal = cleanVietnameseNumber(it.linePreVatTotal || it.line_pre_vat_total || it.total_price || (ordered_qty * unit_price * (1 - discountPct / 100)));
        const lineVatAmount = cleanVietnameseNumber(it.lineVatAmount || it.line_vat_amount || Math.round((linePreVatTotal * vatPct) / 100));
        const lineGrossTotal = cleanVietnameseNumber(it.lineGrossTotal || it.line_gross_total || (linePreVatTotal + lineVatAmount));
        const total_price = linePreVatTotal;

        const barcode = it.barcode ? String(it.barcode).trim() : (it.item_code && /^\d{12,14}$/.test(String(it.item_code).trim()) ? String(it.item_code).trim() : undefined);

        return {
          item_code: String(it.item_code || it.internal_code || it.barcode || '').trim(),
          barcode,
          item_name: String(it.item_name || it.description || 'Sản phẩm').trim(),
          unit: String(it.unit || 'Gói').trim(),
          ordered_qty: ordered_qty > 0 ? ordered_qty : 1,
          unit_price,
          discountPct,
          vatPct,
          linePreVatTotal,
          lineVatAmount,
          lineGrossTotal,
          total_price,
          warehouse: String(it.warehouse || normalized.warehouse || '').trim(),
        };
      })
      .filter((it: any) => it && (it.item_name || it.item_code));
  } else {
    normalized.items = [];
  }

  return enrichWithFileNameHints(normalized, fileName);
}

const serverModelCache = new Map<string, { models: string[]; timestamp: number }>();

export function sortGeminiModelsNewestFirst(models: string[]): string[] {
  return [...models].sort((a, b) => {
    // Ưu tiên cao nhất cho gemini-2.0-flash và gemini-1.5-flash tốc độ cao
    const isA20 = a.toLowerCase() === 'gemini-2.0-flash';
    const isB20 = b.toLowerCase() === 'gemini-2.0-flash';
    if (isA20 && !isB20) return -1;
    if (!isA20 && isB20) return 1;

    const isA15 = a.toLowerCase() === 'gemini-1.5-flash';
    const isB15 = b.toLowerCase() === 'gemini-1.5-flash';
    if (isA15 && !isB15) return -1;
    if (!isA15 && isB15) return 1;

    const extractVersion = (name: string): number => {
      const match = name.match(/gemini-(\d+(?:\.\d+)?)/i) || name.match(/(\d+(?:\.\d+)?)/);
      return match ? parseFloat(match[1]) : 0;
    };
    const verA = extractVersion(a);
    const verB = extractVersion(b);
    if (verB !== verA) {
      return verB - verA;
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
    return ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-2.0-flash-lite'];
  }

  const cached = serverModelCache.get(cleanKey);
  if (cached && Date.now() - cached.timestamp < 10 * 60 * 1000) {
    return cached.models;
  }

  const fallback = [
    'gemini-2.0-flash',
    'gemini-1.5-flash',
    'gemini-2.0-flash-lite',
  ];

  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${cleanKey}`);
    if (res.ok) {
      const data: any = await res.json();
      const serverModels = (data.models || [])
        .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
        .map((m: any) => m.name?.replace(/^models\//, ''))
        .filter((name: string) => Boolean(name) && !name.includes('2.5') && !name.includes('preview') && !name.includes('pro'));

      if (serverModels.length > 0) {
        const sorted = sortGeminiModelsNewestFirst(serverModels);
        serverModelCache.set(cleanKey, { models: sorted, timestamp: Date.now() });
        return sorted;
      }
    }
  } catch (_) {}

  return fallback;
}

export class GeminiService {
  private ai: GoogleGenAI | null = null;
  private currentApiKey: string | null = null;
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
        this.currentApiKey = apiKey.trim();
        this.ai = new GoogleGenAI({ apiKey: apiKey.trim() });
      }
      if (modelSetting && modelSetting.value && !modelSetting.value.includes('2.5')) {
        this.model = modelSetting.value;
      } else {
        this.model = 'gemini-2.0-flash';
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
            temperature: 0.1,
            thinkingConfig: {
              thinkingBudget: 0,
            },
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

  async extractPOFromPdf(
    base64Data?: string,
    fileName: string = 'po-document.pdf',
    mimeType = 'application/pdf',
    clientKeys: string[] = [],
    textContent?: string
  ): Promise<any> {
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
    const hasDigitalText = Boolean(textContent && textContent.trim().length > 50);

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
7. "subTotalPreVat" (Tổng tiền trước thuế):
   - Lấy từ dòng "TỔNG TIỀN HÀNG" hoặc "TỔNG CỘNG TRƯỚC THUẾ VAT". Ví dụ: 928896 hoặc 4475300.
8. "totalVat" (Tiền thuế VAT):
   - Lấy từ dòng "THUẾ VAT" hoặc "TIỀN THUẾ" (ví dụ: 74312 hoặc 358024).
9. "grandTotal" (Tổng cộng thanh toán sau thuế):
   - Lấy từ "TỔNG CỘNG THANH TOÁN" hoặc "TỔNG THANH TOÁN" (ví dụ: 1003208 hoặc 4833324).
10. "total_value": Bằng subTotalPreVat.
11. "isPurchaseReturn": true nếu chứng từ là "PHIẾU XUẤT TRẢ" hoặc "PURCHASE RETURN", ngược lại false.
12. "currency": Đơn vị tiền tệ, mặc định "VND".
13. "notes": Người đặt hàng từ nhãn "Người đặt hàng:" (ví dụ: "Nguyễn Hùng Tiến") hoặc ghi chú chứng từ.
14. "items" (Danh sách toàn bộ các dòng mặt hàng trong bảng ĐƠN MUA HÀNG):
    Bóc tách ĐẦY ĐỦ TẤT CẢ các dòng sản phẩm trong bảng chi tiết, tuyệt đối không bỏ sót dòng nào:
    - "item_code": Cột "Internal Code" (ví dụ: "10015799", "10023401").
    - "barcode": Cột "Barcode/PLU" (mã vạch 13 chữ số, ví dụ: "8936034090999").
    - "item_name": Cột "Mặt hàng" hoặc "Tên sản phẩm", bao gồm đầy đủ mô tả nếu bị rớt dòng.
    - "ordered_qty": Cột "Số lượng" (kiểu số thực, ví dụ: 16 hoặc 109).
    - "unit": Cột "DVT" (ví dụ: "Túi", "Hũ", "Hộp", "Thùng", "Kg", "Gói", "Chai", "Lon", "Cái").
    - "unit_price": Cột "Đơn giá chưa VAT" (kiểu số, ví dụ: 58056 hoặc 7700).
    - "discountPct": Tỷ lệ chiết khấu % nếu có (mặc định 0).
    - "vatPct": Tỷ lệ thuế VAT % (mặc định 8).
    - "linePreVatTotal": Thành tiền chưa VAT (kiểu số, ví dụ: 928896 hoặc 839300).
    - "lineVatAmount": Tiền thuế VAT (Math.round(linePreVatTotal * vatPct / 100), ví dụ: 74312).
    - "lineGrossTotal": Thành tiền sau thuế (linePreVatTotal + lineVatAmount, ví dụ: 1003208).
    - "total_price": Bằng linePreVatTotal.
    - "warehouse": Kho nhận nếu có (ví dụ: "DC01 - Nơ Trang Long").

Chỉ trả về DUY NHẤT một chuỗi JSON hợp lệ theo đúng cấu trúc, không bọc markdown fence, không kèm lời chào hay giải thích.`;

    // Chuẩn bị parts:
    // Tách bạch rõ luồng Text vs Vision:
    // - Nếu tệp có Digital Text: GỬI DUY NHẤT Prompt + Digital Text (không gửi file/ảnh base64 nặng) -> giảm từ 25s xuống 1.5s!
    // - Chỉ gửi file/ảnh base64 khi không có Digital Text (file scan thuần túy).
    const requestParts: any[] = [{ text: prompt }];
    if (hasDigitalText) {
      requestParts.push({
        text: `NỘI DUNG VĂN BẢN TRÍCH XUẤT TỪ CHỨNG TỪ (DIGITAL TEXT):\n"""\n${textContent!.slice(0, 25000)}\n"""\nHãy trích xuất đầy đủ thông tin đơn hàng và bảng danh sách mặt hàng dựa trên nội dung văn bản này.`
      });
    } else if (cleanBase64) {
      requestParts.push({
        inlineData: { mimeType: effectiveMime, data: cleanBase64 }
      });
    }

    // 1. Try dynamic models for each available key via high-speed v1beta
    for (const key of keys) {
      if (!key || key.startsWith('sk-') || key.includes('••••')) continue;
      const cleanKey = key.trim();
      const discoveredModels = await discoverBestGeminiModels(cleanKey);

      for (const m of discoveredModels) {
        try {
          const fetchUrl = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${cleanKey}`;

          const res = await fetch(fetchUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: requestParts }],
              generationConfig: {
                temperature: 0,
                maxOutputTokens: 8192,
                responseMimeType: 'application/json',
                thinkingConfig: {
                  thinkingBudget: 0,
                },
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

    // 2. Try with GoogleGenAI instance if available
    if (this.ai) {
      try {
        const response = await this.ai.models.generateContent({
          model: this.model,
          contents: [{ parts: requestParts }],
          config: {
            temperature: 0,
            responseMimeType: 'application/json',
            thinkingConfig: {
              thinkingBudget: 0,
            },
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
