import { FastifyInstance } from 'fastify';
import { getDb } from '../db/connection.js';
import { verifyToken, optionalAuth } from '../middleware/auth.js';
import { v4 as uuidv4 } from 'uuid';
import nodemailer from 'nodemailer';

interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
  senderName: string;
  configured: boolean;
}

function getSmtpConfig(): SmtpConfig {
  const db = getDb();
  const getSetting = (k: string) => {
    try {
      const row = db.prepare('SELECT value FROM system_settings WHERE key = ?').get(k) as any;
      return row?.value ? String(row.value).trim() : '';
    } catch {
      return '';
    }
  };

  const user = getSetting('smtp_user') || process.env.SMTP_USER?.trim() || '';
  const pass = getSetting('smtp_pass') || process.env.SMTP_PASS?.trim() || '';
  const host = getSetting('smtp_host') || process.env.SMTP_HOST?.trim() || 'smtp.gmail.com';
  const port = Number(getSetting('smtp_port') || process.env.SMTP_PORT || 587);
  const secure = port === 465;
  const senderName = getSetting('smtp_sender_name') || 'Farmers Market Assistant';
  const from = getSetting('smtp_from') || process.env.SMTP_FROM || `"${senderName}" <${user}>`;

  return {
    host,
    port,
    secure,
    user,
    pass,
    from,
    senderName,
    configured: Boolean(user && pass),
  };
}

