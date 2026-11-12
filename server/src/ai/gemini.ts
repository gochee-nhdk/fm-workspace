import { GoogleGenAI } from '@google/genai';
import { getDb } from '../db/connection.js';

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
              includeThoughts: false,
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
}

export const geminiService = new GeminiService();
