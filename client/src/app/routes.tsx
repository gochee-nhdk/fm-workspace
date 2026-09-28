import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { ErrorBoundary } from '@/components/ui';
import { NotFoundPage } from '@/components/ui/NotFoundPage';

// FM WORKSPACE Pages (Lazy-loaded for instantaneous initial boot)
const UnifiedWorkspacePage = React.lazy(() =>
  import('@/features/workspace/UnifiedWorkspacePage').then((m) => ({ default: m.UnifiedWorkspacePage }))
);
const SettingsPage = React.lazy(() =>
  import('@/features/settings/SettingsPage').then((m) => ({ default: m.SettingsPage }))
);

const PageFallback: React.FC = () => (
  <div className="flex-1 flex items-center justify-center min-h-[60vh]">
    <div className="liquid-glass-card rounded-2xl p-6 flex flex-col items-center gap-3 border border-white/20 dark:border-white/10 shadow-xl backdrop-blur-xl">
      <div className="w-8 h-8 rounded-full border-2 border-emerald-500/30 border-t-emerald-500 animate-spin" />
      <span className="text-xs font-medium text-slate-500 dark:text-neutral-400 tracking-wide">
        Đang tải không gian làm việc...
      </span>
    </div>
  </div>
);

export default function RoutesConfig() {
  return (
    <ErrorBoundary>
      <React.Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/" element={<AppShell />}>
            {/* Main Workspace (All-in-One Sheet View) */}
            <Route index element={<UnifiedWorkspacePage />} />

            {/* Unified Settings & Data Hub */}
            <Route path="settings" element={<SettingsPage />} />

            {/* Backward-compatible redirects */}
            <Route path="links" element={<Navigate to="/?tab=links" replace />} />
            <Route path="accounts" element={<Navigate to="/?tab=accounts" replace />} />
            <Route path="stores" element={<Navigate to="/?tab=stores" replace />} />
            <Route path="data-manager" element={<Navigate to="/settings" replace />} />

            {/* 404 Fallback within AppShell */}
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </React.Suspense>
    </ErrorBoundary>
  );
}