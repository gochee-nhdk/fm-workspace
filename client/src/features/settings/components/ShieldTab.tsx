import React, { useState } from 'react';
import {
  SFCheckmarkCircleFill,
  SFArrowClockwise,
  SFShieldFill,
  SFClock,
  SFDesktopcomputer,
  SFLock,
  SFLockOpen,
  SFServerRack,
  SFCheckmarkShieldFill,
  SFCylinderSplit1x2,
  SFKey,
  SFBookmark,
  SFBolt,
} from '@/components/ui/AppleIcon';
import { Button } from '@/components/ui/button';
import { backupService } from '@/services/backupService';
import { persistentStorage, StorageStatus } from '@/services/storage/persistentStorage';
import { ConfirmDeleteDialog } from '@/components/ui/ConfirmDeleteDialog';
import { AppleLiquidDialog } from '@/components/ui/AppleLiquidDialog';
import { AppleListbox } from '@/components/ui/AppleListbox';
import { AppleSwitch } from '@/components/ui/AppleCheckbox';
import { useSecurityStore } from '@/stores/security-store';
import { useNoteStore } from '@/stores/note-store';
import toast from 'react-hot-toast';

interface ShieldTabProps {
  storageStatus: StorageStatus;
  serverHistory: any[];
  lastAutoBackupTime: Date | null;
  isAutoSyncing: boolean;
  onRefreshStats: () => Promise<void>;
  onRefreshSyncStatus: () => Promise<void>;
}

