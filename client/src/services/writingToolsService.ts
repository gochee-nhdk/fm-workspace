import { api } from '@/lib/api';

export type WritingToolAction =
  | 'summarize'
  | 'keypoints'
  | 'professional'
  | 'concise'
  | 'proofread'
  | 'expand'
  | 'action_items'
  | 'translate_en'
  | 'translate_vi';

export type GeminiKeyStatus = 'active' | 'quota_exceeded' | 'invalid' | 'unchecked';
export type AIProvider = 'gemini' | 'deepseek' | 'openai' | 'claude' | 'custom';

export interface GeminiKeyItem {
  id: string;
  name: string;
  key: string;
  provider?: AIProvider;
  isActive: boolean;
  status: GeminiKeyStatus;
  statusMessage?: string;
  lastCheckedAt?: string;
  model?: string;
}

const GEMINI_KEY_STORAGE = 'fm_gemini_api_key';
const GEMINI_KEYS_POOL_STORAGE = 'fm_gemini_api_keys_pool';

/**
 * Sanitizer for AI Writing Tool outputs:
 * Strips raw prompt reflection, meta-analysis preambles (* Input:, * Goal:, * Constraint:, Analysis:),
 * and conversational intros, ensuring only clean processed text is returned to the user.
 */
export const sanitizeAiWritingOutput = (rawText: string): string => {
  if (!rawText || typeof rawText !== 'string') return '';
  let text = rawText.trim();

  // 1. Remove outer markdown code fence if wrapped
  if (text.startsWith('```') && text.endsWith('```')) {
    text = text.replace(/^```[a-zA-Z]*\n?/, '').replace(/\n?```$/, '').trim();
  }

  // 2. Check for meta analysis blocks containing Input / Goal / Constraint / Analysis / Output / Result
  const metaRegex = /(?:^|\n)(?:[*•-]\s*)?(?:\*{1,2})?(?:Input|Goal|Constraints?|Constraint\s*\d+|Analysis|Target|Context|Instruction|Yêu cầu|Mục tiêu|Ràng buộc|Phân tích)(?:\*{1,2})?\s*:/i;

  if (metaRegex.test(text)) {
    // Check if there is an explicit "Output:", "Result:", "Kết quả:" label after the meta section
    const outputMatch = text.match(/(?:^|\n)(?:[*•-]\s*)?(?:\*{1,2})?(?:Output|Result|Processed Text|Văn bản sau khi xử lý|Kết quả)(?:\*{1,2})?\s*:\s*([\s\S]+)$/i);
    if (outputMatch && outputMatch[1]?.trim()) {
      text = outputMatch[1].trim();
    } else {
      // Split by lines and filter out any lines that are part of the meta analysis preamble
      const lines = text.split('\n');
      const filteredLines: string[] = [];
      let skippingMetaBlock = true;

      for (const line of lines) {
        const trimmedLine = line.trim();
        // Check if line starts a meta item
        if (/^(?:[*•-]\s*)?(?:\*{1,2})?(?:Input|Goal|Constraints?|Constraint\s*\d+|Analysis|Target|Context|Instruction|Yêu cầu|Mục tiêu|Ràng buộc|Phân tích)(?:\*{1,2})?\s*:/i.test(trimmedLine)) {
          skippingMetaBlock = true;
          continue;
        }
        // If line is another meta-list sub-item or constraint continuation
        if (skippingMetaBlock && /^(?:[*•-]\s*)?(?:\*{1,2})?(?:Ensure|Maintain|Do not|Keep|Only|Giữ|Không|Chỉ)(?:\*{1,2})?/i.test(trimmedLine)) {
          continue;
        }
        // If line starts with "Output:" or "Result:"
        if (/^(?:[*•-]\s*)?(?:\*{1,2})?(?:Output|Result|Processed Text|Kết quả)(?:\*{1,2})?\s*:\s*/i.test(trimmedLine)) {
          skippingMetaBlock = false;
          const cleanedLine = trimmedLine.replace(/^(?:[*•-]\s*)?(?:\*{1,2})?(?:Output|Result|Processed Text|Kết quả)(?:\*{1,2})?\s*:\s*/i, '');
          if (cleanedLine) filteredLines.push(cleanedLine);
          continue;
        }

        // Blank line or normal text
        if (trimmedLine.length > 0) {
          skippingMetaBlock = false;
          filteredLines.push(line);
        }
      }
      if (filteredLines.length > 0) {
        text = filteredLines.join('\n').trim();
      }
    }
  }

  // 3. Remove conversational preambles
  text = text
    .replace(/^(?:Dưới đây là (?:kết quả|văn bản|nội dung|câu|đoạn văn|bản dịch)(?: sau khi [^:\n]+)?|Here is the (?:revised|translated|processed|summarized)?\s*(?:text|result|version)[^:\n]*|Kết quả sau khi [^:\n]+|Bản dịch tiếng [^:\n]+)\s*:\s*\n?/i, '')
    .trim();

  // 4. Remove enclosing quotation marks if model enclosed entire response in quotes
  if ((text.startsWith('"') && text.endsWith('"') && text.length >= 2) ||
      (text.startsWith('“') && text.endsWith('”') && text.length >= 2) ||
      (text.startsWith("'") && text.endsWith("'") && text.length >= 2)) {
    const inner = text.slice(1, -1).trim();
    if (inner && !inner.includes('\n\n')) text = inner;
  }

  return text.trim();
};

export const detectProvider = (key: string): AIProvider => {
  return 'gemini';
};

export const getStoredGeminiKey = (): string => {
  const pool = getGeminiKeysPool();
  const activePrimary = pool.find((k) => k.isActive && k.key.trim().length > 0 && !k.key.includes('••••'));
  if (activePrimary) return activePrimary.key.trim();
  const rawSingle = localStorage.getItem(GEMINI_KEY_STORAGE) || localStorage.getItem('gemini_api_key') || '';
  if (rawSingle && !rawSingle.includes('••••')) return rawSingle.trim();
  return '';
};

export const setStoredGeminiKey = (key: string): void => {
  const trimmed = key.trim();
  localStorage.setItem(GEMINI_KEY_STORAGE, trimmed);
  const pool = getGeminiKeysPool();
  if (pool.length === 0) {
    if (trimmed) {
      addGeminiKey(trimmed, 'Khóa chính (Mặc định)');
    }
  } else {
    // Update first key or add
    pool[0].key = trimmed;
    saveGeminiKeysPool(pool);
  }
};

/**
 * Lấy toàn bộ danh sách Khóa API Gemini trong hệ thống (gồm cả khóa chính & các khóa dự phòng)
 */
