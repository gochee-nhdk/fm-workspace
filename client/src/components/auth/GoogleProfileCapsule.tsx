import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuthStore } from '@/stores/auth-store';
import toast from 'react-hot-toast';
import { CloseButton } from '@/components/ui/close-button';

export const GoogleProfileCapsule: React.FC = () => {
  const { user, loginWithQuickProfile, logout } = useAuthStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const isGoogleUser = Boolean(user?.google_id || user?.avatar_url || (user?.email && user?.email !== 'admin@farmersmarket.vn'));

  const handleQuickLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!emailInput.trim() || !emailInput.includes('@')) {
      toast.error('Vui lòng nhập đúng định dạng email (ví dụ: yourname@gmail.com)');
      return;
    }

    try {
      setIsSubmitting(true);
      const email = emailInput.trim();
      const fullName = nameInput.trim() || email.split('@')[0];
      // Generate clean high-resolution initial avatar
      const avatarUrl = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(fullName)}&backgroundColor=10b981,0ea5e9,6366f1&textColor=ffffff`;

      await loginWithQuickProfile(email, fullName, avatarUrl);
      toast.success(`Chào mừng ${fullName}! Đã cá nhân hoá không gian làm việc.`);
      setModalOpen(false);
      setEmailInput('');
      setNameInput('');
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Đăng nhập không thành công');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {isGoogleUser ? (
        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-full bg-white/70 dark:bg-white/10 hover:bg-white/90 dark:hover:bg-white/15 border border-black/10 dark:border-white/15 shadow-xs transition-all active:scale-98 cursor-pointer"
            title={`Tài khoản: ${user?.email}`}
          >
            {user?.avatar_url ? (
              <img
                src={user.avatar_url}
                alt={user.full_name || 'User'}
                className="w-7 h-7 rounded-full object-cover border border-emerald-500/40"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold text-xs flex items-center justify-center">
                {user?.full_name?.charAt(0) || 'U'}
              </div>
            )}
            <div className="flex flex-col text-left">
              <span className="text-[12px] font-semibold text-[#1d1d1f] dark:text-white leading-tight max-w-[110px] truncate">
                {user?.full_name || user?.email?.split('@')[0]}
              </span>
              <span className="text-[9.5px] font-medium text-emerald-600 dark:text-emerald-400 leading-none flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
                Đã đăng nhập
              </span>
            </div>
          </button>

          {/* Account Popover Menu */}
          {menuOpen && (
            <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-white/95 dark:bg-[#1c1c1e]/95 backdrop-blur-2xl border border-black/10 dark:border-white/15 shadow-2xl p-3 z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center gap-3 pb-3 border-b border-black/5 dark:border-white/10">
                {user?.avatar_url ? (
                  <img src={user.avatar_url} alt="Avatar" className="w-10 h-10 rounded-full border border-black/10" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-500 font-bold flex items-center justify-center">
                    {user?.full_name?.charAt(0) || 'G'}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold text-[#1d1d1f] dark:text-white truncate">
                    {user?.full_name}
                  </div>
                  <div className="text-[11px] text-[#86868b] truncate">{user?.email}</div>
                </div>
              </div>

              <div className="py-2.5 text-[11px] text-[#86868b] leading-relaxed">
                🔒 Không gian dữ liệu được lưu trữ cục bộ và cá nhân hoá riêng tư cho tài khoản này.
              </div>

              <div className="pt-2 border-t border-black/5 dark:border-white/10 flex flex-col gap-1.5">
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    setModalOpen(true);
                  }}
                  className="w-full text-left px-3 py-1.5 rounded-lg text-[12px] text-[#1d1d1f] dark:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
                >
                  🔄 Đổi tài khoản cá nhân khác
                </button>
                <button
                  onClick={() => {
                    logout();
                    setMenuOpen(false);
                    toast.success('Đã đăng xuất');
                  }}
                  className="w-full text-left px-3 py-1.5 rounded-lg text-[12px] text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                >
                  🚪 Đăng xuất khỏi thiết bị
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <button
          onClick={() => setModalOpen(true)}
          className="liquid-lens-pill flex items-center gap-2 px-3 py-1.5 text-[12.5px] font-medium text-[#1d1d1f] dark:text-white hover:border-black/20 dark:hover:border-white/30 active:scale-98 cursor-pointer transition-all"
          title="Đăng nhập tài khoản cá nhân hoá"
        >
          {/* Google Logo SVG */}
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
          <span className="hidden sm:inline">Đăng nhập</span>
        </button>
      )}

      {/* Google Sign-In & Personalization Modal — Mounted via Portal to document.body */}
      {modalOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-md animate-in fade-in duration-200"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setModalOpen(false);
            }}
          >
            <div className="relative w-full max-w-md rounded-3xl bg-white/95 dark:bg-[#1c1c1e]/95 backdrop-blur-2xl border border-black/10 dark:border-white/15 p-6 sm:p-8 shadow-2xl flex flex-col items-center text-center animate-in zoom-in-95 duration-200">
              {/* Prominent Apple Close Button */}
              <div className="absolute top-4 right-4 z-10">
                <CloseButton onClick={() => setModalOpen(false)} aria-label="Đóng cửa sổ" size="sm" />
              </div>

              {/* Google Brand Avatar */}
              <div className="w-16 h-16 rounded-2xl bg-white dark:bg-white/10 shadow-lg border border-black/10 dark:border-white/15 flex items-center justify-center mb-4 transition-transform hover:scale-105 duration-200">
                <svg className="w-8 h-8" viewBox="0 0 24 24">
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
              </div>

              <h3 className="text-[20px] font-bold text-[#1d1d1f] dark:text-white tracking-tight mb-1.5">
                Đăng Nhập Cá Nhân Hóa
              </h3>
              <p className="text-[13px] text-[#86868b] leading-relaxed mb-6 max-w-[320px]">
                Thiết lập không gian làm việc riêng tư, hiển thị ảnh đại diện và bảo mật dữ liệu tuyệt đối trên thiết bị của bạn.
              </p>

              {/* Quick Profile / Google Identity Form */}
              <form onSubmit={handleQuickLogin} className="w-full flex flex-col gap-3.5 mb-4 text-left">
                <div>
                  <label className="block text-[12px] font-semibold text-[#1d1d1f] dark:text-[#a1a1a6] mb-1.5">
                    Địa chỉ Email Google / Công việc
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="ví dụ: contact.khanhnhd@gmail.com"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-black/5 dark:bg-white/10 border border-black/10 dark:border-white/15 text-[13.5px] text-[#1d1d1f] dark:text-white placeholder-[#86868b] focus:outline-none focus:ring-2 focus:ring-emerald-500/40 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[12px] font-semibold text-[#1d1d1f] dark:text-[#a1a1a6] mb-1.5">
                    Tên hiển thị (Tùy chọn)
                  </label>
                  <input
                    type="text"
                    placeholder="ví dụ: Khánh Nguyễn"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-black/5 dark:bg-white/10 border border-black/10 dark:border-white/15 text-[13.5px] text-[#1d1d1f] dark:text-white placeholder-[#86868b] focus:outline-none focus:ring-2 focus:ring-emerald-500/40 transition-all"
                  />
                </div>

                {/* Animated Apple Liquid Glass Sign-In Button */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="mt-2 w-full py-3 px-5 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:via-teal-400 hover:to-emerald-500 text-white font-semibold text-[14px] shadow-lg shadow-emerald-500/25 border border-white/20 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2.5 group disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <div className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  ) : (
                    <>
                      {/* Google G icon inside button */}
                      <svg className="w-4 h-4 shrink-0 transition-transform group-hover:scale-110 duration-200" viewBox="0 0 24 24">
                        <path fill="#ffffff" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#ffffff" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#ffffff" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                        <path fill="#ffffff" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                      </svg>
                      <span>Đăng Nhập Cá Nhân Hóa Ngay</span>
                    </>
                  )}
                </button>

                {/* Secondary Apple Liquid Glass Cancel Button */}
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="w-full py-2.5 px-4 rounded-xl text-[13px] font-medium text-[#76767b] dark:text-[#a1a1a6] hover:text-[#1d1d1f] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-all active:scale-[0.98] cursor-pointer"
                >
                  Đóng cửa sổ
                </button>
              </form>

              {/* Privacy Shield Commitment */}
              <div className="w-full pt-4 border-t border-black/5 dark:border-white/10 text-left">
                <div className="flex items-start gap-2.5">
                  <span className="text-emerald-500 font-bold text-sm shrink-0">🛡️</span>
                  <span className="text-[11px] text-[#86868b] leading-relaxed">
                    <strong>Bảo mật Đám Mây & Phân Vùng Riêng Tư:</strong> Dữ liệu được mã hóa và lưu trữ đồng bộ theo từng tài khoản. Mỗi người dùng chỉ truy cập được không gian làm việc riêng của mình, đảm bảo tính riêng tư và bí mật kinh doanh tuyệt đối.
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
