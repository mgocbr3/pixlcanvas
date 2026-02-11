import type { FastifyInstance, FastifyRequest } from 'fastify';
import { getSupabaseClient } from './supabase.js';

type AuthUser = { id: string };

const extractToken = (request: FastifyRequest) => {
  const header = request.headers.authorization || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || null;
};

/**
 * Decodifica o payload de um JWT sem verificar a assinatura.
 * Usado como fallback quando o token está expirado.
 */
const decodeJwtPayload = (token: string): Record<string, unknown> | null => {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = Buffer.from(parts[1], 'base64url').toString('utf8');
    return JSON.parse(payload);
  } catch {
    return null;
  }
};

export const authenticate = async (app: FastifyInstance, request: FastifyRequest) => {
  // Dev-only bypass: lets local editor usage work without continuously pasting tokens.
  // Enabled explicitly via env var to avoid accidental use in real environments.
  const devBypassEnabled = process.env.PIXLLAND_DEV_AUTH_BYPASS === '1';
  if (devBypassEnabled) {
    const devUserId = process.env.PIXLLAND_DEV_USER_ID || 'anonymous';
    const token = extractToken(request);
    if (!token) {
      (request as FastifyRequest & { user?: AuthUser }).user = { id: devUserId };
      return;
    }
  }

  const token = extractToken(request);
  if (!token) {
    const err = new Error('missing_token');
    (err as Error & { statusCode?: number }).statusCode = 401;
    throw err;
  }

  const client = getSupabaseClient();

  // Tenta validação normal primeiro
  const { data, error } = await client.auth.getUser(token);
  if (!error && data?.user?.id) {
    (request as FastifyRequest & { user?: AuthUser }).user = { id: data.user.id };
    return;
  }

  // Fallback: se o token expirou, extrai o user ID do payload
  // e verifica se o usuário existe via admin API
  const payload = decodeJwtPayload(token);
  if (payload?.sub && typeof payload.sub === 'string') {
    try {
      const { data: adminData, error: adminError } = await client.auth.admin.getUserById(payload.sub);
      if (!adminError && adminData?.user?.id) {
        (request as FastifyRequest & { user?: AuthUser }).user = { id: adminData.user.id };
        return;
      }
    } catch {
      // admin fallback failed, fall through to error
    }
  }

  const err = new Error('invalid_token');
  (err as Error & { statusCode?: number }).statusCode = 401;

  // If dev bypass is enabled, fall back to a fixed local user instead of hard-failing.
  if (process.env.PIXLLAND_DEV_AUTH_BYPASS === '1') {
    const devUserId = process.env.PIXLLAND_DEV_USER_ID || 'anonymous';
    (request as FastifyRequest & { user?: AuthUser }).user = { id: devUserId };
    return;
  }

  throw err;
};

export const getUserId = (request: FastifyRequest) => {
  const user = (request as FastifyRequest & { user?: AuthUser }).user;
  return user?.id || null;
};
