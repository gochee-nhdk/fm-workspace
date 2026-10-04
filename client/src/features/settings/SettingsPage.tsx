import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  SFShieldFill,
  SFArrowUpDocument,
  SFEye,
  SFEyeSlash,
} from 'sf-symbols-lib';
import { Button } from '@/components/ui/button';
import { dataService } from '@/services/dataService';
import { excelService } from '@/services/excelService';
import { reminderService } from '@/services/reminderService';
import { backupService } from '@/services/backupService';
import { persistentStorage, StorageStatus } from '@/services/storage/persistentStorage';
import { autoBackupManager } from '@/services/autoBackupManager';
import { ConfirmDeleteDialog } from '@/components/ui/ConfirmDeleteDialog';
import { AppleLiquidDialog } from '@/components/ui/AppleLiquidDialog';
import { useUiStore, resolveTheme } from '@/stores/ui-store';
import { useSecurityStore } from '@/stores/security-store';
import { Clock, Monitor, Lock, Unlock, Server, ShieldCheck, Database, KeyRound, Bookmark, Info } from 'lucide-react';
import { formatBytes } from '@/lib/utils';
import { useAppleTabSpring, useDirectionalTab } from '@/lib/motion';
import toast from 'react-hot-toast';
import type { BackupImportOptions, BackupImportResult } from '@/types/workspace';

export const ThemeSegmentedControl: React.FC = () => {
  const { theme, setTheme } = useUiStore();
  const themeTrackRef = useRef<HTMLDivElement>(null);
  const themePillRef = useRef<HTMLDivElement>(null);

  useAppleTabSpring(themeTrackRef, themePillRef, theme, {
    stiffness: 380,
    damping: 25,
    mass: 0.75,
    allowDeformation: true,
  });

  return (
    <div
      ref={themeTrackRef}
      role="tablist"
      aria-label="Tùy chọn giao diện hệ thống"
      className="relative p-1.5 rounded-[18px] bg-black/[0.04] dark:bg-white/[0.06] backdrop-blur-2xl border border-black/[0.06] dark:border-white/10 shadow-[inset_0_1px_3px_rgba(0,0,0,0.06)] grid grid-cols-4 gap-1.5 select-none"
    >
      {/* Shared Active Liquid Glass Pill (continuous physical surface morphing & traveling) */}
      <div
        ref={themePillRef}
        data-layout-id="theme-active-pill"
        aria-hidden="true"
        className="absolute inset-y-1.5 left-0 rounded-xl pointer-events-none z-0 bg-white dark:bg-[#2c2c2e] shadow-[0_3px_12px_rgba(0,0,0,0.1),inset_0_1px_1px_rgba(255,255,255,0.8)] dark:shadow-[0_3px_12px_rgba(0,0,0,0.4),inset_0_1px_1px_rgba(255,255,255,0.15)] border border-black/[0.04] dark:border-white/10 will-change-[transform,width] origin-center opacity-0 transition-opacity duration-150"
      />

      {/* Light */}
      <button
        type="button"
        role="tab"
        aria-selected={theme === 'light'}
        data-tab-id="light"
        onClick={() => setTheme('light')}
        className={`relative z-10 py-2.5 px-2 sm:px-3 rounded-xl transition-colors duration-160 cursor-pointer flex items-center justify-center gap-1.5 sm:gap-2 active:scale-[0.98] select-none ${
          theme === 'light'
            ? 'text-amber-600 dark:text-amber-400 font-semibold drop-shadow-[0_0.5px_0.5px_rgba(255,255,255,0.8)] dark:drop-shadow-none'
            : 'text-[#6e6e73] dark:text-[#a1a1a6] hover:text-[#1d1d1f] dark:hover:text-white font-medium hover:bg-black/[0.03] dark:hover:bg-white/[0.04]'
        }`}
      >
        <SFSunMaxFill size={15} className={`transition-colors duration-160 shrink-0 ${theme === 'light' ? 'text-amber-500' : ''}`} />
        <span className="text-[12.5px] sm:text-[13px] truncate">Sáng</span>
      </button>

      {/* Dark */}
      <button
        type="button"
        role="tab"
        aria-selected={theme === 'dark'}
        data-tab-id="dark"
        onClick={() => setTheme('dark')}
        className={`relative z-10 py-2.5 px-2 sm:px-3 rounded-xl transition-colors duration-160 cursor-pointer flex items-center justify-center gap-1.5 sm:gap-2 active:scale-[0.98] select-none ${
          theme === 'dark'
            ? 'text-[#0071e3] dark:text-[#2997ff] font-semibold drop-shadow-[0_0.5px_0.5px_rgba(255,255,255,0.8)] dark:drop-shadow-none'
            : 'text-[#6e6e73] dark:text-[#a1a1a6] hover:text-[#1d1d1f] dark:hover:text-white font-medium hover:bg-black/[0.03] dark:hover:bg-white/[0.04]'
        }`}
      >
        <SFMoonFill size={15} className={`transition-colors duration-160 shrink-0 ${theme === 'dark' ? 'text-[#0071e3] dark:text-[#2997ff]' : ''}`} />
        <span className="text-[12.5px] sm:text-[13px] truncate">Tối</span>
      </button>

      {/* Auto by Time */}
      <button
        type="button"
        role="tab"
        aria-selected={theme === 'auto_time'}
        data-tab-id="auto_time"
        onClick={() => setTheme('auto_time')}
        className={`relative z-10 py-2.5 px-2 sm:px-3 rounded-xl transition-colors duration-160 cursor-pointer flex items-center justify-center gap-1.5 sm:gap-2 active:scale-[0.98] select-none ${
          theme === 'auto_time'
            ? 'text-purple-600 dark:text-purple-400 font-semibold drop-shadow-[0_0.5px_0.5px_rgba(255,255,255,0.8)] dark:drop-shadow-none'
            : 'text-[#6e6e73] dark:text-[#a1a1a6] hover:text-[#1d1d1f] dark:hover:text-white font-medium hover:bg-black/[0.03] dark:hover:bg-white/[0.04]'
        }`}
      >
        <Clock size={15} className={`transition-colors duration-160 shrink-0 ${theme === 'auto_time' ? 'text-purple-600 dark:text-purple-400' : ''}`} />
        <span className="text-[12.5px] sm:text-[13px] truncate">Theo giờ</span>
      </button>

      {/* System */}
      <button
        type="button"
        role="tab"
        aria-selected={theme === 'system'}
        data-tab-id="system"
        onClick={() => setTheme('system')}
        className={`relative z-10 py-2.5 px-2 sm:px-3 rounded-xl transition-colors duration-160 cursor-pointer flex items-center justify-center gap-1.5 sm:gap-2 active:scale-[0.98] select-none ${
          theme === 'system'
            ? 'text-emerald-600 dark:text-emerald-400 font-semibold drop-shadow-[0_0.5px_0.5px_rgba(255,255,255,0.8)] dark:drop-shadow-none'
            : 'text-[#6e6e73] dark:text-[#a1a1a6] hover:text-[#1d1d1f] dark:hover:text-white font-medium hover:bg-black/[0.03] dark:hover:bg-white/[0.04]'
        }`}
      >
        <Monitor size={15} className={`transition-colors duration-160 shrink-0 ${theme === 'system' ? 'text-emerald-600 dark:text-emerald-400' : ''}`} />
        <span className="text-[12.5px] sm:text-[13px] truncate">Hệ thống</span>
      </button>
    </div>
  );
};

