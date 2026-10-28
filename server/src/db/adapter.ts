import { createClient, Client, Transaction } from '@libsql/client';
import Database from 'better-sqlite3';
import { getDatabasePath } from '../config/paths.js';

export interface RunResult {
  changes: number;
  lastInsertRowid: number;
}

export interface PreparedStatement {
  get<T = any>(...args: any[]): Promise<T | undefined>;
  all<T = any>(...args: any[]): Promise<T[]>;
  run(...args: any[]): Promise<RunResult>;
}

export interface IDatabaseAdapter {
  get<T = any>(sql: string, ...args: any[]): Promise<T | undefined>;
  all<T = any>(sql: string, ...args: any[]): Promise<T[]>;
  run(sql: string, ...args: any[]): Promise<RunResult>;
  exec(sql: string): Promise<void>;
  pragma(sql: string): Promise<any[]>;
  prepare(sql: string): PreparedStatement;
  transaction<T>(fn: (tx: IDatabaseAdapter) => Promise<T>): Promise<T>;
  close(): Promise<void>;
  isRemote(): boolean;
  execute(query: { sql: string; args?: any } | string): Promise<any>;
}

function normalizeArgs(args?: any[]): any[] | Record<string, any> {
  if (!args || args.length === 0) return [];
  if (args.length === 1 && Array.isArray(args[0])) {
    return args[0];
  }
  return args;
}

/**
 * LibSQL / Turso Database Adapter
 * Implements IDatabaseAdapter using the official @libsql/client.
 * Works seamlessly with Turso Cloud (libsql://) and local SQLite files (file:).
 */
export class LibsqlAdapter implements IDatabaseAdapter {
  private client: Client;
  private remote: boolean;

  constructor(client: Client, isRemote = false) {
    this.client = client;
    this.remote = isRemote;
  }

  isRemote(): boolean {
    return this.remote;
  }

  async get<T = any>(sql: string, ...args: any[]): Promise<T | undefined> {
    const norm = normalizeArgs(args);
    const res = await this.client.execute({ sql, args: norm });
    return (res.rows[0] as unknown as T) || undefined;
  }

  async all<T = any>(sql: string, ...args: any[]): Promise<T[]> {
    const norm = normalizeArgs(args);
    const res = await this.client.execute({ sql, args: norm });
    return res.rows as unknown as T[];
  }

  async run(sql: string, ...args: any[]): Promise<RunResult> {
    const norm = normalizeArgs(args);
    const res = await this.client.execute({ sql, args: norm });
    return {
      changes: res.rowsAffected || 0,
      lastInsertRowid: typeof res.lastInsertRowid === 'bigint' ? Number(res.lastInsertRowid) : (res.lastInsertRowid || 0),
    };
  }

  async exec(sql: string): Promise<void> {
    await this.client.executeMultiple(sql);
  }

  async pragma(sql: string): Promise<any[]> {
    const fullSql = sql.trim().toLowerCase().startsWith('pragma ') ? sql : `PRAGMA ${sql}`;
    const res = await this.client.execute(fullSql);
    return res.rows as any[];
  }

  prepare(sql: string): PreparedStatement {
    return {
      get: <T = any>(...args: any[]) => this.get<T>(sql, ...args),
      all: <T = any>(...args: any[]) => this.all<T>(sql, ...args),
      run: (...args: any[]) => this.run(sql, ...args),
    };
  }

  async transaction<T>(fn: (tx: IDatabaseAdapter) => Promise<T>): Promise<T> {
    const tx = await this.client.transaction('write');
    const txAdapter = new LibsqlTransactionAdapter(tx, this.remote);
    try {
      const result = await fn(txAdapter);
      await tx.commit();
      return result;
    } catch (err) {
      try {
        await tx.rollback();
      } catch (_) {}
      throw err;
    }
  }

  async execute(query: { sql: string; args?: any } | string): Promise<any> {
    return await this.client.execute(query);
  }

  async close(): Promise<void> {
    await this.client.close();
  }
}

class LibsqlTransactionAdapter implements IDatabaseAdapter {
  private tx: Transaction;
  private remote: boolean;

  constructor(tx: Transaction, isRemote: boolean) {
    this.tx = tx;
    this.remote = isRemote;
  }

  isRemote(): boolean {
    return this.remote;
  }

  async get<T = any>(sql: string, ...args: any[]): Promise<T | undefined> {
    const norm = normalizeArgs(args);
    const res = await this.tx.execute({ sql, args: norm });
    return (res.rows[0] as unknown as T) || undefined;
  }

  async all<T = any>(sql: string, ...args: any[]): Promise<T[]> {
    const norm = normalizeArgs(args);
    const res = await this.tx.execute({ sql, args: norm });
    return res.rows as unknown as T[];
  }

  async run(sql: string, ...args: any[]): Promise<RunResult> {
    const norm = normalizeArgs(args);
    const res = await this.tx.execute({ sql, args: norm });
    return {
      changes: res.rowsAffected || 0,
      lastInsertRowid: typeof res.lastInsertRowid === 'bigint' ? Number(res.lastInsertRowid) : (res.lastInsertRowid || 0),
    };
  }

  async exec(sql: string): Promise<void> {
    await this.tx.execute(sql);
  }

  async pragma(sql: string): Promise<any[]> {
    const fullSql = sql.trim().toLowerCase().startsWith('pragma ') ? sql : `PRAGMA ${sql}`;
    const res = await this.tx.execute(fullSql);
    return res.rows as any[];
  }

