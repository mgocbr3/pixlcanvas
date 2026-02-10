import type { FastifyInstance } from 'fastify';
import { authenticate, getUserId } from '../lib/auth.js';
import { getSupabaseClient } from '../lib/supabase.js';

export const registerAssetRoutes = (app: FastifyInstance) => {
  const emptyPng = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=',
    'base64'
  );
  app.get('/assets', { preHandler: (req) => authenticate(app, req) }, async (request, reply) => {
    try {
      const client = getSupabaseClient();
      const userId = getUserId(request);
      if (!userId) {
        return reply.code(401).send({ error: 'unauthorized' });
      }

      const { data, error } = await client
        .from('assets')
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

  app.post('/assets', { preHandler: (req) => authenticate(app, req) }, async (request, reply) => {
    try {
      const client = getSupabaseClient();
      const userId = getUserId(request);
      if (!userId) {
        return reply.code(401).send({ error: 'unauthorized' });
      }

      const body = request.body as { projectId?: number; branchId?: string; name?: string; type?: string };
      if (!body?.projectId || !body?.branchId || !body?.name || !body?.type) {
        return reply.code(400).send({ error: 'missing_required_fields' });
      }

      const { data, error } = await client
        .from('assets')
        .insert({
          project_id: body.projectId,
          branch_id: body.branchId,
          name: body.name,
          type: body.type,
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

  app.get('/assets/:assetId', async (request, reply) => {
    try {
      const client = getSupabaseClient();
      const { assetId } = request.params as { assetId: string };
      const { data, error } = await client
        .from('assets')
        .select('*')
        .eq('id', Number(assetId))
        .single();

      if (error || !data) {
        return reply.code(404).send({ error: 'asset_not_found' });
      }

      return {
        id: data.id,
        uniqueId: data.id,
        name: data.name,
        type: data.type,
        tags: [],
        meta: data.meta || {},
        data: data.data || {},
        file: data.file || null,
        path: [],
        preload: true,
        has_thumbnail: false,
        source: true,
        source_asset_id: data.source_asset_id || null,
        createdAt: data.created_at
      };
    } catch (err) {
      return reply.code(500).send({ error: 'server_error' });
    }
  });

  app.get('/assets/:assetId/thumbnail/:size', async (_request, reply) => {
    reply.type('image/png').send(emptyPng);
  });

  app.get('/assets/:assetId/thumbnail', async (_request, reply) => {
    reply.type('image/png').send(emptyPng);
  });

  app.get('/assets/:assetId/file/:filename', async (_request, reply) => {
    reply.code(404).send({ error: 'file_not_found' });
  });

  app.get('/assets/:assetId/download', async (_request, reply) => {
    reply.code(404).send({ error: 'file_not_found' });
  });
};
