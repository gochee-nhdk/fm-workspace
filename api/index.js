const nodemailer = require('nodemailer');
const crypto = require('crypto');

// In-memory runtime cache for serverless environment (isolated per user)
let globalSmtpConfig = null;
const userBackups = new Map(); // userId -> { latest: backupData, history: [backupData] }

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
            const gRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${k}`, {
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
                  model: 'gemini-2.5-flash',
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

    // 10. Gemini Keys Pool Settings (GET & PUT)
    if (pathname === '/settings/gemini-keys-pool') {
      return res.status(200).json({ success: true, data: [] });
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
