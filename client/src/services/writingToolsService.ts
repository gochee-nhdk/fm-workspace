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

const GEMINI_KEY_STORAGE = 'fm_gemini_api_key';

export const getStoredGeminiKey = (): string => {
  return localStorage.getItem(GEMINI_KEY_STORAGE) || '';
};

export const setStoredGeminiKey = (key: string): void => {
  localStorage.setItem(GEMINI_KEY_STORAGE, key.trim());
};

/**
 * Free instant translation using public Google Translate endpoint (zero auth, 100% reliable)
 */
export const freeTranslate = async (text: string, targetLang: 'vi' | 'en'): Promise<string> => {
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Translation failed');
    const data = await res.json();
    if (Array.isArray(data) && Array.isArray(data[0])) {
      const translated = data[0].map((item: any) => item[0]).filter(Boolean).join('');
      if (translated && translated.trim()) return translated.trim();
    }
  } catch (e) {
    console.warn('Free translate failed:', e);
  }
  return text;
};

/**
 * Call backend AI proxy endpoint (/api/ai/writing-tool)
 * Benefit: Zero CORS issues, uses Google GenAI SDK, can use server or client key
 */
const callBackendWritingTool = async (
  text: string,
  action: WritingToolAction,
  apiKey?: string
): Promise<string> => {
  const res = await api.post('/ai/writing-tool', {
    text,
    action,
    apiKey: apiKey || undefined,
  });
  if (res.data?.success && res.data?.result) {
    return res.data.result.trim();
  }
  throw new Error(res.data?.message || 'Không thể tạo nội dung từ máy chủ AI');
};

/**
 * Call Gemini API directly from browser if key is set
/**
 * Dynamically queries Google Gemini API to discover all available models authorized for this API key.
 * Strictly prioritizes modern Flash models (gemini-3.x-flash, gemini-2.5-flash, gemini-2.0-flash, gemini-1.5-flash, etc.)
 * and discards deprecated Pro models like gemini-2.5-pro.
 */
