import { getDb } from './connection.js';
import * as argon2 from 'argon2';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);

async function initDb() {
  const db = getDb();

  console.log('Initializing database tables...');

  db.exec(`
    -- Users & Auth
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE,
      full_name TEXT,
      password_hash TEXT,
      role TEXT DEFAULT 'staff',
      is_active INTEGER DEFAULT 1,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id),
      refresh_token_hash TEXT,
      token_family TEXT,
      expires_at TEXT,
      created_at TEXT
    );

    -- Master Data
    CREATE TABLE IF NOT EXISTS regions (
      id TEXT PRIMARY KEY,
      name TEXT,
      code TEXT UNIQUE
    );

    CREATE TABLE IF NOT EXISTS stores (
      id TEXT PRIMARY KEY,
      name TEXT,
      code TEXT UNIQUE,
      region_id TEXT REFERENCES regions(id),
      address TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT,
      parent_id TEXT REFERENCES categories(id),
      level INTEGER DEFAULT 0,
      sort_order INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS brands (
      id TEXT PRIMARY KEY,
      name TEXT
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      sku_code TEXT UNIQUE,
      name TEXT,
      category_id TEXT REFERENCES categories(id),
      brand_id TEXT REFERENCES brands(id),
      unit TEXT DEFAULT 'piece',
      barcode TEXT,
      shelf_life_days INTEGER,
      is_active INTEGER DEFAULT 1,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS suppliers (
      id TEXT PRIMARY KEY,
      name TEXT,
      code TEXT UNIQUE,
      contact_name TEXT,
      phone TEXT,
      email TEXT,
      address TEXT,
      lead_time_days INTEGER DEFAULT 3,
      payment_terms TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS product_suppliers (
      id TEXT PRIMARY KEY,
      product_id TEXT REFERENCES products(id),
      supplier_id TEXT REFERENCES suppliers(id),
      cost_price REAL,
      moq INTEGER DEFAULT 1,
      order_multiple INTEGER DEFAULT 1,
      is_primary INTEGER DEFAULT 0,
      UNIQUE(product_id, supplier_id)
    );

    -- Transactional
    CREATE TABLE IF NOT EXISTS sales (
      id TEXT PRIMARY KEY,
      store_id TEXT REFERENCES stores(id),
      product_id TEXT REFERENCES products(id),
      sale_date TEXT,
      quantity REAL,
      revenue REAL,
      created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS inventory (
      id TEXT PRIMARY KEY,
      store_id TEXT REFERENCES stores(id),
      product_id TEXT REFERENCES products(id),
      quantity REAL DEFAULT 0,
      available_qty REAL DEFAULT 0,
      reserved_qty REAL DEFAULT 0,
      damaged_qty REAL DEFAULT 0,
      updated_at TEXT,
      UNIQUE(store_id, product_id)
    );

    CREATE TABLE IF NOT EXISTS expiry_lots (
      id TEXT PRIMARY KEY,
      store_id TEXT REFERENCES stores(id),
      product_id TEXT REFERENCES products(id),
      lot_number TEXT,
      quantity REAL,
      expiry_date TEXT,
      status TEXT DEFAULT 'active',
      created_at TEXT
    );

    -- Procurement
    CREATE TABLE IF NOT EXISTS purchase_orders (
      id TEXT PRIMARY KEY,
      po_number TEXT UNIQUE,
      supplier_id TEXT REFERENCES suppliers(id),
      store_id TEXT REFERENCES stores(id),
      status TEXT DEFAULT 'draft',
      order_date TEXT,
      expected_date TEXT,
      received_date TEXT,
      total_value REAL DEFAULT 0,
      notes TEXT,
      created_by TEXT REFERENCES users(id),
      approved_by TEXT REFERENCES users(id),
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS po_items (
      id TEXT PRIMARY KEY,
      po_id TEXT REFERENCES purchase_orders(id),
      product_id TEXT REFERENCES products(id),
      ordered_qty REAL,
      received_qty REAL DEFAULT 0,
      unit_price REAL,
      status TEXT DEFAULT 'pending'
    );

    CREATE TABLE IF NOT EXISTS purchase_recommendations (
      id TEXT PRIMARY KEY,
      store_id TEXT REFERENCES stores(id),
      product_id TEXT REFERENCES products(id),
      recommended_qty REAL,
      reason TEXT,
      confidence TEXT,
      risk_level TEXT,
      calculation_data TEXT,
      status TEXT DEFAULT 'pending',
      created_by TEXT,
      created_at TEXT
    );

    -- Stock Transfer
    CREATE TABLE IF NOT EXISTS stock_transfers (
      id TEXT PRIMARY KEY,
      transfer_number TEXT UNIQUE,
      from_store_id TEXT REFERENCES stores(id),
      to_store_id TEXT REFERENCES stores(id),
      status TEXT DEFAULT 'draft',
      requested_by TEXT REFERENCES users(id),
      approved_by TEXT REFERENCES users(id),
      notes TEXT,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS transfer_items (
      id TEXT PRIMARY KEY,
      transfer_id TEXT REFERENCES stock_transfers(id),
      product_id TEXT REFERENCES products(id),
      quantity REAL,
      reason TEXT
    );

    -- Analytics
    CREATE TABLE IF NOT EXISTS forecasts (
      id TEXT PRIMARY KEY,
      store_id TEXT REFERENCES stores(id),
      product_id TEXT REFERENCES products(id),
      forecast_date TEXT,
      forecasted_qty REAL,
      method TEXT,
      confidence REAL
    );

    CREATE TABLE IF NOT EXISTS anomalies (
      id TEXT PRIMARY KEY,
      type TEXT,
      entity_type TEXT,
      entity_id TEXT,
      description TEXT,
      severity TEXT,
      detected_at TEXT,
      resolved_at TEXT
    );

    -- AI
    CREATE TABLE IF NOT EXISTS ai_conversations (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id),
      title TEXT,
      created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS ai_messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT REFERENCES ai_conversations(id),
      role TEXT,
      content TEXT,
      data_context TEXT,
      created_at TEXT
    );

    -- System
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      type TEXT,
      title TEXT,
      message TEXT,
      severity TEXT DEFAULT 'info',
      is_read INTEGER DEFAULT 0,
      entity_type TEXT,
      entity_id TEXT,
      created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      user_name TEXT,
      action TEXT,
      entity_type TEXT,
      entity_id TEXT,
      before_data TEXT,
      after_data TEXT,
      reason TEXT,
      ip_address TEXT,
      created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS data_imports (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      file_name TEXT,
      entity_type TEXT,
      total_rows INTEGER DEFAULT 0,
      success_rows INTEGER DEFAULT 0,
      error_rows INTEGER DEFAULT 0,
      status TEXT DEFAULT 'pending',
      errors TEXT,
      created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS system_settings (
      id TEXT PRIMARY KEY,
      key TEXT UNIQUE,
      value TEXT,
      category TEXT,
      description TEXT,
      updated_by TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS store_product_settings (
      id TEXT PRIMARY KEY,
      store_id TEXT REFERENCES stores(id),
      product_id TEXT REFERENCES products(id),
      safety_stock REAL,
      reorder_point REAL,
      target_days_of_cover REAL,
      min_order_qty REAL,
      max_stock REAL,
      UNIQUE(store_id, product_id)
    );

    -- Company Knowledge Base (SOP, Procedures, Rules, Terminology)
    CREATE TABLE IF NOT EXISTS company_knowledge (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      doc_type TEXT DEFAULT 'sop',
      content TEXT,
      summary TEXT,
      source TEXT,
      version INTEGER DEFAULT 1,
      department TEXT,
      applicable_scope TEXT,
      effective_date TEXT,
      status TEXT DEFAULT 'active', -- draft, review, approved, active, superseded, archived
      superseded_by TEXT,
      metadata TEXT, -- JSON
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS company_terminology (
      id TEXT PRIMARY KEY,
      term TEXT UNIQUE NOT NULL,
      meaning TEXT NOT NULL,
      standard_term TEXT,
      usage_context TEXT,
      status TEXT DEFAULT 'active', -- candidate, active, deprecated
      created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS business_rules (
      id TEXT PRIMARY KEY,
      rule_code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      category TEXT DEFAULT 'general', -- ordering, moq, lead_time, inventory, safety_stock, short_date, transfer, approval
      description TEXT,
      condition_logic TEXT, -- JSON
      action_logic TEXT,    -- JSON
      priority INTEGER DEFAULT 10,
      status TEXT DEFAULT 'active', -- draft, active, inactive, superseded
      created_by TEXT,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS user_feedback (
      id TEXT PRIMARY KEY,
      context_type TEXT,
      user_correction TEXT NOT NULL,
      ai_claim TEXT,
      reason TEXT,
      source TEXT,
      status TEXT DEFAULT 'candidate', -- candidate, reviewed, confirmed, rejected
      created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS data_conflicts (
      id TEXT PRIMARY KEY,
      source_a TEXT,
      source_b TEXT,
      entity_type TEXT,
      entity_id TEXT,
      description TEXT,
      potential_impact TEXT,
      status TEXT DEFAULT 'detected', -- detected, investigating, resolved
      created_at TEXT,
      resolved_at TEXT
    );

    CREATE TABLE IF NOT EXISTS datasets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      version INTEGER DEFAULT 1,
      file_name TEXT,
      file_size INTEGER DEFAULT 0,
      row_count INTEGER DEFAULT 0,
      entity_type TEXT,
      quality_score REAL DEFAULT 100,
      status TEXT DEFAULT 'ready', -- ingesting, validating, normalizing, indexing, ready, error
      columns_mapped TEXT, -- JSON
      error_summary TEXT,  -- JSON
      uploaded_by TEXT,
      created_at TEXT
    );
  `);

  console.log('Tables created. Creating indices...');

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(sale_date);
    CREATE INDEX IF NOT EXISTS idx_po_number ON purchase_orders(po_number);
    CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku_code);
    CREATE INDEX IF NOT EXISTS idx_po_status ON purchase_orders(status);
    CREATE INDEX IF NOT EXISTS idx_expiry_date ON expiry_lots(expiry_date);
  `);

  console.log('Indices created. Checking default admin user...');

  const now = new Date().toISOString();

  // Create default admin user
  const adminExists = db.prepare('SELECT id FROM users WHERE email = ?').get('admin@farmersmarket.vn');
  if (!adminExists) {
    const passwordHash = await argon2.hash('admin123');
    db.prepare(`
      INSERT INTO users (id, email, full_name, password_hash, role, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(uuidv4(), 'admin@farmersmarket.vn', 'System Administrator', passwordHash, 'admin', now, now);
    console.log('Default admin user created.');
  }

  // Insert default settings
  const defaultSettings = [
    { key: 'currency', value: 'VND', category: 'general' },
    { key: 'date_format', value: 'DD/MM/YYYY', category: 'general' },
    { key: 'days_of_cover_critical', value: '2', category: 'inventory' },
    { key: 'days_of_cover_low', value: '5', category: 'inventory' },
    { key: 'days_of_cover_healthy_max', value: '30', category: 'inventory' },
    { key: 'near_expiry_critical', value: '3', category: 'inventory' },
    { key: 'near_expiry_warning', value: '7', category: 'inventory' },
    { key: 'near_expiry_monitor', value: '14', category: 'inventory' },
    { key: 'sales_velocity_fast', value: '10', category: 'sales' },
    { key: 'sales_velocity_normal', value: '3', category: 'sales' },
    { key: 'default_safety_days', value: '3', category: 'procurement' },
    { key: 'default_review_period', value: '7', category: 'procurement' },
    { key: 'gemini_api_key', value: '', category: 'ai' },
    { key: 'gemini_model', value: 'gemini-2.5-flash', category: 'ai' },
    { key: 'sample_data_mode', value: 'false', category: 'system' }
  ];

  const insertSetting = db.prepare(`
    INSERT OR IGNORE INTO system_settings (id, key, value, category, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `);

  for (const setting of defaultSettings) {
    insertSetting.run(uuidv4(), setting.key, setting.value, setting.category, now);
  }
  
  console.log('Database initialization complete.');
}

// Run if called directly as standalone script (e.g. npm run db:init)
if (process.argv[1] && (process.argv[1].endsWith('init.ts') || process.argv[1].endsWith('init.js'))) {
  initDb().catch(console.error);
}

export { initDb };
