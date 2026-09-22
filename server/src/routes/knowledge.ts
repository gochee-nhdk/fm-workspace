import { FastifyInstance } from 'fastify';
import { verifyToken, requireRole } from '../middleware/auth.js';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/connection.js';

export default async function knowledgeRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', verifyToken);

  /**
   * 1. GET /api/knowledge: List company SOPs, documents, procedures
   */
  fastify.get('/', async (request: any, reply) => {
    const db = getDb();
    const docs = db.prepare(`
      SELECT * FROM company_knowledge
      WHERE status != 'archived'
      ORDER BY updated_at DESC
    `).all();

    return { success: true, data: docs };
  });

  /**
   * 2. POST /api/knowledge: Create a new knowledge doc (SOP, procedure)
   */
  fastify.post('/', async (request: any, reply) => {
    const { title, doc_type, content, summary, source, version, department, applicable_scope } = request.body || {};
    if (!title || !content) {
      return reply.code(400).send({ success: false, message: 'Tiêu đề và nội dung là bắt buộc.' });
    }

    const db = getDb();
    const id = uuidv4();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO company_knowledge (
        id, title, doc_type, content, summary, source, version, department,
        applicable_scope, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
    `).run(
      id, title, doc_type || 'sop', content, summary || content.slice(0, 200),
      source || 'manual', version || 1, department || 'Procurement', applicable_scope || 'All',
      now, now
    );

    return { success: true, data: { id, message: 'Đã lưu tài liệu vào Cơ sở tri thức.' } };
  });

  /**
   * 3. GET /api/knowledge/terminology: Get company-specific glossary
   */
  fastify.get('/terminology', async (request: any, reply) => {
    const db = getDb();
    const terms = db.prepare('SELECT * FROM company_terminology ORDER BY term ASC').all();
    return { success: true, data: terms };
  });

  /**
   * 4. POST /api/knowledge/terminology: Add/Update term
   */
  fastify.post('/terminology', async (request: any, reply) => {
    const { term, meaning, standard_term, usage_context } = request.body || {};
    if (!term || !meaning) {
      return reply.code(400).send({ success: false, message: 'Thuật ngữ và giải nghĩa là bắt buộc.' });
    }

    const db = getDb();
    const id = uuidv4();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO company_terminology (id, term, meaning, standard_term, usage_context, status, created_at)
      VALUES (?, ?, ?, ?, ?, 'active', ?)
      ON CONFLICT(term) DO UPDATE SET
        meaning = excluded.meaning,
        standard_term = excluded.standard_term,
        usage_context = excluded.usage_context
    `).run(id, term.trim(), meaning.trim(), standard_term || null, usage_context || null, now);

    return { success: true, message: 'Đã cập nhật thuật ngữ vào hệ thống.' };
  });

  /**
   * 5. GET /api/knowledge/rules: Get active business rules
   */
  fastify.get('/rules', async (request: any, reply) => {
    const db = getDb();
    const rules = db.prepare('SELECT * FROM business_rules ORDER BY priority ASC, created_at DESC').all();
    return { success: true, data: rules };
  });

  /**
   * 6. POST /api/knowledge/rules: Add a business rule
   */
  fastify.post('/rules', async (request: any, reply) => {
    const { rule_code, name, category, description, condition_logic, action_logic, priority } = request.body || {};
    if (!rule_code || !name) {
      return reply.code(400).send({ success: false, message: 'Mã quy tắc và tên quy tắc là bắt buộc.' });
    }

    const db = getDb();
    const id = uuidv4();
    const now = new Date().toISOString();
    const userId = request.user?.id || 'admin';

    db.prepare(`
      INSERT INTO business_rules (
        id, rule_code, name, category, description, condition_logic, action_logic,
        priority, status, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)
      ON CONFLICT(rule_code) DO UPDATE SET
        name = excluded.name,
        category = excluded.category,
        description = excluded.description,
        condition_logic = excluded.condition_logic,
        action_logic = excluded.action_logic,
        priority = excluded.priority,
        updated_at = excluded.updated_at
    `).run(
      id, rule_code, name, category || 'general', description || '',
      JSON.stringify(condition_logic || {}), JSON.stringify(action_logic || {}),
      priority || 10, userId, now, now
    );

    return { success: true, message: 'Đã lưu quy tắc nghiệp vụ.' };
  });

  /**
   * 7. GET /api/knowledge/inspect: "What does the AI know?"
   * Checks counts of all loaded business entities and highlights missing data points
   */
  fastify.get('/inspect', async (request: any, reply) => {
    const db = getDb();

    // 1. Entities known
    const storeCount = (db.prepare('SELECT COUNT(*) as count FROM stores').get() as any)?.count || 0;
    const productCount = (db.prepare('SELECT COUNT(*) as count FROM products').get() as any)?.count || 0;
    const supplierCount = (db.prepare('SELECT COUNT(*) as count FROM suppliers').get() as any)?.count || 0;
    const datasetCount = (db.prepare('SELECT COUNT(*) as count FROM datasets').get() as any)?.count || 0;
    const inventoryCount = (db.prepare('SELECT COUNT(*) as count FROM inventory').get() as any)?.count || 0;
    const salesCount = (db.prepare('SELECT COUNT(*) as count FROM sales').get() as any)?.count || 0;
    const knowledgeCount = (db.prepare("SELECT COUNT(*) as count FROM company_knowledge WHERE status = 'active'").get() as any)?.count || 0;
    const ruleCount = (db.prepare("SELECT COUNT(*) as count FROM business_rules WHERE status = 'active'").get() as any)?.count || 0;
    const termCount = (db.prepare("SELECT COUNT(*) as count FROM company_terminology WHERE status = 'active'").get() as any)?.count || 0;

    // 2. Identify missing or incomplete information
    const missing: string[] = [];
    if (productCount === 0) missing.push('Danh mục sản phẩm (SKU Master)');
    if (storeCount === 0) missing.push('Danh mục điểm bán / Kho (Store Master)');
    if (inventoryCount === 0) missing.push('Số liệu tồn kho hiện tại (Inventory on-hand)');
    if (salesCount === 0) missing.push('Lịch sử bán hàng (Sales History để tính ADS)');
    if (supplierCount === 0) missing.push('Danh mục nhà cung cấp (Suppliers)');
    if (ruleCount === 0) missing.push('Quy tắc đặt hàng & MOQ đặc thù (Business Rules)');

    // 3. System readiness state
    let systemState = 'EMPTY';
    if (productCount > 0 && inventoryCount > 0) {
      systemState = 'READY';
    } else if (datasetCount > 0) {
      systemState = 'VALIDATING';
    }

    return {
      success: true,
      data: {
        systemState,
        stats: {
          storeCount,
          productCount,
          supplierCount,
          datasetCount,
          inventoryCount,
          salesCount,
          knowledgeCount,
          ruleCount,
          termCount
        },
        missing
      }
    };
  });
}