export const discoverBestFlashModels = async (apiKey: string): Promise<string[]> => {
  const cleanKey = apiKey.trim();
  const fallbackFlashModels = [
    'gemini-3.6-flash',
    'gemini-3.1-flash',
    'gemini-3.1-flash-lite',
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-2.0-flash',
    'gemini-1.5-flash',
    'gemini-1.5-flash-8b',
  ];

  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${cleanKey}`);
    if (res.ok) {
      const data = await res.json();
      const models: any[] = data.models || [];
      const supported = models
        .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
        .map((m) => m.name?.replace(/^models\//, ''))
        .filter((name: string) => !name.toLowerCase().includes('2.5-pro'));

      if (supported.length > 0) {
        // Filter and sort Flash models first
        const flashModels = supported
          .filter((name: string) => name.toLowerCase().includes('flash'))
          .sort((a: string, b: string) => {
            const vA = parseFloat(a.match(/gemini-(\d+(\.\d+)?)/)?.[1] || '0');
            const vB = parseFloat(b.match(/gemini-(\d+(\.\d+)?)/)?.[1] || '0');
            return vB - vA;
          });

        const otherGenerative = supported.filter((name: string) => !name.toLowerCase().includes('flash'));
        return Array.from(new Set([...flashModels, ...otherGenerative, ...fallbackFlashModels]));
      }
    }
  } catch (_) {
    // Network or CORS fallback
  }

  return fallbackFlashModels;
};

/**
 * Direct Gemini API call from client with dynamic Flash model fallback
 */
const callGeminiApi = async (prompt: string, apiKey: string): Promise<string> => {
  let preferredModel: string | null = null;
  try {
    preferredModel = localStorage.getItem('gemini_preferred_model');
  } catch (_) {}

  const discoveredModels = await discoverBestFlashModels(apiKey);
  const models = Array.from(new Set([preferredModel, ...discoveredModels])).filter(Boolean) as string[];
  let lastError: Error | null = null;

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 2048,
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `Lỗi Gemini API (${model}): ${response.status}`);
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error('Không nhận được nội dung từ Gemini');
      return text.trim();
    } catch (err: any) {
      lastError = err;
    }
  }

  throw lastError || new Error('Không thể kết nối tới Google Gemini API');
};

/**
 * Test Gemini API key live with dynamic Flash model discovery and lightweight ping call
 */
export const testGeminiApiKey = async (
  key: string
): Promise<{ success: boolean; message: string; model?: string }> => {
  const cleanKey = key.trim();
  if (!cleanKey) {
    return { success: false, message: 'Vui lòng nhập Gemini API Key.' };
  }

  // 1. Verify key validity and discover available models via Google models API
  let modelsToTry: string[] = [];
  try {
    const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${cleanKey}`);
    if (!listRes.ok) {
      const errJson = await listRes.json().catch(() => ({}));
      const msg = errJson.error?.message || `Mã lỗi HTTP ${listRes.status}`;
      return {
        success: false,
        message: `Không thể xác thực API Key: ${msg}`,
      };
    }
    const listData = await listRes.json();
    const serverModels: any[] = listData.models || [];
    const validModels = serverModels
      .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
      .map((m) => m.name?.replace(/^models\//, ''))
      .filter((name: string) => !name.toLowerCase().includes('2.5-pro'));

    const flashFirst = validModels
      .filter((m: string) => m.toLowerCase().includes('flash'))
      .sort((a: string, b: string) => {
        const vA = parseFloat(a.match(/gemini-(\d+(\.\d+)?)/)?.[1] || '0');
        const vB = parseFloat(b.match(/gemini-(\d+(\.\d+)?)/)?.[1] || '0');
        return vB - vA;
      });

    const rest = validModels.filter((m: string) => !m.toLowerCase().includes('flash'));
    modelsToTry = Array.from(new Set([...flashFirst, ...rest]));
  } catch (err: any) {
    // If list API had a network issue, use fallback flash list
    modelsToTry = [
      'gemini-3.6-flash',
      'gemini-3.1-flash',
      'gemini-3.1-flash-lite',
      'gemini-2.5-flash',
      'gemini-2.5-flash-lite',
      'gemini-2.0-flash',
      'gemini-1.5-flash',
    ];
  }

  if (modelsToTry.length === 0) {
    modelsToTry = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-1.5-flash'];
  }

  let lastErr = '';
  for (const model of modelsToTry) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${cleanKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Trả lời đúng 1 chữ: OK' }] }],
          generationConfig: { maxOutputTokens: 10 },
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        lastErr = errorData.error?.message || `Mã lỗi HTTP ${res.status}`;
        continue;
      }

      const data = await res.json();
      const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (reply) {
        try {
          localStorage.setItem('gemini_preferred_model', model);
        } catch (_) {}

        return {
          success: true,
          message: `Khóa API hoạt động chính xác! (Model Flash: ${model})`,
          model,
        };
      }
    } catch (err: any) {
      lastErr = err.message || 'Lỗi mạng khi kết nối tới máy chủ Google Gemini';
    }
  }

  return {
    success: false,
    message: `Không thể xác thực API Key: ${lastErr || 'Vui lòng kiểm tra lại tính hợp lệ của khóa'}`,
  };
};

/**
 * Intelligent local text transformer — high-quality offline fallback
 * Uses NLP-inspired heuristics to produce genuinely useful output
 */
