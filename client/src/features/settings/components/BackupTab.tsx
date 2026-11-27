import React, { useState, useRef, useCallback } from 'react';
import {
  SFInternaldrive,
  SFTrash,
  SFArrowDownDocument,
  SFCheckmarkCircleFill,
  SFArrowClockwise,
  SFTablecells,
  SFShieldFill,
  SFArrowUpDocument,
  SFEye,
  SFEyeSlash,
  SFLock,
} from '@/components/ui/AppleIcon';
import { Button } from '@/components/ui/button';
import { dataService } from '@/services/dataService';
import { excelService } from '@/services/excelService';
import { backupService } from '@/services/backupService';
import { ConfirmDeleteDialog } from '@/components/ui/ConfirmDeleteDialog';
import { AppleLiquidDialog } from '@/components/ui/AppleLiquidDialog';
import { AppleCheckbox } from '@/components/ui/AppleCheckbox';
import { useNoteStore } from '@/stores/note-store';
import { formatBytes } from '@/lib/utils';
import toast from 'react-hot-toast';
import type { BackupImportOptions, BackupImportResult } from '@/types/workspace';

export interface WorkspaceCounts {
  links: number;
  accounts: number;
  stores: number;
  notes: number;
  todos: number;
  activities: number;
}

interface BackupTabProps {
  counts: WorkspaceCounts;
  storageBytes: number;
  onRefreshStats: () => Promise<void>;
  onRefreshSyncStatus: () => Promise<void>;
}