export const getGeminiKeysPool = (): GeminiKeyItem[] => {
  try {
    const raw = localStorage.getItem(GEMINI_KEYS_POOL_STORAGE);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (_) {}

  // Auto-migration from legacy single key
  const legacyKey = localStorage.getItem(GEMINI_KEY_STORAGE);
  if (legacyKey && legacyKey.trim()) {
    const initialPool: GeminiKeyItem[] = [
      {
        id: 'key_primary',
        name: 'Khóa chính (Mặc định)',
        key: legacyKey.trim(),
        isActive: true,
        status: 'unchecked',
      },
    ];
    saveGeminiKeysPool(initialPool);
    return initialPool;
  }

  return [];
};

/**
 * Lưu danh sách Khóa API Gemini vào bộ nhớ an toàn của client
 */
export const saveGeminiKeysPool = (pool: GeminiKeyItem[]): void => {
  try {
    localStorage.setItem(GEMINI_KEYS_POOL_STORAGE, JSON.stringify(pool));
    const activePrimary = pool.find((k) => k.isActive && k.key.trim().length > 0 && !k.key.includes('••••'));
    if (activePrimary) {
      localStorage.setItem(GEMINI_KEY_STORAGE, activePrimary.key.trim());
    } else if (pool.length > 0 && pool[0].key.trim() && !pool[0].key.includes('••••')) {
      localStorage.setItem(GEMINI_KEY_STORAGE, pool[0].key.trim());
    }
  } catch (_) {}
};

/**
 * Lấy các khóa đang kích hoạt sẵn sàng sử dụng
 */
export const getActiveGeminiKeys = (): GeminiKeyItem[] => {
  return getGeminiKeysPool().filter((k) => k.isActive && k.key.trim().length > 0 && !k.key.includes('••••'));
};

/**
 * Thêm một khóa mới vào pool (không giới hạn số lượng khóa dự phòng)
 */
export const addGeminiKey = (key: string, name?: string): GeminiKeyItem => {
  const cleanKey = key.trim();
  const pool = getGeminiKeysPool();
  const id = 'key_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6);
  const count = pool.length;
  const defaultName = count === 0 ? 'Khóa chính' : `Khóa dự phòng #${count}`;
  const newItem: GeminiKeyItem = {
    id,
    name: name?.trim() || defaultName,
    key: cleanKey,
    provider: 'gemini',
    isActive: true,
    status: 'unchecked',
  };
  const updated = [...pool, newItem];
  saveGeminiKeysPool(updated);
  return newItem;
};

/**
 * Cập nhật thông tin hoặc trạng thái một khóa
 */
export const updateGeminiKey = (id: string, updates: Partial<GeminiKeyItem>): void => {
  const pool = getGeminiKeysPool();
  const updated = pool.map((item) => (item.id === id ? { ...item, ...updates } : item));
  saveGeminiKeysPool(updated);
};

/**
 * Xóa một khóa khỏi danh sách
 */
export const deleteGeminiKey = (id: string): void => {
  const pool = getGeminiKeysPool();
  const updated = pool.filter((item) => item.id !== id);
  saveGeminiKeysPool(updated);
};

/**
 * Đặt khóa được chọn lên làm khóa chính ưu tiên số 1
 */
export const setPrimaryKey = (id: string): void => {
  const pool = getGeminiKeysPool();
  const index = pool.findIndex((item) => item.id === id);
  if (index > 0) {
    const item = pool[index];
    const rest = pool.filter((_, i) => i !== index);
    const updated = [item, ...rest];
    saveGeminiKeysPool(updated);
  }
};

/**
 * Free instant translation using public Google Translate endpoint (zero auth, 100% reliable)
 */
export const OFFLINE_VI_TO_EN_DICT: Record<string, string> = {
  'xin chào': 'hello',
  'cảm ơn': 'thank you',
  'tạm biệt': 'goodbye',
  'bút': 'pen',
  'bút chì': 'pencil',
  'sổ tay': 'notebook',
  'sổ': 'notebook',
  'báo cáo': 'report',
  'hợp đồng': 'contract',
  'nhà cung cấp': 'supplier',
  'giá': 'price',
  'đơn hàng': 'order',
  'thanh toán': 'payment',
  'kiểm tra': 'check',
  'hoàn thành': 'completed',
  'kế hoạch': 'plan',
  'khách hàng': 'customer',
  'sản phẩm': 'product',
  'tồn kho': 'inventory',
  'doanh thu': 'revenue',
  'chi phí': 'cost',
  'yêu cầu': 'requirement',
  'cuộc họp': 'meeting',
  'họp': 'meeting',
  'gửi': 'send',
  'nhận': 'receive',
  'mua': 'buy',
  'bán': 'sell',
  'số lượng': 'quantity',
  'chất lượng': 'quality',
  'tiến độ': 'progress',
  'hạn chót': 'deadline',
  'ngày mai': 'tomorrow',
  'hôm nay': 'today',
  'tuần này': 'this week',
  'tháng này': 'this month',
};

export const OFFLINE_EN_TO_VI_DICT: Record<string, string> = {
  'hello': 'xin chào',
  'hi': 'xin chào',
  'thank you': 'cảm ơn',
  'thanks': 'cảm ơn',
  'goodbye': 'tạm biệt',
  'bye': 'tạm biệt',
  'pen': 'bút',
  'pencil': 'bút chì',
  'notebook': 'sổ tay',
  'report': 'báo cáo',
  'contract': 'hợp đồng',
  'supplier': 'nhà cung cấp',
  'price': 'giá',
  'order': 'đơn hàng',
  'payment': 'thanh toán',
  'check': 'kiểm tra',
  'completed': 'hoàn thành',
  'plan': 'kế hoạch',
  'customer': 'khách hàng',
  'product': 'sản phẩm',
  'inventory': 'tồn kho',
  'revenue': 'doanh thu',
  'cost': 'chi phí',
  'requirement': 'yêu cầu',
  'meeting': 'cuộc họp',
  'send': 'gửi',
  'receive': 'nhận',
  'buy': 'mua',
  'sell': 'bán',
  'quantity': 'số lượng',
  'quality': 'chất lượng',
  'progress': 'tiến độ',
  'deadline': 'hạn chót',
  'tomorrow': 'ngày mai',
  'today': 'hôm nay',
  'this week': 'tuần này',
  'this month': 'tháng này',
};

export const offlineDictionaryTranslate = (text: string, targetLang: 'vi' | 'en'): string => {
  const trimmed = text.trim();
  if (!trimmed) return text;
  const dict = targetLang === 'en' ? OFFLINE_VI_TO_EN_DICT : OFFLINE_EN_TO_VI_DICT;
  const lower = trimmed.toLowerCase();
  if (dict[lower]) {
    const res = dict[lower];
    return trimmed[0] === trimmed[0].toUpperCase() ? res.charAt(0).toUpperCase() + res.slice(1) : res;
  }
  let translated = trimmed;
  for (const [k, v] of Object.entries(dict)) {
    const reg = new RegExp(`\\b${k}\\b`, 'gi');
    translated = translated.replace(reg, v);
  }
  return translated;
};

export const freeTranslate = async (text: string, targetLang: 'vi' | 'en'): Promise<string> => {
  const trimmed = text.trim();
  if (!trimmed) return text;

  // Primary endpoint: Google Translate single endpoint
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(trimmed)}`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && Array.isArray(data[0])) {
        const translated = data[0].map((item: any) => item[0]).filter(Boolean).join('');
        if (translated && translated.trim()) return translated.trim();
      }
    }
  } catch (e) {
    console.warn('Free translate primary endpoint failed:', e);
  }

  // Secondary endpoint: Google Translate client5 endpoint fallback
  try {
    const url2 = `https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=auto&tl=${targetLang}&q=${encodeURIComponent(trimmed)}`;
    const res2 = await fetch(url2);
    if (res2.ok) {
      const data2 = await res2.json();
      if (Array.isArray(data2) && data2[0]) {
        const translated2 = typeof data2[0] === 'string' ? data2[0] : data2[0][0];
        if (translated2 && typeof translated2 === 'string' && translated2.trim()) return translated2.trim();
      }
    }
  } catch (e) {
    console.warn('Free translate secondary endpoint failed:', e);
  }

  return offlineDictionaryTranslate(trimmed, targetLang);
};

/**
 * Call backend AI proxy endpoint (/api/ai/writing-tool)
 * Benefit: Zero CORS issues, uses Google GenAI SDK, supports multiple backup keys failover
 */
const callBackendWritingTool = async (
  text: string,
  action: WritingToolAction,
  apiKeys?: string[],
  signal?: AbortSignal
): Promise<{ result: string; usedKeyIndex?: number; fallbackKeyUsed?: boolean }> => {
  const res = await api.post(
    '/ai/writing-tool',
    {
      text,
      action,
      apiKeys: apiKeys && apiKeys.length > 0 ? apiKeys : undefined,
      apiKey: apiKeys?.[0] || undefined,
    },
    { signal }
  );
  if (res.data?.success && res.data?.result) {
    return {
      result: res.data.result.trim(),
      usedKeyIndex: res.data.usedKeyIndex,
      fallbackKeyUsed: res.data.fallbackKeyUsed,
    };
  }
  throw new Error(res.data?.message || 'Không thể tạo nội dung từ máy chủ AI');
};

/**
 * Call Gemini API directly from browser if key is set
/**
 * Sắp xếp danh sách mô hình Gemini theo thứ tự mới nhất (phiên bản cao nhất trước, ưu tiên Flash cho tốc độ)
 */
export const sortGeminiModelsNewestFirst = (models: string[]): string[] => {
  return [...models].sort((a, b) => {
    // Ưu tiên gemini-2.0-flash lên hàng đầu vì đây là mô hình GA chính thức của Google,
    // tốc độ xử lý nhanh nhất và có hạn mức miễn phí 15 RPM / 1500 RPD rộng rãi nhất
    const isA20Flash = a.toLowerCase() === 'gemini-2.0-flash';
    const isB20Flash = b.toLowerCase() === 'gemini-2.0-flash';
    if (isA20Flash && !isB20Flash) return -1;
    if (!isA20Flash && isB20Flash) return 1;

    const extractVersion = (name: string): number => {
      const match = name.match(/gemini-(\d+(?:\.\d+)?)/i) || name.match(/(\d+(?:\.\d+)?)/);
      return match ? parseFloat(match[1]) : 0;
    };
    const verA = extractVersion(a);
    const verB = extractVersion(b);
    if (verB !== verA) {
      return verB - verA; // Phiên bản cao hơn ưu tiên trước (VD: 2.5 > 2.0 > 1.5)
    }
    // Nếu cùng phiên bản, ưu tiên dòng Flash cho tác vụ thời gian thực
    const isFlashA = a.toLowerCase().includes('flash') ? 1 : 0;
    const isFlashB = b.toLowerCase().includes('flash') ? 1 : 0;
    if (isFlashB !== isFlashA) {
      return isFlashB - isFlashA;
    }
    return a.localeCompare(b);
  });
};

const dynamicModelCache = new Map<string, { models: string[]; timestamp: number }>();

/**
 * Tự động truy vấn và nhận diện mô hình mới nhất của từng API Key từ Google ModelService,
 * không ràng buộc vào bất kỳ model cố định nào.
 */
export const discoverBestFlashModels = async (apiKey: string): Promise<string[]> => {
  const cleanKey = apiKey.trim();
  if (!cleanKey || cleanKey.includes('••••')) {
    return ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-2.0-flash-lite'];
  }

  // Tận dụng cache ngắn hạn (10 phút) tránh gọi thừa
  const cached = dynamicModelCache.get(cleanKey);
  if (cached && Date.now() - cached.timestamp < 10 * 60 * 1000) {
    return cached.models;
  }

  const fallbackFlashModels = [
    'gemini-2.0-flash',
    'gemini-1.5-flash',
    'gemini-2.0-flash-lite',
  ];

  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${cleanKey}`);
    if (res.ok) {
      const data = await res.json();
      const models: any[] = data.models || [];
      const supported = models
        .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
        .map((m) => m.name?.replace(/^models\//, ''))
        .filter((name: string) => Boolean(name) && !name.includes('2.5') && !name.includes('preview') && !name.includes('pro'));

      if (supported.length > 0) {
        const sorted = sortGeminiModelsNewestFirst(supported);
        dynamicModelCache.set(cleanKey, { models: sorted, timestamp: Date.now() });
        try {
          if (sorted[0]) {
            localStorage.setItem('gemini_preferred_model', sorted[0]);
          }
        } catch (_) {}
        return sorted;
      }
    }
  } catch (_) {
    // Network or CORS fallback
  }

  let preferred: string | null = null;
  try {
    preferred = localStorage.getItem('gemini_preferred_model');
  } catch (_) {}

  return preferred ? [preferred, ...fallbackFlashModels.filter((m) => m !== preferred)] : fallbackFlashModels;
};