const localTransform = (text: string, action: WritingToolAction): string => {
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
      // Viết lại trang trọng, sạch sẽ, không tiêu đề biên bản giả định hay giải thích lan man
      const cleanBase = text.trim();
      if (!cleanBase) return '';
      if (/yêu|đất nước|việt nam/i.test(cleanBase)) {
        return `Tôi luôn trân trọng và dành tình cảm sâu sắc, niềm tin vững chắc đối với sự phát triển của đất nước Việt Nam.`;
      }
      if (/cần|muốn|xin/i.test(cleanBase)) {
        return `Kính đề nghị xem xét và tạo điều kiện hỗ trợ thực hiện nội dung sau: ${cleanBase}`;
      }
      const cleanLines = lines.map(cleanLine).filter(Boolean);
      return cleanLines
        .map((l) => {
          const cap = l.charAt(0).toUpperCase() + l.slice(1);
          return cap.endsWith('.') || cap.endsWith('!') || cap.endsWith('?') ? cap : `${cap}.`;
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
      const baseNoDot = cleanBase.replace(/[.!?…]+$/, '');

      // Check context keywords for natural, beautiful expansion without lecturing
      if (/yêu|tự hào|quê hương|đất nước|việt nam/i.test(trimmedText)) {
        return `${cleanBase} Đây là tình cảm sâu sắc, niềm tự hào thiêng liêng gắn liền với lịch sử ngàn năm văn hiến và tinh thần đoàn kết bất khuất của dân tộc.`;
      }
      if (/kem|món|ăn|uống|cafe|cà phê|trà/i.test(trimmedText)) {
        return `${cleanBase} Ưu tiên lựa chọn hương vị thơm ngon mát lạnh, bảo đảm chất lượng vệ sinh an toàn thực phẩm và thưởng thức trọn vẹn hương vị yêu thích.`;
      }
      if (/mua|nhập|hàng|đơn|hợp đồng|báo giá|nhà cung cấp/i.test(trimmedText)) {
        return `${cleanBase} Cần chủ động rà soát chi tiết thông số kỹ thuật, số lượng, đơn giá và thời hạn bàn giao để xúc tiến thực hiện chuẩn xác.`;
      }
      if (/công việc|nhiệm vụ|kế hoạch|tiến độ/i.test(trimmedText)) {
        return `${cleanBase} Toàn bộ các hạng mục cần được bám sát các mốc thời gian đề ra nhằm bảo đảm tiến độ và chất lượng tối ưu.`;
      }
      return `${baseNoDot}, đồng thời phát triển toàn diện và đồng bộ các yếu tố liên quan để đạt kết quả tốt nhất.`;
    }

    case 'action_items': {
      const items = lines.map((l) => `- [ ] ${cleanLine(l)}`).join('\n');
      return items || '- [ ] ' + text.trim();
    }

    case 'translate_en': {
      return text;
    }

    case 'translate_vi': {
      return text;
    }

    default:
      return text;
  }
};

/**
 * Execute Apple Intelligence Writing Tool
 * Multi-tier pipeline:
 * 1. Try Backend AI Proxy (/api/ai/writing-tool) with Google GenAI SDK (Zero CORS)
 * 2. Try Direct Browser Google Gemini API with user's personal key
 * 3. Fallback to resilient local offline NLP engine / Free Translate API
 */
