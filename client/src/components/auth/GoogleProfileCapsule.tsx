import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuthStore } from '@/stores/auth-store';
import { triggerLiquidSpringClick } from '@/services/motionGuardian';
import { getActiveDbName } from '@/services/storage/indexedDb';
import { backupService } from '@/services/backupService';
import toast from 'react-hot-toast';
import { CloseButton } from '@/components/ui/close-button';

export const GoogleProfileCapsule: React.FC = () => {
  const { user, loginWithPassword, register, logout } = useAuthStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  // Form Fields
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Close on Escape key
  useEffect(() => {
    if (!modalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [modalOpen]);

  const activeDbName = getActiveDbName();
  const isAuthenticatedUser = Boolean(user?.id && user?.email);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = emailInput.trim().toLowerCase();

    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      toast.error('Vui lòng nhập định dạng email hợp lệ (ví dụ: yourname@gmail.com)');
      return;
    }

    if (!passwordInput || passwordInput.length < 6) {
      toast.error('Mật khẩu bảo mật phải có ít nhất 6 ký tự');
      return;
    }

    if (authMode === 'register') {
      if (passwordInput !== confirmPasswordInput) {
        toast.error('Mật khẩu xác nhận không khớp');
        return;
      }
    }

    try {
      setIsSubmitting(true);

      if (authMode === 'login') {
        await loginWithPassword(cleanEmail, passwordInput);
        toast.success(`Đăng nhập thành công! Đã kết nối không gian lưu trữ riêng.`);
      } else {
        const fullName = nameInput.trim() || cleanEmail.split('@')[0];
        await register(cleanEmail, passwordInput, fullName);
        toast.success(`Tạo tài khoản thành công! Không gian làm việc bảo mật đã sẵn sàng.`);
      }

      setModalOpen(false);
      setPasswordInput('');
      setConfirmPasswordInput('');
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.response?.data?.message || err?.message || 'Thao tác không thành công';
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloudSync = async () => {
    try {
      setIsSyncing(true);
      const res = await backupService.syncToServer('manual');
      if (res.success) {
        toast.success('Đã đồng bộ an toàn lên Cloud Server cá nhân!');
      } else {
        toast.error(res.message || 'Không thể đồng bộ lên Cloud');
      }
    } catch (err: any) {
      toast.error(err.message || 'Lỗi kết nối đồng bộ');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <>
      {isAuthenticatedUser ? (
        <div className="relative">
          <button
            onClick={(e) => {
              triggerLiquidSpringClick(e.currentTarget);
              setMenuOpen(!menuOpen);
            }}
            className="liquid-auth-trigger flex items-center gap-2 pl-1 pr-3 py-1 rounded-full bg-white/70 dark:bg-white/10 hover:bg-white/90 dark:hover:bg-white/15 border border-black/10 dark:border-white/15 shadow-xs transition-all cursor-pointer"
            title={`Tài khoản: ${user?.email} (Bộ nhớ: ${activeDbName})`}
          >
            {user?.avatar_url ? (
              <img
                src={user.avatar_url}
                alt={user.full_name || 'User'}
                className="w-7 h-7 rounded-full object-cover border border-emerald-500/50 shadow-xs"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-400 text-white font-bold text-xs flex items-center justify-center shadow-xs">
                {user?.full_name?.charAt(0)?.toUpperCase() || 'U'}
              </div>
            )}
            <div className="flex flex-col text-left">
              <span className="text-[12px] font-semibold text-[#1d1d1f] dark:text-white leading-tight max-w-[110px] truncate">
                {user?.full_name || user?.email?.split('@')[0]}
              </span>
              <span className="text-[9.5px] font-medium text-emerald-600 dark:text-emerald-400 leading-none flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
                Kho riêng tư
              </span>
            </div>
          </button>

          {/* Account Details & Management Menu */}
          {menuOpen && (
            <div className="absolute right-0 mt-2 w-72 rounded-2xl bg-white/95 dark:bg-[#1c1c1e]/95 backdrop-blur-2xl border border-black/10 dark:border-white/15 shadow-2xl p-3.5 z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center gap-3 pb-3 border-b border-black/5 dark:border-white/10">
                {user?.avatar_url ? (
                  <img src={user.avatar_url} alt="Avatar" className="w-10 h-10 rounded-full border border-black/10" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-400 text-white font-bold flex items-center justify-center text-sm shadow-xs">
                    {user?.full_name?.charAt(0)?.toUpperCase() || 'U'}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold text-[#1d1d1f] dark:text-white truncate">
                    {user?.full_name}
                  </div>
                  <div className="text-[11px] text-[#86868b] truncate">{user?.email}</div>
                  <span className="inline-block mt-0.5 px-1.5 py-0.5 text-[9px] font-bold rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                    Phân vùng: {activeDbName.replace('FM_WORKSPACE_DB_', '')}
                  </span>
                </div>
              </div>

              {/* Storage & Privacy Status */}
              <div className="py-2.5 px-1 text-[11px] text-[#86868b] leading-relaxed flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-[#1d1d1f] dark:text-[#f5f5f7]">
                  <span className="font-medium">🔒 Bộ nhớ cục bộ:</span>
                  <span className="font-mono text-[10px] bg-black/5 dark:bg-white/10 px-1.5 py-0.5 rounded">
                    Độc lập 100%
                  </span>
                </div>
                <p className="text-[10.5px]">
                  Mọi ghi chú, to-do, links và accounts đều được mã hóa và phân vùng riêng, chỉ tài khoản này mới mở được.
                </p>
              </div>

              <div className="pt-2 border-t border-black/5 dark:border-white/10 flex flex-col gap-1.5">
                <button
                  onClick={handleCloudSync}
                  disabled={isSyncing}
                  className="w-full text-left px-3 py-2 rounded-xl text-[12px] font-medium text-[#1d1d1f] dark:text-white hover:bg-emerald-500/10 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors cursor-pointer flex items-center justify-between"
                >
                  <span className="flex items-center gap-2">
                    ☁️ Sao lưu & Đồng bộ đám mây
                  </span>
                  {isSyncing && <div className="w-3.5 h-3.5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />}
                </button>

                <button
                  onClick={() => {
                    setMenuOpen(false);
                    setAuthMode('login');
                    setModalOpen(true);
                  }}
                  className="w-full text-left px-3 py-1.5 rounded-xl text-[12px] text-[#1d1d1f] dark:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer flex items-center gap-2"
                >
                  🔄 Đổi sang tài khoản khác
                </button>

                <button
                  onClick={() => {
                    logout();
                    setMenuOpen(false);
                    toast.success('Đã đăng xuất an toàn');
                  }}
                  className="w-full text-left px-3 py-1.5 rounded-xl text-[12px] font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer flex items-center gap-2"
                >
                  🚪 Đăng xuất khỏi thiết bị
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <button
          onClick={(e) => {
            triggerLiquidSpringClick(e.currentTarget);
            setModalOpen(true);
          }}
          className="liquid-auth-trigger liquid-lens-pill flex items-center gap-2 px-3 py-1.5 text-[12.5px] font-medium text-[#1d1d1f] dark:text-white cursor-pointer select-none"
          title="Đăng nhập hoặc đăng ký tài khoản có bộ nhớ riêng"
        >
          {/* Animated Google / Security Shield Icon */}
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          <span className="hidden sm:inline font-semibold">Đăng nhập tài khoản</span>
        </button>
      )}

      {/* Account Authentication Modal (Portaled directly to document.body) */}
      {modalOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6 bg-black/65 backdrop-blur-md animate-in fade-in duration-200"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setModalOpen(false);
            }}
          >
            <div className="relative w-full max-w-md rounded-3xl bg-white/95 dark:bg-[#1c1c1e]/95 backdrop-blur-2xl border border-black/10 dark:border-white/15 p-6 sm:p-8 shadow-2xl flex flex-col items-center text-center animate-in zoom-in-95 duration-200">
              {/* Apple Close Button */}
              <div className="absolute top-4 right-4 z-10">
                <CloseButton onClick={() => setModalOpen(false)} aria-label="Đóng cửa sổ" size="sm" />
              </div>

              {/* Brand Shield & Lock Avatar */}
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center mb-3.5 shadow-sm">
                <span className="text-2xl">🔐</span>
              </div>

              <h3 className="text-[21px] font-bold text-[#1d1d1f] dark:text-white tracking-tight mb-1">
                {authMode === 'login' ? 'Đăng Nhập Tài Khoản' : 'Tạo Tài Khoản Mới'}
              </h3>
              <p className="text-[12.5px] text-[#86868b] leading-relaxed mb-5 max-w-[340px]">
                {authMode === 'login'
                  ? 'Đăng nhập để truy cập không gian dữ liệu cá nhân, đồng bộ và bảo mật riêng tư tuyệt đối.'
                  : 'Đăng ký tài khoản để sở hữu kho lưu trữ độc lập trên máy và Cloud.'}
              </p>

              {/* Segmented Liquid Glass Tabs (Login vs Register) */}
              <div className="w-full grid grid-cols-2 p-1 rounded-2xl bg-black/5 dark:bg-white/10 mb-5 border border-black/5 dark:border-white/10">
                <button
                  type="button"
                  onClick={(e) => {
                    triggerLiquidSpringClick(e.currentTarget);
                    setAuthMode('login');
                  }}
                  className={`py-2 text-[13px] font-semibold rounded-xl transition-all cursor-pointer ${
                    authMode === 'login'
                      ? 'bg-white dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-white shadow-xs'
                      : 'text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-white'
                  }`}
                >
                  Đăng Nhập
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    triggerLiquidSpringClick(e.currentTarget);
                    setAuthMode('register');
                  }}
                  className={`py-2 text-[13px] font-semibold rounded-xl transition-all cursor-pointer ${
                    authMode === 'register'
                      ? 'bg-white dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-white shadow-xs'
                      : 'text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-white'
                  }`}
                >
                  Đăng Ký Mới
                </button>
              </div>

              {/* Authentication Form */}
              <form onSubmit={handleSubmit} className="w-full flex flex-col gap-3.5 text-left">
                {authMode === 'register' && (
                  <div>
                    <label className="block text-[12px] font-semibold text-[#1d1d1f] dark:text-[#a1a1a6] mb-1.5">
                      Họ và Tên của bạn
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="ví dụ: Nguyễn Văn A"
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl bg-black/5 dark:bg-white/10 border border-black/10 dark:border-white/15 text-[13.5px] text-[#1d1d1f] dark:text-white placeholder-[#86868b] focus:outline-none focus:ring-2 focus:ring-emerald-500/40 transition-all"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-[12px] font-semibold text-[#1d1d1f] dark:text-[#a1a1a6] mb-1.5">
                    Địa chỉ Email
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="ví dụ: user@gmail.com"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-black/5 dark:bg-white/10 border border-black/10 dark:border-white/15 text-[13.5px] text-[#1d1d1f] dark:text-white placeholder-[#86868b] focus:outline-none focus:ring-2 focus:ring-emerald-500/40 transition-all"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-[12px] font-semibold text-[#1d1d1f] dark:text-[#a1a1a6]">
                      Mật khẩu bảo mật
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                    >
                      {showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    </button>
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Tối thiểu 6 ký tự"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-black/5 dark:bg-white/10 border border-black/10 dark:border-white/15 text-[13.5px] text-[#1d1d1f] dark:text-white placeholder-[#86868b] focus:outline-none focus:ring-2 focus:ring-emerald-500/40 transition-all font-mono"
                  />
                </div>

                {authMode === 'register' && (
                  <div>
                    <label className="block text-[12px] font-semibold text-[#1d1d1f] dark:text-[#a1a1a6] mb-1.5">
                      Xác nhận lại mật khẩu
                    </label>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="Nhập lại chính xác mật khẩu"
                      value={confirmPasswordInput}
                      onChange={(e) => setConfirmPasswordInput(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl bg-black/5 dark:bg-white/10 border border-black/10 dark:border-white/15 text-[13.5px] text-[#1d1d1f] dark:text-white placeholder-[#86868b] focus:outline-none focus:ring-2 focus:ring-emerald-500/40 transition-all font-mono"
                    />
                  </div>
                )}

                {/* Highly Animated Apple Liquid Glass Sign-In / Register Button */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  onMouseDown={(e) => triggerLiquidSpringClick(e.currentTarget)}
                  className="liquid-auth-btn mt-2 w-full py-3.5 px-5 rounded-2xl text-white font-bold text-[14.5px] border border-white/25 cursor-pointer flex items-center justify-center gap-2.5 group disabled:opacity-50 select-none shadow-xl"
                  title="Xác nhận tài khoản"
                >
                  {isSubmitting ? (
                    <div className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  ) : (
                    <>
                      <span className="text-base group-hover:scale-110 transition-transform">
                        {authMode === 'login' ? '🚀' : '✨'}
                      </span>
                      <span>
                        {authMode === 'login' ? 'Đăng Nhập Không Gian Riêng' : 'Đăng Ký & Tạo Bộ Nhớ Riêng'}
                      </span>
                    </>
                  )}
                </button>

                {/* Close Button */}
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="w-full py-2 px-4 rounded-xl text-[12.5px] font-medium text-[#76767b] dark:text-[#a1a1a6] hover:text-[#1d1d1f] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-all cursor-pointer"
                >
                  Đóng cửa sổ
                </button>
              </form>

              {/* Data Segregation & Privacy Guarantee */}
              <div className="w-full pt-4 mt-1 border-t border-black/5 dark:border-white/10 text-left">
                <div className="flex items-start gap-2.5">
                  <span className="text-emerald-500 font-bold text-sm shrink-0">🛡️</span>
                  <span className="text-[11px] text-[#86868b] leading-relaxed">
                    <strong>Phân Vùng Bộ Nhớ Độc Lập:</strong> Mỗi tài khoản được cấp một cơ sở dữ liệu IndexedDB riêng biệt và két lưu trữ Cloud mã hóa riêng. Không ai có thể nhìn thấy ghi chú hay dữ liệu làm việc của bạn.
                  </span>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
};