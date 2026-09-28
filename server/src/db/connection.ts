import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getDatabaseFilePath(): string {
  if (process.env.DATABASE_PATH) return process.env.DATABASE_PATH;
  if (process.env.DB_PATH) return process.env.DB_PATH;
  
  const rootDataDir = path.resolve(__dirname, '../../data');
  try {
    if (!fs.existsSync(rootDataDir)) {
      fs.mkdirSync(rootDataDir, { recursive: true });
    }
    return path.join(rootDataDir, 'procurement.db');
  } catch {
    const cwdDataDir = path.resolve(process.cwd(), 'data');
    if (!fs.existsSync(cwdDataDir)) {
      fs.mkdirSync(cwdDataDir, { recursive: true });
    }
    return path.join(cwdDataDir, 'procurement.db');
  }
}

const dbPath = getDatabaseFilePath();

let dbInstance: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!dbInstance) {
    dbInstance = new Database(dbPath, {
      verbose: process.env.NODE_ENV === 'development' ? console.log : undefined,
    });
    
    // Enable WAL mode and performance pragmas
    dbInstance.pragma('journal_mode = WAL');
    dbInstance.pragma('foreign_keys = ON');
    dbInstance.pragma('synchronous = NORMAL');
    dbInstance.pragma('cache_size = -64000'); // 64MB memory page cache
    
    // Configure busy timeout
    dbInstance.pragma('busy_timeout = 5000');
  }
  return dbInstance;
}

export function closeDb(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

// Graceful shutdown
process.on('exit', () => closeDb());
process.on('SIGHUP', () => process.exit(128 + 1));
process.on('SIGINT', () => process.exit(128 + 2));
process.on('SIGTERM', () => process.exit(128 + 15));
