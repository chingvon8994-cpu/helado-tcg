import { describe, expect, it } from 'vitest';
import { chooseAction } from '../src/ai';
import { cardsInExpansion } from '../src/cards/registry';
import type { Rarity } from '../src/cards/types';
import type { PlayerView } from '../src/engine';
import { rollPack, slotOdds } from '../src/economy/packs';
import { DAILY_LOGIN_SCOOPS, STARTING_SCOOPS } from '../src/economy/rewards';
import { Rng } from '../src/engine/rng';
import { HttpError, dispatch, ABANDON_GRACE_SECONDS, TURN_SECONDS } from '../src/server/handlers';
import { MemoryStore } from '../src/server/memoryStore';

type Payload = { matchId: string; view: PlayerView; status: string; seat: 0 | 1 };

function setup() {
  const store = new MemoryStore();
  store.addUser('alice', 'alice');
  store.addUser('bob', 'bob');
  let now = new Date('2026-11-20T12:00:00Z'); // outside launch event → base rewards
  let seed = 1;
  const call = async (userId: string, op: string, body: Record<string, unknown> = {}) =>
    dispatch({ store, userId, now, seed: () => seed++ }, op, body) as Promise<any>;
  const fails = async (p: Promise<unknown>, status: number) => {
    try { await p; } catch (e) { expect(e).toBeInstanceOf(HttpError); expect((e as HttpError).status).toBe(status); return e as HttpError; }
    throw new Error(`expected HTTP ${status}`);
  };
  const advance = (ms: number) => { now = new Date(now.getTime() + ms); store.clock = () => now; };
  store.clock = () => now;
  return { store, call, fails, advance };
}

/** Plays one side of a match through the API using the Normal AI policy on the player's own view. */
async function playTurn(call: (u: string, op: string, b?: Record<string, unknown>) => Promise<any>, user: string, p: Payload): Promise<Payload> {
  let cur = p;
  for (let i = 0; i < 40; i++) {
    const v = cur.view;
    const myMove = v.phase === 'setup' ? !v.you.setupDone : v.pending.length ? v.pending[0].player === v.me : v.current === v.me;
    if (cur.status !== 'active' || !myMove) return cur;
    const action = chooseAction(v, 'normal', i + v.version * 13);
    cur = await call(user, 'match.action', { matchId: cur.matchId, action, version: v.version });
  }
  return cur;
}

describe('accounts and economy', () => {
  it('bootstrap grants starter content exactly once', async () => {
    const { call, store } = setup();
    const a = await call('alice', 'account.bootstrap');
    expect(a.scoops).toBe(STARTING_SCOOPS);
    await call('alice', 'account.bootstrap');
    expect(await store.getWallet('alice')).toBe(STARTING_SCOOPS);
    expect([...store.decks.values()].filter((d) => d.user_id === 'alice')).toHaveLength(2);
    expect(Object.values(await store.getCollection('alice')).reduce((x, y) => x + y, 0)).toBe(40);
  });

  it('daily reward can be claimed once per day', async () => {
    const { call, fails, advance } = setup();
    await call('alice', 'economy.claimDaily');
    await fails(call('alice', 'economy.claimDaily'), 409);
    advance(24 * 3600 * 1000);
    const r = await call('alice', 'economy.claimDaily');
    expect(r.scoops).toBe(DAILY_LOGIN_SCOOPS * 2);
  });

  it('usernames are validated and unique', async () => {
    const { call, fails } = setup();
    await fails(call('alice', 'account.setUsername', { username: 'a!' }), 400);
    await fails(call('alice', 'account.setUsername', { username: 'BOB' }), 409);
    expect((await call('alice', 'account.setUsername', { username: 'Alice_99' })).username).toBe('Alice_99');
  });

  it('packs cost Scoops, come from the real expansion pool, and fail cleanly when broke', async () => {
    const { call, fails, store } = setup();
    await fails(call('alice', 'shop.openPack', { expansionId: 'genesis' }), 402);
    await fails(call('alice', 'shop.openPack', { expansionId: 'nope' }), 404);
    await store.grantScoops('alice', 250, 'test', '1');
    const r = await call('alice', 'shop.openPack', { expansionId: 'genesis' });
    expect(r.cards).toHaveLength(5);
    const ids = new Set(cardsInExpansion('genesis').map((c) => c.id));
    for (const id of r.cards) expect(ids.has(id)).toBe(true);
    expect(r.scoops).toBe(250 - 100 + 50); // pack cost, then +50 first-pack achievement
    expect(r.unlocked).toContain('first-pack');
    const coll = await store.getCollection('alice');
    expect(Object.values(coll).reduce((a, b) => a + b, 0)).toBe(5);
    const missions = await call('alice', 'missions.list');
    expect(missions.missions.find((m: any) => m.id === 'd-pack1').progress).toBe(1);
    await call('alice', 'missions.claim', { missionId: 'd-pack1' });
    await fails(call('alice', 'missions.claim', { missionId: 'd-pack1' }), 409);
    await fails(call('alice', 'missions.claim', { missionId: 'd-win2' }), 409);
  });

  it('pack rarity distribution matches the configured odds', () => {
    for (const exp of ['genesis', 'wildfront', 'celestial']) {
      if (!cardsInExpansion(exp).length) continue;
      const rng = new Rng(123);
      const N = 6000;
      const counts = new Map<Rarity, number>();
      for (let i = 0; i < N; i++) {
        const pack = rollPack(exp, (n) => rng.int(n));
        const last = pack[4];
        counts.set(last.rarity, (counts.get(last.rarity) ?? 0) + 1);
      }
      for (const { rarity, pct } of slotOdds(exp)[4]) {
        const got = ((counts.get(rarity) ?? 0) / N) * 100;
        expect(Math.abs(got - pct)).toBeLessThan(Math.max(1.6, pct * 0.25));
      }
    }
  });
});

