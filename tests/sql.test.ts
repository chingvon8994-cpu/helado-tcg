/**
 * Runs the real Supabase migration inside an embedded Postgres (PGlite) with a minimal stub of
 * Supabase's auth schema/roles, then exercises the trusted functions and Row Level Security.
 */
import { PGlite } from '@electric-sql/pglite';
import { citext } from '@electric-sql/pglite/contrib/citext';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

const SUPABASE_STUB = `
create schema auth;
create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema public, auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated;
create publication supabase_realtime;
alter default privileges in schema public grant select, insert, update, delete on tables to anon, authenticated, service_role;
`;

const U1 = '11111111-1111-1111-1111-111111111111';
const U2 = '22222222-2222-2222-2222-222222222222';
let db: PGlite;

async function asUser<T>(uid: string, fn: () => Promise<T>): Promise<T> {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${uid}', false);`);
  try {
    return await fn();
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`);
  }
}

beforeAll(async () => {
  db = new PGlite({ extensions: { citext } });
  await db.exec(SUPABASE_STUB);
  const dir = join(__dirname, '..', 'supabase', 'migrations');
  for (const f of readdirSync(dir).sort()) await db.exec(readFileSync(join(dir, f), 'utf8'));
  await db.exec(`insert into auth.users (id, email, raw_user_meta_data) values
    ('${U1}', 'ana@example.com', '{"username":"Ana"}'), ('${U2}', 'ana2@example.com', '{"username":"Ana"}');`);
}, 60000);

describe('supabase migration', () => {
  it('creates profile, wallet and stats for new users with unique usernames', async () => {
    const r = await db.query<{ username: string }>('select username from profiles order by created_at, username');
    expect(r.rows).toHaveLength(2);
    expect(new Set(r.rows.map((x) => x.username)).size).toBe(2);
    const w = await db.query('select * from wallets');
    expect(w.rows).toHaveLength(2);
  });

  it('grant_scoops is idempotent per (reason, ref)', async () => {
    const a = await db.query<{ g: boolean }>(`select grant_scoops('${U1}', 50, 'daily', '2026-10-31') as g`);
    const b = await db.query<{ g: boolean }>(`select grant_scoops('${U1}', 50, 'daily', '2026-10-31') as g`);
    expect(a.rows[0].g).toBe(true);
    expect(b.rows[0].g).toBe(false);
    const w = await db.query<{ scoops: number }>(`select scoops from wallets where user_id = '${U1}'`);
    expect(w.rows[0].scoops).toBe(50);
  });

  it('open_pack_tx charges, adds cards, and refuses when broke', async () => {
    await db.query(`select open_pack_tx('${U1}', 'genesis', 40, array['GEN-001','GEN-001','GEN-004'])`);
    const c = await db.query<{ card_id: string; quantity: number }>(`select card_id, quantity from collection where user_id='${U1}' order by card_id`);
    expect(c.rows).toEqual([{ card_id: 'GEN-001', quantity: 2 }, { card_id: 'GEN-004', quantity: 1 }]);
    const w = await db.query<{ scoops: number }>(`select scoops from wallets where user_id='${U1}'`);
    expect(w.rows[0].scoops).toBe(10);
    await expect(db.query(`select open_pack_tx('${U1}', 'genesis', 40, array['GEN-001'])`)).rejects.toThrow(/INSUFFICIENT_SCOOPS/);
    const after = await db.query<{ n: number }>(`select count(*)::int as n from pack_opens where user_id='${U1}'`);
    expect(after.rows[0].n).toBe(1);
  });

  it('record_match_result applies once', async () => {
    await db.exec(`insert into matches (id, mode, player0, state) values ('33333333-3333-3333-3333-333333333333', 'solo', '${U1}', '{}')`);
    const call = `select record_match_result('33333333-3333-3333-3333-333333333333', '${U1}', 'solo', 'AI', 'easy', 'win', 'points', 12, 35, 30, 3) as ok`;
    expect((await db.query<{ ok: boolean }>(call)).rows[0].ok).toBe(true);
    expect((await db.query<{ ok: boolean }>(call)).rows[0].ok).toBe(false);
    const s = await db.query<{ wins: number; knockouts: number }>(`select wins, knockouts from player_stats where user_id='${U1}'`);
    expect(s.rows[0]).toEqual({ wins: 1, knockouts: 3 });
  });

  it('missions can be claimed only once and only when complete', async () => {
    await db.query(`select bump_mission('${U1}', 'win2', 'd1', 1)`);
    expect((await db.query<{ ok: boolean }>(`select claim_mission('${U1}', 'win2', 'd1', 2, 40) as ok`)).rows[0].ok).toBe(false);
    await db.query(`select bump_mission('${U1}', 'win2', 'd1', 1)`);
    expect((await db.query<{ ok: boolean }>(`select claim_mission('${U1}', 'win2', 'd1', 2, 40) as ok`)).rows[0].ok).toBe(true);
    expect((await db.query<{ ok: boolean }>(`select claim_mission('${U1}', 'win2', 'd1', 2, 40) as ok`)).rows[0].ok).toBe(false);
  });

  it('update_match_state enforces optimistic concurrency', async () => {
    const id = '33333333-3333-3333-3333-333333333333';
    const q = (exp: number) => db.query<{ ok: boolean }>(`select update_match_state('${id}', ${exp}, '{"x":1}', ${exp + 1}, 'active', null, null, null) as ok`);
    expect((await q(0)).rows[0].ok).toBe(true);
    expect((await q(0)).rows[0].ok).toBe(false);
  });

  describe('row level security', () => {
    it('players read only their own private rows', async () => {
      const own = await asUser(U1, () => db.query('select * from wallets'));
      expect(own.rows).toHaveLength(1);
      const coll = await asUser(U2, () => db.query('select * from collection'));
      expect(coll.rows).toHaveLength(0);
    });
    it('match state is never readable by clients', async () => {
      const r = await asUser(U1, () => db.query('select * from matches'));
      expect(r.rows).toHaveLength(0);
    });
    it('clients cannot change currency, collection or xp', async () => {
      await asUser(U1, () => db.query(`update wallets set scoops = 999999 where user_id = '${U1}'`)).catch(() => null);
      const w = await db.query<{ scoops: number }>(`select scoops from wallets where user_id='${U1}'`);
      expect(w.rows[0].scoops).not.toBe(999999);
      await expect(asUser(U1, () => db.query(`insert into collection (user_id, card_id, quantity) values ('${U1}', 'CEL-030', 5)`))).rejects.toThrow();
      await expect(asUser(U1, () => db.query(`update profiles set xp = 99999 where id = '${U1}'`))).rejects.toThrow();
      await expect(asUser(U1, () => db.query(`select grant_scoops('${U1}', 1000, 'hack', 'x')`))).rejects.toThrow();
      await expect(asUser(U1, () => db.query(`select open_pack_tx('${U1}', 'genesis', 0, array['CEL-030'])`))).rejects.toThrow();
    });
    it('clients may manage only their own decks and avatar', async () => {
      await asUser(U1, () => db.query(`insert into decks (user_id, name, cards, essence) values ('${U1}', 'Mine', '{GEN-001}', '{verdant}')`));
      await expect(asUser(U1, () => db.query(`insert into decks (user_id, name) values ('${U2}', 'Theirs')`))).rejects.toThrow();
      const seen = await asUser(U2, () => db.query('select * from decks'));
      expect(seen.rows).toHaveLength(0);
      await asUser(U1, () => db.query(`update profiles set avatar = 'nekocean' where id = '${U1}'`));
      const p = await db.query<{ avatar: string }>(`select avatar from profiles where id='${U1}'`);
      expect(p.rows[0].avatar).toBe('nekocean');
    });
  });
});
