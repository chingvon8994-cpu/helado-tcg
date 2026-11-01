import { supabase } from './supabase';

export class ApiError extends Error {
  constructor(public status: number, message: string, public data: Record<string, unknown> = {}) { super(message); }
}

/** Calls a trusted server operation. The server re-validates everything; the client only asks. */
export async function api<T = unknown>(op: string, body: Record<string, unknown> = {}): Promise<T> {
  if (!supabase) throw new ApiError(503, 'Online features are not configured.');
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new ApiError(401, 'Please sign in.');
  const res = await fetch('/api/game', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ op, ...body }),
  });
  let json: Record<string, unknown> = {};
  try { json = await res.json(); } catch { /* non-JSON */ }
  if (!res.ok) throw new ApiError(res.status, (json.error as string) ?? `Request failed (${res.status})`, json);
  return json as T;
}
