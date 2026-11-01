import { getCard } from '../cards/registry';
import type { TrainerCard } from '../cards/types';
import {
  applyAction, defOf, determinize, legalActions, maxHp, type Action, type GameState, type PlayerIndex, type PlayerView,
} from '../engine';
import { Rng } from '../engine/rng';
import { bestAttackDamage, evaluate } from './evaluate';

export type Difficulty = 'beginner' | 'easy' | 'normal' | 'expert';
export const DIFFICULTIES: { id: Difficulty; label: string; blurb: string }[] = [
  { id: 'beginner', label: 'Beginner', blurb: 'Learning the ropes. Makes plenty of mistakes.' },
  { id: 'easy', label: 'Easy', blurb: 'Knows the basics: bench, power up, attack.' },
  { id: 'normal', label: 'Normal', blurb: 'Weighs every move it can make this turn.' },
  { id: 'expert', label: 'Expert', blurb: 'Plans whole turns ahead and respects your threats.' },
];

/**
 * Picks the next action for the AI. The AI receives only its PlayerView — identical to what a
 * human client sees — and simulations run on determinized states, so it never sees hidden cards.
 */
export function chooseAction(view: PlayerView, difficulty: Difficulty, seed: number): Action {
  const rng = new Rng(seed);
  const s = determinize(view, rng.int(2 ** 31));
  const me = view.me;
  const legal = legalActions(s, me).filter((a) => a.type !== 'concede');
  if (!legal.length) return { type: 'concede' };
  if (legal.length === 1) return legal[0];
  if (s.phase === 'setup') return setupPolicy(s, me, legal, difficulty, rng);
  if (legal[0].type === 'promote') return promotePolicy(s, me, legal, difficulty, rng);
  switch (difficulty) {
    case 'beginner': return beginnerPolicy(s, me, legal, rng);
    case 'easy': return easyPolicy(s, me, legal);
    case 'normal': return greedyPolicy(view, me, legal, rng, 2);
    case 'expert': return expertPolicy(view, me, legal, rng);
  }
}

// ─── Setup & promotion ──────────────────────────────────────────────────────────

function basicScore(cardId: string) {
  const d = getCard(cardId);
  if (d.category !== 'creature') return 0;
  const cheapest = Math.min(...d.attacks.map((a) => a.cost.length));
  return d.hp + (d.prime ? 40 : 0) - cheapest * 10 - d.retreat * 5;
}

function setupPolicy(s: GameState, me: PlayerIndex, legal: Action[], d: Difficulty, rng: Rng): Action {
  const hand = s.players[me].hand;
  const nameOf = (uid: string) => hand.find((h) => h.uid === uid)!.cardId;
  const actives = legal.filter((a): a is Extract<Action, { type: 'setupActive' }> => a.type === 'setupActive');
  if (actives.length) {
    if (d === 'beginner') return rng.pick(actives);
    return actives.reduce((a, b) => (basicScore(nameOf(b.handUid)) > basicScore(nameOf(a.handUid)) ? b : a));
  }
  const bench = legal.filter((a) => a.type === 'setupBench');
  if (bench.length && (d !== 'beginner' || rng.coin())) return bench[0];
  return { type: 'setupDone' };
}

function promotePolicy(s: GameState, me: PlayerIndex, legal: Action[], d: Difficulty, rng: Rng): Action {
  if (d === 'beginner') return rng.pick(legal);
  const ps = s.players[me];
  const opp = s.players[me === 0 ? 1 : 0].active;
  let best = legal[0];
  let bestScore = -Infinity;
  for (const a of legal) {
    if (a.type !== 'promote') continue;
    const c = ps.bench.find((b) => b.uid === a.benchUid)!;
    const hpLeft = maxHp(s, me, c) - c.damage;
    let score = hpLeft + c.energy.length * 25;
    if (opp) {
      score += bestAttackDamage(s, me, c, opp) * 1.2;
      if (d === 'expert' && opp.damage + bestAttackDamage(s, me, c, opp) >= maxHp(s, me === 0 ? 1 : 0, opp)) score += 200;
    }
    if (score > bestScore) { bestScore = score; best = a; }
  }
  return best;
}

// ─── Beginner: easy policy with frequent random slips ──────────────────────────

function beginnerPolicy(s: GameState, me: PlayerIndex, legal: Action[], rng: Rng): Action {
  if (rng.next() < 0.35) {
    const pool = legal.filter((a) => a.type !== 'endTurn' || rng.next() < 0.3);
    if (pool.length) return rng.pick(pool);
  }
  return easyPolicy(s, me, legal);
}

// ─── Easy: fixed priorities, no look-ahead ─────────────────────────────────────

