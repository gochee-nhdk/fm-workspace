import { getDb } from '../db/connection.js';

export async function parseUserIntent(message: string): Promise<string> {
  const lower = message.toLowerCase();
  if (lower.includes('hết hạn') || lower.includes('cận date') || lower.includes('expiry') || lower.includes('hsd')) return 'near_expiry_check';
  if (lower.includes('tồn kho') || lower.includes('stock') || lower.includes('doh') || lower.includes('doc') || lower.includes('cover')) return 'inventory_check';
  if (lower.includes('đặt hàng') || lower.includes('mua') || lower.includes('order') || lower.includes('reorder') || lower.includes('bổ sung')) return 'procurement_recommendation';
  if (lower.includes('bán') || lower.includes('sales') || lower.includes('doanh số') || lower.includes('doanh thu') || lower.includes('tốc độ bán')) return 'sales_analysis';
  if (lower.includes('điều chuyển') || lower.includes('transfer') || lower.includes('cân đối')) return 'transfer_check';
  if (lower.includes('quy tắc') || lower.includes('sop') || lower.includes('quy trình') || lower.includes('thuật ngữ')) return 'knowledge_query';
  return 'general_query';
}

export async function buildDataContext(intent: string, message: string): Promise<any> {
  const db = getDb();
  const context: any = {};

  // 1. Check workspace entity counts
  const productCount = (db.prepare('SELECT COUNT(*) as count FROM products').get() as any)?.count || 0;
  const storeCount = (db.prepare('SELECT COUNT(*) as count FROM stores').get() as any)?.count || 0;
  const inventoryCount = (db.prepare('SELECT COUNT(*) as count FROM inventory').get() as any)?.count || 0;
  const datasetCount = (db.prepare('SELECT COUNT(*) as count FROM datasets').get() as any)?.count || 0;

  context.workspaceStatus = {
    isZeroData: productCount === 0 && inventoryCount === 0,
    productCount,
    storeCount,
    inventoryCount,
    datasetCount
  };

  // 2. Load active company terminology
  context.companyTerminology = db.prepare(`SELECT term, meaning, standard_term FROM company_terminology WHERE status = 'active'`).all();

  // 3. Load active business rules
  context.businessRules = db.prepare(`SELECT rule_code, name, category, description, condition_logic, action_logic FROM business_rules WHERE status = 'active'`).all();

  // 4. Load company SOP documents summaries
  context.activeSOPs = db.prepare(`SELECT title, doc_type, summary, applicable_scope FROM company_knowledge WHERE status = 'active' LIMIT 5`).all();

  // 5. Query specific operational data based on intent if data exists
  if (!context.workspaceStatus.isZeroData) {
    if (intent === 'inventory_check') {
      context.inventorySummary = db.prepare(`
        SELECT p.name as product_name, p.sku_code, s.name as store_name, i.available_qty
        FROM inventory i
        JOIN products p ON i.product_id = p.id
        JOIN stores s ON i.store_id = s.id
        ORDER BY i.available_qty ASC
        LIMIT 25
      `).all();
    } else if (intent === 'procurement_recommendation') {
      context.recommendations = db.prepare(`
        SELECT pr.*, p.name as product_name, p.sku_code, s.name as store_name
        FROM purchase_recommendations pr
        JOIN products p ON pr.product_id = p.id
        JOIN stores s ON pr.store_id = s.id
        WHERE pr.status = 'pending'
        LIMIT 25
      `).all();
    } else if (intent === 'near_expiry_check') {
      context.nearExpiryLots = db.prepare(`
        SELECT el.*, p.sku_code, p.name as product_name, s.name as store_name,
               CAST((julianday(el.expiry_date) - julianday('now')) AS INTEGER) as days_remaining
        FROM expiry_lots el
        JOIN products p ON el.product_id = p.id
        JOIN stores s ON el.store_id = s.id
        WHERE el.status = 'active'
        ORDER BY el.expiry_date ASC
        LIMIT 20
      `).all();
    } else if (intent === 'sales_analysis') {
      context.recentSales = db.prepare(`
        SELECT p.sku_code, p.name as product_name, SUM(s.quantity) as total_qty, SUM(s.revenue) as total_rev
        FROM sales s
        JOIN products p ON s.product_id = p.id
        GROUP BY p.id
        ORDER BY total_rev DESC
        LIMIT 20
      `).all();
    }
  }

  // 6. System settings
  context.systemSettings = db.prepare("SELECT key, value FROM system_settings WHERE category IN ('procurement', 'inventory', 'sales')").all();

  return context;
}