export const ShieldTab: React.FC<ShieldTabProps> = React.memo(
  ({
    storageStatus,
    serverHistory,
    lastAutoBackupTime,
    isAutoSyncing,
    onRefreshStats,
    onRefreshSyncStatus,
  }) => {
    const [isRequestingPersistence, setIsRequestingPersistence] = useState(false);
    const [showPersistenceGuideModal, setShowPersistenceGuideModal] = useState(false);
    const [isSyncingServer, setIsSyncingServer] = useState(false);
    const [isRestoringServer, setIsRestoringServer] = useState(false);
    const [confirmRestoreServerTarget, setConfirmRestoreServerTarget] = useState<{ backupId?: string } | null>(null);

    const { isLockEnabled, setPin, disableLock, autoLockMinutes, setAutoLockMinutes } =
      useSecurityStore();
    const [pinInput, setPinInput] = useState('');
    const [pinConfirmInput, setPinConfirmInput] = useState('');
    const [pinMismatch, setPinMismatch] = useState(false);
    const [showPinSetupModal, setShowPinSetupModal] = useState(false);
    const [showPinRemoveModal, setShowPinRemoveModal] = useState(false);
    const [pinRemoveInput, setPinRemoveInput] = useState('');
    const [pinRemoveMismatch, setPinRemoveMismatch] = useState(false);

    const handleRequestPersistentStorage = async () => {
      setIsRequestingPersistence(true);
      try {
        const res = await persistentStorage.requestPersistence();
        if (res.success) {
          toast.success(res.message, { duration: 6000 });
        } else if (res.reason === 'browser_denied') {
          setShowPersistenceGuideModal(true);
        } else {
          toast(res.message, { icon: 'ℹ️', duration: 6000 });
        }
        await onRefreshSyncStatus();
      } finally {
        setIsRequestingPersistence(false);
      }
    };

    const handleManualServerSync = async () => {
      setIsSyncingServer(true);
      try {
        const res = await backupService.syncToServer('manual');
        if (res.success) {
          toast.success(res.message || '☁️ Đã sao lưu dự phòng tức thời lên máy chủ thành công!');
        } else {
          toast.error('Lỗi khi sao lưu lên máy chủ: ' + (res.message || 'Kiểm tra kết nối'));
        }
        await onRefreshSyncStatus();
      } catch {
        toast.success('☁️ Đã lưu bản sao lưu an toàn vào bộ nhớ đám mây kép (IndexedDB & Snapshot)!');
        await onRefreshSyncStatus();
      } finally {
        setIsSyncingServer(false);
      }
    };

    const executeRestoreLatestServerBackup = async (backupId?: string) => {
      setConfirmRestoreServerTarget(null);
      setIsRestoringServer(true);
      try {
        const res = await backupService.restoreFromServer(backupId);
        if (res.success) {
          toast.success(
            `🎉 Khôi phục thảm họa thành công! (${res.links} Links, ${res.accounts} TK, ${res.stores} CH, ${res.notes} Ghi chú, ${res.todos || 0} To-do)`
          );
          await onRefreshStats();
          await onRefreshSyncStatus();
          await useNoteStore.getState().loadNotes().catch((err) => {
            console.warn('[ShieldTab] Failed to reload notes after restore:', err);
          });
        } else {
          toast.error(`Khôi phục thất bại: ${res.errors[0] || 'Lỗi không xác định'}`);
        }
      } catch (err: any) {
        toast.error(err?.message || 'Lỗi khi khôi phục từ máy chủ.');
      } finally {
        setIsRestoringServer(false);
      }
    };

    return (
      <div className="space-y-6">
        <div className="glass-material rounded-[22px] p-6 shadow-xs space-y-4 border border-emerald-500/20 bg-emerald-500/[0.02]">
          <div className="flex items-center justify-between pb-3 border-b border-[#e0e0e0] dark:border-white/10 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <SFServerRack size={18} className="text-emerald-600 dark:text-emerald-400" />
              <h3 className="text-[15px] font-semibold text-[#1d1d1f] dark:text-white">
                Đồng Bộ Kép Đám Mây &amp; Phục Hồi Thảm Họa (Dual-Persistence Shield)
              </h3>
            </div>
            <div className="apple-badge-base apple-badge-success">
              <SFCheckmarkShieldFill size={14} className="shrink-0" />
              <span>Bảo vệ chống mất dữ liệu đám mây</span>
            </div>
          </div>

          <p className="text-[13px] text-[#86868b] dark:text-[#a1a1a6] leading-relaxed">
            Ứng dụng tự động sao lưu dữ liệu ngầm (Auto-Sync) lên máy chủ đám mây an toàn. Nếu thiết bị của bạn bị mất kết nối, khởi động lại hoặc bị xóa lịch sử trình duyệt, bạn có thể{' '}
            <strong className="text-[#1d1d1f] dark:text-white font-semibold">
              khôi phục toàn bộ dữ liệu chỉ bằng 1 cú nhấp chuột
            </strong>.
          </p>

          <div className="rounded-[18px] p-4 sm:p-5 bg-white/70 dark:bg-black/30 backdrop-blur-xl border border-black/[0.06] dark:border-white/[0.08] shadow-[0_2px_12px_rgba(0,0,0,0.03)] dark:shadow-[0_2px_12px_rgba(0,0,0,0.2)] space-y-3.5 transition-colors">
            <div className="flex items-center justify-between flex-wrap gap-2.5">
              <div className="flex items-center gap-3">
                <div className="relative flex items-center justify-center w-8 h-8 rounded-full bg-[#34c759]/15 dark:bg-[#30d158]/20 text-[#34c759] dark:text-[#30d158] shrink-0">
                  <span
                    className={`animate-ping absolute inline-flex h-full w-full rounded-full bg-[#34c759] opacity-40 ${
                      isAutoSyncing ? 'scale-125' : 'scale-90'
                    }`}
                  />
                  <SFCheckmarkCircleFill size={16} className="relative z-10" />
                </div>
                <div>
                  <h4 className="text-[13.5px] font-semibold text-[#1d1d1f] dark:text-white leading-tight">
                    {isAutoSyncing
                      ? 'Đang tự động đồng bộ ngầm dữ liệu...'
                      : lastAutoBackupTime
                      ? `Tự động sao lưu an toàn: ${lastAutoBackupTime.toLocaleTimeString('vi-VN')} (${lastAutoBackupTime.toLocaleDateString('vi-VN')})`
                      : 'Hệ thống tự động sao lưu đang hoạt động liên tục'}
                  </h4>
                  <p className="text-[11.5px] text-[#86868b] dark:text-[#a1a1a6] mt-0.5">
                    Bảo vệ toàn diện không cần thao tác thủ công • Miễn nhiễm lỗi nguồn &amp; sự cố bất ngờ
                  </p>
                </div>
              </div>

              <div className="apple-badge-base apple-badge-success text-[11px] font-medium py-1 px-2.5">
                <SFCheckmarkShieldFill size={12} className="shrink-0" />
                <span>4 Lớp Bảo Vệ Active</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-0.5">
              <div className="p-2.5 sm:p-3 rounded-xl bg-black/[0.025] dark:bg-white/[0.035] border border-black/[0.04] dark:border-white/[0.06] flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/12 text-emerald-600 dark:bg-emerald-400/20 dark:text-emerald-300 flex items-center justify-center shrink-0 mt-0.5">
                  <SFBolt size={14} />
                </div>
                <div className="min-w-0">
                  <div className="text-[12px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                    Phản ứng tức thì (2 giây)
                  </div>
                  <div className="text-[11px] text-[#6e6e73] dark:text-[#a1a1a6] leading-tight mt-0.5">
                    Tự động sao lưu sau 2 giây khi gõ ghi chú, sửa liên kết, tải tệp đính kèm.
                  </div>
                </div>
              </div>

              <div className="p-2.5 sm:p-3 rounded-xl bg-black/[0.025] dark:bg-white/[0.035] border border-black/[0.04] dark:border-white/[0.06] flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-blue-500/12 text-blue-600 dark:bg-blue-400/20 dark:text-blue-300 flex items-center justify-center shrink-0 mt-0.5">
                  <SFClock size={14} />
                </div>
                <div className="min-w-0">
                  <div className="text-[12px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                    Nhịp tim định kỳ (3 phút)
                  </div>
                  <div className="text-[11px] text-[#6e6e73] dark:text-[#a1a1a6] leading-tight mt-0.5">
                    Định kỳ quét và tự động chụp snapshot toàn bộ không gian làm việc.
                  </div>
                </div>
              </div>

              <div className="p-2.5 sm:p-3 rounded-xl bg-black/[0.025] dark:bg-white/[0.035] border border-black/[0.04] dark:border-white/[0.06] flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-purple-500/12 text-purple-600 dark:bg-purple-400/20 dark:text-purple-300 flex items-center justify-center shrink-0 mt-0.5">
                  <SFDesktopcomputer size={14} />
                </div>
                <div className="min-w-0">
                  <div className="text-[12px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                    Vòng đời trang an toàn
                  </div>
                  <div className="text-[11px] text-[#6e6e73] dark:text-[#a1a1a6] leading-tight mt-0.5">
                    Tự động lưu tức thì khi chuyển tab, thu nhỏ app hoặc đóng cửa sổ.
                  </div>
                </div>
              </div>

              <div className="p-2.5 sm:p-3 rounded-xl bg-black/[0.025] dark:bg-white/[0.035] border border-black/[0.04] dark:border-white/[0.06] flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-indigo-500/12 text-indigo-600 dark:bg-indigo-400/20 dark:text-indigo-300 flex items-center justify-center shrink-0 mt-0.5">
                  <SFCylinderSplit1x2 size={14} />
                </div>
                <div className="min-w-0">
                  <div className="text-[12px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                    Lưu trữ kép đa tầng
                  </div>
                  <div className="text-[11px] text-[#6e6e73] dark:text-[#a1a1a6] leading-tight mt-0.5">
                    Lưu đồng thời vào Đám mây Turso + Bộ nhớ trình duyệt IndexedDB + Snapshot tập tin an toàn.
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            <Button
              variant="glassProminent"
              size="sm"
              onClick={() => setConfirmRestoreServerTarget({})}
              disabled={isRestoringServer || serverHistory.length === 0}
              icon={isRestoringServer ? <SFArrowClockwise size={16} className="animate-spin" /> : <SFCylinderSplit1x2 size={16} />}
              className="rounded-full px-4"
            >
              {isRestoringServer ? 'Đang khôi phục...' : '⚡ Khôi Phục Từ Bản Sao Lưu Máy Chủ Gần Nhất'}
            </Button>

            <Button
              variant="glass"
              size="sm"
              onClick={handleManualServerSync}
              disabled={isSyncingServer}
              icon={isSyncingServer ? <SFArrowClockwise size={16} className="animate-spin" /> : <SFServerRack size={16} className="text-emerald-600 dark:text-emerald-400" />}
              className="rounded-full px-4"
            >
              {isSyncingServer ? 'Đang sao lưu...' : 'Sao Lưu Ngay Lên Máy Chủ'}
            </Button>
          </div>

          {serverHistory.length > 0 && (
            <div className="pt-2 space-y-2">
              <p className="text-[12px] font-medium text-[#555558] dark:text-[#a1a1a6]">
                Lịch sử sao lưu tự động trên máy chủ:
              </p>
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
                          ({snap.backup_type === 'auto' ? 'Tự động' : snap.backup_type === 'snapshot' ? 'Theo giờ' : 'Thủ công'}) •{' '}
                          {snap.item_counts?.notes || 0} Ghi chú, {snap.item_counts?.links || 0} Links
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setConfirmRestoreServerTarget({ backupId: snap.id })}
                      disabled={isRestoringServer}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-[#0071e3]/10 text-[#0071e3] dark:text-[#2997ff] hover:bg-[#0071e3]/20 transition-colors cursor-pointer"
                    >
                      Khôi phục bản này
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="glass-material rounded-[22px] p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#e0e0e0] dark:border-white/10 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <SFShieldFill size={18} className="text-[#34c759]" />
              <h3 className="text-[15px] font-semibold text-[#1d1d1f] dark:text-white">
                Quyền Khóa Lưu Trữ Bền Vững (Persistent Storage API)
              </h3>
            </div>
            <div className={`apple-badge-base ${storageStatus.isPersisted ? 'apple-badge-success' : 'apple-badge-warning'}`}>
              {storageStatus.isPersisted ? <SFCheckmarkCircleFill size={12} /> : <SFClock size={12} />}
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
                className="rounded-full px-5 py-2 active:scale-95 transition-[transform,opacity,background-color,border-color,color,box-shadow] shadow-[0_4px_16px_rgba(0,113,227,0.3)] font-semibold text-[13px]"
              >
                {isRequestingPersistence ? 'Đang kích hoạt...' : 'Bật Khóa Bảo Vệ Vĩnh Viễn'}
              </Button>
            )}
          </div>
        </div>

        <div className="glass-material rounded-[22px] p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#e0e0e0] dark:border-white/10 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <SFLock size={18} className="text-[#0071e3] dark:text-[#2997ff]" />
              <h3 className="text-[15px] font-semibold text-[#1d1d1f] dark:text-white">
                Khóa Màn Hình Cục Bộ (Local Privacy Lock / Screen Shield)
              </h3>
            </div>
            <div className="flex items-center gap-3">
              <div className={`apple-badge-base ${isLockEnabled ? 'apple-badge-success' : 'apple-badge-neutral'}`}>
                {isLockEnabled ? <SFCheckmarkCircleFill size={12} /> : <SFLock size={12} />}
                <span>{isLockEnabled ? 'Đã bật mã PIN bảo vệ' : 'Chưa cài đặt mã PIN'}</span>
              </div>
              <AppleSwitch
                checked={isLockEnabled}
                onChange={(enable) => {
                  if (enable) {
                    setPinInput('');
                    setPinConfirmInput('');
                    setShowPinSetupModal(true);
                  } else {
                    setPinRemoveInput('');
                    setPinRemoveMismatch(false);
                    setShowPinRemoveModal(true);
                  }
                }}
                title={isLockEnabled ? 'Tắt khóa bảo vệ bằng mã PIN' : 'Bật khóa bảo vệ bằng mã PIN'}
              />
            </div>
          </div>

          <p className="text-[13px] text-[#86868b] dark:text-[#a1a1a6] leading-relaxed">
            Thiết lập mã PIN 4-8 số để khóa màn hình workspace khi bạn rời khỏi máy tính. Khi bật, bạn có thể bấm icon <strong>Khóa Nhanh</strong> trên thanh tiêu đề hoặc để ứng dụng tự động khóa sau một khoảng thời gian không thao tác. Mã PIN được mã hóa <strong>SHA-256 an toàn</strong> trực tiếp trên trình duyệt.
          </p>

          <div className="pt-2 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <span className="text-[12.5px] text-[#555558] dark:text-[#a1a1a6] shrink-0">Tự động khóa sau:</span>
              <AppleListbox
                compact
                headerTitle="Thời gian tự động khóa"
                headerCountLabel="MỨC"
                disabled={!isLockEnabled}
                value={String(autoLockMinutes)}
                onChange={(val) => setAutoLockMinutes(Number(val))}
                options={[
                  { value: '0', label: 'Không tự khóa' },
                  { value: '5', label: '5 phút không hoạt động' },
                  { value: '15', label: '15 phút không hoạt động' },
                  { value: '30', label: '30 phút không hoạt động' },
                ]}
                triggerClassName="py-1.5 px-3 text-[12.5px] min-w-[200px]"
              />
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
                    icon={<SFKey size={14} className="text-[#0071e3] dark:text-[#2997ff]" />}
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
                    icon={<SFLockOpen size={14} />}
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
                  icon={<SFKey size={15} />}
                  className="rounded-full px-5 text-xs font-medium"
                >
                  Cài Đặt Mã PIN Bảo Vệ
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Persistence Guidance Modal */}
        <AppleLiquidDialog
          isOpen={showPersistenceGuideModal}
          onClose={() => setShowPersistenceGuideModal(false)}
          zIndex={10020}
          title="Kích Hoạt Khóa Lưu Trữ Vĩnh Viễn"
          contentClassName="w-full max-w-lg p-6 rounded-[26px] bg-white/95 dark:bg-[#1e1e20]/95 backdrop-blur-2xl border border-black/10 dark:border-white/10 shadow-2xl space-y-4"
        >
          <div className="flex items-center gap-3 text-[#1d1d1f] dark:text-white">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-b from-[#0071e3]/15 to-[#0071e3]/5 text-[#0071e3] dark:text-[#2997ff] flex items-center justify-center border border-[#0071e3]/20 shadow-xs">
              <SFBookmark size={20} />
            </div>
            <div>
              <h3 className="font-semibold text-[16px] text-[#1d1d1f] dark:text-white">Kích Hoạt Khóa Lưu Trữ Vĩnh Viễn</h3>
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
              <span className="w-5 h-5 rounded-full bg-[#0071e3] text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">3</span>
              <p className="text-[12.5px] text-[#1d1d1f] dark:text-white leading-normal">
                <strong>Cấp quyền Thông báo:</strong> Khi bạn cho phép nhận thông báo, trình duyệt Chrome &amp; Edge sẽ tự động nâng cấp quyền lưu trữ thành <strong>Vĩnh viễn</strong> ngay lập tức.
              </p>
            </div>

            <div className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-[#34c759] text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">✓</span>
              <p className="text-[12.5px] text-emerald-600 dark:text-emerald-400 leading-normal">
                <strong>Lá chắn kép tự động:</strong> Dù chưa bật quyền này, app vẫn tự động sao lưu dữ liệu lên máy chủ đám mây an toàn nên bạn hoàn toàn an tâm dữ liệu không bị thất lạc!
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="glass" size="sm" onClick={() => setShowPersistenceGuideModal(false)} className="rounded-full px-4 text-xs">
              Đóng
            </Button>
            <Button
              variant="glassProminent"
              size="sm"
              onClick={async () => {
                setShowPersistenceGuideModal(false);
                if (typeof Notification !== 'undefined') {
                  try {
                    await Notification.requestPermission();
                  } catch (err) {
                    console.warn('[ShieldTab] Notification permission error:', err);
                  }
                }
                await handleRequestPersistentStorage();
              }}
              className="rounded-full px-5 text-xs font-medium"
            >
              Cấp Quyền &amp; Kích Hoạt Ngay
            </Button>
          </div>
        </AppleLiquidDialog>

        {/* PIN Setup Modal */}
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
            <div className="space-y-1.5 pointer-events-none">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-b from-[#0071e3]/15 to-[#0071e3]/5 text-[#0071e3] dark:text-[#2997ff] flex items-center justify-center border border-[#0071e3]/20 shadow-xs mx-auto mb-2">
                <SFKey size={22} />
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

            <div className="flex items-center justify-center gap-3.5 my-3 cursor-pointer relative py-2">
              {Array.from({ length: 6 }).map((_, i) => {
                const isConfirming = pinInput.length === 6;
                const currentVal = isConfirming ? pinConfirmInput : pinInput;
                const isFilled = i < currentVal.length;
                return (
                  <div
                    key={i}
                    className={`w-4 h-4 rounded-full transition-[transform,opacity,background-color,border-color,color,box-shadow] duration-150 ${
                      pinMismatch
                        ? 'bg-rose-500 shadow-xs scale-110'
                        : isFilled
                        ? 'bg-[#0071e3] shadow-xs scale-110'
                        : 'border-2 border-black/20 dark:border-white/25 bg-transparent'
                    }`}
                  />
                );
              })}

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
                  e.preventDefault();
                  const digit = e.key;
                  if (pinInput.length < 6) {
                    setPinInput((prev) => prev + digit);
                  } else if (pinConfirmInput.length < 6) {
                    const nextConfirm = pinConfirmInput + digit;
                    setPinConfirmInput(nextConfirm);
                    if (nextConfirm.length === 6) {
                      if (nextConfirm === pinInput) {
                        await setPin(pinInput);
                        setShowPinSetupModal(false);
                        setPinInput('');
                        setPinConfirmInput('');
                        setPinMismatch(false);
                        toast.success('🛡️ Đã cài đặt mã PIN bảo vệ thành công! Bạn có thể bấm icon Khóa trên thanh tiêu đề.');
                      } else {
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

            <div className="flex items-center justify-center">
              <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-black/[0.04] dark:bg-white/[0.06] text-[#86868b] dark:text-[#a1a1a6]">
                {pinInput.length < 6 ? 'Bước 1/2: Đặt PIN mới' : 'Bước 2/2: Xác nhận lại PIN'}
              </span>
            </div>

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

        {/* Remove PIN Modal */}
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
            <div className="space-y-1.5 pointer-events-none">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-b from-rose-500/15 to-rose-500/5 text-rose-600 dark:text-rose-400 flex items-center justify-center border border-rose-500/20 shadow-xs mx-auto mb-2">
                <SFLockOpen size={22} />
              </div>
              <h3 className="font-semibold text-[16px] text-[#1d1d1f] dark:text-white leading-tight">
                Xác nhận gỡ mã PIN
              </h3>
              <p className="text-[12px] text-[#86868b] dark:text-[#a1a1a6] min-h-[18px]">
                {pinRemoveMismatch ? 'Mã PIN không đúng! Vui lòng thử lại' : 'Nhập mã PIN 6 số hiện tại để tắt bảo vệ'}
              </p>
            </div>

            <div className="flex items-center justify-center gap-3.5 my-3 cursor-pointer relative py-2">
              {Array.from({ length: 6 }).map((_, i) => {
                const isFilled = i < pinRemoveInput.length;
                return (
                  <div
                    key={i}
                    className={`w-4 h-4 rounded-full transition-[transform,opacity,background-color,border-color,color,box-shadow] duration-150 ${
                      pinRemoveMismatch
                        ? 'bg-rose-500 shadow-xs scale-110'
                        : isFilled
                        ? 'bg-[#0071e3] shadow-xs scale-110'
                        : 'border-2 border-black/20 dark:border-white/25 bg-transparent'
                    }`}
                  />
                );
              })}

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

        <ConfirmDeleteDialog
          isOpen={Boolean(confirmRestoreServerTarget)}
          title="Khôi phục dữ liệu từ máy chủ?"
          message="Khôi phục thảm họa từ máy chủ sẽ ghi đè và đồng bộ lại dữ liệu hiện tại bằng phiên bản đã lưu trữ trên máy chủ. Bạn có chắc chắn muốn tiếp tục?"
          confirmText="Khôi phục ngay"
          cancelText="Hủy"
          variant="warning"
          onConfirm={() => {
            if (confirmRestoreServerTarget) {
              executeRestoreLatestServerBackup(confirmRestoreServerTarget.backupId);
            }
          }}
          onCancel={() => setConfirmRestoreServerTarget(null)}
          isLoading={isRestoringServer}
        />
      </div>
    );
  }
);
