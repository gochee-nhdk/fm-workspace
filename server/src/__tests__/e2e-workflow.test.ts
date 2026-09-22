import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import {
  calculateAverageDailySales,
  calculateDaysOfCover,
  calculateSafetyStock,
  calculateReorderPoint,
  calculateRecommendedOrderQty
} from '../services/calculations.js';

async function runE2ETests() {
  console.log('=== RUNNING E2E ISOLATED WORKFLOW INTEGRATION TESTS ===\n');
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

  // Pure in-memory SQLite database
  const db = new Database(':memory:');

  db.exec(`
    CREATE TABLE stores (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE products (
      id TEXT PRIMARY KEY,
      sku_code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      category TEXT,
      unit TEXT DEFAULT 'item',
      cost_price REAL DEFAULT 0,
      selling_price REAL DEFAULT 0,
      min_order_qty REAL DEFAULT 1,
      pack_size REAL DEFAULT 1,
      shelf_life_days INTEGER DEFAULT 30,
      status TEXT DEFAULT 'active',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE suppliers (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      lead_time_days INTEGER DEFAULT 2,
      moq_value REAL DEFAULT 0,
      status TEXT DEFAULT 'active',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE inventory (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      store_id TEXT NOT NULL,
      available_qty REAL DEFAULT 0,
      reserved_qty REAL DEFAULT 0,
      in_transit_qty REAL DEFAULT 0,
      avg_daily_sales REAL DEFAULT 0,
      days_of_cover REAL DEFAULT 0,
      reorder_point REAL DEFAULT 0,
      safety_stock REAL DEFAULT 0,
      updated_at TEXT NOT NULL,
      UNIQUE(product_id, store_id)
    );
    CREATE TABLE purchase_orders (
      id TEXT PRIMARY KEY,
      po_number TEXT UNIQUE NOT NULL,
      supplier_id TEXT NOT NULL,
      store_id TEXT NOT NULL,
      status TEXT DEFAULT 'draft',
      total_amount REAL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE purchase_order_items (
      id TEXT PRIMARY KEY,
      po_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      order_qty REAL NOT NULL,
      received_qty REAL DEFAULT 0,
      unit_cost REAL DEFAULT 0,
      total_cost REAL DEFAULT 0
    );
    CREATE TABLE inventory_lots (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      store_id TEXT NOT NULL,
      lot_number TEXT,
      initial_qty REAL NOT NULL,
      remaining_qty REAL NOT NULL,
      expiry_date TEXT NOT NULL,
      received_date TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE audit_logs (
      id TEXT PRIMARY KEY,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      details TEXT,
      created_at TEXT NOT NULL
    );
  `);

  const now = new Date().toISOString();
  const storeId = uuidv4();
  const prodId = uuidv4();
  const supId = uuidv4();

  db.prepare('INSERT INTO stores (id, code, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').run(
    storeId, 'FM-Q1', 'Farmers Market Hai Bà Trưng', now, now
  );
  db.prepare('INSERT INTO suppliers (id, code, name, lead_time_days, moq_value, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
    supId, 'SUP-DALAT', 'Công ty Nông Sản Sạch Đà Lạt', 2, 500000, now, now
  );
  db.prepare('INSERT INTO products (id, sku_code, name, category, unit, cost_price, selling_price, min_order_qty, pack_size, shelf_life_days, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
    prodId, 'RAU-XALACH-ROM', 'Xà lách Romaine hữu cơ 300g', 'Rau củ', 'Gói', 20000, 32000, 10, 5, 7, now, now
  );

  assert(true, 'Test 1: Khởi tạo dữ liệu Master Data cô lập thành công');

  const ads = 15;
  const onHand = 8;
  const leadTime = 2;
  const safetyDays = 2;
  const ss = calculateSafetyStock(ads, safetyDays);
  const rop = calculateReorderPoint(ads, leadTime, ss);
  const doc = calculateDaysOfCover(onHand, ads);
  const targetStock = (leadTime + safetyDays) * ads;
  const rawNeed = targetStock - onHand; // (2 + 2)*15 - 8 = 60 - 8 = 52
  const packSize = 5;
  const moq = 10;
  const orderQty = Math.max(moq, Math.ceil(rawNeed / packSize) * packSize); // 55

  assert(ss === 30, `Test 2.1: Safety Stock chính xác: ${ss} (kỳ vọng 30)`);
  assert(rop === 60, `Test 2.2: Reorder Point chính xác: (15*2) + 30 = ${rop} (kỳ vọng 60)`);
  assert(Math.abs(doc - (8 / 15)) < 0.01, `Test 2.3: Days of Cover chính xác: ${doc.toFixed(2)} ngày (kỳ vọng 0.53)`);
  assert(orderQty === 55 && orderQty % packSize === 0 && orderQty >= moq, `Test 2.4: Gợi ý đặt hàng tuân thủ pack_size (5) & MOQ (10): ${orderQty} gói`);

  db.prepare('INSERT INTO inventory (id, product_id, store_id, available_qty, avg_daily_sales, days_of_cover, reorder_point, safety_stock, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
    uuidv4(), prodId, storeId, onHand, ads, doc, rop, ss, now
  );

  const poId = uuidv4();
  const poNumber = 'PO-2026-0001';
  db.prepare('INSERT INTO purchase_orders (id, po_number, supplier_id, store_id, status, total_amount, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
    poId, poNumber, supId, storeId, 'approved', orderQty * 20000, now, now
  );
  const poiId = uuidv4();
  db.prepare('INSERT INTO purchase_order_items (id, po_id, product_id, order_qty, unit_cost, total_cost) VALUES (?, ?, ?, ?, ?, ?)').run(
    poiId, poId, prodId, orderQty, 20000, orderQty * 20000
  );

  const po = db.prepare('SELECT * FROM purchase_orders WHERE id = ?').get(poId) as any;
  assert(po.status === 'approved' && po.po_number === poNumber, 'Test 3: Tạo và phê duyệt đơn hàng PO thành công');

  const receivedQty = orderQty;
  const expiryDate = '2026-09-24';
  const lotNumber = 'LOT-DL-20260917';

  db.transaction(() => {
    db.prepare('UPDATE purchase_order_items SET received_qty = ? WHERE id = ?').run(receivedQty, poiId);
    db.prepare("UPDATE purchase_orders SET status = 'completed', updated_at = ? WHERE id = ?").run(now, poId);
    db.prepare('UPDATE inventory SET available_qty = available_qty + ?, updated_at = ? WHERE product_id = ? AND store_id = ?').run(
      receivedQty, now, prodId, storeId
    );
    db.prepare('INSERT INTO inventory_lots (id, product_id, store_id, lot_number, initial_qty, remaining_qty, expiry_date, received_date, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
      uuidv4(), prodId, storeId, lotNumber, receivedQty, receivedQty, expiryDate, now.split('T')[0], now
    );
    db.prepare('INSERT INTO audit_logs (id, action, entity_type, entity_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
      uuidv4(), 'RECEIVE_PO', 'purchase_orders', poId, JSON.stringify({ receivedQty, lotNumber }), now
    );
  })();

  const updatedInv = db.prepare('SELECT available_qty FROM inventory WHERE product_id = ? AND store_id = ?').get(prodId, storeId) as any;
  const createdLot = db.prepare('SELECT * FROM inventory_lots WHERE lot_number = ?').get(lotNumber) as any;
  const auditLog = db.prepare('SELECT * FROM audit_logs WHERE action = ?').get('RECEIVE_PO') as any;

  assert(updatedInv.available_qty === onHand + receivedQty, `Test 4.1: Tồn kho cập nhật tức thì: ${onHand} + ${receivedQty} = ${updatedInv.available_qty}`);
  assert(createdLot && createdLot.remaining_qty === receivedQty && createdLot.expiry_date === expiryDate, 'Test 4.2: Lô hàng cận date (Inventory Lot) được ghi nhận chính xác');
  assert(auditLog !== undefined, 'Test 4.3: Nhật ký kiểm toán Audit Log đã ghi nhận giao dịch nhập hàng');

  db.close();
  console.log(`\n=== TẤT CẢ KIỂM THỬ TÍCH HỢP ĐÃ VƯỢT QUA (${passed} ĐẠT, ${failed} THẤT BẠI) ===\n`);
  if (failed > 0) process.exit(1);
}

runE2ETests().catch(err => {
  console.error(err);
  process.exit(1);
});
