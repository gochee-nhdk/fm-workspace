const { createClient } = require('@libsql/client');
const os = require('os');
const path = require('path');

let dbClient = null;
let schemaReadyPromise = null;

function isHostedEnvironment() {
  return (
    process.env.VERCEL === '1' ||
    Boolean(process.env.VERCEL_ENV) ||
    process.env.HOSTED === 'true' ||
    (process.env.NODE_ENV === 'production' && !process.env.LOCAL_DEV && !process.env.ELECTRON_RUN)
  );
}

function getDbMode() {
  const tursoUrl = process.env.TURSO_DATABASE_URL?.trim();
  if (tursoUrl && !tursoUrl.startsWith('file:')) {
    return 'turso';
  }
  return 'local';
}

function getDbClient() {
  if (dbClient) return dbClient;

  const tursoUrl = process.env.TURSO_DATABASE_URL?.trim();
  const tursoAuthToken = process.env.TURSO_AUTH_TOKEN?.trim();
  const hosted = isHostedEnvironment();

  if (hosted && !tursoUrl) {
    throw new Error(
      '[Database] TURSO_DATABASE_URL must be configured in hosted Vercel environment.'
    );
  }

  if (tursoUrl) {
    dbClient = createClient({
      url: tursoUrl,
      authToken: tursoAuthToken || undefined,
    });
    return dbClient;
  }

  // Graceful local-dev-only SQLite file fallback
  const localPath = path.join(os.tmpdir(), 'fm-workspace-local-dev.db');
  dbClient = createClient({
    url: `file:${localPath}`,
  });
  return dbClient;
}

async function ensureSchema() {
  if (schemaReadyPromise) return schemaReadyPromise;

  schemaReadyPromise = (async () => {
    const client = getDbClient();
    await client.executeMultiple(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        full_name TEXT NOT NULL,
        password_hash TEXT,
        role TEXT NOT NULL DEFAULT 'staff',
        google_id TEXT,
        avatar_url TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS revoked_tokens (
        token_hash TEXT PRIMARY KEY,
        user_id TEXT,
        expires_at TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS user_settings (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        setting_key TEXT NOT NULL,
        encrypted_value TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(user_id, setting_key)
      );

      CREATE TABLE IF NOT EXISTS smtp_configs (
        user_id TEXT PRIMARY KEY,
        host TEXT NOT NULL,
        port INTEGER NOT NULL,
        secure INTEGER NOT NULL DEFAULT 1,
        smtp_user TEXT NOT NULL,
        encrypted_pass TEXT NOT NULL,
        sender_name TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS user_backups (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        backup_type TEXT NOT NULL DEFAULT 'auto',
        device_name TEXT,
        checksum TEXT NOT NULL,
        item_counts TEXT NOT NULL DEFAULT '{}',
        payload TEXT NOT NULL,
        encoding TEXT NOT NULL DEFAULT 'plain',
        is_encrypted INTEGER NOT NULL DEFAULT 0,
        size_bytes INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_user_backups_user_created
        ON user_backups(user_id, created_at DESC);

      CREATE INDEX IF NOT EXISTS idx_user_settings_user_key
        ON user_settings(user_id, setting_key);
    `);
  })().catch((err) => {
    schemaReadyPromise = null;
    throw err;
  });

  return schemaReadyPromise;
}

async function getDb() {
  await ensureSchema();
  return getDbClient();
}

async function checkDbHealth() {
  const client = await getDb();
  await client.execute('SELECT 1 AS ok');
  return {
    connected: true,
    mode: getDbMode(),
  };
}

module.exports = {
  getDb,
  getDbClient,
  ensureSchema,
  checkDbHealth,
  isHostedEnvironment,
  getDbMode,
};
