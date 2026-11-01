import { randomInt } from 'node:crypto';
import type { Difficulty } from '../ai';
import { getExpansion } from '../cards/registry';
import { applyAction, createMatch, getPlayerView, legalActions, validateDeck, type Action, type DeckList, type GameEvent, type GameState, type PlayerIndex } from '../engine';
import type { EssenceElement } from '../cards/types';
import { ACHIEVEMENTS, MISSIONS, dayKey, periodKey, weekKey, type MissionEvent } from '../economy/missions';
import { rollPack } from '../economy/packs';
import { DAILY_LOGIN_SCOOPS, STARTING_SCOOPS, computeMatchReward, levelForXp } from '../economy/rewards';
import { aiOpponentsFor } from '../game/aiDecks';
import { runAi } from '../game/runner';
import { STARTER_DECKS } from '../game/starterDecks';
import { InsufficientFundsError, type MatchRow, type RoomRow, type Store } from './store';

export class HttpError extends Error {
  constructor(public status: number, message: string, public extra?: Record<string, unknown>) { super(message); }
}

export const TURN_SECONDS = 90;
export const SETUP_SECONDS = 120;
export const ABANDON_GRACE_SECONDS = 180;
const DIFFICULTIES: Difficulty[] = ['beginner', 'easy', 'normal', 'expert'];

export interface Ctx { store: Store; userId: string; now: Date; seed?: () => number }
type Handler = (c: Ctx, body: Record<string, unknown>) => Promise<unknown>;

const str = (v: unknown, name: string, max = 200): string => {
  if (typeof v !== 'string' || !v || v.length > max) throw new HttpError(400, `Invalid ${name}.`);
  return v;
};
const secureSeed = (c: Ctx) => (c.seed ? c.seed() : randomInt(1, 2 ** 31 - 1));
const dayStart = (now: Date) => `${dayKey(now)}T00:00:00.000Z`;

// ─── Account & economy ─────────────────────────────────────────────────────────

const bootstrap: Handler = async (c) => {
  if (await c.store.markBootstrapped(c.userId)) {
    await c.store.grantScoops(c.userId, STARTING_SCOOPS, 'starter', 'welcome');
    for (const d of STARTER_DECKS) {
      await c.store.addCards(c.userId, d.list.cards, 'starter', d.id);
      await c.store.createDeck(c.userId, d.name, d.list.cards, d.list.essence);
    }
  }
  return summary(c, {});
};

const summary: Handler = async (c) => {
  const profile = await c.store.getProfile(c.userId);
  if (!profile) throw new HttpError(404, 'Profile not found.');
  const scoops = await c.store.getWallet(c.userId);
  const dailyClaimed = (await c.store.countLedger(c.userId, 'daily', dayStart(c.now))) > 0;
  return { profile: { ...profile, level: levelForXp(profile.xp) }, scoops, dailyClaimed };
};

const setUsername: Handler = async (c, b) => {
  const name = str(b.username, 'username', 16);
  if (!/^[A-Za-z0-9_]{3,16}$/.test(name)) throw new HttpError(400, 'Usernames are 3–16 letters, numbers or underscores.');
  if ((await c.store.setUsername(c.userId, name)) === 'taken') throw new HttpError(409, 'That username is taken.');
  return { username: name };
};

const claimDaily: Handler = async (c) => {
  const ok = await c.store.grantScoops(c.userId, DAILY_LOGIN_SCOOPS, 'daily', dayKey(c.now));
  if (!ok) throw new HttpError(409, 'Daily reward already claimed. Come back tomorrow!');
  return { granted: DAILY_LOGIN_SCOOPS, scoops: await c.store.getWallet(c.userId) };
};