export const BackupTab: React.FC<BackupTabProps> = React.memo(
  ({ counts, storageBytes, onRefreshStats, onRefreshSyncStatus }) => {
    const [isRepairing, setIsRepairing] = useState(false);
    const [confirmResetOpen, setConfirmResetOpen] = useState(false);
    const [confirmSeedRestoreOpen, setConfirmSeedRestoreOpen] = useState(false);
    const [maskPasswordInExport, setMaskPasswordInExport] = useState(false);

    const [isExportingBackup, setIsExportingBackup] = useState(false);
    const [isImportingBackup, setIsImportingBackup] = useState(false);
    const [importProgress, setImportProgress] = useState('');
    const [importResult, setImportResult] = useState<BackupImportResult | null>(null);
    const [importConflictStrategy, setImportConflictStrategy] =
      useState<BackupImportOptions['conflictStrategy']>('skip');
    const [restoreSettingsOnImport, setRestoreSettingsOnImport] = useState(false);
    const backupFileInputRef = useRef<HTMLInputElement>(null);

    const [exportPassword, setExportPassword] = useState('');
    const [showExportPassword, setShowExportPassword] = useState(false);
    const [importPassword, setImportPassword] = useState('');
    const [pendingEncryptedFile, setPendingEncryptedFile] = useState<File | null>(null);
    const [showPasswordPromptModal, setShowPasswordPromptModal] = useState(false);

    const handleRepairIDB = async () => {
      setIsRepairing(true);
      try {
        await dataService.resetInitialized();
        await onRefreshStats();
        toast.success('IndexedDB đã được kiểm tra & kết nối lại thành công!');
      } catch {
        toast.error('Không thể tự sửa IndexedDB. Thử F5 hoặc mở tab mới.');
      } finally {
        setIsRepairing(false);
      }
    };

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

    const handleResetWorkspace = async () => {
      try {
        await dataService.clearAllData();
        toast.success('Đã xóa trắng toàn bộ dữ liệu. Workspace hiện hoàn toàn sạch để bạn nhập mới!');
        await onRefreshStats();
      } catch {
        toast.error('Lỗi khi reset workspace');
      }
    };

    const handleRestoreSeedData = async () => {
      try {
        await dataService.restoreSeedData();
        toast.success('🎉 Đã khôi phục toàn bộ dữ liệu mẫu mặc định của Farmers Market!');
        await onRefreshStats();
      } catch {
        toast.error('Lỗi khi khôi phục dữ liệu mẫu');
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
          toast.success(
            '🔒 Đã xuất file .fmbackup MÃ HOÁ (AES-GCM-256) thành công! Hãy nhớ mật khẩu để giải mã.',
            { duration: 6000 }
          );
        } else {
          toast.success('✅ Đã xuất file .fmbackup thành công! File chứa toàn bộ dữ liệu của bạn.', {
            duration: 5000,
          });
        }
      } catch (err) {
        console.error(err);
        toast.error('Lỗi khi xuất file backup. Vui lòng thử lại.');
      } finally {
        setIsExportingBackup(false);
      }
    };

    const executeImportFile = useCallback(
      async (file: File, password?: string) => {
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
            const total =
              result.links +
              result.accounts +
              result.stores +
              result.notes +
              (result.todos || 0) +
              result.attachments;
            toast.success(
              `✅ Nhập thành công ${total} mục! (${result.links} Links, ${result.accounts} TK, ${result.stores} CH, ${result.notes} Ghi chú, ${result.todos || 0} To-do, ${result.attachments} Tệp)`,
              { duration: 7000 }
            );
            await onRefreshStats();
            await onRefreshSyncStatus();
            await useNoteStore.getState().loadNotes().catch((err) => {
              console.warn('[BackupTab] Failed to reload notes after import:', err);
            });
            setShowPasswordPromptModal(false);
            setPendingEncryptedFile(null);
            setImportPassword('');
          } else {
            if (result.errors.some((e) => e.includes('mã hóa') || e.includes('mật khẩu'))) {
              setPendingEncryptedFile(file);
              setShowPasswordPromptModal(true);
            }
            toast.error(`Nhập thất bại: ${result.errors[0] ?? 'Lỗi không xác định'}`, {
              duration: 7000,
            });
          }
        } catch (err: any) {
          console.error(err);
          toast.error(err?.message || 'Lỗi nghiêm trọng khi nhập dữ liệu.');
        } finally {
          setIsImportingBackup(false);
          setImportProgress('');
        }
      },
      [importConflictStrategy, restoreSettingsOnImport, onRefreshStats, onRefreshSyncStatus]
    );

    const handleImportFMBackup = useCallback(
      async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = '';

        if (!file.name.endsWith('.fmbackup')) {
          toast.error('Vui lòng chọn file có đuôi .fmbackup hợp lệ.');
          return;
        }

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
      },
      [executeImportFile]
    );

    return (
      <div className="space-y-6">
        <div className="glass-material rounded-[22px] p-6 shadow-xs space-y-5">
          <div className="flex items-center justify-between pb-3.5 border-b border-[#e0e0e0] dark:border-white/10 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <SFInternaldrive size={18} className="text-[#0071e3] dark:text-[#2997ff]" />
              <h3 className="text-[15px] font-semibold text-[#1d1d1f] dark:text-white">
                Trạng Thái Lưu Trữ (IndexedDB)
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <div className="apple-badge-base apple-badge-success">
                <SFCheckmarkCircleFill size={13} className="shrink-0" />
                <span>Đã kết nối & Bền vững</span>
              </div>
              <button
                type="button"
                onClick={handleRepairIDB}
                disabled={isRepairing}
                className="apple-badge-base apple-badge-info apple-status-action disabled:opacity-50"
                title="Tự động kiểm tra và kết nối lại IndexedDB"
              >
                <SFArrowClockwise size={12} className={isRepairing ? 'animate-spin' : ''} />
                <span>{isRepairing ? 'Đang sửa...' : 'Tự sửa IDB'}</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-center">
            <div className="p-3.5 rounded-[16px] bg-[#f5f5f7]/60 dark:bg-white/5 border border-white/60 dark:border-white/5 shadow-xs">
              <div className="text-[22px] font-semibold tracking-tight text-[#1d1d1f] dark:text-white">{counts.links}</div>
              <div className="text-[11.5px] text-[#86868b] dark:text-[#a1a1a6] font-medium mt-0.5">Links lưu trữ</div>
            </div>
            <div className="p-3.5 rounded-[16px] bg-[#f5f5f7]/60 dark:bg-white/5 border border-white/60 dark:border-white/5 shadow-xs">
              <div className="text-[22px] font-semibold tracking-tight text-[#1d1d1f] dark:text-white">{counts.accounts}</div>
              <div className="text-[11.5px] text-[#86868b] dark:text-[#a1a1a6] font-medium mt-0.5">Tài khoản</div>
            </div>
            <div className="p-3.5 rounded-[16px] bg-[#f5f5f7]/60 dark:bg-white/5 border border-white/60 dark:border-white/5 shadow-xs">
              <div className="text-[22px] font-semibold tracking-tight text-[#1d1d1f] dark:text-white">{counts.stores}</div>
              <div className="text-[11.5px] text-[#86868b] dark:text-[#a1a1a6] font-medium mt-0.5">Cửa hàng</div>
            </div>
            <div className="p-3.5 rounded-[16px] bg-[#f5f5f7]/60 dark:bg-white/5 border border-white/60 dark:border-white/5 shadow-xs">
              <div className="text-[22px] font-semibold tracking-tight text-amber-600 dark:text-amber-400">{counts.notes}</div>
              <div className="text-[11.5px] text-[#86868b] dark:text-[#a1a1a6] font-medium mt-0.5">Ghi chú</div>
            </div>
            <div className="p-3.5 rounded-[16px] bg-[#f5f5f7]/60 dark:bg-white/5 border border-white/60 dark:border-white/5 shadow-xs">
              <div className="text-[22px] font-semibold tracking-tight text-blue-600 dark:text-blue-400">{counts.todos}</div>
              <div className="text-[11.5px] text-[#86868b] dark:text-[#a1a1a6] font-medium mt-0.5">Việc cần làm</div>
            </div>
            <div className="p-3.5 rounded-[16px] bg-[#f5f5f7]/60 dark:bg-white/5 border border-white/60 dark:border-white/5 shadow-xs">
              <div className="text-[22px] font-semibold tracking-tight text-[#0071e3] dark:text-[#2997ff]">
                {formatBytes(storageBytes)}
              </div>
              <div className="text-[11.5px] text-[#86868b] dark:text-[#a1a1a6] font-medium mt-0.5">Dung lượng dùng</div>
            </div>
          </div>

          <p className="text-[13px] text-[#86868b] dark:text-[#a1a1a6] leading-relaxed">
            Tất cả dữ liệu được lưu trực tiếp trong IndexedDB của trình duyệt trên thiết bị của bạn. Dữ liệu không bị mất khi bạn bấm F5, refresh trình duyệt hoặc đóng mở lại website.
          </p>
        </div>

        <div className="glass-material rounded-[22px] p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#e0e0e0] dark:border-white/10 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <SFShieldFill size={18} className="text-[#34c759]" />
              <h3 className="text-[15px] font-semibold text-[#1d1d1f] dark:text-white">
                Sao Lưu &amp; Phục Hồi Toàn Diện (.fmbackup)
              </h3>
            </div>
            <div className="apple-badge-base apple-badge-success">
              <SFLock size={12} className="shrink-0" />
              <span>Mã Hoá AES-GCM-256</span>
            </div>
          </div>

          <p className="text-[13px] text-[#86868b] dark:text-[#a1a1a6] leading-relaxed">
            Xuất <strong className="text-[#1d1d1f] dark:text-white font-semibold">toàn bộ dữ liệu</strong> ra file{' '}
            <code className="text-[12px] px-1.5 py-0.5 rounded-md bg-black/[0.06] dark:bg-white/10 font-mono">.fmbackup</code>{' '}
            — bao gồm Links, Tài khoản, Cửa hàng, <em>tất cả Ghi chú</em> (kể cả ảnh đính kèm), Tệp đính kèm và Cài đặt.
            Hỗ trợ mã hóa bảo mật cấp cao bằng mật khẩu cá nhân để bảo vệ 100% dữ liệu trước các sự cố rò rỉ.
          </p>

          <div className="p-3.5 rounded-xl bg-black/[0.03] dark:bg-white/[0.04] border border-black/5 dark:border-white/5 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[12px] font-semibold text-[#1d1d1f] dark:text-white flex items-center gap-1.5">
                <SFLock size={13} className="text-[#0071e3]" />
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

          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              variant="glassProminent"
              size="sm"
              onClick={handleExportFMBackup}
              disabled={isExportingBackup}
              icon={isExportingBackup ? <SFArrowClockwise size={16} className="animate-spin" /> : <SFArrowUpDocument size={16} />}
            >
              {isExportingBackup ? 'Đang xuất...' : exportPassword.trim() ? 'Xuất File Mã Hoá (.fmbackup)' : 'Xuất Toàn Bộ (.fmbackup)'}
            </Button>

            <Button
              variant="glass"
              size="sm"
              onClick={() => backupFileInputRef.current?.click()}
              disabled={isImportingBackup}
              icon={isImportingBackup ? <SFArrowClockwise size={16} className="animate-spin" /> : <SFArrowDownDocument size={16} className="text-emerald-600 dark:text-emerald-400" />}
            >
              {isImportingBackup ? 'Đang nhập...' : 'Nhập Backup (.fmbackup)'}
            </Button>

            <input
              ref={backupFileInputRef}
              type="file"
              accept=".fmbackup,application/json"
              className="sr-only"
              onChange={handleImportFMBackup}
            />
          </div>

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
                    'px-3 py-1.5 rounded-full text-[12px] font-medium border transition-colors cursor-pointer',
                    importConflictStrategy === value
                      ? 'bg-[#0071e3]/15 border-[#0071e3]/40 text-[#0071e3] dark:text-[#2997ff]'
                      : 'bg-black/[0.04] dark:bg-white/[0.06] border-transparent text-[#555558] dark:text-[#a1a1a6] hover:bg-black/[0.08] dark:hover:bg-white/10',
                  ].join(' ')}
                >
                  {label}
                </button>
              ))}
            </div>
            <AppleCheckbox
              checked={restoreSettingsOnImport}
              onChange={setRestoreSettingsOnImport}
              size="sm"
              label="Khôi phục cài đặt giao diện (theme) từ backup"
              title="Khôi phục trạng thái giao diện đã lưu trong tệp sao lưu"
            />
          </div>

          {isImportingBackup && importProgress && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-[14px] bg-[#0071e3]/8 dark:bg-[#2997ff]/10 border border-[#0071e3]/20">
              <SFArrowClockwise size={14} className="animate-spin text-[#0071e3] dark:text-[#2997ff] shrink-0" />
              <p className="text-[13px] text-[#0071e3] dark:text-[#2997ff] font-medium">{importProgress}</p>
            </div>
          )}

          {importResult && !isImportingBackup && (
            <div
              className={[
                'rounded-[16px] p-4 space-y-2 border',
                importResult.success
                  ? 'bg-emerald-500/8 border-emerald-500/25'
                  : 'bg-red-500/8 border-red-500/25',
              ].join(' ')}
            >
              <p
                className={[
                  'text-[13px] font-semibold',
                  importResult.success ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600 dark:text-red-400',
                ].join(' ')}
              >
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

        <div className="glass-material rounded-[22px] p-6 shadow-xs space-y-4">
          <h3 className="text-[15px] font-semibold text-[#1d1d1f] dark:text-white flex items-center gap-2">
            <SFArrowDownDocument size={16} className="text-[#0071e3]" />
            Trung Tâm Dữ Liệu &amp; Sao Lưu Excel
          </h3>
          <p className="text-[13px] text-[#86868b] dark:text-[#a1a1a6] leading-relaxed">
            Nhập file Excel từ thiết bị của bạn, tải template mẫu hoặc xuất toàn bộ dữ liệu (LINK, ACCOUNT, DS CH) ra file Excel (.xlsx) bất kỳ lúc nào.
          </p>
          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            <Button variant="glassProminent" size="sm" onClick={handleExportBackup} icon={<SFArrowUpDocument size={16} />}>
              Xuất Toàn Bộ Workspace (.xlsx)
            </Button>

            <Button
              variant="glass"
              size="sm"
              onClick={() => window.dispatchEvent(new CustomEvent('fm:open-import'))}
              icon={<SFArrowDownDocument size={16} className="text-emerald-600 dark:text-emerald-400" />}
            >
              Nạp File Excel Vào Workspace
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

          <div className="pt-1">
            <AppleCheckbox
              checked={maskPasswordInExport}
              onChange={setMaskPasswordInExport}
              size="sm"
              label="Bảo vệ quyền riêng tư: Ẩn mật khẩu (dạng ••••••••) khi xuất Excel"
              title="Che giấu các ký tự mật khẩu trong tệp Excel để đảm bảo an toàn thông tin"
            />
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

        <ConfirmDeleteDialog
          isOpen={confirmResetOpen}
          onClose={() => setConfirmResetOpen(false)}
          onConfirm={handleResetWorkspace}
          title="Xác nhận xóa sạch toàn bộ dữ liệu?"
          description="Toàn bộ Links, Accounts, Stores và Lịch sử sẽ bị xóa. Hệ thống sẽ giữ workspace hoàn toàn trống để bạn nhập mới (không tự nạp lại dữ liệu mẫu)."
        />

        <ConfirmDeleteDialog
          isOpen={confirmSeedRestoreOpen}
          onClose={() => setConfirmSeedRestoreOpen(false)}
          onConfirm={handleRestoreSeedData}
          title="Khôi phục dữ liệu mẫu ban đầu?"
          description="Hành động này sẽ ghi đè và nạp lại toàn bộ danh mục liên kết, tài khoản và cửa hàng mặc định của Farmers Market."
        />

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
              <SFLock size={18} />
            </div>
            <div>
              <h3 className="font-semibold text-[15px] text-[#1d1d1f] dark:text-white">Mở Khóa Tệp Sao Lưu</h3>
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
      </div>
    );
  }
);
