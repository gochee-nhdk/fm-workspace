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
          position="top-center"
          gutter={10}
          containerStyle={{
            top: 22,
          }}
          toastOptions={{
            duration: 2500,
            className: 'apple-hud-toast',
            success: {
              duration: 2200,
              iconTheme: {
                primary: '#34c759',
                secondary: '#ffffff',
              },
            },
            error: {
              duration: 3500,
              iconTheme: {
                primary: '#ff3b30',
                secondary: '#ffffff',
              },
            },
          }}
        />
      </BrowserRouter>
    </QueryClientProvider>
  );
}