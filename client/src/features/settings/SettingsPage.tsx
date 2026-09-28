import React, { useState, useEffect } from 'react';
import {
  SFGearshapeFill,
  SFInternaldrive,
  SFTrash,
  SFArrowDownDocument,
  SFSunMaxFill,
  SFMoonFill,
  SFPaintpalette,
  SFExclamationmarkTriangleFill,
  SFCheckmarkCircleFill,
  SFArrowClockwise,
  SFWifiSlash,
  SFTablecells,
  SFEnvelope,
  SFPaperplaneFill,
} from 'sf-symbols-lib';
import { Button } from '@/components/ui/button';
import { dataService } from '@/services/dataService';
import { excelService } from '@/services/excelService';
import { reminderService } from '@/services/reminderService';
import { ConfirmDeleteDialog } from '@/components/ui/ConfirmDeleteDialog';
import { useUiStore, resolveTheme } from '@/stores/ui-store';
import { Clock, Monitor } from 'lucide-react';
import { formatBytes } from '@/lib/utils';
import toast from 'react-hot-toast';

export const SettingsPage: React.FC = () => {
  const { theme, setTheme } = useUiStore();
  const [counts, setCounts] = useState({ links: 0, accounts: 0, stores: 0, activities: 0 });
  const [storageBytes, setStorageBytes] = useState<number>(0);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [isRepairing, setIsRepairing] = useState(false);

  // SMTP Settings State
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

  const loadSmtp = async () => {
    try {
      const res = await reminderService.getSmtpStatus();
      setSmtpStatus(res);
      if (res.fullUser) setSmtpEmail(res.fullUser);
      if (res.senderName) setSmtpSenderName(res.senderName);
    } catch (_) {}
  };

  const loadStats = async () => {
    try {
      const summary = await dataService.getWorkspaceSummary();
      const acts = await dataService.getActivities(100);
      setCounts({
        links: summary.totalLinks,
        accounts: summary.totalAccounts,
        stores: summary.totalStores,
        activities: acts.length,
      });

      if (navigator.storage && navigator.storage.estimate) {
        const estimate = await navigator.storage.estimate();
        setStorageBytes(estimate.usage || 0);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadStats();
    loadSmtp();
  }, []);

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
        toast.error(res.message || 'Lỗi gửi mail', { duration: 6500 });
      }
    } finally {
      setIsSendingTest(false);
    }
  };

  const [maskPasswordInExport, setMaskPasswordInExport] = useState(false);

  const handleExportBackup = async () => {
    try {
      await excelService.exportFullWorkspace({ maskPasswords: maskPasswordInExport });
      toast.success(
        maskPasswordInExport
          ? 'Đã tải file sao lưu Excel (Mật khẩu đã được ẩn •••••••• an toàn)!'
          : 'Đã tải xuống file sao lưu Excel thành công!'
      );
    } catch {
      toast.error('Lỗi khi xuất file');
    }
  };

  const [confirmSeedRestoreOpen, setConfirmSeedRestoreOpen] = useState(false);

  const handleResetWorkspace = async () => {
    try {
      await dataService.clearAllData();
      toast.success('Đã xóa trắng toàn bộ dữ liệu. Workspace hiện hoàn toàn sạch để bạn nhập mới!');
      await loadStats();
    } catch {
      toast.error('Lỗi khi reset workspace');
    }
  };

  const handleRestoreSeedData = async () => {
    try {
      await dataService.restoreSeedData();
      toast.success('🎉 Đã khôi phục toàn bộ dữ liệu mẫu mặc định của Farmers Market!');
      await loadStats();
    } catch {
      toast.error('Lỗi khi khôi phục dữ liệu mẫu');
    }
  };

  const handleRepairIDB = async () => {
    setIsRepairing(true);
    try {
      // Force re-open IndexedDB by calling resetInitialized
      await dataService.resetInitialized();
      await loadStats();
      toast.success('IndexedDB đã được kiểm tra & kết nối lại thành công!');
    } catch {
      toast.error('Không thể tự sửa IndexedDB. Thử F5 hoặc mở tab mới.');
    } finally {
      setIsRepairing(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      <div>
        <h1 className="text-[28px] font-semibold tracking-tight text-[#1d1d1f] dark:text-white flex items-center gap-2.5">
          <SFGearshapeFill size={24} className="text-[#0066cc]" />
          Cài Đặt & Quản Trị Hệ Thống
        </h1>
        <p className="text-[14px] text-[#86868b] dark:text-[#a1a1a6] mt-1">
          Quản lý dung lượng lưu trữ cục bộ, sao lưu dự phòng và tùy chỉnh giao diện theo tiêu chuẩn hiện đại.
        </p>
      </div>

      {/* Storage Health & Stats */}
      <div className="glass-material rounded-[22px] p-6 shadow-xs space-y-5">
        <div className="flex items-center justify-between pb-3.5 border-b border-[#e0e0e0] dark:border-white/10 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <SFInternaldrive size={16} className="text-[#0066cc]" />
            <h3 className="text-[15px] font-semibold text-[#1d1d1f] dark:text-white">
               Trạng Thái Lưu Trữ (IndexedDB)
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-semibold px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              <SFCheckmarkCircleFill size={14} />
              <span>Đã kết nối & Bền vững</span>
            </div>
            <button
              onClick={handleRepairIDB}
              disabled={isRepairing}
              className="flex items-center gap-1.5 text-xs text-[#0066cc] dark:text-[#2997ff] px-3 py-1 rounded-full bg-[#0066cc]/10 border border-[#0066cc]/20 hover:bg-[#0066cc]/20 transition-all disabled:opacity-50"
              title="Tự động kiểm tra và kết nối lại IndexedDB"
            >
              <SFArrowClockwise size={12} className={isRepairing ? 'animate-spin' : ''} />
              <span>{isRepairing ? 'Đang sửa...' : 'Tự sửa IDB'}</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 text-center">
          <div className="p-4 rounded-[16px] bg-[#f5f5f7]/60 dark:bg-white/5 border border-white/60 dark:border-white/5">
            <div className="text-[24px] font-semibold tracking-tight text-[#1d1d1f] dark:text-white">{counts.links}</div>
            <div className="text-[12px] text-[#86868b] dark:text-[#a1a1a6] font-medium mt-0.5">Links lưu trữ</div>
          </div>
          <div className="p-4 rounded-[16px] bg-[#f5f5f7]/60 dark:bg-white/5 border border-white/60 dark:border-white/5">
            <div className="text-[24px] font-semibold tracking-tight text-[#1d1d1f] dark:text-white">{counts.accounts}</div>
            <div className="text-[12px] text-[#86868b] dark:text-[#a1a1a6] font-medium mt-0.5">Tài khoản</div>
          </div>
          <div className="p-4 rounded-[16px] bg-[#f5f5f7]/60 dark:bg-white/5 border border-white/60 dark:border-white/5">
            <div className="text-[24px] font-semibold tracking-tight text-[#1d1d1f] dark:text-white">{counts.stores}</div>
            <div className="text-[12px] text-[#86868b] dark:text-[#a1a1a6] font-medium mt-0.5">Cửa hàng</div>
          </div>
          <div className="p-4 rounded-[16px] bg-[#f5f5f7]/60 dark:bg-white/5 border border-white/60 dark:border-white/5">
            <div className="text-[24px] font-semibold tracking-tight text-[#0066cc] dark:text-[#2997ff]">
              {formatBytes(storageBytes)}
            </div>
            <div className="text-[12px] text-[#86868b] dark:text-[#a1a1a6] font-medium mt-0.5">Dung lượng dùng</div>
          </div>
        </div>

        <p className="text-[13px] text-[#86868b] dark:text-[#a1a1a6] leading-relaxed">
          Tất cả dữ liệu được lưu trực tiếp trong IndexedDB của trình duyệt máy tính của bạn. Dữ liệu không bị mất khi bạn bấm F5, refresh trình duyệt hoặc đóng mở lại website.
        </p>
      </div>

      {/* Offline Notice */}
      <div className="glass-material rounded-[22px] p-5 shadow-xs flex items-start gap-3">
        <SFWifiSlash size={16} className="text-[#7a7a7a] shrink-0 mt-0.5" />
        <div>
          <p className="text-[13px] font-medium text-[#1d1d1f] dark:text-white">Hoạt động hoàn toàn ngoại tuyến</p>
          <p className="text-[12px] text-[#86868b] dark:text-[#a1a1a6] mt-0.5 leading-relaxed">
            FM Workspace không gửi bất kỳ dữ liệu nào lên internet. Mọi Links, Accounts và Stores đều nằm 100% trong trình duyệt của bạn.
          </p>
        </div>
      </div>

      {/* Data Hub, Excel & Backup */}
      <div className="glass-material rounded-[22px] p-6 shadow-xs space-y-4">
        <h3 className="text-[15px] font-semibold text-[#1d1d1f] dark:text-white flex items-center gap-2">
          <SFArrowDownDocument size={16} className="text-[#0066cc]" />
          Trung Tâm Dữ Liệu & Sao Lưu Excel
        </h3>
        <p className="text-[13px] text-[#86868b] dark:text-[#a1a1a6] leading-relaxed">
          Nhập file Excel từ máy tính của bạn, tải template mẫu hoặc xuất toàn bộ dữ liệu (LINK, ACCOUNT, DS CH) ra file Excel (.xlsx) bất kỳ lúc nào.
        </p>
        <div className="flex flex-wrap items-center gap-2.5 pt-1">
          <Button
            variant="glassProminent"
            size="sm"
            onClick={handleExportBackup}
            icon={<SFArrowDownDocument size={16} />}
          >
            Xuất Toàn Bộ Workspace (.xlsx)
          </Button>

          <Button
            variant="glass"
            size="sm"
            onClick={() => window.dispatchEvent(new CustomEvent('fm:open-import'))}
            icon={<SFInternaldrive size={16} className="text-emerald-600 dark:text-emerald-400" />}
          >
            Nạp File Excel Vào App
          </Button>

          <Button
            variant="glass"
            size="sm"
            onClick={() => {
              excelService.downloadTemplate();
              toast.success('Đã tải xuống file template mẫu Excel');
            }}
            icon={<SFTablecells size={16} className="text-[#0066cc] dark:text-[#2997ff]" />}
          >
            Tải Template Mẫu (.xlsx)
          </Button>
        </div>

        <div className="flex items-center gap-2 pt-1 text-[12.5px] text-[#555558] dark:text-[#a1a1a6]">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={maskPasswordInExport}
              onChange={(e) => setMaskPasswordInExport(e.target.checked)}
              className="rounded accent-[#0071e3] w-4 h-4 cursor-pointer outline-none focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 focus:ring-offset-0 ring-0 shadow-none"
            />
            <span>Bảo vệ quyền riêng tư: Ẩn mật khẩu (dạng ••••••••) khi xuất Excel</span>
          </label>
        </div>

        <div className="pt-3 border-t border-black/5 dark:border-white/10 flex items-center gap-2 flex-wrap text-xs text-[#76767b]">
          <span>Xuất nhanh từng sheet:</span>
          <button
            type="button"
            onClick={() => excelService.exportDataset('LINK')}
            className="px-2.5 py-1 rounded-full bg-black/[0.04] dark:bg-white/[0.06] hover:bg-[#0066cc]/10 text-[#1d1d1f] dark:text-white font-medium transition-colors"
          >
            Sheet LINK ({counts.links})
          </button>
          <button
            type="button"
            onClick={() => excelService.exportDataset('ACCOUNT', { maskPasswords: maskPasswordInExport })}
            className="px-2.5 py-1 rounded-full bg-black/[0.04] dark:bg-white/[0.06] hover:bg-emerald-500/10 text-[#1d1d1f] dark:text-white font-medium transition-colors"
          >
            Sheet ACCOUNT ({counts.accounts})
          </button>
          <button
            type="button"
            onClick={() => excelService.exportDataset('STORE')}
            className="px-2.5 py-1 rounded-full bg-black/[0.04] dark:bg-white/[0.06] hover:bg-amber-500/10 text-[#1d1d1f] dark:text-white font-medium transition-colors"
          >
            Sheet DS CH ({counts.stores})
          </button>
        </div>
      </div>

      {/* Theme / Appearance — Apple macOS 27 Liquid Glass Segmented Control */}
      <div className="glass-material rounded-[22px] p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h3 className="text-[15px] font-semibold text-[#1d1d1f] dark:text-white flex items-center gap-2">
              <SFPaintpalette size={16} className="text-[#0066cc] dark:text-[#2997ff]" />
              Giao Diện
            </h3>
            <p className="text-[13px] text-[#86868b] dark:text-[#a1a1a6] mt-0.5">
              Tùy chỉnh chế độ hiển thị sáng tối hoặc đồng bộ tự động theo thời gian thực.
            </p>
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-medium bg-[#0066cc]/10 dark:bg-[#2997ff]/15 text-[#0066cc] dark:text-[#2997ff] border border-[#0066cc]/20 dark:border-[#2997ff]/30">
            <span className="w-2 h-2 rounded-full bg-[#0066cc] dark:bg-[#2997ff] animate-pulse" />
            <span>
              {theme === 'auto_time'
                ? `Tự động: ${resolveTheme(theme) === 'dark' ? 'Đang Tối' : 'Đang Sáng'}`
                : theme === 'system'
                ? `Hệ thống: ${resolveTheme(theme) === 'dark' ? 'Đang Tối' : 'Đang Sáng'}`
                : theme === 'light'
                ? 'Sáng'
                : 'Tối'}
            </span>
          </div>
        </div>

        {/* Liquid Glass Segmented Bar: minimal text only */}
        <div className="p-1.5 rounded-[18px] bg-black/[0.04] dark:bg-white/[0.06] backdrop-blur-2xl border border-black/[0.06] dark:border-white/10 shadow-[inset_0_1px_3px_rgba(0,0,0,0.06)] grid grid-cols-2 sm:grid-cols-4 gap-1.5">
          {/* Light */}
          <button
            type="button"
            onClick={() => setTheme('light')}
            className={`py-2.5 px-3 rounded-xl transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 active:scale-[0.98] ${
              theme === 'light'
                ? 'bg-white dark:bg-[#2c2c2e] text-amber-600 dark:text-amber-400 font-semibold shadow-[0_3px_12px_rgba(0,0,0,0.1),inset_0_1px_1px_rgba(255,255,255,0.8)] dark:shadow-[0_3px_12px_rgba(0,0,0,0.4),inset_0_1px_1px_rgba(255,255,255,0.15)] border border-black/[0.04] dark:border-white/10'
                : 'text-[#6e6e73] dark:text-[#a1a1a6] hover:text-[#1d1d1f] dark:hover:text-white hover:bg-black/[0.03] dark:hover:bg-white/[0.04]'
            }`}
          >
            <SFSunMaxFill size={15} className={theme === 'light' ? 'text-amber-500' : ''} />
            <span className="text-[13px]">Sáng</span>
          </button>

          {/* Dark */}
          <button
            type="button"
            onClick={() => setTheme('dark')}
            className={`py-2.5 px-3 rounded-xl transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 active:scale-[0.98] ${
              theme === 'dark'
                ? 'bg-white dark:bg-[#2c2c2e] text-[#0071e3] dark:text-[#2997ff] font-semibold shadow-[0_3px_12px_rgba(0,0,0,0.1),inset_0_1px_1px_rgba(255,255,255,0.8)] dark:shadow-[0_3px_12px_rgba(0,0,0,0.4),inset_0_1px_1px_rgba(255,255,255,0.15)] border border-black/[0.04] dark:border-white/10'
                : 'text-[#6e6e73] dark:text-[#a1a1a6] hover:text-[#1d1d1f] dark:hover:text-white hover:bg-black/[0.03] dark:hover:bg-white/[0.04]'
            }`}
          >
            <SFMoonFill size={15} className={theme === 'dark' ? 'text-[#0071e3] dark:text-[#2997ff]' : ''} />
            <span className="text-[13px]">Tối</span>
          </button>

          {/* Auto by Time */}
          <button
            type="button"
            onClick={() => setTheme('auto_time')}
            className={`py-2.5 px-3 rounded-xl transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 active:scale-[0.98] ${
              theme === 'auto_time'
                ? 'bg-white dark:bg-[#2c2c2e] text-purple-600 dark:text-purple-400 font-semibold shadow-[0_3px_12px_rgba(0,0,0,0.1),inset_0_1px_1px_rgba(255,255,255,0.8)] dark:shadow-[0_3px_12px_rgba(0,0,0,0.4),inset_0_1px_1px_rgba(255,255,255,0.15)] border border-black/[0.04] dark:border-white/10'
                : 'text-[#6e6e73] dark:text-[#a1a1a6] hover:text-[#1d1d1f] dark:hover:text-white hover:bg-black/[0.03] dark:hover:bg-white/[0.04]'
            }`}
          >
            <Clock size={15} className={theme === 'auto_time' ? 'text-purple-600 dark:text-purple-400' : ''} />
            <span className="text-[13px]">Theo giờ</span>
          </button>

          {/* System */}
          <button
            type="button"
            onClick={() => setTheme('system')}
            className={`py-2.5 px-3 rounded-xl transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 active:scale-[0.98] ${
              theme === 'system'
                ? 'bg-white dark:bg-[#2c2c2e] text-emerald-600 dark:text-emerald-400 font-semibold shadow-[0_3px_12px_rgba(0,0,0,0.1),inset_0_1px_1px_rgba(255,255,255,0.8)] dark:shadow-[0_3px_12px_rgba(0,0,0,0.4),inset_0_1px_1px_rgba(255,255,255,0.15)] border border-black/[0.04] dark:border-white/10'
                : 'text-[#6e6e73] dark:text-[#a1a1a6] hover:text-[#1d1d1f] dark:hover:text-white hover:bg-black/[0.03] dark:hover:bg-white/[0.04]'
            }`}
          >
            <Monitor size={15} className={theme === 'system' ? 'text-emerald-600 dark:text-emerald-400' : ''} />
            <span className="text-[13px]">Hệ thống</span>
          </button>
        </div>

        <p className="text-[12px] text-[#86868b] dark:text-[#a1a1a6] flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#0066cc] dark:bg-[#2997ff]" />
          Tùy chọn giao diện được lưu tự động và nhớ qua các lần tải lại trang.
        </p>
      </div>

      {/* Automated Email & SMTP Settings */}
      <div className="glass-material rounded-[22px] p-6 shadow-xs space-y-5">
        <div className="flex items-center justify-between pb-3.5 border-b border-[#e0e0e0] dark:border-white/10 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <SFEnvelope size={20} className="text-[#0066cc]" />
            <h3 className="text-[15px] font-semibold text-[#1d1d1f] dark:text-white">
              Cấu Hình Gửi Mail Tự Động (Gmail SMTP)
            </h3>
          </div>
          <div className="flex items-center gap-2">
            {smtpStatus.configured ? (
              <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-semibold px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                <SFCheckmarkCircleFill size={14} />
                <span>Đã kết nối: {smtpStatus.fullUser || smtpStatus.smtpUser}</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 font-semibold px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20">
                <span>⚠️ Chưa cấu hình</span>
              </div>
            )}
          </div>
        </div>

        <p className="text-[13px] text-[#86868b] dark:text-[#a1a1a6] leading-relaxed">
          Hệ thống sử dụng máy chủ SMTP của Google để gửi thông báo nhắc việc và email trực tiếp đến hòm thư của bạn. Để sử dụng, bạn chỉ cần nhập tài khoản Gmail và Mật khẩu ứng dụng (App Password 16 chữ cái).
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-[12px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] block mb-1">
              Tài khoản Gmail gửi thư:
            </label>
            <input
              type="email"
              placeholder="vd: kaka.nhdk@gmail.com"
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
            <input
              type="password"
              placeholder="16 ký tự (vd: abcd efgh ijkl mnop)"
              value={smtpPassword}
              onChange={(e) => setSmtpPassword(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl text-[13px] bg-white dark:bg-white/10 border border-black/15 dark:border-white/15 outline-none focus:border-[#0071e3] text-[#1d1d1f] dark:text-white font-mono tracking-wider"
            />
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
              Máy chủ & Cổng SMTP:
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
              placeholder="Nhập email nhận thử (vd: kaka.nhdk@gmail.com)"
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

          <Button
            variant="glassProminent"
            size="sm"
            onClick={handleSaveSmtp}
            disabled={isSavingSmtp}
            className="rounded-full px-5 py-2 active:scale-95 font-medium shrink-0"
          >
            {isSavingSmtp ? 'Đang kiểm tra kết nối...' : 'Lưu & Kiểm Tra Kết Nối'}
          </Button>
        </div>
      </div>

      {/* Data Management & Danger Zone */}
      <div className="glass-material rounded-[22px] border border-black/10 dark:border-white/10 p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2 text-[#1d1d1f] dark:text-white font-semibold text-[15px]">
          <SFInternaldrive size={18} className="text-[#0066cc] dark:text-[#2997ff]" />
          Quản Trị Dữ Liệu Workspace Cục Bộ
        </div>
        <p className="text-[13px] text-[#86868b] dark:text-[#a1a1a6] leading-relaxed">
          Bạn có thể chủ động khôi phục dữ liệu mẫu ban đầu của Farmers Market hoặc dọn sạch hoàn toàn để bắt đầu nhập dữ liệu mới. Hãy tải file sao lưu Excel trước khi thực hiện các thao tác này.
        </p>
        <div className="flex items-center gap-3 flex-wrap pt-1">
          <Button
            variant="glass"
            size="sm"
            onClick={() => setConfirmSeedRestoreOpen(true)}
            className="rounded-full px-4 py-2 active:scale-95 font-medium text-[13px]"
            icon={<SFArrowClockwise size={15} className="text-[#0066cc] dark:text-[#2997ff]" />}
          >
            Khôi Phục Dữ Liệu Mẫu Ban Đầu
          </Button>

          <Button
            variant="danger"
            size="sm"
            onClick={() => setConfirmResetOpen(true)}
            className="rounded-full px-4 py-2 active:scale-95 font-medium text-[13px]"
            icon={<SFTrash size={15} />}
          >
            Xóa Sạch Dữ Liệu (Workspace Trống)
          </Button>
        </div>
      </div>

      {/* Clear Confirmation Dialog */}
      <ConfirmDeleteDialog
        isOpen={confirmResetOpen}
        onClose={() => setConfirmResetOpen(false)}
        onConfirm={handleResetWorkspace}
        title="Xác nhận xóa sạch toàn bộ dữ liệu?"
        description="Toàn bộ Links, Accounts, Stores và Lịch sử sẽ bị xóa. Hệ thống sẽ giữ workspace hoàn toàn trống để bạn nhập mới (không tự nạp lại dữ liệu mẫu)."
      />

      {/* Seed Restore Confirmation Dialog */}
      <ConfirmDeleteDialog
        isOpen={confirmSeedRestoreOpen}
        onClose={() => setConfirmSeedRestoreOpen(false)}
        onConfirm={handleRestoreSeedData}
        title="Khôi phục dữ liệu mẫu ban đầu?"
        description="Hành động này sẽ ghi đè và nạp lại toàn bộ danh mục liên kết, tài khoản và cửa hàng mặc định của Farmers Market."
      />
    </div>
  );
};
