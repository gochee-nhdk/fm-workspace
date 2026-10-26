import { createClient } from '@libsql/client';
import { LibsqlAdapter, createDatabaseAdapter, type IDatabaseAdapter } from '../db/adapter.js';
import path from 'path';
import fs from 'fs';

async function runTursoAdapterTests() {
  console.log('=== FM WORKSPACE — TURSO / LIBSQL ADAPTER TESTS ===\n');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}`);
      failed++;
    }
  }

  const testDbDir = path.resolve(process.cwd(), process.cwd().endsWith('server') ? 'data' : 'server/data');
  if (!fs.existsSync(testDbDir)) {
    fs.mkdirSync(testDbDir, { recursive: true });
  }
  const testDbFile = path.join(testDbDir, `test_turso_${Date.now()}.db`);
  const client = createClient({ url: `file:${testDbFile}` });
  const adapter = new LibsqlAdapter(client, false);

  try {
    // 1. Schema setup & execution
    await adapter.exec(`
      CREATE TABLE test_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        price REAL DEFAULT 0,
        tags TEXT
      );
    `);
    assert(true, '1.1: adapter.exec successfully executed multi-line DDL');

    // 2. Insert with RunResult validation
    const res1 = await adapter.run('INSERT INTO test_items (name, price) VALUES (?, ?)', 'Organic Apple', 25000);
    assert(res1.changes === 1, `2.1: adapter.run returned correct affected changes (expected 1, got ${res1.changes})`);
    assert(typeof res1.lastInsertRowid === 'number' && res1.lastInsertRowid >= 1, `2.2: adapter.run returned numeric lastInsertRowid (${res1.lastInsertRowid})`);

    const res2 = await adapter.prepare('INSERT INTO test_items (name, price) VALUES (?, ?)').run('Organic Carrot', 15000);
    assert(res2.changes === 1 && res2.lastInsertRowid === 2, `2.3: adapter.prepare().run correctly handled statement execution`);

    // 3. Positional parameter bindings and queries
    const row = await adapter.prepare('SELECT * FROM test_items WHERE id = ?').get(1);
    assert(row && row.name === 'Organic Apple' && Number(row.price) === 25000, `3.1: adapter.prepare().get returned matching record with correct fields`);

    const allRows = await adapter.prepare('SELECT * FROM test_items ORDER BY id ASC').all();
    assert(allRows.length === 2 && allRows[1].name === 'Organic Carrot', `3.2: adapter.prepare().all returned all matching rows (${allRows.length} items)`);

    // 4. Array parameter passing
    const rowByArr = await adapter.get('SELECT * FROM test_items WHERE name = ?', ['Organic Carrot']);
    assert(rowByArr && rowByArr.id === 2, `4.1: adapter.get correctly accepted array parameters`);

    // 5. Query for non-existent record returns undefined
    const notFound = await adapter.get('SELECT * FROM test_items WHERE id = ?', 99999);
    assert(notFound === undefined, `5.1: Non-existent query returned undefined safely without throwing`);

    // 6. Transaction Commit
    await adapter.transaction(async (tx) => {
      await tx.prepare('INSERT INTO test_items (name, price) VALUES (?, ?)').run('Tx Item 1', 10000);
      await tx.prepare('INSERT INTO test_items (name, price) VALUES (?, ?)').run('Tx Item 2', 20000);
    });
    const txRows = await adapter.all('SELECT * FROM test_items WHERE name LIKE ?', 'Tx Item%');
    assert(txRows.length === 2, `6.1: Transaction committed multiple statements atomically (${txRows.length} items found)`);

    // 7. Transaction Rollback on Error
    let threw = false;
    try {
      await adapter.transaction(async (tx) => {
        await tx.prepare('INSERT INTO test_items (name, price) VALUES (?, ?)').run('Will Rollback', 30000);
        throw new Error('Forced transaction failure for testing');
      });
    } catch (e: any) {
      threw = true;
    }
    const rollbackCheck = await adapter.get('SELECT * FROM test_items WHERE name = ?', 'Will Rollback');
    assert(threw && rollbackCheck === undefined, `7.1: Transaction correctly rolled back changes upon encountering an exception`);

    // 8. Remote detection
    const remoteAdapter = new LibsqlAdapter(client, true);
    assert(remoteAdapter.isRemote() === true, '8.1: LibsqlAdapter correctly identifies remote Turso mode');
    assert(adapter.isRemote() === false, '8.2: LibsqlAdapter correctly identifies local file mode');

    // 9. Factory function tests
    const originalTursoUrl = process.env.TURSO_DATABASE_URL;
    const originalTursoToken = process.env.TURSO_AUTH_TOKEN;

    // Test remote factory configuration
    process.env.TURSO_DATABASE_URL = 'libsql://fm-db-mock.turso.io';
    process.env.TURSO_AUTH_TOKEN = 'mock_jwt_auth_token_for_turso_testing';
    const factoryRemote = createDatabaseAdapter();
    assert(factoryRemote.isRemote() === true, '9.1: createDatabaseAdapter selects remote Turso LibsqlAdapter when TURSO_DATABASE_URL is set');
    await factoryRemote.close().catch(() => {});

    // Test fail-closed guard in hosted production mode without TURSO_DATABASE_URL
    delete process.env.TURSO_DATABASE_URL;
    process.env.RENDER = 'true';
    let failClosedThrew = false;
    try {
      createDatabaseAdapter();
    } catch (err: any) {
      failClosedThrew = true;
      assert(err.message.includes('TURSO_DATABASE_URL must be configured'), '9.2: Fatal error thrown when TURSO_DATABASE_URL missing in hosted mode');
    }
    assert(failClosedThrew, '9.3: Refuses silent fallback to ephemeral SQLite in hosted environment');
    delete process.env.RENDER;

    // Restore environment
    if (originalTursoUrl) {
      process.env.TURSO_DATABASE_URL = originalTursoUrl;
    } else {
      delete process.env.TURSO_DATABASE_URL;
    }
    if (originalTursoToken) {
      process.env.TURSO_AUTH_TOKEN = originalTursoToken;
    } else {
      delete process.env.TURSO_AUTH_TOKEN;
    }

  } finally {
    await adapter.close().catch(() => {});
    try {
      if (fs.existsSync(testDbFile)) {
        fs.unlinkSync(testDbFile);
      }
    } catch (_) {}
  }

  console.log(`\n=== KẾT QUẢ KIỂM THỬ ADAPTER: ${passed} ĐẠT, ${failed} THẤT BẠI ===\n`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTursoAdapterTests().catch((err) => {
  console.error('Fatal Turso Adapter Test Error:', err);
  process.exit(1);
});