describe('solo matches (server-authoritative)', () => {
  it('runs a complete match vs AI and grants rewards exactly once', async () => {
    const { call, store, fails } = setup();
    await call('alice', 'account.bootstrap');
    let p: Payload = await call('alice', 'solo.start', { deckId: 'starter-orchard', difficulty: 'easy' });
    expect(p.view.opponent.hand).toBeNull();
    for (let i = 0; i < 80 && p.status === 'active'; i++) p = await playTurn(call, 'alice', p);
    expect(p.status).toBe('finished');
    const results = store.results.filter((r) => r.user_id === 'alice');
    expect(results).toHaveLength(1);
    const bal = await store.getWallet('alice');
    // Re-running finalisation paths (e.g. reading state again) never pays twice.
    await call('alice', 'match.state', { matchId: p.matchId });
    await fails(call('alice', 'match.action', { matchId: p.matchId, action: { type: 'endTurn' } }), 409);
    expect(await store.getWallet('alice')).toBe(bal);
    if (p.view.turn >= 6) expect(results[0].xp).toBeGreaterThan(0);
  });

  it('rejects illegal, stale and foreign actions', async () => {
    const { call, fails } = setup();
    await call('alice', 'account.bootstrap');
    const p: Payload = await call('alice', 'solo.start', { deckId: 'starter-orchard', difficulty: 'beginner' });
    await fails(call('alice', 'match.action', { matchId: p.matchId, action: { type: 'attack', index: 0 }, version: p.view.version }), 422);
    await fails(call('alice', 'match.action', { matchId: p.matchId, action: { type: 'setupDone' }, version: p.view.version + 5 }), 409);
    await fails(call('bob', 'match.state', { matchId: p.matchId }), 403);
    await fails(call('alice', 'solo.start', { deckId: 'starter-orchard', difficulty: 'godlike' }), 400);
  });

  it('forfeiting a short match earns nothing (no start/abandon farming)', async () => {
    const { call, store } = setup();
    await call('alice', 'account.bootstrap');
    const before = await store.getWallet('alice');
    for (let i = 0; i < 3; i++) {
      const p: Payload = await call('alice', 'solo.start', { deckId: 'starter-orchard', difficulty: 'expert' });
      const r = await call('alice', 'match.forfeit', { matchId: p.matchId });
      expect(r.status).toBe('finished');
    }
    expect(await store.getWallet('alice')).toBe(before);
    expect(store.results.every((r) => r.scoops === 0 && r.xp === 0)).toBe(true);
  });

  it('decks must be owned and legal', async () => {
    const { call, fails, store } = setup();
    await call('alice', 'account.bootstrap');
    const notOwned = await store.createDeck('alice', 'Fake', Array(20).fill(0).map((_, i) => (i < 2 ? 'GEN-060' : ['GEN-001', 'GEN-004', 'GEN-007', 'GEN-010', 'GEN-012', 'GEN-019', 'GEN-071', 'GEN-072', 'GEN-081'][i % 9])), ['verdant']);
    await fails(call('alice', 'solo.start', { deckId: notOwned, difficulty: 'easy' }), 403); // legal but not owned
    const illegal = await store.createDeck('alice', 'Short', ['GEN-001'], ['verdant']);
    await fails(call('alice', 'solo.start', { deckId: illegal, difficulty: 'easy' }), 400);
    const bobDeck = await store.createDeck('bob', 'Bob', [], []);
    await fails(call('alice', 'solo.start', { deckId: bobDeck, difficulty: 'easy' }), 404);
    // An owned, legal custom deck is accepted.
    const ok = await store.createDeck('alice', 'Mine', [...store.decks.values()].find((d) => d.user_id === 'alice')!.cards, ['verdant', 'blaze']);
    expect((await call('alice', 'solo.start', { deckId: ok, difficulty: 'easy' })).status).toBe('active');
  });
});

