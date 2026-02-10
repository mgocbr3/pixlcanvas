import type { FastifyInstance } from 'fastify';
import { authenticate, getUserId } from '../lib/auth.js';
import { getSupabaseClient } from '../lib/supabase.js';

const EMPTY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=',
  'base64'
);

const normalizeUser = (id: string, profile?: { username?: string | null; full_name?: string | null; avatar_url?: string | null }) => {
  const username = profile?.username || profile?.full_name || `user-${id}`;
  return {
    id,
    username,
    full_name: profile?.full_name || username,
    avatar_url: profile?.avatar_url || null
  };
};

export const registerUserRoutes = (app: FastifyInstance) => {
  app.get('/users/:id', async (request, reply) => {
    try {
      const client = getSupabaseClient();
      const { id } = request.params as { id: string };
      const { data } = await client
        .from('users_profile')
        .select('id, username, full_name, avatar_url')
        .eq('id', id)
        .maybeSingle();

      return normalizeUser(id, data || undefined);
    } catch (err) {
      return reply.code(500).send({ error: 'server_error' });
    }
  });

  app.get('/users/:id/thumbnail', async (request, reply) => {
    reply.type('image/png').send(EMPTY_PNG);
  });

  app.get('/users/:id/projects', async (request, reply) => {
    try {
      const client = getSupabaseClient();
      const { id } = request.params as { id: string };

      const { data, error } = await client
        .from('projects')
        .select('*')
        .eq('owner_id', id)
        .limit(200);

      if (error) {
        return reply.code(500).send({ error: error.message });
      }

      const result = (data || []).map((project) => ({
        id: project.id,
        name: project.name,
        description: project.description || '',
        private: project.private ?? true,
        private_assets: project.private ?? true,
        access_level: 'admin',
        created_at: project.created_at,
        modified: project.created_at,
        thumbnails: project.thumbnails || {}
      }));

      return { result };
    } catch (err) {
      return reply.code(500).send({ error: 'server_error' });
    }
  });
};
