import { canPay, defOf, finalDamage, inPlay, maxHp, other, retreatCost } from '../engine';
import type { GameState, InPlayCreature, PlayerIndex } from '../engine';
import { HIDDEN_CARD } from '../engine/helpers';

/** Highest damage `att` could deal to `def` with energy `energy` (ignores coin upside). */
export function bestAttackDamage(s: GameState, owner: PlayerIndex, att: InPlayCreature, def: InPlayCreature | null, energy = att.energy): number {
  if (!def) return 0;
  let best = 0;
  for (const a of defOf(att).attacks) {
    if (!canPay(energy, a.cost)) continue;
    let base = a.damage;
    for (const m of a.mods ?? []) {
      if (m.mode === 'coinFlips') base += (m.flips * m.perHeads) / 2;
      if (m.mode === 'coinOrNothing') base /= 2;
      if (m.mode === 'flipUntilTails') base += m.perHeads;
      if (m.mode === 'ifDamaged' && (m.side === 'opponent' ? def.damage : att.damage) > 0) base += m.bonus;
      if (m.mode === 'ifStatus' && def.status.length) base += m.bonus;
      if (m.mode === 'perEnergy') base += (m.side === 'self' ? att.energy.length : def.energy.length) * m.per;
    }
    if (base <= 0) continue;
    best = Math.max(best, finalDamage(s, owner, att, def, base).amount);
  }
  return best;
}

/** Turns of essence still needed before `c` can use its strongest attack. */
function energyGap(c: InPlayCreature): number {
  const atks = defOf(c).attacks;
  const strongest = atks.reduce((a, b) => (b.damage >= a.damage ? b : a), atks[0]);
  if (!strongest) return 0;
  return Math.max(0, strongest.cost.length - c.energy.length) + (canPay(c.energy, strongest.cost) ? 0 : 0.5);
}

function creatureValue(s: GameState, p: PlayerIndex, c: InPlayCreature, isActive: boolean) {
  const def = defOf(c);
  const hp = maxHp(s, p, c);
  const remaining = Math.max(0, hp - c.damage);
  let v = remaining * 0.6 + hp * 0.15;
  v += c.energy.length * 18;
  v -= energyGap(c) * 6;
  if (def.stage === 'stage1') v += 25;
  if (def.stage === 'stage2') v += 50;
  if (def.prime) v += 30;
  if (c.tool) v += 10;
  if (isActive) {
    if (c.status.includes('asleep') || c.status.includes('paralyzed')) v -= 25;
    if (c.status.includes('poisoned')) v -= 12;
    if (c.status.includes('burned')) v -= 16;
    if (c.status.includes('confused')) v -= 10;
  }
  return v;
}

/**
 * Static evaluation from `me`'s perspective. Uses only information that a player has
 * (it is applied to determinized states, whose hidden zones are placeholders).
 */
export function evaluate(s: GameState, me: PlayerIndex): number {
  if (s.phase === 'over') return s.winner === me ? 1e6 : s.winner === 'draw' ? 0 : -1e6;
  const op = other(me);
  const mine = s.players[me];
  const theirs = s.players[op];
  let v = (mine.points - theirs.points) * 600;
  v += mine.points >= s.rules.pointsToWin - 1 ? 150 : 0;
  v -= theirs.points >= s.rules.pointsToWin - 1 ? 150 : 0;

  for (const c of inPlay(mine)) v += creatureValue(s, me, c, c === mine.active);
  for (const c of inPlay(theirs)) v -= creatureValue(s, op, c, c === theirs.active) * 0.9;
  if (!mine.active && s.pending.some((x) => x.player === me)) v -= 30;

  // Tempo: hand quality and board presence.
  v += Math.min(mine.hand.filter((h) => h.cardId !== HIDDEN_CARD).length, 7) * 6;
  v += mine.bench.length * 12;
  if (!mine.bench.length) v -= 60; // one KO from losing

  // Threat assessment for the coming exchange.
  const myA = mine.active;
  const thA = theirs.active;
  if (myA && thA) {
    const myNext = bestAttackDamage(s, me, myA, thA, [...myA.energy, ...(mine.essenceTypes.slice(0, 1))]);
    const theirNext = bestAttackDamage(s, op, thA, myA, [...thA.energy, s.current === op && theirs.essenceCurrent ? theirs.essenceCurrent : theirs.essenceNext]);
    const myHpLeft = maxHp(s, me, myA) - myA.damage;
    const thHpLeft = maxHp(s, op, thA) - thA.damage;
    if (theirNext >= myHpLeft) v -= (defOf(myA).prime ? 2 : 1) * 260 + myA.energy.length * 8;
    else v -= theirNext * 0.8;
    if (myNext >= thHpLeft) v += (defOf(thA).prime ? 2 : 1) * 110;
    else v += myNext * 0.5;
    if (retreatCost(s, me, myA) > myA.energy.length && theirNext >= myHpLeft) v -= 20;
  }
  // Terrain that helps our side.
  if (s.terrain) v += s.terrain.owner === me ? 8 : -4;
  return v;
}
