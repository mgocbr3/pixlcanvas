import type { FastifyInstance } from 'fastify';
import { authenticate, getUserId } from '../lib/auth.js';
import { getSupabaseClient } from '../lib/supabase.js';

export const registerSceneRoutes = (app: FastifyInstance) => {
  app.get('/scenes', { preHandler: (req) => authenticate(app, req) }, async (request, reply) => {
    try {
      const client = getSupabaseClient();
      const userId = getUserId(request);
      if (!userId) {
        return reply.code(401).send({ error: 'unauthorized' });
      }

      const { data, error } = await client
        .from('scenes')
        .select('*')
        .eq('owner_id', userId)
        .limit(50);

      if (error) {
        return reply.code(500).send({ error: error.message });
      }

      return { result: data };
    } catch (err) {
      return reply.code(500).send({ error: 'server_error' });
    }
  });

  app.post('/scenes', { preHandler: (req) => authenticate(app, req) }, async (request, reply) => {
    try {
      const client = getSupabaseClient();
      const userId = getUserId(request);
      if (!userId) {
        return reply.code(401).send({ error: 'unauthorized' });
      }

      const body = request.body as { projectId?: number; branchId?: string; name?: string };
      if (!body?.projectId || !body?.branchId) {
        return reply.code(400).send({ error: 'projectId_and_branchId_required' });
      }

      const { data, error } = await client
        .from('scenes')
        .insert({
          project_id: body.projectId,
          branch_id: body.branchId,
          name: body.name || 'New Scene',
          owner_id: userId
        })
        .select('*')
        .single();

      if (error) {
        return reply.code(500).send({ error: error.message });
      }

      return data;
    } catch (err) {
      return reply.code(500).send({ error: 'server_error' });
    }
  });

  app.get('/scenes/:sceneId', async (request, reply) => {
    try {
      const client = getSupabaseClient();
      const { sceneId } = request.params as { sceneId: string };
      const { data, error } = await client
        .from('scenes')
        .select('*')
        .eq('id', Number(sceneId))
        .single();

      if (error || !data) {
        return reply.code(404).send({ error: 'scene_not_found' });
      }

      return {
        id: data.id,
        uniqueId: data.unique_id,
        name: data.name,
        projectId: data.project_id,
        branchId: data.branch_id,
        createdAt: data.created_at
      };
    } catch (err) {
      return reply.code(500).send({ error: 'server_error' });
    }
  });
};
