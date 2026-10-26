import { createDatabaseAdapter } from './adapter.js';
import type { IDatabaseAdapter, PreparedStatement, RunResult } from './adapter.js';

export type { IDatabaseAdapter, PreparedStatement, RunResult };

let dbInstance: IDatabaseAdapter | null = null;

export function getDb(): IDatabaseAdapter {
  if (!dbInstance) {
    dbInstance = createDatabaseAdapter();
  }
  return dbInstance;
}

export function setDb(adapter: IDatabaseAdapter | null): void {
  dbInstance = adapter;
}

export async function closeDb(): Promise<void> {
  if (dbInstance) {
    await dbInstance.close();
    dbInstance = null;
  }
}

// Graceful shutdown handlers
process.on('exit', () => {
  if (dbInstance) {
    dbInstance.close().catch(() => {});
  }
});
process.on('SIGHUP', () => process.exit(128 + 1));
process.on('SIGINT', () => process.exit(128 + 2));
process.on('SIGTERM', () => process.exit(128 + 15));