const openPack: Handler = async (c, b) => {
  const expansionId = str(b.expansionId, 'expansion', 40);
  let exp;
  try { exp = getExpansion(expansionId); } catch { throw new HttpError(404, 'Unknown expansion.'); }
  const cards = rollPack(expansionId, (n) => randomInt(n));
  let packId: string;
  try {
    packId = await c.store.openPackTx(c.userId, expansionId, exp.packPrice, cards.map((x) => x.id));
  } catch (e) {
    if (e instanceof InsufficientFundsError || /INSUFFICIENT_SCOOPS/.test(String((e as Error).message))) throw new HttpError(402, 'Not enough Scoops for this pack.');
    throw e;
  }
  await progress(c, 'packOpened', 1);
  const unlocked: string[] = [];
  if (await c.store.unlockAchievement(c.userId, 'first-pack', ach('first-pack'))) unlocked.push('first-pack');
  const owned = Object.keys(await c.store.getCollection(c.userId)).length;
  for (const [id, n] of [['collector-50', 50], ['collector-100', 100]] as const) {
    if (owned >= n && (await c.store.unlockAchievement(c.userId, id, ach(id)))) unlocked.push(id);
  }
  return { packId, cards: cards.map((x) => x.id), scoops: await c.store.getWallet(c.userId), unlocked };
};

const ach = (id: string) => ACHIEVEMENTS.find((a) => a.id === id)!.reward;

async function progress(c: Ctx, event: MissionEvent, amount: number) {
  if (amount <= 0) return;
  for (const m of MISSIONS.filter((x) => x.event === event)) await c.store.bumpMission(c.userId, m.id, periodKey(m, c.now), amount);
}

const listMissions: Handler = async (c) => {
  const rows = await c.store.getMissionProgress(c.userId, [dayKey(c.now), weekKey(c.now)]);
  return {
    missions: MISSIONS.map((m) => {
      const r = rows.find((x) => x.mission_id === m.id && x.period_key === periodKey(m, c.now));
      return { ...m, progress: Math.min(r?.progress ?? 0, m.target), claimed: r?.claimed ?? false };
    }),
  };
};

const claimMission: Handler = async (c, b) => {
  const m = MISSIONS.find((x) => x.id === b.missionId);
  if (!m) throw new HttpError(404, 'Unknown mission.');
  const ok = await c.store.claimMission(c.userId, m.id, periodKey(m, c.now), m.target, m.reward);
  if (!ok) throw new HttpError(409, 'Mission not complete or already claimed.');
  return { granted: m.reward, scoops: await c.store.getWallet(c.userId) };
};

// ─── Decks ─────────────────────────────────────────────────────────────────────

/** Loads a deck the user may play: one of their saved decks (ownership-checked) or a starter deck. */
async function loadPlayableDeck(c: Ctx, deckRef: unknown): Promise<DeckList> {
  const ref = str(deckRef, 'deck', 80);
  const starter = STARTER_DECKS.find((d) => d.id === ref);
  if (starter) return starter.list;
  const deck = await c.store.getDeck(ref);
  if (!deck || deck.user_id !== c.userId) throw new HttpError(404, 'Deck not found.');
  const list: DeckList = { cards: deck.cards, essence: deck.essence as EssenceElement[] };
  const v = validateDeck(list);
  if (!v.ok) throw new HttpError(400, `Deck is not legal: ${v.errors[0]}`, { errors: v.errors });
  const owned = await c.store.getCollection(c.userId);
  const need = new Map<string, number>();
  for (const id of list.cards) need.set(id, (need.get(id) ?? 0) + 1);
  for (const [id, n] of need) if ((owned[id] ?? 0) < n) throw new HttpError(403, `You don't own enough copies of ${id}.`);
  return list;
}

// ─── Matches ───────────────────────────────────────────────────────────────────

function seatOf(m: MatchRow, userId: string): PlayerIndex {
  if (m.player0 === userId) return 0;
  if (m.player1 === userId) return 1;
  throw new HttpError(403, 'You are not in this match.');
}

function waitingOn(s: GameState): PlayerIndex[] {
  if (s.phase === 'over') return [];
  if (s.phase === 'setup') return ([0, 1] as PlayerIndex[]).filter((p) => !s.players[p].setupDone);
  if (s.pending.length) return [s.pending[0].player];
  return [s.current];
}

