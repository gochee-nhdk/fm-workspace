import { FastifyInstance } from 'fastify';
import { getDb } from '../db/connection.js';
import { verifyToken } from '../middleware/auth.js';

export default async function searchRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', verifyToken);

  fastify.get('/', async (request: any, reply) => {
    const { q = '' } = request.query;
    if (!q) return { success: true, data: [] };
    
    const term = `%${q}%`;
    const db = getDb();
    const results: any[] = [];
    
    // Products
    const products = db.prepare('SELECT id, name as title, sku_code as subtitle FROM products WHERE name LIKE ? OR sku_code LIKE ? LIMIT 3').all(term, term) as any[];
    results.push(...products.map(p => ({ type: 'product', id: p.id, title: p.title, subtitle: p.subtitle, url: `/products/${p.id}` })));
    
    // Stores
    const stores = db.prepare('SELECT id, name as title, code as subtitle FROM stores WHERE name LIKE ? OR code LIKE ? LIMIT 3').all(term, term) as any[];
    results.push(...stores.map(s => ({ type: 'store', id: s.id, title: s.title, subtitle: s.subtitle, url: `/stores/${s.id}` })));
    
    // Suppliers
    const suppliers = db.prepare('SELECT id, name as title, code as subtitle FROM suppliers WHERE name LIKE ? OR code LIKE ? LIMIT 3').all(term, term) as any[];
    results.push(...suppliers.map(s => ({ type: 'supplier', id: s.id, title: s.title, subtitle: s.subtitle, url: `/suppliers/${s.id}` })));
    
    // Purchase Orders
    const pos = db.prepare('SELECT id, po_number as title, status as subtitle FROM purchase_orders WHERE po_number LIKE ? LIMIT 3').all(term) as any[];
    results.push(...pos.map(po => ({ type: 'purchase_order', id: po.id, title: po.title, subtitle: po.subtitle, url: `/procurement/orders/${po.id}` })));
    
    return { success: true, data: results.slice(0, 10) };
  });
}
