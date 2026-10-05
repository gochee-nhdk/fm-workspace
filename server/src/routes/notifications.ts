import { FastifyInstance } from 'fastify';
import { getDb } from '../db/connection.js';
import { verifyToken, optionalAuth, requireRole } from '../middleware/auth.js';
import { v4 as uuidv4 } from 'uuid';
import nodemailer from 'nodemailer';
import path from 'path';
import fs from 'fs';

const LOGO_CID = 'fm-workspace-logo@farmersmarket.vn';

function getLogoPath(): string | null {
  const candidates = [
    path.resolve(process.cwd(), 'server/assets/logo.png'),
    path.resolve(process.cwd(), 'assets/logo.png'),
    path.resolve(process.cwd(), 'client/public/logo.png'),
    path.resolve(process.cwd(), '../client/public/logo.png'),
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return p;
    } catch {
      // ignore
    }
  }
  return null;
}

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

function escapeHtml(str: string): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export default async function notificationsRoutes(fastify: FastifyInstance) {
  // 1. Check SMTP Configuration Status
  fastify.get('/smtp-status', { preHandler: optionalAuth }, async (request: any, reply) => {
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

  // 2. Configure & Verify SMTP Settings
  fastify.post('/smtp-config', { preHandler: optionalAuth }, async (request: any, reply) => {
    if (request.user && request.user.role && request.user.role !== 'admin') {
      return reply.code(403).send({ error: 'Forbidden', message: 'Chỉ quản trị viên mới có quyền cấu hình SMTP.' });
    }
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
        rejectUnauthorized: process.env.SMTP_IGNORE_TLS === 'true' ? false : true,
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
      fullUser: cleanUser,
      senderName: cleanSender,
    });
  });

  // 2b. Disconnect / Remove SMTP Configuration
  fastify.post('/smtp-disconnect', { preHandler: optionalAuth }, async (request: any, reply) => {
    if (request.user && request.user.role && request.user.role !== 'admin') {
      return reply.code(403).send({ error: 'Forbidden', message: 'Chỉ quản trị viên mới có quyền ngắt kết nối SMTP.' });
    }
    const db = getDb();
    db.prepare("DELETE FROM system_settings WHERE category = 'smtp'").run();
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_PORT;
    delete process.env.SMTP_FROM;

    return reply.send({
      success: true,
      message: 'Đã ngắt kết nối và gỡ bỏ cấu hình tài khoản gửi thư.',
      configured: false,
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

    const safeNoteTitle = escapeHtml(noteTitle || 'Ghi chú công việc');
    const safeTaskText = escapeHtml(taskText || '');
    const safeContent = escapeHtml(content || '');

    // Generate Apple Minimalist Executive HTML email body (Light & Dark Mode)
    const emailHtml = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>${escapeHtml(emailSubject)}</title>
  <style>
    :root {
      color-scheme: light dark;
      supported-color-schemes: light dark;
    }
    body, table, td, p, a, li, blockquote {
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
    }
    @media (prefers-color-scheme: dark) {
      .apple-body {
        background-color: #000000 !important;
      }
      .apple-canvas {
        background-color: #000000 !important;
      }
      .apple-card {
        background-color: #1C1C1E !important;
        border-color: #2C2C2E !important;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.45) !important;
      }
      .apple-title {
        color: #F5F5F7 !important;
      }
      .apple-subtitle {
        color: #A1A1A6 !important;
      }
      .apple-item-box {
        background-color: #242426 !important;
        border-color: #38383A !important;
      }
      .apple-task-title {
        color: #FFFFFF !important;
      }
      .apple-note-box {
        background-color: #242426 !important;
        border-color: #38383A !important;
      }
      .apple-note-text {
        color: #E5E5EA !important;
      }
      .apple-spec-row {
        border-bottom-color: #2C2C2E !important;
      }
      .apple-spec-label {
        color: #8E8E93 !important;
      }
      .apple-spec-val {
        color: #F5F5F7 !important;
      }
      .apple-badge-task {
        background-color: rgba(10, 132, 255, 0.18) !important;
        color: #409CFF !important;
      }
      .apple-badge-status {
        background-color: rgba(48, 209, 88, 0.18) !important;
        color: #30D158 !important;
      }
      .apple-brand-sub {
        color: #F5F5F7 !important;
      }
      .apple-logo-img {
        border-color: rgba(255, 255, 255, 0.16) !important;
      }
      .apple-cta-btn {
        background-color: #0071E3 !important;
        color: #FFFFFF !important;
      }
      .apple-footer-divider {
        border-top-color: #2C2C2E !important;
      }
      .apple-footer-text {
        color: #636366 !important;
      }
      .apple-footer-subtext {
        color: #48484A !important;
      }
    }
  </style>
</head>
<body class="apple-body" style="margin: 0; padding: 0; background-color: #F5F5F7; font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #1D1D1F;">
  <table class="apple-canvas" role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #F5F5F7; padding: 40px 16px;">
    <tr>
      <td align="center">
        <!-- Main Apple Card Container -->
        <table class="apple-card" role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 540px; background-color: #FFFFFF; border-radius: 20px; overflow: hidden; box-shadow: 0 4px 24px rgba(0, 0, 0, 0.05); border: 1px solid #E5E5EA;">
          <tr>
            <td style="padding: 36px 32px 32px 32px;">
              <!-- Apple Brand & Logo Bar -->
              <table role="presentation" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 22px;">
                <tr>
                  <td valign="middle" style="width: 44px; padding-right: 12px;">
                    <img src="cid:${LOGO_CID}" alt="Farmers Market" width="40" height="40" class="apple-logo-img" style="display: block; width: 40px; height: 40px; border-radius: 50%; object-fit: cover; border: 1px solid rgba(0, 0, 0, 0.08); box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);" />
                  </td>
                  <td valign="middle">
                    <div style="font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #86868B; line-height: 1.2;">
                      FM WORKSPACE
                    </div>
                    <div class="apple-brand-sub" style="font-size: 13px; font-weight: 600; color: #1D1D1F; letter-spacing: -0.01em; line-height: 1.2; margin-top: 3px;">
                      Trợ Lý Thu Mua Thông Minh
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Header Headline -->
              <h1 class="apple-title" style="margin: 0 0 6px 0; font-size: 22px; font-weight: 600; line-height: 1.28; color: #1D1D1F; letter-spacing: -0.022em;">
                ${safeTaskText ? 'Nhắc nhở công việc đến hạn' : 'Nhắc nhở ghi chú công việc'}
              </h1>
              <p class="apple-subtitle" style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.5; color: #6E6E73;">
                Thông báo nhắc hẹn được thiết lập tự động từ không gian làm việc của bạn.
              </p>

              <!-- To-do / Task Highlight Card (if present) -->
              ${safeTaskText ? `
              <table class="apple-item-box" role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #FBFBFD; border: 1px solid #E5E5EA; border-radius: 14px; margin-bottom: 22px; overflow: hidden;">
                <tr>
                  <td style="padding: 16px 18px;">
                    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                      <tr>
                        <td width="26" valign="top" style="padding-top: 1px;">
                          <!-- Apple Reminders Blue Check Circle -->
                          <div style="width: 20px; height: 20px; border-radius: 50%; background-color: #0071E3; color: #FFFFFF; font-size: 11px; font-weight: 700; text-align: center; line-height: 20px;">
                            &#10003;
                          </div>
                        </td>
                        <td style="padding-left: 10px;">
                          <div class="apple-badge-task" style="display: inline-block; font-size: 11px; font-weight: 600; color: #0071E3; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 4px;">
                            Mục To-do cần làm
                          </div>
                          <div class="apple-task-title" style="font-size: 16px; font-weight: 600; color: #1D1D1F; line-height: 1.4;">
                            ${safeTaskText}
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              ` : ''}

              <!-- Note Details Box (if content exists) -->
              ${safeContent ? `
              <div style="margin-bottom: 22px;">
                <div style="font-size: 11px; font-weight: 600; color: #86868B; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 8px;">
                  Nội dung chi tiết
                </div>
                <table class="apple-note-box" role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #F8F8FA; border: 1px solid #E5E5EA; border-radius: 12px; overflow: hidden;">
                  <tr>
                    <td class="apple-note-text" style="padding: 14px 16px; font-size: 14px; line-height: 1.6; color: #1D1D1F; white-space: pre-wrap; font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', Helvetica, Arial, sans-serif;">
${safeContent}
                    </td>
                  </tr>
                </table>
              </div>
              ` : ''}

              <!-- Apple Specs / Metadata Table -->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 28px;">
                <tr>
                  <td class="apple-spec-row" style="padding: 10px 0; border-bottom: 1px solid #F0F0F2;">
                    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                      <tr>
                        <td class="apple-spec-label" style="font-size: 13px; color: #86868B; width: 130px;">Ghi chú</td>
                        <td class="apple-spec-val" align="right" style="font-size: 13px; font-weight: 500; color: #1D1D1F;">${safeNoteTitle}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td class="apple-spec-row" style="padding: 10px 0; border-bottom: 1px solid #F0F0F2;">
                    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                      <tr>
                        <td class="apple-spec-label" style="font-size: 13px; color: #86868B; width: 130px;">Thời điểm nhắc</td>
                        <td class="apple-spec-val" align="right" style="font-size: 13px; font-weight: 500; color: #1D1D1F;">${formattedTime}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td class="apple-spec-row" style="padding: 10px 0; border-bottom: 1px solid #F0F0F2;">
                    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                      <tr>
                        <td class="apple-spec-label" style="font-size: 13px; color: #86868B; width: 130px;">Trạng thái</td>
                        <td align="right">
                          <span class="apple-badge-status" style="display: inline-block; padding: 2px 10px; border-radius: 980px; font-size: 11.5px; font-weight: 500; background-color: #E8F5E9; color: #1E7E34;">
                            Đã gửi thành công
                          </span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Apple Pill CTA Button -->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 8px;">
                <tr>
                  <td align="center">
                    <a href="http://localhost:5173" target="_blank" class="apple-cta-btn" style="display: inline-block; padding: 11px 28px; background-color: #0071E3; color: #FFFFFF; font-size: 14px; font-weight: 500; text-decoration: none; border-radius: 980px; letter-spacing: -0.01em; box-shadow: 0 2px 10px rgba(0, 113, 227, 0.25);">
                      Mở trong FM Workspace &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Apple Footer -->
              <div class="apple-footer-divider" style="border-top: 1px solid #E5E5EA; margin-top: 32px; padding-top: 20px; text-align: center;">
                <p class="apple-footer-text" style="margin: 0; font-size: 12px; font-weight: 500; line-height: 1.5; color: #86868B;">
                  Farmers Market &bull; Trợ Lý Thu Mua Thông Minh
                </p>
                <p class="apple-footer-subtext" style="margin: 4px 0 0 0; font-size: 11px; line-height: 1.4; color: #A1A1A6;">
                  Email thông báo tự động từ hệ thống Workspace cục bộ &bull; Bảo mật Local-First
                </p>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

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
        rejectUnauthorized: process.env.SMTP_IGNORE_TLS === 'true' ? false : true,
      },
    });

    const logoPath = getLogoPath();
    const attachments = logoPath ? [{
      filename: 'logo.png',
      path: logoPath,
      cid: LOGO_CID,
    }] : [];

    try {
      const sendResult = await transporter.sendMail({
        from: config.from,
        to,
        subject: emailSubject,
        text: plainText,
        html: emailHtml,
        attachments,
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

  // 4. Send Test Email Endpoint
  fastify.post('/test-email', { preHandler: optionalAuth }, async (request: any, reply) => {
    const { to } = request.body || {};
    if (!to || typeof to !== 'string' || !to.includes('@')) {
      return reply.code(400).send({
        success: false,
        message: 'Vui lòng cung cấp địa chỉ email hợp lệ để nhận thử nghiệm.',
      });
    }

    const config = getSmtpConfig();
    if (!config.configured) {
      return reply.code(400).send({
        success: false,
        message: 'Chưa cấu hình tài khoản gửi thư SMTP trong hệ thống.',
      });
    }

    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.user,
        pass: config.pass,
      },
      tls: {
        rejectUnauthorized: process.env.SMTP_IGNORE_TLS === 'true' ? false : true,
      },
    });

    const formattedTime = new Date().toLocaleString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

    const safeHost = escapeHtml(config.host);
    const safeUser = escapeHtml(config.user);

    const testHtml = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>Thử Nghiệm Kết Nối Email - FM Workspace</title>
  <style>
    :root {
      color-scheme: light dark;
      supported-color-schemes: light dark;
    }
    body, table, td, p, a, li, blockquote {
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
    }
    @media (prefers-color-scheme: dark) {
      .apple-body {
        background-color: #000000 !important;
      }
      .apple-canvas {
        background-color: #000000 !important;
      }
      .apple-card {
        background-color: #1C1C1E !important;
        border-color: #2C2C2E !important;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.45) !important;
      }
      .apple-title {
        color: #F5F5F7 !important;
      }
      .apple-subtitle {
        color: #A1A1A6 !important;
      }
      .apple-note-box {
        background-color: #242426 !important;
        border-color: #38383A !important;
      }
      .apple-note-text {
        color: #E5E5EA !important;
      }
      .apple-spec-row {
        border-bottom-color: #2C2C2E !important;
      }
      .apple-spec-label {
        color: #8E8E93 !important;
      }
      .apple-spec-val {
        color: #F5F5F7 !important;
      }
      .apple-badge-status {
        background-color: rgba(48, 209, 88, 0.18) !important;
        color: #30D158 !important;
      }
      .apple-brand-sub {
        color: #F5F5F7 !important;
      }
      .apple-logo-img {
        border-color: rgba(255, 255, 255, 0.16) !important;
      }
      .apple-cta-btn {
        background-color: #0071E3 !important;
        color: #FFFFFF !important;
      }
      .apple-footer-divider {
        border-top-color: #2C2C2E !important;
      }
      .apple-footer-text {
        color: #636366 !important;
      }
      .apple-footer-subtext {
        color: #48484A !important;
      }
    }
  </style>
</head>
<body class="apple-body" style="margin: 0; padding: 0; background-color: #F5F5F7; font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #1D1D1F;">
  <table class="apple-canvas" role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #F5F5F7; padding: 40px 16px;">
    <tr>
      <td align="center">
        <!-- Main Apple Card Container -->
        <table class="apple-card" role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 540px; background-color: #FFFFFF; border-radius: 20px; overflow: hidden; box-shadow: 0 4px 24px rgba(0, 0, 0, 0.05); border: 1px solid #E5E5EA;">
          <tr>
            <td style="padding: 36px 32px 32px 32px;">
              <!-- Apple Brand & Logo Bar -->
              <table role="presentation" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 22px;">
                <tr>
                  <td valign="middle" style="width: 44px; padding-right: 12px;">
                    <img src="cid:${LOGO_CID}" alt="Farmers Market" width="40" height="40" class="apple-logo-img" style="display: block; width: 40px; height: 40px; border-radius: 50%; object-fit: cover; border: 1px solid rgba(0, 0, 0, 0.08); box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);" />
                  </td>
                  <td valign="middle">
                    <div style="font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #86868B; line-height: 1.2;">
                      FM WORKSPACE
                    </div>
                    <div class="apple-brand-sub" style="font-size: 13px; font-weight: 600; color: #1D1D1F; letter-spacing: -0.01em; line-height: 1.2; margin-top: 3px;">
                      Cấu Hình &bull; Thử Nghiệm Kết Nối
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Header Headline -->
              <h1 class="apple-title" style="margin: 0 0 6px 0; font-size: 22px; font-weight: 600; line-height: 1.28; color: #1D1D1F; letter-spacing: -0.022em;">
                Thử nghiệm gửi mail thành công
              </h1>
              <p class="apple-subtitle" style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.5; color: #6E6E73;">
                Máy chủ gửi thư SMTP đã được kết nối thông suốt và sẵn sàng phục vụ.
              </p>

              <!-- Apple Specs / Metadata Table -->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
                <tr>
                  <td class="apple-spec-row" style="padding: 10px 0; border-bottom: 1px solid #F0F0F2;">
                    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                      <tr>
                        <td class="apple-spec-label" style="font-size: 13px; color: #86868B; width: 130px;">Máy chủ SMTP</td>
                        <td class="apple-spec-val" align="right" style="font-size: 13px; font-weight: 500; color: #1D1D1F;">${safeHost}:${config.port}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td class="apple-spec-row" style="padding: 10px 0; border-bottom: 1px solid #F0F0F2;">
                    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                      <tr>
                        <td class="apple-spec-label" style="font-size: 13px; color: #86868B; width: 130px;">Tài khoản gửi</td>
                        <td class="apple-spec-val" align="right" style="font-size: 13px; font-weight: 500; color: #1D1D1F;">${safeUser}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td class="apple-spec-row" style="padding: 10px 0; border-bottom: 1px solid #F0F0F2;">
                    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                      <tr>
                        <td class="apple-spec-label" style="font-size: 13px; color: #86868B; width: 130px;">Thời gian gửi</td>
                        <td class="apple-spec-val" align="right" style="font-size: 13px; font-weight: 500; color: #1D1D1F;">${formattedTime}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td class="apple-spec-row" style="padding: 10px 0; border-bottom: 1px solid #F0F0F2;">
                    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                      <tr>
                        <td class="apple-spec-label" style="font-size: 13px; color: #86868B; width: 130px;">Trạng thái</td>
                        <td align="right">
                          <span class="apple-badge-status" style="display: inline-block; padding: 2px 10px; border-radius: 980px; font-size: 11.5px; font-weight: 500; background-color: #E8F5E9; color: #1E7E34;">
                            Kết nối hoàn hảo
                          </span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Description Box -->
              <table class="apple-note-box" role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #F8F8FA; border: 1px solid #E5E5EA; border-radius: 12px; margin-bottom: 28px; overflow: hidden;">
                <tr>
                  <td class="apple-note-text" style="padding: 14px 16px; font-size: 13.5px; line-height: 1.6; color: #424245;">
                    Cấu hình máy chủ gửi mail Google Gmail SMTP đã hoàn tất. Giao diện email theo chuẩn tối giản cao cấp của Apple đã được kích hoạt, tự động tối ưu hiển thị trên cả Giao diện Sáng (Light Mode) và Giao diện Tối (Dark Mode).
                  </td>
                </tr>
              </table>

              <!-- Apple Pill CTA Button -->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 8px;">
                <tr>
                  <td align="center">
                    <a href="http://localhost:5173" target="_blank" class="apple-cta-btn" style="display: inline-block; padding: 11px 28px; background-color: #0071E3; color: #FFFFFF; font-size: 14px; font-weight: 500; text-decoration: none; border-radius: 980px; letter-spacing: -0.01em; box-shadow: 0 2px 10px rgba(0, 113, 227, 0.25);">
                      Mở FM Workspace &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Apple Footer -->
              <div class="apple-footer-divider" style="border-top: 1px solid #E5E5EA; margin-top: 32px; padding-top: 20px; text-align: center;">
                <p class="apple-footer-text" style="margin: 0; font-size: 12px; font-weight: 500; line-height: 1.5; color: #86868B;">
                  Farmers Market &bull; Trợ Lý Thu Mua Thông Minh
                </p>
                <p class="apple-footer-subtext" style="margin: 4px 0 0 0; font-size: 11px; line-height: 1.4; color: #A1A1A6;">
                  Email thử nghiệm từ hệ thống Workspace cục bộ &bull; Bảo mật Local-First
                </p>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    const logoPath = getLogoPath();
    const attachments = logoPath ? [{
      filename: 'logo.png',
      path: logoPath,
      cid: LOGO_CID,
    }] : [];

    try {
      const sendResult = await transporter.sendMail({
        from: config.from,
        to: to.trim(),
        subject: '🌿 [Farmers Market] Thử Nghiệm Gửi Mail Thành Công',
        text: 'Chúc mừng! Thử nghiệm gửi mail từ FM Workspace đã thành công.',
        html: testHtml,
        attachments,
      });

      return reply.send({
        success: true,
        message: `Đã gửi email thử nghiệm thành công tới ${to}!`,
        messageId: sendResult.messageId,
      });
    } catch (err: any) {
      console.error('Test email failed:', err);
      return reply.code(500).send({
        success: false,
        message: `Gửi email thử nghiệm thất bại: ${err.message}`,
      });
    }
  });

  // Regular authenticated notification routes (scoped to current user or admin)
  fastify.get('/', { preHandler: verifyToken }, async (request: any, reply) => {
    const { page = 1, limit = 10 } = request.query;
    const db = getDb();
    const offset = (Number(page) - 1) * Number(limit);
    const userId = request.user?.id;
    const isAdmin = request.user?.role === 'admin';
    
    let count: number;
    let data: any[];

    if (isAdmin) {
      count = (db.prepare('SELECT COUNT(*) as total FROM notifications').get() as any).total;
      data = db.prepare('SELECT * FROM notifications ORDER BY created_at DESC LIMIT ? OFFSET ?').all(Number(limit), Number(offset));
    } else {
      count = (db.prepare('SELECT COUNT(*) as total FROM notifications WHERE user_id = ? OR user_id IS NULL OR user_id = "system"').get(userId) as any).total;
      data = db.prepare('SELECT * FROM notifications WHERE user_id = ? OR user_id IS NULL OR user_id = "system" ORDER BY created_at DESC LIMIT ? OFFSET ?').all(userId, Number(limit), Number(offset));
    }
    
    return { success: true, data, pagination: { page: Number(page), limit: Number(limit), total: count, total_pages: Math.ceil(count / Number(limit)) } };
  });

  fastify.put('/:id/read', { preHandler: verifyToken }, async (request: any, reply) => {
    const db = getDb();
    const userId = request.user?.id;
    const isAdmin = request.user?.role === 'admin';

    if (isAdmin) {
      db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(request.params.id);
    } else {
      db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND (user_id = ? OR user_id IS NULL OR user_id = "system")').run(request.params.id, userId);
    }
    return { success: true, data: { id: request.params.id } };
  });

  fastify.put('/read-all', { preHandler: verifyToken }, async (request: any, reply) => {
    const db = getDb();
    const userId = request.user?.id;
    const isAdmin = request.user?.role === 'admin';

    if (isAdmin) {
      db.prepare('UPDATE notifications SET is_read = 1 WHERE is_read = 0').run();
    } else {
      db.prepare('UPDATE notifications SET is_read = 1 WHERE is_read = 0 AND (user_id = ? OR user_id IS NULL OR user_id = "system")').run(userId);
    }
    return { success: true };
  });

  fastify.get('/unread-count', { preHandler: verifyToken }, async (request: any, reply) => {
    const db = getDb();
    const userId = request.user?.id;
    const isAdmin = request.user?.role === 'admin';

    let count: number;
    if (isAdmin) {
      count = (db.prepare('SELECT COUNT(*) as count FROM notifications WHERE is_read = 0').get() as any).count;
    } else {
      count = (db.prepare('SELECT COUNT(*) as count FROM notifications WHERE is_read = 0 AND (user_id = ? OR user_id IS NULL OR user_id = "system")').get(userId) as any).count;
    }
    return { success: true, data: { count } };
  });
}
