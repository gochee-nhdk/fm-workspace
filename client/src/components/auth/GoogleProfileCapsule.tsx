import React, { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import toast from 'react-hot-toast';
import { CloseButton } from '@/components/ui/close-button';

declare global {
  interface Window {
    google?: any;
  }
}

export const GoogleProfileCapsule: React.FC = () => {
  const { user, loginWithGoogle, logout, isAuthenticated } = useAuthStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // Initialize Google Identity Services SDK dynamically
  useEffect(() => {
    if (!modalOpen) return;

    const scriptId = 'google-gsi-client';
    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => initGsi();
      document.body.appendChild(script);
    } else {
      initGsi();
    }

    function initGsi() {
      if (window.google?.accounts?.id) {
        try {
          window.google.accounts.id.initialize({
            client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID || '108422477382-fm-workspace.apps.googleusercontent.com',
            callback: async (response: any) => {
              if (response.credential) {
                try {
                  await loginWithGoogle(response.credential);
                  toast.success('Đăng nhập tài khoản Google thành công!');
                  setModalOpen(false);
                } catch (err: any) {
                  toast.error(err?.response?.data?.error || 'Đăng nhập Google thất bại');
                }
              }
            },
            auto_select: false,
          });

          const btnContainer = document.getElementById('google-signin-btn-container');
          if (btnContainer) {
            btnContainer.innerHTML = '';
            window.google.accounts.id.renderButton(btnContainer, {
              theme: 'outline',
              size: 'large',
              type: 'standard',
              shape: 'pill',
              text: 'signin_with',
              logo_alignment: 'left',
              width: 280,
            });
          }
        } catch (_) {}
      }
    }
  }, [modalOpen, loginWithGoogle]);

  const isGoogleUser = Boolean(user?.google_id || user?.avatar_url);

  return (
    <>
      {isGoogleUser ? (
        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-full bg-white/70 dark:bg-white/10 hover:bg-white/90 dark:hover:bg-white/15 border border-black/10 dark:border-white/15 shadow-xs transition-all active:scale-98 cursor-pointer"
            title={`Tài khoản Google: ${user?.email}`}
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
              <span className="text-[12px] font-semibold text-[#1d1d1f] dark:text-white leading-tight max-w-[100px] truncate">
                {user?.full_name || user?.email?.split('@')[0]}
              </span>
              <span className="text-[9.5px] font-medium text-emerald-600 dark:text-emerald-400 leading-none flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
                Google ID
              </span>
            </div>
          </button>

          {/* Account Popover Menu */}
          {menuOpen && (
            <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-white/90 dark:bg-[#1c1c1e]/95 backdrop-blur-xl border border-black/10 dark:border-white/15 shadow-2xl p-3 z-50 animate-in fade-in zoom-in-95 duration-150">
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
                🔒 Không gian dữ liệu được cá nhân hoá và mã hóa cục bộ cho tài khoản này.
              </div>

              <div className="pt-2 border-t border-black/5 dark:border-white/10 flex flex-col gap-1.5">
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    setModalOpen(true);
                  }}
                  className="w-full text-left px-3 py-1.5 rounded-lg text-[12px] text-[#1d1d1f] dark:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                >
                  🔄 Đổi tài khoản Google khác
                </button>
                <button
                  onClick={() => {
                    logout();
                    setMenuOpen(false);
                    toast.success('Đã đăng xuất');
                  }}
                  className="w-full text-left px-3 py-1.5 rounded-lg text-[12px] text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-colors"
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
          title="Đăng nhập tài khoản Google"
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

      {/* Google Sign-In Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-sm rounded-3xl bg-white/95 dark:bg-[#1c1c1e]/95 backdrop-blur-2xl border border-black/10 dark:border-white/15 p-6 shadow-2xl flex flex-col items-center text-center">
            <div className="absolute top-4 right-4">
              <CloseButton onClick={() => setModalOpen(false)} aria-label="Đóng" size="sm" />
            </div>

            {/* Google Icon Badge */}
            <div className="w-14 h-14 rounded-2xl bg-white dark:bg-white/10 shadow-lg border border-black/10 dark:border-white/15 flex items-center justify-center mb-4">
              <svg className="w-7 h-7" viewBox="0 0 24 24">
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

            <h3 className="text-[18px] font-bold text-[#1d1d1f] dark:text-white tracking-tight mb-1.5">
              Đăng nhập với Google
            </h3>
            <p className="text-[12.5px] text-[#86868b] leading-relaxed mb-6 max-w-[260px]">
              Cá nhân hoá không gian làm việc, đồng bộ ảnh đại diện và bảo vệ dữ liệu riêng tư của bạn.
            </p>

            {/* Google Rendered Button Container */}
            <div id="google-signin-btn-container" className="min-h-[44px] flex items-center justify-center mb-5 w-full">
              <div className="text-xs text-[#86868b] animate-pulse">Đang nạp dịch vụ Google...</div>
            </div>

            <div className="w-full pt-4 border-t border-black/5 dark:border-white/10 text-left">
              <div className="flex items-start gap-2.5">
                <span className="text-emerald-500 font-bold text-sm shrink-0">🛡️</span>
                <span className="text-[11px] text-[#86868b] leading-relaxed">
                  <strong>Cam kết bảo mật:</strong> Dữ liệu SQLite hoàn toàn lưu tại máy cá nhân. Ứng dụng chỉ đọc email và ảnh đại diện để cá nhân hoá tài khoản, tuyệt đối không gửi dữ liệu nội bộ lên máy chủ đám mây.
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
