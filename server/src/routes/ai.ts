import { FastifyInstance } from 'fastify';
import { GoogleGenAI } from '@google/genai';
import { geminiService } from '../ai/gemini.js';
import { parseUserIntent, buildDataContext } from '../ai/data-query.js';
import { verifyToken } from '../middleware/auth.js';
import { getDb } from '../db/connection.js';
import { v4 as uuidv4 } from 'uuid';

export default async function aiRoutes(fastify: FastifyInstance) {
  // Writing Tool endpoint (requires authenticated user + rate limited to prevent quota exhaustion)
  fastify.post('/writing-tool', {
    preHandler: verifyToken,
    config: {
      rateLimit: {
        max: 40,
        timeWindow: '1 minute',
        errorResponseBuilder: () => ({
          statusCode: 429,
          error: 'Too Many Requests',
          message: 'Bạn đã thực hiện quá nhiều yêu cầu xử lý AI trong thời gian ngắn. Vui lòng thử lại sau 1 phút.'
        })
      }
    }
  }, async (request: any, reply) => {
    const { text, action, apiKeys: clientApiKeys, apiKey: clientApiKey } = request.body || {};
    if (!text || typeof text !== 'string') {
      return reply.code(400).send({ error: 'Nội dung văn bản không được để trống' });
    }

    try {
      const db = getDb();
      // Resolve keys pool (client keys -> DB pool -> DB single -> env)
      const candidateKeys: string[] = [];
      if (Array.isArray(clientApiKeys) && clientApiKeys.length > 0) {
        candidateKeys.push(...clientApiKeys.filter((k: any) => typeof k === 'string' && k.trim()));
      }
      if (clientApiKey && typeof clientApiKey === 'string' && clientApiKey.trim()) {
        candidateKeys.push(clientApiKey.trim());
      }

      // Check DB settings
      try {
        const poolSetting = (await db.prepare("SELECT value FROM system_settings WHERE key = 'gemini_api_keys_pool'").get()) as any;
        if (poolSetting?.value) {
          const parsed = JSON.parse(poolSetting.value);
          if (Array.isArray(parsed)) {
            parsed.forEach((item: any) => {
              if (item?.isActive !== false && item?.key && typeof item.key === 'string' && item.key.trim()) {
                candidateKeys.push(item.key.trim());
              }
            });
          }
        }
      } catch (_) {}

      const singleKeySetting = (await db.prepare("SELECT value FROM system_settings WHERE key = 'gemini_api_key'").get()) as any;
      if (singleKeySetting?.value && singleKeySetting.value.trim()) {
        candidateKeys.push(singleKeySetting.value.trim());
      }
      if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim()) {
        candidateKeys.push(process.env.GEMINI_API_KEY.trim());
      }

      // Deduplicate keys while preserving order
      const uniqueKeys = Array.from(new Set(candidateKeys));

      if (uniqueKeys.length === 0) {
        return reply.code(400).send({
          success: false,
          needsApiKey: true,
          message: 'Chưa cấu hình Gemini API Key. Vui lòng cài đặt khóa API trong Cài đặt → API Key.',
        });
      }

      const models = [
        'gemini-3.6-flash',
        'gemini-3.1-flash',
        'gemini-3.1-flash-lite',
        'gemini-2.5-flash',
        'gemini-2.5-flash-lite',
        'gemini-2.0-flash',
        'gemini-1.5-flash',
      ];

      const baseInstruction = 'YÊU CẦU BẮT BUỘC: CHỈ trả về duy nhất kết quả câu văn/đoạn văn sau khi xử lý. Tuyệt đối KHÔNG kèm theo lời giải thích, KHÔNG tiêu đề, KHÔNG lời chào, KHÔNG nội dung lan man ngoài ngữ cảnh gốc.';

      let prompt = '';
      if (action === 'summarize') {
        prompt = `Hãy tóm tắt nội dung sau thành các ý ngắn gọn, súc tích bằng tiếng Việt. ${baseInstruction}\n\nNội dung cần tóm tắt:\n${text}`;
      } else if (action === 'keypoints') {
        prompt = `Hãy rút ra các ý chính quan trọng từ văn bản sau (đánh số 1, 2, 3...) bằng tiếng Việt. ${baseInstruction}\n\nVăn bản:\n${text}`;
      } else if (action === 'professional') {
        prompt = `Hãy viết lại nội dung sau theo phong cách lịch sự, chuyên nghiệp, chuẩn mực doanh nghiệp bằng tiếng Việt. Bám sát nội dung gốc, không bịa đặt thêm các thông tin không liên quan. ${baseInstruction}\n\nNội dung gốc:\n${text}`;
      } else if (action === 'concise') {
        prompt = `Hãy viết lại nội dung sau thật ngắn gọn, cô đọng, súc tích bằng tiếng Việt nhưng giữ nguyên toàn bộ ý nghĩa. ${baseInstruction}\n\nNội dung gốc:\n${text}`;
      } else if (action === 'expand') {
        prompt = `Hãy phát triển và mở rộng câu văn/đoạn văn sau một cách tự nhiên, mạch lạc, đầy đủ ý tứ bằng tiếng Việt, bám sát đúng chủ đề và nội dung ban đầu của người dùng, không thêm các quy trình dự án máy móc không liên quan. ${baseInstruction}\n\nNội dung gốc:\n${text}`;
      } else if (action === 'action_items') {
        prompt = `Hãy chuyển văn bản sau thành danh sách việc cần làm (Checklist) với cú pháp '- [ ] ' ở đầu mỗi dòng. ${baseInstruction}\n\nVăn bản:\n${text}`;
      } else if (action === 'translate_en') {
        prompt = `Hãy dịch chính xác văn bản sau sang tiếng Anh tự nhiên. ${baseInstruction}\n\nVăn bản gốc:\n${text}`;
      } else if (action === 'translate_vi') {
        prompt = `Hãy dịch chính xác văn bản sau sang tiếng Việt tự nhiên, mượt mà. ${baseInstruction}\n\nVăn bản gốc:\n${text}`;
      } else {
        // proofread
        prompt = `Hãy sửa toàn bộ lỗi chính tả, ngữ pháp, dấu câu và câu từ trong đoạn văn sau bằng tiếng Việt. ${baseInstruction}\n\nĐoạn văn gốc:\n${text}`;
      }

      let lastErr: any = null;

      // Iterate through keys pool sequentially (Intelligent Auto-failover)
      for (let kIdx = 0; kIdx < uniqueKeys.length; kIdx++) {
        const apiKey = uniqueKeys[kIdx];
        const ai = new GoogleGenAI({ apiKey });

        for (const model of models) {
          try {
            const response = await ai.models.generateContent({
              model,
              contents: prompt,
              config: {
                temperature: 0.2,
              },
            });
            const resultText = response.text?.trim() || '';
            if (resultText) {
              return reply.send({
                success: true,
                result: resultText,
                usedGemini: true,
                model,
                usedKeyIndex: kIdx,
                fallbackKeyUsed: kIdx > 0,
              });
            }
          } catch (mErr: any) {
            lastErr = mErr;
            // If quota error on this key, break inner model loop and try next key in pool
            const isQuota = mErr?.status === 429 || /quota|rate.?limit|exhausted|resource/i.test(mErr?.message || '');
            if (isQuota) {
              console.warn(`[AI Failover] Key #${kIdx + 1} exhausted quota, switching to backup key...`);
              break;
            }
          }
        }
      }

      throw lastErr || new Error('Không thể tạo nội dung từ Gemini qua tất cả các khóa API');
    } catch (err: any) {
      console.error('Server AI writing tool error:', err);
      return reply.code(500).send({
        success: false,
        error: err.message,
      });
    }
  });

  // Verify Gemini API key endpoint (requires authenticated user + rate limited)
  fastify.post('/verify-key', {
    preHandler: verifyToken,
    config: {
      rateLimit: {
        max: 10,
        timeWindow: '1 minute',
        errorResponseBuilder: () => ({
          statusCode: 429,
          error: 'Too Many Requests',
          message: 'Bạn đã thử kiểm tra API key quá nhiều lần. Vui lòng thử lại sau 1 phút.'
        })
      }
    }
  }, async (request: any, reply) => {
    const { apiKey } = request.body || {};
    const key = apiKey || process.env.GEMINI_API_KEY;
    if (!key) {
      return reply.code(400).send({ success: false, message: 'Vui lòng cung cấp API key để kiểm tra' });
    }

    try {
      const ai = new GoogleGenAI({ apiKey: key });
      await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: 'Ping. Trả lời đúng 1 chữ: OK',
        config: { maxOutputTokens: 5 },
      });
      return reply.send({
        success: true,
        message: 'Khóa API hoạt động chính xác với Gemini 2.5 Flash!',
        model: 'gemini-2.5-flash',
      });
    } catch (err: any) {
      return reply.code(400).send({
        success: false,
        message: `Xác thực API Key thất bại: ${err.message || 'Khóa không hợp lệ'}`,
      });
    }
  });

  fastify.post('/chat', { preHandler: verifyToken }, async (request: any, reply) => {
    const { message, conversationId } = request.body;
    
    try {
      const intent = await parseUserIntent(message);
      const dataContext = await buildDataContext(intent, message);
      
      const response = await geminiService.chat(message, dataContext);
      
      const db = getDb();
      let convId = conversationId;
      const now = new Date().toISOString();
      
      if (!convId) {
        convId = uuidv4();
        await db.prepare('INSERT INTO ai_conversations (id, user_id, title, created_at) VALUES (?, ?, ?, ?)').run(
          convId, request.user.id, message.substring(0, 50), now
        );
      } else {
        const existingConv = (await db.prepare('SELECT user_id FROM ai_conversations WHERE id = ?').get(convId)) as any;
        if (!existingConv) {
          return reply.code(404).send({ success: false, message: 'Không tìm thấy cuộc trò chuyện.' });
        }
        if (existingConv.user_id !== request.user.id && request.user.role !== 'admin') {
          return reply.code(403).send({ success: false, message: 'Bạn không có quyền gửi tin nhắn vào cuộc hội thoại của người khác.' });
        }
      }
      
      await db.prepare('INSERT INTO ai_messages (id, conversation_id, role, content, data_context, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
        uuidv4(), convId, 'user', message, null, now
      );
      
      await db.prepare('INSERT INTO ai_messages (id, conversation_id, role, content, data_context, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
        uuidv4(), convId, 'assistant', response, JSON.stringify(dataContext), now
      );
      
      return {
        success: true,
        response,
        reply: response,
        conversationId: convId,
        intent,
        data: {
          response,
          reply: response,
          conversationId: convId,
          intent
        }
      };
    } catch (error: any) {
      return reply.code(500).send({ error: error.message });
    }
  });

  fastify.get('/conversations', { preHandler: verifyToken }, async (request: any, reply) => {
    const db = getDb();
    return await db.prepare('SELECT * FROM ai_conversations WHERE user_id = ? ORDER BY created_at DESC').all(request.user.id);
  });

  // ─── OCR / Extract Text from Image endpoint ───────────────────────────────
  // Accepts a base64 image data URL and uses Gemini Vision to extract all text content with multi-key failover.
  fastify.post('/extract-image-text', {
    preHandler: verifyToken,
    config: {
      rateLimit: {
        max: 30,
        timeWindow: '1 minute',
        errorResponseBuilder: () => ({
          statusCode: 429,
          error: 'Too Many Requests',
          message: 'Bạn đã thực hiện quá nhiều yêu cầu trích xuất ảnh trong thời gian ngắn. Vui lòng thử lại sau 1 phút.',
        }),
      },
    },
  }, async (request: any, reply) => {
    const { imageDataUrl, apiKeys: clientApiKeys, apiKey: clientApiKey } = request.body || {};

    // Validate input
    if (!imageDataUrl || typeof imageDataUrl !== 'string') {
      return reply.code(400).send({ success: false, message: 'Dữ liệu ảnh không hợp lệ hoặc bị thiếu.' });
    }

    // Enforce maximum payload size (10 MB base64 ≈ ~7.5 MB image) to prevent abuse
    if (imageDataUrl.length > 10_000_000) {
      return reply.code(413).send({ success: false, message: 'Ảnh quá lớn để xử lý (tối đa 7.5 MB).' });
    }

    // Extract MIME type and raw base64 from data URL
    const dataUrlMatch = imageDataUrl.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/s);
    if (!dataUrlMatch) {
      return reply.code(400).send({ success: false, message: 'Định dạng ảnh không được hỗ trợ. Chỉ chấp nhận định dạng data URL (data:image/...).' });
    }
    const mimeType = dataUrlMatch[1] as string;
    const base64Data = dataUrlMatch[2] as string;

    // Resolve keys pool (client keys -> DB pool -> DB single -> env)
    const db = getDb();
    const candidateKeys: string[] = [];
    if (Array.isArray(clientApiKeys) && clientApiKeys.length > 0) {
      candidateKeys.push(...clientApiKeys.filter((k: any) => typeof k === 'string' && k.trim()));
    }
    if (clientApiKey && typeof clientApiKey === 'string' && clientApiKey.trim()) {
      candidateKeys.push(clientApiKey.trim());
    }

    try {
      const poolSetting = (await db.prepare("SELECT value FROM system_settings WHERE key = 'gemini_api_keys_pool'").get()) as any;
      if (poolSetting?.value) {
        const parsed = JSON.parse(poolSetting.value);
        if (Array.isArray(parsed)) {
          parsed.forEach((item: any) => {
            if (item?.isActive !== false && item?.key && typeof item.key === 'string' && item.key.trim()) {
              candidateKeys.push(item.key.trim());
            }
          });
        }
      }
    } catch (_) {}

    const keySetting = (await db.prepare("SELECT value FROM system_settings WHERE key = 'gemini_api_key'").get()) as any;
    if (keySetting?.value && keySetting.value.trim()) {
      candidateKeys.push(keySetting.value.trim());
    }
    if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim()) {
      candidateKeys.push(process.env.GEMINI_API_KEY.trim());
    }

    const uniqueKeys = Array.from(new Set(candidateKeys));

    if (uniqueKeys.length === 0) {
      return reply.code(400).send({
        success: false,
        needsApiKey: true,
        message: 'Chưa cấu hình Gemini API Key. Vui lòng cài đặt khóa API trong Cài đặt → API Key.',
      });
    }

    // Vision-capable model fallback chain (newest first)
    const models = [
      'gemini-2.5-flash',
      'gemini-2.0-flash',
      'gemini-1.5-flash',
    ];

    const ocrPrompt =
      'Bạn là chuyên gia OCR văn bản chuyên nghiệp. Hãy trích xuất TOÀN BỘ nội dung chữ/văn bản xuất hiện trong hình ảnh một cách đầy đủ và chính xác 100%:\n' +
      '- Nhận diện chính xác từng từ tiếng Việt có dấu, số hiệu, mã chứng từ (PO, SKU), ngày tháng, giờ giấc, tên riêng, email, số điện thoại.\n' +
      '- Giữ nguyên trật tự trên-dưới, cấu trúc từng dòng, đoạn văn và các danh sách có đánh số.\n' +
      '- Không tự ý tóm tắt, không sửa từ, không bỏ qua các dòng chữ nhỏ, chữ ký hay ghi chú ở cuối.\n' +
      '- Nếu trong ảnh hoàn toàn không có bất kỳ ký tự chữ hay số nào, hãy trả về chính xác: [KHÔNG CÓ VĂN BẢN]\n' +
      '- Chỉ trả về duy nhất nội dung văn bản thuần túy được trích xuất, tuyệt đối không thêm lời mở đầu hay giải thích.';

    let lastErr: any = null;

    // Iterate through candidate keys (Intelligent Auto-failover)
    for (let kIdx = 0; kIdx < uniqueKeys.length; kIdx++) {
      const apiKey = uniqueKeys[kIdx];
      const ai = new GoogleGenAI({ apiKey });

      for (const model of models) {
        try {
          const response = await ai.models.generateContent({
            model,
            contents: [
              {
                parts: [
                  { text: ocrPrompt },
                  { inlineData: { mimeType, data: base64Data } },
                ],
              },
            ],
            config: { temperature: 0.1 },
          });

          const extracted = response.text?.trim() ?? '';

          // Detect "no text found" sentinel
          if (!extracted || extracted === '[KHÔNG CÓ VĂN BẢN]') {
            return reply.send({
              success: true,
              text: '',
              model,
              noText: true,
              usedKeyIndex: kIdx,
              fallbackKeyUsed: kIdx > 0,
            });
          }

          return reply.send({
            success: true,
            text: extracted,
            model,
            usedKeyIndex: kIdx,
            fallbackKeyUsed: kIdx > 0,
          });
        } catch (err: any) {
          lastErr = err;
          const isQuota = err?.status === 429 || /quota|rate.?limit|exhausted|resource/i.test(err?.message ?? '');
          if (isQuota) {
            console.warn(`[OCR Failover] Key #${kIdx + 1} hit quota, trying next key...`);
            break; // Break inner model loop, try next key in pool
          }
        }
      }
    }

    // All keys failed
    const errMsg = lastErr?.message || 'Lỗi không xác định từ Gemini API';
    return reply.code(500).send({ success: false, message: `Không thể trích xuất nội dung: ${errMsg}` });
  });
}
