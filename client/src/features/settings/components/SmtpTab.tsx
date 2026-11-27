import React, { useState, useEffect, useCallback } from 'react';
import {
  SFEnvelope,
  SFPaperplaneFill,
  SFCheckmarkCircleFill,
  SFEye,
  SFEyeSlash,
} from '@/components/ui/AppleIcon';
import { Button } from '@/components/ui/button';
import { ConfirmDeleteDialog } from '@/components/ui/ConfirmDeleteDialog';
import { reminderService } from '@/services/reminderService';
import toast from 'react-hot-toast';

export const SmtpTab: React.FC = React.memo(() => {
  const [smtpStatus, setSmtpStatus] = useState<{
    configured: boolean;
    smtpHost?: string;
    smtpPort?: number;
    smtpUser?: string | null;
    fullUser?: string | null;
    senderName?: string;
  }>({ configured: false });
  const [smtpEmail, setSmtpEmail] = useState('');
  const [smtpPassword, setSmtpPassword] = useState('');
  const [smtpSenderName, setSmtpSenderName] = useState('Trợ Lý Thu Mua • Farmers Market');
  const [isSavingSmtp, setIsSavingSmtp] = useState(false);
  const [testRecipient, setTestRecipient] = useState(() => reminderService.getPreferredEmail() || '');
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [showSmtpPassword, setShowSmtpPassword] = useState(false);
  const [isDisconnectingSmtp, setIsDisconnectingSmtp] = useState(false);
  const [confirmDisconnectSmtpOpen, setConfirmDisconnectSmtpOpen] = useState(false);

  const loadSmtp = useCallback(async () => {
    try {
      const res = await reminderService.getSmtpStatus();
      setSmtpStatus(res);
      if (res.fullUser) setSmtpEmail(res.fullUser);
      if (res.senderName) setSmtpSenderName(res.senderName);
    } catch (err) {
      console.warn('[SmtpTab] Failed to load SMTP status:', err);
    }
  }, []);

  useEffect(() => {
    loadSmtp();
  }, [loadSmtp]);

  const handleSaveSmtp = async () => {
    if (!smtpEmail.trim() || !smtpPassword.trim()) {
      toast.error('Vui lòng nhập Email Gmail và Mật khẩu ứng dụng (App Password 16 ký tự)');
      return;
    }
    setIsSavingSmtp(true);
    try {
      const res = await reminderService.configureSmtp({
        user: smtpEmail.trim(),
        pass: smtpPassword.trim(),
        senderName: smtpSenderName.trim(),
      });
      if (res.success) {
        toast.success('🎉 Cấu hình SMTP thành công! Máy chủ đã sẵn sàng gửi email thực tế.');
        setSmtpPassword('');
        await loadSmtp();
      } else {
        toast.error(res.message, { duration: 6500 });
      }
    } finally {
      setIsSavingSmtp(false);
    }
  };

  const handleDisconnectSmtp = async () => {
    setIsDisconnectingSmtp(true);
    try {
      const res = await reminderService.disconnectSmtp();
      if (res.success) {
        toast.success('Đã gỡ bỏ tài khoản gửi email thành công!');
        setSmtpEmail('');
        setSmtpPassword('');
        await loadSmtp();
      } else {
        toast.error(res.message);
      }
    } finally {
      setIsDisconnectingSmtp(false);
      setConfirmDisconnectSmtpOpen(false);
    }
  };

  const handleTestSendFromSettings = async () => {
    if (!testRecipient.trim()) {
      toast.error('Vui lòng nhập email người nhận thử nghiệm');
      return;
    }
    setIsSendingTest(true);
    try {
      const res = await reminderService.sendAutomatedEmail({
        to: testRecipient.trim(),
        noteTitle: 'Kiểm tra hệ thống gửi mail tự động',
        content: 'Xin chào! Đây là email kiểm tra tính năng thông báo tự động từ Hệ Thống Trợ Lý Thu Mua Farmers Market.',
      });
      if (res.success) {
        toast.success(`✉️ Đã gửi email thực tế tới ${testRecipient}! Hãy kiểm tra hộp thư đến (hoặc thư mục Spam).`, { duration: 6500 });
      } else {
        const subject = encodeURIComponent('[FM Workspace] Kiểm tra gửi mail tự động');
        const body = encodeURIComponent('Xin chào! Đây là email kiểm tra tính năng thông báo tự động từ Hệ Thống Trợ Lý Thu Mua Farmers Market.');
        const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(testRecipient.trim())}&su=${subject}&body=${body}`;
        window.open(gmailUrl, '_blank');
        toast.success(`📬 Đã chuyển tiếp soạn thư trực tiếp trên Gmail tới ${testRecipient}!`, { duration: 5500 });
      }
    } catch {
      const subject = encodeURIComponent('[FM Workspace] Kiểm tra gửi mail tự động');
      const body = encodeURIComponent('Xin chào! Đây là email kiểm tra tính năng thông báo tự động từ Hệ Thống Trợ Lý Thu Mua Farmers Market.');
      const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(testRecipient.trim())}&su=${subject}&body=${body}`;
      window.open(gmailUrl, '_blank');
      toast.success(`📬 Đã chuyển tiếp soạn thư trực tiếp trên Gmail tới ${testRecipient}!`, { duration: 5500 });
    } finally {
      setIsSendingTest(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="glass-material rounded-[22px] p-6 shadow-xs space-y-5">
        <div className="flex items-center justify-between pb-3.5 border-b border-[#e0e0e0] dark:border-white/10 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <SFEnvelope size={20} className="text-[#0071e3] dark:text-[#2997ff]" />
            <h3 className="text-[15px] font-semibold text-[#1d1d1f] dark:text-white">
              Cấu Hình Gửi Mail Tự Động (Gmail SMTP)
            </h3>
          </div>
          <div className="flex items-center gap-2">
            {smtpStatus.configured ? (
              <div className="apple-badge-base apple-badge-success">
                <SFCheckmarkCircleFill size={12} className="shrink-0" />
                <span>Đã kết nối: {smtpStatus.fullUser || smtpStatus.smtpUser}</span>
              </div>
            ) : (
              <div className="apple-badge-base apple-badge-warning">
                <span>⚠️ Chưa cấu hình</span>
              </div>
            )}
          </div>
        </div>

        <p className="text-[13px] text-[#86868b] dark:text-[#a1a1a6] leading-relaxed">
          Hệ thống sử dụng máy chủ SMTP của Google để gửi thông báo nhắc việc và email trực tiếp đến hòm thư của bạn. Bạn có thể thay đổi hoặc gỡ bỏ tài khoản gửi email bất kỳ lúc nào bên dưới.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-[12px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] block mb-1">
              Tài khoản Gmail gửi thư:
            </label>
            <input
              type="email"
              placeholder="vd: thumua.farmers@gmail.com"
              value={smtpEmail}
              onChange={(e) => setSmtpEmail(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl text-[13px] bg-white dark:bg-white/10 border border-black/15 dark:border-white/15 outline-none focus:border-[#0071e3] text-[#1d1d1f] dark:text-white"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[12px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7]">
                Mật khẩu ứng dụng (Google App Password):
              </label>
              <a
                href="https://myaccount.google.com/apppasswords"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-[#0071e3] dark:text-[#2997ff] hover:underline"
              >
                Tạo App Password ↗
              </a>
            </div>
            <div className="relative flex items-center">
              <input
                type={showSmtpPassword ? 'text' : 'password'}
                placeholder="16 ký tự (vd: abcd efgh ijkl mnop)"
                value={smtpPassword}
                onChange={(e) => setSmtpPassword(e.target.value)}
                className="w-full px-3.5 py-2 pr-10 rounded-xl text-[13px] bg-white dark:bg-white/10 border border-black/15 dark:border-white/15 outline-none focus:border-[#0071e3] text-[#1d1d1f] dark:text-white font-mono tracking-wider"
              />
              <button
                type="button"
                onClick={() => setShowSmtpPassword(!showSmtpPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer select-none active:scale-90"
                title={showSmtpPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                aria-label={showSmtpPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              >
                {showSmtpPassword ? <SFEyeSlash size={15} /> : <SFEye size={15} />}
              </button>
            </div>
          </div>

          <div>
            <label className="text-[12px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] block mb-1">
              Tên người gửi hiển thị:
            </label>
            <input
              type="text"
              placeholder="Trợ Lý Thu Mua • Farmers Market"
              value={smtpSenderName}
              onChange={(e) => setSmtpSenderName(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl text-[13px] bg-white dark:bg-white/10 border border-black/15 dark:border-white/15 outline-none focus:border-[#0071e3] text-[#1d1d1f] dark:text-white"
            />
          </div>

          <div>
            <label className="text-[12px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] block mb-1">
              Máy chủ &amp; Cổng SMTP:
            </label>
            <div className="w-full px-3.5 py-2 rounded-xl text-[13px] bg-black/[0.03] dark:bg-white/5 border border-black/10 dark:border-white/10 text-[#76767b] dark:text-[#a1a1a6]">
              smtp.gmail.com : 587 (TLS / STARTTLS)
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div className="flex items-center gap-2 flex-1 min-w-[260px] max-w-md">
            <input
              type="email"
              placeholder="Nhập email nhận thử (vd: nguoinhan@example.com)"
              value={testRecipient}
              onChange={(e) => setTestRecipient(e.target.value)}
              className="flex-1 px-3 py-1.5 rounded-xl text-[12px] bg-white dark:bg-white/10 border border-black/15 dark:border-white/15 outline-none focus:border-[#0071e3] text-[#1d1d1f] dark:text-white"
            />
            <Button
              variant="glass"
              size="sm"
              onClick={handleTestSendFromSettings}
              disabled={isSendingTest || !smtpStatus.configured}
              icon={<SFPaperplaneFill size={14} />}
              className="shrink-0 text-xs"
            >
              {isSendingTest ? 'Đang gửi...' : 'Gửi thử nghiệm'}
            </Button>
          </div>

          <div className="flex items-center gap-2">
            {smtpStatus.configured && (
              <Button
                variant="glass"
                size="sm"
                onClick={() => setConfirmDisconnectSmtpOpen(true)}
                disabled={isDisconnectingSmtp}
                className="rounded-full px-4 py-2 text-red-600 dark:text-red-400 hover:bg-red-500/10 border-red-500/20 active:scale-95 text-xs font-medium cursor-pointer"
              >
                {isDisconnectingSmtp ? 'Đang gỡ...' : 'Gỡ Tài Khoản'}
              </Button>
            )}

            <Button
              variant="glassProminent"
              size="sm"
              onClick={handleSaveSmtp}
              disabled={isSavingSmtp}
              className="rounded-full px-5 py-2 active:scale-95 font-medium shrink-0"
            >
              {isSavingSmtp ? 'Đang kiểm tra...' : smtpStatus.configured ? 'Cập Nhật Tài Khoản' : 'Lưu & Kiểm Tra Kết Nối'}
            </Button>
          </div>
        </div>
      </div>

      <ConfirmDeleteDialog
        isOpen={confirmDisconnectSmtpOpen}
        title="Gỡ tài khoản gửi thư?"
        message="Bạn sẽ cần cài đặt lại tài khoản Gmail và mật khẩu ứng dụng (App Password) mới để tiếp tục gửi email nhắc nhở tự động."
        itemLabel={smtpStatus.fullUser || smtpStatus.smtpUser || smtpEmail}
        confirmText="Gỡ tài khoản"
        cancelText="Hủy"
        onConfirm={handleDisconnectSmtp}
        onCancel={() => setConfirmDisconnectSmtpOpen(false)}
        isLoading={isDisconnectingSmtp}
      />
    </div>
  );
});
