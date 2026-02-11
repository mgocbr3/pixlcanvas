import type { FastifyInstance } from 'fastify';
import { getSupabaseClient } from '../lib/supabase.js';

/**
 * Endpoints auxiliares do editor (tips, flags, store stubs, howdoi, etc.)
 */
export const registerEditorMiscRoutes = (app: FastifyInstance) => {
  // ─── Tips ───
  app.post('/editor/scene/:sceneId/tips/:tip', async (_request, reply) => {
    return reply.code(200).send({ ok: true });
  });
  app.post('/editor/scene/:sceneId/tips', async (_request, reply) => {
    return reply.code(200).send({ ok: true });
  });

  // ─── Scene opened / events ───
  app.post('/editor/scene/:sceneId/opened', async (_request, reply) => {
    return reply.code(200).send({ ok: true });
  });
  app.post('/editor/scene/:sceneId/events', async (_request, reply) => {
    return reply.code(200).send({ ok: true });
  });

  // ─── Branch info ───
  app.get('/editor/project/:projectId/branch', async (request, reply) => {
    try {
      const client = getSupabaseClient();
      const { projectId } = request.params as { projectId: string };
      const { data, error } = await client
        .from('branches')
        .select('*')
        .eq('project_id', Number(projectId))
        .order('created_at', { ascending: true })
        .limit(1)
        .single();

      if (error || !data) {
        return reply.code(200).send({
          id: 'main',
          name: 'main',
          createdAt: new Date().toISOString(),
          latestCheckpointId: null,
          merge: null,
        });
      }

      return reply.code(200).send({
        id: data.id,
        name: data.name || 'main',
        createdAt: data.created_at,
        latestCheckpointId: null,
        merge: null,
      });
    } catch {
      return reply.code(200).send({
        id: 'main',
        name: 'main',
        createdAt: new Date().toISOString(),
        latestCheckpointId: null,
        merge: null,
      });
    }
  });

  // ─── Store (stubs) ───
  // GET /store - lista de itens
  app.get('/store', async (_request, reply) => {
    return reply.code(200).send({ result: [], pagination: { total: 0, limit: 20, skip: 0 } });
  });
  // GET /store/licenses
  app.get('/store/licenses', async (_request, reply) => {
    return reply.code(200).send({ result: [] });
  });
  // GET /store/:storeId
  app.get('/store/:storeId', async (_request, reply) => {
    return reply.code(404).send({ error: 'not_found' });
  });
  // GET /store/:storeId/assets
  app.get('/store/:storeId/assets', async (_request, reply) => {
    return reply.code(200).send({ result: [] });
  });
  // GET /store/assets/:assetId/file/:assetName
  app.get('/store/assets/:assetId/file/:assetName', async (_request, reply) => {
    return reply.code(404).send({ error: 'not_found' });
  });
  // POST /store/upload
  app.post('/store/upload', async (_request, reply) => {
    return reply.code(200).send({ ok: true });
  });
  // POST /store/:storeId/clone
  app.post('/store/:storeId/clone', async (_request, reply) => {
    return reply.code(200).send({ ok: true });
  });
  // PUT /store/move/:storeId
  app.put('/store/move/:storeId', async (_request, reply) => {
    return reply.code(200).send({ ok: true });
  });

  // ─── HowDoI ───
  app.get('/howdoi', async (_request, reply) => {
    return reply.code(200).send([]);
  });
};
