import type { FastifyInstance } from 'fastify';
import { authenticate, getUserId } from '../lib/auth.js';
import type { Database } from '../lib/database.types.js';
import { getSupabaseClient } from '../lib/supabase.js';

type ProjectRow = Database['public']['Tables']['projects']['Row'];
type ProjectInsert = Database['public']['Tables']['projects']['Insert'];
type BranchRow = Database['public']['Tables']['branches']['Row'];
type BranchInsert = Database['public']['Tables']['branches']['Insert'];
type AssetRow = Database['public']['Tables']['assets']['Row'];
type SceneRow = Database['public']['Tables']['scenes']['Row'];

export const registerProjectRoutes = (app: FastifyInstance) => {
  app.get('/projects', { preHandler: (req) => authenticate(app, req) }, async (request, reply) => {
    try {
      const client = getSupabaseClient();
      const userId = getUserId(request);
      if (!userId) {
        return reply.code(401).send({ error: 'unauthorized' });
      }

      const { data, error } = await client
        .from('projects')
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

  app.post('/projects', { preHandler: (req) => authenticate(app, req) }, async (request, reply) => {
    try {
      const client = getSupabaseClient();
      const userId = getUserId(request);
      if (!userId) {
        return reply.code(401).send({ error: 'unauthorized' });
      }

      const body = request.body as { name?: string; description?: string; private?: boolean };
      if (!body?.name) {
        return reply.code(400).send({ error: 'name_required' });
      }

      const projectPayload: ProjectInsert = {
        name: body.name,
        description: body.description || '',
        private: body.private ?? true,
        owner_id: userId
      };

      const { data, error } = await client
        .from('projects')
        .insert(projectPayload)
        .select('*')
        .single();

      if (error) {
        return reply.code(500).send({ error: error.message });
      }
      const project = data as ProjectRow | null;
      if (!project) {
        return reply.code(500).send({ error: 'project_not_created' });
      }

      const branchPayload: BranchInsert = {
        project_id: project.id,
        name: 'main',
        is_master: true,
        created_by: userId
      };

      const { data: branch, error: branchError } = await client
        .from('branches')
        .insert(branchPayload)
        .select('*')
        .single();

      if (branchError) {
        return reply.code(500).send({ error: branchError.message });
      }

      return { project, branch: branch as BranchRow | null };
    } catch (err) {
      return reply.code(500).send({ error: 'server_error' });
    }
  });

  app.get('/projects/:projectId', async (request, reply) => {
    try {
      const client = getSupabaseClient();
      const { projectId } = request.params as { projectId: string };
      const { data, error } = await client
        .from('projects')
        .select('*')
        .eq('id', Number(projectId))
        .single();

      if (error) {
        return reply.code(404).send({ error: 'project_not_found' });
      }

      return data;
    } catch (err) {
      return reply.code(500).send({ error: 'server_error' });
    }
  });

  app.get('/projects/:projectId/assets', async (request, reply) => {
    try {
      const client = getSupabaseClient();
      const { projectId } = request.params as { projectId: string };
      const { branchId } = request.query as { branchId?: string };

      const projectIdValue = Number(projectId);
      if (!projectIdValue) {
        return [];
      }

      let query = client
        .from('assets')
        .select('*')
        .eq('project_id', projectIdValue);

      if (branchId) {
        query = query.eq('branch_id', branchId);
      }

      const { data, error } = await query.limit(1000);
      if (error) {
        return reply.code(500).send({ error: error.message });
      }

      const assets = (data || []) as AssetRow[];
      const result = assets.map((asset) => {
        const dataObject = asset.data && typeof asset.data === 'object' && !Array.isArray(asset.data)
          ? asset.data as Record<string, Database['public']['Tables']['assets']['Row']['data']>
          : {};
        const dataPath = dataObject.path;
        const dataPreload = dataObject.preload;
        const dataSource = dataObject.source;
        const path = Array.isArray(asset.path)
          ? asset.path
          : (Array.isArray(dataPath) ? dataPath : []);
        const preload = typeof asset.preload === 'boolean'
          ? asset.preload
          : (typeof dataPreload === 'boolean' ? dataPreload : true);
        const source = typeof asset.source === 'boolean'
          ? asset.source
          : (typeof dataSource === 'boolean' ? dataSource : true);

        return {
          id: asset.id,
          uniqueId: asset.id,
          name: asset.name,
          type: asset.type,
          tags: asset.tags || [],
          meta: asset.meta || {},
          data: asset.data || {},
          file: asset.file || null,
          path,
          preload,
          has_thumbnail: false,
          source,
          source_asset_id: asset.source_asset_id || null,
          createdAt: asset.created_at
        };
      });

      return result;
    } catch (err) {
      return reply.code(500).send({ error: 'server_error' });
    }
  });

  app.get('/projects/:projectId/scenes', async (request, reply) => {
    try {
      const client = getSupabaseClient();
      const { projectId } = request.params as { projectId: string };
      const { branchId } = request.query as { branchId?: string };

      const projectIdValue = Number(projectId);
      if (!projectIdValue) {
        return { result: [] };
      }

      let query = client
        .from('scenes')
        .select('*')
        .eq('project_id', projectIdValue);

      if (branchId) {
        query = query.eq('branch_id', branchId);
      }

      const { data, error } = await query.limit(200);
      if (error) {
        return reply.code(500).send({ error: error.message });
      }

      const scenes = (data || []) as SceneRow[];
      const result = scenes.map((scene) => ({
        id: scene.id,
        uniqueId: scene.unique_id,
        name: scene.name,
        createdAt: scene.created_at
      }));

      return { result };
    } catch (err) {
      return reply.code(500).send({ error: 'server_error' });
    }
  });
};