function deadlineFor(m: MatchRow, s: GameState, now: Date): string | null {
  if (m.mode !== 'online' || s.phase === 'over') return null;
  return new Date(now.getTime() + (s.phase === 'setup' ? SETUP_SECONDS : TURN_SECONDS) * 1000).toISOString();
}

async function persist(c: Ctx, m: MatchRow, next: GameState, events: GameEvent[]) {
  const status: MatchRow['status'] = next.phase === 'over' ? 'finished' : 'active';
  const deadline = deadlineFor(m, next, c.now);
  const ok = await c.store.updateMatch(m.id, m.version, next, status, deadline);
  if (!ok) throw new HttpError(409, 'The match changed — refreshing.', { conflict: true });
  const humans = [m.player0, m.player1].map((u, i) => ({ u, i: i as PlayerIndex })).filter((x) => x.u) as { u: string; i: PlayerIndex }[];
  await c.store.writeViews(m.id, humans.map(({ u, i }) => ({ userId: u, seat: i, view: getPlayerView(next, i), events, status, deadline })));
  const updated = { ...m, state: next, version: next.version, status, turn_deadline: deadline };
  if (status !== 'active') await finalizeMatch(c, updated);
  return updated;
}

async function opponentAvatar(c: Ctx, m: MatchRow, seat: PlayerIndex) {
  if (m.mode === 'solo') return aiOpponentsFor((m.ai_difficulty as Difficulty) ?? 'easy')[0].avatar;
  const id = seat === 0 ? m.player1 : m.player0;
  return (await c.store.getProfile(id!))?.avatar ?? 'kappish';
}

async function opponentName(c: Ctx, m: MatchRow, seat: PlayerIndex) {
  if (m.mode === 'solo') return `AI · ${m.ai_difficulty}`;
  const id = seat === 0 ? m.player1 : m.player0;
  return (await c.store.getProfile(id!))?.username ?? 'Opponent';
}

/** Grants rewards exactly once per match (guarded by markRewardsGranted + per-user result rows). */
async function finalizeMatch(c: Ctx, m: MatchRow) {
  if (!(await c.store.markRewardsGranted(m.id))) return;
  const s = m.state;
  for (const seat of [0, 1] as PlayerIndex[]) {
    const userId = seat === 0 ? m.player0 : m.player1;
    if (!userId) continue;
    const result = s.winner === 'draw' ? 'draw' : s.winner === seat ? 'win' : 'loss';
    const forfeited = result === 'loss' && (s.winReason === 'concede' || s.winReason === 'timeout');
    const oppName = await opponentName(c, m, seat);
    const since = dayStart(c.now);
    const reward = computeMatchReward({
      mode: m.mode, difficulty: (m.ai_difficulty as Difficulty) ?? null, result, turns: s.turn,
      forfeitedByThisPlayer: forfeited,
      rewardedSoloToday: await c.store.countResults(userId, since, { mode: 'solo', minScoops: 1 }),
      rewardedVsOpponentToday: await c.store.countResults(userId, since, { mode: 'online', opponent: oppName, minScoops: 1 }),
      firstWinToday: (await c.store.countResults(userId, since, { result: 'win' })) === 0,
      now: c.now,
    });
    const recorded = await c.store.recordResult({
      match_id: m.id, user_id: userId, mode: m.mode, opponent_name: oppName, difficulty: m.ai_difficulty, result,
      reason: s.winReason, turns: s.turn, scoops: reward.scoops, xp: reward.xp, knockouts: s.kos[seat],
    });
    if (!recorded || reward.xp === 0) continue; // unrewarded (short/forfeited) matches don't progress missions
    const uc: Ctx = { ...c, userId };
    await progress(uc, 'matchPlayed', 1);
    await progress(uc, 'knockout', s.kos[seat]);
    if (m.mode === 'online') await progress(uc, 'onlinePlayed', 1);
    if (result === 'win') {
      await progress(uc, 'matchWon', 1);
      await c.store.unlockAchievement(userId, 'first-win', ach('first-win'));
      if (m.mode === 'online') await c.store.unlockAchievement(userId, 'first-online-win', ach('first-online-win'));
      if (m.ai_difficulty === 'expert') await c.store.unlockAchievement(userId, 'expert-win', ach('expert-win'));
    }
  }
}

