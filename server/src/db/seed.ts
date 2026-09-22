import { getDb } from './connection.js';
import { v4 as uuidv4 } from 'uuid';
import { subDays, addDays } from 'date-fns';

async function seedDb() {
  const db = getDb();
  
  // Check if sample_data_mode is already true
  const sampleMode = db.prepare('SELECT value FROM system_settings WHERE key = ?').get('sample_data_mode') as any;
  if (sampleMode && sampleMode.value === 'true') {
    console.log('Sample data already seeded.');
    return;
  }

  console.log('Seeding database with sample data...');

  const now = new Date();
  
  // 1. Regions
  const regions = [
    { id: uuidv4(), name: 'Hồ Chí Minh', code: 'HCM' },
    { id: uuidv4(), name: 'Hà Nội', code: 'HN' },
    { id: uuidv4(), name: 'Đà Nẵng', code: 'DN' }
  ];
  const insertRegion = db.prepare('INSERT INTO regions (id, name, code) VALUES (?, ?, ?)');
  regions.forEach(r => insertRegion.run(r.id, r.name, r.code));

  // 2. Stores
  const stores = [
    { id: uuidv4(), name: 'Farmers Market Thảo Điền', code: 'FM-TD', region_id: regions[0].id, address: 'Thảo Điền, Q2, HCM' },
    { id: uuidv4(), name: 'Farmers Market Phú Mỹ Hưng', code: 'FM-PMH', region_id: regions[0].id, address: 'PMH, Q7, HCM' },
    { id: uuidv4(), name: 'Farmers Market Tân Bình', code: 'FM-TB', region_id: regions[0].id, address: 'Tân Bình, HCM' },
    { id: uuidv4(), name: 'Farmers Market Hà Nội', code: 'FM-HN1', region_id: regions[1].id, address: 'Cầu Giấy, HN' },
    { id: uuidv4(), name: 'Farmers Market Đà Nẵng', code: 'FM-DN1', region_id: regions[2].id, address: 'Hải Châu, ĐN' }
  ];
  const insertStore = db.prepare('INSERT INTO stores (id, name, code, region_id, address, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
  stores.forEach(s => insertStore.run(s.id, s.name, s.code, s.region_id, s.address, now.toISOString(), now.toISOString()));

  // 3. Categories
  const categories = [
    { id: uuidv4(), name: 'Rau củ', level: 0 },
    { id: uuidv4(), name: 'Trái cây', level: 0 },
    { id: uuidv4(), name: 'Thịt', level: 0 },
    { id: uuidv4(), name: 'Hải sản', level: 0 },
    { id: uuidv4(), name: 'Sữa & Bơ', level: 0 }
  ];
  const insertCategory = db.prepare('INSERT INTO categories (id, name, level) VALUES (?, ?, ?)');
  categories.forEach(c => insertCategory.run(c.id, c.name, c.level));

  // 4. Brands
  const brands = [
    { id: uuidv4(), name: 'Đà Lạt Hasfarm' },
    { id: uuidv4(), name: 'Vinamilk' },
    { id: uuidv4(), name: 'CP' },
    { id: uuidv4(), name: 'Ba Huân' },
    { id: uuidv4(), name: 'Local Farms' }
  ];
  const insertBrand = db.prepare('INSERT INTO brands (id, name) VALUES (?, ?)');
  brands.forEach(b => insertBrand.run(b.id, b.name));

  // 5. Products
  const products = [
    { id: uuidv4(), sku_code: 'RC-001', name: 'Xà lách thủy canh 500g', category_id: categories[0].id, brand_id: brands[0].id, shelf_life_days: 7 },
    { id: uuidv4(), sku_code: 'RC-002', name: 'Cà chua cherry 250g', category_id: categories[0].id, brand_id: brands[0].id, shelf_life_days: 10 },
    { id: uuidv4(), sku_code: 'TC-001', name: 'Táo Mỹ Envy', category_id: categories[1].id, brand_id: brands[4].id, shelf_life_days: 14 },
    { id: uuidv4(), sku_code: 'TH-001', name: 'Thịt bò Úc 500g', category_id: categories[2].id, brand_id: brands[4].id, shelf_life_days: 5 },
    { id: uuidv4(), sku_code: 'SU-001', name: 'Sữa tươi thanh trùng 1L', category_id: categories[4].id, brand_id: brands[1].id, shelf_life_days: 10 }
  ];
  const insertProduct = db.prepare('INSERT INTO products (id, sku_code, name, category_id, brand_id, shelf_life_days, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  products.forEach(p => insertProduct.run(p.id, p.sku_code, p.name, p.category_id, p.brand_id, p.shelf_life_days, now.toISOString(), now.toISOString()));

  // 6. Suppliers
  const suppliers = [
    { id: uuidv4(), name: 'Công ty Nông Sản Đà Lạt', code: 'SUP-DL', lead_time: 2 },
    { id: uuidv4(), name: 'Nhà phân phối Vinamilk', code: 'SUP-VNM', lead_time: 1 },
    { id: uuidv4(), name: 'CP Food Việt Nam', code: 'SUP-CP', lead_time: 2 }
  ];
  const insertSupplier = db.prepare('INSERT INTO suppliers (id, name, code, lead_time_days, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)');
  suppliers.forEach(s => insertSupplier.run(s.id, s.name, s.code, s.lead_time, now.toISOString(), now.toISOString()));

  // 7. Product Suppliers mapping
  const insertProdSupp = db.prepare('INSERT INTO product_suppliers (id, product_id, supplier_id, cost_price, moq) VALUES (?, ?, ?, ?, ?)');
  insertProdSupp.run(uuidv4(), products[0].id, suppliers[0].id, 15000, 20);
  insertProdSupp.run(uuidv4(), products[1].id, suppliers[0].id, 25000, 20);
  insertProdSupp.run(uuidv4(), products[4].id, suppliers[1].id, 35000, 50);

  // 8. Inventory
  const insertInv = db.prepare('INSERT INTO inventory (id, store_id, product_id, quantity, available_qty, updated_at) VALUES (?, ?, ?, ?, ?, ?)');
  for (const s of stores) {
    for (const p of products) {
      const qty = Math.floor(Math.random() * 50) + 5;
      insertInv.run(uuidv4(), s.id, p.id, qty, qty, now.toISOString());
    }
  }

  // 9. Sales (90 days history)
  const insertSale = db.prepare('INSERT INTO sales (id, store_id, product_id, sale_date, quantity, revenue, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
  db.exec('BEGIN TRANSACTION');
  for (let i = 0; i < 90; i++) {
    const saleDate = subDays(now, i).toISOString();
    for (const s of stores) {
      for (const p of products) {
        if (Math.random() > 0.3) {
          const qty = Math.floor(Math.random() * 10) + 1;
          insertSale.run(uuidv4(), s.id, p.id, saleDate, qty, qty * 45000, saleDate);
        }
      }
    }
  }
  db.exec('COMMIT');

  db.prepare("UPDATE system_settings SET value = 'true' WHERE key = 'sample_data_mode'").run();
  
  console.log('Sample data seeded successfully.');
}

if (process.argv[1].endsWith('seed.ts') || process.argv[1].endsWith('seed.js')) {
  seedDb().catch(console.error);
}

export { seedDb };
