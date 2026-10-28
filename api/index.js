const nodemailer = require('nodemailer');

// In-memory runtime cache for serverless environment
let globalSmtpConfig = null;
let latestBackupData = null;

module.exports = async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Parse path from URL
  const rawUrl = req.url || '';
  const pathname = rawUrl.split('?')[0].replace(/^\/api/, '');

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
      const smtpPort = Number(port) || 587;

      try {
        const transporter = nodemailer.createTransport({
          host: smtpHost,
          port: smtpPort,
          secure: smtpPort === 465,
          auth: {
            user: cleanUser,
            pass: cleanPass
          },
          tls: {
            rejectUnauthorized: false
          }
        });

        await transporter.verify();

        globalSmtpConfig = {
          user: cleanUser,
          pass: cleanPass,
          host: smtpHost,
          port: smtpPort,
          senderName: senderName || 'Trợ Lý Thu Mua • Farmers Market',
          configured: true
        };

        return res.status(200).json({
          success: true,
          configured: true,
          message: 'Cấu hình SMTP thành công! Đã kết nối máy chủ Google Mail.'
        });
      } catch (smtpErr) {
        console.error('SMTP verification failed:', smtpErr);
        const errMsg = smtpErr.message || '';
        let vietnameseMsg = 'Không thể xác thực với máy chủ Google Mail.';
        if (errMsg.includes('Invalid login') || errMsg.includes('535-5.7.8') || errMsg.includes('Username and Password not accepted')) {
          vietnameseMsg = 'Google từ chối mật khẩu. Vui lòng tạo "Mật khẩu ứng dụng" (App Password 16 ký tự) trong tài khoản Google để sử dụng.';
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

      const activeConfig = passedConfig || globalSmtpConfig;
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

      const transporter = nodemailer.createTransport({
        host: activeConfig.host || 'smtp.gmail.com',
        port: Number(activeConfig.port) || 587,
        secure: Number(activeConfig.port) === 465,
        auth: {
          user: activeConfig.user,
          pass: String(activeConfig.pass).replace(/\s+/g, '')
        },
        tls: { rejectUnauthorized: false }
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

      await transporter.sendMail({
        from: `"${activeConfig.senderName || 'Trợ Lý Thu Mua • Farmers Market'}" <${activeConfig.user}>`,
        to: String(to).trim(),
        subject: mailSubject,
        html: mailHtml,
        text: content || taskText || noteTitle || 'Thông báo từ FM Workspace'
      });

      return res.status(200).json({
        success: true,
        message: `Đã gửi email thông báo thành công tới ${to}`
      });
    }

    // 6. Sync Workspace Backup
    if (pathname === '/sync/backup' && req.method === 'POST') {
      const body = req.body || {};
      const { backupType = 'auto', deviceName, checksum, itemCounts, payload, isEncrypted } = body;
      const now = new Date().toISOString();
      const id = `backup-${Date.now()}`;

      latestBackupData = {
        id,
        created_at: now,
        backup_type: backupType,
        device_name: deviceName || 'Web Client',
        checksum: checksum || 'verified',
        item_counts: itemCounts || {},
        payload: payload || null,
        is_encrypted: Boolean(isEncrypted)
      };

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

    // 7. Get Latest Backup
    if (pathname === '/sync/latest') {
      if (!latestBackupData) {
        return res.status(200).json({
          success: true,
          data: null,
          message: 'Chưa có bản sao lưu nào trên máy chủ đám mây'
        });
      }

      return res.status(200).json({
        success: true,
        data: latestBackupData
      });
    }

    // 8. Get Backup History & Download
    if (pathname === '/sync/history' || pathname.startsWith('/sync/download')) {
      return res.status(200).json({
        success: true,
        data: latestBackupData ? [latestBackupData] : []
      });
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
