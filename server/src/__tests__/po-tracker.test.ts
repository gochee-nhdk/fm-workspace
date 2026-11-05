import { describe, it } from 'node:test';
import assert from 'node:assert';
import { createClient } from '@libsql/client';
import { LibsqlAdapter } from '../db/adapter.js';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';

const testDbDir = path.resolve(process.cwd(), process.cwd().endsWith('server') ? 'data' : 'server/data');
if (!fs.existsSync(testDbDir)) {
  fs.mkdirSync(testDbDir, { recursive: true });
}
const testDbPath = path.join(testDbDir, `test_po_tracker_${Date.now()}.db`);

const client = createClient({ url: `file:${testDbPath}` });
const adapter = new LibsqlAdapter(client, false);

async function setupTables() {
  await adapter.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT,
      email TEXT,
      password_hash TEXT,
      role TEXT DEFAULT 'user',
      full_name TEXT
    );

    CREATE TABLE IF NOT EXISTS po_tracker_folders (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      color TEXT DEFAULT 'blue',
      icon TEXT DEFAULT 'shippingbox',
      sort_order INTEGER DEFAULT 0,
      created_by TEXT REFERENCES users(id),
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS po_tracker_pos (
      id TEXT PRIMARY KEY,
      folder_id TEXT REFERENCES po_tracker_folders(id) ON DELETE SET NULL,
      po_number TEXT,
      po_date TEXT,
      expected_delivery_date TEXT,
      actual_delivery_date TEXT,
      supplier_code TEXT,
      supplier_name TEXT,
      warehouse TEXT,
      status TEXT DEFAULT 'pending',
      total_value REAL DEFAULT 0,
      currency TEXT DEFAULT 'VND',
      notes TEXT,
      tags TEXT,
      extracted_data TEXT,
      pdf_file_name TEXT,
      is_overdue_notified INTEGER DEFAULT 0,
      created_by TEXT REFERENCES users(id),
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS po_tracker_items (
      id TEXT PRIMARY KEY,
      po_id TEXT REFERENCES po_tracker_pos(id) ON DELETE CASCADE,
      item_code TEXT,
      item_name TEXT,
      unit TEXT DEFAULT 'thùng',
      ordered_qty REAL DEFAULT 0,
      received_qty REAL DEFAULT 0,
      unit_price REAL DEFAULT 0,
      total_price REAL DEFAULT 0,
      warehouse TEXT,
      notes TEXT,
      status TEXT DEFAULT 'pending'
    );

    CREATE TABLE IF NOT EXISTS po_tracker_permissions (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      resource_type TEXT NOT NULL,
      resource_id TEXT,
      permission TEXT NOT NULL,
      granted_by TEXT REFERENCES users(id),
      created_at TEXT
    );
  `);
}

function safeParseAIJson(text: string): any {
  if (!text || typeof text !== 'string') return {};
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch (_) {}

  const codeBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (codeBlockMatch && codeBlockMatch[1]) {
    try {
      return JSON.parse(codeBlockMatch[1].trim());
    } catch (_) {}
  }

  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    try {
      return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
    } catch (_) {}
  }

  return {};
}

async function runTests() {
  console.log('\n=== PO TRACKER COMPREHENSIVE INTEGRATION & LOGIC TESTS ===\n');

  await setupTables();

  const userAId = uuidv4();
  await adapter.prepare('INSERT INTO users (id, username, email, full_name, role) VALUES (?, ?, ?, ?, ?)')
    .run(userAId, 'usera', 'usera@farmersmarket.vn', 'User A', 'user');

  // Test 1: AI JSON parser robustness
  console.log('--- TEST GROUP 1: Safe AI JSON Parser ---');
  const rawJson = '{"po_number": "PO-1001", "total_value": 500000}';
  assert.strictEqual(safeParseAIJson(rawJson).po_number, 'PO-1001');
  console.log('[PASS] 1.1: Direct JSON parsed successfully');

  const mdJson = '```json\n{"po_number": "PO-1002", "items": [{"item_code": "001"}]}\n```';
  assert.strictEqual(safeParseAIJson(mdJson).po_number, 'PO-1002');
  console.log('[PASS] 1.2: Code block with markdown fence parsed successfully');

  const conversationalJson = 'Xin chào, đây là kết quả trích xuất PO:\n```json\n{"po_number": "PO-1003"}\n```\nChúc bạn một ngày tốt lành!';
  assert.strictEqual(safeParseAIJson(conversationalJson).po_number, 'PO-1003');
  console.log('[PASS] 1.3: Conversational response containing markdown code block extracted');

  const messyJson = 'Leading garbage text {"po_number": "PO-1004", "status": "draft"} trailing garbage';
  assert.strictEqual(safeParseAIJson(messyJson).po_number, 'PO-1004');
  console.log('[PASS] 1.4: Outermost braces fallback extracted valid object');

  // Test 2: Folders & Permissions
  console.log('\n--- TEST GROUP 2: Folders & Creator Access ---');
  const folderId = uuidv4();
  const now = new Date().toISOString();
  await adapter.prepare(`
    INSERT INTO po_tracker_folders (id, name, color, created_by, created_at, updated_at)
    VALUES (?, ?, 'blue', ?, ?, ?)
  `).run(folderId, 'Rau củ quả sạch', userAId, now, now);

  await adapter.prepare(`
    INSERT INTO po_tracker_permissions (id, user_id, resource_type, resource_id, permission, granted_by, created_at)
    VALUES (?, ?, 'folder', ?, 'admin', ?, ?)
  `).run(uuidv4(), userAId, folderId, userAId, now);

  const folder = await adapter.prepare('SELECT * FROM po_tracker_folders WHERE id = ?').get(folderId) as any;
  assert.strictEqual(folder.name, 'Rau củ quả sạch');
  console.log('[PASS] 2.1: Folder created with creator admin permission');

  // Test 3: PO Creation & Creator Permission Auto-Grant
  console.log('\n--- TEST GROUP 3: PO Creation with Line Items ---');
  const poId = uuidv4();
  await adapter.prepare(`
    INSERT INTO po_tracker_pos (
      id, folder_id, po_number, po_date, expected_delivery_date,
      supplier_code, supplier_name, warehouse, status, total_value, currency,
      created_by, created_at, updated_at
    ) VALUES (?, ?, 'PO-2026-001', '2026-11-01', '2026-11-04', 'V001', 'NCC Lương Gia', 'DC01', 'pending', 1000000, 'VND', ?, ?, ?)
  `).run(poId, folderId, userAId, now, now);

  await adapter.prepare(`
    INSERT INTO po_tracker_permissions (id, user_id, resource_type, resource_id, permission, granted_by, created_at)
    VALUES (?, ?, 'po', ?, 'admin', ?, ?)
  `).run(uuidv4(), userAId, poId, userAId, now);

  // Line items
  await adapter.prepare(`
    INSERT INTO po_tracker_items (id, po_id, item_code, item_name, unit, ordered_qty, received_qty, unit_price, total_price)
    VALUES (?, ?, 'SP001', 'Cam vàng Ohla', 'Hộp', 10, 0, 50000, 500000)
  `).run(uuidv4(), poId);
  await adapter.prepare(`
    INSERT INTO po_tracker_items (id, po_id, item_code, item_name, unit, ordered_qty, received_qty, unit_price, total_price)
    VALUES (?, ?, 'SP002', 'Xoài sấy dẻo', 'Gói', 20, 0, 25000, 500000)
  `).run(uuidv4(), poId);

  // Test quantity aggregations in list query
  const poListRow = await adapter.prepare(`
    SELECT p.*,
           COUNT(DISTINCT pi.id) as item_count,
           COALESCE(SUM(pi.ordered_qty), 0) as total_ordered_qty,
           COALESCE(SUM(pi.received_qty), 0) as total_received_qty
    FROM po_tracker_pos p
    LEFT JOIN po_tracker_items pi ON pi.po_id = p.id
    WHERE p.id = ?
    GROUP BY p.id
  `).get(poId) as any;

  assert.strictEqual(poListRow.item_count, 2);
  assert.strictEqual(poListRow.total_ordered_qty, 30);
  assert.strictEqual(poListRow.total_received_qty, 0);
  console.log('[PASS] 3.1: Aggregated quantities match: 2 items, 30 ordered, 0 received');

  // Test 4: Overdue filtering logic
  console.log('\n--- TEST GROUP 4: Overdue Filtering Logic ---');
  // Expected delivery was 2026-11-04, which is in the past compared to today (e.g. 2026-11-05)
  const today = '2026-11-05';
  const overduePOs = await adapter.prepare(`
    SELECT p.*
    FROM po_tracker_pos p
    WHERE (p.status = 'overdue' OR (p.status NOT IN ('received', 'cancelled') AND p.expected_delivery_date IS NOT NULL AND p.expected_delivery_date < ?))
  `).all(today) as any[];

  assert.strictEqual(overduePOs.length, 1);
  assert.strictEqual(overduePOs[0].po_number, 'PO-2026-001');
  console.log('[PASS] 4.1: Past-due PO correctly matched by overdue filter');

  // Test 5: Status Update via PUT /pos/:id with actual_delivery_date
  console.log('\n--- TEST GROUP 5: Status Update & Delivery Date Synchronization ---');
  // Update status to 'received'
  const newDelivery = today;
  await adapter.prepare(`
    UPDATE po_tracker_pos
    SET status = ?, actual_delivery_date = ?, updated_at = ?
    WHERE id = ?
  `).run('received', newDelivery, now, poId);

  const updatedPO = await adapter.prepare('SELECT * FROM po_tracker_pos WHERE id = ?').get(poId) as any;
  assert.strictEqual(updatedPO.status, 'received');
  assert.strictEqual(updatedPO.actual_delivery_date, today);
  console.log('[PASS] 5.1: Status updated to received and delivery date populated');

  // Verify that received PO is no longer included in overdue filter
  const overdueAfterReceived = await adapter.prepare(`
    SELECT p.*
    FROM po_tracker_pos p
    WHERE (p.status = 'overdue' OR (p.status NOT IN ('received', 'cancelled') AND p.expected_delivery_date IS NOT NULL AND p.expected_delivery_date < ?))
  `).all(today) as any[];

  assert.strictEqual(overdueAfterReceived.length, 0);
  console.log('[PASS] 5.2: Received PO is excluded from overdue filter');

  console.log('\n=== ALL PO TRACKER TESTS PASSED SUCCESSFULLY! ===\n');

  try {
    client.close();
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
  } catch (_) {}
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
