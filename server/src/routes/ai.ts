import { FastifyInstance } from 'fastify';
import { geminiService } from '../ai/gemini.js';
import { parseUserIntent, buildDataContext } from '../ai/data-query.js';
import { verifyToken } from '../middleware/auth.js';
import { getDb } from '../db/connection.js';
import { v4 as uuidv4 } from 'uuid';

export default async function aiRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', verifyToken);

  fastify.post('/chat', async (request: any, reply) => {
    const { message, conversationId } = request.body;
    
    try {
      const intent = await parseUserIntent(message);
      const dataContext = await buildDataContext(intent, message);
      
      const response = await geminiService.chat(message, dataContext);
      
      const db = getDb();
      let convId = conversationId;
      const now = new Date().toISOString();
      
      if (!convId) {
        convId = uuidv4();
        db.prepare('INSERT INTO ai_conversations (id, user_id, title, created_at) VALUES (?, ?, ?, ?)').run(
          convId, request.user.id, message.substring(0, 50), now
        );
      }
      
      db.prepare('INSERT INTO ai_messages (id, conversation_id, role, content, data_context, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
        uuidv4(), convId, 'user', message, null, now
      );
      
      db.prepare('INSERT INTO ai_messages (id, conversation_id, role, content, data_context, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
        uuidv4(), convId, 'assistant', response, JSON.stringify(dataContext), now
      );
      
      return {
        success: true,
        response,
        reply: response,
        conversationId: convId,
        intent,
        data: {
          response,
          reply: response,
          conversationId: convId,
          intent
        }
      };
    } catch (error: any) {
      return reply.code(500).send({ error: error.message });
    }
  });

  fastify.get('/conversations', async (request: any, reply) => {
    const db = getDb();
    return db.prepare('SELECT * FROM ai_conversations WHERE user_id = ? ORDER BY created_at DESC').all(request.user.id);
  });
}
