import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import postcss from 'postcss';

const liquiTailwind3Compatibility = {
  name: 'liqui-tailwind3-compatibility',
  enforce: 'pre' as const,
  transform(code: string, id: string) {
    if (!id.replaceAll('\\', '/').includes('/@liqui-design/glass/dist/glass.css')) return null;

    let transformed = code;
    return postcss([
      {
        postcssPlugin: 'unwrap-liqui-base-layer',
        Once(root) {
          root.walkAtRules('layer', (rule) => {
            if (rule.params.trim() === 'base') rule.replaceWith(...(rule.nodes ?? []));
          });
        },
      },
    ]).process(transformed, { from: id }).then((result) => ({ code: result.css, map: result.map?.toJSON() ?? null }));
  },
};

export default defineConfig({
  plugins: [liquiTailwind3Compatibility, react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') }
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy: { '/api': 'http://127.0.0.1:3000' }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-query': ['@tanstack/react-query', '@tanstack/react-table'],
          'vendor-excel': ['xlsx'],
          'vendor-excel-style': ['xlsx-js-style'],
          'vendor-charts': ['recharts'],
          'vendor-icons': ['lucide-react', 'sf-symbols-lib'],
          'vendor-forms': ['react-hook-form', '@hookform/resolvers', 'zod'],
          'vendor-utils': ['date-fns', 'clsx', 'tailwind-merge', 'zustand', 'axios'],
        }
      }
    },
    chunkSizeWarningLimit: 600
  }
});
