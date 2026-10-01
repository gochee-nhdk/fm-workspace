import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import toast, { Toaster, resolveValue } from 'react-hot-toast';
import { Suspense, useEffect, useRef } from 'react';
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
 * and syncs the `dark` class on <html> with a smooth Apple crossfade transition.
 * Also reacts to OS preference changes in real-time so theme auto-updates when
 * user changes system setting.
 */
function ThemeSync() {
  const theme = useUiStore((state) => state.theme);
  const hasMountedRef = useRef(false);

  useEffect(() => {
    const applyTheme = () => {
      const resolved = resolveTheme(theme);
      const root = document.documentElement;
      const isCurrentlyDark = root.classList.contains('dark');
      const willBeDark = resolved === 'dark';

      // On initial mount, apply without triggering a transition jump
      if (!hasMountedRef.current) {
        hasMountedRef.current = true;
        if (willBeDark) {
          root.classList.add('dark');
        } else {
          root.classList.remove('dark');
        }
        return;
      }

      // Smooth Apple crossfade when switching modes
      if (isCurrentlyDark !== willBeDark) {
        root.classList.add('theme-transition');
        if (willBeDark) {
          root.classList.add('dark');
        } else {
          root.classList.remove('dark');
        }
        window.setTimeout(() => {
          root.classList.remove('theme-transition');
        }, 320);
      }
    };

    applyTheme();

    if (theme === 'auto_time') {
      const interval = setInterval(applyTheme, 30_000);
      return () => clearInterval(interval);
    }

    if (theme === 'system' && window.matchMedia) {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      mq.addEventListener('change', applyTheme);
      return () => mq.removeEventListener('change', applyTheme);
    }
  }, [theme]);

  return null;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ThemeSync />
        <Suspense fallback={null}>
          <RoutesConfig />
        </Suspense>
        <Toaster
          position="top-right"
          gutter={12}
          containerClassName="apple-toaster-container"
          containerStyle={{
            top: 76,
            right: 24,
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
            const resolvedMsg = resolveValue(t.message, t);
            const isCustomReactNode = typeof resolvedMsg !== 'string' && typeof resolvedMsg !== 'number';

            return (
              <div
                onClick={() => toast.dismiss(t.id)}
                className={`liquid-glass-macos27-toast group cursor-pointer select-none ${
                  t.visible ? 'apple-toast-enter' : 'apple-toast-exit pointer-events-none'
                }`}
              >
                {/* Refractive dynamic shimmer sweep across glass surface */}
                <div className="apple-toast-shimmer" />

                {isCustomReactNode ? (
                  // Custom Rich Notification (e.g. reminder alerts with actions)
                  <div className="z-10 w-full min-w-0">{resolvedMsg}</div>
                ) : (
                  // Standard Apple HUD Toast with Refractive Lens Glyph
                  <>
                    <div
                      className={`shrink-0 flex items-center justify-center w-6 h-6 rounded-full border transition-transform duration-200 group-hover:scale-110 ${
                        isSuccess
                          ? 'bg-gradient-to-b from-[#34c759] to-[#248a3d] text-white border-white/60 shadow-[0_2px_8px_rgba(52,199,89,0.45)]'
                          : isError
                          ? 'bg-gradient-to-b from-[#ff3b30] to-[#c71e14] text-white border-white/60 shadow-[0_2px_8px_rgba(255,59,48,0.45)]'
                          : isLoading
                          ? 'bg-gradient-to-b from-[#007aff] to-[#005bb5] text-white border-white/60 shadow-[0_2px_8px_rgba(0,122,255,0.45)]'
                          : 'bg-gradient-to-b from-[#0071e3] to-[#005bb5] text-white border-white/60 shadow-[0_2px_8px_rgba(0,113,227,0.45)]'
                      }`}
                    >
                      {isSuccess && <SFCheckmarkCircleFill size={15} />}
                      {isError && <SFExclamationmarkCircle size={15} />}
                      {isLoading && <SFArrowClockwise size={15} className="animate-spin" />}
                      {!isSuccess && !isError && !isLoading && <SFInfoCircle size={15} />}
                    </div>

                    {/* Apple Typography Message Label */}
                    <span className="text-[13px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-tight z-10 whitespace-nowrap truncate max-w-[360px]">
                      {resolvedMsg}
                    </span>
                  </>
                )}
              </div>
            );
          }}
        </Toaster>
      </BrowserRouter>
    </QueryClientProvider>
  );
}