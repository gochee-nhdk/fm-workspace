import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Returns the absolute base directory for all persistent data storage (database, vaults, backups).
 * Prioritizes process.env.DATA_DIR (e.g. /var/data on Render persistent disk),
 * then falls back to DATABASE_PATH directory, then local data/ directory.
 */
export function getDataDir(): string {
  if (process.env.DATA_DIR && process.env.DATA_DIR.trim()) {
    const customDir = path.resolve(process.env.DATA_DIR.trim());
    if (!fs.existsSync(customDir)) {
      try {
        fs.mkdirSync(customDir, { recursive: true });
      } catch (err) {
        console.warn('Failed to ensure DATA_DIR exists:', err);
      }
    }
    return customDir;
  }

  if (process.env.DATABASE_PATH && process.env.DATABASE_PATH.trim()) {
    const dbParent = path.dirname(path.resolve(process.env.DATABASE_PATH.trim()));
    if (!fs.existsSync(dbParent)) {
      try {
        fs.mkdirSync(dbParent, { recursive: true });
      } catch (_) {}
    }
    return dbParent;
  }

  // Fallback for local development
  const rootDataDir = path.resolve(__dirname, '../../data');
  try {
    if (!fs.existsSync(rootDataDir)) {
      fs.mkdirSync(rootDataDir, { recursive: true });
    }
    return rootDataDir;
  } catch {
    const cwdDataDir = path.resolve(process.cwd(), 'data');
    if (!fs.existsSync(cwdDataDir)) {
      fs.mkdirSync(cwdDataDir, { recursive: true });
    }
    return cwdDataDir;
  }
}

/**
 * Returns the resolved path to the primary SQLite database file.
 */
export function getDatabasePath(): string {
  let dbFilePath: string;
  if (process.env.DATABASE_PATH && process.env.DATABASE_PATH.trim()) {
    dbFilePath = path.resolve(process.env.DATABASE_PATH.trim());
  } else if (process.env.DB_PATH && process.env.DB_PATH.trim()) {
    dbFilePath = path.resolve(process.env.DB_PATH.trim());
  } else {
    dbFilePath = path.join(getDataDir(), 'procurement.db');
  }

  const parentDir = path.dirname(dbFilePath);
  if (!fs.existsSync(parentDir)) {
    try {
      fs.mkdirSync(parentDir, { recursive: true });
    } catch (_) {}
  }

  return dbFilePath;
}

/**
 * Returns the directory for a specific user's file vault.
 */
export function getVaultDir(userId: string): string {
  const safeUserId = userId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const vaultPath = path.join(getDataDir(), 'vaults', safeUserId);
  if (!fs.existsSync(vaultPath)) {
    try {
      fs.mkdirSync(vaultPath, { recursive: true });
    } catch (err) {
      console.warn('Failed to ensure vault directory:', err);
    }
  }
  return vaultPath;
}

/**
 * Returns the directory for automated database backups and snapshots.
 */
export function getBackupDir(): string {
  const backupPath = path.join(getDataDir(), 'backups');
  if (!fs.existsSync(backupPath)) {
    try {
      fs.mkdirSync(backupPath, { recursive: true });
    } catch (err) {
      console.warn('Failed to ensure backup directory:', err);
    }
  }
  return backupPath;
}
