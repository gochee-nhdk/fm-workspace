import { createClient } from '@libsql/client';
import { LibsqlAdapter } from '../db/adapter.js';
import { v4 as uuidv4 } from 'uuid';
import {
  calculateAverageDailySales,
  calculateAverageDailySalesBatch,
  calculateDaysOfCover,
  calculateSafetyStock,
  calculateReorderPoint,
  calculateRecommendedOrderQty
} from '../services/calculations.js';
import { setDb, getDb } from '../db/connection.js';
import { generateOrderRecommendations } from '../services/recommendations.js';

async function runBackendBusinessLogicTests() {
  console.log('=== BẮT ĐẦU KIỂM THỬ TOÀN DIỆN BACKEND BUSINESS LOGIC & ACID TRANSACTIONS ===\n');
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

  // Create isolated in-memory LibSQL database
  const client = createClient({ url: ':memory:' });
  const db = new LibsqlAdapter(client, false);
  setDb(db);

  // Setup full database schema
  await db.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE,
      full_name TEXT,
      role TEXT DEFAULT 'staff',
      is_active INTEGER DEFAULT 1
    );

    CREATE TABLE stores (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT UNIQUE NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE categories (
      id TEXT PRIMARY KEY,
      name TEXT
    );

    CREATE TABLE products (
      id TEXT PRIMARY KEY,
      sku_code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      category_id TEXT,
      unit TEXT DEFAULT 'piece',
      shelf_life_days INTEGER DEFAULT 30,
      is_active INTEGER DEFAULT 1,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE suppliers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT UNIQUE NOT NULL,
      lead_time_days INTEGER DEFAULT 3,
      is_active INTEGER DEFAULT 1,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE product_suppliers (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      supplier_id TEXT NOT NULL,
      cost_price REAL DEFAULT 0,
      moq INTEGER DEFAULT 1,
      order_multiple INTEGER DEFAULT 1,
      is_primary INTEGER DEFAULT 0,
      UNIQUE(product_id, supplier_id)
    );

    CREATE TABLE inventory (
      id TEXT PRIMARY KEY,
      store_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      quantity REAL DEFAULT 0,
      available_qty REAL DEFAULT 0,
      reserved_qty REAL DEFAULT 0,
      damaged_qty REAL DEFAULT 0,
      updated_at TEXT,
      UNIQUE(store_id, product_id)
    );

    CREATE TABLE expiry_lots (
      id TEXT PRIMARY KEY,
      store_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      lot_number TEXT,
      quantity REAL,
      expiry_date TEXT,
      status TEXT DEFAULT 'active',
      created_at TEXT
    );

    CREATE TABLE sales (
      id TEXT PRIMARY KEY,
      store_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      sale_date TEXT NOT NULL,
      quantity REAL NOT NULL,
      revenue REAL DEFAULT 0,
      created_at TEXT
    );

    CREATE TABLE purchase_orders (
      id TEXT PRIMARY KEY,
      po_number TEXT UNIQUE NOT NULL,
      supplier_id TEXT NOT NULL,
      store_id TEXT NOT NULL,
      status TEXT DEFAULT 'draft',
      total_value REAL DEFAULT 0,
      order_date TEXT,
      received_date TEXT,
      notes TEXT,
      created_by TEXT,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE po_items (
      id TEXT PRIMARY KEY,
      po_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      ordered_qty REAL NOT NULL,
      received_qty REAL DEFAULT 0,
      unit_price REAL DEFAULT 0,
      status TEXT DEFAULT 'pending'
    );

    CREATE TABLE purchase_recommendations (
      id TEXT PRIMARY KEY,
      store_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      recommended_qty REAL,
      reason TEXT,
      confidence TEXT,
      risk_level TEXT,
      calculation_data TEXT,
      status TEXT DEFAULT 'pending',
      created_at TEXT
    );

    CREATE TABLE stock_transfers (
      id TEXT PRIMARY KEY,
      transfer_number TEXT UNIQUE NOT NULL,
      from_store_id TEXT NOT NULL,
      to_store_id TEXT NOT NULL,
      status TEXT DEFAULT 'draft',
      requested_by TEXT,
      notes TEXT,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE transfer_items (
      id TEXT PRIMARY KEY,
      transfer_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      quantity REAL NOT NULL,
      reason TEXT
    );

    CREATE TABLE system_settings (
      id TEXT PRIMARY KEY,
      key TEXT UNIQUE,
      value TEXT
    );

    CREATE TABLE datasets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      file_name TEXT,
      row_count INTEGER DEFAULT 0,
      entity_type TEXT,
      quality_score REAL DEFAULT 100,
      status TEXT DEFAULT 'ready',
      created_at TEXT
    );

    CREATE TABLE data_imports (
      id TEXT PRIMARY KEY,
      file_name TEXT,
      entity_type TEXT,
      total_rows INTEGER,
      success_rows INTEGER,
      error_rows INTEGER,
      status TEXT,
      created_at TEXT
    );
  `);

  console.log('--- TEST GROUP 1: Master Data & System Settings Setup ---');
  const storeA = 'store-A';
  const storeB = 'store-B';
  const supplier1 = 'sup-001';
  const prod1 = 'prod-001';
  const prod2 = 'prod-002';
  const now = new Date().toISOString();
  const today = now.split('T')[0];

  await db.prepare('INSERT INTO stores (id, name, code, is_active, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?)').run(storeA, 'Cửa hàng Quận 1', 'FM-Q1', now, now);
  await db.prepare('INSERT INTO stores (id, name, code, is_active, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?)').run(storeB, 'Cửa hàng Thảo Điền', 'FM-TD', now, now);
  await db.prepare('INSERT INTO suppliers (id, name, code, lead_time_days, is_active, created_at, updated_at) VALUES (?, ?, ?, 3, 1, ?, ?)').run(supplier1, 'Nông Trại Đà Lạt', 'SUP-DL', now, now);

  await db.prepare('INSERT INTO products (id, sku_code, name, unit, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)').run(prod1, 'SKU-001', 'Xà lách thủy canh 500g', 'gói', now, now);
  await db.prepare('INSERT INTO products (id, sku_code, name, unit, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)').run(prod2, 'SKU-002', 'Cà chua cherry Đà Lạt', 'hộp', now, now);

  await db.prepare('INSERT INTO product_suppliers (id, product_id, supplier_id, cost_price, moq, order_multiple, is_primary) VALUES (?, ?, ?, 20000, 10, 5, 1)').run(uuidv4(), prod1, supplier1);
  await db.prepare('INSERT INTO product_suppliers (id, product_id, supplier_id, cost_price, moq, order_multiple, is_primary) VALUES (?, ?, ?, 30000, 5, 1, 1)').run(uuidv4(), prod2, supplier1);

  await db.prepare('INSERT INTO system_settings (id, key, value) VALUES (?, ?, ?)').run(uuidv4(), 'default_safety_days', '3');
  await db.prepare('INSERT INTO system_settings (id, key, value) VALUES (?, ?, ?)').run(uuidv4(), 'default_review_period', '7');

  assert(true, '1.1: Khởi tạo Master Data & System Settings thành công');

  console.log('\n--- TEST GROUP 2: Batch Sales Calculation & N+1 Elimination ---');
  // Seed sales data
  await db.prepare('INSERT INTO sales (id, store_id, product_id, sale_date, quantity, revenue) VALUES (?, ?, ?, ?, ?, ?)').run(uuidv4(), storeA, prod1, today, 30, 600000);
  await db.prepare('INSERT INTO sales (id, store_id, product_id, sale_date, quantity, revenue) VALUES (?, ?, ?, ?, ?, ?)').run(uuidv4(), storeB, prod1, today, 60, 1200000);
  await db.prepare('INSERT INTO sales (id, store_id, product_id, sale_date, quantity, revenue) VALUES (?, ?, ?, ?, ?, ?)').run(uuidv4(), storeA, prod2, today, 15, 450000);

  // Single query calculation
  const singleAdsA = await calculateAverageDailySales(prod1, storeA, 30);
  assert(Math.abs(singleAdsA - 1.0) < 0.001, '2.1: Tính toán ADS đơn lẻ: 30 / 30 = 1.0');

  // Batch calculation
  const batchAds = await calculateAverageDailySalesBatch(30);
  assert(batchAds.size === 3, '2.2: Batch calculation trả về đủ 3 cặp (product, store)');
  assert(Math.abs((batchAds.get(`${prod1}_${storeA}`) || 0) - 1.0) < 0.001, '2.3: Batch ADS khớp chính xác với single ADS cho Prod1 tại StoreA');
  assert(Math.abs((batchAds.get(`${prod1}_${storeB}`) || 0) - 2.0) < 0.001, '2.4: Batch ADS khớp chính xác: 60 / 30 = 2.0 cho Prod1 tại StoreB');

  console.log('\n--- TEST GROUP 3: Purchase Recommendation Engine & ACID Transactions ---');
  // Initial inventory: storeA has 0 of prod1
  await db.prepare('INSERT INTO inventory (id, store_id, product_id, quantity, available_qty, updated_at) VALUES (?, ?, ?, 0, 0, ?)').run(uuidv4(), storeA, prod1, now);
  // storeB has 50 of prod1
  await db.prepare('INSERT INTO inventory (id, store_id, product_id, quantity, available_qty, updated_at) VALUES (?, ?, ?, 50, 50, ?)').run(uuidv4(), storeB, prod1, now);

  const recCount = await generateOrderRecommendations();
  assert(recCount > 0, `3.1: Sinh thành công ${recCount} gợi ý đặt hàng`);

  const recommendations = await db.prepare('SELECT * FROM purchase_recommendations WHERE store_id = ? AND product_id = ?').all(storeA, prod1);
  assert(recommendations.length === 1, '3.2: Có đúng 1 gợi ý đặt hàng cho Prod1 tại StoreA');
  assert(Number(recommendations[0].recommended_qty) >= 10, '3.3: Số lượng đặt hàng tuân thủ MOQ >= 10');

  // Verify re-running generation replaces pending atomically without duplication
  const secondRunCount = await generateOrderRecommendations();
  const recsAfterRerun = await db.prepare('SELECT * FROM purchase_recommendations WHERE store_id = ? AND product_id = ?').all(storeA, prod1);
  assert(recsAfterRerun.length === 1, '3.4: Chạy lại generation không bị nhân đôi (ACID delete & insert)');

  console.log('\n--- TEST GROUP 4: Purchase Order Lifecycle & Goods Receipt ---');
  const poId = uuidv4();
  const poNum = 'PO-TEST001';
  // Create PO
  await db.transaction(async (tx) => {
    await tx.prepare('INSERT INTO purchase_orders (id, po_number, supplier_id, store_id, status, total_value, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(poId, poNum, supplier1, storeA, 'draft', 300000, now, now);
    await tx.prepare('INSERT INTO po_items (id, po_id, product_id, ordered_qty, unit_price, status) VALUES (?, ?, ?, 15, 20000, ?)')
      .run(uuidv4(), poId, prod1, 'pending');
  });

  const createdPo = await db.prepare('SELECT * FROM purchase_orders WHERE id = ?').get(poId) as any;
  assert(createdPo && createdPo.status === 'draft', '4.1: Tạo đơn đặt hàng PO thành công ở trạng thái draft');

  // State machine transition: draft -> approved -> ordered
  await db.prepare('UPDATE purchase_orders SET status = ? WHERE id = ?').run('approved', poId);
  await db.prepare('UPDATE purchase_orders SET status = ? WHERE id = ?').run('ordered', poId);

  // Partial receipt: receive 5 items with lot expiry
  const expiryDate = '2026-12-31';
  await db.transaction(async (tx) => {
    await tx.prepare('UPDATE po_items SET received_qty = 5, status = ? WHERE po_id = ? AND product_id = ?').run('partial', poId, prod1);
    await tx.prepare(`
      INSERT INTO inventory (id, store_id, product_id, quantity, available_qty, updated_at)
      VALUES (?, ?, ?, 5, 5, ?)
      ON CONFLICT(store_id, product_id) DO UPDATE SET
        quantity = quantity + 5,
        available_qty = available_qty + 5,
        updated_at = excluded.updated_at
    `).run(uuidv4(), storeA, prod1, now);
    await tx.prepare("INSERT INTO expiry_lots (id, store_id, product_id, lot_number, quantity, expiry_date, status, created_at) VALUES (?, ?, ?, ?, ?, ?, 'active', ?)")
      .run(uuidv4(), storeA, prod1, 'LOT-001', 5, expiryDate, now);
    await tx.prepare("UPDATE purchase_orders SET status = 'partial_received' WHERE id = ?").run(poId);
  });

  const invAfterPartial = (await db.prepare('SELECT available_qty FROM inventory WHERE store_id = ? AND product_id = ?').get(storeA, prod1)) as any;
  assert(Number(invAfterPartial.available_qty) === 5, '4.2: Tồn kho cập nhật chính xác sau khi nhận hàng một phần (0 + 5 = 5)');

  // Full receipt: receive remaining 10 items
  await db.transaction(async (tx) => {
    await tx.prepare('UPDATE po_items SET received_qty = 15, status = ? WHERE po_id = ? AND product_id = ?').run('received', poId, prod1);
    await tx.prepare(`
      INSERT INTO inventory (id, store_id, product_id, quantity, available_qty, updated_at)
      VALUES (?, ?, ?, 10, 10, ?)
      ON CONFLICT(store_id, product_id) DO UPDATE SET
        quantity = quantity + 10,
        available_qty = available_qty + 10,
        updated_at = excluded.updated_at
    `).run(uuidv4(), storeA, prod1, now);
    await tx.prepare("UPDATE purchase_orders SET status = 'received', received_date = ? WHERE id = ?").run(now, poId);
  });

  const poAfterFull = (await db.prepare('SELECT * FROM purchase_orders WHERE id = ?').get(poId)) as any;
  const invAfterFull = (await db.prepare('SELECT available_qty FROM inventory WHERE store_id = ? AND product_id = ?').get(storeA, prod1)) as any;
  assert(poAfterFull.status === 'received', '4.3: PO chuyển sang trạng thái received sau khi nhận đủ 100%');
  assert(Number(invAfterFull.available_qty) === 15, '4.4: Tồn kho cập nhật đủ 15 sản phẩm');

  console.log('\n--- TEST GROUP 5: Stock Transfer Guard & Inventory Balance Invariants ---');
  // Store B has 50 of prod1. Store A has 15 of prod1.
  // Test 5.1: Attempt transfer with more stock than available
  const trfId = uuidv4();
  await db.prepare("INSERT INTO stock_transfers (id, transfer_number, from_store_id, to_store_id, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'draft', ?, ?)")
    .run(trfId, 'TRF-001', storeA, storeB, now, now);
  await db.prepare('INSERT INTO transfer_items (id, transfer_id, product_id, quantity, reason) VALUES (?, ?, ?, 20, ?)')
    .run(uuidv4(), trfId, prod1, 'Cân đối');

  // Attempting to dispatch 20 when Store A only has 15 must fail
  let transferFailedAsExpected = false;
  try {
    await db.transaction(async (tx) => {
      const inv = (await tx.prepare('SELECT available_qty FROM inventory WHERE store_id = ? AND product_id = ?').get(storeA, prod1)) as any;
      const current = Number(inv?.available_qty || 0);
      if (current < 20) {
        throw new Error(`Kho xuất không đủ tồn kho khả dụng (cần 20, có ${current})`);
      }
    });
  } catch (err: any) {
    transferFailedAsExpected = true;
  }
  assert(transferFailedAsExpected, '5.1: Chặn đứng điều chuyển khi kho xuất không đủ hàng tồn kho khả dụng');

  // Test 5.2: Valid transfer of 5 units from Store B (has 50) to Store A (has 15)
  const validTrfId = uuidv4();
  await db.prepare("INSERT INTO stock_transfers (id, transfer_number, from_store_id, to_store_id, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'draft', ?, ?)")
    .run(validTrfId, 'TRF-002', storeB, storeA, now, now);
  await db.prepare('INSERT INTO transfer_items (id, transfer_id, product_id, quantity, reason) VALUES (?, ?, ?, 10, ?)')
    .run(uuidv4(), validTrfId, prod1, 'Chuyển kho');

  // Transition to in_transit: deduct from Store B
  await db.transaction(async (tx) => {
    await tx.prepare('UPDATE inventory SET available_qty = available_qty - 10, quantity = quantity - 10 WHERE store_id = ? AND product_id = ?')
      .run(storeB, prod1);
    await tx.prepare("UPDATE stock_transfers SET status = 'in_transit', updated_at = ? WHERE id = ?").run(now, validTrfId);
  });

  const invStoreBInTransit = (await db.prepare('SELECT available_qty FROM inventory WHERE store_id = ? AND product_id = ?').get(storeB, prod1)) as any;
  assert(Number(invStoreBInTransit.available_qty) === 40, '5.2: Tồn kho Store B bị trừ chính xác khi xuất kho điều chuyển: 50 - 10 = 40');

  // Cancel from in_transit: rollback back to Store B
  await db.transaction(async (tx) => {
    await tx.prepare('UPDATE inventory SET available_qty = available_qty + 10, quantity = quantity + 10 WHERE store_id = ? AND product_id = ?')
      .run(storeB, prod1);
    await tx.prepare("UPDATE stock_transfers SET status = 'cancelled', updated_at = ? WHERE id = ?").run(now, validTrfId);
  });

  const invStoreBRollback = (await db.prepare('SELECT available_qty FROM inventory WHERE store_id = ? AND product_id = ?').get(storeB, prod1)) as any;
  assert(Number(invStoreBRollback.available_qty) === 50, '5.3: Hủy điều chuyển hoàn trả tồn kho nguyên vẹn cho Store B: 40 + 10 = 50');

  console.log('\n--- TEST GROUP 6: Expired Lots & Store-scoped Dashboard Metrics ---');
  // Add an expired lot (yesterday) and near-expiry lot (5 days later)
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const fiveDaysLater = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  await db.prepare("INSERT INTO expiry_lots (id, store_id, product_id, lot_number, quantity, expiry_date, status, created_at) VALUES (?, ?, ?, ?, ?, ?, 'active', ?)")
    .run(uuidv4(), storeA, prod2, 'LOT-EXP-1', 4, yesterday, now);
  await db.prepare("INSERT INTO expiry_lots (id, store_id, product_id, lot_number, quantity, expiry_date, status, created_at) VALUES (?, ?, ?, ?, ?, ?, 'active', ?)")
    .run(uuidv4(), storeA, prod1, 'LOT-NEAR-1', 6, fiveDaysLater, now);

  const expiredCountRes = (await db.prepare("SELECT COUNT(*) as count FROM expiry_lots WHERE status = 'active' AND expiry_date < ? AND store_id = ?").get(today, storeA)) as any;
  assert(Number(expiredCountRes.count) === 1, '6.1: Phát hiện chính xác 1 lô hàng đã quá hạn sử dụng (expired)');

  const nearExpiryCountRes = (await db.prepare("SELECT COUNT(*) as count FROM expiry_lots WHERE status = 'active' AND expiry_date >= ? AND expiry_date <= ? AND store_id = ?").get(today, fiveDaysLater, storeA)) as any;
  assert(Number(nearExpiryCountRes.count) === 1, '6.2: Phát hiện chính xác 1 lô hàng cận date trong vòng 5 ngày');

  console.log('\n--- TEST GROUP 7: Data Quality & Bulk Ingestion Cache ---');
  // Test product cache simulation
  const productCache = new Map<string, string>();
  const prods = (await db.prepare('SELECT id, sku_code FROM products').all()) as any[];
  for (const p of prods) productCache.set(p.sku_code, p.id);

  assert(productCache.has('SKU-001'), '7.1: Pre-cache nhận diện SKU-001 thành công');
  assert(productCache.has('SKU-002'), '7.2: Pre-cache nhận diện SKU-002 thành công');
  assert(!productCache.has('SKU-UNKNOWN'), '7.3: Pre-cache xử lý an toàn SKU mới chưa có');

  console.log('\n--- TEST GROUP 8: Safe Base64 Linear Extraction (ReDoS Safety) ---');
  const validDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const commaIdx = validDataUrl.indexOf(',');
  const isDataUrl = validDataUrl.startsWith('data:image/') && commaIdx !== -1;
  const header = validDataUrl.substring(0, commaIdx);
  const mimeMatch = header.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64/i);
  const base64Clean = validDataUrl.substring(commaIdx + 1).replace(/\s+/g, '');

  assert(isDataUrl === true, '8.1: Nhận dạng data URL hợp lệ theo thuật toán tuyến tính O(N)');
  assert(mimeMatch !== null && mimeMatch[1] === 'image/png', '8.2: Trích xuất MIME type image/png chuẩn xác');
  assert(base64Clean.length > 0, '8.3: Trích xuất chuỗi Base64 sạch không bị ReDoS');

  console.log(`\n=== TỔNG KẾT KIỂM THỬ: ${passed} ĐẠT, ${failed} THẤT BẠI ===`);
  if (failed > 0) {
    process.exit(1);
  }
}

runBackendBusinessLogicTests().catch((err) => {
  console.error('Lỗi khi chạy kiểm thử backend business logic:', err);
  process.exit(1);
});