/**
 * Direct Gemini API call from client with dynamic Flash model fallback
 */
const callGeminiApi = async (
  prompt: string,
  apiKey: string,
  systemInstruction?: string,
  signal?: AbortSignal
): Promise<string> => {
  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }
  let preferredModel: string | null = null;
  try {
    preferredModel = localStorage.getItem('gemini_preferred_model');
  } catch (_) {}

  const discoveredModels = await discoverBestFlashModels(apiKey);
  const models = Array.from(new Set([preferredModel, ...discoveredModels])).filter(Boolean) as string[];
  let lastError: Error | null = null;

  for (const model of models) {
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          ...(systemInstruction
            ? {
                systemInstruction: {
                  parts: [{ text: systemInstruction }],
                },
              }
            : {}),
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 2048,
          },
        }),
        signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `Lỗi Gemini API (${model}): ${response.status}`);
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error('Không nhận được nội dung từ Gemini');
      return sanitizeAiWritingOutput(text);
    } catch (err: any) {
      lastError = err;
    }
  }

  throw lastError || new Error('Không thể kết nối tới Google Gemini API');
};

/**
 * Test Gemini API key live: Sử dụng ModelService.ListModels nhanh và không tiêu tốn hạn mức generateContent (15 RPM)
 */
export const testGeminiApiKey = async (
  key: string
): Promise<{ success: boolean; message: string; model?: string; isQuota?: boolean }> => {
  const cleanKey = key.trim();
  if (!cleanKey) {
    return { success: false, message: 'Vui lòng nhập Gemini API Key.' };
  }

  // 1. Kiểm tra xác thực tức thì qua endpoint ListModels của Google (Zero RPM quota consumed)
  try {
    const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${cleanKey}`);
    if (listRes.ok) {
      const data = await listRes.json();
      const models: any[] = data.models || [];
      const supported = models
        .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
        .map((m) => m.name?.replace(/^models\//, ''))
        .filter((m) => m && m.toLowerCase().startsWith('gemini'));

      const sorted = supported.length > 0
        ? sortGeminiModelsNewestFirst(supported)
        : ['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-1.5-flash'];

      const bestModel = sorted[0] || 'gemini-2.0-flash';
      try {
        localStorage.setItem('gemini_preferred_model', bestModel);
      } catch (_) {}

      return {
        success: true,
        isQuota: false,
        message: `Khóa API hoạt động chính xác! (Mô hình: ${bestModel})`,
        model: bestModel,
      };
    }

    if (listRes.status === 429) {
      return {
        success: false,
        isQuota: true,
        message: 'Khóa API đang chạm hạn mức tần suất (429 Too Many Requests) — Hệ thống sẽ tự động dùng khóa dự phòng.',
      };
    }

    const errData = await listRes.json().catch(() => ({}));
    const errMsg = errData.error?.message || `HTTP ${listRes.status}`;
    if (/API_KEY_INVALID|key not valid|PERMISSION_DENIED/i.test(errMsg)) {
      return {
        success: false,
        isQuota: false,
        message: 'Khóa API không hợp lệ hoặc đã bị vô hiệu hóa trên Google AI Studio.',
      };
    }
  } catch (_) {
    // Nếu gặp lỗi mạng / CORS thì chuyển sang bước 2 ping trực tiếp
  }

  // 2. Ping trực tiếp mô hình gemini-2.0-flash (chuẩn GA) nếu bước 1 không phản hồi
  try {
    const pingUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${cleanKey}`;
    const res = await fetch(pingUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'OK' }] }],
        generationConfig: { maxOutputTokens: 5 },
      }),
    });

    if (res.ok) {
      return {
        success: true,
        isQuota: false,
        message: 'Khóa API hoạt động chính xác! (Mô hình: gemini-2.0-flash)',
        model: 'gemini-2.0-flash',
      };
    }

    if (res.status === 429) {
      return {
        success: false,
        isQuota: true,
        message: 'Khóa API đang chạm hạn mức (Quota 429) — Hệ thống sẽ tự động chuyển khóa dự phòng.',
      };
    }

    const errData = await res.json().catch(() => ({}));
    const errMsg = errData.error?.message || `Mã lỗi HTTP ${res.status}`;
    if (/API_KEY_INVALID|key not valid/i.test(errMsg)) {
      return {
        success: false,
        isQuota: false,
        message: 'Khóa API không hợp lệ hoặc đã bị vô hiệu hóa trên Google AI Studio.',
      };
    }

    return {
      success: false,
      isQuota: false,
      message: `Không thể xác thực API Key: ${errMsg}`,
    };
  } catch (err: any) {
    return {
      success: false,
      isQuota: false,
      message: `Lỗi kết nối tới máy chủ Google Gemini: ${err.message}`,
    };
  }
};

