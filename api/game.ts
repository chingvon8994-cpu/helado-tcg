import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleHttp } from '../src/server/http';

/**
 * Single serverless endpoint for every trusted operation (POST /api/game { op, ...args }).
 * Stateless: all match/room state lives in Supabase, so it scales with Vercel's function model and
 * realtime delivery is handled by Supabase Realtime rather than a long-lived socket server.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const result = await handleHttp({
    method: req.method ?? 'GET',
    authorization: (req.headers.authorization as string) ?? '',
    body: typeof req.body === 'string' ? safeJson(req.body) : req.body,
  });
  res.setHeader('cache-control', 'no-store');
  res.status(result.status).json(result.body);
}

function safeJson(s: string) {
  try { return JSON.parse(s); } catch { return {}; }
}
