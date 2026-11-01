import { getCard, getCreature } from '../cards/registry';
import type { Attack, CreatureCard, Effect, EssenceElement, Status, TargetSel, TrainerCard } from '../cards/types';
import { Rng } from './rng';
import { DEFAULT_RULES, type DeckList, type RuleConfig } from './rules';
import {
  HIDDEN_CARD, canPay, defOf, hasPassive, inPlay, isBasicCreature, locate, maxHp, other, passivesFor, retreatCost, sumPassive,
} from './helpers';
import { resolveEffect, effectNeedsTarget, targetCandidates, effectIsUseful } from './effects';
import type {
  Action, ActionResult, CardInstance, GameEvent, GameState, InPlayCreature, PlayerIndex, PlayerState,
} from './types';

const LOG_LIMIT = 200;
export const FOREVER = 9999;

/** Mutable context used while resolving one action. */
export class Ctx {
  rng: Rng;
  events: GameEvent[] = [];
  constructor(public s: GameState) {
    this.rng = new Rng(s.rng);
  }
  emit(e: GameEvent) {
    this.events.push(e);
  }
  uid(): string {
    return `c${this.s.nextUid++}`;
  }
  ps(p: PlayerIndex): PlayerState {
    return this.s.players[p];
  }
  flip(player: PlayerIndex, n = 1): boolean[] {
    const coins = Array.from({ length: n }, () => this.rng.coin());
    this.emit({ t: 'coin', player, coins });
    return coins;
  }
  finish(): GameState {
    this.s.rng = this.rng.seed;
    this.s.version++;
    this.s.log.push(...this.events);
    if (this.s.log.length > LOG_LIMIT) this.s.log.splice(0, this.s.log.length - LOG_LIMIT);
    return this.s;
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Match creation
// ──────────────────────────────────────────────────────────────────────────────

export interface MatchOptions {
  id?: string;
  seed: number;
  rules?: RuleConfig;
  firstPlayer?: PlayerIndex;
}

export function createMatch(decks: [DeckList, DeckList], opts: MatchOptions): GameState {
  const rules = opts.rules ?? DEFAULT_RULES;
  const rng = new Rng(opts.seed >>> 0 || 1);
  let nextUid = 1;
  const players = decks.map((d) => {
    const deck: CardInstance[] = rng.shuffle(d.cards.map((cardId) => ({ uid: `c${nextUid++}`, cardId })));
    const hand: CardInstance[] = [];
    // Opening hand is guaranteed to contain at least one Basic creature.
    const basicIdx = deck.findIndex((c) => isBasicCreature(c.cardId));
    if (basicIdx >= 0) hand.push(deck.splice(basicIdx, 1)[0]);
    while (hand.length < rules.openingHand && deck.length) hand.push(deck.shift()!);
    rng.shuffle(hand);
    const ps: PlayerState = {
      deck, hand, discard: [], essenceDiscard: [], active: null, bench: [], points: 0,
      essenceTypes: [...d.essence], essenceCurrent: null, essenceNext: rng.pick(d.essence),
      attachedThisTurn: false, supporterThisTurn: false, retreatedThisTurn: false, setupDone: false,
      revealedOpponentHandTurn: -1,
    };
    return ps;
  }) as [PlayerState, PlayerState];
  const firstPlayer: PlayerIndex = opts.firstPlayer ?? (rng.coin() ? 0 : 1);
  return {
    id: opts.id ?? `m${opts.seed}`,
    rules, turn: 0, current: firstPlayer, firstPlayer, phase: 'setup', pending: [], players,
    terrain: null, buffs: [], rng: rng.seed, nextUid, winner: null, winReason: null, version: 0,
    resume: null, bonusPointUid: null, kos: [0, 0],
    log: [{ t: 'setup', player: firstPlayer, text: `Player ${firstPlayer + 1} goes first.` }],
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Legal actions — the single source of truth for validation.
// ──────────────────────────────────────────────────────────────────────────────

export function legalActions(s: GameState, p: PlayerIndex): Action[] {
  const out: Action[] = [];
  if (s.phase === 'over') return out;
  const ps = s.players[p];
  if (s.phase === 'setup') {
    if (ps.setupDone) return [{ type: 'concede' }];
    const basics = ps.hand.filter((c) => isBasicCreature(c.cardId));
    if (!ps.active) basics.forEach((c) => out.push({ type: 'setupActive', handUid: c.uid }));
    else {
      if (ps.bench.length < s.rules.benchSize) basics.forEach((c) => out.push({ type: 'setupBench', handUid: c.uid }));
      out.push({ type: 'setupDone' });
    }
    out.push({ type: 'concede' });
    return out;
  }
  if (s.pending.length) {
    const pend = s.pending[0];
    if (pend.player === p) ps.bench.forEach((b) => out.push({ type: 'promote', benchUid: b.uid }));
    out.push({ type: 'concede' });
    return out;
  }
  if (s.current !== p) return [{ type: 'concede' }];

  const own = inPlay(ps);
  // Basic creatures to bench
  if (ps.bench.length < s.rules.benchSize) {
    for (const c of ps.hand) if (isBasicCreature(c.cardId)) out.push({ type: 'playBasic', handUid: c.uid });
  }
  // Evolution
  if (s.turn > s.rules.noEvolveBeforeTurn) {
    for (const h of ps.hand) {
      if (h.cardId === HIDDEN_CARD) continue;
      const def = getCard(h.cardId);
      if (def.category !== 'creature' || !def.evolvesFrom) continue;
      for (const t of own) {
        if (defOf(t).species !== def.evolvesFrom) continue;
        if (t.playedTurn === s.turn || t.evolvedTurn === s.turn) continue;
        out.push({ type: 'evolve', handUid: h.uid, targetUid: t.uid });
      }
    }
  }
  // Essence
  if (ps.essenceCurrent && !ps.attachedThisTurn) for (const t of own) out.push({ type: 'attachEssence', targetUid: t.uid });
  // Trainers
  for (const h of ps.hand) {
    if (h.cardId === HIDDEN_CARD) continue;
    const def = getCard(h.cardId);
    if (def.category !== 'trainer') continue;
    out.push(...trainerActions(s, p, h, def));
  }
  // Abilities
  for (const c of own) {
    const ab = defOf(c).ability;
    if (!ab || ab.kind !== 'activated' || c.abilityUsedTurn === s.turn) continue;
    if (ab.requiresActive && ps.active?.uid !== c.uid) continue;
    out.push(...effectActions(s, p, ab.effects, c.uid, (targetUid) => ({ type: 'useAbility', creatureUid: c.uid, targetUid })));
  }
  // Retreat
  const a = ps.active;
  if (a && ps.bench.length && !ps.retreatedThisTurn && !a.status.includes('asleep') && !a.status.includes('paralyzed')
    && !a.effects.some((e) => e.kind === 'cantRetreat') && a.energy.length >= retreatCost(s, p, a)) {
    ps.bench.forEach((b) => out.push({ type: 'retreat', benchUid: b.uid }));
  }
  // Attacks
  if (a && !a.status.includes('asleep') && !a.status.includes('paralyzed') && !a.effects.some((e) => e.kind === 'cantAttack')) {
    defOf(a).attacks.forEach((atk, index) => {
      if (!canPay(a.energy, atk.cost)) return;
      // Attacks whose effects need a chosen target (e.g. "1 of your opponent's Benched creatures")
      // are offered once per valid target; if there is none, the attack is still usable.
      const needing = (atk.effects ?? []).find((e) => effectNeedsTarget(e));
      const targets = needing ? targetCandidates(s, p, needing, a.uid) : [];
      if (!targets.length) out.push({ type: 'attack', index });
      else targets.forEach((targetUid) => out.push({ type: 'attack', index, targetUid }));
    });
  }
  out.push({ type: 'endTurn' });
  out.push({ type: 'concede' });
  return out;
}

function conditionMet(s: GameState, p: PlayerIndex, def: TrainerCard): boolean {
  const ps = s.players[p];
  const opp = s.players[other(p)];
  switch (def.condition) {
    case undefined: return true;
    case 'ownActiveDamaged': return !!ps.active && ps.active.damage > 0;
    case 'anyOwnDamaged': return inPlay(ps).some((c) => c.damage > 0);
    case 'hasBench': return ps.bench.length > 0;
    case 'opponentHasBench': return opp.bench.length > 0;
    case 'ownActiveHasStatus': return !!ps.active && ps.active.status.length > 0;
    case 'discardHasCreature': return ps.discard.some((c) => c.cardId !== HIDDEN_CARD && getCard(c.cardId).category === 'creature');
    case 'discardHasEssenceCost': return ps.essenceDiscard.length > 0;
    case 'behindOnPoints': return ps.points < opp.points;
  }
}

function trainerActions(s: GameState, p: PlayerIndex, h: CardInstance, def: TrainerCard): Action[] {
  const ps = s.players[p];
  if (!conditionMet(s, p, def)) return [];
  switch (def.trainerKind) {
    case 'tool':
      return inPlay(ps).filter((c) => !c.tool).map((c) => ({ type: 'playTrainer', handUid: h.uid, targetUid: c.uid }));
    case 'terrain':
      if (s.terrain && getCard(s.terrain.card.cardId).name === def.name) return [];
      return [{ type: 'playTrainer', handUid: h.uid }];
    case 'supporter':
      if (ps.supporterThisTurn) return [];
      return effectActions(s, p, def.effects ?? [], null, (targetUid) => ({ type: 'playTrainer', handUid: h.uid, targetUid }));
    case 'item':
      return effectActions(s, p, def.effects ?? [], null, (targetUid) => ({ type: 'playTrainer', handUid: h.uid, targetUid }));
  }
}

/** Builds actions for an effect list, expanding the (single) chosen target if one is needed. */
function effectActions(s: GameState, p: PlayerIndex, effects: Effect[], sourceUid: string | null, make: (t?: string) => Action): Action[] {
  const needing = effects.find((e) => effectNeedsTarget(e));
  if (!needing) {
    if (!effects.some((e) => effectIsUseful(s, p, e, sourceUid, undefined))) return [];
    return [make(undefined)];
  }
  return targetCandidates(s, p, needing, sourceUid)
    .filter((uid) => effects.some((e) => effectIsUseful(s, p, e, sourceUid, uid)))
    .map((uid) => make(uid));
}

export function sameAction(a: Action, b: Action) {
  const ka = a as Record<string, unknown>;
  const kb = b as Record<string, unknown>;
  const keys = new Set([...Object.keys(ka), ...Object.keys(kb)]);
  for (const k of keys) if (ka[k] !== kb[k]) return false;
  return true;
}

// ──────────────────────────────────────────────────────────────────────────────
// Applying actions
// ──────────────────────────────────────────────────────────────────────────────

export function applyAction(state: GameState, p: PlayerIndex, action: Action): ActionResult {
  const clean = sanitizeAction(action);
  if (!clean) return { ok: false, error: 'Malformed action.' };
  const legal = legalActions(state, p);
  if (!legal.some((a) => sameAction(a, clean))) return { ok: false, error: describeIllegal(state, p, clean) };
  const ctx = new Ctx(structuredClone(state));
  perform(ctx, p, clean);
  const events = ctx.events;
  return { ok: true, state: ctx.finish(), events };
}

/** Strips unknown fields so that hostile payloads can't smuggle extra data into state. */
function sanitizeAction(a: unknown): Action | null {
  if (!a || typeof a !== 'object') return null;
  const x = a as Record<string, unknown>;
  const str = (k: string) => (typeof x[k] === 'string' ? (x[k] as string) : undefined);
  switch (x.type) {
    case 'setupActive': case 'setupBench': case 'playBasic':
      return str('handUid') ? { type: x.type, handUid: str('handUid')! } as Action : null;
    case 'setupDone': case 'endTurn': case 'concede':
      return { type: x.type } as Action;
    case 'evolve':
      return str('handUid') && str('targetUid') ? { type: 'evolve', handUid: str('handUid')!, targetUid: str('targetUid')! } : null;
    case 'attachEssence':
      return str('targetUid') ? { type: 'attachEssence', targetUid: str('targetUid')! } : null;
    case 'playTrainer':
      return str('handUid') ? { type: 'playTrainer', handUid: str('handUid')!, targetUid: str('targetUid') } : null;
    case 'useAbility':
      return str('creatureUid') ? { type: 'useAbility', creatureUid: str('creatureUid')!, targetUid: str('targetUid') } : null;
    case 'retreat':
      return str('benchUid') ? { type: 'retreat', benchUid: str('benchUid')! } : null;
    case 'promote':
      return str('benchUid') ? { type: 'promote', benchUid: str('benchUid')! } : null;
    case 'attack':
      return Number.isInteger(x.index) ? { type: 'attack', index: x.index as number, targetUid: str('targetUid') } : null;
    default:
      return null;
  }
}

function describeIllegal(s: GameState, p: PlayerIndex, a: Action): string {
  if (s.phase === 'over') return 'The match is over.';
  if (s.phase === 'main' && s.pending.length && s.pending[0].player !== p) return 'Waiting for your opponent to choose a new Active creature.';
  if (s.phase === 'main' && s.current !== p && !s.pending.length) return 'It is not your turn.';
  return `That action (${a.type}) is not allowed right now.`;
}

function takeFromHand(ps: PlayerState, uid: string): CardInstance {
  const i = ps.hand.findIndex((c) => c.uid === uid);
  return ps.hand.splice(i, 1)[0];
}

function newCreature(ci: CardInstance, turn: number): InPlayCreature {
  return {
    uid: ci.uid, cardId: ci.cardId, stack: [ci], damage: 0, energy: [], tool: null, status: [],
    playedTurn: turn, evolvedTurn: -1, abilityUsedTurn: -1, effects: [],
  };
}

function perform(ctx: Ctx, p: PlayerIndex, a: Action) {
  const s = ctx.s;
  const ps = ctx.ps(p);
  switch (a.type) {
    case 'concede':
      return gameOver(ctx, other(p), 'concede');
    case 'setupActive': {
      ps.active = newCreature(takeFromHand(ps, a.handUid), 0);
      return;
    }
    case 'setupBench': {
      ps.bench.push(newCreature(takeFromHand(ps, a.handUid), 0));
      return;
    }
    case 'setupDone': {
      ps.setupDone = true;
      if (s.players.every((x) => x.setupDone)) {
        s.phase = 'main';
        s.current = other(s.firstPlayer); // startNextTurn flips it back to firstPlayer
        startNextTurn(ctx);
      }
      return;
    }
    case 'playBasic': {
      const ci = takeFromHand(ps, a.handUid);
      const c = newCreature(ci, s.turn);
      ps.bench.push(c);
      ctx.emit({ t: 'playBasic', player: p, uid: c.uid, cardId: c.cardId });
      return;
    }
    case 'evolve': {
      const ci = takeFromHand(ps, a.handUid);
      const loc = locate(s, a.targetUid)!;
      const c = loc.creature;
      const fromId = c.cardId;
      c.stack.push(ci);
      c.uid = ci.uid;
      c.cardId = ci.cardId;
      c.evolvedTurn = s.turn;
      c.status = [];
      ctx.emit({ t: 'evolve', player: p, uid: c.uid, cardId: c.cardId, text: `${getCard(fromId).name} evolved into ${getCard(ci.cardId).name}!` });
      return;
    }
    case 'attachEssence': {
      const c = locate(s, a.targetUid)!.creature;
      c.energy.push(ps.essenceCurrent!);
      ctx.emit({ t: 'attach', player: p, uid: c.uid, text: ps.essenceCurrent! });
      ps.essenceCurrent = null;
      ps.attachedThisTurn = true;
      return;
    }
    case 'playTrainer': {
      const ci = takeFromHand(ps, a.handUid);
      const def = getCard(ci.cardId) as TrainerCard;
      ctx.emit({ t: 'trainer', player: p, cardId: ci.cardId, uid: a.targetUid });
      if (def.trainerKind === 'tool') {
        locate(s, a.targetUid!)!.creature.tool = ci;
        return;
      }
      if (def.trainerKind === 'terrain') {
        if (s.terrain) ctx.ps(s.terrain.owner).discard.push(s.terrain.card);
        s.terrain = { card: ci, owner: p };
        return;
      }
      if (def.trainerKind === 'supporter') ps.supporterThisTurn = true;
      ps.discard.push(ci);
      for (const e of def.effects ?? []) runEffect(ctx, p, e, null, a.targetUid);
      afterNonAttackAction(ctx);
      return;
    }
    case 'useAbility': {
      const c = locate(s, a.creatureUid)!.creature;
      const ab = defOf(c).ability!;
      if (ab.kind !== 'activated') return;
      c.abilityUsedTurn = s.turn;
      ctx.emit({ t: 'ability', player: p, uid: c.uid, text: ab.name });
      for (const e of ab.effects) runEffect(ctx, p, e, c.uid, a.targetUid);
      afterNonAttackAction(ctx);
      return;
    }
    case 'retreat': {
      const act = ps.active!;
      const cost = retreatCost(s, p, act);
      const discarded = act.energy.splice(act.energy.length - cost, cost);
      ps.essenceDiscard.push(...discarded);
      switchActive(ctx, p, a.benchUid);
      ps.retreatedThisTurn = true;
      ctx.emit({ t: 'retreat', player: p, uid: ps.active!.uid, amount: cost });
      return;
    }
    case 'attack':
      return doAttack(ctx, p, a.index, a.targetUid);
    case 'endTurn':
      return endTurn(ctx);
    case 'promote': {
      const i = ps.bench.findIndex((b) => b.uid === a.benchUid);
      ps.active = ps.bench.splice(i, 1)[0];
      s.pending.shift();
      ctx.emit({ t: 'promote', player: p, uid: ps.active.uid, cardId: ps.active.cardId });
      if (!s.pending.length) {
        const r = s.resume;
        s.resume = null;
        if (r === 'endTurn') endTurn(ctx);
        else if (r === 'startNext') startNextTurn(ctx);
      }
      return;
    }
  }
}

export function switchActive(ctx: Ctx, p: PlayerIndex, benchUid: string) {
  const ps = ctx.ps(p);
  const i = ps.bench.findIndex((b) => b.uid === benchUid);
  if (i < 0 || !ps.active) return;
  const out = ps.active;
  out.status = [];
  out.effects = [];
  ps.active = ps.bench[i];
  ps.bench[i] = out;
  ctx.emit({ t: 'switch', player: p, uid: ps.active.uid });
}

function afterNonAttackAction(ctx: Ctx) {
  resolveKOs(ctx);
}

// ──────────────────────────────────────────────────────────────────────────────
// Effects (thin wrapper so coin flips are handled uniformly)
// ──────────────────────────────────────────────────────────────────────────────

export function runEffect(ctx: Ctx, p: PlayerIndex, e: Effect, sourceUid: string | null, targetUid?: string) {
  if (ctx.s.phase === 'over') return;
  if (e.coin) {
    const [heads] = ctx.flip(p);
    if (!heads) return;
  }
  resolveEffect(ctx, p, e, sourceUid, targetUid);
}

export function applyStatus(ctx: Ctx, owner: PlayerIndex, c: InPlayCreature, st: Status) {
  if (hasPassive(passivesFor(ctx.s, owner, c), 'statusImmune')) {
    ctx.emit({ t: 'info', uid: c.uid, text: `${defOf(c).name} is immune to status conditions.` });
    return;
  }
  const exclusive: Status[] = ['asleep', 'paralyzed', 'confused'];
  if (exclusive.includes(st)) c.status = c.status.filter((x) => !exclusive.includes(x));
  if (!c.status.includes(st)) c.status.push(st);
  ctx.emit({ t: 'status', player: owner, uid: c.uid, status: st });
}

export function dealDamage(ctx: Ctx, owner: PlayerIndex, c: InPlayCreature, amount: number, weakness = false) {
  if (amount <= 0) return;
  c.damage += amount;
  ctx.emit({ t: 'damage', player: owner, uid: c.uid, amount, weakness });
}

export function heal(ctx: Ctx, owner: PlayerIndex, c: InPlayCreature, amount: number) {
  const n = Math.min(c.damage, amount);
  if (n <= 0) return;
  c.damage -= n;
  ctx.emit({ t: 'heal', player: owner, uid: c.uid, amount: n });
}

export function drawCards(ctx: Ctx, p: PlayerIndex, n: number) {
  const ps = ctx.ps(p);
  let drawn = 0;
  for (let i = 0; i < n && ps.deck.length; i++) {
    ps.hand.push(ps.deck.shift()!);
    drawn++;
  }
  if (drawn) ctx.emit({ t: 'draw', player: p, amount: drawn });
}

// ──────────────────────────────────────────────────────────────────────────────
// Attacks and damage
// ──────────────────────────────────────────────────────────────────────────────

function doAttack(ctx: Ctx, p: PlayerIndex, index: number, targetUid?: string) {
  const s = ctx.s;
  const ps = ctx.ps(p);
  const opp = other(p);
  const attacker = ps.active!;
  const aDef = defOf(attacker);
  const atk = aDef.attacks[index];
  ctx.emit({ t: 'attack', player: p, uid: attacker.uid, cardId: attacker.cardId, text: atk.name });

  if (attacker.status.includes('confused')) {
    const [heads] = ctx.flip(p);
    if (!heads) {
      ctx.emit({ t: 'info', player: p, text: `${aDef.name} is confused and the attack failed!` });
      return afterAttack(ctx);
    }
  }
  const defender = ctx.ps(opp).active;
  const base = computeBaseDamage(ctx, p, attacker, defender, atk);
  if (base === null) {
    ctx.emit({ t: 'info', player: p, text: 'The attack did nothing.' });
    return afterAttack(ctx);
  }
  if (defender && base > 0) {
    const { amount, weakness } = finalDamage(s, p, attacker, defender, base);
    dealDamage(ctx, opp, defender, amount, weakness);
    const thorns = sumPassive(passivesFor(s, opp, defender), 'thorns');
    if (amount > 0 && thorns > 0) dealDamage(ctx, p, attacker, thorns);
  }
  for (const e of atk.effects ?? []) {
    if (e.type === 'gainPointOnKO') {
      if (defender) s.bonusPointUid = defender.uid;
      continue;
    }
    runEffect(ctx, p, e, attacker.uid, targetUid);
  }
  if (atk.recoil && ps.active?.uid === attacker.uid) dealDamage(ctx, p, attacker, atk.recoil);
  afterAttack(ctx);
}

/** Printed damage after attack-specific modifiers. `null` means the attack does nothing at all. */
export function computeBaseDamage(ctx: Ctx, p: PlayerIndex, attacker: InPlayCreature, defender: InPlayCreature | null, atk: Attack): number | null {
  let dmg = atk.damage;
  const ps = ctx.ps(p);
  const opp = ctx.ps(other(p));
  for (const m of atk.mods ?? []) {
    switch (m.mode) {
      case 'coinFlips': dmg += ctx.flip(p, m.flips).filter(Boolean).length * m.perHeads; break;
      case 'coinOrNothing': if (!ctx.flip(p)[0]) return null; break;
      case 'flipUntilTails': {
        const coins: boolean[] = [];
        while (coins.length < 20) { const h = ctx.rng.coin(); coins.push(h); if (!h) break; }
        ctx.emit({ t: 'coin', player: p, coins });
        dmg += (coins.filter(Boolean).length) * m.perHeads;
        break;
      }
      case 'perEnergy': {
        const src = m.side === 'self' ? attacker : defender;
        const n = src ? src.energy.filter((e) => !m.element || e === m.element).length : 0;
        dmg += n * m.per;
        break;
      }
      case 'perExtraEnergy': {
        const need = atk.cost.filter((c) => c === m.element).length;
        const have = attacker.energy.filter((e) => e === m.element).length;
        dmg += Math.min(m.max, Math.max(0, have - need)) * m.per;
        break;
      }
      case 'ifDamaged': {
        const t = m.side === 'self' ? attacker : defender;
        if (t && t.damage > 0) dmg += m.bonus;
        break;
      }
      case 'ifStatus':
        if (defender && (m.status ? defender.status.includes(m.status) : defender.status.length > 0)) dmg += m.bonus;
        break;
      case 'perBench': {
        const n = m.side === 'own' ? ps.bench.length : m.side === 'opponent' ? opp.bench.length : ps.bench.length + opp.bench.length;
        dmg += n * m.per;
        break;
      }
      case 'perDamageOnSelf': dmg += Math.floor(attacker.damage / 10) * m.per; break;
      case 'ifOpponentPrime': if (defender && defOf(defender).prime) dmg += m.bonus; break;
      case 'ifOpponentElement': if (defender && defOf(defender).element === m.element) dmg += m.bonus; break;
      case 'ifPlayedSupporter': if (ps.supporterThisTurn) dmg += m.bonus; break;
    }
  }
  return dmg;
}

/** Weakness, resistance, boosts and reductions. Pure — used by the AI for damage previews as well. */
export function finalDamage(s: GameState, p: PlayerIndex, attacker: InPlayCreature, defender: InPlayCreature, base: number) {
  const aDef = defOf(attacker);
  const dDef = defOf(defender);
  const opp = other(p);
  let dmg = base;
  dmg += sumPassive(passivesFor(s, p, attacker), 'damageBonus');
  for (const b of s.buffs) if (b.player === p && b.kind === 'damageBoost' && b.turn === s.turn && (!b.element || b.element === aDef.element)) dmg += b.amount;
  for (const e of attacker.effects) if (e.kind === 'weaken') dmg -= e.amount;
  const dPass = passivesFor(s, opp, defender);
  let weakness = false;
  if (dDef.weakness && dDef.weakness === aDef.element && !hasPassive(dPass, 'noWeakness')) {
    dmg += s.rules.weaknessBonus;
    weakness = true;
  }
  if (dDef.resistance && dDef.resistance === aDef.element) dmg -= s.rules.resistanceReduction;
  dmg -= sumPassive(dPass, 'damageReduction');
  for (const e of defender.effects) {
    if (e.kind === 'reduceIncoming') dmg -= e.amount;
    if (e.kind === 'preventDamage') dmg = e.amount >= FOREVER ? 0 : dmg - e.amount;
  }
  return { amount: Math.max(0, dmg), weakness };
}

function afterAttack(ctx: Ctx) {
  resolveKOs(ctx);
  ctx.s.bonusPointUid = null;
  if (ctx.s.phase === 'over') return;
  if (ctx.s.pending.length) {
    ctx.s.resume = 'endTurn';
    return;
  }
  endTurn(ctx);
}

// ──────────────────────────────────────────────────────────────────────────────
// Knockouts, victory, turn flow
// ──────────────────────────────────────────────────────────────────────────────

export function resolveKOs(ctx: Ctx) {
  const s = ctx.s;
  if (s.phase !== 'main') return;
  for (const p of [s.current, other(s.current)] as PlayerIndex[]) {
    const ps = ctx.ps(p);
    for (const c of inPlay(ps)) {
      if (c.damage < maxHp(s, p, c)) continue;
      const def = defOf(c);
      let pts = def.prime ? s.rules.primePoints : 1;
      if (s.bonusPointUid === c.uid) pts += 1;
      ps.discard.push(...c.stack);
      if (c.tool) ps.discard.push(c.tool);
      ps.essenceDiscard.push(...c.energy);
      if (ps.active?.uid === c.uid) ps.active = null;
      else ps.bench = ps.bench.filter((b) => b.uid !== c.uid);
      ctx.ps(other(p)).points += pts;
      s.kos[other(p)] += 1;
      ctx.emit({ t: 'ko', player: p, uid: c.uid, cardId: c.cardId, text: `${def.name} was knocked out!` });
      ctx.emit({ t: 'points', player: other(p), amount: pts });
    }
  }
  const wins = ([0, 1] as PlayerIndex[]).map((p) => {
    const me = ctx.ps(p);
    const them = ctx.ps(other(p));
    if (me.points >= s.rules.pointsToWin) return 'points' as const;
    if (!them.active && !them.bench.length) return 'noCreatures' as const;
    return null;
  });
  if (wins[0] && wins[1]) return gameOver(ctx, 'draw', 'points');
  if (wins[0]) return gameOver(ctx, 0, wins[0]);
  if (wins[1]) return gameOver(ctx, 1, wins[1]);
  for (const p of [other(s.current), s.current] as PlayerIndex[]) {
    const ps = ctx.ps(p);
    if (!ps.active && ps.bench.length && !s.pending.some((x) => x.player === p)) s.pending.push({ player: p, kind: 'promote' });
  }
}

export function gameOver(ctx: Ctx, winner: PlayerIndex | 'draw', reason: GameState['winReason']) {
  ctx.s.phase = 'over';
  ctx.s.winner = winner;
  ctx.s.winReason = reason;
  ctx.s.pending = [];
  ctx.emit({ t: 'gameOver', player: winner === 'draw' ? undefined : winner, text: reason ?? '' });
}

export function endTurn(ctx: Ctx) {
  const s = ctx.s;
  if (s.phase !== 'main') return;
  checkup(ctx);
  resolveKOs(ctx);
  if (s.phase !== 'main') return;
  if (s.pending.length) {
    s.resume = 'startNext';
    return;
  }
  startNextTurn(ctx);
}

/** Between-turns step: poison, burn, sleep, paralysis, timed effects. */
function checkup(ctx: Ctx) {
  const s = ctx.s;
  const ended = s.current;
  ctx.emit({ t: 'checkup', player: ended });
  for (const p of [ended, other(ended)] as PlayerIndex[]) {
    const c = ctx.ps(p).active;
    if (!c) continue;
    const bonus = inPlay(ctx.ps(other(p))).reduce((n, x) => n + sumPassive(passivesFor(s, other(p), x), 'statusDamageBonus'), 0);
    if (c.status.includes('poisoned')) dealDamage(ctx, p, c, s.rules.poisonDamage + bonus);
    if (c.status.includes('burned')) {
      dealDamage(ctx, p, c, s.rules.burnDamage + bonus);
      if (ctx.flip(p)[0]) clearStatus(ctx, p, c, 'burned');
    }
    if (c.status.includes('asleep') && ctx.flip(p)[0]) clearStatus(ctx, p, c, 'asleep');
    if (c.status.includes('paralyzed') && p === ended) clearStatus(ctx, p, c, 'paralyzed');
  }
  for (const c of inPlay(ctx.ps(ended))) {
    const h = sumPassive(passivesFor(s, ended, c), 'checkupHeal');
    if (h) heal(ctx, ended, c, h);
  }
  for (const p of [0, 1] as PlayerIndex[]) for (const c of inPlay(ctx.ps(p))) c.effects = c.effects.filter((e) => e.untilTurn > s.turn);
  s.buffs = s.buffs.filter((b) => b.turn > s.turn);
  const ps = ctx.ps(ended);
  if (ps.essenceCurrent) ps.essenceCurrent = null; // unattached essence fades
}

function clearStatus(ctx: Ctx, p: PlayerIndex, c: InPlayCreature, st: Status) {
  c.status = c.status.filter((x) => x !== st);
  ctx.emit({ t: 'statusClear', player: p, uid: c.uid, status: st });
}

function startNextTurn(ctx: Ctx) {
  const s = ctx.s;
  s.turn += 1;
  s.current = other(s.current);
  if (s.turn > s.rules.maxTurns) {
    const [a, b] = [s.players[0].points, s.players[1].points];
    return gameOver(ctx, a === b ? 'draw' : a > b ? 0 : 1, 'turnLimit');
  }
  const ps = ctx.ps(s.current);
  ps.attachedThisTurn = false;
  ps.supporterThisTurn = false;
  ps.retreatedThisTurn = false;
  ctx.emit({ t: 'turnStart', player: s.current, amount: s.turn });
  drawCards(ctx, s.current, 1);
  const noEssence = s.turn === 1 && !s.rules.firstPlayerGetsEssence;
  if (!noEssence) {
    ps.essenceCurrent = ps.essenceNext;
    ps.essenceNext = ctx.rng.pick(ps.essenceTypes) as EssenceElement;
    ctx.emit({ t: 'essence', player: s.current, text: ps.essenceCurrent });
  }
}

// Re-exported for effects.ts
export { getCreature, type CreatureCard, type TargetSel };
