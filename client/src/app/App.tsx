import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import toast, { Toaster, resolveValue, useToasterStore } from 'react-hot-toast';
import { Suspense, useEffect } from 'react';
import { SFCheckmarkCircleFill, SFExclamationmarkCircle, SFInfoCircle, SFArrowClockwise } from 'sf-symbols-lib';
import RoutesConfig from './routes';
import { useUiStore, resolveTheme } from '@/stores/ui-store';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000,        // 30s — avoid redundant refetches
      gcTime: 5 * 60_000,      // 5min garbage collection
    },
  },
});

/**
 * ThemeSync — listens to the store theme, resolves system/auto preference,
 * and syncs the `dark` class on <html>. Also reacts to OS preference changes
 * in real-time so theme auto-updates when user changes system setting.
 */
function ThemeSync() {
  const theme = useUiStore((state) => state.theme);

  useEffect(() => {
    const applyTheme = () => {
      const resolved = resolveTheme(theme);
      const root = document.documentElement;
      if (resolved === 'dark') {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    };

    applyTheme();

    // For 'auto_time' mode: check every 30 seconds to react immediately to time transitions
    if (theme === 'auto_time') {
      const interval = setInterval(applyTheme, 30_000);
      return () => clearInterval(interval);
    }

    // For 'system' mode: listen to OS dark/light preference changes in real-time
    if (theme === 'system' && window.matchMedia) {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      mq.addEventListener('change', applyTheme);
      return () => mq.removeEventListener('change', applyTheme);
    }
  }, [theme]);

  return null;
}

/**
 * Ensures only 1 toast is visible at any given moment, strictly mirroring Apple's HUD/Dynamic Island UX
 * and preventing any overlapping toast popups.
 */
function ToastLimiter() {
  const { toasts } = useToasterStore();

  useEffect(() => {
    toasts
      .filter((t) => t.visible)
      .filter((_, i) => i >= 1)
      .forEach((t) => toast.dismiss(t.id));
  }, [toasts]);

  return null;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ThemeSync />
        <ToastLimiter />
        <Suspense fallback={null}>
          <RoutesConfig />
        </Suspense>
        <Toaster
          position="top-right"
          gutter={12}
          containerClassName="apple-toaster-container"
          containerStyle={{
            top: 24,
            right: 24,
            left: 'auto',
            bottom: 'auto',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            pointerEvents: 'none',
            zIndex: 99999,
          }}
          toastOptions={{
            duration: 2500,
          }}
        >
          {(t) => {
            const isSuccess = t.type === 'success';
            const isError = t.type === 'error';
            const isLoading = t.type === 'loading';

            return (
              <div
                onClick={() => toast.dismiss(t.id)}
                className={`liquid-glass-macos27-toast group transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] cursor-pointer ${
                  t.visible
                    ? 'opacity-100 scale-100 translate-y-0'
                    : 'opacity-0 scale-90 -translate-y-3 pointer-events-none'
                }`}
                style={{
                  ...t.style,
                }}
              >
                {/* Refractive dynamic shimmer sweep across glass surface */}
                <div className="apple-toast-shimmer" />

                {/* 3D Apple Refractive Status Lens Glyph */}
                <div
                  className={`shrink-0 flex items-center justify-center w-6 h-6 rounded-full border transition-transform duration-200 group-hover:scale-110 ${
                    isSuccess
                      ? 'bg-gradient-to-b from-[#34c759] to-[#248a3d] text-white border-white/60 shadow-[0_2px_8px_rgba(52,199,89,0.5)]'
                      : isError
                      ? 'bg-gradient-to-b from-[#ff3b30] to-[#c71e14] text-white border-white/60 shadow-[0_2px_8px_rgba(255,59,48,0.5)]'
                      : isLoading
                      ? 'bg-gradient-to-b from-[#007aff] to-[#005bb5] text-white border-white/60 shadow-[0_2px_8px_rgba(0,122,255,0.5)]'
                      : 'bg-gradient-to-b from-[#5856d6] to-[#3634a3] text-white border-white/60 shadow-[0_2px_8px_rgba(88,86,214,0.5)]'
                  }`}
                >
                  {isSuccess && <SFCheckmarkCircleFill size={15} />}
                  {isError && <SFExclamationmarkCircle size={15} />}
                  {isLoading && <SFArrowClockwise size={15} className="animate-spin" />}
                  {!isSuccess && !isError && !isLoading && <SFInfoCircle size={15} />}
                </div>

                {/* Apple Typography Message Label */}
                <span className="text-[13px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-tight z-10 break-words line-clamp-2 text-center sm:text-left">
                  {resolveValue(t.message, t)}
                </span>
              </div>
            );
          }}
        </Toaster>
      </BrowserRouter>
    </QueryClientProvider>
  );
}