async function matchPayload(c: Ctx, m: MatchRow, seat: PlayerIndex, events: GameEvent[] = []) {
  return {
    matchId: m.id, mode: m.mode, seat, status: m.status, difficulty: m.ai_difficulty,
    opponentName: await opponentName(c, m, seat), opponentAvatar: await opponentAvatar(c, m, seat), deadline: m.turn_deadline,
    view: getPlayerView(m.state, seat), events,
  };
}

const soloStart: Handler = async (c, b) => {
  const difficulty = b.difficulty as Difficulty;
  if (!DIFFICULTIES.includes(difficulty)) throw new HttpError(400, 'Unknown difficulty.');
  const deck = await loadPlayableDeck(c, b.deckId);
  const opponents = aiOpponentsFor(difficulty);
  const opp = opponents[randomInt(opponents.length)];
  let state = createMatch([deck, opp.deck], { seed: secureSeed(c) });
  state = runAi(state, 1, difficulty, secureSeed(c)).state; // AI completes its setup
  const row = { mode: 'solo' as const, status: 'active' as const, player0: c.userId, player1: null, ai_difficulty: difficulty, state, version: state.version, turn_deadline: null };
  const id = await c.store.createMatch(row);
  const m = { ...row, id, rewards_granted: false, created_at: c.now.toISOString() };
  await c.store.writeViews(id, [{ userId: c.userId, seat: 0, view: getPlayerView(state, 0), events: [], status: 'active' }]);
  return { ...(await matchPayload(c, m, 0)), opponent: { name: opp.name, title: opp.title, avatar: opp.avatar } };
};

async function loadMatch(c: Ctx, b: Record<string, unknown>) {
  const m = await c.store.getMatch(str(b.matchId, 'match', 80));
  if (!m) throw new HttpError(404, 'Match not found.');
  return { m, seat: seatOf(m, c.userId) };
}

const matchState: Handler = async (c, b) => {
  const { m, seat } = await loadMatch(c, b);
  return matchPayload(c, m, seat);
};

const matchAction: Handler = async (c, b) => {
  const { m, seat } = await loadMatch(c, b);
  if (m.status !== 'active') throw new HttpError(409, 'This match has ended.');
  if (typeof b.version === 'number' && b.version !== m.state.version) {
    throw new HttpError(409, 'Out of date — refreshing.', { conflict: true, ...(await matchPayload(c, m, seat)) });
  }
  const r = applyAction(m.state, seat, b.action as Action);
  if (!r.ok) throw new HttpError(422, r.error);
  let next = r.state;
  const events = [...r.events];
  if (m.mode === 'solo' && next.phase !== 'over') {
    const ai = runAi(next, 1, m.ai_difficulty as Difficulty, secureSeed(c));
    next = ai.state;
    events.push(...ai.events);
  }
  const updated = await persist(c, m, next, events);
  return matchPayload(c, updated, seat, events);
};

const matchForfeit: Handler = async (c, b) => {
  const { m, seat } = await loadMatch(c, b);
  if (m.status !== 'active') return matchPayload(c, m, seat);
  const r = applyAction(m.state, seat, { type: 'concede' });
  if (!r.ok) throw new HttpError(422, r.error);
  const updated = await persist(c, m, r.state, r.events);
  return matchPayload(c, updated, seat, r.events);
};

/**
 * Anti-stall for online matches. After the turn deadline the waiting player may force the staller's
 * turn to end (auto-setup / auto-promote / end turn). After an extra grace period they may claim the win.
 */
