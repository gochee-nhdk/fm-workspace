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

function extractCleanBase64(dataUrl) {
  let mimeType = 'application/pdf';
  let base64 = dataUrl || '';
  const commaIdx = base64.indexOf(',');
  if (commaIdx !== -1) {
    const meta = base64.substring(0, commaIdx);
    const mimeMatch = meta.match(/data:([^;]+)/i);
    if (mimeMatch && mimeMatch[1]) {
      mimeType = mimeMatch[1].trim();
    }
    base64 = base64.substring(commaIdx + 1);
  }
  base64 = base64.replace(/\s+/g, '');
  return { mimeType, base64 };
}

function cleanVietnameseNumber(val) {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val) return 0;
  let str = String(val).trim();
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(str)) {
    str = str.replace(/\./g, '').replace(',', '.');
  } else if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(str)) {
    str = str.replace(/,/g, '');
  } else {
    if (/^\d+,\d+$/.test(str)) {
      str = str.replace(',', '.');
    } else {
      str = str.replace(/[^\d.-]/g, '');
    }
  }
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

function cleanVietnameseDate(val) {
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

  const monthMap = {
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

function extractMetadataFromFileName(fileName) {
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

function enrichWithFileNameHints(data, fileName) {
  if (!fileName) return data;
  const hints = extractMetadataFromFileName(fileName);
  return {
    ...data,
    po_number: data.po_number || hints.po_number || null,
    warehouse: data.warehouse || hints.warehouse || null,
    supplier_name: data.supplier_name || hints.supplier_name || null,
  };
}

function safeParseAIJson(text, fileName) {
  if (!text || typeof text !== 'string') return {};
  let trimmed = text.trim();

  trimmed = trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  let rawParsed = null;

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
    const fallbackObj = { items: [] };
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

  const normalized = {
    ...rawParsed,
    po_date: cleanVietnameseDate(rawParsed.po_date),
    expected_delivery_date: cleanVietnameseDate(rawParsed.expected_delivery_date),
    total_value: cleanVietnameseNumber(rawParsed.total_value),
  };

  if (normalized.supplier_name && /LARIA|FARMERS.*MARKET/i.test(normalized.supplier_name)) {
    normalized.supplier_name = '';
  }

  if (Array.isArray(rawParsed.items)) {
    normalized.items = rawParsed.items
      .map((it) => {
        if (!it || typeof it !== 'object') return null;
        const ordered_qty = cleanVietnameseNumber(it.ordered_qty || 1);
        const unit_price = cleanVietnameseNumber(it.unit_price || 0);
        const total_price = cleanVietnameseNumber(it.total_price || (ordered_qty * unit_price));
        return {
          item_code: String(it.item_code || it.internal_code || it.barcode || '').trim(),
          item_name: String(it.item_name || it.description || 'Sản phẩm').trim(),
          unit: String(it.unit || 'Hộp').trim(),
          ordered_qty: ordered_qty > 0 ? ordered_qty : 1,
          unit_price,
          total_price,
          warehouse: String(it.warehouse || normalized.warehouse || '').trim(),
        };
      })
      .filter((it) => it && (it.item_name || it.item_code));
  } else {
    normalized.items = [];
  }

  return enrichWithFileNameHints(normalized, fileName);
}

const serverModelCache = new Map();

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
    if (vB !== vA) {
      return vB - vA; // Higher version first (2.5 > 2.0 > 1.5)
    }
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
  if (cached && (Date.now() - cached.timestamp < 10 * 60 * 1000) && cached.models.length > 0) {
    return cached.models;
  }

  const foundModels = new Set();
  const endpoints = [
    `https://generativelanguage.googleapis.com/v1beta/models?key=${cleanKey}`,
    `https://generativelanguage.googleapis.com/v1/models?key=${cleanKey}`
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
        for (const m of models) {
          foundModels.add(m);
        }
      }
    } catch (_) {}
  }

  let finalModels = [];
  if (foundModels.size > 0) {
    finalModels = sortGeminiModelsNewestFirst(Array.from(foundModels));
  } else {
    finalModels = [
      'gemini-2.0-flash',
      'gemini-2.5-flash',
      'gemini-1.5-flash',
      'gemini-2.0-flash-lite'
    ];
  }

  serverModelCache.set(cleanKey, { models: finalModels, timestamp: Date.now() });
  return finalModels;
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

      let lastErr = null;

      for (let kIdx = 0; kIdx < uniqueKeys.length; kIdx++) {
        const k = uniqueKeys[kIdx];
        if (k.startsWith('sk-') || k.includes('••••')) continue; // Skip non-Gemini or masked keys

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
                continue; // Thử model khác khi 429 trên 1 model cụ thể
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

      // Google Gemini (Default for AIzaSy, AQ. or any Gemini key)
      try {
        // Bước 1: Kiểm tra siêu tốc qua ListModels của Google mà không tiêu tốn hạn mức generateContent (0 RPM quota)
        try {
          const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${cleanKey}`);
          if (listRes.ok) {
            const data = await listRes.json();
            const models = (data.models || [])
              .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
              .map((m) => (m.name || '').replace(/^models\//, ''))
              .filter((m) => (m || '').toLowerCase().startsWith('gemini'));

            const sorted = models.length > 0
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

        // Bước 2: Thử ping trực tiếp mô hình gemini-2.0-flash
        const fetchRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${cleanKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'OK' }] }],
            generationConfig: { maxOutputTokens: 5 },
          }),
        });

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
        const lastGErr = errJson.error?.message || `Mã lỗi ${fetchRes.status}`;
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
            // Gemini API (Auto-detect newest model)
            const gModels = await discoverBestGeminiModels(k);
            for (const gm of gModels) {
              for (const apiVer of ['v1beta', 'v1']) {
                try {
                  const gRes = await fetch(`https://generativelanguage.googleapis.com/${apiVer}/models/${gm}:generateContent?key=${k}`, {
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
      const validKey = rawCandidateKeys.find((k) => typeof k === 'string' && (k.startsWith('AIzaSy') || k.startsWith('AQ.') || (!k.startsWith('sk-') && k.length >= 20)) && !k.includes('••••'));
      if (!validKey) {
        return res.status(200).json({
          success: true,
          response: '⚠️ **Chưa cấu hình Gemini API Key**\n\nĐể kích hoạt Trợ lý AI Copilot phân tích dữ liệu tự động, vui lòng vào mục **Cài đặt hệ thống** (/settings) và nhập Gemini API Key của bạn.',
        });
      }

      try {
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
                    parts: [{ text: 'Bạn là Trợ lý AI Cấp cao chuyên trách Thu mua & Merchandising cho Farmers Market (Việt Nam). Hãy trả lời súc tích, chuyên nghiệp bằng tiếng Việt.' }],
                  },
                }),
              });
              if (chatRes.ok) {
                const chatData = await chatRes.json();
                const replyText = chatData.candidates?.[0]?.content?.parts?.[0]?.text || 'Không có phản hồi.';
                return res.status(200).json({ success: true, response: replyText, conversationId: conversationId || `conv_${Date.now()}` });
              }
            } catch (_) {}
          }
        }
        return res.status(500).json({ success: false, message: 'Không thể kết nối đến Gemini AI với các mô hình hiện có.' });
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
          const extracted = extractCleanBase64(body.fileDataUrl);
          mimeType = extracted.mimeType || mimeType;
          base64Data = extracted.base64;
        } else if (body.imageDataUrl && typeof body.imageDataUrl === 'string') {
          const extracted = extractCleanBase64(body.imageDataUrl);
          mimeType = extracted.mimeType || mimeType;
          base64Data = extracted.base64;
        }

        if (body.mimeType) mimeType = body.mimeType;
        const isPdf = fileName.toLowerCase().endsWith('.pdf') || mimeType.includes('pdf');
        if (isPdf) mimeType = 'application/pdf';

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
              .filter((k) => (k.startsWith('AIzaSy') || k.startsWith('AQ.') || (!k.startsWith('sk-') && k.length >= 20)) && !k.includes('••••'))
          )
        );

        if (uniqueKeys.length === 0) {
          return res.status(400).json({
            success: false,
            needsApiKey: true,
            message: 'Chưa cấu hình Gemini API Key hợp lệ. Vui lòng thêm khóa trong mục Cài đặt → API Key.',
          });
        }

        const prompt = `Bạn là chuyên gia phân tích và bóc tách dữ liệu chứng từ Đơn mua hàng (PO - Purchase Order) của hệ thống siêu thị FARMERS MARKET (CÔNG TY TNHH THƯƠNG MẠI LARIA) và các chuỗi bán lẻ tại Việt Nam.

Hãy phân tích toàn bộ nội dung tài liệu (PDF / Hình ảnh) được cung cấp và trích xuất đầy đủ, chính xác tất cả các thông tin sau theo cấu trúc JSON:

QUY TẮC BÓC TÁCH CHUẨN XÁC:
1. "po_number" (Số hiệu PO / Mã đơn hàng):
   - Lấy sau "Số hiệu chứng từ:", "Số PO", "Số đơn đặt hàng", hoặc mã 5-8 chữ số ở đầu chứng từ (ví dụ: "PO-118292", "PO-118873", "PO-118744"). Nếu chưa có tiền tố "PO-", hãy thêm "PO-". Tham khảo tên file: "${fileName}".
2. "supplier_name" (Tên Nhà cung cấp / Đơn vị cung ứng):
   - QUAN TRỌNG: "CÔNG TY TNHH THƯƠNG MẠI LARIA - FARMERS MARKET" là BÊN MUA HÀNG (Buyer), TUYỆT ĐỐI KHÔNG LẤY TÊN NÀY LÀM NHÀ CUNG CẤP!
   - TÊN NHÀ CUNG CẤP là đơn vị nằm sau nhãn "Tên NCC:" (ví dụ: "CÔNG TY CỔ PHẦN DEVIE", "CÔNG TY TNHH BẢO MINH", "CENTRAL RETAIL").
3. "supplier_code" (Mã Nhà cung cấp):
   - Lấy sau nhãn "Mã NCC:" (ví dụ: "V0001613", "V0001834").
4. "po_date" (Ngày lập chứng từ PO):
   - Lấy sau nhãn "Ngày chứng từ:" (ví dụ: "2/11/2026" chuẩn hóa thành "2026-11-02").
5. "expected_delivery_date" (Hạn giao hàng / Ngày giao dự kiến):
   - Lấy sau nhãn "Ngày giao hàng:" (ví dụ: "5/11/2026" chuẩn hóa thành "2026-11-05").
6. "warehouse" (Kho nhận hàng / Chi nhánh yêu cầu):
   - Lấy sau "Chi nhánh yêu cầu:" hoặc "Địa chỉ giao hàng:" (ví dụ: "DC01 - Nơ Trang Long, 204 Nơ Trang Long, Phường Bình Thạnh, TP.HCM").
7. "total_value" (Tổng giá trị đơn hàng / Tổng thanh toán):
   - Lấy từ dòng "TỔNG TIỀN HÀNG" hoặc "TỔNG CỘNG TRƯỚC THUẾ VAT", là một số thực nguyên bản (bỏ các dấu phân cách chấm, phẩy). Ví dụ: 9021888 hoặc 8353600.
8. "currency": Đơn vị tiền tệ, mặc định "VND".
9. "notes": Người đặt hàng từ nhãn "Người đặt hàng:" (ví dụ: "Nguyễn Hùng Tiến").
10. "items" (Danh sách toàn bộ các dòng mặt hàng trong bảng ĐƠN MUA HÀNG):
    Bóc tách ĐẦY ĐỦ TẤT CẢ các dòng sản phẩm trong bảng chi tiết, tuyệt đối không bỏ sót dòng nào:
    - "item_code": Cột "Internal Code" hoặc "Barcode/PLU" (ví dụ: "10015745").
    - "item_name": Cột "Mặt hàng" (ví dụ: "Hạt dinh dưỡng Your SuperFood Mix nhiều loại hạt hũ 400 g").
    - "ordered_qty": Cột "Số lượng" (kiểu số thực, ví dụ: 46).
    - "unit": Cột "DVT" (ví dụ: "Hũ", "Hộp", "Thùng", "Kg", "Gói", "Chai", "Lon", "Túi", "Cái").
    - "unit_price": Cột "Đơn giá chưa VAT" hoặc "Đơn giá chưa VAT sau chiết khấu" (kiểu số, ví dụ: 181600).
    - "total_price": Cột "Thành tiền chưa VAT" (kiểu số, ví dụ: 8353600).
    - "warehouse": Kho nhận nếu có (ví dụ: "DC01 - Nơ Trang Long").

Chỉ trả về DUY NHẤT một chuỗi JSON hợp lệ, không bọc markdown fence, không kèm lời chào.`;

        let lastErr = null;

        for (const k of uniqueKeys) {
          const models = await discoverBestGeminiModels(k);
          const priorityModels = Array.from(new Set([
            'gemini-2.0-flash',
            'gemini-2.5-flash',
            ...models,
            'gemini-1.5-flash',
            'gemini-2.0-flash-lite',
          ])).filter((m) => !m.includes('pro'));

          for (const model of priorityModels) {
            for (const apiVer of ['v1beta', 'v1']) {
              try {
                const url = `https://generativelanguage.googleapis.com/${apiVer}/models/${model}:generateContent?key=${k}`;
                const isV1Beta = apiVer === 'v1beta';

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
                      temperature: 0.1,
                      maxOutputTokens: 8192,
                      ...(isV1Beta ? { responseMimeType: 'application/json' } : {}),
                    },
                  }),
                });

                if (!fetchRes.ok) {
                  const errData = await fetchRes.json().catch(() => ({}));
                  lastErr = errData.error?.message || `HTTP ${fetchRes.status}`;
                  continue; // Tiếp tục thử model khác nếu model hiện tại bị 429
                }

                const resJson = await fetchRes.json();
                const text = resJson.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '{}';
                const parsed = safeParseAIJson(text, fileName);

                if (parsed && (parsed.po_number || parsed.supplier_name || (parsed.items && parsed.items.length > 0))) {
                  return res.status(200).json({
                    success: true,
                    data: {
                      ...parsed,
                      pdf_file_name: fileName
                    }
                  });
                }
              } catch (err) {
                lastErr = err.message;
              }
            }
          }
        }

        // Cứu dữ liệu cơ bản từ tên file nếu các model AI đều không đọc được nội dung
        const fallbackHints = extractMetadataFromFileName(fileName);
        return res.status(200).json({
          success: true,
          isFallback: true,
          data: {
            po_number: fallbackHints.po_number || null,
            po_date: new Date().toISOString().split('T')[0],
            expected_delivery_date: null,
            supplier_code: null,
            supplier_name: fallbackHints.supplier_name || null,
            warehouse: fallbackHints.warehouse || null,
            total_value: null,
            currency: 'VND',
            notes: `Bóc tách từ tên tệp: ${fileName}`,
            items: [],
            pdf_file_name: fileName
          }
        });
            items: [],
            pdf_file_name: fileName
          }
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
