import type { FastifyInstance, FastifyRequest } from 'fastify';
import { getSupabaseClient } from './supabase.js';

type AuthUser = { id: string };

const extractToken = (request: FastifyRequest) => {
  const header = request.headers.authorization || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || null;
};

export const authenticate = async (app: FastifyInstance, request: FastifyRequest) => {
  const token = extractToken(request);
  if (!token) {
    const err = new Error('missing_token');
    (err as Error & { statusCode?: number }).statusCode = 401;
    throw err;
  }

  const client = getSupabaseClient();
  const { data, error } = await client.auth.getUser(token);
  if (error || !data?.user?.id) {
    const err = new Error('invalid_token');
    (err as Error & { statusCode?: number }).statusCode = 401;
    throw err;
  }

  (request as FastifyRequest & { user?: AuthUser }).user = { id: data.user.id };
};

export const getUserId = (request: FastifyRequest) => {
  const user = (request as FastifyRequest & { user?: AuthUser }).user;
  return user?.id || null;
};
