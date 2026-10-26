import fs from 'fs';
import path from 'path';
import { getDb } from '../db/connection.js';
import { getBackupDir, getDatabasePath } from '../config/paths.js';

const MAX_SNAPSHOTS = 10;
const SNAPSHOT_INTERVAL_MS = 30 * 60 * 1000; // Every 30 minutes

let intervalTimer: NodeJS.Timeout | null = null;
let isBackingUp = false;

function ensureBackupDir(): string {
  return getBackupDir();
}

/**
 * Perform a live, non-blocking online SQLite backup to disk.
 * In remote Turso mode, cloud backups and remote user_workspace_backups are active.
 */
export async function takeDatabaseSnapshot(label = 'periodic'): Promise<string | null> {
  if (isBackingUp) return null;
  isBackingUp = true;

  try {
    const db = getDb();

    // In hosted / remote Turso mode, local file snapshots are not applicable
    if (db.isRemote()) {
      return 'remote:turso';
    }

    const dir = ensureBackupDir();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `procurement_auto_${timestamp}_${label}.db`;
    const destPath = path.join(dir, filename);

    // Checkpoint WAL pages into main DB file safely
    try {
      await db.pragma('wal_checkpoint(PASSIVE)');
    } catch (_) {}

    const sourcePath = getDatabasePath();
    if (fs.existsSync(sourcePath)) {
      fs.copyFileSync(sourcePath, destPath);
    }

    // Rotate and prune old database snapshots keeping the newest MAX_SNAPSHOTS
    cleanOldSnapshots(dir);

    return destPath;
  } catch (err) {
    console.warn('[DB AutoBackup] Failed to take database snapshot:', err);
    return null;
  } finally {
    isBackingUp = false;
  }
}

/**
 * Remove older database snapshots beyond the retention threshold
 */
function cleanOldSnapshots(dir: string): void {
  try {
    const files = fs.readdirSync(dir)
      .filter((f) => f.startsWith('procurement_auto_') && f.endsWith('.db'))
      .map((f) => {
        const fullPath = path.join(dir, f);
        const stats = fs.statSync(fullPath);
        return { name: f, path: fullPath, mtime: stats.mtimeMs };
      })
      .sort((a, b) => b.mtime - a.mtime);

    if (files.length > MAX_SNAPSHOTS) {
      const toDelete = files.slice(MAX_SNAPSHOTS);
      for (const item of toDelete) {
        try {
          fs.unlinkSync(item.path);
        } catch (_) {}
      }
    }
  } catch (err) {
    console.warn('[DB AutoBackup] Error pruning old snapshots:', err);
  }
}

/**
 * List available database snapshots
 */
export function listDatabaseSnapshots(): Array<{ filename: string; sizeBytes: number; createdAt: string }> {
  try {
    const dir = ensureBackupDir();
    return fs.readdirSync(dir)
      .filter((f) => f.startsWith('procurement_auto_') && f.endsWith('.db'))
      .map((f) => {
        const fullPath = path.join(dir, f);
        const stats = fs.statSync(fullPath);
        return {
          filename: f,
          sizeBytes: stats.size,
          createdAt: new Date(stats.mtimeMs).toISOString(),
        };
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch {
    return [];
  }
}

/**
 * Start background automatic database snapshot engine
 */
export function startDbAutoBackup(): void {
  const db = getDb();
  if (db.isRemote()) {
    console.log('[DB AutoBackup] Turso Cloud database detected. Remote durability active, disk snapshots bypassed.');
    return;
  }

  if (intervalTimer) return;

  // 1. Initial snapshot after 5 seconds
  setTimeout(() => {
    takeDatabaseSnapshot('startup').catch(() => {});
  }, 5000);

  // 2. Continuous periodic snapshot every 30 minutes
  intervalTimer = setInterval(() => {
    takeDatabaseSnapshot('periodic').catch(() => {});
  }, SNAPSHOT_INTERVAL_MS);
}

/**
 * Stop background timer and take graceful shutdown snapshot
 */
export async function stopDbAutoBackup(): Promise<void> {
  if (intervalTimer) {
    clearInterval(intervalTimer);
    intervalTimer = null;
  }
  try {
    await takeDatabaseSnapshot('shutdown');
  } catch (_) {}
}