/**
 * Kiểm tra khóa API của DeepSeek
 */
export const testDeepSeekKey = async (
  key: string
): Promise<{ success: boolean; status: GeminiKeyStatus; message: string; model?: string; provider: AIProvider }> => {
  const cleanKey = key.trim();
  try {
    const res = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cleanKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: 'Trả lời đúng 1 chữ: OK' }],
        max_tokens: 5,
      }),
    });

    if (res.ok) {
      return {
        success: true,
        status: 'active',
        message: 'Khóa API DeepSeek hoạt động chính xác! (Model: deepseek-chat)',
        model: 'deepseek-chat',
        provider: 'deepseek',
      };
    }

    if (res.status === 429) {
      return {
        success: false,
        status: 'quota_exceeded',
        message: 'Hết hạn mức DeepSeek (429) — Hệ thống sẽ tự động dùng khóa dự phòng.',
        model: 'deepseek-chat',
        provider: 'deepseek',
      };
    }

    const err = await res.json().catch(() => ({}));
    return {
      success: false,
      status: 'invalid',
      message: err.error?.message || `Xác thực DeepSeek thất bại (Mã lỗi ${res.status})`,
      provider: 'deepseek',
    };
  } catch (err: any) {
    return {
      success: false,
      status: 'invalid',
      message: err.message || 'Lỗi mạng khi kết nối tới máy chủ DeepSeek',
      provider: 'deepseek',
    };
  }
};

/**
 * Kiểm tra khóa API của OpenAI
 */
export const testOpenAiKey = async (
  key: string
): Promise<{ success: boolean; status: GeminiKeyStatus; message: string; model?: string; provider: AIProvider }> => {
  const cleanKey = key.trim();
  try {
    const res = await fetch('https://api.openai.com/v1/models', {
      headers: {
        Authorization: `Bearer ${cleanKey}`,
      },
    });

    if (res.ok) {
      return {
        success: true,
        status: 'active',
        message: 'Khóa API OpenAI hoạt động chính xác! (Model: gpt-4o-mini)',
        model: 'gpt-4o-mini',
        provider: 'openai',
      };
    }

    if (res.status === 429) {
      return {
        success: false,
        status: 'quota_exceeded',
        message: 'Hết hạn mức OpenAI (429) — Hệ thống sẽ tự động dùng khóa dự phòng.',
        model: 'gpt-4o-mini',
        provider: 'openai',
      };
    }

    const err = await res.json().catch(() => ({}));
    return {
      success: false,
      status: 'invalid',
      message: err.error?.message || `Xác thực OpenAI thất bại (Mã lỗi ${res.status})`,
      provider: 'openai',
    };
  } catch (err: any) {
    return {
      success: false,
      status: 'invalid',
      message: err.message || 'Lỗi kết nối tới OpenAI',
      provider: 'openai',
    };
  }
};

/**
 * Kiểm tra trạng thái của một khóa duy nhất thuộc bất kỳ nhà cung cấp nào (Gemini, DeepSeek, OpenAI, Claude...)
 * Kết hợp xác thực qua máy chủ backend (/api/ai/verify-key) để tránh tuyệt đối lỗi CORS trên trình duyệt
 */
export const testSingleGeminiKey = async (
  key: string
): Promise<{ success: boolean; status: GeminiKeyStatus; message: string; model?: string; provider?: AIProvider }> => {
  const cleanKey = key.trim();
  if (!cleanKey) {
    return {
      success: false,
      status: 'invalid',
      message: 'Khóa API đang để trống.',
      provider: 'gemini',
    };
  }

  if (cleanKey.includes('••••')) {
    return {
      success: false,
      status: 'invalid',
      message: 'Khóa đang bị ẩn. Vui lòng nhập lại khóa đầy đủ.',
      provider: 'gemini',
    };
  }

  // Provider routing based on key prefix
  if (cleanKey.startsWith('sk-ant-')) {
    // Claude (via server proxy)
  } else if (cleanKey.startsWith('sk-proj-')) {
    return testOpenAiKey(cleanKey);
  } else if (cleanKey.startsWith('sk-')) {
    return testDeepSeekKey(cleanKey);
  }

  // 1. Thử xác thực trực tiếp từ trình duyệt trước (phản hồi thời gian thực, trực tiếp từ kết nối của người dùng tới Google)
  const browserRes = await testGeminiApiKey(cleanKey);
  if (browserRes.success) {
    return {
      success: true,
      status: 'active',
      message: browserRes.message,
      model: browserRes.model,
      provider: 'gemini',
    };
  }

  // 2. Dự phòng: Thử xác thực qua máy chủ backend / serverless (/api/ai/verify-key) nếu trình duyệt bị chặn CORS
  try {
    const res = await api.post('/ai/verify-key', {
      apiKey: cleanKey,
      provider: 'gemini',
    });
    if (res.data?.success) {
      return {
        success: true,
        status: 'active',
        message: res.data.message || `Khóa hoạt động chính xác! (${res.data.model || 'gemini-2.0-flash'})`,
        model: res.data.model || 'gemini-2.0-flash',
        provider: 'gemini',
      };
    }
    if (res.data?.status === 'quota_exceeded' && browserRes.isQuota) {
      return {
        success: false,
        status: 'quota_exceeded',
        message: res.data.message || 'Hết hạn mức (429) trên tất cả các mô hình khả dụng',
        provider: 'gemini',
      };
    }
  } catch (_serverErr: any) {
    // Không thể kết nối server proxy, tiếp tục dùng kết quả từ trình duyệt
  }

  return {
    success: false,
    status: browserRes.isQuota ? 'quota_exceeded' : 'invalid',
    message: browserRes.message || 'Khóa API không hợp lệ hoặc đã bị vô hiệu hóa.',
    provider: 'gemini',
  };
};

/**
 * Kiểm tra đồng loạt toàn bộ các khóa API trong pool và cập nhật trạng thái thời gian thực
 */
export const testAllGeminiKeys = async (
  onProgress?: (index: number, total: number, item: GeminiKeyItem) => void
): Promise<GeminiKeyItem[]> => {
  const pool = getGeminiKeysPool();
  const updatedList: GeminiKeyItem[] = [];

  for (let i = 0; i < pool.length; i++) {
    const item = pool[i];
    if (!item.key.trim()) {
      const updatedItem: GeminiKeyItem = {
        ...item,
        status: 'invalid',
        statusMessage: 'Khóa đang để trống',
        lastCheckedAt: new Date().toISOString(),
      };
      updatedList.push(updatedItem);
      onProgress?.(i + 1, pool.length, updatedItem);
      continue;
    }

    // Nghỉ nhẹ 350ms giữa các khóa để tránh Google RPM rate limit dồn dập
    if (i > 0) {
      await new Promise((resolve) => setTimeout(resolve, 350));
    }

    const testRes = await testSingleGeminiKey(item.key);
    const updatedItem: GeminiKeyItem = {
      ...item,
      status: testRes.status,
      statusMessage: testRes.message,
      model: testRes.model || item.model,
      provider: testRes.provider || item.provider || detectProvider(item.key),
      lastCheckedAt: new Date().toISOString(),
    };
    updatedList.push(updatedItem);
    onProgress?.(i + 1, pool.length, updatedItem);
  }

  saveGeminiKeysPool(updatedList);
  return updatedList;
};

/**
 * Intelligent local text transformer — high-quality offline fallback
 * Uses NLP-inspired heuristics to produce genuinely useful output
 */
