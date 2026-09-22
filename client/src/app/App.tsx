import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { Toaster, resolveValue } from 'react-hot-toast';
import { Suspense, useEffect } from 'react';
import { Check, AlertCircle, Loader2, Info } from 'lucide-react';
import RoutesConfig from './routes';
import { useUiStore } from '@/stores/ui-store';

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

function ThemeSync() {
  const theme = useUiStore((state) => state.theme);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
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
          position="bottom-center"
          gutter={12}
          containerClassName="apple-toaster-container"
          containerStyle={{
            bottom: 32,
          }}
          toastOptions={{
            duration: 2400,
          }}
        >
          {(t) => {
            const isSuccess = t.type === 'success';
            const isError = t.type === 'error';
            const isLoading = t.type === 'loading';

            return (
              <div
                className="liquid-glass-macos27-toast group"
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
                  {isSuccess && <Check className="w-3.5 h-3.5 stroke-[2.8]" />}
                  {isError && <AlertCircle className="w-3.5 h-3.5 stroke-[2.5]" />}
                  {isLoading && <Loader2 className="w-3.5 h-3.5 stroke-[2.5] animate-spin" />}
                  {!isSuccess && !isError && !isLoading && <Info className="w-3.5 h-3.5 stroke-[2.5]" />}
                </div>

                {/* Apple Typography Message Label */}
                <span className="text-[13px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-tight whitespace-nowrap z-10">
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