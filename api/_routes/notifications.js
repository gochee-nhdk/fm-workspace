const nodemailer = require('nodemailer');
const { z } = require('zod');
const { getDb } = require('../_lib/db');
const { encryptSecret, decryptSecret, maskSecret } = require('../_lib/crypto');
const { sendError, parseZodError, escapeHtml, verifyAuth } = require('../_lib/http');

const verifySmtpSchema = z.object({
  user: z.string().trim().email('Email SMTP không hợp lệ').max(254),
  pass: z.string().min(1, 'Vui lòng cung cấp Mật khẩu ứng dụng (Google App Password).').max(200),
  host: z.string().trim().max(254).optional(),
  port: z.coerce.number().int().min(1).max(65535).optional(),
});

const smtpConfigSchema = verifySmtpSchema.extend({
  senderName: z.string().trim().max(150).optional(),
});

const sendEmailSchema = z.object({
  to: z.string().trim().email('Địa chỉ email người nhận không hợp lệ').max(254),
  subject: z.string().trim().max(500).optional(),
  content: z.string().max(50000).optional(),
  noteTitle: z.string().max(500).optional(),
  taskText: z.string().max(5000).optional(),
  smtpConfig: z
    .object({
      user: z.string().trim().email().max(254),
      pass: z.string().min(1).max(200),
      host: z.string().trim().max(254).optional(),
      port: z.coerce.number().int().min(1).max(65535).optional(),
      senderName: z.string().trim().max(150).optional(),
    })
    .optional(),
});

function buildTransporter(host, port, secure, user, pass, timeoutMs = 8000) {
  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    tls: { rejectUnauthorized: false },
    connectionTimeout: timeoutMs,
    greetingTimeout: Math.min(timeoutMs, 6000),
    socketTimeout: timeoutMs + 2000,
  });
}

async function verifySmtpConnection(host, primaryPort, user, pass) {
  let lastErr = null;
  const ports = [primaryPort, primaryPort === 465 ? 587 : 465];
  for (const p of ports) {
    try {
      const t = buildTransporter(host, p, p === 465, user, pass, 8000);
      await t.verify();
      return { ok: true, port: p };
    } catch (err) {
      lastErr = err;
    }
  }
  return { ok: false, error: lastErr };
}

function mapSmtpErrorMessage(err) {
  const errMsg = String(err?.message || '');
  if (
    errMsg.includes('Invalid login') ||
    errMsg.includes('535') ||
    errMsg.includes('Username and Password not accepted')
  ) {
    return 'Google từ chối mật khẩu. Vui lòng tạo "Mật khẩu ứng dụng" (App Password 16 ký tự tại myaccount.google.com/apppasswords) thay vì mật khẩu thông thường.';
  }
  if (
    errMsg.includes('ETIMEDOUT') ||
    errMsg.includes('ECONNREFUSED') ||
    errMsg.includes('Greeting never received')
  ) {
    return 'Kết nối tới máy chủ Google Mail bị quá thời gian (Timeout). Vui lòng thử lại sau.';
  }
  return errMsg
    ? `Không thể xác thực với máy chủ gửi thư: ${errMsg}`
    : 'Không thể xác thực với máy chủ Google Mail.';
}

async function getUserSmtpConfig(userId) {
  const db = await getDb();
  const res = await db.execute({
    sql: 'SELECT host, port, secure, smtp_user, encrypted_pass, sender_name FROM smtp_configs WHERE user_id = ? LIMIT 1',
    args: [userId],
  });
  const row = res.rows[0];
  if (row && row.smtp_user && row.encrypted_pass) {
    const pass = decryptSecret(row.encrypted_pass);
    if (pass) {
      return {
        host: row.host || 'smtp.gmail.com',
        port: Number(row.port) || 587,
        secure: Boolean(row.secure),
        user: row.smtp_user,
        pass,
        senderName: row.sender_name || 'Trợ Lý Thu Mua • Farmers Market',
        configured: true,
      };
    }
  }

  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    return {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT) || 465,
      secure: (Number(process.env.SMTP_PORT) || 465) === 465,
      user: process.env.SMTP_USER.trim(),
      pass: process.env.SMTP_PASS.trim(),
      senderName: process.env.SMTP_SENDER_NAME || 'Trợ Lý Thu Mua • Farmers Market',
      configured: true,
    };
  }

  return null;
}

