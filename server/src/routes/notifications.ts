import { FastifyInstance } from 'fastify';
import { getDb } from '../db/connection.js';
import { verifyToken, optionalAuth, requireRole } from '../middleware/auth.js';
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
  // 1. Check SMTP Configuration Status (Mask email for non-admin)
  fastify.get('/smtp-status', { preHandler: optionalAuth }, async (request: any, reply) => {
    const config = getSmtpConfig();
    const isAdmin = request.user?.role === 'admin';
    const maskedUser = config.user
      ? config.user.replace(/^(.)(.*)(@.*)$/, (_, first, mid, last) => `${first}${'*'.repeat(Math.max(mid.length, 3))}${last}`)
      : null;

    return reply.send({
      success: true,
      configured: config.configured,
      smtpHost: config.host,
      smtpPort: config.port,
      smtpUser: maskedUser,
      fullUser: isAdmin ? (config.user || null) : null,
      senderName: config.senderName,
    });
  });

  // 2. Configure & Verify SMTP Settings (Admin-only access)
  fastify.post('/smtp-config', { preHandler: requireRole('admin') }, async (request: any, reply) => {
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

    // Generate Apple Executive Liquid Glass HTML email body
    const emailHtml = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${emailSubject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F2F2F7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #1D1D1F;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #F2F2F7; padding: 32px 16px;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 580px; background-color: #FFFFFF; border-radius: 24px; overflow: hidden; box-shadow: 0 16px 40px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04); border: 1px solid rgba(0,0,0,0.06);">
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #0A192F 0%, #0052CC 55%, #0071E3 100%); padding: 32px 32px 28px 32px; color: #FFFFFF; text-align: left;">
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <span style="display: inline-block; padding: 4px 12px; background: rgba(255,255,255,0.16); border-radius: 100px; font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #FAC426; border: 1px solid rgba(250, 196, 38, 0.35);">
                      🌿 FARMERS MARKET • FM WORKSPACE
                    </span>
                    <h1 style="margin: 14px 0 0 0; font-size: 22px; font-weight: 700; line-height: 1.3; color: #FFFFFF; letter-spacing: -0.02em;">
                      ${taskText ? '⏰ Thông Báo Việc Cần Làm Đến Hạn' : '⏰ Nhắc Nhở Lịch Hẹn Tác Nghiệp'}
                    </h1>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Content Body -->
          <tr>
            <td style="padding: 32px;">
              <!-- Task Card or Note Header Card -->
              ${taskText ? `
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background: linear-gradient(180deg, #FFFDF5 0%, #FFF8E6 100%); border: 1px solid #FFE399; border-radius: 16px; padding: 18px 20px; margin-bottom: 24px;">
                <tr>
                  <td>
                    <div style="font-size: 11px; font-weight: 700; color: #B25E00; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 6px;">
                      ⚡ Mục Việc Cần Làm Đến Hạn
                    </div>
                    <div style="font-size: 16px; font-weight: 600; color: #1D1D1F; line-height: 1.4;">
                      ☑️ ${taskText}
                    </div>
                  </td>
                </tr>
              </table>
              ` : ''}

              <!-- Metadata Table -->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 14px; padding: 14px 18px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 4px 0; font-size: 13px; color: #64748B;">
                    <strong style="color: #1E293B;">Ghi chú:</strong> ${noteTitle || 'Ghi chú công việc'}
                  </td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; font-size: 13px; color: #64748B;">
                    <strong style="color: #1E293B;">Thời điểm nhắc:</strong> ${formattedTime}
                  </td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; font-size: 13px; color: #64748B;">
                    <strong style="color: #1E293B;">Trạng thái:</strong> <span style="display: inline-block; padding: 2px 8px; border-radius: 100px; font-size: 11.5px; font-weight: 600; background: #DCFCE7; color: #166534;">Tự động gửi thành công</span>
                  </td>
                </tr>
              </table>

              <!-- Note Details Box -->
              <div style="font-size: 12px; font-weight: 700; color: #64748B; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 8px;">
                📝 Chi Tiết Ghi Chú
              </div>
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 14px; padding: 18px; margin-bottom: 28px;">
                <tr>
                  <td style="font-size: 14px; line-height: 1.6; color: #334155; white-space: pre-wrap;">
                    ${content || '(Không có nội dung bổ sung)'}
                  </td>
                </tr>
              </table>

              <!-- Action CTA Button -->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center">
                    <a href="http://localhost:5173" target="_blank" style="display: inline-block; padding: 12px 28px; background: linear-gradient(180deg, #0071E3 0%, #005BB5 100%); color: #FFFFFF; font-size: 14px; font-weight: 600; text-decoration: none; border-radius: 100px; box-shadow: 0 4px 14px rgba(0, 113, 227, 0.35); letter-spacing: -0.01em;">
                      Mở Bàn Làm Việc FM Workspace &rarr;
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #F8FAFC; border-top: 1px solid #E2E8F0; padding: 22px 32px; text-align: center; color: #94A3B8; font-size: 12px; line-height: 1.6;">
              <strong style="color: #64748B;">Hệ Thống Trợ Lý Thu Mua • Farmers Market Việt Nam</strong><br>
              Email thông báo tự động từ Workspace cục bộ của bạn • Bảo mật Local-First
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

    const testHtml = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>[Farmers Market] Thử Nghiệm Kết Nối Email</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F2F2F7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #1D1D1F;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #F2F2F7; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 580px; background-color: #FFFFFF; border-radius: 24px; overflow: hidden; box-shadow: 0 16px 40px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04); border: 1px solid rgba(0,0,0,0.06);">
          <tr>
            <td style="background: linear-gradient(135deg, #0A192F 0%, #0052CC 55%, #0071E3 100%); padding: 32px 32px 28px 32px; color: #FFFFFF; text-align: left;">
              <span style="display: inline-block; padding: 4px 12px; background: rgba(255,255,255,0.16); border-radius: 100px; font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #FAC426; border: 1px solid rgba(250, 196, 38, 0.35);">
                🌿 FARMERS MARKET • FM WORKSPACE
              </span>
              <h1 style="margin: 14px 0 0 0; font-size: 22px; font-weight: 700; line-height: 1.3; color: #FFFFFF; letter-spacing: -0.02em;">
                ✅ Thử Nghiệm Gửi Mail Thành Công!
              </h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px;">
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 14px; padding: 14px 18px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 4px 0; font-size: 13px; color: #64748B;">
                    <strong style="color: #1E293B;">Máy chủ SMTP:</strong> ${config.host}:${config.port} (${config.user})
                  </td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; font-size: 13px; color: #64748B;">
                    <strong style="color: #1E293B;">Thời gian gửi:</strong> ${formattedTime}
                  </td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; font-size: 13px; color: #64748B;">
                    <strong style="color: #1E293B;">Trạng thái:</strong> <span style="display: inline-block; padding: 2px 8px; border-radius: 100px; font-size: 11.5px; font-weight: 600; background: #DCFCE7; color: #166534;">Kết nối hoàn hảo</span>
                  </td>
                </tr>
              </table>
              <div style="font-size: 14px; line-height: 1.6; color: #334155; margin-bottom: 28px;">
                Chúc mừng bạn! Thiết lập máy chủ gửi mail Google Gmail SMTP đã kết nối thông suốt và mẫu email chuẩn <strong>Apple Executive Liquid Glass</strong> mới đã được áp dụng thành công.
              </div>
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center">
                    <a href="http://localhost:5173" target="_blank" style="display: inline-block; padding: 12px 28px; background: linear-gradient(180deg, #0071E3 0%, #005BB5 100%); color: #FFFFFF; font-size: 14px; font-weight: 600; text-decoration: none; border-radius: 100px; box-shadow: 0 4px 14px rgba(0, 113, 227, 0.35);">
                      Mở FM Workspace &rarr;
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background-color: #F8FAFC; border-top: 1px solid #E2E8F0; padding: 22px 32px; text-align: center; color: #94A3B8; font-size: 12px; line-height: 1.6;">
              <strong style="color: #64748B;">Hệ Thống Trợ Lý Thu Mua • Farmers Market Việt Nam</strong><br>
              Email thông báo thử nghiệm từ hệ thống Workspace cục bộ
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    try {
      const sendResult = await transporter.sendMail({
        from: config.from,
        to: to.trim(),
        subject: '🌿 [Farmers Market] Thử Nghiệm Gửi Mail Thành Công',
        text: 'Chúc mừng! Thử nghiệm gửi mail từ FM Workspace đã thành công.',
        html: testHtml,
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
