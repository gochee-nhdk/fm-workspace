import React, { useState } from 'react';
import {
  SFCheckmarkCircleFill,
  SFArrowClockwise,
  SFServerRack,
  SFEye,
  SFEyeSlash,
  SFShieldFill,
} from '@/components/ui/AppleIcon';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/auth-store';
import { backupService } from '@/services/backupService';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

interface CloudSyncCardProps {
  onAuthChanged?: () => Promise<void>;
}

export const CloudSyncCard: React.FC<CloudSyncCardProps> = React.memo(({ onAuthChanged }) => {
  const {
    user,
    authMode,
    isAuthenticated,
    isLoading,
    error,
    clearError,
    loginWithPassword,
    register,
    logout,
  } = useAuthStore();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [isSyncingAfterAuth, setIsSyncingAfterAuth] = useState(false);

  const displayError = localError || error;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearError();

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setLocalError('Vui lòng nhập đầy đủ email và mật khẩu.');
      return;
    }
    if (mode === 'register' && password.length < 6) {
      setLocalError('Mật khẩu cần tối thiểu 6 ký tự.');
      return;
    }

    try {
      const ok =
        mode === 'login'
          ? await loginWithPassword(trimmedEmail, password)
          : await register(trimmedEmail, password, fullName.trim() || trimmedEmail.split('@')[0]);

      if (ok) {
        toast.success(
          mode === 'login'
            ? '☁️ Đã đăng nhập Cloud Sync! Đang đồng bộ dữ liệu...'
            : '🎉 Đã tạo tài khoản Cloud Sync thành công!'
        );
        setPassword('');
        setIsSyncingAfterAuth(true);
        try {
          if (mode === 'register') {
            await backupService.syncToServer('manual').catch((err) => {
              console.warn('[CloudSyncCard] Initial backup after register failed:', err);
            });
          }
          if (onAuthChanged) await onAuthChanged();
        } finally {
          setIsSyncingAfterAuth(false);
        }
      } else {
        setLocalError('Không thể xác thực tài khoản. Vui lòng thử lại.');
      }
    } catch (err: any) {
      const serverMsg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        'Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin.';
      setLocalError(serverMsg);
      toast.error(serverMsg);
    }
  };

  const handleLogout = async () => {
    toast.success('Đã chuyển về chế độ Local-First trên thiết bị.');
    await logout();
  };

  return (
    <div className="glass-material rounded-[22px] p-6 shadow-xs space-y-4">
      <div className="flex items-center justify-between pb-3.5 border-b border-[#e0e0e0] dark:border-white/10 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <SFServerRack size={18} className="text-[#0066cc] dark:text-[#2997ff]" />
          <h3 className="text-[15px] font-semibold text-[#1d1d1f] dark:text-white">
            Tài Khoản Cloud Sync (Turso)
          </h3>
        </div>

        <div
          className={cn(
            'apple-badge-base',
            isAuthenticated && authMode === 'cloud' ? 'apple-badge-success' : 'apple-badge-info'
          )}
        >
          {isAuthenticated && authMode === 'cloud' ? (
            <>
              <SFCheckmarkCircleFill size={12} className="shrink-0" />
              <span>Cloud Sync Đang Bật</span>
            </>
          ) : (
            <>
              <SFShieldFill size={12} className="shrink-0" />
              <span>Chế độ Local-First</span>
            </>
          )}
        </div>
      </div>

      {isAuthenticated && authMode === 'cloud' && user ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3 p-4 rounded-[16px] bg-black/[0.03] dark:bg-white/[0.04] border border-black/[0.06] dark:border-white/[0.08]">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full bg-[#0066cc]/15 dark:bg-[#2997ff]/20 text-[#0066cc] dark:text-[#2997ff] flex items-center justify-center font-semibold text-[15px] shrink-0">
                {(user.full_name || user.email || 'U').charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="text-[14px] font-semibold text-[#1d1d1f] dark:text-white truncate">
                  {user.full_name || 'Người dùng FM Workspace'}
                </div>
                <div className="text-[12px] text-[#76767b] dark:text-[#a1a1a6] truncate">
                  {user.email}
                </div>
              </div>
            </div>

            <Button
              variant="glass"
              size="sm"
              onClick={handleLogout}
              disabled={isLoading || isSyncingAfterAuth}
              className="rounded-full px-4 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 border-rose-500/20"
            >
              Đăng xuất (Về Local-First)
            </Button>
          </div>

          <p className="text-[12.5px] text-[#86868b] dark:text-[#a1a1a6] leading-relaxed">
            Mọi ghi chú, liên kết, tài khoản, cửa hàng và cấu hình API/SMTP của bạn được tách biệt theo hồ sơ cá nhân và tự động đồng bộ an toàn lên Turso Cloud.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-[13px] text-[#86868b] dark:text-[#a1a1a6] leading-relaxed">
            Hiện tại bạn đang sử dụng <strong className="text-[#1d1d1f] dark:text-white font-semibold">Chế độ Local-First</strong> (lưu 100% trên trình duyệt, không cần đăng nhập). Đăng nhập hoặc tạo tài khoản để kích hoạt đồng bộ đám mây Turso đa thiết bị.
          </p>

          <div className="inline-flex p-1 rounded-full bg-black/[0.04] dark:bg-white/[0.06] border border-black/[0.06] dark:border-white/[0.08]">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setLocalError(null);
                clearError();
              }}
              className={cn(
                'px-3.5 py-1.5 rounded-full text-[12px] font-medium transition-colors cursor-pointer',
                mode === 'login'
                  ? 'bg-white dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-white shadow-2xs'
                  : 'text-[#76767b] dark:text-[#a1a1a6] hover:text-[#1d1d1f] dark:hover:text-white'
              )}
            >
              Đăng nhập
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setLocalError(null);
                clearError();
              }}
              className={cn(
                'px-3.5 py-1.5 rounded-full text-[12px] font-medium transition-colors cursor-pointer',
                mode === 'register'
                  ? 'bg-white dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-white shadow-2xs'
                  : 'text-[#76767b] dark:text-[#a1a1a6] hover:text-[#1d1d1f] dark:hover:text-white'
              )}
            >
              Tạo tài khoản
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {mode === 'register' && (
              <div className="sm:col-span-2">
                <label className="text-[12px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] block mb-1">
                  Họ và tên (Tùy chọn):
                </label>
                <input
                  type="text"
                  placeholder="vd: Nguyễn Văn A"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl text-[13px] bg-white dark:bg-white/10 border border-black/15 dark:border-white/15 outline-none focus:border-[#0071e3] text-[#1d1d1f] dark:text-white transition-colors"
                />
              </div>
            )}

            <div>
              <label className="text-[12px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] block mb-1">
                Email:
              </label>
              <input
                type="email"
                placeholder="email@farmersmarket.vn"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3.5 py-2 rounded-xl text-[13px] bg-white dark:bg-white/10 border border-black/15 dark:border-white/15 outline-none focus:border-[#0071e3] text-[#1d1d1f] dark:text-white transition-colors"
              />
            </div>

            <div>
              <label className="text-[12px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] block mb-1">
                Mật khẩu:
              </label>
              <div className="relative flex items-center">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Tối thiểu 6 ký tự"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-3.5 py-2 pr-10 rounded-xl text-[13px] bg-white dark:bg-white/10 border border-black/15 dark:border-white/15 outline-none focus:border-[#0071e3] text-[#1d1d1f] dark:text-white transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
                  aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                >
                  {showPassword ? <SFEyeSlash size={15} /> : <SFEye size={15} />}
                </button>
              </div>
            </div>
          </div>

          {displayError && (
            <div className="px-3.5 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-[12.5px] text-rose-600 dark:text-rose-400">
              {displayError}
            </div>
          )}

          <div className="flex items-center justify-end pt-1">
            <Button
              type="submit"
              variant="glassProminent"
              size="sm"
              disabled={isLoading || isSyncingAfterAuth}
              icon={isLoading || isSyncingAfterAuth ? <SFArrowClockwise size={14} className="animate-spin" /> : undefined}
              className="rounded-full px-5 py-2 text-[13px] font-medium"
            >
              {isLoading || isSyncingAfterAuth
                ? 'Đang xử lý...'
                : mode === 'login'
                ? 'Đăng nhập & Đồng bộ'
                : 'Tạo tài khoản Cloud Sync'}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
});