async function handleNotificationsRoute(req, res, pathname) {
  const auth = await verifyAuth(req);
  if (!auth.valid) {
    return sendError(res, 401, 'Unauthorized', auth.error || 'Yêu cầu đăng nhập để sử dụng tính năng email.');
  }
  const userId = auth.user.id;

  // GET /notifications/smtp-status
  if (pathname === '/notifications/smtp-status' && req.method === 'GET') {
    const config = await getUserSmtpConfig(userId);
    if (!config || !config.user) {
      return res.status(200).json({
        success: true,
        configured: false,
        message: 'Chưa có cấu hình SMTP máy chủ',
      });
    }

    const maskedUser = config.user.replace(/^(.)(.*)(@.*)$/, (_, first, mid, last) =>
      `${first}${'*'.repeat(Math.max(mid.length, 3))}${last}`
    );

    return res.status(200).json({
      success: true,
      configured: true,
      smtpHost: config.host,
      smtpPort: config.port,
      smtpUser: maskedUser || maskSecret(config.user, 2, 4),
      fullUser: config.user,
      senderName: config.senderName,
    });
  }

  // POST /notifications/verify-smtp
  if (pathname === '/notifications/verify-smtp' && req.method === 'POST') {
    const parsed = verifySmtpSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return sendError(res, 400, 'ValidationError', parseZodError(parsed.error));
    }

    const cleanUser = parsed.data.user;
    const cleanPass = parsed.data.pass.replace(/\s+/g, '');
    const smtpHost = parsed.data.host || 'smtp.gmail.com';
    const isGmail = smtpHost.includes('gmail') || cleanUser.includes('@gmail.com');
    const primaryPort = parsed.data.port || (isGmail ? 465 : 587);

    const check = await verifySmtpConnection(smtpHost, primaryPort, cleanUser, cleanPass);
    if (check.ok) {
      return res.status(200).json({
        success: true,
        configured: true,
        smtpHost,
        smtpPort: check.port,
        smtpUser: cleanUser,
        message: 'Xác thực tài khoản và kết nối máy chủ gửi thư SMTP thành công!',
      });
    }

    return res.status(400).json({
      success: false,
      message: mapSmtpErrorMessage(check.error),
      detail: check.error?.message || '',
    });
  }

  // POST /notifications/smtp-config
  if (pathname === '/notifications/smtp-config' && req.method === 'POST') {
    const parsed = smtpConfigSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return sendError(res, 400, 'ValidationError', parseZodError(parsed.error));
    }

    const cleanUser = parsed.data.user;
    const cleanPass = parsed.data.pass.replace(/\s+/g, '');
    const smtpHost = parsed.data.host || 'smtp.gmail.com';
    const isGmail = smtpHost.includes('gmail') || cleanUser.includes('@gmail.com');
    const primaryPort = parsed.data.port || (isGmail ? 465 : 587);
    const senderName = parsed.data.senderName || 'Trợ Lý Thu Mua • Farmers Market';

    const check = await verifySmtpConnection(smtpHost, primaryPort, cleanUser, cleanPass);
    if (!check.ok) {
      return res.status(400).json({
        success: false,
        message: mapSmtpErrorMessage(check.error),
        detail: check.error?.message || '',
      });
    }

    const db = await getDb();
    const now = new Date().toISOString();
    const encryptedPass = encryptSecret(cleanPass);

    await db.execute({
      sql: `INSERT INTO smtp_configs (user_id, host, port, secure, smtp_user, encrypted_pass, sender_name, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET
              host = excluded.host,
              port = excluded.port,
              secure = excluded.secure,
              smtp_user = excluded.smtp_user,
              encrypted_pass = excluded.encrypted_pass,
              sender_name = excluded.sender_name,
              updated_at = excluded.updated_at`,
      args: [userId, smtpHost, check.port, check.port === 465 ? 1 : 0, cleanUser, encryptedPass, senderName, now],
    });

    return res.status(200).json({
      success: true,
      configured: true,
      smtpHost,
      smtpPort: check.port,
      smtpUser: cleanUser,
      senderName,
      message: 'Cấu hình SMTP thành công! Đã kết nối máy chủ Google Mail.',
    });
  }

  // POST /notifications/smtp-disconnect
  if (pathname === '/notifications/smtp-disconnect' && req.method === 'POST') {
    const db = await getDb();
    await db.execute({
      sql: 'DELETE FROM smtp_configs WHERE user_id = ?',
      args: [userId],
    });
    return res.status(200).json({
      success: true,
      configured: false,
      message: 'Đã ngắt kết nối cấu hình gửi thư',
    });
  }

  // POST /notifications/send-reminder-email (and /notifications/test-email)
  if (
    (pathname === '/notifications/send-reminder-email' || pathname === '/notifications/test-email') &&
    req.method === 'POST'
  ) {
    const parsed = sendEmailSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return sendError(res, 400, 'ValidationError', parseZodError(parsed.error));
    }

    const { to, subject, content, noteTitle, taskText, smtpConfig: passedConfig } = parsed.data;
    const savedConfig = await getUserSmtpConfig(userId);
    const activeConfig = passedConfig
      ? {
          user: passedConfig.user,
          pass: passedConfig.pass.replace(/\s+/g, ''),
          host: passedConfig.host || 'smtp.gmail.com',
          port: passedConfig.port || 465,
          senderName: passedConfig.senderName || 'Trợ Lý Thu Mua • Farmers Market',
        }
      : savedConfig;

    if (!activeConfig || !activeConfig.user || !activeConfig.pass) {
      return res.status(400).json({
        success: false,
        configured: false,
        message: 'Chưa có thông tin tài khoản Gmail và Mật khẩu ứng dụng để gửi mail.',
      });
    }

    const cleanUser = String(activeConfig.user).trim();
    const cleanPass = String(activeConfig.pass).trim().replace(/\s+/g, '');
    const smtpHost = activeConfig.host || 'smtp.gmail.com';
    const isGmail = smtpHost.includes('gmail') || cleanUser.includes('@gmail.com');
    const primaryPort = Number(activeConfig.port) || (isGmail ? 465 : 587);
    const senderName = activeConfig.senderName || 'Trợ Lý Thu Mua • Farmers Market';

    const safeContent = escapeHtml(content || '');
    const safeTaskText = escapeHtml(taskText || '');
    const safeNoteTitle = escapeHtml(noteTitle || '');
    const mailSubject =
      subject || `[FM Workspace] Nhắc việc: ${taskText || noteTitle || 'Thông báo từ hệ thống'}`;

    const mailHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e5e5ea; border-radius: 16px; background-color: #ffffff;">
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 20px; border-bottom: 1px solid #f2f2f7; padding-bottom: 16px;">
          <h2 style="margin: 0; color: #1d1d1f; font-size: 18px; font-weight: 700;">FM WORKSPACE</h2>
        </div>
        <div style="color: #1d1d1f; font-size: 14px; line-height: 1.6;">
          ${safeContent ? `<p>${safeContent}</p>` : ''}
          ${safeTaskText ? `<div style="background-color: #f5f5f7; padding: 14px 18px; border-radius: 12px; margin: 16px 0; border-left: 4px solid #0071e3;"><strong style="color: #0071e3;">Nội dung việc cần làm:</strong><p style="margin: 6px 0 0 0; font-size: 15px;">${safeTaskText}</p></div>` : ''}
          ${safeNoteTitle ? `<p style="color: #86868b; font-size: 12px; margin-top: 20px;">Ghi chú liên quan: <strong>${safeNoteTitle}</strong></p>` : ''}
        </div>
        <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #f2f2f7; color: #86868b; font-size: 11px; text-align: center;">
          Farmers Market Vietnam • Trợ Lý Thu Mua Workspace Cloud OS
        </div>
      </div>
    `;

    let lastSendErr = null;
    const ports = [primaryPort, primaryPort === 465 ? 587 : 465];
    for (const p of ports) {
      try {
        const transporter = buildTransporter(smtpHost, p, p === 465, cleanUser, cleanPass, 10000);
        await transporter.sendMail({
          from: `"${senderName}" <${cleanUser}>`,
          to,
          subject: mailSubject,
          html: mailHtml,
          text: content || taskText || noteTitle || 'Thông báo từ FM Workspace',
        });
        return res.status(200).json({
          success: true,
          message: `Đã gửi email thông báo thành công tới ${to}`,
        });
      } catch (err) {
        lastSendErr = err;
      }
    }

    return res.status(400).json({
      success: false,
      message: mapSmtpErrorMessage(lastSendErr),
      detail: lastSendErr?.message || '',
    });
  }

  return sendError(res, 404, 'NotFound', `Endpoint ${pathname} không tồn tại`);
}

module.exports = { handleNotificationsRoute };