describe('online rooms and matches', () => {
  async function startRoom(ctx: ReturnType<typeof setup>) {
    const { call } = ctx;
    await call('alice', 'account.bootstrap');
    await call('bob', 'account.bootstrap');
    const { room } = await call('alice', 'room.create', { deckId: 'starter-orchard' });
    expect(room.code).toMatch(/^[A-Z2-9]{6}$/);
    expect(room).not.toHaveProperty('host_deck');
    await call('bob', 'room.join', { code: room.code.toLowerCase(), deckId: 'starter-tidal' });
    await call('alice', 'room.ready', { roomId: room.id, ready: true });
    const r = await call('bob', 'room.ready', { roomId: room.id, ready: true });
    expect(r.room.status).toBe('started');
    expect(r.room.match_id).toBeTruthy();
    return r.room;
  }

  it('two players complete a full match with server validation and rewards', async () => {
    const ctx = setup();
    const { call, store } = ctx;
    const room = await startRoom(ctx);
    let a: Payload = await call('alice', 'match.state', { matchId: room.match_id });
    let b: Payload = await call('bob', 'match.state', { matchId: room.match_id });
    expect(a.seat).toBe(0);
    expect(b.seat).toBe(1);
    for (let i = 0; i < 200 && a.status === 'active'; i++) {
      a = await playTurn(call, 'alice', await call('alice', 'match.state', { matchId: room.match_id }));
      b = await playTurn(call, 'bob', await call('bob', 'match.state', { matchId: room.match_id }));
      a = await call('alice', 'match.state', { matchId: room.match_id });
      // Hidden information never leaks across the wire.
      const bobState = (await store.getMatch(room.match_id))!.state;
      const aliceJson = JSON.stringify(a);
      for (const h of bobState.players[1].hand) expect(aliceJson).not.toContain(`"${h.uid}"`);
      expect(aliceJson).not.toContain('"rng"');
    }
    expect(a.status).toBe('finished');
    expect(store.results.filter((r) => r.match_id === room.match_id)).toHaveLength(2);
    const w = store.results.find((r) => r.match_id === room.match_id && r.result === 'win');
    if (w && a.view.turn >= 6) expect(w.scoops).toBeGreaterThan(0);
  });

  it('rejects moves out of turn and from strangers; rooms enforce membership', async () => {
    const ctx = setup();
    const { call, fails, store } = ctx;
    store.addUser('eve', 'eve');
    const room = await startRoom(ctx);
    const s = (await store.getMatch(room.match_id))!.state;
    await fails(call('eve', 'match.action', { matchId: room.match_id, action: { type: 'setupDone' } }), 403);
    await fails(call('eve', 'room.get', { roomId: room.id }), 404);
    await fails(call('eve', 'room.join', { code: room.code, deckId: 'starter-orchard' }), 409);
    await fails(call('alice', 'match.action', { matchId: room.match_id, action: { type: 'endTurn' }, version: s.version }), 422);
  });

  it('a stalling opponent is auto-advanced, then forfeits after the grace period', async () => {
    const ctx = setup();
    const { call, fails, advance } = ctx;
    const room = await startRoom(ctx);
    // Alice completes setup; Bob stalls.
    let a: Payload = await playTurn(call, 'alice', await call('alice', 'match.state', { matchId: room.match_id }));
    await fails(call('alice', 'match.claimTimeout', { matchId: room.match_id }), 409);
    advance(200 * 1000);
    a = await call('alice', 'match.claimTimeout', { matchId: room.match_id });
    expect(a.view.phase).toBe('main');
    // If Bob now owes a move and keeps stalling past the grace period, Alice wins.
    const owes = (v: PlayerView) => (v.pending.length ? v.pending[0].player === 1 : v.current === 1);
    if (!owes(a.view)) a = await playTurn(call, 'alice', a);
    advance((TURN_SECONDS + ABANDON_GRACE_SECONDS + 5) * 1000);
    a = await call('alice', 'match.claimTimeout', { matchId: room.match_id });
    expect(a.status).toBe('finished');
    expect(a.view.winner).toBe(0);
    expect(a.view.winReason).toBe('timeout');
  });

  it('players can reconnect and the host can close an unstarted room', async () => {
    const ctx = setup();
    const { call } = ctx;
    await call('alice', 'account.bootstrap');
    await call('bob', 'account.bootstrap');
    const { room } = await call('alice', 'room.create', { deckId: 'starter-orchard' });
    await call('bob', 'room.join', { code: room.code, deckId: 'starter-tidal' });
    const again = await call('bob', 'room.join', { code: room.code, deckId: 'starter-tidal' });
    expect(again.room.guest).toBe('bob');
    const left = await call('bob', 'room.leave', { roomId: room.id });
    expect(left.room.guest).toBeNull();
    const closed = await call('alice', 'room.leave', { roomId: room.id });
    expect(closed.room.status).toBe('closed');
  });
});
