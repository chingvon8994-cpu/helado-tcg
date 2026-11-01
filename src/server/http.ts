import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { HttpError, dispatch } from './handlers';
import { SupabaseStore } from './supabaseStore';

/**
 * Transport-agnostic entry point used by both the Vercel function (api/game.ts) and the Vite dev
 * middleware. Authenticates the caller from their Supabase access token, then dispatches.
 */
let admin: SupabaseClient | null = null;
function getAdmin(): SupabaseClient {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new HttpError(503, 'Server is not configured: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  admin ??= createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return admin;
}

export interface HttpRequestLike { method: string; authorization: string; body: unknown }
export interface HttpResponseLike { status: number; body: unknown }

export async function handleHttp(req: HttpRequestLike): Promise<HttpResponseLike> {
  try {
    if (req.method !== 'POST') throw new HttpError(405, 'Use POST.');
    const token = req.authorization.replace(/^Bearer\s+/i, '');
    if (!token) throw new HttpError(401, 'Please sign in.');
    const db = getAdmin();
    const { data, error } = await db.auth.getUser(token);
    if (error || !data.user) throw new HttpError(401, 'Your session has expired. Please sign in again.');
    const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>;
    const result = await dispatch({ store: new SupabaseStore(db), userId: data.user.id, now: new Date() }, body.op, body);
    return { status: 200, body: result };
  } catch (e) {
    if (e instanceof HttpError) return { status: e.status, body: { error: e.message, ...(e.extra ?? {}) } };
    console.error('[api] unexpected error', e);
    return { status: 500, body: { error: 'Something went wrong on the server.' } };
  }
}