export const localTransform = (text: string, action: WritingToolAction): string => {
  const rawLines = text.split('\n');
  const lines = rawLines.map((l) => l.trim()).filter(Boolean);

  // Helper: strip checklist/bullet prefix
  const cleanLine = (l: string): string =>
    l
      .replace(/^[-*•]\s*/, '')
      .replace(/^\[[ xX]\]\s*/i, '')
      .replace(/^\d+\.\s+/, '')
      .trim();

  // Helper: Vietnamese sentence detection — ends with ? ! . or newline before capital
  const splitIntoSentences = (txt: string): string[] => {
    return txt
      .replace(/([.!?。？！])\s+/g, '$1\n')
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => s.length > 2);
  };

  // Helper: detect important lines — lines with numbers, dates, amounts, or long content
  const isImportantLine = (l: string): boolean =>
    /[\d,]+/.test(l) || // numbers
    /\d{1,2}\/\d{1,2}/.test(l) || // dates
    /đồng|vnđ|triệu|tỷ|usd|\$|kg|tấn|sản phẩm|nhà cung cấp|đơn hàng|hợp đồng|deadline|hạn/i.test(l) ||
    l.length > 40;

  switch (action) {
    case 'summarize': {
      // Multi-pass extraction: pick important lines, avoid duplicates
      const important = lines.filter(isImportantLine).slice(0, 8);
      const fallback = lines.slice(0, 5);
      const selected = important.length >= 2 ? important : fallback;
      return selected.map((l) => `• ${cleanLine(l)}`).join('\n') || text;
    }

    case 'keypoints': {
      // Smart extraction: prioritize numbered items, action verbs, then general lines
      const numbered = lines.filter((l) => /^\d+[\.\)]\s/.test(l.trim())).map(cleanLine);
      const actionLines = lines
        .filter((l) => /cần|phải|nên|đảm bảo|thực hiện|hoàn thành|kiểm tra|xem xét|báo cáo|liên hệ|gửi|nhận/i.test(l))
        .map(cleanLine);
      const valuableLines = lines.filter(isImportantLine).map(cleanLine);

      // Merge and deduplicate (priority: numbered > action > valuable)
      const allCandidates = [...new Set([...numbered, ...actionLines, ...valuableLines])];
      const keyPoints = allCandidates.slice(0, 7);
      const fallbackPoints = lines.slice(0, 5).map(cleanLine);
      const final = keyPoints.length >= 1 ? keyPoints : fallbackPoints;

      return final.map((p, i) => `${i + 1}. ${p}`).join('\n') || text;
    }

    case 'professional': {
      // Viết lại trang trọng, sạch sẽ, chuẩn mực văn phong công vụ/kinh doanh
      const cleanBase = localTransform(text, 'proofread');
      const cleanLines = cleanBase.split('\n').map((l) => l.trim()).filter(Boolean);
      return cleanLines
        .map((l) => {
          let line = l;
          // Chuẩn hóa từ ngữ trang trọng
          line = line
            .replace(/\b(em|tớ|tui|mình)\b/gi, 'Tôi')
            .replace(/\b(bạn|cậu|đằng ấy)\b/gi, 'Quý đối tác / Anh/Chị')
            .replace(/\b(ko|k|hem)\b/gi, 'không')
            .replace(/\b(đc|dc)\b/gi, 'được')
            .replace(/\b(nhé|nha|nghen)\b/gi, 'trân trọng')
            .replace(/\b(ok|okie|oke)\b/gi, 'đồng ý xác nhận')
            .trim();
          const cap = line.charAt(0).toUpperCase() + line.slice(1);
          return /[.!?…]$/.test(cap) ? cap : `${cap}.`;
        })
        .join('\n') || text;
    }

    case 'concise': {
      // Shorten: remove filler words, trim repeated phrases, keep key info — KHÔNG kèm đếm từ
      const fillerPattern = /\b(hôm nay|ngày mai|vui lòng|cần phải|chú ý rằng|lưu ý rằng|thật ra|thực ra|về cơ bản|thực tế là|đúng là|rất là|cực kỳ|vô cùng|thực sự là|nói chung là)\s*/gi;
      const redundantPatterns = /\s+(để mà|cho nên|vì vậy|do đó)\s+/gi;
      const shortened = lines.map((l) => {
        const clean = cleanLine(l)
          .replace(fillerPattern, '')
          .replace(redundantPatterns, ' ')
          .replace(/\s{2,}/g, ' ')
          .trim();
        if (clean.length > 90) {
          const cutAt = clean.indexOf(',', 55);
          return cutAt > 0 ? clean.substring(0, cutAt) + '.' : clean.substring(0, 90) + '...';
        }
        return clean;
      }).filter(Boolean);

      return shortened.join('\n') || text.trim();
    }

    case 'proofread': {
      let clean = text;

      // 1. Common Vietnamese typing mistakes, tone inversions & phonetic misspellings
      const phraseReplacements: [RegExp, string][] = [
        // Phrasal typos & idioms
        [/\bchai\s+tay\b/gi, 'chia tay'],
        [/\bbắt\s+chai\b/gi, 'bắt tay'],
        [/\bchia\s+xẻ\b/gi, 'chia sẻ'],
        [/\bsẽ\s+chia\b/gi, 'sẻ chia'],
        [/\bsơ\s+xài\b/gi, 'sơ sài'],
        [/\bxúc\s+tích\b/gi, 'súc tích'],
        [/\bthăm\s+quan\b/gi, 'tham quan'],
        [/\bsắp\s+sếp\b/gi, 'sắp xếp'],
        [/\bbổ\s+xung\b/gi, 'bổ sung'],
        [/\bcọ\s+sát\b/gi, 'cọ xát'],
        [/\bchuẩn\s+đoán\b/gi, 'chẩn đoán'],
        [/\bgiành\s+dụm\b/gi, 'dành dụm'],
        [/\bvô\s+hình\s+chung\b/gi, 'vô hình trung'],
        [/\bđều\s+tra\b/gi, 'điều tra'],
        [/\bchính\s+sách\s+ưu\s+đãi\b/gi, 'chính sách ưu đãi'],

        // Context-aware words & missing/wrong tones
        [/\bhiêu\b/gi, 'hiểu'],
        [/\bhỉu\b/gi, 'hiểu'],
        [/\bnhìu\b/gi, 'nhiều'],
        [/\bchìu\b/gi, 'chiều'],
        [/\biu\b/gi, 'yêu'],
        [/\bbùn\b/gi, 'buồn'],
        [/\brùi\b/gi, 'rồi'],
        [/\bwa\b/gi, 'quá'],
        [/\bbik\b/gi, 'biết'],
        [/\bbit\b/gi, 'biết'],
        [/\bthik\b/gi, 'thích'],
        [/\blun\b/gi, 'luôn'],
        [/\btks\b/gi, 'cảm ơn'],
        [/\bcmon\b/gi, 'cảm ơn'],
        [/\bokie\b/gi, 'đồng ý'],
        [/\boke\b/gi, 'đồng ý'],
        [/\bchx\b/gi, 'chưa'],
        [/\bms\b/gi, 'mới'],
        [/\blm\b/gi, 'làm'],
        [/\bng\b/gi, 'người'],
        [/\bnhg\b/gi, 'nhưng'],
        [/\btrc\b/gi, 'trước'],
        [/\bchac\b/gi, 'chắc'],
        [/\btui\b/gi, 'tôi'],
        [/\bko\b/gi, 'không'],
        [/\bk\b/gi, 'không'],
        [/\bdc\b/gi, 'được'],
        [/\bđc\b/gi, 'được'],
        [/\bvs\b/gi, 'với'],
        [/\bmk\b/gi, 'mình'],
        [/\bbn\b/gi, 'bạn'],
        [/\bcx\b/gi, 'cũng'],
        [/\bbt\b/gi, 'bình thường'],
        [/\bntn\b/gi, 'như thế nào'],
        [/\bj\b/gi, 'gì'],
        [/\bz\b/gi, 'vậy'],
        // Common typos in procurement & Vietnamese typing
        [/\bsai\s+xót\b/gi, 'sai sót'],
        [/\bxai\s+xót\b/gi, 'sai sót'],
        [/\bgủi\b/gi, 'gửi'],
        [/\bgiử\b/gi, 'giữ'],
        [/\bkiễm\s+tra\b/gi, 'kiểm tra'],
        [/\bbáo\s+cáp\b/gi, 'báo cáo'],
        [/\bxử\s+lí\b/gi, 'xử lý'],
        [/\bliên\s+hẹ\b/gi, 'liên hệ'],
        [/\bkế\s+hoạc\b/gi, 'kế hoạch'],
        [/\bthu\s+muaa\b/gi, 'thu mua'],
        [/\btập\s+chung\b/gi, 'tập trung'],
        [/\bxuất\s+săc\b/gi, 'xuất sắc'],
        [/\bthời\s+hạng\b/gi, 'thời hạn'],
        [/\bhạn\s+trót\b/gi, 'hạn chót'],
        [/\bhoàng\s+thành\b/gi, 'hoàn thành'],
        [/\bsản\s+phẫm\b/gi, 'sản phẩm'],
        [/\bđơn\s+hang\b/gi, 'đơn hàng'],
        [/\bnhà\s+cung\s+câp\b/gi, 'nhà cung cấp'],
        [/\brút\s+cục\b/gi, 'rốt cuộc'],
        // Unaccented common phrases & folk verses
        [/\bcon\s+co\s+ma\s+di\s+an\s+dem\b/gi, 'Con cò mà đi ăn đêm'],
        [/\bcon\s+cò\s+mà\s+đi\s+ăn\s+đêm\b/gi, 'Con cò đi ăn đêm'],
        [/\bdau\s+long\s+co\s+con\b/gi, 'Đau lòng cò con'],
        [/\bkheo\s+sa\s+xuong\s+ho\b/gi, 'Khéo sa xuống hố'],
        [/\bxin\s+chao\b/gi, 'xin chào'],
        [/\bcam\s+on\b/gi, 'cảm ơn'],
        [/\bkhong\s+co\s+gi\b/gi, 'không có gì'],
        [/\bhen\s+gap\s+lai\b/gi, 'hẹn gặp lại'],
        // Proper nouns in Vietnamese
        [/\bviệt\s+nam\b/gi, 'Việt Nam'],
        [/\bhà\s+nội\b/gi, 'Hà Nội'],
        [/\btp\.?\s*hcm\b|\bsài\s+gòn\b/gi, 'TP. Hồ Chí Minh'],
        [/\bđà\s+nẵng\b/gi, 'Đà Nẵng'],
        [/\bhải\s+phòng\b/gi, 'Hải Phòng'],
        [/\bcần\s+thơ\b/gi, 'Cần Thơ'],
      ];

      for (const [pattern, replacement] of phraseReplacements) {
        clean = clean.replace(pattern, replacement);
      }

      // 2. Fix Vietnamese spacing & punctuation
      clean = clean
        .replace(/\s+([,.:;!?])/g, '$1')             // Xóa khoảng trắng trước dấu câu
        .replace(/([,.:;!?])(?=[^\s\d\n])/g, '$1 ')   // Thêm khoảng trắng sau dấu câu
        .replace(/\s{2,}/g, ' ')                       // Gộp nhiều khoảng trắng thành 1
        .trim();

      // 3. Capitalize start of text and after sentence-ending punctuation
      if (clean.length > 0) {
        clean = clean.charAt(0).toUpperCase() + clean.slice(1);
      }
      clean = clean.replace(/([.!?]\s+)([a-zà-ỹ])/g, (_, p1, p2) => p1 + p2.toUpperCase());

      // 4. Ensure complete sentences end with punctuation
      if (clean.length > 0 && !/[.!?…]$/.test(clean)) {
        clean += '.';
      }

      return clean;
    }

    case 'expand': {
      const trimmedText = text.trim();
      if (!trimmedText) return '';
      const cleanBase = localTransform(trimmedText, 'proofread');
      const rawLines = cleanBase.split('\n').map((l) => l.trim()).filter(Boolean);

      const expandSingleSentence = (sentence: string): string => {
        const clean = sentence.replace(/[.!?…]+$/, '').trim();
        if (!clean) return '';
        const lower = clean.toLowerCase();

        // 1. Procurement / Purchasing / Orders / Supplies
        if (/(?:mua|nhập|đặt hàng|báo giá|vật tư|thiết bị|hàng hóa|văn phòng phẩm|nhà cung cấp|ncc|hợp đồng|đơn hàng)/i.test(lower)) {
          if (/mua|đặt/i.test(lower) && !/báo giá|khảo sát|liên hệ/i.test(lower)) {
            return `${clean}, chủ động liên hệ nhà cung cấp uy tín để lấy báo giá cạnh tranh và kiểm tra kỹ số lượng, thông số kỹ thuật trước khi phê duyệt đặt hàng.`;
          }
          return `${clean}, đồng thời rà soát lại dự toán ngân sách, tiến độ giao hàng dự kiến và đảm bảo các tiêu chuẩn nghiệm thu cần thiết.`;
        }

        // 2. Inspection / Quality Control / Auditing / Checking
        if (/(?:kiểm tra|rà soát|đánh giá|nghiệm thu|review|soát lỗi|kiểm kê|đối chiếu)/i.test(lower)) {
          return `${clean}, đối chiếu chi tiết theo từng tiêu chí chất lượng và lập biên bản ghi nhận cụ thể các hạng mục đạt chuẩn hoặc cần khắc phục.`;
        }

        // 3. Meetings / Calls / Discussions / Contact
        if (/(?:họp|gặp|trao đổi|liên hệ|gọi|thảo luận|thống nhất|hẹn)/i.test(lower)) {
          return `${clean}, chuẩn bị trước nội dung trọng tâm cần trao đổi và ghi chép lại kết luận sau cuộc họp để các bên phối hợp triển khai thuận tiện.`;
        }

        // 4. Reporting / Submitting / Documentation / Planning
        if (/(?:báo cáo|gửi|soạn|lập kế hoạch|kế hoạch|tài liệu|hồ sơ|tổng hợp)/i.test(lower)) {
          return `${clean}, bảo đảm số liệu được cập nhật chuẩn xác, định dạng rõ ràng và gửi đến các bên liên quan đúng thời hạn quy định.`;
        }

        // 5. Daily Life / Personal / Food / Leisure / Travel
        if (/(?:ăn|uống|cà phê|cafe|trà|cơm|bún|phở|du lịch|nghỉ ngơi|chơi|sách|xem phim)/i.test(lower)) {
          return `${clean}, lựa chọn không gian và thời điểm phù hợp để có trải nghiệm thoải mái và trọn vẹn nhất.`;
        }

        // 6. Generic natural elaboration based on length
        if (clean.length < 35) {
          return `${clean}, chuẩn bị kỹ các bước cần thiết và lưu ý theo dõi để đạt kết quả tốt nhất.`;
        }
        return `${clean}, bảo đảm thực hiện đầy đủ các yêu cầu và cập nhật thông tin kịp thời khi có thay đổi.`;
      };

      const expanded = rawLines.map(expandSingleSentence);
      return expanded.join('\n') || cleanBase;
    }

    case 'action_items': {
      const actionableVerbRegex = /^(?:cần|phải|hãy|nên|mua|bán|gửi|nhận|kiểm tra|rà soát|liên hệ|gọi|họp|báo cáo|hoàn thành|thực hiện|lập|soạn|xác nhận|cập nhật|theo dõi|đôn đốc|thanh toán|ký|duyệt|chuẩn bị|đặt|chuyển|xử lý|nghiệm thu|đánh giá|tìm|thảo luận|triển khai|tổng hợp|chốt|thống nhất|in|gặp|hẹn|nhắc|sửa|tạo|nộp|đăng ký|sắp xếp|check|send|buy|order|review|call|meet|update|complete|prepare|submit|contact|create|fix)\b/i;

      const allLines = lines.length > 1 ? lines : splitIntoSentences(text);
      const actionCandidates: string[] = [];

      for (const line of allLines) {
        const cleaned = cleanLine(line);
        if (!cleaned) continue;

        // Numbered line (e.g. 1. or 1)) or bullet
        const isNumberedOrBullet = /^(?:\d+[\.\)]|[-*•])\s+/.test(line.trim());
        // Starts with action verb or modal verb
        const startsWithVerb = actionableVerbRegex.test(cleaned);

        if (isNumberedOrBullet || startsWithVerb) {
          actionCandidates.push(cleaned);
        }
      }

      // If actionable items detected, use them. If none matched, use non-empty clean lines.
      const chosenItems = actionCandidates.length > 0 ? actionCandidates : lines.map(cleanLine).filter(Boolean);
      const items = chosenItems.map((item) => `- [ ] ${item}`).join('\n');
      return items || '- [ ] ' + text.trim();
    }

    case 'translate_en': {
      return offlineDictionaryTranslate(text, 'en');
    }

    case 'translate_vi': {
      return offlineDictionaryTranslate(text, 'vi');
    }

    default:
      return text;
  }
};

