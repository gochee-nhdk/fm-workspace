const nodemailer = require('nodemailer');
const crypto = require('crypto');

// In-memory runtime cache for serverless environment (isolated per user)
let globalSmtpConfig = null;
let globalGeminiKeysPool = [];
let globalGeminiKey = '';
const userBackups = new Map(); // userId -> { latest: backupData, history: [backupData] }
const globalPoFolders = [
  { id: 'f-default-1', name: 'Hàng kinh doanh', description: 'Các đơn hàng thu mua sản phẩm thương mại', color: 'blue', icon: 'shippingbox', sort_order: 1, created_at: new Date().toISOString() },
  { id: 'f-default-2', name: 'Vật tư & Bao bì', description: 'Bao bì đóng gói, tem nhãn', color: 'amber', icon: 'shippingbox', sort_order: 2, created_at: new Date().toISOString() }
];
const globalPoRecords = [];
const globalPoPermissions = [];

/**
 * Timing-safe JWT token verification (zero-dependency for Vercel Serverless)
 */
function base64UrlDecode(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf8');
}

function safeParseAIJson(text) {
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

function verifyAuthToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { valid: false, error: 'Thiếu Authorization Bearer token' };
  }
  const token = authHeader.slice(7).trim();
  const parts = token.split('.');
  if (parts.length !== 3) {
    return { valid: false, error: 'Cấu trúc JWT token không hợp lệ' };
  }
  const [headerB64, payloadB64, signatureB64] = parts;
  const secret = process.env.JWT_SECRET || 'dev_secret_farmers_market_local_development_only_2026';

  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(`${headerB64}.${payloadB64}`)
    .digest('base64url');

  const sigBuf = Buffer.from(signatureB64);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return { valid: false, error: 'Chữ ký JWT không hợp lệ hoặc đã bị can thiệp' };
  }

  try {
    const payload = JSON.parse(base64UrlDecode(payloadB64));
    if (payload.exp && Date.now() >= payload.exp * 1000) {
      return { valid: false, error: 'Phiên đăng nhập đã hết hạn' };
    }
    return { valid: true, user: payload };
  } catch (err) {
    return { valid: false, error: 'Nội dung payload token không hợp lệ' };
  }
}

