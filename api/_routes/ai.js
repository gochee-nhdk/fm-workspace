const { z } = require('zod');
const { sendError, parseZodError, verifyAuth } = require('../_lib/http');
const { getUserGeminiKeysList } = require('./settings');

const serverModelCache = new Map();

const verifyKeySchema = z.object({
  apiKey: z.string().trim().max(500).optional(),
  provider: z.string().trim().max(50).optional(),
  model: z.string().trim().max(120).optional(),
});

const writingToolSchema = z.object({
  text: z.string().min(1, 'Nội dung văn bản không được để trống').max(100000),
  action: z.string().trim().max(80).optional(),
  apiKeys: z.array(z.string().max(500)).max(20).optional(),
  apiKey: z.string().max(500).optional(),
});

const extractImageTextSchema = z.object({
  imageDataUrl: z.string().min(20, 'Dữ liệu ảnh không hợp lệ').max(6 * 1024 * 1024),
  apiKeys: z.array(z.string().max(500)).max(20).optional(),
  apiKey: z.string().max(500).optional(),
});

const chatSchema = z.object({
  message: z.string().min(1, 'Tin nhắn không được để trống').max(50000),
  conversationId: z.string().max(120).optional(),
  apiKeys: z.array(z.string().max(500)).max(20).optional(),
  apiKey: z.string().max(500).optional(),
});

function sortGeminiModelsNewestFirst(models) {
  return [...models].sort((a, b) => {
    const isA20Flash = (a || '').toLowerCase() === 'gemini-2.0-flash';
    const isB20Flash = (b || '').toLowerCase() === 'gemini-2.0-flash';
    if (isA20Flash && !isB20Flash) return -1;
    if (!isA20Flash && isB20Flash) return 1;

    const parseVer = (name) => {
      const match = (name || '').match(/gemini-(\d+(?:\.\d+)?)/i);
      return match ? parseFloat(match[1]) : 0;
    };
    const vA = parseVer(a);
    const vB = parseVer(b);
    if (vB !== vA) return vB - vA;

    const aIsFlash = (a || '').toLowerCase().includes('flash');
    const bIsFlash = (b || '').toLowerCase().includes('flash');
    if (aIsFlash && !bIsFlash) return -1;
    if (!aIsFlash && bIsFlash) return 1;
    return (a || '').localeCompare(b || '');
  });
}

