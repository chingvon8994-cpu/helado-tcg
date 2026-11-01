import { getCard, getCreature, hasCard } from '../cards/registry';
import type { CardDef, CardFilter, CreatureCard, Element, Passive } from '../cards/types';
import type { CardInstance, GameState, InPlayCreature, PlayerIndex, PlayerState } from './types';

export const HIDDEN_CARD = '__hidden__';
export const other = (p: PlayerIndex): PlayerIndex => (p === 0 ? 1 : 0);

export function defOf(c: InPlayCreature): CreatureCard {
  return getCreature(c.cardId);
}

export function inPlay(ps: PlayerState): InPlayCreature[] {
  return ps.active ? [ps.active, ...ps.bench] : [...ps.bench];
}

export interface Located {
  player: PlayerIndex;
  creature: InPlayCreature;
  isActive: boolean;
}

export function locate(state: GameState, uid: string): Located | null {
  for (const p of [0, 1] as PlayerIndex[]) {
    const ps = state.players[p];
    if (ps.active?.uid === uid) return { player: p, creature: ps.active, isActive: true };
    const b = ps.bench.find((c) => c.uid === uid);
    if (b) return { player: p, creature: b, isActive: false };
  }
  return null;
}

export function matchesPassiveFilter(def: CreatureCard, f?: Passive['filter']) {
  if (!f) return true;
  if (f.element && def.element !== f.element) return false;
  if (f.stage && def.stage !== f.stage) return false;
  if (f.prime !== undefined && !!def.prime !== f.prime) return false;
  return true;
}

/** All continuous effects currently applying to a creature (its ability, its tool, the terrain). */
export function passivesFor(state: GameState, owner: PlayerIndex, c: InPlayCreature): Passive[] {
  const def = defOf(c);
  const out: Passive[] = [];
  const isActive = state.players[owner].active?.uid === c.uid;
  if (def.ability?.kind === 'passive') {
    const p = def.ability.passive;
    if (!p.activeOnly || isActive) out.push(p);
  }
  if (c.tool) {
    const t = getCard(c.tool.cardId);
    if (t.category === 'trainer' && t.tool && matchesPassiveFilter(def, t.tool.filter) && (!t.tool.activeOnly || isActive)) out.push(t.tool);
  }
  if (state.terrain) {
    const t = getCard(state.terrain.card.cardId);
    if (t.category === 'trainer' && t.field) {
      for (const p of t.field) if (matchesPassiveFilter(def, p.filter) && (!p.activeOnly || isActive)) out.push(p);
    }
  }
  return out;
}

export function sumPassive(list: Passive[], type: Passive['type']): number {
  let n = 0;
  for (const p of list) if (p.type === type && 'amount' in p) n += p.amount;
  return n;
}
export function hasPassive(list: Passive[], type: Passive['type']) {
  return list.some((p) => p.type === type);
}

export function maxHp(state: GameState, owner: PlayerIndex, c: InPlayCreature): number {
  return defOf(c).hp + sumPassive(passivesFor(state, owner, c), 'hpBonus');
}

export function retreatCost(state: GameState, owner: PlayerIndex, c: InPlayCreature): number {
  const ps = passivesFor(state, owner, c);
  if (hasPassive(ps, 'freeRetreatIfEnergy') && c.energy.length > 0) return 0;
  let cost = defOf(c).retreat - sumPassive(ps, 'retreatReduction');
  for (const b of state.buffs) if (b.player === owner && b.kind === 'retreatReduction' && b.turn === state.turn) cost -= b.amount;
  return Math.max(0, cost);
}

/** Can the attached energy pay this cost? 'neutral' in a cost accepts any element. */
export function canPay(energy: Element[], cost: Element[]): boolean {
  if (energy.length < cost.length) return false;
  const pool = new Map<Element, number>();
  for (const e of energy) pool.set(e, (pool.get(e) ?? 0) + 1);
  for (const c of cost) {
    if (c === 'neutral') continue;
    const n = pool.get(c) ?? 0;
    if (n <= 0) return false;
    pool.set(c, n - 1);
  }
  return true;
}

export function cardMatches(card: CardDef, f: CardFilter, ps?: PlayerState): boolean {
  if (f.category && card.category !== f.category) return false;
  if (f.stage && (card.category !== 'creature' || card.stage !== f.stage)) return false;
  if (f.element && (card.category !== 'creature' || card.element !== f.element)) return false;
  if (f.trainerKind && (card.category !== 'trainer' || card.trainerKind !== f.trainerKind)) return false;
  if (f.evolvesFromInPlay) {
    if (card.category !== 'creature' || !card.evolvesFrom || !ps) return false;
    if (!inPlay(ps).some((c) => defOf(c).species === card.evolvesFrom)) return false;
  }
  return true;
}

export function instanceMatches(ci: CardInstance, f: CardFilter, ps?: PlayerState) {
  if (ci.cardId === HIDDEN_CARD || !hasCard(ci.cardId)) return false;
  return cardMatches(getCard(ci.cardId), f, ps);
}

export function isBasicCreature(cardId: string) {
  if (cardId === HIDDEN_CARD) return false;
  const c = getCard(cardId);
  return c.category === 'creature' && c.stage === 'basic';
}