module.exports = async function handler(req, res, forcedPath) {
  // CORS Origin Validation & Defense-in-Depth
  const origin = req.headers.origin;
  const clientUrl = process.env.CLIENT_URL || '';
  const allowedOriginsEnv = process.env.ALLOWED_ORIGINS || '';
  const envOrigins = allowedOriginsEnv
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean);

  if (clientUrl) {
    envOrigins.push(clientUrl.trim().replace(/\/+$/, ''));
  }

  let isAllowedOrigin = false;
  if (!origin) {
    isAllowedOrigin = true; // Same-origin, curl, server-to-server
  } else {
    const normalizedOrigin = origin.replace(/\/+$/, '');
    if (
      envOrigins.includes(normalizedOrigin) ||
      /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(normalizedOrigin) ||
      /^https:\/\/fm-workspace[a-z0-9-]*\.vercel\.app$/.test(normalizedOrigin)
    ) {
      isAllowedOrigin = true;
    }
  }

  if (isAllowedOrigin && origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  // Hardened Security Headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Parse path from forcedPath, URL or catch-all query slug
  let pathname = forcedPath || '';
  if (!pathname) {
    if (req.query && req.query.slug) {
      pathname = Array.isArray(req.query.slug) ? '/' + req.query.slug.join('/') : '/' + req.query.slug;
    } else {
      const rawUrl = req.url || '';
      pathname = rawUrl.split('?')[0].replace(/^\/api/, '');
    }
  }
  if (!pathname.startsWith('/')) {
    pathname = '/' + pathname;
  }

  try {
    // 1. Health Check
    if (pathname === '/health' || pathname === '' || pathname === '/') {
      return res.status(200).json({
        status: 'ok',
        service: 'FM Workspace Vercel Cloud Serverless API',
        timestamp: new Date().toISOString()
      });
    }

    // 2. SMTP Status
    if (pathname === '/notifications/smtp-status') {
      const config = globalSmtpConfig;
      if (!config || !config.user) {
        return res.status(200).json({
          success: true,
          configured: false,
          message: 'Chưa có cấu hình SMTP máy chủ'
        });
      }

      const maskedUser = config.user.replace(/^(.)(.*)(@.*)$/, (_, first, mid, last) => 
        `${first}${'*'.repeat(Math.max(mid.length, 3))}${last}`
      );

      return res.status(200).json({
        success: true,
        configured: true,
        smtpHost: config.host || 'smtp.gmail.com',
        smtpPort: config.port || 587,
        smtpUser: maskedUser,
        fullUser: config.user,
        senderName: config.senderName || 'Trợ Lý Thu Mua • Farmers Market'
      });
    }

    // 3. SMTP Config (Verify and save)
    if (pathname === '/notifications/smtp-config' && req.method === 'POST') {
      const body = req.body || {};
      const { user, pass, host, port, senderName } = body;

      if (!user || !pass) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng cung cấp Email gửi và Mật khẩu ứng dụng (Google App Password 16 ký tự).'
        });
      }

      const cleanUser = String(user).trim();
      const cleanPass = String(pass).trim().replace(/\s+/g, '');
      const smtpHost = host || 'smtp.gmail.com';
      const isGmail = smtpHost.includes('gmail') || cleanUser.includes('@gmail.com');
      const primaryPort = Number(port) || (isGmail ? 465 : 587);

      const createVerifyTransporter = (p, sec) => nodemailer.createTransport({
        host: smtpHost,
        port: p,
        secure: sec,
        auth: {
          user: cleanUser,
          pass: cleanPass
        },
        tls: { rejectUnauthorized: false },
        connectionTimeout: 8000,
        greetingTimeout: 6000,
        socketTimeout: 10000,
      });

      let verifySuccess = false;
      let lastErr = null;

      try {
        const transporter = createVerifyTransporter(primaryPort, primaryPort === 465);
        await transporter.verify();
        verifySuccess = true;
      } catch (err1) {
        lastErr = err1;
        const fallbackPort = primaryPort === 465 ? 587 : 465;
        try {
          const fallbackTransporter = createVerifyTransporter(fallbackPort, fallbackPort === 465);
          await fallbackTransporter.verify();
          verifySuccess = true;
        } catch (err2) {
          lastErr = err2;
        }
      }

      if (verifySuccess) {
        globalSmtpConfig = {
          user: cleanUser,
          pass: cleanPass,
          host: smtpHost,
          port: primaryPort,
          senderName: senderName || 'Trợ Lý Thu Mua • Farmers Market',
          configured: true
        };

        return res.status(200).json({
          success: true,
          configured: true,
          message: 'Cấu hình SMTP thành công! Đã kết nối máy chủ Google Mail.'
        });
      } else {
        console.error('SMTP verification failed:', lastErr);
        const errMsg = lastErr?.message || '';
        let vietnameseMsg = 'Không thể xác thực với máy chủ Google Mail.';
        if (errMsg.includes('Invalid login') || errMsg.includes('535') || errMsg.includes('Username and Password not accepted')) {
          vietnameseMsg = 'Google từ chối mật khẩu. Vui lòng tạo "Mật khẩu ứng dụng" (App Password 16 ký tự tại myaccount.google.com/apppasswords) thay vì mật khẩu thông thường.';
        } else if (errMsg.includes('ETIMEDOUT') || errMsg.includes('ECONNREFUSED')) {
          vietnameseMsg = 'Kết nối tới máy chủ Google Mail bị quá hạn. Vui lòng thử lại sau.';
        }
        return res.status(400).json({
          success: false,
          message: vietnameseMsg,
          detail: errMsg
        });
      }
    }

    // 4. SMTP Disconnect
    if (pathname === '/notifications/smtp-disconnect' && req.method === 'POST') {
      globalSmtpConfig = null;
      return res.status(200).json({
        success: true,
        message: 'Đã ngắt kết nối cấu hình gửi thư'
      });
    }

    // 5. Send Email Notification
    if ((pathname === '/notifications/send-reminder-email' || pathname === '/notifications/test-email') && req.method === 'POST') {
      const body = req.body || {};
      const { to, subject, content, noteTitle, taskText, smtpConfig: passedConfig } = body;

      const activeConfig = passedConfig || globalSmtpConfig || (process.env.SMTP_USER && process.env.SMTP_PASS ? {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: Number(process.env.SMTP_PORT) || 465,
        senderName: process.env.SMTP_SENDER_NAME || 'Trợ Lý Thu Mua • Farmers Market',
        configured: true
      } : null);

      if (!activeConfig || !activeConfig.user || !activeConfig.pass) {
        return res.status(400).json({
          success: false,
          configured: false,
          message: 'Chưa có thông tin tài khoản Gmail và Mật khẩu ứng dụng để gửi mail.'
        });
      }

      if (!to) {
        return res.status(400).json({
          success: false,
          message: 'Thiếu địa chỉ email người nhận.'
        });
      }

      const cleanUser = String(activeConfig.user).trim();
      const cleanPass = String(activeConfig.pass).trim().replace(/\s+/g, '');
      const isGmail = (activeConfig.host || '').includes('gmail') || cleanUser.includes('@gmail.com');
      const primaryPort = Number(activeConfig.port) || (isGmail ? 465 : 587);

      const createTransporter = (p, sec) => nodemailer.createTransport({
        host: activeConfig.host || 'smtp.gmail.com',
        port: p,
        secure: sec,
        auth: {
          user: cleanUser,
          pass: cleanPass
        },
        tls: { rejectUnauthorized: false },
        connectionTimeout: 10000,
        greetingTimeout: 8000,
        socketTimeout: 15000,
      });

      const mailSubject = subject || `[FM Workspace] Nhắc việc: ${taskText || noteTitle || 'Thông báo từ hệ thống'}`;
      const mailHtml = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e5e5ea; border-radius: 16px; background-color: #ffffff;">
          <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 20px; border-bottom: 1px solid #f2f2f7; padding-bottom: 16px;">
            <h2 style="margin: 0; color: #1d1d1f; font-size: 18px; font-weight: 700;">FM WORKSPACE</h2>
          </div>
          <div style="color: #1d1d1f; font-size: 14px; line-height: 1.6;">
            ${content ? `<p>${content}</p>` : ''}
            ${taskText ? `<div style="background-color: #f5f5f7; padding: 14px 18px; border-radius: 12px; margin: 16px 0; border-left: 4px solid #0071e3;"><strong style="color: #0071e3;">Nội dung việc cần làm:</strong><p style="margin: 6px 0 0 0; font-size: 15px;">${taskText}</p></div>` : ''}
            ${noteTitle ? `<p style="color: #86868b; font-size: 12px; margin-top: 20px;">Ghi chú liên quan: <strong>${noteTitle}</strong></p>` : ''}
          </div>
          <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #f2f2f7; color: #86868b; font-size: 11px; text-align: center;">
            Farmers Market Vietnam • Trợ Lý Thu Mua Workspace Cloud OS
          </div>
        </div>
      `;

      let sendSuccess = false;
      let lastSendErr = null;

      try {
        const transporter = createTransporter(primaryPort, primaryPort === 465);
        await transporter.sendMail({
          from: `"${activeConfig.senderName || 'Trợ Lý Thu Mua • Farmers Market'}" <${cleanUser}>`,
          to: String(to).trim(),
          subject: mailSubject,
          html: mailHtml,
          text: content || taskText || noteTitle || 'Thông báo từ FM Workspace'
        });
        sendSuccess = true;
      } catch (err1) {
        lastSendErr = err1;
        console.warn(`Primary SMTP send failed on port ${primaryPort}, retrying fallback:`, err1.message);
        const fallbackPort = primaryPort === 465 ? 587 : 465;
        try {
          const fallbackTransporter = createTransporter(fallbackPort, fallbackPort === 465);
          await fallbackTransporter.sendMail({
            from: `"${activeConfig.senderName || 'Trợ Lý Thu Mua • Farmers Market'}" <${cleanUser}>`,
            to: String(to).trim(),
            subject: mailSubject,
            html: mailHtml,
            text: content || taskText || noteTitle || 'Thông báo từ FM Workspace'
          });
          sendSuccess = true;
        } catch (err2) {
          lastSendErr = err2;
          console.error('All SMTP send attempts failed:', err2);
        }
      }

      if (sendSuccess) {
        return res.status(200).json({
          success: true,
          message: `Đã gửi email thông báo thành công tới ${to}`
        });
      }

      const errMsg = String(lastSendErr?.message || '');
      let userMsg = 'Không thể gửi email qua máy chủ.';
      if (errMsg.includes('Invalid login') || errMsg.includes('535') || errMsg.includes('Username and Password not accepted')) {
        userMsg = 'Google từ chối mật khẩu. Vui lòng kiểm tra lại Email và đảm bảo dùng Mật khẩu ứng dụng (App Password 16 chữ cái tại myaccount.google.com/apppasswords) thay vì mật khẩu thông thường.';
      } else if (errMsg.includes('ETIMEDOUT') || errMsg.includes('ECONNREFUSED') || errMsg.includes('Greeting never received')) {
        userMsg = 'Kết nối tới máy chủ Google Mail bị quá thời gian (Timeout). Vui lòng thử lại sau.';
      } else if (errMsg) {
        userMsg = `Lỗi gửi thư: ${errMsg}`;
      }

      return res.status(400).json({
        success: false,
        message: userMsg,
        detail: errMsg
      });
    }

    // 6. Sync Workspace Backup (Requires Authentication)
    if (pathname === '/sync/backup' && req.method === 'POST') {
      const auth = verifyAuthToken(req);
      if (!auth.valid) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
          message: auth.error || 'Yêu cầu đăng nhập để đồng bộ dữ liệu lên máy chủ đám mây.'
        });
      }

      const userId = auth.user?.id || auth.user?.email || 'default_user';
      const body = req.body || {};
      const { backupType = 'auto', deviceName, checksum, itemCounts, payload, isEncrypted } = body;
      const now = new Date().toISOString();
      const id = `backup-${Date.now()}`;

      const backupRecord = {
        id,
        user_id: userId,
        created_at: now,
        backup_type: backupType,
        device_name: deviceName || 'Web Client',
        checksum: checksum || 'verified',
        item_counts: itemCounts || {},
        payload: payload || null,
        is_encrypted: Boolean(isEncrypted)
      };

      const userStore = userBackups.get(userId) || { latest: null, history: [] };
      userStore.latest = backupRecord;
      userStore.history.unshift(backupRecord);
      if (userStore.history.length > 20) {
        userStore.history.length = 20;
      }
      userBackups.set(userId, userStore);

      return res.status(200).json({
        success: true,
        message: 'Đã lưu bản sao lưu an toàn thành công trên máy chủ đám mây.',
        data: {
          backupId: id,
          createdAt: now,
          checksum
        }
      });
    }

    // 7. Get Latest Backup (Requires Authentication & User Isolation)
    if (pathname === '/sync/latest') {
      const auth = verifyAuthToken(req);
      if (!auth.valid) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
          message: auth.error || 'Yêu cầu đăng nhập để truy cập dữ liệu sao lưu.'
        });
      }

      const userId = auth.user?.id || auth.user?.email || 'default_user';
      const userStore = userBackups.get(userId);
      const userLatest = userStore?.latest;

      if (!userLatest) {
        return res.status(200).json({
          success: true,
          data: null,
          message: 'Chưa có bản sao lưu nào trên máy chủ đám mây'
        });
      }

      return res.status(200).json({
        success: true,
        data: userLatest
      });
    }

    // 8. Get Backup History & Download (Requires Authentication & User Isolation)
    if (pathname === '/sync/history' || pathname.startsWith('/sync/download')) {
      const auth = verifyAuthToken(req);
      if (!auth.valid) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
          message: auth.error || 'Yêu cầu đăng nhập để tải lịch sử sao lưu.'
        });
      }

      const userId = auth.user?.id || auth.user?.email || 'default_user';
      const userStore = userBackups.get(userId);
      const history = userStore?.history || [];

      if (pathname.startsWith('/sync/download/')) {
        const downloadId = pathname.replace('/sync/download/', '');
        const target = history.find((b) => b.id === downloadId);
        if (!target) {
          return res.status(404).json({
            success: false,
            error: 'NotFound',
            message: 'Không tìm thấy bản sao lưu được yêu cầu'
          });
        }
        return res.status(200).json({
          success: true,
          data: target
        });
      }

      return res.status(200).json({
        success: true,
        data: history
      });
    }

    // 8. AI Extract Image Text (OCR)
    if (pathname === '/ai/extract-image-text' && req.method === 'POST') {
      const { imageDataUrl, apiKeys = [], apiKey } = req.body || {};
      if (!imageDataUrl || typeof imageDataUrl !== 'string') {
        return res.status(400).json({ success: false, message: 'Dữ liệu ảnh không hợp lệ' });
      }

      const keys = [...(Array.isArray(apiKeys) ? apiKeys : []), apiKey, process.env.GEMINI_API_KEY]
        .filter((k) => typeof k === 'string' && k.trim());
      const uniqueKeys = Array.from(new Set(keys));

      if (uniqueKeys.length === 0) {
        return res.status(400).json({
          success: false,
          needsApiKey: true,
          message: 'Chưa cấu hình Gemini API Key. Vui lòng cài đặt khóa API trong Cài đặt → API Key.',
        });
      }

      const dataUrlMatch = imageDataUrl.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/s);
      if (!dataUrlMatch) {
        return res.status(400).json({ success: false, message: 'Định dạng ảnh không được hỗ trợ.' });
      }
      const mimeType = dataUrlMatch[1];
      const base64Data = dataUrlMatch[2];

      const ocrPrompt =
        'Bạn là chuyên gia OCR văn bản chuyên nghiệp. Hãy trích xuất TOÀN BỘ nội dung chữ/văn bản xuất hiện trong hình ảnh một cách đầy đủ và chính xác 100%:\n- Nhận diện chính xác từng từ tiếng Việt có dấu, số hiệu, mã chứng từ (PO, SKU), ngày tháng, giờ giấc, tên riêng, email, số điện thoại.\n- Giữ nguyên trật tự trên-dưới, cấu trúc từng dòng, đoạn văn và các danh sách có đánh số.\n- Không tự ý tóm tắt, không sửa từ, không bỏ qua các dòng chữ nhỏ, chữ ký hay ghi chú ở cuối.\n- Nếu trong ảnh hoàn toàn không có bất kỳ ký tự chữ hay số nào, hãy trả về chính xác: [KHÔNG CÓ VĂN BẢN]\n- Chỉ trả về duy nhất nội dung văn bản thuần túy được trích xuất, tuyệt đối không thêm lời mở đầu hay giải thích.';

      const models = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];
      let lastErr = null;

      for (let kIdx = 0; kIdx < uniqueKeys.length; kIdx++) {
        const k = uniqueKeys[kIdx];
        if (!k.startsWith('AIzaSy')) continue; // Skip non-Gemini keys for Gemini Vision

        for (const model of models) {
          try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${k}`;
            const fetchRes = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [
                  {
                    parts: [
                      { text: ocrPrompt },
                      { inlineData: { mimeType, data: base64Data } },
                    ],
                  },
                ],
                generationConfig: { temperature: 0.1 },
              }),
            });

            if (!fetchRes.ok) {
              const err = await fetchRes.json().catch(() => ({}));
              lastErr = err.error?.message || `HTTP ${fetchRes.status}`;
              if (fetchRes.status === 429) break;
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

      return res.status(500).json({
        success: false,
        message: `Không thể trích xuất nội dung: ${lastErr || 'Lỗi xử lý hình ảnh'}`,
      });
    }

    // 8.1. AI Verify Key endpoint for multi-provider support
    if (pathname === '/ai/verify-key' && req.method === 'POST') {
      const { apiKey, provider, model } = req.body || {};
      const key = apiKey || process.env.GEMINI_API_KEY;
      if (!key || typeof key !== 'string' || !key.trim()) {
        return res.status(400).json({ success: false, message: 'Vui lòng cung cấp API key để kiểm tra' });
      }

      const cleanKey = key.trim();
      const cleanProvider = (provider || '').toLowerCase().trim();

      // DeepSeek
      if (cleanProvider === 'deepseek' || (!cleanProvider && (cleanKey.startsWith('sk-') || /^[a-f0-9]{32}$/i.test(cleanKey)))) {
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

      // Google Gemini (Default for AIzaSy or gemini)
      try {
        const testModels = model ? [model] : ['gemini-2.0-flash', 'gemini-1.5-flash'];
        let lastGErr = '';
        for (const geminiModel of testModels) {
          const fetchRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${cleanKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: 'Ping. Trả lời đúng 1 chữ: OK' }] }],
              generationConfig: { maxOutputTokens: 5 },
            }),
          });

          if (fetchRes.ok) {
            return res.status(200).json({
              success: true,
              provider: 'gemini',
              model: geminiModel,
              message: `Khóa API hoạt động chính xác với Google Gemini! (Model: ${geminiModel})`,
            });
          }

          if (fetchRes.status === 429) {
            return res.status(200).json({
              success: false,
              status: 'quota_exceeded',
              provider: 'gemini',
              model: geminiModel,
              message: 'Hết hạn mức Gemini (429) — Sẵn sàng chuyển dự phòng.',
            });
          }

          const errJson = await fetchRes.json().catch(() => ({}));
          lastGErr = errJson.error?.message || `Mã lỗi ${fetchRes.status}`;
        }

        return res.status(400).json({
          success: false,
          provider: 'gemini',
          message: `Xác thực API Key Gemini thất bại: ${lastGErr || 'Khóa không hợp lệ'}`,
        });
      } catch (gErr) {
        return res.status(400).json({
          success: false,
          provider: 'gemini',
          message: `Lỗi kết nối tới máy chủ Google Gemini: ${gErr.message}`,
        });
      }
    }

    // 9. AI Writing Tool
    if (pathname === '/ai/writing-tool' && req.method === 'POST') {
      const { text, action = 'proofread', apiKeys = [], apiKey } = req.body || {};
      if (!text || typeof text !== 'string') {
        return res.status(400).json({ success: false, message: 'Nội dung văn bản không được để trống' });
      }

      const keys = [...(Array.isArray(apiKeys) ? apiKeys : []), apiKey, process.env.GEMINI_API_KEY]
        .filter((k) => typeof k === 'string' && k.trim());
      const uniqueKeys = Array.from(new Set(keys));

      if (uniqueKeys.length === 0) {
        return res.status(400).json({
          success: false,
          needsApiKey: true,
          message: 'Chưa cấu hình API Key. Vui lòng cài đặt khóa API.',
        });
      }

      let prompt = `Xử lý văn bản sau (${action}): ${text}`;
      let lastErr = null;

      for (let kIdx = 0; kIdx < uniqueKeys.length; kIdx++) {
        const k = uniqueKeys[kIdx];
        try {
          if (k.startsWith('sk-')) {
            // DeepSeek API
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
            // Gemini API
            const gRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${k}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.2 },
              }),
            });
            if (gRes.ok) {
              const data = await gRes.json();
              const result = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
              if (result) {
                return res.status(200).json({
                  success: true,
                  result,
                  model: 'gemini-2.0-flash',
                  usedKeyIndex: kIdx,
                  fallbackKeyUsed: kIdx > 0,
                });
              }
            }
          }
        } catch (err) {
          lastErr = err.message;
        }
      }

      return res.status(500).json({ success: false, message: lastErr || 'Lỗi xử lý văn bản' });
    }

    // 9.1 AI Chat Copilot (Vercel Serverless)
    if (pathname === '/ai/chat' && req.method === 'POST') {
      const { message, conversationId, apiKey, apiKeys } = req.body || {};
      if (!message || typeof message !== 'string') {
        return res.status(400).json({ success: false, message: 'Tin nhắn không được để trống' });
      }
      const rawCandidateKeys = [
        apiKey,
        ...(Array.isArray(apiKeys) ? apiKeys : []),
        globalGeminiKey,
        ...globalGeminiKeysPool.map((k) => k.key),
        process.env.GEMINI_API_KEY,
      ];
      const validKey = rawCandidateKeys.find((k) => typeof k === 'string' && k.startsWith('AIzaSy') && !k.includes('••••'));
      if (!validKey) {
        return res.status(200).json({
          success: true,
          response: '⚠️ **Chưa cấu hình Gemini API Key**\n\nĐể kích hoạt Trợ lý AI Copilot phân tích dữ liệu tự động, vui lòng vào mục **Cài đặt hệ thống** (/settings) và nhập Gemini API Key của bạn.',
        });
      }

      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${validKey}`;
        const chatRes = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: message }] }],
            systemInstruction: {
              parts: [{ text: 'Bạn là Trợ lý AI Cấp cao chuyên trách Thu mua & Merchandising cho Farmers Market (Việt Nam). Hãy trả lời súc tích, chuyên nghiệp bằng tiếng Việt.' }],
            },
          }),
        });
        if (chatRes.ok) {
          const chatData = await chatRes.json();
          const replyText = chatData.candidates?.[0]?.content?.parts?.[0]?.text || 'Không có phản hồi.';
          return res.status(200).json({ success: true, response: replyText, conversationId: conversationId || `conv_${Date.now()}` });
        }
        const errJson = await chatRes.json().catch(() => ({}));
        return res.status(500).json({ success: false, message: errJson.error?.message || 'Lỗi kết nối Gemini' });
      } catch (chatErr) {
        return res.status(500).json({ success: false, message: chatErr.message });
      }
    }

    // 10. Gemini Keys Pool Settings (GET & PUT)
    if (pathname === '/settings/gemini-keys-pool') {
      if (req.method === 'PUT') {
        const body = req.body || {};
        if (Array.isArray(body.pool)) {
          const existingMap = new Map();
          globalGeminiKeysPool.forEach((item) => {
            if (item.id && item.key) existingMap.set(item.id, item.key);
          });
          globalGeminiKeysPool = body.pool.map((item, idx) => {
            let finalKey = (item.key || '').trim();
            if (finalKey.includes('••••') && existingMap.has(item.id)) {
              finalKey = existingMap.get(item.id);
            }
            return {
              id: item.id || `key_${Date.now()}_${idx}`,
              name: item.name || (idx === 0 ? 'Khóa chính' : `Khóa dự phòng #${idx}`),
              key: finalKey,
              isActive: item.isActive !== false,
              status: item.status || 'unchecked',
              statusMessage: item.statusMessage || '',
              model: item.model || 'gemini-2.0-flash',
              lastCheckedAt: item.lastCheckedAt || new Date().toISOString(),
            };
          });
          const activePrimary = globalGeminiKeysPool.find((k) => k.isActive && k.key && !k.key.includes('••••'));
          if (activePrimary) {
            globalGeminiKey = activePrimary.key;
          }
        }
        return res.status(200).json({ success: true, message: 'Đã cập nhật danh sách Khóa API Gemini thành công.' });
      }

      // GET
      const maskedPool = globalGeminiKeysPool.map((item) => ({
        ...item,
        key: item.key ? `${item.key.substring(0, 6)}••••••••${item.key.slice(-4)}` : '',
        rawKeyPreview: item.key ? `${item.key.substring(0, 8)}...` : '',
      }));
      return res.status(200).json({ success: true, data: maskedPool });
    }

    if (pathname === '/settings/gemini-key' && req.method === 'PUT') {
      const { api_key } = req.body || {};
      if (api_key && typeof api_key === 'string' && !api_key.includes('••••')) {
        globalGeminiKey = api_key.trim();
        if (globalGeminiKeysPool.length === 0) {
          globalGeminiKeysPool.push({
            id: 'key_primary',
            name: 'Khóa chính (Mặc định)',
            key: globalGeminiKey,
            isActive: true,
            status: 'active',
            model: 'gemini-2.0-flash',
            lastCheckedAt: new Date().toISOString(),
          });
        } else {
          globalGeminiKeysPool[0].key = globalGeminiKey;
        }
      }
      return res.status(200).json({ success: true, message: 'Đã lưu khóa API Gemini thành công.' });
    }

    // 11. PO Tracker Endpoints (Vercel Cloud Serverless Support)
    if (pathname.startsWith('/po-tracker')) {
      // 11.0 PO Upload & AI Extraction (Vercel Serverless)
      if ((pathname === '/po-tracker/upload-pdf' || pathname === '/po-tracker/upload-file') && req.method === 'POST') {
        let body = req.body || {};
        if (typeof body === 'string') {
          try { body = JSON.parse(body); } catch (_) { body = {}; }
        }
        let base64Data = '';
        let mimeType = 'application/pdf';
        let fileName = body.fileName || 'po-document.pdf';

        if (body.fileDataUrl && typeof body.fileDataUrl === 'string') {
          const match = body.fileDataUrl.match(/^data:([^;]+);base64,(.+)$/s);
          if (match) {
            mimeType = match[1];
            base64Data = match[2];
          } else {
            base64Data = body.fileDataUrl;
          }
        } else if (body.imageDataUrl && typeof body.imageDataUrl === 'string') {
          const match = body.imageDataUrl.match(/^data:([^;]+);base64,(.+)$/s);
          if (match) {
            mimeType = match[1];
            base64Data = match[2];
          } else {
            base64Data = body.imageDataUrl;
          }
        }

        if (body.mimeType) mimeType = body.mimeType;

        if (!base64Data) {
          return res.status(400).json({ success: false, message: 'Vui lòng cung cấp dữ liệu tệp (base64/dataUrl).' });
        }

        const rawKeys = [
          ...(Array.isArray(body.apiKeys) ? body.apiKeys : []),
          body.apiKey,
          globalGeminiKey,
          ...globalGeminiKeysPool.map((p) => p.key),
          process.env.GEMINI_API_KEY
        ];
        const uniqueKeys = Array.from(
          new Set(
            rawKeys
              .filter((k) => typeof k === 'string' && k.trim().length > 0)
              .map((k) => k.trim())
              .filter((k) => k.startsWith('AIzaSy') && !k.includes('••••'))
          )
        );

        if (uniqueKeys.length === 0) {
          return res.status(400).json({
            success: false,
            needsApiKey: true,
            message: 'Chưa cấu hình Gemini API Key hợp lệ. Vui lòng thêm khóa trong mục Cài đặt → API Key (bắt đầu bằng AIzaSy).',
          });
        }

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
7. Đơn vị tiền tệ ("currency"): Mặc định "VND".
8. Danh sách mặt hàng ("items"):
   Duyệt qua từng dòng trong bảng chi tiết hàng hóa:
   - "item_code": Lấy từ cột "Internal Code" hoặc "Barcode/PLU" (ví dụ: "10028694").
   - "item_name": Lấy từ cột "Mặt hàng" hoặc "Tên hàng hóa" (ví dụ: "Cam vàng phủ cacao Ohla 120 g ( Hộp )").
   - "ordered_qty": Số lượng đặt hàng (chuyển ví dụ "42,00" -> 42).
   - "unit": Đơn vị tính từ cột "DVT" (ví dụ: "Hộp", "Thùng", "Kg", "Gói", "Chai").
   - "unit_price": Lấy từ "Đơn giá chưa VAT (VND)" hoặc "Đơn giá" (chuyển ví dụ "116.364,00" -> 116364).
   - "total_price": Lấy từ "Thành tiền chưa VAT (VND)" hoặc "Thành tiền" (chuyển ví dụ "4.887.288,00" -> 4887288).
   - "warehouse": Chi nhánh hoặc kho nếu có trên dòng.
9. Ghi chú ("notes"): Lưu các điều khoản hoặc người đặt hàng (ví dụ: "Người đặt: Nguyễn Hùng Tiến").

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

        const models = ['gemini-2.0-flash', 'gemini-1.5-flash'];
        let lastErr = null;

        for (const k of uniqueKeys) {
          for (const model of models) {
            try {
              const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${k}`;
              const fetchRes = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  contents: [
                    {
                      parts: [
                        { text: prompt },
                        { inlineData: { mimeType, data: base64Data } },
                      ],
                    },
                  ],
                  generationConfig: {
                    temperature: 0.0,
                    responseMimeType: 'application/json'
                  },
                }),
              });

              if (!fetchRes.ok) {
                const errData = await fetchRes.json().catch(() => ({}));
                lastErr = errData.error?.message || `HTTP ${fetchRes.status}`;
                if (fetchRes.status === 429) break;
                continue;
              }

              const resJson = await fetchRes.json();
              const text = resJson.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '{}';
              const parsed = safeParseAIJson(text);

              return res.status(200).json({
                success: true,
                data: {
                  ...parsed,
                  pdf_file_name: fileName
                }
              });
            } catch (err) {
              lastErr = err.message;
            }
          }
        }

        return res.status(500).json({
          success: false,
          message: `Không thể trích xuất PO: ${lastErr || 'Lỗi xử lý file qua AI'}`
        });
      }

      // 11.1 Folders
      if (pathname === '/po-tracker/folders') {
        if (req.method === 'GET') {
          const list = globalPoFolders.map((f) => ({
            ...f,
            po_count: globalPoRecords.filter((p) => p.folder_id === f.id).length
          }));
          return res.status(200).json({ success: true, data: list });
        }
        if (req.method === 'POST') {
          const body = req.body || {};
          const newFolder = {
            id: `f-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            name: (body.name || 'Nhóm mới').trim(),
            description: body.description || null,
            color: body.color || 'blue',
            icon: body.icon || 'shippingbox',
            sort_order: Number(body.sort_order || 0),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          globalPoFolders.push(newFolder);
          return res.status(200).json({ success: true, data: { ...newFolder, po_count: 0 } });
        }
      }

      if (pathname.startsWith('/po-tracker/folders/')) {
        const folderId = pathname.replace('/po-tracker/folders/', '');
        const idx = globalPoFolders.findIndex((f) => f.id === folderId);
        if (idx === -1) {
          return res.status(404).json({ success: false, message: 'Nhóm không tồn tại' });
        }
        if (req.method === 'PUT') {
          const body = req.body || {};
          globalPoFolders[idx] = {
            ...globalPoFolders[idx],
            name: body.name ? body.name.trim() : globalPoFolders[idx].name,
            description: body.description !== undefined ? body.description : globalPoFolders[idx].description,
            color: body.color || globalPoFolders[idx].color,
            updated_at: new Date().toISOString()
          };
          return res.status(200).json({ success: true, data: globalPoFolders[idx] });
        }
        if (req.method === 'DELETE') {
          globalPoFolders.splice(idx, 1);
          globalPoRecords.forEach((p) => {
            if (p.folder_id === folderId) p.folder_id = null;
          });
          return res.status(200).json({ success: true, message: 'Đã xóa nhóm' });
        }
      }

      // 11.2 Stats
      if (pathname === '/po-tracker/stats') {
        const folderId = req.query?.folder_id;
        const filtered = folderId
          ? folderId === 'unassigned'
            ? globalPoRecords.filter((p) => !p.folder_id)
            : globalPoRecords.filter((p) => p.folder_id === folderId)
          : globalPoRecords;

        const today = new Date().toISOString().split('T')[0];
        const next7 = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];

        const stats = {
          total: filtered.length,
          pending: filtered.filter((p) => p.status === 'pending').length,
          confirmed: filtered.filter((p) => p.status === 'confirmed').length,
          shipping: filtered.filter((p) => p.status === 'shipping').length,
          partial_received: filtered.filter((p) => p.status === 'partial_received').length,
          received: filtered.filter((p) => p.status === 'received').length,
          cancelled: filtered.filter((p) => p.status === 'cancelled').length,
          overdue: filtered.filter((p) => p.status === 'overdue').length,
          actually_overdue: filtered.filter((p) => !['received', 'cancelled'].includes(p.status) && p.expected_delivery_date && p.expected_delivery_date < today).length,
          upcoming_7_days: filtered.filter((p) => !['received', 'cancelled'].includes(p.status) && p.expected_delivery_date && p.expected_delivery_date >= today && p.expected_delivery_date <= next7).length,
          total_value: filtered.reduce((s, p) => s + (Number(p.total_value) || 0), 0)
        };
        return res.status(200).json({ success: true, data: stats });
      }

      // 11.3 PO List & Create
      if (pathname === '/po-tracker/pos' && req.method === 'GET') {
        const { folder_id, status, search } = req.query || {};
        let list = [...globalPoRecords];

        if (folder_id === 'unassigned') {
          list = list.filter((p) => !p.folder_id);
        } else if (folder_id) {
          list = list.filter((p) => p.folder_id === folder_id);
        }

        const today = new Date().toISOString().split('T')[0];
        if (status === 'overdue') {
          list = list.filter((p) => p.status === 'overdue' || (!['received', 'cancelled'].includes(p.status) && p.expected_delivery_date && p.expected_delivery_date < today));
        } else if (status) {
          list = list.filter((p) => p.status === status);
        }

        if (search) {
          const q = search.toLowerCase();
          list = list.filter((p) =>
            (p.po_number && p.po_number.toLowerCase().includes(q)) ||
            (p.supplier_name && p.supplier_name.toLowerCase().includes(q)) ||
            (p.warehouse && p.warehouse.toLowerCase().includes(q))
          );
        }

        list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        return res.status(200).json({ success: true, data: list });
      }

      if (pathname === '/po-tracker/pos' && req.method === 'POST') {
        const body = req.body || {};
        const newPO = {
          id: `po-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          folder_id: body.folder_id || null,
          folder_name: globalPoFolders.find((f) => f.id === body.folder_id)?.name || null,
          po_number: body.po_number || `PO-${Date.now().toString().slice(-6)}`,
          po_date: body.po_date || new Date().toISOString().split('T')[0],
          expected_delivery_date: body.expected_delivery_date || null,
          actual_delivery_date: body.actual_delivery_date || null,
          supplier_code: body.supplier_code || null,
          supplier_name: body.supplier_name || null,
          warehouse: body.warehouse || null,
          status: body.status || 'pending',
          total_value: Number(body.total_value || 0),
          currency: body.currency || 'VND',
          notes: body.notes || null,
          pdf_file_name: body.pdf_file_name || null,
          items: Array.isArray(body.items) ? body.items.map((it, idx) => ({
            id: `item-${Date.now()}-${idx}`,
            item_code: it.item_code || null,
            item_name: it.item_name || 'Hàng hóa',
            unit: it.unit || 'thùng',
            ordered_qty: Number(it.ordered_qty || 1),
            received_qty: Number(it.received_qty || 0),
            unit_price: Number(it.unit_price || 0),
            total_price: Number(it.total_price || 0),
            status: it.status || 'pending'
          })) : [],
          item_count: Array.isArray(body.items) ? body.items.length : 0,
          total_ordered_qty: Array.isArray(body.items) ? body.items.reduce((s, i) => s + (Number(i.ordered_qty) || 0), 0) : 0,
          total_received_qty: Array.isArray(body.items) ? body.items.reduce((s, i) => s + (Number(i.received_qty) || 0), 0) : 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        globalPoRecords.unshift(newPO);
        return res.status(200).json({ success: true, data: newPO });
      }

      // 11.4 Single PO Detail / Update / Status
      if (pathname.startsWith('/po-tracker/pos/')) {
        const sub = pathname.replace('/po-tracker/pos/', '');
        const isStatusPatch = sub.endsWith('/status');
        const poId = isStatusPatch ? sub.replace('/status', '') : sub;
        const target = globalPoRecords.find((p) => p.id === poId);

        if (!target) {
          return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng' });
        }

        if (isStatusPatch && req.method === 'PATCH') {
          const { status, actual_delivery_date, notes } = req.body || {};
          if (status) target.status = status;
          if (actual_delivery_date) {
            target.actual_delivery_date = actual_delivery_date;
          } else if (status === 'received' && !target.actual_delivery_date) {
            target.actual_delivery_date = new Date().toISOString().split('T')[0];
          }
          if (notes !== undefined) target.notes = notes;
          target.updated_at = new Date().toISOString();
          return res.status(200).json({ success: true, message: 'Đã cập nhật trạng thái đơn hàng' });
        }

        if (req.method === 'GET') {
          return res.status(200).json({
            success: true,
            data: {
              ...target,
              permissions: globalPoPermissions.filter((perm) => perm.resource_id === poId),
              user_permission: 'admin'
            }
          });
        }

        if (req.method === 'PUT') {
          const body = req.body || {};
          if (Array.isArray(body.items)) {
            body.item_count = body.items.length;
            body.total_ordered_qty = body.items.reduce((s, i) => s + (Number(i.ordered_qty) || 0), 0);
            body.total_received_qty = body.items.reduce((s, i) => s + (Number(i.received_qty) || 0), 0);
          }
          if (body.status === 'received' && !body.actual_delivery_date && !target.actual_delivery_date) {
            body.actual_delivery_date = new Date().toISOString().split('T')[0];
          }
          Object.assign(target, {
            ...body,
            updated_at: new Date().toISOString()
          });
          return res.status(200).json({ success: true, data: target });
        }

        if (req.method === 'DELETE') {
          const idx = globalPoRecords.findIndex((p) => p.id === poId);
          if (idx !== -1) globalPoRecords.splice(idx, 1);
          return res.status(200).json({ success: true, message: 'Đã xóa đơn hàng' });
        }
      }

      // 11.5 Permissions
      if (pathname.startsWith('/po-tracker/permissions')) {
        if (req.method === 'POST') {
          const body = req.body || {};
          const newPerm = {
            id: `perm-${Date.now()}`,
            user_id: body.target_user_id,
            user_name: body.target_user_id,
            email: body.target_user_id,
            resource_type: body.resource_type || 'po',
            resource_id: body.resource_id || null,
            permission: body.permission || 'view',
            created_at: new Date().toISOString()
          };
          globalPoPermissions.push(newPerm);
          return res.status(200).json({ success: true, message: 'Đã cấp quyền thành công', data: newPerm });
        }
        if (req.method === 'DELETE') {
          const permId = pathname.replace('/po-tracker/permissions/', '');
          const idx = globalPoPermissions.findIndex((p) => p.id === permId);
          if (idx !== -1) globalPoPermissions.splice(idx, 1);
          return res.status(200).json({ success: true, message: 'Đã thu hồi quyền' });
        }
      }
    }

    // Fallback for unknown /api routes
    return res.status(404).json({
      success: false,
      error: 'NotFound',
      message: `Endpoint ${pathname} không tồn tại trên Cloud API`
    });
  } catch (error) {
    console.error('API Serverless Error:', error);
    return res.status(500).json({
      success: false,
      error: error.name || 'ServerError',
      message: error.message || 'Lỗi xử lý yêu cầu phía máy chủ'
    });
  }
}
