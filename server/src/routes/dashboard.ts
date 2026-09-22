import { FastifyInstance } from 'fastify';
import { getDb } from '../db/connection.js';
import { verifyToken } from '../middleware/auth.js';

export default async function dashboardRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', verifyToken);

  fastify.get('/summary', async (request, reply) => {
    const db = getDb();
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // 1. Basic counts
    const totalSkus = (db.prepare('SELECT COUNT(*) as count FROM products WHERE is_active = 1').get() as any)?.count || 0;
    const totalStores = (db.prepare('SELECT COUNT(*) as count FROM stores WHERE is_active = 1').get() as any)?.count || 0;

    // 2. Inventory valuation
    const inventoryValRow = db.prepare(`
      SELECT SUM(i.available_qty * COALESCE(ps.cost_price, 0)) as total
      FROM inventory i
      LEFT JOIN product_suppliers ps ON i.product_id = ps.product_id AND ps.is_primary = 1
    `).get() as any;
    const inventoryValue = inventoryValRow?.total || 0;

    // 3. Stockout risk count (available_qty <= 0 or pending recommendations)
    const stockoutRiskCount = (db.prepare(`
      SELECT COUNT(DISTINCT product_id) as count
      FROM inventory
      WHERE available_qty <= 0
    `).get() as any)?.count || 0;

    // 4. Near expiry count (active lots expiring within 7 days)
    const nearExpiryCount = (db.prepare(`
      SELECT COUNT(*) as count
      FROM expiry_lots
      WHERE status = 'active' AND expiry_date <= ? AND expiry_date >= ?
    `).get(sevenDaysLater, todayStr) as any)?.count || 0;

    // 5. Open purchase orders count
    const openPoCount = (db.prepare(`
      SELECT COUNT(*) as count
      FROM purchase_orders
      WHERE status NOT IN ('received', 'cancelled')
    `).get() as any)?.count || 0;

    // 6. Today sales revenue (or recent day)
    const salesTodayRow = db.prepare(`
      SELECT SUM(revenue) as revenue
      FROM sales
      WHERE sale_date = ?
    `).get(todayStr) as any;
    const todaySalesRevenue = salesTodayRow?.revenue || 0;

    // 7. Recent sales trend (last 7 days)
    const salesTrend = db.prepare(`
      SELECT sale_date as date, SUM(revenue) as revenue, SUM(quantity) as quantity
      FROM sales
      GROUP BY sale_date
      ORDER BY sale_date DESC
      LIMIT 7
    `).all().reverse();

    // 8. Dynamic priorities list
    const priorities: Array<{ id: string; type: string; title: string; severity: 'critical' | 'high' | 'medium' | 'low'; actionUrl: string }> = [];

    if (totalSkus === 0) {
      priorities.push({
        id: 'zero-data-onboarding',
        type: 'onboarding',
        title: 'Chưa có dữ liệu nào trong không gian làm việc. Bắt đầu bằng việc nạp file Excel/CSV.',
        severity: 'critical',
        actionUrl: '/data-center'
      });
    }

    if (stockoutRiskCount > 0) {
      priorities.push({
        id: 'stockout-risk',
        type: 'stockout',
        title: `${stockoutRiskCount} sản phẩm có nguy cơ hết hàng hoặc tồn kho bằng 0 cần bổ sung.`,
        severity: 'critical',
        actionUrl: '/procurement/planning'
      });
    }

    if (nearExpiryCount > 0) {
      priorities.push({
        id: 'near-expiry',
        type: 'expiry',
        title: `${nearExpiryCount} lô hàng có hạn dùng dưới 7 ngày cần ưu tiên đẩy bán hoặc điều chuyển.`,
        severity: 'high',
        actionUrl: '/inventory/near-expiry'
      });
    }

    if (openPoCount > 0) {
      priorities.push({
        id: 'open-po',
        type: 'po',
        title: `${openPoCount} đơn đặt hàng (PO) đang mở cần theo dõi tiến độ giao hàng.`,
        severity: 'medium',
        actionUrl: '/procurement/orders'
      });
    }

    const systemState = totalSkus === 0 ? 'EMPTY' : 'READY';

    return {
      success: true,
      data: {
        systemState,
        totalSkus,
        totalStores,
        inventoryValue,
        stockoutRiskCount,
        nearExpiryCount,
        openPoCount,
        todaySalesRevenue,
        salesTrend,
        priorities
      }
    };
  });
}
