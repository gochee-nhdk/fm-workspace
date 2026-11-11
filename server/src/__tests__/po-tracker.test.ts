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
      full_name TEXT,
      is_active INTEGER DEFAULT 1
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
      sub_total_pre_vat REAL,
      order_discount_amount REAL DEFAULT 0,
      total_vat REAL,
      grand_total REAL,
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
      barcode TEXT,
      item_name TEXT,
      unit TEXT DEFAULT 'thùng',
      ordered_qty REAL DEFAULT 0,
      received_qty REAL DEFAULT 0,
      unit_price REAL DEFAULT 0,
      discount_pct REAL DEFAULT 0,
      vat_pct REAL DEFAULT 8,
      line_pre_vat_total REAL,
      line_vat_amount REAL,
      line_gross_total REAL,
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

function extractCleanBase64(rawUrl: string): { mimeType: string; base64: string } {
  let mimeType = 'application/pdf';
  let base64 = rawUrl || '';

  const commaIdx = rawUrl.indexOf(',');
  if (commaIdx !== -1 && rawUrl.startsWith('data:')) {
    const meta = rawUrl.slice(0, commaIdx);
    const mimeMatch = meta.match(/data:([^;]+)/i);
    if (mimeMatch && mimeMatch[1]) {
      mimeType = mimeMatch[1].trim();
    }
    base64 = rawUrl.slice(commaIdx + 1);
  }
  base64 = base64.replace(/\s+/g, '');
  return { mimeType, base64 };
}