const claimTimeout: Handler = async (c, b) => {
  const { m, seat } = await loadMatch(c, b);
  if (m.mode !== 'online' || m.status !== 'active' || !m.turn_deadline) throw new HttpError(409, 'Nothing to claim.');
  const staller = waitingOn(m.state).find((p) => p !== seat);
  if (staller === undefined) throw new HttpError(409, 'Your opponent is not holding up the match.');
  const deadline = new Date(m.turn_deadline).getTime();
  if (c.now.getTime() < deadline) throw new HttpError(409, 'Your opponent still has time.');
  let s = m.state;
  const events: GameEvent[] = [];
  if (c.now.getTime() >= deadline + ABANDON_GRACE_SECONDS * 1000) {
    const r = applyAction(s, staller, { type: 'concede' });
    if (r.ok) { s = r.state; s.winReason = 'timeout'; events.push(...r.events); }
  } else {
    // Play the staller's minimum required moves.
    for (let i = 0; i < 6 && waitingOn(s).includes(staller); i++) {
      const legal = legalActions(s, staller);
      const pick = legal.find((a) => a.type === 'setupActive') ?? legal.find((a) => a.type === 'setupDone')
        ?? legal.find((a) => a.type === 'promote') ?? legal.find((a) => a.type === 'endTurn');
      if (!pick) break;
      const r = applyAction(s, staller, pick);
      if (!r.ok) break;
      s = r.state;
      events.push(...r.events);
    }
  }
  const updated = await persist(c, m, s, events);
  return matchPayload(c, updated, seat, events);
};

const activeMatches: Handler = async (c) => {
  const list = await c.store.activeMatchesFor(c.userId);
  return { matches: await Promise.all(list.map(async (m) => ({ matchId: m.id, mode: m.mode, difficulty: m.ai_difficulty, opponentName: await opponentName(c, m, seatOf(m, c.userId)), turn: m.state.turn }))) };
};