function easyPolicy(s: GameState, me: PlayerIndex, legal: Action[]): Action {
  const ps = s.players[me];
  const find = (t: Action['type']) => legal.filter((a) => a.type === t);
  const basics = find('playBasic');
  if (basics.length) return basics[0];
  const evo = find('evolve');
  if (evo.length) return evo[0];
  const attach = find('attachEssence') as Extract<Action, { type: 'attachEssence' }>[];
  if (attach.length && ps.active) {
    const a = ps.active;
    const needs = defOf(a).attacks.some((x) => x.cost.length > a.energy.length);
    if (needs) return attach.find((x) => x.targetUid === a.uid) ?? attach[0];
    const benchNeed = ps.bench.find((b) => defOf(b).attacks.some((x) => x.cost.length > b.energy.length));
    if (benchNeed) return attach.find((x) => x.targetUid === benchNeed.uid) ?? attach[0];
    return attach[0];
  }
  for (const a of find('playTrainer') as Extract<Action, { type: 'playTrainer' }>[]) {
    const card = getCard(ps.hand.find((h) => h.uid === a.handUid)!.cardId) as TrainerCard;
    const switches = card.effects?.some((e) => e.type === 'switchOwn');
    if (switches) {
      const act = ps.active!;
      const struggling = act.damage * 2 >= maxHp(s, me, act) || act.status.some((x) => x === 'asleep' || x === 'paralyzed');
      if (!struggling) continue;
    }
    if (card.trainerKind === 'tool' && a.targetUid !== ps.active?.uid) continue;
    return a;
  }
  const ab = find('useAbility');
  if (ab.length) return ab[0];
  const attacks = find('attack') as Extract<Action, { type: 'attack' }>[];
  if (attacks.length && ps.active) {
    const atks = defOf(ps.active).attacks;
    return attacks.reduce((a, b) => (atks[b.index].damage >= atks[a.index].damage ? b : a));
  }
  return { type: 'endTurn' };
}

// ─── Normal: one-step greedy look-ahead averaged over determinizations ─────────

function simulate(s: GameState, me: PlayerIndex, a: Action): GameState | null {
  const r = applyAction(s, me, a);
  return r.ok ? r.state : null;
}

function greedyPolicy(view: PlayerView, me: PlayerIndex, legal: Action[], rng: Rng, samples: number): Action {
  const worlds = Array.from({ length: samples }, () => determinize(view, rng.int(2 ** 31)));
  let best = legal[legal.length - 1];
  let bestScore = -Infinity;
  for (const a of legal) {
    let total = 0;
    for (const w of worlds) {
      const n = simulate(w, me, a);
      total += n ? evaluate(n, me) : -1e9;
    }
    // Small bias to keep developing rather than ending the turn early on ties.
    const score = total / worlds.length + (a.type === 'endTurn' ? -1 : 0);
    if (score > bestScore) { bestScore = score; best = a; }
  }
  return best;
}

// ─── Expert: beam search over whole-turn action sequences ──────────────────────

const EXPERT_DEPTH = 3;
const EXPERT_BRANCH = 4;
const EXPERT_SAMPLES = 3;

function expertPolicy(view: PlayerView, me: PlayerIndex, legal: Action[], rng: Rng): Action {
  const worlds = Array.from({ length: EXPERT_SAMPLES }, () => determinize(view, rng.int(2 ** 31)));
  let best = legal[legal.length - 1];
  let bestScore = -Infinity;
  for (const a of legal) {
    let total = 0;
    for (const w of worlds) {
      const n = simulate(w, me, a);
      total += n ? lookahead(n, me, EXPERT_DEPTH - 1) : -1e9;
    }
    const score = total / worlds.length + tieBreak(a);
    if (score > bestScore) { bestScore = score; best = a; }
  }
  return best;
}

/** Prefer developing actions over ending the turn when values are equal. */
function tieBreak(a: Action) {
  return a.type === 'endTurn' ? -2 : a.type === 'attack' ? -1 : 0;
}

function lookahead(s: GameState, me: PlayerIndex, depth: number): number {
  const myTurn = s.phase === 'main' && s.current === me && !s.pending.length;
  if (depth <= 0 || !myTurn) return evaluate(s, me);
  const legal = legalActions(s, me).filter((a) => a.type !== 'concede');
  const scored: { st: GameState; v: number }[] = [];
  for (const a of legal) {
    const n = simulate(s, me, a);
    if (n) scored.push({ st: n, v: evaluate(n, me) });
  }
  scored.sort((x, y) => y.v - x.v);
  let best = -Infinity;
  for (const { st } of scored.slice(0, EXPERT_BRANCH)) best = Math.max(best, lookahead(st, me, depth - 1));
  return best === -Infinity ? evaluate(s, me) : best;
}

/** Runs AI actions until it is no longer the AI's move (used by the local match runner and server). */
export function aiShouldAct(view: PlayerView): boolean {
  if (view.phase === 'over') return false;
  if (view.phase === 'setup') return !view.you.setupDone;
  if (view.pending.length) return view.pending[0].player === view.me;
  return view.current === view.me;
}
