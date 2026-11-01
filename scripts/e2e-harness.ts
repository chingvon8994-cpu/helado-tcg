/**
 * Local end-to-end harness (development only — never deployed).
 * Serves the REAL trusted handlers on a MemoryStore plus a tiny emulation of the Supabase REST
 * endpoints the client reads, so signed-in UI flows can be exercised in a browser without a
 * Supabase project.  Run:  npx vite-node scripts/e2e-harness.ts
 */
import { createServer } from 'node:http';
import { dispatch, HttpError } from '../src/server/handlers';
import { MemoryStore } from '../src/server/memoryStore';

const store = new MemoryStore();
store.addUser('11111111-1111-1111-1111-111111111111', 'alice');
store.addUser('22222222-2222-2222-2222-222222222222', 'bob');
const userFromToken = (auth: string) => (auth.includes('bob') ? '22222222-2222-2222-2222-222222222222' : '11111111-1111-1111-1111-111111111111');

function tables(user: string): Record<string, Record<string, unknown>[]> {
  const prof = store.profiles.get(user)!;
  const res = store.results.filter((r) => r.user_id === user);
  return {
    profiles: [{ ...prof }],
    wallets: [{ user_id: user, scoops: store.wallets.get(user) }],
    collection: Object.entries(Object.fromEntries(store.collection.get(user) ?? [])).map(([card_id, quantity]) => ({ card_id, quantity })),
    decks: [...store.decks.values()].filter((d) => d.user_id === user).map((d) => ({ ...d, updated_at: (d as never as { updated_at?: string }).updated_at ?? '2026-01-01' })),
    card_acquisitions: store.acquisitions.filter((a) => a.user_id === user),
    pack_opens: store.packs.filter((p) => p.user_id === user),
    match_results: res as unknown as Record<string, unknown>[],
    achievements: [...store.achievements].filter((k) => k.startsWith(user)).map((k) => ({ achievement_id: k.split(':')[1], unlocked_at: '2026-11-01' })),
    player_stats: [{ wins: res.filter((r) => r.result === 'win').length, losses: res.filter((r) => r.result === 'loss').length, draws: 0, online_wins: 0, solo_wins: 0, expert_wins: 0, knockouts: 0, packs_opened: store.packs.filter((p) => p.user_id === user).length }],
  };
}

function applyQuery(rows: Record<string, unknown>[], q: URLSearchParams) {
  let out = rows;
  for (const [k, v] of q) {
    if (['select', 'order', 'limit', 'offset'].includes(k)) continue;
    const [op, ...rest] = v.split('.');
    const val = rest.join('.');
    out = out.filter((r) => (op === 'eq' ? String(r[k]) === val : op === 'neq' ? String(r[k]) !== val : true));
  }
  const order = q.get('order');
  if (order) { const [col, dir] = order.split('.'); out = [...out].sort((a, b) => (String(a[col]) < String(b[col]) ? -1 : 1) * (dir === 'desc' ? -1 : 1)); }
  const limit = q.get('limit');
  if (limit) out = out.slice(0, Number(limit));
  return out;
}

const server = createServer(async (req, res) => {
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('access-control-allow-headers', '*');
  res.setHeader('access-control-allow-methods', '*');
  res.setHeader('access-control-expose-headers', 'content-range');
  if (req.method === 'OPTIONS') return res.end();
  const url = new URL(req.url!, 'http://x');
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {};
  const user = userFromToken(String(req.headers.authorization ?? ''));
  res.setHeader('content-type', 'application/json');
  try {
    if (url.pathname === '/api/game') {
      const out = await dispatch({ store, userId: user, now: new Date() }, body.op, body);
      return res.end(JSON.stringify(out));
    }
    const m = url.pathname.match(/^\/rest\/v1\/(\w+)/);
    if (m) {
      const table = m[1];
      if (table === 'decks' && req.method === 'POST') {
        const row = Array.isArray(body) ? body[0] : body;
        const id = await store.createDeck(user, row.name, row.cards ?? [], row.essence ?? []);
        return res.end(JSON.stringify(req.headers.accept?.includes('object') ? { id } : [{ id }]));
      }
      if (table === 'decks' && (req.method === 'PATCH' || req.method === 'DELETE')) {
        const id = url.searchParams.get('id')!.slice(3);
        if (req.method === 'DELETE') store.decks.delete(id); else Object.assign(store.decks.get(id)!, body);
        return res.end('[]');
      }
      if (table === 'profiles' && req.method === 'PATCH') { Object.assign(store.profiles.get(user)!, { avatar: body.avatar }); return res.end('[]'); }
      const rows = applyQuery(tables(user)[table] ?? [], url.searchParams);
      if (req.headers.accept?.includes('vnd.pgrst.object')) return res.end(JSON.stringify(rows[0] ?? null));
      res.setHeader('content-range', `0-${rows.length}/${rows.length}`);
      return res.end(JSON.stringify(rows));
    }
    if (url.pathname.startsWith('/auth/v1/user')) return res.end(JSON.stringify({ id: user, aud: 'authenticated', email: 'alice@example.com' }));
    res.statusCode = 404; res.end('{}');
  } catch (e) {
    res.statusCode = e instanceof HttpError ? e.status : 500;
    res.end(JSON.stringify({ error: (e as Error).message, ...(e instanceof HttpError ? e.extra : {}) }));
  }
});
server.listen(8787, () => console.log('e2e harness on :8787'));
