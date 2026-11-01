import { applyAction, createMatch, legalActions, type Action, type DeckList, type GameState, type PlayerIndex } from '../src/engine';
import type { EssenceElement } from '../src/cards/types';
import type { InPlayCreature } from '../src/engine/types';

export function deck(ids: Record<string, number>, essence: EssenceElement[]): DeckList {
  const cards: string[] = [];
  for (const [id, n] of Object.entries(ids)) for (let i = 0; i < n; i++) cards.push(id);
  return { cards, essence };
}

/** 20-card decks built only from the 14-card test collection. */
export const TEST_DECK_A = deck({
  'GEN-001': 2, 'GEN-002': 2, 'GEN-004': 2, 'GEN-005': 2, 'GEN-010': 2, 'GEN-060': 1,
  'GEN-071': 2, 'GEN-072': 2, 'GEN-073': 1, 'GEN-081': 2, 'GEN-090': 1, 'GEN-095': 1,
}, ['verdant', 'blaze']);
export const TEST_DECK_B = deck({
  'GEN-007': 2, 'GEN-019': 2, 'GEN-012': 2, 'GEN-010': 2, 'GEN-001': 2, 'GEN-002': 2,
  'GEN-071': 2, 'GEN-072': 2, 'GEN-073': 1, 'GEN-082': 2, 'GEN-090': 1,
}, ['tide', 'volt', 'shade']);

export function act(s: GameState, p: PlayerIndex, a: Action): GameState {
  const r = applyAction(s, p, a);
  if (!r.ok) throw new Error(`${JSON.stringify(a)} failed: ${r.error}`);
  return r.state;
}

/** Completes setup by putting the first basic of each hand active. */
export function quickSetup(s: GameState): GameState {
  for (const p of [0, 1] as PlayerIndex[]) {
    const a = legalActions(s, p).find((x) => x.type === 'setupActive')!;
    s = act(s, p, a);
    s = act(s, p, { type: 'setupDone' });
  }
  return s;
}

let uidN = 90_000;
/** Directly builds an in-play creature for scenario tests. */
export function creature(cardId: string, extra: Partial<InPlayCreature> = {}): InPlayCreature {
  const uid = `t${uidN++}`;
  return {
    uid, cardId, stack: [{ uid, cardId }], damage: 0, energy: [], tool: null, status: [],
    playedTurn: 0, evolvedTurn: -1, abilityUsedTurn: -1, effects: [], ...extra,
  };
}

/** A main-phase state at turn 3 (player 0 to act) with chosen actives and empty hands. */
export function scenario(a: string, b: string, opts: { aExtra?: Partial<InPlayCreature>; bExtra?: Partial<InPlayCreature> } = {}): GameState {
  let s = createMatch([TEST_DECK_A, TEST_DECK_B], { seed: 42, firstPlayer: 0 });
  s = quickSetup(s);
  s = structuredClone(s);
  s.turn = 3;
  s.current = 0;
  for (const ps of s.players) {
    ps.deck.push(...ps.hand);
    ps.hand = [];
    ps.bench = [];
    ps.attachedThisTurn = false;
    ps.supporterThisTurn = false;
    ps.essenceCurrent = 'verdant';
  }
  s.players[0].active = creature(a, opts.aExtra);
  s.players[1].active = creature(b, opts.bExtra);
  return s;
}

export function giveHand(s: GameState, p: PlayerIndex, cardIds: string[]) {
  const added = cardIds.map((cardId) => ({ uid: `h${uidN++}`, cardId }));
  s.players[p].hand.push(...added);
  return added;
}

/** Find a seed whose coin flips (as consumed by an action) produce the wanted result. */
export function withSeedFor(s: GameState, p: PlayerIndex, a: Action, check: (st: GameState) => boolean): GameState {
  for (let seed = 1; seed < 500; seed++) {
    const t = structuredClone(s);
    t.rng = seed;
    const r = applyAction(t, p, a);
    if (r.ok && check(r.state)) return r.state;
  }
  throw new Error('No seed satisfied the condition');
}