async function discoverBestGeminiModels(apiKey) {
  if (!apiKey || apiKey.includes('••••')) {
    return ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];
  }
  const cleanKey = apiKey.trim();
  const cached = serverModelCache.get(cleanKey);
  if (cached && Date.now() - cached.timestamp < 10 * 60 * 1000 && cached.models.length > 0) {
    return cached.models;
  }

  const foundModels = new Set();
  const endpoints = [
    `https://generativelanguage.googleapis.com/v1beta/models?key=${cleanKey}`,
    `https://generativelanguage.googleapis.com/v1/models?key=${cleanKey}`,
  ];

  for (const url of endpoints) {
    try {
      const res = await fetch(url, { headers: { 'Content-Type': 'application/json' } });
      if (res.ok) {
        const data = await res.json();
        const models = (data.models || [])
          .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
          .map((m) => (m.name || '').replace(/^models\//, ''))
          .filter((m) => (m || '').toLowerCase().startsWith('gemini'));
        for (const m of models) foundModels.add(m);
      }
    } catch (_) {}
  }

  const finalModels =
    foundModels.size > 0
      ? sortGeminiModelsNewestFirst(Array.from(foundModels))
      : ['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-2.0-flash-lite'];

  serverModelCache.set(cleanKey, { models: finalModels, timestamp: Date.now() });
  return finalModels;
}

async function resolveCandidateKeys(req, { apiKeys, apiKey }) {
  let storedUserKeys = [];
  try {
    const auth = await verifyAuth(req);
    if (auth.valid && auth.user?.id) {
      storedUserKeys = await getUserGeminiKeysList(auth.user.id);
    }
  } catch (_) {}

  const raw = [
    ...(Array.isArray(apiKeys) ? apiKeys : []),
    apiKey,
    ...storedUserKeys,
    process.env.GEMINI_API_KEY,
  ];
  return Array.from(
    new Set(
      raw
        .filter((k) => typeof k === 'string' && k.trim().length > 0)
        .map((k) => k.trim())
        .filter((k) => !k.includes('••••'))
    )
  );
}

async function handleAiRoute(req, res, pathname) {
  // POST /ai/verify-key
  if (pathname === '/ai/verify-key' && req.method === 'POST') {
    const parsed = verifyKeySchema.safeParse(req.body || {});
    if (!parsed.success) {
      return sendError(res, 400, 'ValidationError', parseZodError(parsed.error));
    }

    const key = parsed.data.apiKey || process.env.GEMINI_API_KEY;
    if (!key || typeof key !== 'string' || !key.trim()) {
      return sendError(res, 400, 'ValidationError', 'Vui lòng cung cấp API key để kiểm tra');
    }

    const cleanKey = key.trim();
    const cleanProvider = (parsed.data.provider || '').toLowerCase().trim();
    const model = parsed.data.model;

    // DeepSeek
    if (
      cleanProvider === 'deepseek' ||
      (!cleanProvider && (cleanKey.startsWith('sk-') || /^[a-f0-9]{32}$/i.test(cleanKey)))
    ) {
      try {
        const dsModel = model || 'deepseek-chat';
        const fetchRes = await fetch('https://api.deepseek.com/chat/completions', {
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

        if (fetchRes.ok) {
          return res.status(200).json({
            success: true,
            provider: 'deepseek',
            model: dsModel,
            message: `Khóa API DeepSeek hoạt động chính xác! (Model: ${dsModel})`,
          });
        }
        if (fetchRes.status === 429) {
          return res.status(200).json({
            success: false,
            status: 'quota_exceeded',
            provider: 'deepseek',
            model: dsModel,
            message: 'Hết hạn mức DeepSeek (429) — Sẵn sàng chuyển dự phòng.',
          });
        }
        const errJson = await fetchRes.json().catch(() => ({}));
        return res.status(400).json({
          success: false,
          provider: 'deepseek',
          message: errJson.error?.message || `Xác thực DeepSeek thất bại (Mã lỗi ${fetchRes.status})`,
        });
      } catch (dsErr) {
        return res.status(400).json({
          success: false,
          provider: 'deepseek',
          message: `Lỗi kết nối tới máy chủ DeepSeek: ${dsErr.message}`,
        });
      }
    }

    // OpenAI
    if (cleanProvider === 'openai' || cleanKey.startsWith('sk-proj-')) {
      try {
        const oaiModel = model || 'gpt-4o-mini';
        const fetchRes = await fetch('https://api.openai.com/v1/chat/completions', {
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

        if (fetchRes.ok) {
          return res.status(200).json({
            success: true,
            provider: 'openai',
            model: oaiModel,
            message: `Khóa API OpenAI hoạt động chính xác! (Model: ${oaiModel})`,
          });
        }
        if (fetchRes.status === 429) {
          return res.status(200).json({
            success: false,
            status: 'quota_exceeded',
            provider: 'openai',
            model: oaiModel,
            message: 'Hết hạn mức OpenAI (429) — Sẵn sàng chuyển dự phòng.',
          });
        }
        const errJson = await fetchRes.json().catch(() => ({}));
        return res.status(400).json({
          success: false,
          provider: 'openai',
          message: errJson.error?.message || `Xác thực OpenAI thất bại (Mã lỗi ${fetchRes.status})`,
        });
      } catch (oaiErr) {
        return res.status(400).json({
          success: false,
          provider: 'openai',
          message: `Lỗi kết nối tới máy chủ OpenAI: ${oaiErr.message}`,
        });
      }
    }

    // Anthropic Claude
    if (cleanProvider === 'claude' || cleanProvider === 'anthropic' || cleanKey.startsWith('sk-ant-')) {
      try {
        const claudeModel = model || 'claude-3-5-haiku-20241022';
        const fetchRes = await fetch('https://api.anthropic.com/v1/messages', {
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

        if (fetchRes.ok) {
          return res.status(200).json({
            success: true,
            provider: 'claude',
            model: claudeModel,
            message: `Khóa API Anthropic Claude hoạt động chính xác! (Model: ${claudeModel})`,
          });
        }
        const errJson = await fetchRes.json().catch(() => ({}));
        return res.status(400).json({
          success: false,
          provider: 'claude',
          message: errJson.error?.message || `Xác thực Claude thất bại (Mã lỗi ${fetchRes.status})`,
        });
      } catch (cErr) {
        return res.status(400).json({
          success: false,
          provider: 'claude',
          message: `Lỗi kết nối tới máy chủ Anthropic: ${cErr.message}`,
        });
      }
    }

    // Google Gemini
    try {
      try {
        const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${cleanKey}`);
        if (listRes.ok) {
          const data = await listRes.json();
          const models = (data.models || [])
            .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
            .map((m) => (m.name || '').replace(/^models\//, ''))
            .filter((m) => (m || '').toLowerCase().startsWith('gemini'));
          const sorted =
            models.length > 0
              ? sortGeminiModelsNewestFirst(models)
              : ['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-1.5-flash'];
          const bestModel = sorted[0] || 'gemini-2.0-flash';
          return res.status(200).json({
            success: true,
            provider: 'gemini',
            model: bestModel,
            message: `Khóa API hoạt động chính xác với Google Gemini! (Mô hình: ${bestModel})`,
          });
        }
        if (listRes.status === 429) {
          return res.status(200).json({
            success: false,
            status: 'quota_exceeded',
            provider: 'gemini',
            message: 'Hết hạn mức yêu cầu (Quota 429) — Hệ thống sẽ tự động chuyển khóa dự phòng.',
          });
        }
        const errJson = await listRes.json().catch(() => ({}));
        const errMsg = errJson.error?.message || `Mã lỗi ${listRes.status}`;
        if (/API_KEY_INVALID|key not valid|PERMISSION_DENIED/i.test(errMsg)) {
          return res.status(400).json({
            success: false,
            provider: 'gemini',
            message: 'Khóa API không hợp lệ hoặc đã bị vô hiệu hóa trên Google AI Studio.',
          });
        }
      } catch (_) {}

      const fetchRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${cleanKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'OK' }] }],
            generationConfig: { maxOutputTokens: 5 },
          }),
        }
      );

      if (fetchRes.ok) {
        return res.status(200).json({
          success: true,
          provider: 'gemini',
          model: 'gemini-2.0-flash',
          message: 'Khóa API hoạt động chính xác với Google Gemini! (Model: gemini-2.0-flash)',
        });
      }
      if (fetchRes.status === 429) {
        return res.status(200).json({
          success: false,
          status: 'quota_exceeded',
          provider: 'gemini',
          message: 'Hết hạn mức yêu cầu (Quota 429) — Hệ thống sẽ tự động dùng khóa dự phòng.',
        });
      }
      const errJson = await fetchRes.json().catch(() => ({}));
      return res.status(400).json({
        success: false,
        provider: 'gemini',
        message: `Xác thực API Key Gemini thất bại: ${errJson.error?.message || `Mã lỗi ${fetchRes.status}`}`,
      });
    } catch (gErr) {
      return res.status(400).json({
        success: false,
        provider: 'gemini',
        message: `Lỗi kết nối tới máy chủ Google Gemini: ${gErr.message}`,
      });
    }
  }

  // POST /ai/extract-image-text
  if (pathname === '/ai/extract-image-text' && req.method === 'POST') {
    const parsed = extractImageTextSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return sendError(res, 400, 'ValidationError', parseZodError(parsed.error));
    }

    const { imageDataUrl, apiKeys, apiKey } = parsed.data;
    const uniqueKeys = await resolveCandidateKeys(req, { apiKeys, apiKey });
    if (uniqueKeys.length === 0) {
      return res.status(400).json({
        success: false,
        needsApiKey: true,
        message: 'Chưa cấu hình Gemini API Key. Vui lòng cài đặt khóa API trong Cài đặt → API Key.',
      });
    }

    const dataUrlMatch = imageDataUrl.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/s);
    if (!dataUrlMatch) {
      return sendError(res, 400, 'ValidationError', 'Định dạng ảnh không được hỗ trợ.');
    }
    const mimeType = dataUrlMatch[1];
    const base64Data = dataUrlMatch[2];

    const ocrPrompt =
      'Bạn là chuyên gia OCR văn bản chuyên nghiệp. Hãy trích xuất TOÀN BỘ nội dung chữ/văn bản xuất hiện trong hình ảnh một cách đầy đủ và chính xác 100%:\n- Nhận diện chính xác từng từ tiếng Việt có dấu, số hiệu, mã chứng từ (PO, SKU), ngày tháng, giờ giấc, tên riêng, email, số điện thoại.\n- Giữ nguyên trật tự trên-dưới, cấu trúc từng dòng, đoạn văn và các danh sách có đánh số.\n- Không tự ý tóm tắt, không sửa từ, không bỏ qua các dòng chữ nhỏ, chữ ký hay ghi chú ở cuối.\n- Nếu trong ảnh hoàn toàn không có bất kỳ ký tự chữ hay số nào, hãy trả về chính xác: [KHÔNG CÓ VĂN BẢN]\n- Chỉ trả về duy nhất nội dung văn bản thuần túy được trích xuất, tuyệt đối không thêm lời mở đầu hay giải thích.';

    let lastErr = null;
    for (let kIdx = 0; kIdx < uniqueKeys.length; kIdx++) {
      const k = uniqueKeys[kIdx];
      if (k.startsWith('sk-')) continue;

      const models = await discoverBestGeminiModels(k);
      for (const model of models) {
        for (const apiVer of ['v1beta', 'v1']) {
          try {
            const url = `https://generativelanguage.googleapis.com/${apiVer}/models/${model}:generateContent?key=${k}`;
            const fetchRes = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [
                  {
                    parts: [{ text: ocrPrompt }, { inlineData: { mimeType, data: base64Data } }],
                  },
                ],
                generationConfig: { temperature: 0.1 },
              }),
            });

            if (!fetchRes.ok) {
              const err = await fetchRes.json().catch(() => ({}));
              lastErr = err.error?.message || `HTTP ${fetchRes.status}`;
              continue;
            }

            const data = await fetchRes.json();
            const extracted = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
            return res.status(200).json({
              success: true,
              text: extracted === '[KHÔNG CÓ VĂN BẢN]' ? '' : extracted,
              noText: !extracted || extracted === '[KHÔNG CÓ VĂN BẢN]',
              model,
              usedKeyIndex: kIdx,
              fallbackKeyUsed: kIdx > 0,
            });
          } catch (err) {
            lastErr = err.message;
          }
        }
      }
    }

    return sendError(
      res,
      500,
      'AIProcessingError',
      `Không thể trích xuất nội dung: ${lastErr || 'Lỗi xử lý hình ảnh'}`
    );
  }

  // POST /ai/writing-tool
  if (pathname === '/ai/writing-tool' && req.method === 'POST') {
    const parsed = writingToolSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return sendError(res, 400, 'ValidationError', parseZodError(parsed.error));
    }

    const { text, action = 'proofread', apiKeys, apiKey } = parsed.data;
    const uniqueKeys = await resolveCandidateKeys(req, { apiKeys, apiKey });
    if (uniqueKeys.length === 0) {
      return res.status(400).json({
        success: false,
        needsApiKey: true,
        message: 'Chưa cấu hình API Key. Vui lòng cài đặt khóa API.',
      });
    }

    const prompt = `Xử lý văn bản sau (${action}): ${text}`;
    let lastErr = null;

    for (let kIdx = 0; kIdx < uniqueKeys.length; kIdx++) {
      const k = uniqueKeys[kIdx];
      try {
        if (k.startsWith('sk-')) {
          const dsRes = await fetch('https://api.deepseek.com/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${k}`,
            },
            body: JSON.stringify({
              model: 'deepseek-chat',
              messages: [
                { role: 'system', content: 'Bạn là trợ lý soạn thảo tiếng Việt. Chỉ trả về kết quả xử lý.' },
                { role: 'user', content: prompt },
              ],
              temperature: 0.2,
            }),
          });
          if (dsRes.ok) {
            const data = await dsRes.json();
            const result = data.choices?.[0]?.message?.content?.trim();
            if (result) {
              return res.status(200).json({
                success: true,
                result,
                model: 'deepseek-chat',
                usedKeyIndex: kIdx,
                fallbackKeyUsed: kIdx > 0,
              });
            }
          }
        } else {
          const gModels = await discoverBestGeminiModels(k);
          for (const gm of gModels) {
            for (const apiVer of ['v1beta', 'v1']) {
              try {
                const gRes = await fetch(
                  `https://generativelanguage.googleapis.com/${apiVer}/models/${gm}:generateContent?key=${k}`,
                  {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      contents: [{ parts: [{ text: prompt }] }],
                      generationConfig: { temperature: 0.2 },
                    }),
                  }
                );
                if (gRes.ok) {
                  const data = await gRes.json();
                  const result = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
                  if (result) {
                    return res.status(200).json({
                      success: true,
                      result,
                      model: gm,
                      usedKeyIndex: kIdx,
                      fallbackKeyUsed: kIdx > 0,
                    });
                  }
                }
              } catch (_) {}
            }
          }
        }
      } catch (err) {
        lastErr = err.message;
      }
    }

    return sendError(res, 500, 'AIProcessingError', lastErr || 'Lỗi xử lý văn bản');
  }

  // POST /ai/chat
  if (pathname === '/ai/chat' && req.method === 'POST') {
    const parsed = chatSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return sendError(res, 400, 'ValidationError', parseZodError(parsed.error));
    }

    const { message, conversationId, apiKeys, apiKey } = parsed.data;
    const uniqueKeys = await resolveCandidateKeys(req, { apiKeys, apiKey });
    const validKey = uniqueKeys.find(
      (k) => k.startsWith('AIzaSy') || k.startsWith('AQ.') || (!k.startsWith('sk-') && k.length >= 20)
    );

    if (!validKey) {
      return res.status(200).json({
        success: true,
        response:
          '⚠️ **Chưa cấu hình Gemini API Key**\n\nĐể kích hoạt Trợ lý AI Copilot phân tích dữ liệu tự động, vui lòng vào mục **Cài đặt hệ thống** (/settings) và nhập Gemini API Key của bạn.',
      });
    }

    const chatModels = await discoverBestGeminiModels(validKey);
    for (const chatModel of chatModels) {
      for (const apiVer of ['v1beta', 'v1']) {
        try {
          const url = `https://generativelanguage.googleapis.com/${apiVer}/models/${chatModel}:generateContent?key=${validKey}`;
          const chatRes = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: message }] }],
              systemInstruction: {
                parts: [
                  {
                    text: 'Bạn là Trợ lý AI Cấp cao chuyên trách Thu mua & Merchandising cho Farmers Market (Việt Nam). Hãy trả lời súc tích, chuyên nghiệp bằng tiếng Việt.',
                  },
                ],
              },
            }),
          });
          if (chatRes.ok) {
            const chatData = await chatRes.json();
            const replyText = chatData.candidates?.[0]?.content?.parts?.[0]?.text || 'Không có phản hồi.';
            return res.status(200).json({
              success: true,
              response: replyText,
              conversationId: conversationId || `conv_${Date.now()}`,
            });
          }
        } catch (_) {}
      }
    }

    return sendError(res, 500, 'AIProcessingError', 'Không thể kết nối đến Gemini AI với các mô hình hiện có.');
  }

  return sendError(res, 404, 'NotFound', `Endpoint ${pathname} không tồn tại`);
}

module.exports = { handleAiRoute };
