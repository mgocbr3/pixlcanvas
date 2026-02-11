import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types.js';

let cachedClient: SupabaseClient<Database> | null = null;

export const isSupabaseConfigured = () => {
  return !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
};

export const getSupabaseClient = () => {
  if (cachedClient) {
    return cachedClient;
  }

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error('Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  }

  cachedClient = createClient<Database>(url, serviceKey, {
    auth: { persistSession: false }
  });

  return cachedClient;
};
