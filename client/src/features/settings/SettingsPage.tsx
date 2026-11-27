import React, { useState, useEffect, useCallback } from 'react';
import {
  SFGearshapeFill,
  SFPaintpalette,
  SFEnvelope,
  SFShieldFill,
  SFArchivebox,
  SFKey,
} from '@/components/ui/AppleIcon';
import { dataService } from '@/services/dataService';
import { backupService } from '@/services/backupService';
import { persistentStorage, StorageStatus } from '@/services/storage/persistentStorage';
import { autoBackupManager } from '@/services/autoBackupManager';
import { SegmentedNavigation } from '@/components/ui/SegmentedNavigation';
import { useDirectionalTab } from '@/lib/motion';
import { BackupTab, type WorkspaceCounts } from './components/BackupTab';
import { ShieldTab } from './components/ShieldTab';
import { SmtpTab } from './components/SmtpTab';
import { AiKeysTab } from './components/AiKeysTab';
import { AppearanceTab, ThemeSegmentedControl } from './components/AppearanceTab';

export { ThemeSegmentedControl };

const SETTINGS_TABS = ['backup', 'shield', 'smtp', 'ai', 'appearance'] as const;
type SettingsTab = (typeof SETTINGS_TABS)[number];

export const SettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('backup');
  const { animationClass, direction } = useDirectionalTab(activeTab, SETTINGS_TABS);

  const [counts, setCounts] = useState<WorkspaceCounts>({
    links: 0,
    accounts: 0,
    stores: 0,
    notes: 0,
    todos: 0,
    activities: 0,
  });
  const [storageBytes, setStorageBytes] = useState<number>(0);

  const [storageStatus, setStorageStatus] = useState<StorageStatus>({
    isPersisted: false,
    supported: false,
  });
  const [serverHistory, setServerHistory] = useState<any[]>([]);
  const [lastAutoBackupTime, setLastAutoBackupTime] = useState<Date | null>(
    autoBackupManager.getLastBackupTime()
  );
  const [isAutoSyncing, setIsAutoSyncing] = useState<boolean>(
    autoBackupManager.getIsSyncing()
  );

  const loadStats = useCallback(async () => {
    try {
      const summary = await dataService.getWorkspaceSummary();
      const acts = await dataService.getActivities(100);
      setCounts({
        links: summary.totalLinks,
        accounts: summary.totalAccounts,
        stores: summary.totalStores,
        notes: summary.totalNotes ?? 0,
        todos: summary.totalTodos ?? 0,
        activities: acts.length,
      });

      if (navigator.storage && navigator.storage.estimate) {
        const estimate = await navigator.storage.estimate();
        setStorageBytes(estimate.usage || 0);
      }
    } catch (err) {
      console.error('[SettingsPage] Failed to load workspace stats:', err);
    }
  }, []);

  const loadStorageAndSyncStatus = useCallback(async () => {
    try {
      const status = await persistentStorage.getStatus();
      setStorageStatus(status);
      const history = await backupService.getServerBackupHistory();
      setServerHistory(history);
    } catch (err) {
      console.warn('[SettingsPage] Failed to load storage/sync status:', err);
    }
  }, []);

  useEffect(() => {
    loadStats();
    loadStorageAndSyncStatus();

    const unsub = autoBackupManager.subscribe((time, syncing) => {
      setLastAutoBackupTime(time);
      setIsAutoSyncing(syncing);
      if (!syncing && time) {
        backupService
          .getServerBackupHistory()
          .then(setServerHistory)
          .catch((err) => console.warn('[SettingsPage] Failed to refresh backup history:', err));
      }
    });
    return unsub;
  }, [loadStats, loadStorageAndSyncStatus]);

  return (
    <div className="w-full pb-[calc(env(safe-area-inset-bottom,0px)+5.5rem)]">
      <div className="sticky-liquid-header -mx-4 sm:-mx-5 lg:-mx-6 px-4 sm:px-5 lg:px-6 pt-4 sm:pt-5 lg:pt-6 pb-3.5 space-y-3.5 transition-[transform,opacity,background-color,border-color,color,box-shadow]">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-[24px] sm:text-[28px] font-semibold tracking-tight text-[#1d1d1f] dark:text-white flex items-center gap-2.5">
            <SFGearshapeFill size={24} className="text-[#0066cc] dark:text-[#2997ff]" />
            Cài đặt &amp; Dữ liệu
          </h1>
        </div>

        <div className="max-w-4xl mx-auto flex items-center justify-start overflow-x-auto pb-1 scrollbar-none touch-pan-x w-full">
          <SegmentedNavigation
            label="Cài đặt hệ thống"
            activeId={activeTab}
            onChange={(tab) => setActiveTab(tab as SettingsTab)}
            items={[
              { id: 'backup', label: 'Sao lưu', icon: <SFArchivebox size={15} /> },
              { id: 'shield', label: 'Bảo mật', icon: <SFShieldFill size={15} /> },
              { id: 'smtp', label: 'Gửi mail', icon: <SFEnvelope size={15} /> },
              { id: 'ai', label: 'API Key', icon: <SFKey size={15} /> },
              { id: 'appearance', label: 'Giao Diện', icon: <SFPaintpalette size={15} /> },
            ]}
          />
        </div>
      </div>

      <div className="max-w-4xl mx-auto mt-6">
        <div className="relative">
          <div
            key={activeTab === 'backup' ? `tab-backup-${direction}` : 'tab-backup-off'}
            className={activeTab === 'backup' ? `${animationClass} block` : 'hidden'}
          >
            <BackupTab
              counts={counts}
              storageBytes={storageBytes}
              onRefreshStats={loadStats}
              onRefreshSyncStatus={loadStorageAndSyncStatus}
            />
          </div>

          <div
            key={activeTab === 'shield' ? `tab-shield-${direction}` : 'tab-shield-off'}
            className={activeTab === 'shield' ? `${animationClass} block` : 'hidden'}
          >
            <ShieldTab
              storageStatus={storageStatus}
              serverHistory={serverHistory}
              lastAutoBackupTime={lastAutoBackupTime}
              isAutoSyncing={isAutoSyncing}
              onRefreshStats={loadStats}
              onRefreshSyncStatus={loadStorageAndSyncStatus}
            />
          </div>

          <div
            key={activeTab === 'smtp' ? `tab-smtp-${direction}` : 'tab-smtp-off'}
            className={activeTab === 'smtp' ? `${animationClass} block` : 'hidden'}
          >
            <SmtpTab />
          </div>

          <div
            key={activeTab === 'ai' ? `tab-ai-${direction}` : 'tab-ai-off'}
            className={activeTab === 'ai' ? `${animationClass} block` : 'hidden'}
          >
            <AiKeysTab />
          </div>

          <div
            key={activeTab === 'appearance' ? `tab-appearance-${direction}` : 'tab-appearance-off'}
            className={activeTab === 'appearance' ? `${animationClass} block` : 'hidden'}
          >
            <AppearanceTab />
          </div>
        </div>
      </div>
    </div>
  );
};