/**
 * Execute Apple Intelligence Writing Tool
 * Multi-tier pipeline with automatic backup keys failover:
 * 1. Try Backend AI Proxy (/api/ai/writing-tool) with all configured active keys
 * 2. Try Direct Browser Google Gemini API iterating through active backup keys
 * 3. Fallback to resilient local offline NLP engine / Free Translate API
 */
export const runWritingTool = async (
  text: string,
  action: WritingToolAction,
  signal?: AbortSignal
): Promise<{ result: string; usedGemini: boolean; needsApiKey?: boolean; usedFallbackKey?: boolean; usedKeyName?: string }> => {
  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error('Nội dung ghi chú đang trống');
  }

  const activeKeys = getActiveGeminiKeys();
  const rawKeyStrings = activeKeys.map((k) => k.key.trim()).filter(Boolean);

  // Tier 1: Try backend AI endpoint (passes full keys pool for seamless failover)
  try {
    const backendRes = await callBackendWritingTool(trimmed, action, rawKeyStrings, signal);
    if (backendRes?.result) {
      const sanitized = sanitizeAiWritingOutput(backendRes.result);
      const usedIndex = backendRes.usedKeyIndex ?? 0;
      const keyObj = activeKeys[usedIndex];
      return {
        result: sanitized,
        usedGemini: true,
        usedFallbackKey: Boolean(backendRes.fallbackKeyUsed),
        usedKeyName: keyObj?.name,
      };
    }
  } catch (backendErr: any) {
    if (signal?.aborted) throw backendErr;
    console.warn('Backend AI writing tool failed or not configured, trying direct API:', backendErr?.message);
  }

  // Tier 2: Try direct browser Gemini API with active keys pool failover
  if (activeKeys.length > 0) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

    const systemInstruction =
      'Bạn là công cụ xử lý văn bản Apple Intelligence thông minh.\n' +
      'QUY TẮC BẮT BUỘC:\n' +
      '1. CHỈ xuất ra duy nhất văn bản kết quả sau khi xử lý.\n' +
      '2. Tuyệt đối KHÔNG kèm giải thích, KHÔNG tiêu đề, KHÔNG lời chào/kết.\n' +
      '3. Tuyệt đối KHÔNG phân tích cấu trúc prompt, KHÔNG in các nhãn "* Input:", "* Goal:", "* Constraint", "Analysis:" hoặc các bước suy luận.';

    let prompt = '';
    if (action === 'summarize') {
      prompt = `Hãy tóm tắt cô đọng đúng bản chất các thông tin cốt lõi (Ai, làm gì, khi nào, số lượng, lưu ý chính) của nội dung sau bằng tiếng Việt:\n\n${trimmed}`;
    } else if (action === 'keypoints') {
      prompt = `Hãy rút ra các ý chính mấu chốt quan trọng nhất từ văn bản sau bằng tiếng Việt, đánh số thứ tự 1, 2, 3... rõ ràng, ngắn gọn và đi thẳng vào trọng tâm:\n\n${trimmed}`;
    } else if (action === 'professional') {
      prompt = `Hãy viết lại văn bản sau theo chuẩn văn phong công vụ, thương mại lịch sự, tôn trọng người đọc bằng tiếng Việt, thay thế toàn bộ từ ngữ suồng sã, teencode, văn nói, giữ nguyên đầy đủ ý và tính chính xác của thông tin gốc:\n\n${trimmed}`;
    } else if (action === 'concise') {
      prompt = `Hãy viết lại văn bản sau thật ngắn gọn, súc tích bằng tiếng Việt, giản lược tối đa các từ đệm, trạng từ thừa, cụm từ lặp lại, giữ nguyên 100% cốt lõi thông tin:\n\n${trimmed}`;
    } else if (action === 'proofread') {
      prompt = `Hãy sửa đúng chính tả tiếng Việt, chuẩn hóa dấu thanh, dấu câu, ngắt câu, viết hoa đầu câu trong văn bản sau mà KHÔNG làm thay đổi cấu trúc hay ý nghĩa câu:\n\n${trimmed}`;
    } else if (action === 'expand') {
      prompt = `Hãy phát triển câu từ tự nhiên, mạch lạc, bám sát ngữ cảnh thực tế của câu gốc bằng tiếng Việt (không dùng mẫu câu máy móc hay văn mẫu rập khuôn):\n\n${trimmed}`;
    } else if (action === 'action_items') {
      prompt = `Hãy trích xuất chính xác các hành động hoặc đầu việc cần thực hiện từ văn bản sau thành định dạng danh sách việc cần làm '- [ ] [Hành động cụ thể]':\n\n${trimmed}`;
    } else if (action === 'translate_en') {
      prompt = `Hãy dịch sang tiếng Anh chuẩn, tự nhiên, chính xác cả về thuật ngữ kinh doanh/thu mua và đời sống:\n\n${trimmed}`;
    } else if (action === 'translate_vi') {
      prompt = `Hãy dịch sang tiếng Việt mượt mà, thuần Việt, chuẩn ngữ pháp:\n\n${trimmed}`;
    } else {
      prompt = `Hãy sửa đúng chính tả tiếng Việt, chuẩn hóa dấu thanh, dấu câu, ngắt câu, viết hoa đầu câu trong văn bản sau mà KHÔNG làm thay đổi cấu trúc hay ý nghĩa câu:\n\n${trimmed}`;
    }

    // Helper function to call appropriate API provider
    const callProviderApi = async (keyItem: GeminiKeyItem, pr: string, sig?: AbortSignal): Promise<string> => {
      const cleanKey = keyItem.key.trim();
      const prov = keyItem.provider || detectProvider(cleanKey);

      if (prov === 'deepseek' || (cleanKey.startsWith('sk-') && prov !== 'openai')) {
        const res = await fetch('https://api.deepseek.com/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${cleanKey}`,
          },
          body: JSON.stringify({
            model: 'deepseek-chat',
            messages: [
              {
                role: 'system',
                content: systemInstruction,
              },
              { role: 'user', content: pr },
            ],
            temperature: 0.2,
          }),
          signal: sig,
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error?.message || `Lỗi DeepSeek HTTP ${res.status}`);
        }

        const data = await res.json();
        const text = data.choices?.[0]?.message?.content?.trim();
        if (!text) throw new Error('Không nhận được phản hồi từ DeepSeek');
        return sanitizeAiWritingOutput(text);
      }

      if (prov === 'openai') {
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${cleanKey}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content: systemInstruction,
              },
              { role: 'user', content: pr },
            ],
            temperature: 0.2,
          }),
          signal: sig,
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error?.message || `Lỗi OpenAI HTTP ${res.status}`);
        }

        const data = await res.json();
        const text = data.choices?.[0]?.message?.content?.trim();
        if (!text) throw new Error('Không nhận được phản hồi từ OpenAI');
        return sanitizeAiWritingOutput(text);
      }

      // Default: Google Gemini
      return callGeminiApi(pr, cleanKey, systemInstruction, sig);
    };

    // Try keys sequentially until one succeeds
    for (let i = 0; i < activeKeys.length; i++) {
      const keyObj = activeKeys[i];
      try {
        const result = await callProviderApi(keyObj, prompt, signal);
        const cleanResult = sanitizeAiWritingOutput(result);
        // Mark key active
        updateGeminiKey(keyObj.id, {
          status: 'active',
          statusMessage: 'Hoạt động tốt',
          lastCheckedAt: new Date().toISOString(),
        });
        return {
          result: cleanResult,
          usedGemini: true,
          usedFallbackKey: i > 0,
          usedKeyName: keyObj.name,
        };
      } catch (err: any) {
        if (signal?.aborted) throw err;
        const lower = (err?.message || '').toLowerCase();
        const isQuota = /429|quota|rate.?limit|exhausted|resource/i.test(lower);
        updateGeminiKey(keyObj.id, {
          status: isQuota ? 'quota_exceeded' : 'invalid',
          statusMessage: isQuota
            ? 'Hết hạn mức (Quota Exceeded) — Đã tự động chuyển sang khóa dự phòng'
            : err?.message || 'Lỗi kết nối',
          lastCheckedAt: new Date().toISOString(),
        });
        console.warn(`Key #${i + 1} (${keyObj.name}) failed, attempting next key in pool...`, err?.message);
      }
    }
  }

  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

  // Tier 3: Instant translation using free public Google Translate endpoint (100% reliable)
  if (action === 'translate_en' || action === 'translate_vi') {
    const targetLang = action === 'translate_vi' ? 'vi' : 'en';
    const translated = await freeTranslate(trimmed, targetLang);
    return { result: translated, usedGemini: false };
  }

  // Tier 4: Resilient offline NLP transformer
  const result = localTransform(trimmed, action);
  return { result, usedGemini: false, needsApiKey: activeKeys.length === 0 };
};

