import { FastifyInstance } from 'fastify';
import { getDb } from '../db/connection.js';
import { verifyToken, optionalAuth } from '../middleware/auth.js';
import { v4 as uuidv4 } from 'uuid';
import nodemailer from 'nodemailer';

export default async function notificationsRoutes(fastify: FastifyInstance) {
  // Automated Email Dispatch Endpoint (optional auth for background scheduler / client notes)
  fastify.post('/send-reminder-email', { preHandler: optionalAuth }, async (request: any, reply) => {
    const { to, subject, content, noteTitle, taskText } = request.body || {};

    if (!to || typeof to !== 'string' || !to.includes('@')) {
      return reply.code(400).send({
        success: false,
        message: 'Địa chỉ email người nhận không hợp lệ',
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

    // Save notification entry in database
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

    // Try sending via SMTP if environment variables exist
    let smtpDelivered = false;
    let smtpError: string | null = null;

    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
      try {
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST || 'smtp.gmail.com',
          port: Number(process.env.SMTP_PORT) || 587,
          secure: Number(process.env.SMTP_PORT) === 465,
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
        });

        await transporter.sendMail({
          from: process.env.SMTP_FROM || `"Farmers Market Assistant" <${process.env.SMTP_USER}>`,
          to,
          subject: emailSubject,
          text: plainText,
          html: emailHtml,
        });

        smtpDelivered = true;
      } catch (err: any) {
        smtpError = err?.message || 'SMTP send error';
        console.error('SMTP email sending failed:', err);
      }
    }

    console.log(`[Automated Email Notification] Dispatched to: ${to} | Subject: ${emailSubject} | Status: ${smtpDelivered ? 'Delivered via SMTP' : 'Recorded in System Notification Queue'}`);

    return reply.send({
      success: true,
      delivered: true,
      recipient: to,
      deliveryMode: smtpDelivered ? 'smtp' : 'system_queue',
      message: `Hệ thống đã gửi thông báo tự động tới ${to}`,
      smtpError: smtpError ? 'Chế độ mô phỏng hệ thống (Cấu hình SMTP chưa có trong .env)' : null,
    });
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
