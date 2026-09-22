import React, { useState, useEffect } from 'react';
import {
  Settings,
  Database,
  HardDrive,
  Trash2,
  Download,
  Sun,
  Moon,
  Palette,
  ShieldAlert,
  CheckCircle2,
  RefreshCw,
  WifiOff,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { dataService } from '@/services/dataService';
import { excelService } from '@/services/excelService';
import { ConfirmDeleteDialog } from '@/components/ui/ConfirmDeleteDialog';
import { useUiStore } from '@/stores/ui-store';
import { formatBytes } from '@/lib/utils';
import toast from 'react-hot-toast';

export const SettingsPage: React.FC = () => {
  const { theme, setTheme } = useUiStore();
  const [counts, setCounts] = useState({ links: 0, accounts: 0, stores: 0, activities: 0 });
  const [storageBytes, setStorageBytes] = useState<number>(0);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [isRepairing, setIsRepairing] = useState(false);

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
  }, []);

  const handleExportBackup = async () => {
    try {
      await excelService.exportFullWorkspace();
      toast.success('Đã tải xuống file sao lưu Excel thành công!');
    } catch {
      toast.error('Lỗi khi xuất file');
    }
  };

  const handleResetWorkspace = async () => {
    try {
      await dataService.clearAllData();
      toast.success('Đã xóa trắng toàn bộ dữ liệu workspace.');
      await loadStats();
    } catch {
      toast.error('Lỗi khi reset workspace');
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
          <Settings className="w-6 h-6 text-[#0066cc]" />
          Cài Đặt & Quản Trị Hệ Thống
        </h1>
        <p className="text-[14px] text-[#86868b] dark:text-[#a1a1a6] mt-1">
          Quản lý dung lượng lưu trữ cục bộ, sao lưu dự phòng và tùy chỉnh giao diện theo tiêu chuẩn Apple.
        </p>
      </div>

      {/* Storage Health & Stats */}
      <div className="glass-material rounded-[22px] p-6 shadow-xs space-y-5">
        <div className="flex items-center justify-between pb-3.5 border-b border-[#e0e0e0] dark:border-white/10 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-[#0066cc]" />
            <h3 className="text-[15px] font-semibold text-[#1d1d1f] dark:text-white">
              Trạng Thái Lưu Trữ (IndexedDB)
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-semibold px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Đã kết nối & Bền vững</span>
            </div>
            <button
              onClick={handleRepairIDB}
              disabled={isRepairing}
              className="flex items-center gap-1.5 text-xs text-[#0066cc] dark:text-[#2997ff] px-3 py-1 rounded-full bg-[#0066cc]/10 border border-[#0066cc]/20 hover:bg-[#0066cc]/20 transition-all disabled:opacity-50"
              title="Tự động kiểm tra và kết nối lại IndexedDB"
            >
              <RefreshCw className={`w-3 h-3 ${isRepairing ? 'animate-spin' : ''}`} />
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
        <WifiOff className="w-4 h-4 text-[#7a7a7a] shrink-0 mt-0.5" />
        <div>
          <p className="text-[13px] font-medium text-[#1d1d1f] dark:text-white">Hoạt động hoàn toàn ngoại tuyến</p>
          <p className="text-[12px] text-[#86868b] dark:text-[#a1a1a6] mt-0.5 leading-relaxed">
            FM Workspace không gửi bất kỳ dữ liệu nào lên internet. Mọi Links, Accounts và Stores đều nằm 100% trong trình duyệt của bạn.
          </p>
        </div>
      </div>

      {/* Backup & Export */}
      <div className="glass-material rounded-[22px] p-6 shadow-xs space-y-4">
        <h3 className="text-[15px] font-semibold text-[#1d1d1f] dark:text-white flex items-center gap-2">
          <Download className="w-4 h-4 text-[#0066cc]" />
          Sao Lưu & Xuất Dữ Liệu
        </h3>
        <p className="text-[13px] text-[#86868b] dark:text-[#a1a1a6] leading-relaxed">
          Xuất toàn bộ hệ thống gồm 3 sheets: LINK, ACCOUNT, DS CH ra một file Excel (.xlsx) chuẩn cấu trúc Apple để sao lưu hoặc chuyển đổi thiết bị.
        </p>
        <div>
          <Button
            variant="glass"
            size="sm"
            onClick={handleExportBackup}
            icon={<Download className="w-4 h-4 text-[#0066cc]" />}
          >
            Tải về File Excel Toàn Bộ Workspace
          </Button>
        </div>
      </div>

      {/* Theme / Appearance */}
      <div className="glass-material rounded-[22px] p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h3 className="text-[15px] font-semibold text-[#1d1d1f] dark:text-white flex items-center gap-2">
              <Palette className="w-4 h-4 text-[#0066cc] dark:text-[#2997ff]" />
              Chế Độ Hiển Thị Giao Diện
            </h3>
            <p className="text-[13px] text-[#86868b] dark:text-[#a1a1a6] mt-0.5">
              Tùy chọn phong cách hiển thị Apple Clean (Sáng) hoặc Pro Charcoal (Tối) với hiệu ứng kính lỏng Liquid Glass 3D.
            </p>
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-medium bg-[#0066cc]/10 dark:bg-[#2997ff]/15 text-[#0066cc] dark:text-[#2997ff] border border-[#0066cc]/20 dark:border-[#2997ff]/30">
            <span className="w-2 h-2 rounded-full bg-[#0066cc] dark:bg-[#2997ff] animate-pulse" />
            <span>Đang kích hoạt: {theme === 'light' ? 'Light Mode' : 'Dark Mode'}</span>
          </div>
        </div>

        <div className="liquid-glass-segmented-track">
          <button
            type="button"
            onClick={() => setTheme('light')}
            className={`liquid-glass-segmented-item ${theme === 'light' ? 'is-active' : ''}`}
            aria-pressed={theme === 'light'}
          >
            <span
              className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                theme === 'light'
                  ? 'bg-amber-500/15 text-amber-500 shadow-2xs ring-1 ring-amber-500/30'
                  : 'bg-black/5 dark:bg-white/5 text-[#86868b]'
              }`}
            >
              <Sun className="w-4 h-4" />
            </span>
            <div className="flex flex-col text-left leading-tight">
              <span className="font-medium text-[13px]">Light Mode</span>
              <span className="text-[10.5px] opacity-70">Apple Clean</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setTheme('dark')}
            className={`liquid-glass-segmented-item ${theme === 'dark' ? 'is-active' : ''}`}
            aria-pressed={theme === 'dark'}
          >
            <span
              className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                theme === 'dark'
                  ? 'bg-[#0071e3]/20 text-[#2997ff] shadow-2xs ring-1 ring-[#2997ff]/40'
                  : 'bg-black/5 dark:bg-white/5 text-[#86868b]'
              }`}
            >
              <Moon className="w-4 h-4" />
            </span>
            <div className="flex flex-col text-left leading-tight">
              <span className="font-medium text-[13px]">Dark Mode</span>
              <span className="text-[10.5px] opacity-70">Pro Charcoal</span>
            </div>
          </button>
        </div>

        <p className="text-[12px] text-[#86868b] dark:text-[#a1a1a6] flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#0066cc] dark:bg-[#2997ff]" />
          Tùy chọn giao diện được lưu tự động và nhớ qua các lần tải lại trang.
        </p>
      </div>

      {/* Danger Zone */}
      <div className="glass-material rounded-[22px] border border-rose-300/40 dark:border-rose-900/40 p-6 shadow-xs space-y-3.5">
        <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-semibold text-[15px]">
          <ShieldAlert className="w-4 h-4" />
          Vùng Nguy Hiểm (Danger Zone)
        </div>
        <p className="text-[13px] text-[#86868b] dark:text-[#a1a1a6] leading-relaxed">
          Xóa trắng toàn bộ dữ liệu trong IndexedDB (Links, Accounts, Stores, Activity logs). Hãy đảm bảo bạn đã tải file Excel sao lưu trước khi thực hiện.
        </p>
        <div>
          <Button
            variant="danger"
            size="sm"
            onClick={() => setConfirmResetOpen(true)}
            className="rounded-full px-5 py-2.5 active:scale-95 font-medium"
            icon={<Trash2 className="w-4 h-4" />}
          >
            Xóa Toàn Bộ Dữ Liệu Workspace
          </Button>
        </div>
      </div>

      {/* Reset Confirmation Dialog */}
      <ConfirmDeleteDialog
        isOpen={confirmResetOpen}
        onClose={() => setConfirmResetOpen(false)}
        onConfirm={handleResetWorkspace}
        title="Xác nhận xóa toàn bộ dữ liệu?"
        description="Toàn bộ Links, Accounts, Stores và Lịch sử hoạt động sẽ bị xóa hoàn toàn khỏi trình duyệt này."
      />
    </div>
  );
};