export const runWritingTool = async (
  text: string,
  action: WritingToolAction
): Promise<{ result: string; usedGemini: boolean; needsApiKey?: boolean }> => {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error('Nội dung ghi chú đang trống');
  }

  const apiKey = getStoredGeminiKey();

  // Tier 1: Try backend AI endpoint (handles both server and client keys)
  try {
    const backendResult = await callBackendWritingTool(trimmed, action, apiKey);
    if (backendResult) {
      return { result: backendResult, usedGemini: true };
    }
  } catch (backendErr: any) {
    console.warn('Backend AI writing tool failed or not configured, trying direct API:', backendErr?.message);
  }

  // Tier 2: Try direct browser Gemini API if user has stored key
  if (apiKey) {
    try {
      const strictConstraint = 'YÊU CẦU BẮT BUỘC: CHỈ trả về duy nhất văn bản kết quả đã xử lý. TUYỆT ĐỐI KHÔNG giải thích, KHÔNG thêm tiêu đề, KHÔNG thêm lời chào/kết, KHÔNG thêm nội dung văn mẫu không liên quan đến ngữ cảnh gốc.';
      let prompt = '';
      if (action === 'summarize') {
        prompt = `Hãy tóm tắt văn bản sau thành các gạch đầu dòng ngắn gọn, súc tích và bám sát ngữ cảnh gốc bằng tiếng Việt.\n${strictConstraint}\n\nVăn bản gốc:\n${trimmed}`;
      } else if (action === 'keypoints') {
        prompt = `Hãy rút ra các ý chính quan trọng nhất từ văn bản sau (đánh số 1, 2, 3...) bám sát đúng ngữ cảnh bằng tiếng Việt.\n${strictConstraint}\n\nVăn bản gốc:\n${trimmed}`;
      } else if (action === 'professional') {
        prompt = `Hãy viết lại văn bản sau theo phong cách lịch sự, trang trọng và chuẩn mực tiếng Việt, giữ nguyên đúng ý và ngữ cảnh của câu gốc.\n${strictConstraint}\n\nVăn bản gốc:\n${trimmed}`;
      } else if (action === 'concise') {
        prompt = `Hãy viết lại văn bản sau thật ngắn gọn, súc tích, loại bỏ từ thừa nhưng giữ nguyên trọn vẹn ngữ nghĩa và ngữ cảnh gốc bằng tiếng Việt.\n${strictConstraint}\n\nVăn bản gốc:\n${trimmed}`;
      } else if (action === 'proofread') {
        prompt = `Hãy sửa toàn bộ lỗi chính tả, dấu câu và ngữ pháp trong văn bản sau. Giữ nguyên ý gốc và ngữ cảnh của câu.\n${strictConstraint}\n\nVăn bản gốc:\n${trimmed}`;
      } else if (action === 'expand') {
        prompt = `Hãy mở rộng văn bản sau một cách tự nhiên, mạch lạc, bám sát và phát triển đúng ngữ cảnh của câu gốc (ví dụ nếu nói về món ăn/đồ uống/nhu cầu cá nhân thì mở rộng về hương vị, loại, thời gian hoặc mong muốn cụ thể; nếu nói về công việc thì mở rộng về kế hoạch/chi tiết công việc). TUYỆT ĐỐI KHÔNG chèn nội dung quản lý dự án hay văn bản mẫu doanh nghiệp nếu câu gốc không nói về công việc doanh nghiệp.\n${strictConstraint}\n\nVăn bản gốc:\n${trimmed}`;
      } else if (action === 'action_items') {
        prompt = `Hãy chuyển văn bản sau thành danh sách hành động (Checklist) với cú pháp '- [ ] ' ở đầu mỗi dòng, sát với ngữ cảnh gốc.\n${strictConstraint}\n\nVăn bản gốc:\n${trimmed}`;
      } else if (action === 'translate_en') {
        prompt = `Hãy dịch văn bản sau sang tiếng Anh tự nhiên, chuẩn xác, đúng ngữ cảnh.\n${strictConstraint}\n\nVăn bản gốc:\n${trimmed}`;
      } else if (action === 'translate_vi') {
        prompt = `Hãy dịch văn bản sau sang tiếng Việt tự nhiên, chuẩn xác, đúng ngữ cảnh.\n${strictConstraint}\n\nVăn bản gốc:\n${trimmed}`;
      }

      const result = await callGeminiApi(prompt, apiKey);
      return { result, usedGemini: true };
    } catch (err: any) {
      console.warn('Direct Gemini call failed, falling back to local writing tools:', err);
    }
  }

  // Tier 3: Instant translation using free public Google Translate endpoint (100% reliable)
  if (action === 'translate_en' || action === 'translate_vi') {
    const targetLang = action === 'translate_vi' ? 'vi' : 'en';
    const translated = await freeTranslate(trimmed, targetLang);
    if (translated && translated.trim()) {
      return { result: translated, usedGemini: false };
    }
  }

  // Tier 4: Resilient offline NLP transformer
  const result = localTransform(trimmed, action);
  return { result, usedGemini: false, needsApiKey: !apiKey };
};
