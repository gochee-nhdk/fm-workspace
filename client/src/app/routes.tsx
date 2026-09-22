import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { ErrorBoundary } from '@/components/ui';

// FM WORKSPACE Pages (Ultra-Simplified Architecture)
import { UnifiedWorkspacePage } from '@/features/workspace/UnifiedWorkspacePage';
import { SettingsPage } from '@/features/settings/SettingsPage';

export default function RoutesConfig() {
  return (
    <ErrorBoundary>
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
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ErrorBoundary>
  );
}