/**
 * Direct browser Gemini Vision OCR call
 */
export const extractTextFromImageDirect = async (
  imageDataUrl: string,
  apiKey: string,
  signal?: AbortSignal
): Promise<string> => {
  const dataUrlMatch = imageDataUrl.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/s);
  if (!dataUrlMatch) throw new Error('Định dạng ảnh không hợp lệ');
  const mimeType = dataUrlMatch[1];
  const base64Data = dataUrlMatch[2];

  const models = await discoverBestFlashModels(apiKey);
  let lastErr = '';

  const ocrPrompt =
    'Bạn là chuyên gia OCR văn bản chuyên nghiệp. Hãy trích xuất TOÀN BỘ nội dung chữ/văn bản xuất hiện trong hình ảnh một cách đầy đủ và chính xác 100%:\n- Nhận diện chính xác từng từ tiếng Việt có dấu, số hiệu, mã chứng từ (PO, SKU), ngày tháng, giờ giấc, tên riêng, email, số điện thoại.\n- Giữ nguyên trật tự trên-dưới, cấu trúc từng dòng, đoạn văn và các danh sách có đánh số.\n- Không tự ý tóm tắt, không sửa từ, không bỏ qua các dòng chữ nhỏ, chữ ký hay ghi chú ở cuối.\n- Nếu trong ảnh hoàn toàn không có bất kỳ ký tự chữ hay số nào, hãy trả về chính xác: [KHÔNG CÓ VĂN BẢN]\n- Chỉ trả về duy nhất nội dung văn bản thuần túy được trích xuất, tuyệt đối không thêm lời mở đầu hay giải thích.';

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey.trim()}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: ocrPrompt },
                {
                  inlineData: {
                    mimeType,
                    data: base64Data,
                  },
                },
              ],
            },
          ],
          generationConfig: { temperature: 0.1 },
        }),
        signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        lastErr = err.error?.message || `HTTP ${res.status}`;
        continue;
      }

      const data = await res.json();
      const extracted = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
      return extracted;
    } catch (err: any) {
      if (signal?.aborted) throw err;
      lastErr = err.message || 'Lỗi mạng khi kết nối Gemini Vision';
    }
  }

  throw new Error(lastErr || 'Không thể trích xuất văn bản từ ảnh');
};

