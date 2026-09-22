import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { Suspense } from 'react';
import RoutesConfig from './routes';
import { useUiStore } from '@/stores/ui-store';
import { useEffect } from 'react';

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
          position="top-right"
          toastOptions={{
            duration: 3000,
            style: {
              borderRadius: '12px',
              background: 'rgba(255,255,255,0.85)',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(0,0,0,0.08)',
              boxShadow: '0 4px 24px rgba(0,0,0,0.10)',
              color: '#1d1d1f',
              fontSize: '13.5px',
              fontWeight: 500,
            },
          }}
        />
      </BrowserRouter>
    </QueryClientProvider>
  );
}