export default async function notificationsRoutes(fastify: FastifyInstance) {
  // 1. Check SMTP Configuration Status
  fastify.get('/smtp-status', { preHandler: optionalAuth }, async (_request, reply) => {
    const config = getSmtpConfig();
    const maskedUser = config.user
      ? config.user.replace(/^(.)(.*)(@.*)$/, (_, first, mid, last) => `${first}${'*'.repeat(Math.max(mid.length, 3))}${last}`)
      : null;

    return reply.send({
      success: true,
      configured: config.configured,
      smtpHost: config.host,
      smtpPort: config.port,
      smtpUser: maskedUser,
      fullUser: config.user || null,
      senderName: config.senderName,
    });
  });

  // 2. Configure & Verify SMTP Settings (from UI / Settings)
  fastify.post('/smtp-config', { preHandler: optionalAuth }, async (request: any, reply) => {
    const { user, pass, host, port, senderName } = request.body || {};

    if (!user || !pass) {
      return reply.code(400).send({
        success: false,
        message: 'Vui lòng cung cấp Email gửi và Mật khẩu ứng dụng (Google App Password).',
      });
    }

    const cleanUser = String(user).trim();
    const cleanPass = String(pass).replace(/\s+/g, ''); // Google App Passwords often have spaces like "abcd efgh ijkl mnop"
    const cleanHost = String(host || 'smtp.gmail.com').trim();
    const cleanPort = Number(port) || 587;
    const cleanSender = String(senderName || 'Trợ Lý Thu Mua Farmers Market').trim();

    // Verify SMTP connection live before saving
    const testTransporter = nodemailer.createTransport({
      host: cleanHost,
      port: cleanPort,
      secure: cleanPort === 465,
      auth: {
        user: cleanUser,
        pass: cleanPass,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });

    try {
      await testTransporter.verify();
    } catch (testErr: any) {
      console.error('SMTP verify failed:', testErr);
      return reply.code(400).send({
        success: false,
        message: `Xác thực máy chủ SMTP thất bại: ${testErr.message || 'Không thể đăng nhập'}. Nếu dùng Gmail, bạn cần tạo và dùng Mật khẩu ứng dụng (App Password 16 chữ cái) thay vì mật khẩu thông thường.`,
        error: testErr.message,
      });
    }

    // Save to system_settings in SQLite
    const db = getDb();
    const now = new Date().toISOString();
    const saveSetting = (k: string, v: string) => {
      db.prepare(`
        INSERT INTO system_settings (id, key, value, category, updated_at)
        VALUES (?, ?, ?, 'smtp', ?)
        ON CONFLICT(key) DO UPDATE SET
          value = excluded.value,
          updated_at = excluded.updated_at
      `).run(uuidv4(), k, v, now);
    };

    saveSetting('smtp_user', cleanUser);
    saveSetting('smtp_pass', cleanPass);
    saveSetting('smtp_host', cleanHost);
    saveSetting('smtp_port', String(cleanPort));
    saveSetting('smtp_sender_name', cleanSender);
    saveSetting('smtp_from', `"${cleanSender}" <${cleanUser}>`);

    // Synchronize to current process env
    process.env.SMTP_USER = cleanUser;
    process.env.SMTP_PASS = cleanPass;
    process.env.SMTP_HOST = cleanHost;
    process.env.SMTP_PORT = String(cleanPort);
    process.env.SMTP_FROM = `"${cleanSender}" <${cleanUser}>`;

    return reply.send({
      success: true,
      message: 'Đã xác thực và kết nối máy chủ gửi mail SMTP thành công!',
      configured: true,
      smtpHost: cleanHost,
      smtpPort: cleanPort,
      smtpUser: cleanUser,
      senderName: cleanSender,
    });
  });

  // 3. Automated Email Dispatch Endpoint
  fastify.post('/send-reminder-email', { preHandler: optionalAuth }, async (request: any, reply) => {
    const { to, subject, content, noteTitle, taskText } = request.body || {};

    if (!to || typeof to !== 'string' || !to.includes('@')) {
      return reply.code(400).send({
        success: false,
        message: 'Địa chỉ email người nhận không hợp lệ',
      });
    }

    const config = getSmtpConfig();

    // If SMTP is NOT configured, be completely transparent with user
    if (!config.configured) {
      return reply.code(400).send({
        success: false,
        delivered: false,
        configured: false,
        message: 'Chưa cấu hình tài khoản gửi thư SMTP (Gmail / Google App Password). Vui lòng thiết lập tài khoản gửi thư trong ứng dụng để hệ thống gửi mail thực tế.',
      });
    }

    const emailSubject = subject || (taskText 
      ? `[Farmers Market] Nhắc việc: ${taskText}` 
      : `[Farmers Market] Nhắc nhở công việc: ${noteTitle || 'Ghi chú mới'}`);

    const formattedTime = new Date().toLocaleString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

    // Generate Apple-styled HTML email body
    const emailHtml = `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${emailSubject}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #f5f5f7;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #1d1d1f;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      max-width: 580px;
      margin: 32px auto;
      background: #ffffff;
      border-radius: 20px;
      border: 1px solid rgba(0, 0, 0, 0.08);
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.04);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #0071e3 0%, #005bb5 100%);
      padding: 24px 28px;
      color: #ffffff;
    }
    .brand-tag {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      opacity: 0.85;
      margin-bottom: 4px;
    }
    .main-title {
      font-size: 20px;
      font-weight: 700;
      margin: 0;
      line-height: 1.3;
    }
    .content-body {
      padding: 28px;
    }
    .badge-card {
      background: #fff8e6;
      border: 1px solid #ffe399;
      border-radius: 12px;
      padding: 14px 16px;
      margin-bottom: 20px;
    }
    .badge-label {
      font-size: 11px;
      font-weight: 700;
      color: #b25e00;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .badge-value {
      font-size: 15px;
      font-weight: 600;
      color: #7a3e00;
      margin-top: 4px;
    }
    .meta-row {
      font-size: 12.5px;
      color: #86868b;
      margin-bottom: 16px;
    }
    .note-box {
      background: #fbfbfd;
      border: 1px solid #e5e5ea;
      border-radius: 12px;
      padding: 16px;
      font-size: 14px;
      line-height: 1.6;
      color: #333336;
      white-space: pre-wrap;
      font-family: inherit;
    }
    .footer {
      padding: 20px 28px;
      background: #fbfbfd;
      border-top: 1px solid #e5e5ea;
      font-size: 12px;
      color: #86868b;
      text-align: center;
      line-height: 1.5;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <div class="brand-tag">Trợ Lý Thu Mua • Farmers Market</div>
      <h1 class="main-title">⏰ Thông Báo Nhắc Nhở Công Việc</h1>
    </div>
    <div class="content-body">
      ${taskText ? `
        <div class="badge-card">
          <div class="badge-label">Mục việc cần làm đến hạn</div>
          <div class="badge-value">☑️ ${taskText}</div>
        </div>
      ` : ''}

      <div class="meta-row">
        <strong>Ghi chú:</strong> ${noteTitle || 'Ghi chú công việc'} • <strong>Thời gian:</strong> ${formattedTime}
      </div>

      <div class="note-box">${content || '(Không có nội dung chi tiết)'}</div>
    </div>
    <div class="footer">
      Email này được gửi tự động bởi Hệ thống Quản Lý & Trợ Lý Thu Mua Farmers Market.<br>
      Bạn nhận được thông báo này do đã thiết lập lịch hẹn tự động trong ứng dụng.
    </div>
  </div>
</body>
</html>
    `;

    const plainText = [
      `[Farmers Market - Trợ Lý Thu Mua]`,
      `THÔNG BÁO NHẮC NHỞ CÔNG VIỆC`,
      `----------------------------------------------------`,
      taskText ? `MỤC CẦN LÀM: ${taskText}` : '',
      `GHI CHÚ: ${noteTitle || 'Ghi chú mới'}`,
      `THỜI GIAN NHẮC: ${formattedTime}`,
      `----------------------------------------------------`,
      `NỘI DUNG CHI TIẾT:`,
      content || '(Không có nội dung)',
      `----------------------------------------------------`,
      `Hệ thống tự động thông báo từ Farmers Market Workspace.`,
    ].filter(Boolean).join('\n');

    const db = getDb();
    const notificationId = uuidv4();
    const userId = request.user?.id || 'system';

    // Record notification in database
    try {
      db.prepare(`
        INSERT INTO notifications (id, user_id, type, title, message, severity, entity_type, entity_id, created_at)
        VALUES (?, ?, 'email_reminder', ?, ?, 'info', 'note_reminder', ?, ?)
      `).run(
        notificationId,
        userId,
        emailSubject,
        taskText ? `Nhắc việc: ${taskText}` : (noteTitle || 'Ghi chú công việc'),
        to,
        new Date().toISOString()
      );
    } catch (dbErr) {
      console.warn('Failed to insert notification record:', dbErr);
    }

    // Connect to real SMTP transport and send
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.user,
        pass: config.pass,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });

    try {
      const sendResult = await transporter.sendMail({
        from: config.from,
        to,
        subject: emailSubject,
        text: plainText,
        html: emailHtml,
      });

      console.log(`[SMTP Sent] MessageId: ${sendResult.messageId} to ${to}`);

      return reply.send({
        success: true,
        delivered: true,
        configured: true,
        messageId: sendResult.messageId,
        recipient: to,
        message: `Hệ thống đã gửi email thành công tới ${to} qua máy chủ SMTP!`,
      });
    } catch (err: any) {
      console.error('SMTP email dispatch failed:', err);
      return reply.code(500).send({
        success: false,
        delivered: false,
        configured: true,
        error: err.message,
        message: `Gửi mail qua máy chủ SMTP thất bại: ${err.message}. Nếu dùng Gmail, hãy đảm bảo đã tạo Mật khẩu ứng dụng 16 ký tự (myaccount.google.com/apppasswords).`,
      });
    }
  });

  // Regular authenticated notification routes
  fastify.get('/', { preHandler: verifyToken }, async (request: any, reply) => {
    const { page = 1, limit = 10 } = request.query;
    const db = getDb();
    const offset = (page - 1) * limit;
    
    const query = 'SELECT * FROM notifications ORDER BY created_at DESC';
    const count = (db.prepare('SELECT COUNT(*) as total FROM notifications').get() as any).total;
    const data = db.prepare(`${query} LIMIT ? OFFSET ?`).all(Number(limit), Number(offset));
    
    return { success: true, data, pagination: { page: Number(page), limit: Number(limit), total: count, total_pages: Math.ceil(count / limit) } };
  });

  fastify.put('/:id/read', { preHandler: verifyToken }, async (request: any, reply) => {
    const db = getDb();
    db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(request.params.id);
    return { success: true, data: { id: request.params.id } };
  });

  fastify.put('/read-all', { preHandler: verifyToken }, async (request: any, reply) => {
    const db = getDb();
    db.prepare('UPDATE notifications SET is_read = 1 WHERE is_read = 0').run();
    return { success: true };
  });

  fastify.get('/unread-count', { preHandler: verifyToken }, async (request: any, reply) => {
    const db = getDb();
    const count = (db.prepare('SELECT COUNT(*) as count FROM notifications WHERE is_read = 0').get() as any).count;
    return { success: true, data: { count } };
  });
}
