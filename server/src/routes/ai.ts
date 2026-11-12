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

      // Deduplicate keys while preserving order, and strictly reject any masked keys
      const uniqueKeys = Array.from(new Set(candidateKeys)).filter((k) => k && typeof k === 'string' && k.trim().length > 0 && !k.includes('••••'));

      if (uniqueKeys.length === 0) {
        return reply.code(400).send({
          success: false,
          needsApiKey: true,
          message: 'Chưa cấu hình API Key khả dụng. Vui lòng cài đặt khóa API trong Cài đặt → API Key.',
        });
      }

      const models = [
        'gemini-2.0-flash',
        'gemini-1.5-flash',
      ];

      const baseInstruction = 'YÊU CẦU BẮT BUỘC: CHỈ trả về duy nhất kết quả câu văn/đoạn văn sau khi xử lý. Tuyệt đối KHÔNG kèm theo lời giải thích, KHÔNG tiêu đề, KHÔNG lời chào/kết, KHÔNG nội dung lan man ngoài ngữ cảnh gốc.';

      let prompt = '';
      if (action === 'summarize') {
        prompt = `Hãy tóm tắt cô đọng đúng bản chất nội dung sau bằng tiếng Việt, giữ lại các thông tin cốt lõi (Ai, làm gì, khi nào, số lượng, lưu ý chính), không lan man. ${baseInstruction}\n\nNội dung cần tóm tắt:\n${text}`;
      } else if (action === 'keypoints') {
        prompt = `Hãy rút ra các ý chính / luận điểm mấu chốt quan trọng nhất từ văn bản sau bằng tiếng Việt, đánh số thứ tự 1, 2, 3... rõ ràng, ngắn gọn, đi thẳng vào trọng tâm. ${baseInstruction}\n\nVăn bản:\n${text}`;
      } else if (action === 'professional') {
        prompt = `Hãy viết lại văn bản sau chuẩn văn phong công vụ, thương mại lịch sự, tôn trọng người đọc bằng tiếng Việt, thay thế toàn bộ từ ngữ suồng sã, teencode, văn nói, giữ nguyên đầy đủ ý và tính chính xác của thông tin gốc. ${baseInstruction}\n\nNội dung gốc:\n${text}`;
      } else if (action === 'concise') {
        prompt = `Hãy viết lại văn bản sau thật ngắn gọn, súc tích bằng tiếng Việt. Giản lược tối đa các từ đệm, trạng từ thừa, cụm từ lặp lại, giữ nguyên 100% cốt lõi thông tin. ${baseInstruction}\n\nNội dung gốc:\n${text}`;
      } else if (action === 'proofread') {
        prompt = `Hãy sửa đúng chính tả tiếng Việt, chuẩn hóa dấu thanh, dấu câu, ngắt câu, viết hoa đầu câu trong văn bản sau, mà KHÔNG làm thay đổi cấu trúc hay ý nghĩa câu. ${baseInstruction}\n\nĐoạn văn gốc:\n${text}`;
      } else if (action === 'expand') {
        prompt = `Hãy phát triển câu từ tự nhiên, mạch lạc, bám sát ngữ cảnh thực tế của câu gốc bằng tiếng Việt (loại bỏ hoàn toàn mẫu câu máy móc vô nghĩa như quy trình dự án chung chung). ${baseInstruction}\n\nNội dung gốc:\n${text}`;
      } else if (action === 'action_items') {
        prompt = `Hãy trích xuất chính xác các hành động/đầu việc cần thực hiện từ văn bản sau thành định dạng checklist '- [ ] [Hành động cụ thể]'. ${baseInstruction}\n\nVăn bản:\n${text}`;
      } else if (action === 'translate_en') {
        prompt = `Hãy dịch sang tiếng Anh chuẩn, tự nhiên, chính xác cả về thuật ngữ kinh doanh/thu mua và đời sống. ${baseInstruction}\n\nVăn bản gốc:\n${text}`;
      } else if (action === 'translate_vi') {
        prompt = `Hãy dịch sang tiếng Việt mượt mà, thuần Việt, chuẩn ngữ pháp. ${baseInstruction}\n\nVăn bản gốc:\n${text}`;
      } else {
        // proofread fallback
        prompt = `Hãy sửa đúng chính tả tiếng Việt, chuẩn hóa dấu thanh, dấu câu, ngắt câu, viết hoa đầu câu trong văn bản sau, mà KHÔNG làm thay đổi cấu trúc hay ý nghĩa câu. ${baseInstruction}\n\nĐoạn văn gốc:\n${text}`;
      }

      let lastErr: any = null;

      // Iterate through keys pool sequentially (Intelligent Auto-failover across Gemini, DeepSeek & OpenAI)
      for (let kIdx = 0; kIdx < uniqueKeys.length; kIdx++) {
        const apiKey = uniqueKeys[kIdx].trim();

        if (apiKey.startsWith('sk-proj-') || apiKey.startsWith('sk-openai-')) {
          // OpenAI Provider Failover
          try {
            const oaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
              },
              body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                  { role: 'system', content: baseInstruction },
                  { role: 'user', content: prompt },
                ],
                temperature: 0.2,
              }),
            });
            if (oaiRes.ok) {
              const data: any = await oaiRes.json();
              const resultText = data.choices?.[0]?.message?.content?.trim();
              if (resultText) {
                return reply.send({
                  success: true,
                  result: resultText,
                  usedGemini: false,
                  provider: 'openai',
                  model: 'gpt-4o-mini',
                  usedKeyIndex: kIdx,
                  fallbackKeyUsed: kIdx > 0,
                });
              }
            }
          } catch (oaiErr: any) {
            lastErr = oaiErr;
            continue;
          }
        } else if (apiKey.startsWith('sk-')) {
          // DeepSeek Provider Failover
          try {
            const dsRes = await fetch('https://api.deepseek.com/chat/completions', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
              },
              body: JSON.stringify({
                model: 'deepseek-chat',
                messages: [
                  { role: 'system', content: baseInstruction },
                  { role: 'user', content: prompt },
                ],
                temperature: 0.2,
              }),
            });
            if (dsRes.ok) {
              const data: any = await dsRes.json();
              const resultText = data.choices?.[0]?.message?.content?.trim();
              if (resultText) {
                return reply.send({
                  success: true,
                  result: resultText,
                  usedGemini: false,
                  provider: 'deepseek',
                  model: 'deepseek-chat',
                  usedKeyIndex: kIdx,
                  fallbackKeyUsed: kIdx > 0,
                });
              }
            }
          } catch (dsErr: any) {
            lastErr = dsErr;
            continue;
          }
        } else {
          // Google Gemini Provider Failover
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
                  provider: 'gemini',
                  model,
                  usedKeyIndex: kIdx,
                  fallbackKeyUsed: kIdx > 0,
                });
              }
            } catch (mErr: any) {
              lastErr = mErr;
              const errStr = (mErr?.message || '').toLowerCase();
              if (errStr.includes('429') || errStr.includes('quota') || errStr.includes('resource_exhausted')) {
                // Key quota exhausted, switch to next candidate key immediately
                break;
              }
              continue;
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

  // Verify API key endpoint with multi-provider support (Gemini, DeepSeek, OpenAI, Claude)
  fastify.post('/verify-key', {
    preHandler: verifyToken,
    config: {
      rateLimit: {
        max: 30,
        timeWindow: '1 minute',
        errorResponseBuilder: () => ({
          statusCode: 429,
          error: 'Too Many Requests',
          message: 'Bạn đã thử kiểm tra API key quá nhiều lần. Vui lòng thử lại sau 1 phút.'
        })
      }
    }
  }, async (request: any, reply) => {
    const { apiKey, provider, model } = request.body || {};
    const key = apiKey || process.env.GEMINI_API_KEY;
    if (!key || typeof key !== 'string' || !key.trim()) {
      return reply.code(400).send({ success: false, message: 'Vui lòng cung cấp API key để kiểm tra' });
    }

    const cleanKey = key.trim();
    if (cleanKey.includes('••••')) {
      return reply.code(400).send({
        success: false,
        message: 'Khóa API đang ở dạng hiển thị bảo mật (••••). Vui lòng nhập lại khóa đầy đủ để kiểm tra.'
      });
    }
    const cleanProvider = (provider || '').toLowerCase().trim();

    // 1. DeepSeek provider verification
    if (cleanProvider === 'deepseek' || (!cleanProvider && cleanKey.startsWith('sk-') && !cleanKey.startsWith('sk-proj-'))) {
      try {
        const dsModel = model || 'deepseek-chat';
        const res = await fetch('https://api.deepseek.com/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${cleanKey}`,
          },
          body: JSON.stringify({
            model: dsModel,
            messages: [{ role: 'user', content: 'Ping' }],
            max_tokens: 5,
          }),
        });

        if (res.ok) {
          return reply.send({
            success: true,
            provider: 'deepseek',
            model: dsModel,
            message: `Khóa API DeepSeek hoạt động chính xác! (Model: ${dsModel})`,
          });
        }

        if (res.status === 429) {
          return reply.send({
            success: false,
            status: 'quota_exceeded',
            provider: 'deepseek',
            model: dsModel,
            message: 'Hết hạn mức DeepSeek (429) — Sẵn sàng chuyển dự phòng.',
          });
        }

        const errJson = await res.json().catch(() => ({}));
        return reply.code(400).send({
          success: false,
          provider: 'deepseek',
          message: errJson.error?.message || `Xác thực DeepSeek thất bại (Mã lỗi ${res.status})`,
        });
      } catch (dsErr: any) {
        return reply.code(400).send({
          success: false,
          provider: 'deepseek',
          message: `Lỗi kết nối tới máy chủ DeepSeek: ${dsErr.message}`,
        });
      }
    }

    // 2. OpenAI provider verification
    if (cleanProvider === 'openai' || cleanKey.startsWith('sk-proj-')) {
      try {
        const oaiModel = model || 'gpt-4o-mini';
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${cleanKey}`,
          },
          body: JSON.stringify({
            model: oaiModel,
            messages: [{ role: 'user', content: 'Ping' }],
            max_tokens: 5,
          }),
        });

        if (res.ok) {
          return reply.send({
            success: true,
            provider: 'openai',
            model: oaiModel,
            message: `Khóa API OpenAI hoạt động chính xác! (Model: ${oaiModel})`,
          });
        }

        if (res.status === 429) {
          return reply.send({
            success: false,
            status: 'quota_exceeded',
            provider: 'openai',
            model: oaiModel,
            message: 'Hết hạn mức OpenAI (429) — Sẵn sàng chuyển dự phòng.',
          });
        }

        const errJson = await res.json().catch(() => ({}));
        return reply.code(400).send({
          success: false,
          provider: 'openai',
          message: errJson.error?.message || `Xác thực OpenAI thất bại (Mã lỗi ${res.status})`,
        });
      } catch (oaiErr: any) {
        return reply.code(400).send({
          success: false,
          provider: 'openai',
          message: `Lỗi kết nối tới máy chủ OpenAI: ${oaiErr.message}`,
        });
      }
    }

    // 3. Claude (Anthropic) provider verification
    if (cleanProvider === 'claude' || cleanProvider === 'anthropic' || cleanKey.startsWith('sk-ant-')) {
      try {
        const claudeModel = model || 'claude-3-5-haiku-latest';
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': cleanKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: claudeModel,
            max_tokens: 5,
            messages: [{ role: 'user', content: 'Ping' }],
          }),
        });

        if (res.ok) {
          return reply.send({
            success: true,
            provider: 'claude',
            model: claudeModel,
            message: `Khóa API Anthropic Claude hoạt động chính xác! (Model: ${claudeModel})`,
          });
        }

        const errJson = await res.json().catch(() => ({}));
        return reply.code(400).send({
          success: false,
          provider: 'claude',
          message: errJson.error?.message || `Xác thực Claude thất bại (Mã lỗi ${res.status})`,
        });
      } catch (cErr: any) {
        return reply.code(400).send({
          success: false,
          provider: 'claude',
          message: `Lỗi kết nối tới máy chủ Anthropic: ${cErr.message}`,
        });
      }
    }

    // 4. Google Gemini provider verification (Default for AIzaSy, AQ. or any Gemini key)
    try {
      let geminiModels = model ? [model] : [];
      if (geminiModels.length === 0) {
        try {
          const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${cleanKey}`);
          if (listRes.ok) {
            const listData: any = await listRes.json();
            const serverModels = (listData.models || [])
              .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
              .map((m: any) => m.name?.replace(/^models\//, ''))
              .filter(Boolean);
            if (serverModels.length > 0) {
              const flash = serverModels.filter((m: string) => m.toLowerCase().includes('flash'));
              const others = serverModels.filter((m: string) => !m.toLowerCase().includes('flash'));
              geminiModels = [...flash, ...others];
            }
          }
        } catch (_) {}
      }

      if (geminiModels.length === 0) {
        geminiModels = [
          'gemini-2.0-flash',
          'gemini-1.5-flash',
          'gemini-2.0-flash-lite',
          'gemini-1.5-pro',
        ];
      }

      let lastGeminiErr = '';
      let hadQuotaErr = false;
      let allModelsQuotaExceeded = true;

      for (const gm of geminiModels) {
        try {
          const ai = new GoogleGenAI({ apiKey: cleanKey });
          await ai.models.generateContent({
            model: gm,
            contents: 'Ping. Trả lời đúng 1 chữ: OK',
            config: { maxOutputTokens: 5 },
          });
          return reply.send({
            success: true,
            provider: 'gemini',
            message: `Khóa API hoạt động chính xác với Google Gemini! (Model: ${gm})`,
            model: gm,
          });
        } catch (mErr: any) {
          lastGeminiErr = mErr.message || '';
          if (mErr.status === 429 || lastGeminiErr.includes('429') || lastGeminiErr.includes('RESOURCE_EXHAUSTED')) {
            hadQuotaErr = true;
            // KHÔNG dừng ngay! Tiếp tục thử các model khác (2.0-flash, 1.5-flash...)
            continue;
          }
          if (/not found|not supported/i.test(lastGeminiErr)) continue;
          if (/API_KEY_INVALID|key not valid/i.test(lastGeminiErr)) {
            return reply.code(400).send({
              success: false,
              provider: 'gemini',
              message: 'Khóa API không hợp lệ hoặc đã bị vô hiệu hóa trên Google AI Studio.',
            });
          }
          allModelsQuotaExceeded = false;
        }
      }

      if (hadQuotaErr && allModelsQuotaExceeded) {
        return reply.send({
          success: false,
          status: 'quota_exceeded',
          provider: 'gemini',
          message: 'Khóa API đã hết hạn mức (429 Quota Exceeded) trên tất cả các mô hình khả dụng — Hệ thống sẽ tự động dùng khóa dự phòng.',
        });
      }

      return reply.code(400).send({
        success: false,
        provider: 'gemini',
        message: `Xác thực API Key thất bại: ${lastGeminiErr || 'Khóa không hợp lệ'}`,
      });
    } catch (err: any) {
      return reply.code(400).send({
        success: false,
        provider: 'gemini',
        message: `Xác thực API Key thất bại: ${err.message || 'Khóa không hợp lệ'}`,
      });
    }
  });

  fastify.post('/chat', { preHandler: verifyToken }, async (request: any, reply) => {
    const { message, conversationId, apiKey, apiKeys } = request.body || {};
    if (!message || typeof message !== 'string' || !message.trim()) {
      return reply.code(400).send({ success: false, message: 'Nội dung tin nhắn không được để trống.' });
    }
    const clientKey = apiKey || (Array.isArray(apiKeys) ? apiKeys.find((k: any) => typeof k === 'string' && !k.includes('••••')) : undefined);
    
    try {
      const intent = await parseUserIntent(message);
      const dataContext = await buildDataContext(intent, message);
      
      const response = await geminiService.chat(message, dataContext, clientKey);
      
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

    // Extract MIME type and raw base64 from data URL safely without regex backtracking
    const commaIdx = imageDataUrl.indexOf(',');
    if (!imageDataUrl.startsWith('data:image/') || commaIdx === -1) {
      return reply.code(400).send({ success: false, message: 'Định dạng ảnh không được hỗ trợ. Chỉ chấp nhận định dạng data URL (data:image/...).' });
    }
    const header = imageDataUrl.substring(0, commaIdx);
    const mimeMatch = header.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64/i);
    if (!mimeMatch) {
      return reply.code(400).send({ success: false, message: 'Định dạng data URL không hợp lệ.' });
    }
    const mimeType = mimeMatch[1];
    const base64Data = imageDataUrl.substring(commaIdx + 1).replace(/\s+/g, '');

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
