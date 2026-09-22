import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { ErrorBoundary } from '@/components/ui';

// FM WORKSPACE Pages
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { QuickLinksPage } from '@/features/links/QuickLinksPage';
import { AccountsPage } from '@/features/accounts/AccountsPage';
import { StoresPage } from '@/features/stores/StoresPage';
import { DataManagerPage } from '@/features/data/DataManagerPage';
import { SettingsPage } from '@/features/settings/SettingsPage';

export default function RoutesConfig() {
  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/" element={<AppShell />}>
          <Route index element={<DashboardPage />} />
          <Route path="links" element={<QuickLinksPage />} />
          <Route path="accounts" element={<AccountsPage />} />
          <Route path="stores" element={<StoresPage />} />
          <Route path="data-manager" element={<DataManagerPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ErrorBoundary>
  );
}