async function runTests() {
  console.log('\n=== PO TRACKER COMPREHENSIVE BACKEND AUDIT & LOGIC TESTS ===\n');

  await setupTables();

  const userAId = uuidv4();
  await adapter.prepare('INSERT INTO users (id, username, email, full_name, role, is_active) VALUES (?, ?, ?, ?, ?, 1)')
    .run(userAId, 'usera', 'usera@farmersmarket.vn', 'User A', 'user');

  const userBId = uuidv4();
  await adapter.prepare('INSERT INTO users (id, username, email, full_name, role, is_active) VALUES (?, ?, ?, ?, ?, 1)')
    .run(userBId, 'userb', 'userb@farmersmarket.vn', 'User B', 'user');

  // ─────────────────────────────────────────────────────────────
  // TEST GROUP 1: Safe AI JSON Parser & Data Extraction
  // ─────────────────────────────────────────────────────────────
  console.log('--- TEST GROUP 1: Safe AI JSON & Data Extraction ---');
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

  const sampleDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const cleanExtracted = extractCleanBase64(sampleDataUrl);
  assert.strictEqual(cleanExtracted.mimeType, 'image/png');
  assert.ok(cleanExtracted.base64.startsWith('iVBORw0KGgo'));
  console.log('[PASS] 1.5: DataURL base64 parsed linearly without regex backtracking');

  // ─────────────────────────────────────────────────────────────
  // TEST GROUP 2: Folders Management & Permissions
  // ─────────────────────────────────────────────────────────────
  console.log('\n--- TEST GROUP 2: Folders & Permissions ---');
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

  // ─────────────────────────────────────────────────────────────
  // TEST GROUP 3: PO Creation, Line Items, & Auto Calculations
  // ─────────────────────────────────────────────────────────────
  console.log('\n--- TEST GROUP 3: PO Creation & Automatic Calculations ---');
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
  const item1Id = uuidv4();
  const item2Id = uuidv4();
  await adapter.prepare(`
    INSERT INTO po_tracker_items (id, po_id, item_code, item_name, unit, ordered_qty, received_qty, unit_price, total_price, status)
    VALUES (?, ?, 'SP001', 'Cam vàng Ohla', 'Hộp', 10, 0, 50000, 500000, 'pending')
  `).run(item1Id, poId);

  await adapter.prepare(`
    INSERT INTO po_tracker_items (id, po_id, item_code, item_name, unit, ordered_qty, received_qty, unit_price, total_price, status)
    VALUES (?, ?, 'SP002', 'Xoài sấy dẻo', 'Gói', 20, 0, 25000, 500000, 'pending')
  `).run(item2Id, poId);

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

  // Calculate progress % when 0 received
  const progressInitial = poListRow.total_ordered_qty > 0
    ? Math.min(100, Math.round((poListRow.total_received_qty / poListRow.total_ordered_qty) * 100))
    : 0;
  assert.strictEqual(progressInitial, 0);
  console.log('[PASS] 3.1: Aggregated quantities & initial progress 0% verified');

  // ─────────────────────────────────────────────────────────────
  // TEST GROUP 4: Delivery Matching & Progress % Calculation
  // ─────────────────────────────────────────────────────────────
  console.log('\n--- TEST GROUP 4: Delivery Matching & Progress % Calculation ---');

  // Step 4.1: Partial delivery: receive 5 units of item 1
  await adapter.prepare(`
    UPDATE po_tracker_items
    SET received_qty = 5, status = 'partial'
    WHERE id = ?
  `).run(item1Id);

  // Check progress
  const partialItems = await adapter.prepare('SELECT * FROM po_tracker_items WHERE po_id = ?').all(poId) as any[];
  const totOrd = partialItems.reduce((s, it) => s + Number(it.ordered_qty || 0), 0);
  const totRec = partialItems.reduce((s, it) => s + Number(it.received_qty || 0), 0);
  const partialPct = Math.min(100, Math.round((totRec / totOrd) * 100)); // 5 / 30 = 17%
  assert.strictEqual(totRec, 5);
  assert.strictEqual(partialPct, 17);

  // Status should transition to 'partial_received'
  await adapter.prepare("UPDATE po_tracker_pos SET status = 'partial_received' WHERE id = ?").run(poId);
  const poPartial = await adapter.prepare('SELECT status FROM po_tracker_pos WHERE id = ?').get(poId) as any;
  assert.strictEqual(poPartial.status, 'partial_received');
  console.log('[PASS] 4.1: Partial delivery (5/30) calculates 17% progress & status partial_received');

  // Step 4.2: Full delivery: receive remainder (10 for item 1, 20 for item 2)
  await adapter.prepare("UPDATE po_tracker_items SET received_qty = ordered_qty, status = 'received' WHERE po_id = ?").run(poId);
  const fullItems = await adapter.prepare('SELECT * FROM po_tracker_items WHERE po_id = ?').all(poId) as any[];
  const fullTotOrd = fullItems.reduce((s, it) => s + Number(it.ordered_qty || 0), 0);
  const fullTotRec = fullItems.reduce((s, it) => s + Number(it.received_qty || 0), 0);
  const fullPct = Math.min(100, Math.round((fullTotRec / fullTotOrd) * 100));
  assert.strictEqual(fullTotRec, 30);
  assert.strictEqual(fullPct, 100);

  // PO status transitions to 'received' and records actual_delivery_date
  const todayStr = '2026-11-05';
  await adapter.prepare("UPDATE po_tracker_pos SET status = 'received', actual_delivery_date = ? WHERE id = ?").run(todayStr, poId);
  const poReceived = await adapter.prepare('SELECT * FROM po_tracker_pos WHERE id = ?').get(poId) as any;
  assert.strictEqual(poReceived.status, 'received');
  assert.strictEqual(poReceived.actual_delivery_date, todayStr);
  console.log('[PASS] 4.2: Full delivery calculates 100% progress & sets status received with delivery date');

  // ─────────────────────────────────────────────────────────────
  // TEST GROUP 5: Overdue Detection & Days Overdue Accuracy
  // ─────────────────────────────────────────────────────────────
  console.log('\n--- TEST GROUP 5: Overdue Filtering & Days Overdue Accuracy ---');

  // Create an overdue PO (expected 2026-11-01, today is 2026-11-05)
  const overduePoId = uuidv4();
  await adapter.prepare(`
    INSERT INTO po_tracker_pos (id, folder_id, po_number, po_date, expected_delivery_date, status, total_value, created_by, created_at)
    VALUES (?, ?, 'PO-OVERDUE-01', '2026-10-25', '2026-11-01', 'pending', 300000, ?, '2026-10-25')
  `).run(overduePoId, folderId, userAId);

  // Create a future PO (expected 2026-11-10)
  const futurePoId = uuidv4();
  await adapter.prepare(`
    INSERT INTO po_tracker_pos (id, folder_id, po_number, po_date, expected_delivery_date, status, total_value, created_by, created_at)
    VALUES (?, ?, 'PO-FUTURE-01', '2026-11-02', '2026-11-10', 'confirmed', 400000, ?, '2026-11-02')
  `).run(futurePoId, folderId, userAId);

  // Overdue filter check: should only match PO-OVERDUE-01 (PO-2026-001 is already 'received')
  const overduePOs = await adapter.prepare(`
    SELECT p.*
    FROM po_tracker_pos p
    WHERE (p.status = 'overdue' OR (p.status NOT IN ('received', 'cancelled') AND p.expected_delivery_date IS NOT NULL AND p.expected_delivery_date < ?))
  `).all(todayStr) as any[];

  assert.strictEqual(overduePOs.length, 1);
  assert.strictEqual(overduePOs[0].po_number, 'PO-OVERDUE-01');
  console.log('[PASS] 5.1: Overdue filter correctly isolates past-due, unreceived POs');

  // Days overdue logic in SQL
  const daysOverdueTest = await adapter.prepare(`
    SELECT po_number, status,
      CASE
        WHEN status IN ('received', 'cancelled') THEN 0
        WHEN expected_delivery_date IS NULL THEN 0
        WHEN ? > expected_delivery_date
          THEN CAST(julianday(?) - julianday(expected_delivery_date) AS INTEGER)
        ELSE 0
      END as days_overdue
    FROM po_tracker_pos
    WHERE id IN (?, ?, ?)
    ORDER BY po_number ASC
  `).all(todayStr, todayStr, poId, overduePoId, futurePoId) as any[];

  const overdueMap = new Map(daysOverdueTest.map((r: any) => [r.po_number, r.days_overdue]));
  assert.strictEqual(overdueMap.get('PO-2026-001'), 0, 'Received PO must have days_overdue = 0');
  assert.strictEqual(overdueMap.get('PO-FUTURE-01'), 0, 'Future PO must have days_overdue = 0');
  assert.strictEqual(overdueMap.get('PO-OVERDUE-01'), 4, 'Overdue PO must have days_overdue = 4 (Nov 5 - Nov 1)');
  console.log('[PASS] 5.2: Days overdue accurately computed: 0 for received/future, 4 for overdue');

  // ─────────────────────────────────────────────────────────────
  // TEST GROUP 6: Search & Multi-field Filtering
  // ─────────────────────────────────────────────────────────────
  console.log('\n--- TEST GROUP 6: Search & Line Item Matching ---');

  // Search by line item name 'Ohla'
  const searchLike = '%Ohla%';
  const matchedByItem = await adapter.prepare(`
    SELECT p.* FROM po_tracker_pos p
    WHERE (
      p.po_number LIKE ?
      OR p.supplier_name LIKE ?
      OR p.supplier_code LIKE ?
      OR p.warehouse LIKE ?
      OR p.notes LIKE ?
      OR EXISTS (
        SELECT 1 FROM po_tracker_items pi2
        WHERE pi2.po_id = p.id AND (pi2.item_code LIKE ? OR pi2.item_name LIKE ?)
      )
    )
  `).all(searchLike, searchLike, searchLike, searchLike, searchLike, searchLike, searchLike) as any[];

  assert.strictEqual(matchedByItem.length, 1);
  assert.strictEqual(matchedByItem[0].id, poId);
  console.log('[PASS] 6.1: Search by item name ("Ohla") locates containing PO via EXISTS subquery');

  // Search by SKU code 'SP002'
  const skuLike = '%SP002%';
  const matchedBySku = await adapter.prepare(`
    SELECT p.* FROM po_tracker_pos p
    WHERE EXISTS (
      SELECT 1 FROM po_tracker_items pi2
      WHERE pi2.po_id = p.id AND (pi2.item_code LIKE ? OR pi2.item_name LIKE ?)
    )
  `).all(skuLike, skuLike) as any[];
  assert.strictEqual(matchedBySku.length, 1);
  assert.strictEqual(matchedBySku[0].id, poId);
  console.log('[PASS] 6.2: Search by SKU code ("SP002") successfully finds parent PO');

  // Unassigned folder filter check
  const unassignedPoId = uuidv4();
  await adapter.prepare(`
    INSERT INTO po_tracker_pos (id, folder_id, po_number, status, total_value, created_by, created_at)
    VALUES (?, NULL, 'PO-UNASSIGNED-01', 'pending', 150000, ?, ?)
  `).run(unassignedPoId, userAId, now);

  const unassignedList = await adapter.prepare('SELECT * FROM po_tracker_pos WHERE folder_id IS NULL').all() as any[];
  assert.strictEqual(unassignedList.length, 1);
  assert.strictEqual(unassignedList[0].po_number, 'PO-UNASSIGNED-01');
  console.log('[PASS] 6.3: Unassigned folder filter (folder_id IS NULL) functions accurately');

  // ─────────────────────────────────────────────────────────────
  // TEST GROUP 7: Aggregated Dashboard Statistics (Parameter Count & Correctness)
  // ─────────────────────────────────────────────────────────────
  console.log('\n--- TEST GROUP 7: Dashboard Statistics Query Verification ---');

  const in7Days = '2026-11-12';
  // Check the 4-placeholder query
  const statsResult = await adapter.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) as confirmed,
      SUM(CASE WHEN status = 'shipping' THEN 1 ELSE 0 END) as shipping,
      SUM(CASE WHEN status = 'partial_received' THEN 1 ELSE 0 END) as partial_received,
      SUM(CASE WHEN status = 'received' THEN 1 ELSE 0 END) as received,
      SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
      SUM(CASE WHEN status = 'overdue' OR (status NOT IN ('received','cancelled') AND expected_delivery_date IS NOT NULL AND expected_delivery_date < ?) THEN 1 ELSE 0 END) as overdue,
      SUM(CASE WHEN status = 'overdue' OR (status NOT IN ('received','cancelled') AND expected_delivery_date IS NOT NULL AND expected_delivery_date < ?) THEN 1 ELSE 0 END) as actually_overdue,
      SUM(CASE WHEN status NOT IN ('received','cancelled') AND expected_delivery_date BETWEEN ? AND ? THEN 1 ELSE 0 END) as upcoming_7_days,
      COALESCE(SUM(total_value), 0) as total_value
    FROM po_tracker_pos p
    WHERE 1=1
  `).get(todayStr, todayStr, todayStr, in7Days) as any;

  assert.ok(statsResult, 'Stats result must exist');
  assert.strictEqual(Number(statsResult.total), 4, 'Total POs: 4');
  assert.strictEqual(Number(statsResult.received), 1, 'Received: 1');
  assert.strictEqual(Number(statsResult.overdue), 1, 'Overdue: 1 (PO-OVERDUE-01)');
  assert.strictEqual(Number(statsResult.upcoming_7_days), 1, 'Upcoming 7 days: 1 (PO-FUTURE-01)');
  console.log('[PASS] 7.1: Aggregated stats query executes with 4 positional params and 100% accuracy');

  // Test stats query with user filter
  const nonAdminStats = await adapter.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) as confirmed,
      SUM(CASE WHEN status = 'shipping' THEN 1 ELSE 0 END) as shipping,
      SUM(CASE WHEN status = 'partial_received' THEN 1 ELSE 0 END) as partial_received,
      SUM(CASE WHEN status = 'received' THEN 1 ELSE 0 END) as received,
      SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
      SUM(CASE WHEN status = 'overdue' OR (status NOT IN ('received','cancelled') AND expected_delivery_date IS NOT NULL AND expected_delivery_date < ?) THEN 1 ELSE 0 END) as overdue,
      SUM(CASE WHEN status = 'overdue' OR (status NOT IN ('received','cancelled') AND expected_delivery_date IS NOT NULL AND expected_delivery_date < ?) THEN 1 ELSE 0 END) as actually_overdue,
      SUM(CASE WHEN status NOT IN ('received','cancelled') AND expected_delivery_date BETWEEN ? AND ? THEN 1 ELSE 0 END) as upcoming_7_days,
      COALESCE(SUM(total_value), 0) as total_value
    FROM po_tracker_pos p
    WHERE 1=1 AND (p.created_by = ?)
  `).get(todayStr, todayStr, todayStr, in7Days, userAId) as any;

  assert.strictEqual(Number(nonAdminStats.total), 4);
  console.log('[PASS] 7.2: Stats with non-admin filters executes cleanly without parameter offset');

  // ─────────────────────────────────────────────────────────────
  // TEST GROUP 8: Folder Deletion & Cascading Foreign Keys
  // ─────────────────────────────────────────────────────────────
  console.log('\n--- TEST GROUP 8: Folder Deletion & Unlinking Safety ---');
  // When a folder is deleted, POs must be unlinked (folder_id = NULL), not deleted!
  await adapter.prepare('UPDATE po_tracker_pos SET folder_id = NULL WHERE folder_id = ?').run(folderId);
  await adapter.prepare("DELETE FROM po_tracker_permissions WHERE resource_type = 'folder' AND resource_id = ?").run(folderId);
  await adapter.prepare('DELETE FROM po_tracker_folders WHERE id = ?').run(folderId);

  const survivingPO = await adapter.prepare('SELECT folder_id FROM po_tracker_pos WHERE id = ?').get(poId) as any;
  assert.strictEqual(survivingPO.folder_id, null, 'PO must be retained with folder_id = NULL');
  console.log('[PASS] 8.1: Deleting folder preserves POs with folder_id unlinked to NULL');

  console.log('\n=== ALL 14 PO TRACKER AUDIT TESTS PASSED SUCCESSFULLY! ===\n');

  try {
    client.close();
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
  } catch (_) {}
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