  prepare(sql: string): PreparedStatement {
    return {
      get: <T = any>(...args: any[]) => this.get<T>(sql, ...args),
      all: <T = any>(...args: any[]) => this.all<T>(sql, ...args),
      run: (...args: any[]) => this.run(sql, ...args),
    };
  }

  async transaction<T>(fn: (tx: IDatabaseAdapter) => Promise<T>): Promise<T> {
    // Nested transactions execute on the same transaction context
    return await fn(this);
  }

  async execute(query: { sql: string; args?: any } | string): Promise<any> {
    return await this.tx.execute(query);
  }

  async close(): Promise<void> {
    // No-op for individual transaction handles
  }
}

/**
 * BetterSqlite Adapter
 * Implements IDatabaseAdapter using better-sqlite3 for desktop/embedded setups.
 */
export class BetterSqliteAdapter implements IDatabaseAdapter {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  isRemote(): boolean {
    return false;
  }

  async get<T = any>(sql: string, ...args: any[]): Promise<T | undefined> {
    const norm = normalizeArgs(args);
    const row = Array.isArray(norm) ? this.db.prepare(sql).get(...norm) : this.db.prepare(sql).get(norm);
    return (row as unknown as T) || undefined;
  }

  async all<T = any>(sql: string, ...args: any[]): Promise<T[]> {
    const norm = normalizeArgs(args);
    const rows = Array.isArray(norm) ? this.db.prepare(sql).all(...norm) : this.db.prepare(sql).all(norm);
    return rows as unknown as T[];
  }

  async run(sql: string, ...args: any[]): Promise<RunResult> {
    const norm = normalizeArgs(args);
    const info = Array.isArray(norm) ? this.db.prepare(sql).run(...norm) : this.db.prepare(sql).run(norm);
    return {
      changes: Number(info.changes || 0),
      lastInsertRowid: Number(info.lastInsertRowid || 0),
    };
  }

  async exec(sql: string): Promise<void> {
    this.db.exec(sql);
  }

  async pragma(sql: string): Promise<any[]> {
    const fullSql = sql.trim().toLowerCase().startsWith('pragma ') ? sql : `PRAGMA ${sql}`;
    return this.db.prepare(fullSql).all() as any[];
  }

  prepare(sql: string): PreparedStatement {
    return {
      get: <T = any>(...args: any[]) => this.get<T>(sql, ...args),
      all: <T = any>(...args: any[]) => this.all<T>(sql, ...args),
      run: (...args: any[]) => this.run(sql, ...args),
    };
  }

  async transaction<T>(fn: (tx: IDatabaseAdapter) => Promise<T>): Promise<T> {
    // Execute inside better-sqlite3 transaction boundary
    const tx = this.db.transaction((action: () => Promise<T>) => action());
    return await tx(() => fn(this));
  }

  async execute(query: { sql: string; args?: any } | string): Promise<any> {
    if (typeof query === 'string') {
      return this.db.prepare(query).all();
    }
    const norm = normalizeArgs(query.args);
    return Array.isArray(norm) ? this.db.prepare(query.sql).all(...norm) : this.db.prepare(query.sql).all(norm);
  }

  async close(): Promise<void> {
    this.db.close();
  }
}

/**
 * Factory function to create and configure the active IDatabaseAdapter
 */
export function createDatabaseAdapter(): IDatabaseAdapter {
  const tursoUrl = process.env.TURSO_DATABASE_URL?.trim();
  const tursoAuthToken = process.env.TURSO_AUTH_TOKEN?.trim();

  // Fail-closed guard: Hosted production environment MUST NOT silently fall back to local disk
  const isHosted = process.env.RENDER === 'true' || 
                   process.env.HOSTED === 'true' || 
                   (process.env.NODE_ENV === 'production' && !process.env.ELECTRON_RUN && !process.env.LOCAL_DEV);

  if (isHosted && !tursoUrl) {
    throw new Error('[Database] FATAL: TURSO_DATABASE_URL must be configured in hosted production environment. Refusing to fall back to ephemeral disk SQLite.');
  }

  // 1. Hosted Mode (Turso Cloud)
  if (tursoUrl) {
    if (!tursoAuthToken && !tursoUrl.startsWith('file:')) {
      console.warn('⚠️ [TURSO] TURSO_DATABASE_URL is configured without TURSO_AUTH_TOKEN.');
    }
    const maskedUrl = tursoUrl.replace(/:\/\/.*@/, '://***@').slice(0, 40) + '...';
    console.log(`[Database] Initializing Turso Cloud libSQL adapter (${maskedUrl})`);

    const client = createClient({
      url: tursoUrl,
      authToken: tursoAuthToken,
    });
    return new LibsqlAdapter(client, true);
  }

  // 2. Desktop / Local Offline Mode
  const localDbPath = getDatabasePath();
  const useBetterSqlite = process.env.DB_ENGINE === 'better-sqlite3';

  if (useBetterSqlite) {
    console.log(`[Database] Initializing native better-sqlite3 adapter (${localDbPath})`);
    const db = new Database(localDbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    db.pragma('synchronous = NORMAL');
    return new BetterSqliteAdapter(db);
  }

  console.log(`[Database] Initializing local file libSQL adapter (${localDbPath})`);
  const client = createClient({
    url: `file:${localDbPath}`,
  });
  return new LibsqlAdapter(client, false);
}
