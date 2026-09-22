import { GoogleGenAI } from '@google/genai';
import { getDb } from '../db/connection.js';

export class GeminiService {
  private ai: GoogleGenAI | null = null;
  private model = 'gemini-2.5-flash';

  constructor() {
    this.initClient();
  }

  public initClient() {
    const db = getDb();
    const keySetting = db.prepare("SELECT value FROM system_settings WHERE key = 'gemini_api_key'").get() as any;
    const modelSetting = db.prepare("SELECT value FROM system_settings WHERE key = 'gemini_model'").get() as any;

    const apiKey = keySetting?.value || process.env.GEMINI_API_KEY;

    if (apiKey) {
      this.ai = new GoogleGenAI({ apiKey });
    }
    if (modelSetting && modelSetting.value) {
      this.model = modelSetting.value;
    }
  }

  async chat(userMessage: string, dataContext: any): Promise<string> {
    if (!this.ai) {
      this.initClient();
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
}

export const geminiService = new GeminiService();