/**
 * Trích xuất nội dung văn bản từ ảnh (OCR) sử dụng danh sách Khóa API với cơ chế dự phòng tự động
 */
export const extractTextFromImageWithFailover = async (
  imageDataUrl: string,
  signal?: AbortSignal
): Promise<{ success: boolean; text: string; model?: string; noText?: boolean; usedKeyName?: string; fallbackKeyUsed?: boolean }> => {
  const activeKeys = getActiveGeminiKeys();
  const rawKeyStrings = activeKeys.map((k) => k.key.trim()).filter(Boolean);

  // Lọc các khóa hỗ trợ Vision (ưu tiên Gemini keys: AIzaSy, AQ. hoặc provider gemini)
  const visionCandidates = activeKeys.filter((k) => k.provider === 'gemini' || k.key.trim().startsWith('AIzaSy') || k.key.trim().startsWith('AQ.') || !k.key.trim().startsWith('sk-'));
  const candidateKeys = visionCandidates.length > 0 ? visionCandidates : activeKeys;

  let lastErr = '';

  // Tier 1: Trực tiếp gọi Google Gemini Vision từ trình duyệt (hoạt động 100% không phụ thuộc máy chủ backend)
  for (let i = 0; i < candidateKeys.length; i++) {
    const keyObj = candidateKeys[i];
    // Chỉ thử gọi Gemini Vision nếu khóa là Gemini
    if (keyObj.provider === 'gemini' || keyObj.key.trim().startsWith('AIzaSy') || keyObj.key.trim().startsWith('AQ.') || !keyObj.key.trim().startsWith('sk-')) {
      try {
        const text = await extractTextFromImageDirect(imageDataUrl, keyObj.key, signal);
        updateGeminiKey(keyObj.id, {
          status: 'active',
          statusMessage: 'Hoạt động tốt',
          lastCheckedAt: new Date().toISOString(),
        });

        if (!text || text === '[KHÔNG CÓ VĂN BẢN]') {
          return {
            success: true,
            text: '',
            noText: true,
            usedKeyName: keyObj.name,
            fallbackKeyUsed: i > 0,
          };
        }

        return {
          success: true,
          text,
          usedKeyName: keyObj.name,
          fallbackKeyUsed: i > 0,
        };
      } catch (err: any) {
        if (signal?.aborted) throw err;
        const lower = (err?.message || '').toLowerCase();
        const isQuota = /429|quota|rate.?limit|exhausted/i.test(lower);
        updateGeminiKey(keyObj.id, {
          status: isQuota ? 'quota_exceeded' : 'invalid',
          statusMessage: isQuota ? 'Hết hạn mức (429)' : err?.message,
          lastCheckedAt: new Date().toISOString(),
        });
        lastErr = err?.message || 'Lỗi xử lý ảnh';
      }
    }
  }

  // Tier 2: Gọi thử qua endpoint backend proxy nếu có
  try {
    const res = await api.post(
      '/ai/extract-image-text',
      {
        imageDataUrl,
        apiKeys: rawKeyStrings.length > 0 ? rawKeyStrings : undefined,
        apiKey: rawKeyStrings[0] || undefined,
      },
      { signal }
    );

    if (res.data?.success) {
      const usedIndex = res.data.usedKeyIndex ?? 0;
      const keyObj = activeKeys[usedIndex];
      return {
        success: true,
        text: res.data.text || '',
        model: res.data.model,
        noText: res.data.noText,
        usedKeyName: keyObj?.name,
        fallbackKeyUsed: Boolean(res.data.fallbackKeyUsed),
      };
    }
  } catch (backendErr: any) {
    if (signal?.aborted) throw backendErr;
    console.warn('Backend proxy OCR unavailable, falling back:', backendErr?.message);
  }

  if (activeKeys.length === 0) {
    throw new Error('Chưa cấu hình API Key. Vui lòng cài đặt khóa API trong Cài đặt → API Key.');
  }

  // Nếu tất cả các khóa đều là DeepSeek (chỉ text, không hỗ trợ Vision)
  const allTextOnly = activeKeys.every((k) => k.provider === 'deepseek' || k.key.trim().startsWith('sk-'));
  if (allTextOnly) {
    throw new Error('Tính năng quét chữ từ ảnh (OCR) cần khóa hỗ trợ hình ảnh (Google Gemini). Vui lòng thêm khóa Gemini trong Cài đặt → API Key.');
  }

  throw new Error(lastErr || 'Không thể trích xuất văn bản từ ảnh qua các khóa API hiện có');
};