// ─── Rooms ─────────────────────────────────────────────────────────────────────

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function newCode() {
  return Array.from({ length: 6 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('');
}

function publicRoom(r: RoomRow) {
  const { host_deck: _h, guest_deck: _g, ...rest } = r;
  return rest;
}

const roomCreate: Handler = async (c, b) => {
  await loadPlayableDeck(c, b.deckId);
  const profile = await c.store.getProfile(c.userId);
  for (let i = 0; i < 5; i++) {
    try {
      const r = await c.store.createRoom({
        code: newCode(), host: c.userId, guest: null, host_deck: b.deckId as string, guest_deck: null, host_ready: false, guest_ready: false,
        host_name: profile?.username ?? 'Host', guest_name: null, status: 'open', match_id: null,
      });
      return { room: publicRoom(r) };
    } catch { /* code collision, retry */ }
  }
  throw new HttpError(500, 'Could not create a room. Try again.');
};

const roomJoin: Handler = async (c, b) => {
  const code = str(b.code, 'room code', 12).toUpperCase().replace(/[^A-Z0-9]/g, '');
  const r = await c.store.getRoomByCode(code);
  if (!r || r.status === 'closed') throw new HttpError(404, 'No open room with that code.');
  if (r.host === c.userId) throw new HttpError(400, 'You are the host of this room.');
  if (r.status === 'started') {
    if (r.guest === c.userId) return { room: publicRoom(r) }; // reconnecting guest
    throw new HttpError(409, 'That match has already started.');
  }
  if (r.guest && r.guest !== c.userId) throw new HttpError(409, 'That room is full.');
  await loadPlayableDeck(c, b.deckId);
  const profile = await c.store.getProfile(c.userId);
  const u = await c.store.updateRoom(r.id, { guest: c.userId, guest_deck: b.deckId as string, guest_ready: false, guest_name: profile?.username ?? 'Guest' }, r.updated_at);
  if (!u) throw new HttpError(409, 'Someone else joined first.');
  return { room: publicRoom(u) };
};

async function loadRoom(c: Ctx, b: Record<string, unknown>) {
  const r = await c.store.getRoom(str(b.roomId, 'room', 80));
  if (!r || (r.host !== c.userId && r.guest !== c.userId)) throw new HttpError(404, 'Room not found.');
  return r;
}

const roomGet: Handler = async (c, b) => ({ room: publicRoom(await loadRoom(c, b)) });

const roomReady: Handler = async (c, b) => {
  const r = await loadRoom(c, b);
  if (r.status !== 'open') throw new HttpError(409, 'This room is no longer open.');
  const isHost = r.host === c.userId;
  const patch: Partial<RoomRow> = {};
  if (b.deckId !== undefined) {
    await loadPlayableDeck(c, b.deckId);
    patch[isHost ? 'host_deck' : 'guest_deck'] = b.deckId as string;
  }
  patch[isHost ? 'host_ready' : 'guest_ready'] = !!b.ready;
  let u = await c.store.updateRoom(r.id, patch, r.updated_at);
  if (!u) throw new HttpError(409, 'Room changed — try again.', { conflict: true });
  if (u.host_ready && u.guest_ready && u.guest && u.host_deck && u.guest_deck) {
    // Re-validate both decks with their owners' collections, then start.
    const hostDeck = await loadPlayableDeck({ ...c, userId: u.host }, u.host_deck);
    const guestDeck = await loadPlayableDeck({ ...c, userId: u.guest }, u.guest_deck);
    const state = createMatch([hostDeck, guestDeck], { seed: secureSeed(c) });
    const row = { mode: 'online' as const, status: 'active' as const, player0: u.host, player1: u.guest, ai_difficulty: null, state, version: state.version, turn_deadline: new Date(c.now.getTime() + SETUP_SECONDS * 1000).toISOString() };
    const started = await c.store.updateRoom(u.id, { status: 'started' }, u.updated_at);
    if (!started) throw new HttpError(409, 'Room changed — try again.', { conflict: true });
    const matchId = await c.store.createMatch(row);
    await c.store.writeViews(matchId, [
      { userId: u.host, seat: 0, view: getPlayerView(state, 0), events: [], status: 'active', deadline: row.turn_deadline },
      { userId: u.guest, seat: 1, view: getPlayerView(state, 1), events: [], status: 'active', deadline: row.turn_deadline },
    ]);
    u = (await c.store.updateRoom(u.id, { match_id: matchId })) ?? u;
  }
  return { room: publicRoom(u) };
};

const roomLeave: Handler = async (c, b) => {
  const r = await loadRoom(c, b);
  if (r.status === 'started') return { room: publicRoom(r) };
  const patch: Partial<RoomRow> = r.host === c.userId ? { status: 'closed' } : { guest: null, guest_deck: null, guest_ready: false, guest_name: null, host_ready: false };
  const u = await c.store.updateRoom(r.id, patch);
  return { room: u ? publicRoom(u) : null };
};

export const HANDLERS: Record<string, Handler> = {
  'account.bootstrap': bootstrap,
  'account.summary': summary,
  'account.setUsername': setUsername,
  'economy.claimDaily': claimDaily,
  'shop.openPack': openPack,
  'missions.list': listMissions,
  'missions.claim': claimMission,
  'solo.start': soloStart,
  'match.state': matchState,
  'match.action': matchAction,
  'match.forfeit': matchForfeit,
  'match.claimTimeout': claimTimeout,
  'match.active': activeMatches,
  'room.create': roomCreate,
  'room.join': roomJoin,
  'room.get': roomGet,
  'room.ready': roomReady,
  'room.leave': roomLeave,
};

export async function dispatch(c: Ctx, op: unknown, body: Record<string, unknown>) {
  const h = typeof op === 'string' ? HANDLERS[op] : undefined;
  if (!h) throw new HttpError(404, 'Unknown operation.');
  return h(c, body ?? {});
}

