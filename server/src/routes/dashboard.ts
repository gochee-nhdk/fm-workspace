import { FastifyInstance } from 'fastify';
import { getDb } from '../db/connection.js';
import { verifyToken } from '../middleware/auth.js';

export default async function dashboardRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', verifyToken);

  fastify.get('/summary', async (request: any, reply) => {
    const db = getDb();
    const { store_id } = request.query || {};
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // 1. Basic counts
    const totalSkusRes = (await db.prepare('SELECT COUNT(*) as count FROM products WHERE is_active = 1').get()) as any;
    const totalSkus = totalSkusRes?.count || 0;

    const totalStoresRes = (await db.prepare('SELECT COUNT(*) as count FROM stores WHERE is_active = 1').get()) as any;
    const totalStores = totalStoresRes?.count || 0;

    // 2. Inventory valuation (filtered by store if requested)
    let invValQuery = `
      SELECT SUM(i.available_qty * COALESCE(ps.cost_price, 0)) as total
      FROM inventory i
      LEFT JOIN product_suppliers ps ON i.product_id = ps.product_id AND ps.is_primary = 1
    `;
    const invValParams: any[] = [];
    if (store_id) {
      invValQuery += ' WHERE i.store_id = ?';
      invValParams.push(store_id);
    }
    const inventoryValRow = (await db.prepare(invValQuery).get(...invValParams)) as any;
    const inventoryValue = inventoryValRow?.total || 0;

    // 3. Stockout risk count (available_qty <= 0)
    let stockoutQuery = 'SELECT COUNT(DISTINCT product_id) as count FROM inventory WHERE available_qty <= 0';
    const stockoutParams: any[] = [];
    if (store_id) {
      stockoutQuery += ' AND store_id = ?';
      stockoutParams.push(store_id);
    }
    const stockoutRiskRes = (await db.prepare(stockoutQuery).get(...stockoutParams)) as any;
    const stockoutRiskCount = stockoutRiskRes?.count || 0;

    // 4. Near expiry count (active lots expiring within 7 days) & Expired count
    let nearExpiryQuery = "SELECT COUNT(*) as count FROM expiry_lots WHERE status = 'active' AND expiry_date <= ? AND expiry_date >= ?";
    const nearExpiryParams: any[] = [sevenDaysLater, todayStr];
    if (store_id) {
      nearExpiryQuery += ' AND store_id = ?';
      nearExpiryParams.push(store_id);
    }
    const nearExpiryRes = (await db.prepare(nearExpiryQuery).get(...nearExpiryParams)) as any;
    const nearExpiryCount = nearExpiryRes?.count || 0;

    let expiredQuery = "SELECT COUNT(*) as count FROM expiry_lots WHERE status = 'active' AND expiry_date < ?";
    const expiredParams: any[] = [todayStr];
    if (store_id) {
      expiredQuery += ' AND store_id = ?';
      expiredParams.push(store_id);
    }
    const expiredRes = (await db.prepare(expiredQuery).get(...expiredParams)) as any;
    const expiredCount = expiredRes?.count || 0;

    // 5. Open purchase orders count
    let openPoQuery = "SELECT COUNT(*) as count FROM purchase_orders WHERE status NOT IN ('received', 'cancelled')";
    const openPoParams: any[] = [];
    if (store_id) {
      openPoQuery += ' AND store_id = ?';
      openPoParams.push(store_id);
    }
    const openPoRes = (await db.prepare(openPoQuery).get(...openPoParams)) as any;
    const openPoCount = openPoRes?.count || 0;

    // 6. Today sales revenue (or recent day)
    let salesTodayQuery = 'SELECT SUM(revenue) as revenue FROM sales WHERE sale_date = ?';
    const salesTodayParams: any[] = [todayStr];
    if (store_id) {
      salesTodayQuery += ' AND store_id = ?';
      salesTodayParams.push(store_id);
    }
    const salesTodayRow = (await db.prepare(salesTodayQuery).get(...salesTodayParams)) as any;
    const todaySalesRevenue = salesTodayRow?.revenue || 0;

    // 7. Recent sales trend (last 7 days)
    let salesTrendQuery = 'SELECT sale_date as date, SUM(revenue) as revenue, SUM(quantity) as quantity FROM sales';
    const salesTrendParams: any[] = [];
    if (store_id) {
      salesTrendQuery += ' WHERE store_id = ?';
      salesTrendParams.push(store_id);
    }
    salesTrendQuery += ' GROUP BY sale_date ORDER BY sale_date DESC LIMIT 7';
    const salesTrendRows = (await db.prepare(salesTrendQuery).all(...salesTrendParams)) as any[];
    const salesTrend = salesTrendRows.reverse();

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

    if (expiredCount > 0) {
      priorities.push({
        id: 'expired-stock',
        type: 'expired',
        title: `${expiredCount} lô hàng đã hết hạn sử dụng cần xử lý tiêu hủy hoặc đổi trả gấp.`,
        severity: 'critical',
        actionUrl: '/inventory/near-expiry'
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
        expiredCount,
        openPoCount,
        todaySalesRevenue,
        salesTrend,
        priorities
      }
    };
  });
}