export const SettingsPage: React.FC = () => {
  const { theme } = useUiStore();

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

  // Apple Segmented Tab Navigation State
  const SETTINGS_TABS = ['backup', 'shield', 'smtp', 'appearance'] as const;
  type SettingsTab = typeof SETTINGS_TABS[number];
  const [activeTab, setActiveTab] = useState<SettingsTab>('backup');
  const [showSmtpPassword, setShowSmtpPassword] = useState(false);
  const [isDisconnectingSmtp, setIsDisconnectingSmtp] = useState(false);

  const tabTrackRef = useRef<HTMLDivElement>(null);
  const tabPillRef = useRef<HTMLDivElement>(null);
  const { animationClass } = useDirectionalTab(activeTab, SETTINGS_TABS);

  useAppleTabSpring(tabTrackRef, tabPillRef, activeTab, {
    stiffness: 360,
    damping: 23,
    mass: 0.82,
    allowDeformation: true,
  });

  const handleDisconnectSmtp = async () => {
    if (!confirm('Bạn có chắc chắn muốn gỡ tài khoản Gmail gửi thư này? Bạn sẽ cần nhập tài khoản mới để tiếp tục gửi email nhắc nhở.')) {
      return;
    }
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
    }
  };

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

  // ──────────────────────────────────────────
  // BACKUP SYSTEM STATE & DISASTER RECOVERY
  // ──────────────────────────────────────────
  const [isExportingBackup, setIsExportingBackup] = useState(false);
  const [isImportingBackup, setIsImportingBackup] = useState(false);
  const [importProgress, setImportProgress] = useState('');
  const [importResult, setImportResult] = useState<BackupImportResult | null>(null);
  const [importConflictStrategy, setImportConflictStrategy] = useState<BackupImportOptions['conflictStrategy']>('skip');
  const [restoreSettingsOnImport, setRestoreSettingsOnImport] = useState(false);
  const backupFileInputRef = useRef<HTMLInputElement>(null);

  // Security: Password encryption state
  const [exportPassword, setExportPassword] = useState('');
  const [showExportPassword, setShowExportPassword] = useState(false);
  const [importPassword, setImportPassword] = useState('');
  const [pendingEncryptedFile, setPendingEncryptedFile] = useState<File | null>(null);
  const [showPasswordPromptModal, setShowPasswordPromptModal] = useState(false);

  // Storage Persistence & Server Sync Status
  const [storageStatus, setStorageStatus] = useState<StorageStatus>({ isPersisted: false, supported: false });
  const [isRequestingPersistence, setIsRequestingPersistence] = useState(false);
  const [showPersistenceGuideModal, setShowPersistenceGuideModal] = useState(false);
  const [serverHistory, setServerHistory] = useState<any[]>([]);
  const [isSyncingServer, setIsSyncingServer] = useState(false);
  const [isRestoringServer, setIsRestoringServer] = useState(false);

  // Local Security Store
  const { isLockEnabled, setPin, disableLock, autoLockMinutes, setAutoLockMinutes } = useSecurityStore();
  const [pinInput, setPinInput] = useState('');
  const [pinConfirmInput, setPinConfirmInput] = useState('');
  const [pinMismatch, setPinMismatch] = useState(false);
  const [currentPinInput, setCurrentPinInput] = useState('');
  const [showPinSetupModal, setShowPinSetupModal] = useState(false);
  const [showPinRemoveModal, setShowPinRemoveModal] = useState(false);
  const [pinRemoveInput, setPinRemoveInput] = useState('');
  const [pinRemoveMismatch, setPinRemoveMismatch] = useState(false);

  const loadStorageAndSyncStatus = async () => {
    try {
      const status = await persistentStorage.getStatus();
      setStorageStatus(status);
      const history = await backupService.getServerBackupHistory();
      setServerHistory(history);
    } catch (_) {}
  };

  useEffect(() => {
    loadStorageAndSyncStatus();
  }, []);

  const handleRequestPersistentStorage = async () => {
    setIsRequestingPersistence(true);
    try {
      const res = await persistentStorage.requestPersistence();
      if (res.success) {
        toast.success(res.message, { duration: 6000 });
      } else {
        if (res.reason === 'browser_denied') {
          // Open Apple Guidance Modal to explain bookmark / site engagement requirement
          setShowPersistenceGuideModal(true);
        } else {
          toast(res.message, { icon: 'ℹ️', duration: 6000 });
        }
      }
      await loadStorageAndSyncStatus();
    } finally {
      setIsRequestingPersistence(false);
    }
  };

  const handleManualServerSync = async () => {
    setIsSyncingServer(true);
    try {
      const res = await backupService.syncToServer('manual');
      if (res.success) {
        toast.success('☁️ Đã sao lưu dự phòng tức thời lên máy chủ thành công!');
        await loadStorageAndSyncStatus();
      } else {
        toast.error('Lỗi khi sao lưu lên máy chủ: ' + (res.message || 'Kiểm tra kết nối'));
      }
    } finally {
      setIsSyncingServer(false);
    }
  };

  const handleRestoreLatestServerBackup = async (backupId?: string) => {
    if (!confirm('Khôi phục từ máy chủ sẽ cập nhật dữ liệu hiện tại bằng phiên bản đã lưu. Bạn có muốn tiếp tục?')) {
      return;
    }
    setIsRestoringServer(true);
    try {
      const res = await backupService.restoreFromServer(backupId);
      if (res.success) {
        toast.success('🎉 Khôi phục thảm họa thành công từ máy chủ! Toàn bộ dữ liệu đã được phục hồi.');
        await loadStats();
        await loadStorageAndSyncStatus();
      } else {
        toast.error(`Khôi phục thất bại: ${res.errors[0] || 'Lỗi không xác định'}`);
      }
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khi khôi phục từ máy chủ.');
    } finally {
      setIsRestoringServer(false);
    }
  };

  const handleExportFMBackup = async () => {
    setIsExportingBackup(true);
    try {
      await backupService.exportFullBackup({
        includeActivities: true,
        passphrase: exportPassword.trim() || undefined,
      });
      if (exportPassword.trim()) {
        toast.success('🔒 Đã xuất file .fmbackup MÃ HOÁ (AES-GCM-256) thành công! Hãy nhớ mật khẩu để giải mã.', { duration: 6000 });
      } else {
        toast.success('✅ Đã xuất file .fmbackup thành công! File chứa toàn bộ dữ liệu của bạn.', { duration: 5000 });
      }
    } catch (err) {
      console.error(err);
      toast.error('Lỗi khi xuất file backup. Vui lòng thử lại.');
    } finally {
      setIsExportingBackup(false);
    }
  };

  const executeImportFile = async (file: File, password?: string) => {
    setIsImportingBackup(true);
    setImportResult(null);
    setImportProgress('Đang kiểm tra và giải mã file...');

    try {
      const result = await backupService.importFullBackup(
        file,
        {
          conflictStrategy: importConflictStrategy,
          restoreSettings: restoreSettingsOnImport,
          passphrase: password,
        },
        (msg) => setImportProgress(msg)
      );

      setImportResult(result);

      if (result.success) {
        const total = result.links + result.accounts + result.stores + result.notes + result.attachments;
        toast.success(
          `✅ Nhập thành công ${total} mục! (${result.links} Links, ${result.accounts} TK, ${result.stores} CH, ${result.notes} Ghi chú, ${result.attachments} Tệp)`,
          { duration: 7000 }
        );
        await loadStats();
        await loadStorageAndSyncStatus();
        setShowPasswordPromptModal(false);
        setPendingEncryptedFile(null);
        setImportPassword('');
      } else {
        if (result.errors.some((e) => e.includes('mã hóa') || e.includes('mật khẩu'))) {
          setPendingEncryptedFile(file);
          setShowPasswordPromptModal(true);
        }
        toast.error(`Nhập thất bại: ${result.errors[0] ?? 'Lỗi không xác định'}`, { duration: 7000 });
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Lỗi nghiêm trọng khi nhập dữ liệu.');
    } finally {
      setIsImportingBackup(false);
      setImportProgress('');
    }
  };

  const handleImportFMBackup = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input for re-use
    e.target.value = '';

    // Quick pre-check: must have .fmbackup extension
    if (!file.name.endsWith('.fmbackup')) {
      toast.error('Vui lòng chọn file có đuôi .fmbackup hợp lệ.');
      return;
    }

    // Step 1: Validate header first
    const validation = await backupService.validateBackupFile(file);
    if (!validation.valid) {
      toast.error(`❌ File không hợp lệ: ${validation.error}`, { duration: 7000 });
      return;
    }

    if (validation.header?.encrypted) {
      setPendingEncryptedFile(file);
      setShowPasswordPromptModal(true);
      return;
    }

    await executeImportFile(file);
  }, [importConflictStrategy, restoreSettingsOnImport]);

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      <div>
        <h1 className="text-[28px] font-semibold tracking-tight text-[#1d1d1f] dark:text-white flex items-center gap-2.5">
          <SFGearshapeFill size={24} className="text-[#0066cc] dark:text-[#2997ff]" />
          Cài đặt &amp; Dữ liệu
        </h1>
        <p className="text-[14px] text-[#86868b] dark:text-[#a1a1a6] mt-1">
          Quản lý dung lượng lưu trữ cục bộ, lá chắn sao lưu kép, tích hợp gửi thư tự động và tùy biến giao diện Apple.
        </p>
      </div>

      {/* ── Apple Liquid Glass Master Segmented Navigation Bar (Synchronized with UnifiedWorkspacePage) ── */}
      <div className="flex items-center justify-start overflow-x-auto pb-1 scrollbar-none">
        <div
          ref={tabTrackRef}
          role="tablist"
          aria-label="Cài đặt hệ thống"
          className="liquid-glass-segmented-track p-1 inline-flex items-center self-start sm:self-auto shrink-0 relative select-none"
        >
          {/* Shared Active Navigation Pill (ONE continuous physical surface that morphs & travels) */}
          <div
            ref={tabPillRef}
            data-layout-id="settings-active-tab-pill"
            aria-hidden="true"
            className="absolute inset-y-1 left-0 rounded-full pointer-events-none z-0 liquid-lens-pill-active will-change-[transform,width] origin-center opacity-0 transition-opacity duration-100"
          />

          {/* Tab 1: Backup */}
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'backup'}
            data-tab-id="backup"
            onClick={() => setActiveTab('backup')}
            className={`group relative z-10 inline-flex items-center justify-center gap-2 min-w-[120px] sm:min-w-[136px] h-[30px] px-3.5 py-0 rounded-full text-[13px] leading-none transition-[color,transform] duration-140 ease-[cubic-bezier(0.16,1,0.3,1)] cursor-pointer whitespace-nowrap active:scale-[0.95] select-none will-change-transform ${
              activeTab === 'backup'
                ? 'text-[#0071e3] dark:text-[#3898ff] font-semibold'
                : 'text-[#6e6e73] dark:text-[#a1a1a6] hover:text-[#1d1d1f] dark:hover:text-white hover:bg-black/[0.03] dark:hover:bg-white/[0.04] font-medium'
            }`}
          >
            <SFArrowDownDocument
              size={15}
              className={`transition-all duration-140 ease-out shrink-0 ${
                activeTab === 'backup'
                  ? 'text-[#0071e3] dark:text-[#3898ff]'
                  : 'text-[#8e8e93] group-hover:text-[#555558] dark:group-hover:text-[#d1d1d6]'
              }`}
            />
            <span className="transition-colors duration-140 leading-none">Dữ Liệu &amp; Sao Lưu</span>
          </button>

          {/* Tab 2: Shield */}
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'shield'}
            data-tab-id="shield"
            onClick={() => setActiveTab('shield')}
            className={`group relative z-10 inline-flex items-center justify-center gap-2 min-w-[120px] sm:min-w-[136px] h-[30px] px-3.5 py-0 rounded-full text-[13px] leading-none transition-[color,transform] duration-140 ease-[cubic-bezier(0.16,1,0.3,1)] cursor-pointer whitespace-nowrap active:scale-[0.95] select-none will-change-transform ${
              activeTab === 'shield'
                ? 'text-[#0071e3] dark:text-[#3898ff] font-semibold'
                : 'text-[#6e6e73] dark:text-[#a1a1a6] hover:text-[#1d1d1f] dark:hover:text-white hover:bg-black/[0.03] dark:hover:bg-white/[0.04] font-medium'
            }`}
          >
            <ShieldCheck
              size={15}
              className={`transition-all duration-140 ease-out shrink-0 ${
                activeTab === 'shield'
                  ? 'text-[#0071e3] dark:text-[#3898ff]'
                  : 'text-[#8e8e93] group-hover:text-[#555558] dark:group-hover:text-[#d1d1d6]'
              }`}
            />
            <span className="transition-colors duration-140 leading-none">Lá Chắn An Toàn</span>
          </button>

          {/* Tab 3: SMTP */}
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'smtp'}
            data-tab-id="smtp"
            onClick={() => setActiveTab('smtp')}
            className={`group relative z-10 inline-flex items-center justify-center gap-2 min-w-[120px] sm:min-w-[136px] h-[30px] px-3.5 py-0 rounded-full text-[13px] leading-none transition-[color,transform] duration-140 ease-[cubic-bezier(0.16,1,0.3,1)] cursor-pointer whitespace-nowrap active:scale-[0.95] select-none will-change-transform ${
              activeTab === 'smtp'
                ? 'text-[#0071e3] dark:text-[#3898ff] font-semibold'
                : 'text-[#6e6e73] dark:text-[#a1a1a6] hover:text-[#1d1d1f] dark:hover:text-white hover:bg-black/[0.03] dark:hover:bg-white/[0.04] font-medium'
            }`}
          >
            <SFEnvelope
              size={15}
              className={`transition-all duration-140 ease-out shrink-0 ${
                activeTab === 'smtp'
                  ? 'text-[#0071e3] dark:text-[#3898ff]'
                  : 'text-[#8e8e93] group-hover:text-[#555558] dark:group-hover:text-[#d1d1d6]'
              }`}
            />
            <span className="transition-colors duration-140 leading-none">Gửi Mail Tự Động</span>
          </button>

          {/* Tab 4: Appearance */}
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'appearance'}
            data-tab-id="appearance"
            onClick={() => setActiveTab('appearance')}
            className={`group relative z-10 inline-flex items-center justify-center gap-2 min-w-[110px] sm:min-w-[120px] h-[30px] px-3.5 py-0 rounded-full text-[13px] leading-none transition-[color,transform] duration-140 ease-[cubic-bezier(0.16,1,0.3,1)] cursor-pointer whitespace-nowrap active:scale-[0.95] select-none will-change-transform ${
              activeTab === 'appearance'
                ? 'text-[#0071e3] dark:text-[#3898ff] font-semibold'
                : 'text-[#6e6e73] dark:text-[#a1a1a6] hover:text-[#1d1d1f] dark:hover:text-white hover:bg-black/[0.03] dark:hover:bg-white/[0.04] font-medium'
            }`}
          >
            <SFPaintpalette
              size={15}
              className={`transition-all duration-140 ease-out shrink-0 ${
                activeTab === 'appearance'
                  ? 'text-[#0071e3] dark:text-[#3898ff]'
                  : 'text-[#8e8e93] group-hover:text-[#555558] dark:group-hover:text-[#d1d1d6]'
              }`}
            />
            <span className="transition-colors duration-140 leading-none">Giao Diện</span>
          </button>
        </div>
      </div>

      {/* ── Spatial Animated Settings Tab Content Container ── */}
      <div key={activeTab} className={animationClass}>
        {/* ── TAB 1: DỮ LIỆU & SAO LƯU ── */}
        {activeTab === 'backup' && (
          <div className="space-y-6">
          {/* Storage Health & Stats */}
          <div className="glass-material rounded-[22px] p-6 shadow-xs space-y-5">
            <div className="flex items-center justify-between pb-3.5 border-b border-[#e0e0e0] dark:border-white/10 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <SFInternaldrive size={18} className="text-[#0071e3] dark:text-[#2997ff]" />
                <h3 className="text-[15px] font-semibold text-[#1d1d1f] dark:text-white">
                  Trạng Thái Lưu Trữ (IndexedDB)
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-semibold bg-[#34c759]/12 text-[#1a8238] dark:text-[#30d158] border border-[#34c759]/25 shadow-[0_2px_8px_rgba(52,199,89,0.12),inset_0_1px_0_rgba(255,255,255,0.7)] dark:shadow-[0_2px_10px_rgba(48,209,88,0.18),inset_0_1px_0_rgba(255,255,255,0.15)] backdrop-blur-xl transition-all">
                  <SFCheckmarkCircleFill size={13} className="shrink-0" />
                  <span>Đã kết nối & Bền vững</span>
                </div>
                <button
                  type="button"
                  onClick={handleRepairIDB}
                  disabled={isRepairing}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-semibold bg-[#0071e3]/10 text-[#0071e3] dark:text-[#2997ff] border border-[#0071e3]/22 shadow-[0_2px_8px_rgba(0,113,227,0.1),inset_0_1px_0_rgba(255,255,255,0.8)] dark:shadow-[0_2px_10px_rgba(10,132,255,0.2),inset_0_1px_0_rgba(255,255,255,0.15)] backdrop-blur-xl hover:bg-[#0071e3]/16 transition-all disabled:opacity-50 active:scale-95 cursor-pointer"
                  title="Tự động kiểm tra và kết nối lại IndexedDB"
                >
                  <SFArrowClockwise size={12} className={isRepairing ? 'animate-spin' : ''} />
                  <span>{isRepairing ? 'Đang sửa...' : 'Tự sửa IDB'}</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 text-center">
              <div className="p-4 rounded-[16px] bg-[#f5f5f7]/60 dark:bg-white/5 border border-white/60 dark:border-white/5 shadow-xs">
                <div className="text-[24px] font-semibold tracking-tight text-[#1d1d1f] dark:text-white">{counts.links}</div>
                <div className="text-[12px] text-[#86868b] dark:text-[#a1a1a6] font-medium mt-0.5">Links lưu trữ</div>
              </div>
              <div className="p-4 rounded-[16px] bg-[#f5f5f7]/60 dark:bg-white/5 border border-white/60 dark:border-white/5 shadow-xs">
                <div className="text-[24px] font-semibold tracking-tight text-[#1d1d1f] dark:text-white">{counts.accounts}</div>
                <div className="text-[12px] text-[#86868b] dark:text-[#a1a1a6] font-medium mt-0.5">Tài khoản</div>
              </div>
              <div className="p-4 rounded-[16px] bg-[#f5f5f7]/60 dark:bg-white/5 border border-white/60 dark:border-white/5 shadow-xs">
                <div className="text-[24px] font-semibold tracking-tight text-[#1d1d1f] dark:text-white">{counts.stores}</div>
                <div className="text-[12px] text-[#86868b] dark:text-[#a1a1a6] font-medium mt-0.5">Cửa hàng</div>
              </div>
              <div className="p-4 rounded-[16px] bg-[#f5f5f7]/60 dark:bg-white/5 border border-white/60 dark:border-white/5 shadow-xs">
                <div className="text-[24px] font-semibold tracking-tight text-[#0071e3] dark:text-[#2997ff]">
                  {formatBytes(storageBytes)}
                </div>
                <div className="text-[12px] text-[#86868b] dark:text-[#a1a1a6] font-medium mt-0.5">Dung lượng dùng</div>
              </div>
            </div>

            <p className="text-[13px] text-[#86868b] dark:text-[#a1a1a6] leading-relaxed">
              Tất cả dữ liệu được lưu trực tiếp trong IndexedDB của trình duyệt máy tính của bạn. Dữ liệu không bị mất khi bạn bấm F5, refresh trình duyệt hoặc đóng mở lại website.
            </p>
          </div>

          {/* ── FULL BACKUP SYSTEM (.fmbackup) ── */}
          <div className="glass-material rounded-[22px] p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#e0e0e0] dark:border-white/10 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <SFShieldFill size={18} className="text-[#34c759]" />
                <h3 className="text-[15px] font-semibold text-[#1d1d1f] dark:text-white">
                  Sao Lưu &amp; Phục Hồi Toàn Diện (.fmbackup)
                </h3>
              </div>
              <div className="apple-badge-base apple-badge-success">
                <Lock size={12} className="shrink-0" />
                <span>Mã Hoá AES-GCM-256</span>
              </div>
            </div>

            <p className="text-[13px] text-[#86868b] dark:text-[#a1a1a6] leading-relaxed">
              Xuất <strong className="text-[#1d1d1f] dark:text-white font-semibold">toàn bộ dữ liệu</strong> ra file{' '}
              <code className="text-[12px] px-1.5 py-0.5 rounded-md bg-black/[0.06] dark:bg-white/10 font-mono">.fmbackup</code>{' '}
              — bao gồm Links, Tài khoản, Cửa hàng, <em>tất cả Ghi chú</em> (kể cả ảnh đính kèm), Tệp đính kèm và Cài đặt.
              Hỗ trợ mã hóa bảo mật cấp cao bằng mật khẩu cá nhân để bảo vệ 100% dữ liệu trước các sự cố rò rỉ.
            </p>

            {/* Security passphrase option */}
            <div className="p-3.5 rounded-xl bg-black/[0.03] dark:bg-white/[0.04] border border-black/5 dark:border-white/5 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[12px] font-semibold text-[#1d1d1f] dark:text-white flex items-center gap-1.5">
                  <Lock size={13} className="text-[#0071e3]" />
                  Mật khẩu bảo vệ file sao lưu (Tùy chọn mã hoá AES-GCM-256):
                </label>
                {exportPassword && (
                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                    🔒 Đã bật mã hoá
                  </span>
                )}
              </div>
              <div className="relative flex items-center">
                <input
                  type={showExportPassword ? 'text' : 'password'}
                  placeholder="Để trống nếu không mã hoá, hoặc nhập mật khẩu bảo mật..."
                  value={exportPassword}
                  onChange={(e) => setExportPassword(e.target.value)}
                  className="w-full px-3.5 py-2 pr-10 rounded-lg text-[12.5px] bg-white dark:bg-white/10 border border-black/10 dark:border-white/10 outline-none focus:border-[#0071e3] text-[#1d1d1f] dark:text-white font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowExportPassword(!showExportPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer select-none active:scale-90"
                  title={showExportPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  aria-label={showExportPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                >
                  {showExportPassword ? <SFEyeSlash size={15} /> : <SFEye size={15} />}
                </button>
              </div>
            </div>

            {/* Export Buttons */}
            <div className="flex flex-wrap items-center gap-2.5">
              <Button
                variant="glassProminent"
                size="sm"
                onClick={handleExportFMBackup}
                disabled={isExportingBackup}
                icon={isExportingBackup
                  ? <SFArrowClockwise size={16} className="animate-spin" />
                  : <SFArrowDownDocument size={16} />
                }
              >
                {isExportingBackup ? 'Đang xuất...' : exportPassword.trim() ? 'Xuất File Mã Hoá (.fmbackup)' : 'Xuất Toàn Bộ (.fmbackup)'}
              </Button>

              <Button
                variant="glass"
                size="sm"
                onClick={() => backupFileInputRef.current?.click()}
                disabled={isImportingBackup}
                icon={isImportingBackup
                  ? <SFArrowClockwise size={16} className="animate-spin" />
                  : <SFArrowUpDocument size={16} className="text-emerald-600 dark:text-emerald-400" />
                }
              >
                {isImportingBackup ? 'Đang nhập...' : 'Nhập Backup (.fmbackup)'}
              </Button>

              {/* Hidden file input */}
              <input
                ref={backupFileInputRef}
                type="file"
                accept=".fmbackup,application/json"
                className="sr-only"
                onChange={handleImportFMBackup}
              />
            </div>

            {/* Import options */}
            <div className="pt-1 space-y-2.5">
              <p className="text-[12px] font-medium text-[#555558] dark:text-[#a1a1a6]">Tùy chọn khi nhập:</p>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    { value: 'skip', label: 'Bỏ qua trùng', desc: 'Dữ liệu đã tồn tại sẽ không bị thay đổi' },
                    { value: 'overwrite', label: 'Ghi đè trùng', desc: 'Dữ liệu trùng sẽ được cập nhật từ backup' },
                    { value: 'merge', label: 'Gộp tất cả', desc: 'Thêm tất cả kể cả trùng (tạo bản mới)' },
                  ] as { value: BackupImportOptions['conflictStrategy']; label: string; desc: string }[]
                ).map(({ value, label, desc }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setImportConflictStrategy(value)}
                    title={desc}
                    className={[
                      'px-3 py-1.5 rounded-full text-[12px] font-medium border transition-all cursor-pointer',
                      importConflictStrategy === value
                        ? 'bg-[#0071e3]/15 border-[#0071e3]/40 text-[#0071e3] dark:text-[#2997ff]'
                        : 'bg-black/[0.04] dark:bg-white/[0.06] border-transparent text-[#555558] dark:text-[#a1a1a6] hover:bg-black/[0.08] dark:hover:bg-white/10',
                    ].join(' ')}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <label className="flex items-center gap-2 cursor-pointer select-none text-[12.5px] text-[#555558] dark:text-[#a1a1a6]">
                <input
                  type="checkbox"
                  checked={restoreSettingsOnImport}
                  onChange={(e) => setRestoreSettingsOnImport(e.target.checked)}
                  className="rounded accent-[#0071e3] w-4 h-4 cursor-pointer outline-none focus:outline-none focus:ring-0 shadow-none"
                />
                <span>Khôi phục cài đặt giao diện (theme) từ backup</span>
              </label>
            </div>

            {/* Progress */}
            {isImportingBackup && importProgress && (
              <div className="flex items-center gap-2 px-4 py-3 rounded-[14px] bg-[#0071e3]/8 dark:bg-[#2997ff]/10 border border-[#0071e3]/20">
                <SFArrowClockwise size={14} className="animate-spin text-[#0071e3] dark:text-[#2997ff] shrink-0" />
                <p className="text-[13px] text-[#0071e3] dark:text-[#2997ff] font-medium">{importProgress}</p>
              </div>
            )}

            {/* Result */}
            {importResult && !isImportingBackup && (
              <div className={[
                'rounded-[16px] p-4 space-y-2 border',
                importResult.success
                  ? 'bg-emerald-500/8 border-emerald-500/25'
                  : 'bg-red-500/8 border-red-500/25',
              ].join(' ')}>
                <p className={[
                  'text-[13px] font-semibold',
                  importResult.success ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600 dark:text-red-400',
                ].join(' ')}>
                  {importResult.success ? '✅ Nhập dữ liệu thành công' : '⚠️ Nhập có lỗi'}
                </p>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 text-center">
                  {[
                    { label: 'Links', count: importResult.links },
                    { label: 'Tài khoản', count: importResult.accounts },
                    { label: 'Cửa hàng', count: importResult.stores },
                    { label: 'Ghi chú', count: importResult.notes },
                    { label: 'Tệp đính kèm', count: importResult.attachments },
                  ].map(({ label, count }) => (
                    <div key={label} className="p-2 rounded-[10px] bg-white/50 dark:bg-white/5">
                      <div className="text-[18px] font-semibold text-[#1d1d1f] dark:text-white">{count}</div>
                      <div className="text-[10px] text-[#86868b] dark:text-[#a1a1a6]">{label}</div>
                    </div>
                  ))}
                </div>
                {importResult.skipped > 0 && (
                  <p className="text-[12px] text-[#86868b] dark:text-[#a1a1a6]">
                    {importResult.skipped} mục bị bỏ qua do trùng lặp (theo chiến lược "{importConflictStrategy}")
                  </p>
                )}
                {importResult.errors.length > 0 && (
                  <div className="mt-1.5 space-y-1">
                    {importResult.errors.slice(0, 3).map((err, i) => (
                      <p key={i} className="text-[11.5px] text-red-500 dark:text-red-400">• {err}</p>
                    ))}
                    {importResult.errors.length > 3 && (
                      <p className="text-[11.5px] text-[#86868b]">...và {importResult.errors.length - 3} lỗi khác</p>
                    )}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setImportResult(null)}
                  className="text-[11px] text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-white transition-colors cursor-pointer"
                >
                  Đóng thông báo ✕
                </button>
              </div>
            )}

            <div className="pt-2 border-t border-black/5 dark:border-white/8 flex items-start gap-2 text-[12px] text-[#76767b] dark:text-[#6e6e73]">
              <SFShieldFill size={12} className="text-[#34c759] shrink-0 mt-0.5" />
              <span>
                File .fmbackup được xác thực bằng SHA-256 checksum và mã hoá AES-GCM-256 chuẩn quân đội. Mọi nội dung Ghi chú được lọc bảo mật (HTML sanitization) trước khi nhập để ngăn chặn mã độc.
              </span>
            </div>
          </div>

          {/* Data Hub, Excel & Backup */}
          <div className="glass-material rounded-[22px] p-6 shadow-xs space-y-4">
            <h3 className="text-[15px] font-semibold text-[#1d1d1f] dark:text-white flex items-center gap-2">
              <SFArrowDownDocument size={16} className="text-[#0071e3]" />
              Trung Tâm Dữ Liệu &amp; Sao Lưu Excel
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
                icon={<SFTablecells size={16} className="text-[#0071e3] dark:text-[#2997ff]" />}
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
                  className="rounded accent-[#0071e3] w-4 h-4 cursor-pointer outline-none focus:outline-none focus:ring-0 shadow-none"
                />
                <span>Bảo vệ quyền riêng tư: Ẩn mật khẩu (dạng ••••••••) khi xuất Excel</span>
              </label>
            </div>

            <div className="pt-3 border-t border-black/5 dark:border-white/10 flex items-center gap-2 flex-wrap text-xs text-[#76767b]">
              <span>Xuất nhanh từng sheet:</span>
              <button
                type="button"
                onClick={() => excelService.exportDataset('LINK')}
                className="px-2.5 py-1 rounded-full bg-black/[0.04] dark:bg-white/[0.06] hover:bg-[#0071e3]/10 text-[#1d1d1f] dark:text-white font-medium transition-colors cursor-pointer"
              >
                Sheet LINK ({counts.links})
              </button>
              <button
                type="button"
                onClick={() => excelService.exportDataset('ACCOUNT', { maskPasswords: maskPasswordInExport })}
                className="px-2.5 py-1 rounded-full bg-black/[0.04] dark:bg-white/[0.06] hover:bg-emerald-500/10 text-[#1d1d1f] dark:text-white font-medium transition-colors cursor-pointer"
              >
                Sheet ACCOUNT ({counts.accounts})
              </button>
              <button
                type="button"
                onClick={() => excelService.exportDataset('STORE')}
                className="px-2.5 py-1 rounded-full bg-black/[0.04] dark:bg-white/[0.06] hover:bg-amber-500/10 text-[#1d1d1f] dark:text-white font-medium transition-colors cursor-pointer"
              >
                Sheet DS CH ({counts.stores})
              </button>
            </div>
          </div>

          {/* Workspace Maintenance */}
          <div className="glass-material rounded-[22px] border border-black/10 dark:border-white/10 p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2 text-[#1d1d1f] dark:text-white font-semibold text-[15px]">
              <SFInternaldrive size={18} className="text-[#0071e3] dark:text-[#2997ff]" />
              Bảo Trì &amp; Quản Trị Workspace Cục Bộ
            </div>
            <p className="text-[13px] text-[#86868b] dark:text-[#a1a1a6] leading-relaxed">
              Bạn có thể chủ động khôi phục dữ liệu mẫu ban đầu của Farmers Market hoặc dọn sạch hoàn toàn để bắt đầu nhập dữ liệu mới. Hãy tải file sao lưu trước khi thực hiện các thao tác này.
            </p>
            <div className="flex items-center gap-3 flex-wrap pt-1">
              <Button
                variant="glass"
                size="sm"
                onClick={() => setConfirmSeedRestoreOpen(true)}
                className="rounded-full px-4 py-2 active:scale-95 font-medium text-[13px]"
                icon={<SFArrowClockwise size={15} className="text-[#0071e3] dark:text-[#2997ff]" />}
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
        </div>
      )}

      {/* ── TAB 2: LÁ CHẮN AN TOÀN ── */}
      {activeTab === 'shield' && (
        <div className="space-y-6">
          {/* Dual-Persistence Shield */}
          <div className="glass-material rounded-[22px] p-6 shadow-xs space-y-4 border border-emerald-500/20 bg-emerald-500/[0.02]">
            <div className="flex items-center justify-between pb-3 border-b border-[#e0e0e0] dark:border-white/10 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Server size={18} className="text-emerald-600 dark:text-emerald-400" />
                <h3 className="text-[15px] font-semibold text-[#1d1d1f] dark:text-white">
                  Đồng Bộ Kép Máy Chủ &amp; Phục Hồi Thảm Họa (Dual-Persistence Shield)
                </h3>
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-semibold bg-[#34c759]/12 text-[#1a8238] dark:text-[#30d158] border border-[#34c759]/25 shadow-[0_2px_8px_rgba(52,199,89,0.12),inset_0_1px_0_rgba(255,255,255,0.7)] dark:shadow-[0_2px_10px_rgba(48,209,88,0.18),inset_0_1px_0_rgba(255,255,255,0.15)] backdrop-blur-xl">
                <ShieldCheck size={14} className="shrink-0" />
                <span>Bảo vệ chống crash Win/Mac</span>
              </div>
            </div>

            <p className="text-[13px] text-[#86868b] dark:text-[#a1a1a6] leading-relaxed">
              Ứng dụng tự động sao lưu dữ liệu ngầm (Auto-Sync) lên máy chủ cục bộ SQLite và tập tin an toàn. Nếu máy tính của bạn bị mất điện, crash Windows/macOS hoặc bị reset trình duyệt, bạn có thể <strong className="text-[#1d1d1f] dark:text-white font-semibold">khôi phục toàn bộ dữ liệu chỉ bằng 1 cú nhấp chuột</strong>.
            </p>

            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <Button
                variant="glassProminent"
                size="sm"
                onClick={() => handleRestoreLatestServerBackup()}
                disabled={isRestoringServer || serverHistory.length === 0}
                icon={isRestoringServer ? <SFArrowClockwise size={16} className="animate-spin" /> : <Database size={16} />}
                className="rounded-full px-4"
              >
                {isRestoringServer ? 'Đang khôi phục...' : '⚡ Khôi Phục Từ Bản Sao Lưu Máy Chủ Gần Nhất'}
              </Button>

              <Button
                variant="glass"
                size="sm"
                onClick={handleManualServerSync}
                disabled={isSyncingServer}
                icon={isSyncingServer ? <SFArrowClockwise size={16} className="animate-spin" /> : <Server size={16} className="text-emerald-600 dark:text-emerald-400" />}
                className="rounded-full px-4"
              >
                {isSyncingServer ? 'Đang sao lưu...' : 'Sao Lưu Ngay Lên Máy Chủ'}
              </Button>
            </div>

            {/* Server Snapshots History */}
            {serverHistory.length > 0 && (
              <div className="pt-2 space-y-2">
                <p className="text-[12px] font-medium text-[#555558] dark:text-[#a1a1a6]">Lịch sử sao lưu tự động trên máy chủ:</p>
                <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                  {serverHistory.slice(0, 5).map((snap) => (
                    <div
                      key={snap.id}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-black/[0.03] dark:bg-white/[0.04] border border-black/5 dark:border-white/5 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                        <div>
                          <span className="font-semibold text-[#1d1d1f] dark:text-white">
                            {new Date(snap.created_at).toLocaleString('vi-VN')}
                          </span>
                          <span className="text-[#86868b] dark:text-[#a1a1a6] ml-2">
                            ({snap.backup_type === 'auto' ? 'Tự động' : snap.backup_type === 'snapshot' ? 'Theo giờ' : 'Thủ công'}) • {snap.item_counts?.notes || 0} Ghi chú, {snap.item_counts?.links || 0} Links
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRestoreLatestServerBackup(snap.id)}
                        disabled={isRestoringServer}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-[#0071e3]/10 text-[#0071e3] dark:text-[#2997ff] hover:bg-[#0071e3]/20 transition-all cursor-pointer"
                      >
                        Khôi phục bản này
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Persistent Storage Permission */}
          <div className="glass-material rounded-[22px] p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#e0e0e0] dark:border-white/10 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <SFShieldFill size={18} className="text-[#34c759]" />
                <h3 className="text-[15px] font-semibold text-[#1d1d1f] dark:text-white">
                  Quyền Khóa Lưu Trữ Bền Vững (Persistent Storage API)
                </h3>
              </div>
              <div className={`apple-badge-base ${
                storageStatus.isPersisted
                  ? 'apple-badge-success'
                  : 'apple-badge-warning'
              }`}>
                {storageStatus.isPersisted ? <SFCheckmarkCircleFill size={12} /> : <Clock size={12} />}
                <span>{storageStatus.isPersisted ? 'Đã kích hoạt bảo vệ' : 'Chưa bật bảo vệ'}</span>
              </div>
            </div>

            <p className="text-[13px] text-[#86868b] dark:text-[#a1a1a6] leading-relaxed">
              Khi được kích hoạt, trình duyệt web (Chrome, Edge, Safari) cam kết không bao giờ tự ý dọn dẹp hoặc xóa dữ liệu của bạn ngay cả khi dung lượng ổ đĩa của máy tính bắt đầu đầy.
            </p>

            <div className="pt-2 flex items-center justify-between flex-wrap gap-3">
              <div className="text-[13px] text-[#555558] dark:text-[#a1a1a6]">
                Trạng thái hiện tại:{' '}
                <strong className={storageStatus.isPersisted ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-amber-600 dark:text-amber-400 font-semibold'}>
                  {storageStatus.isPersisted ? 'Bảo vệ kiên cố vĩnh viễn' : 'Chế độ lưu trữ thông thường'}
                </strong>
              </div>
              {!storageStatus.isPersisted && (
                <Button
                  variant="glassProminent"
                  size="sm"
                  onClick={handleRequestPersistentStorage}
                  disabled={isRequestingPersistence}
                  icon={
                    isRequestingPersistence ? (
                      <SFArrowClockwise size={15} className="animate-spin text-white" />
                    ) : (
                      <SFShieldFill size={15} className="text-white" />
                    )
                  }
                  className="rounded-full px-5 py-2 active:scale-95 transition-all shadow-[0_4px_16px_rgba(0,113,227,0.3)] font-semibold text-[13px]"
                >
                  {isRequestingPersistence ? 'Đang kích hoạt...' : 'Bật Khóa Bảo Vệ Vĩnh Viễn'}
                </Button>
              )}
            </div>
          </div>

          {/* ── LOCAL PRIVACY LOCK & PIN SECURITY (PILLAR 1: DATA PRIVACY) ── */}
          <div className="glass-material rounded-[22px] p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#e0e0e0] dark:border-white/10 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Lock size={18} className="text-[#0071e3] dark:text-[#2997ff]" />
                <h3 className="text-[15px] font-semibold text-[#1d1d1f] dark:text-white">
                  Khóa Màn Hình Cục Bộ (Local Privacy Lock / Screen Shield)
                </h3>
              </div>
              <div className={`apple-badge-base ${
                isLockEnabled
                  ? 'apple-badge-success'
                  : 'apple-badge-neutral'
              }`}>
                {isLockEnabled ? <SFCheckmarkCircleFill size={12} /> : <Lock size={12} />}
                <span>{isLockEnabled ? 'Đã bật mã PIN bảo vệ' : 'Chưa cài đặt mã PIN'}</span>
              </div>
            </div>

            <p className="text-[13px] text-[#86868b] dark:text-[#a1a1a6] leading-relaxed">
              Thiết lập mã PIN 4-8 số để khóa màn hình workspace khi bạn rời khỏi máy tính. Khi bật, bạn có thể bấm icon <strong>Khóa Nhanh</strong> trên thanh tiêu đề hoặc để ứng dụng tự động khóa sau một khoảng thời gian không thao tác. Mã PIN được mã hóa <strong>SHA-256 an toàn</strong> trực tiếp trên trình duyệt.
            </p>

            <div className="pt-2 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <span className="text-[12.5px] text-[#555558] dark:text-[#a1a1a6]">Tự động khóa sau:</span>
                <select
                  value={autoLockMinutes}
                  onChange={(e) => setAutoLockMinutes(Number(e.target.value))}
                  disabled={!isLockEnabled}
                  className="px-3 py-1.5 rounded-xl text-[12.5px] bg-black/[0.04] dark:bg-white/10 border border-black/10 dark:border-white/10 text-[#1d1d1f] dark:text-white outline-none focus:border-[#0071e3] disabled:opacity-50 cursor-pointer"
                >
                  <option value={0}>Không tự khóa</option>
                  <option value={5}>5 phút không hoạt động</option>
                  <option value={15}>15 phút không hoạt động</option>
                  <option value={30}>30 phút không hoạt động</option>
                </select>
              </div>

              <div className="flex items-center gap-2.5">
                {isLockEnabled ? (
                  <>
                    <Button
                      variant="glass"
                      size="sm"
                      onClick={() => {
                        setPinInput('');
                        setPinConfirmInput('');
                        setShowPinSetupModal(true);
                      }}
                      icon={<KeyRound size={14} className="text-[#0071e3] dark:text-[#2997ff]" />}
                      className="rounded-full px-4 text-xs font-medium"
                    >
                      Đổi Mã PIN
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => {
                        setPinRemoveInput('');
                        setPinRemoveMismatch(false);
                        setShowPinRemoveModal(true);
                      }}
                      icon={<Unlock size={14} />}
                      className="rounded-full px-4 text-xs font-medium shadow-xs"
                    >
                      Gỡ Bỏ Mã PIN
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="glassProminent"
                    size="sm"
                    onClick={() => {
                      setPinInput('');
                      setPinConfirmInput('');
                      setShowPinSetupModal(true);
                    }}
                    icon={<KeyRound size={15} />}
                    className="rounded-full px-5 text-xs font-medium"
                  >
                    Cài Đặt Mã PIN Bảo Vệ
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 3: GỬI MAIL TỰ ĐỘNG (GMAIL SMTP) ── */}
      {activeTab === 'smtp' && (
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
                    onClick={handleDisconnectSmtp}
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
        </div>
      )}

      {/* ── TAB 4: GIAO DIỆN (THEME & APPEARANCE) ── */}
      {activeTab === 'appearance' && (
        <div className="space-y-6">
          <div className="glass-material rounded-[22px] p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h3 className="text-[15px] font-semibold text-[#1d1d1f] dark:text-white flex items-center gap-2">
                  <SFPaintpalette size={16} className="text-[#0071e3] dark:text-[#2997ff]" />
                  Giao Diện Hệ Thống
                </h3>
                <p className="text-[13px] text-[#86868b] dark:text-[#a1a1a6] mt-0.5">
                  Tùy chỉnh chế độ hiển thị sáng tối hoặc đồng bộ tự động theo thời gian thực.
                </p>
              </div>
              <div className="apple-badge-base apple-badge-info">
                <span className="w-1.5 h-1.5 rounded-full bg-[#0071e3] dark:bg-[#2997ff] animate-pulse" />
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

            {/* Liquid Glass Segmented Bar with Physical Liquid Spring Pill */}
            <ThemeSegmentedControl />

            <p className="text-[12px] text-[#86868b] dark:text-[#a1a1a6] flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#0071e3] dark:bg-[#2997ff]" />
              Tùy chọn giao diện được lưu tự động và nhớ qua các lần tải lại trang.
            </p>
          </div>
        </div>
      )}
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

      {/* Password Decryption Prompt Modal */}
      <AppleLiquidDialog
        isOpen={showPasswordPromptModal}
        onClose={() => {
          setShowPasswordPromptModal(false);
          setPendingEncryptedFile(null);
          setImportPassword('');
        }}
        zIndex={10020}
        title="Mở Khóa Tệp Sao Lưu"
        contentClassName="w-full max-w-md p-6 rounded-[24px] bg-white/95 dark:bg-[#1e1e20]/95 backdrop-blur-2xl border border-black/10 dark:border-white/10 shadow-2xl space-y-4"
      >
        <div className="flex items-center gap-2.5 text-[#1d1d1f] dark:text-white">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-b from-[#0071e3]/15 to-[#0071e3]/5 text-[#0071e3] dark:text-[#2997ff] flex items-center justify-center border border-[#0071e3]/20 shadow-xs">
            <Lock size={18} />
          </div>
          <div>
            <h3 className="font-semibold text-[15px]">Mở Khóa Tệp Sao Lưu</h3>
            <p className="text-xs text-[#86868b] dark:text-[#a1a1a6]">Tệp này được mã hoá bằng AES-GCM 256-bit</p>
          </div>
        </div>

        <p className="text-[13px] text-[#555558] dark:text-[#a1a1a6] leading-relaxed">
          Vui lòng nhập mật khẩu bạn đã thiết lập khi xuất tệp sao lưu để tiến hành giải mã và nạp dữ liệu:
        </p>

        <div>
          <input
            type="password"
            placeholder="Nhập mật khẩu giải mã..."
            value={importPassword}
            onChange={(e) => setImportPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && importPassword.trim() && pendingEncryptedFile) {
                executeImportFile(pendingEncryptedFile, importPassword.trim());
              }
            }}
            autoFocus
            className="w-full px-3.5 py-2.5 rounded-xl text-[13px] bg-black/[0.04] dark:bg-white/10 border border-black/15 dark:border-white/15 outline-none focus:border-[#0071e3] text-[#1d1d1f] dark:text-white font-mono"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setShowPasswordPromptModal(false);
              setPendingEncryptedFile(null);
              setImportPassword('');
            }}
            className="rounded-full px-4 text-xs"
          >
            Hủy bỏ
          </Button>

          <Button
            variant="glassProminent"
            size="sm"
            disabled={!importPassword.trim()}
            onClick={() => {
              if (pendingEncryptedFile) {
                executeImportFile(pendingEncryptedFile, importPassword.trim());
              }
            }}
            className="rounded-full px-5 text-xs font-medium"
          >
            Giải Mã &amp; Khôi Phục
          </Button>
        </div>
      </AppleLiquidDialog>

      {/* Persistence Guidance Modal (When browser denies auto-persist) */}
      <AppleLiquidDialog
        isOpen={showPersistenceGuideModal}
        onClose={() => setShowPersistenceGuideModal(false)}
        zIndex={10020}
        title="Kích Hoạt Khóa Lưu Trữ Vĩnh Viễn"
        contentClassName="w-full max-w-lg p-6 rounded-[26px] bg-white/95 dark:bg-[#1e1e20]/95 backdrop-blur-2xl border border-black/10 dark:border-white/10 shadow-2xl space-y-4"
      >
        <div className="flex items-center gap-3 text-[#1d1d1f] dark:text-white">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-b from-[#0071e3]/15 to-[#0071e3]/5 text-[#0071e3] dark:text-[#2997ff] flex items-center justify-center border border-[#0071e3]/20 shadow-xs">
            <Bookmark size={20} />
          </div>
          <div>
            <h3 className="font-semibold text-[16px]">Kích Hoạt Khóa Lưu Trữ Vĩnh Viễn</h3>
            <p className="text-xs text-[#86868b] dark:text-[#a1a1a6]">Chính sách bảo mật trình duyệt Chrome / Edge / Safari</p>
          </div>
        </div>

        <p className="text-[13px] text-[#555558] dark:text-[#a1a1a6] leading-relaxed">
          Trình duyệt yêu cầu website phải đạt một mức tin cậy tối thiểu trước khi tự động cấp quyền <strong>Lưu Trữ Kiên Cố (Persistent Storage)</strong> để tránh các trang web lạ lạm dụng ổ cứng:
        </p>

        <div className="p-4 rounded-2xl bg-black/[0.03] dark:bg-white/[0.04] border border-black/5 dark:border-white/5 space-y-3">
          <div className="flex items-start gap-2.5">
            <span className="w-5 h-5 rounded-full bg-[#0071e3] text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">1</span>
            <p className="text-[12.5px] text-[#1d1d1f] dark:text-white leading-normal">
              <strong>Đánh dấu trang (Bookmark):</strong> Nhấn phím <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-black/30 border border-black/10 font-mono text-[11px] font-bold">Ctrl + D</kbd> (hoặc <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-black/30 border border-black/10 font-mono text-[11px] font-bold">⌘ + D</kbd> trên Mac) để lưu địa chỉ web này vào thanh dấu trang. Đây là cách nhanh nhất để Chrome &amp; Edge duyệt quyền lưu vĩnh viễn 100%.
            </p>
          </div>

          <div className="flex items-start gap-2.5">
            <span className="w-5 h-5 rounded-full bg-[#0071e3] text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">2</span>
            <p className="text-[12.5px] text-[#1d1d1f] dark:text-white leading-normal">
              <strong>Không dùng chế độ Ẩn danh:</strong> Trình duyệt sẽ luôn cấm lưu trữ vĩnh viễn trong cửa sổ Incognito / Private Browsing.
            </p>
          </div>

          <div className="flex items-start gap-2.5">
            <span className="w-5 h-5 rounded-full bg-[#34c759] text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">✓</span>
            <p className="text-[12.5px] text-emerald-600 dark:text-emerald-400 leading-normal">
              <strong>Lá chắn kép tự động:</strong> Dù chưa bật quyền này, app vẫn tự động sao lưu dữ liệu lên máy chủ SQLite cục bộ nên bạn hoàn toàn an tâm dữ liệu không bị thất lạc!
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button
            variant="glass"
            size="sm"
            onClick={() => setShowPersistenceGuideModal(false)}
            className="rounded-full px-4 text-xs"
          >
            Tôi Đã Hiểu
          </Button>
          <Button
            variant="glassProminent"
            size="sm"
            onClick={async () => {
              setShowPersistenceGuideModal(false);
              await handleRequestPersistentStorage();
            }}
            className="rounded-full px-5 text-xs font-medium"
          >
            Kiểm Tra &amp; Thử Lại
          </Button>
        </div>
      </AppleLiquidDialog>

      {/* ── Apple Notes 100% Identical PIN / Passcode Modal (Hình 2) ── */}
      <AppleLiquidDialog
        isOpen={showPinSetupModal}
        onClose={() => {
          setShowPinSetupModal(false);
          setPinInput('');
          setPinConfirmInput('');
          setPinMismatch(false);
        }}
        zIndex={10020}
        title="Cài đặt mã PIN bảo vệ"
        overlayClassName="p-4"
        contentClassName={`w-full max-w-[340px] bg-white/95 dark:bg-[#1c1c24]/95 backdrop-blur-2xl rounded-[26px] border border-white/60 dark:border-white/12 shadow-[0_24px_60px_rgba(0,0,0,0.16),0_2px_8px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.8)] dark:shadow-[0_24px_60px_rgba(0,0,0,0.7),0_2px_8px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.1)] p-6 text-center space-y-5 relative cursor-default ${
          pinMismatch ? 'apple-shake' : ''
        }`}
      >
        <div
          onClick={(e) => {
            e.stopPropagation();
            const input = document.getElementById('settings-apple-pin-input') as HTMLInputElement | null;
            input?.focus();
          }}
          className="space-y-4"
        >
          {/* Header Icon */}
          <div className="space-y-1.5 pointer-events-none">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-b from-[#0071e3]/15 to-[#0071e3]/5 text-[#0071e3] dark:text-[#2997ff] flex items-center justify-center border border-[#0071e3]/20 shadow-xs mx-auto mb-2">
              <KeyRound size={22} />
            </div>
            <h3 className="font-semibold text-[16px] text-[#1d1d1f] dark:text-white leading-tight">
              {isLockEnabled ? 'Đổi mã PIN bảo vệ' : 'Cài mã PIN bảo vệ'}
            </h3>
            <p className="text-[12px] text-[#86868b] dark:text-[#a1a1a6] min-h-[18px]">
              {pinInput.length < 6
                ? 'Nhập mã PIN 6 số mới'
                : pinMismatch
                ? 'Mã xác nhận không khớp! Vui lòng nhập lại'
                : 'Nhập lại mã PIN để xác nhận'}
            </p>
          </div>

          {/* 6 Visual Apple Passcode Dots with Fluid Scale & Fill */}
          <div className="flex items-center justify-center gap-3.5 my-3 cursor-pointer relative py-2">
            {Array.from({ length: 6 }).map((_, i) => {
              const isConfirming = pinInput.length === 6;
              const currentVal = isConfirming ? pinConfirmInput : pinInput;
              const isFilled = i < currentVal.length;
              return (
                <div
                  key={i}
                  className={`w-4 h-4 rounded-full transition-all duration-150 ${
                    pinMismatch
                      ? 'bg-rose-500 shadow-xs scale-110'
                      : isFilled
                      ? 'bg-[#0071e3] shadow-xs scale-110'
                      : 'border-2 border-black/20 dark:border-white/25 bg-transparent'
                  }`}
                />
              );
            })}

            {/* Hidden Active Input for True Numeric Keypad / Keyboard capture */}
            <input
              id="settings-apple-pin-input"
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              autoFocus
              value={pinInput.length < 6 ? pinInput : pinConfirmInput}
              onKeyDown={async (e) => {
                if (['Backspace', 'Tab', 'Escape'].includes(e.key)) {
                  if (e.key === 'Escape') {
                    setShowPinSetupModal(false);
                    setPinInput('');
                    setPinConfirmInput('');
                    setPinMismatch(false);
                  }
                  if (e.key === 'Backspace') {
                    e.preventDefault();
                    if (pinConfirmInput.length > 0) {
                      setPinConfirmInput((prev) => prev.slice(0, -1));
                      setPinMismatch(false);
                    } else if (pinInput.length > 0) {
                      setPinInput((prev) => prev.slice(0, -1));
                      setPinMismatch(false);
                    }
                  }
                  return;
                }
                if (!/^[0-9]$/.test(e.key)) {
                  e.preventDefault();
                  return;
                }
                // Allow numeric digit
                e.preventDefault();
                const digit = e.key;
                if (pinInput.length < 6) {
                  setPinInput((prev) => prev + digit);
                } else if (pinConfirmInput.length < 6) {
                  const nextConfirm = pinConfirmInput + digit;
                  setPinConfirmInput(nextConfirm);
                  if (nextConfirm.length === 6) {
                    if (nextConfirm === pinInput) {
                      // Matched!
                      await setPin(pinInput);
                      setShowPinSetupModal(false);
                      setPinInput('');
                      setPinConfirmInput('');
                      setPinMismatch(false);
                      toast.success('🛡️ Đã cài đặt mã PIN bảo vệ thành công! Bạn có thể bấm icon Khóa trên thanh tiêu đề.');
                    } else {
                      // Mismatch
                      setPinMismatch(true);
                      toast.error('Mã xác nhận không khớp! Đang làm mới...', { id: 'pin-mismatch' });
                      setTimeout(() => {
                        setPinConfirmInput('');
                        setPinMismatch(false);
                        const input = document.getElementById('settings-apple-pin-input') as HTMLInputElement | null;
                        input?.focus();
                      }, 500);
                    }
                  }
                }
              }}
              onChange={() => {}}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            />
          </div>

          {/* Sub-step indicator pill */}
          <div className="flex items-center justify-center">
            <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-black/[0.04] dark:bg-white/[0.06] text-[#86868b] dark:text-[#a1a1a6]">
              {pinInput.length < 6 ? 'Bước 1/2: Đặt PIN mới' : 'Bước 2/2: Xác nhận lại PIN'}
            </span>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end w-full pt-2 border-t border-black/[0.06] dark:border-white/10">
            <button
              type="button"
              onClick={() => {
                setShowPinSetupModal(false);
                setPinInput('');
                setPinConfirmInput('');
                setPinMismatch(false);
              }}
              className="px-3.5 py-1.5 rounded-full text-[12px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] bg-black/[0.04] dark:bg-white/[0.08] hover:bg-black/[0.08] dark:hover:bg-white/[0.14] border border-black/5 dark:border-white/10 transition-colors cursor-pointer active:scale-95"
            >
              Hủy
            </button>
          </div>
        </div>
      </AppleLiquidDialog>

      {/* ─────────────────── Apple Liquid Glass Remove PIN Modal ─────────────────── */}
      <AppleLiquidDialog
        isOpen={showPinRemoveModal}
        onClose={() => {
          setShowPinRemoveModal(false);
          setPinRemoveInput('');
          setPinRemoveMismatch(false);
        }}
        zIndex={10025}
        title="Gỡ bỏ mã PIN bảo vệ"
        overlayClassName="p-4"
        contentClassName={`w-full max-w-[340px] bg-white/95 dark:bg-[#1c1c24]/95 backdrop-blur-2xl rounded-[26px] border border-white/60 dark:border-white/12 shadow-[0_24px_60px_rgba(0,0,0,0.16),0_2px_8px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.8)] dark:shadow-[0_24px_60px_rgba(0,0,0,0.7),0_2px_8px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.1)] p-6 text-center space-y-5 relative cursor-default ${
          pinRemoveMismatch ? 'apple-shake' : ''
        }`}
      >
        <div
          onClick={(e) => {
            e.stopPropagation();
            const input = document.getElementById('settings-apple-pin-remove-input') as HTMLInputElement | null;
            input?.focus();
          }}
          className="space-y-4"
        >
          {/* Header Icon */}
          <div className="space-y-1.5 pointer-events-none">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-b from-rose-500/15 to-rose-500/5 text-rose-600 dark:text-rose-400 flex items-center justify-center border border-rose-500/20 shadow-xs mx-auto mb-2">
              <Unlock size={22} />
            </div>
            <h3 className="font-semibold text-[16px] text-[#1d1d1f] dark:text-white leading-tight">
              Xác nhận gỡ mã PIN
            </h3>
            <p className="text-[12px] text-[#86868b] dark:text-[#a1a1a6] min-h-[18px]">
              {pinRemoveMismatch
                ? 'Mã PIN không đúng! Vui lòng thử lại'
                : 'Nhập mã PIN 6 số hiện tại để tắt bảo vệ'}
            </p>
          </div>

          {/* 6 Visual Apple Passcode Dots with Fluid Scale & Fill */}
          <div className="flex items-center justify-center gap-3.5 my-3 cursor-pointer relative py-2">
            {Array.from({ length: 6 }).map((_, i) => {
              const isFilled = i < pinRemoveInput.length;
              return (
                <div
                  key={i}
                  className={`w-4 h-4 rounded-full transition-all duration-150 ${
                    pinRemoveMismatch
                      ? 'bg-rose-500 shadow-xs scale-110'
                      : isFilled
                      ? 'bg-[#0071e3] shadow-xs scale-110'
                      : 'border-2 border-black/20 dark:border-white/25 bg-transparent'
                  }`}
                />
              );
            })}

            {/* Hidden Active Input for True Numeric Keypad / Keyboard capture */}
            <input
              id="settings-apple-pin-remove-input"
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              autoFocus
              value={pinRemoveInput}
              onKeyDown={async (e) => {
                if (['Backspace', 'Tab', 'Escape'].includes(e.key)) {
                  if (e.key === 'Escape') {
                    setShowPinRemoveModal(false);
                    setPinRemoveInput('');
                    setPinRemoveMismatch(false);
                  }
                  if (e.key === 'Backspace') {
                    e.preventDefault();
                    setPinRemoveInput((prev) => prev.slice(0, -1));
                    setPinRemoveMismatch(false);
                  }
                  return;
                }
                if (!/^[0-9]$/.test(e.key)) {
                  e.preventDefault();
                  return;
                }
                // Allow numeric digit
                e.preventDefault();
                const digit = e.key;
                if (pinRemoveInput.length < 6) {
                  const nextVal = pinRemoveInput + digit;
                  setPinRemoveInput(nextVal);
                  if (nextVal.length === 6) {
                    const ok = await disableLock(nextVal);
                    if (ok) {
                      toast.success('🛡️ Đã gỡ bỏ khóa bảo vệ mã PIN thành công!');
                      setShowPinRemoveModal(false);
                      setPinRemoveInput('');
                      setPinRemoveMismatch(false);
                    } else {
                      setPinRemoveMismatch(true);
                      toast.error('Mã PIN không chính xác! Đang làm mới...', { id: 'pin-remove-fail' });
                      setTimeout(() => {
                        setPinRemoveInput('');
                        setPinRemoveMismatch(false);
                        const input = document.getElementById('settings-apple-pin-remove-input') as HTMLInputElement | null;
                        input?.focus();
                      }, 600);
                    }
                  }
                }
              }}
              onChange={() => {}}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end pt-2 border-t border-black/[0.06] dark:border-white/10">
            <button
              type="button"
              onClick={() => {
                setShowPinRemoveModal(false);
                setPinRemoveInput('');
                setPinRemoveMismatch(false);
              }}
              className="px-3.5 py-1.5 rounded-full text-[12px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] bg-black/[0.04] dark:bg-white/[0.08] hover:bg-black/[0.08] dark:hover:bg-white/[0.14] border border-black/5 dark:border-white/10 transition-colors cursor-pointer active:scale-95"
            >
              Hủy
            </button>
          </div>
        </div>
      </AppleLiquidDialog>
    </div>
  );
};

