import { getCard } from '../cards/registry';
import type { Effect, TargetSel } from '../cards/types';
import {
  Ctx, FOREVER, applyStatus, dealDamage, drawCards, heal, switchActive,
} from './core';
import { HIDDEN_CARD, defOf, inPlay, instanceMatches, locate, maxHp, other } from './helpers';
import type { GameState, InPlayCreature, PlayerIndex } from './types';

const CHOSEN: TargetSel[] = ['chosenOwn', 'chosenOwnBench', 'chosenOpponent', 'chosenOpponentBench'];

/** Which chosen-target selector (if any) this effect requires the player to pick. */
export function chosenSelector(e: Effect): TargetSel | null {
  switch (e.type) {
    case 'switchOwn': return 'chosenOwnBench';
    case 'switchOpponent': return 'chosenOpponentBench';
    case 'moveEnergy': return e.from === 'chosenOwnBench' ? 'chosenOwnBench' : e.to === 'chosenOwnBench' ? 'chosenOwnBench' : null;
    case 'returnToHand': return e.target === 'chosenOwnBench' ? 'chosenOwnBench' : null;
    default:
      if ('target' in e && CHOSEN.includes(e.target as TargetSel)) return e.target as TargetSel;
      return null;
  }
}
export const effectNeedsTarget = (e: Effect) => chosenSelector(e) !== null;

function pool(s: GameState, p: PlayerIndex, sel: TargetSel): InPlayCreature[] {
  const me = s.players[p];
  const op = s.players[other(p)];
  switch (sel) {
    case 'chosenOwn': return inPlay(me);
    case 'chosenOwnBench': return [...me.bench];
    case 'chosenOpponent': return inPlay(op);
    case 'chosenOpponentBench': return [...op.bench];
    default: return [];
  }
}

export function targetCandidates(s: GameState, p: PlayerIndex, e: Effect, _sourceUid: string | null): string[] {
  const sel = chosenSelector(e);
  if (!sel) return [];
  return pool(s, p, sel).map((c) => c.uid);
}

/** Resolve a non-chosen selector to creatures. */
function resolveTargets(s: GameState, p: PlayerIndex, sel: TargetSel, sourceUid: string | null, chosen: string | undefined, rngPick?: (n: number) => number): { owner: PlayerIndex; c: InPlayCreature }[] {
  const me = s.players[p];
  const op = s.players[other(p)];
  const o = other(p);
  switch (sel) {
    case 'self': {
      if (sourceUid) {
        const l = locate(s, sourceUid);
        return l ? [{ owner: l.player, c: l.creature }] : [];
      }
      return me.active ? [{ owner: p, c: me.active }] : [];
    }
    case 'ownActive': return me.active ? [{ owner: p, c: me.active }] : [];
    case 'opponentActive': return op.active ? [{ owner: o, c: op.active }] : [];
    case 'allOwn': return inPlay(me).map((c) => ({ owner: p, c }));
    case 'allOwnBench': return me.bench.map((c) => ({ owner: p, c }));
    case 'allOpponentBench': return op.bench.map((c) => ({ owner: o, c }));
    case 'randomOpponent': {
      const all = inPlay(op);
      if (!all.length || !rngPick) return [];
      return [{ owner: o, c: all[rngPick(all.length)] }];
    }
    default: {
      if (!chosen) return [];
      const l = locate(s, chosen);
      return l ? [{ owner: l.player, c: l.creature }] : [];
    }
  }
}

/**
 * Would this effect do anything right now? Used to avoid offering dead plays.
 * Only effects with a meaningful "nothing to do" state are checked; others are always useful.
 */
export function effectIsUseful(s: GameState, p: PlayerIndex, e: Effect, sourceUid: string | null, chosen?: string): boolean {
  const me = s.players[p];
  const op = s.players[other(p)];
  const t = (sel: TargetSel) => resolveTargets(s, p, sel, sourceUid, chosen, () => 0);
  switch (e.type) {
    case 'heal': return t(e.target).some(({ c }) => c.damage > 0);
    case 'cureStatus': return t(e.target).some(({ c }) => c.status.length > 0);
    case 'draw': return me.deck.length > 0;
    case 'searchDeck': return me.deck.length > 0;
    case 'recoverFromDiscard': return me.discard.some((c) => instanceMatches(c, e.filter, me));
    case 'attachEssenceFromDiscard': return me.essenceDiscard.some((x) => !e.element || x === e.element) && t(e.target).length > 0;
    case 'attachEssence': return t(e.target).length > 0;
    case 'switchOwn': return !!me.active && me.bench.length > 0;
    case 'switchOpponent': return !!op.active && op.bench.length > 0;
    case 'moveEnergy': {
      const from = e.from === 'ownActive' ? me.active : chosen ? locate(s, chosen)?.creature : null;
      const to = e.to === 'ownActive' ? me.active : chosen ? locate(s, chosen)?.creature : null;
      if (!from || !to || from.uid === to.uid) return false;
      return from.energy.some((x) => !e.element || x === e.element);
    }
    case 'returnToHand': return e.target === 'ownActive' ? !!me.active && me.bench.length > 0 : t(e.target).length > 0;
    case 'opponentShuffleHandDraw': case 'discardRandomFromOpponentHand': case 'revealOpponentHand': return op.hand.length > 0 || e.type === 'opponentShuffleHandDraw';
    case 'shuffleHandDraw': return true;
    case 'damage': return t(e.target).length > 0;
    case 'shuffleDiscardIntoDeck': return me.discard.length > 0;
    default: return true;
  }
}

export function resolveEffect(ctx: Ctx, p: PlayerIndex, e: Effect, sourceUid: string | null, chosen?: string) {
  const s = ctx.s;
  const me = ctx.ps(p);
  const o = other(p);
  const op = ctx.ps(o);
  const targets = (sel: TargetSel) => resolveTargets(s, p, sel, sourceUid, chosen, (n) => ctx.rng.int(n));
  switch (e.type) {
    case 'draw':
      return drawCards(ctx, p, e.count);
    case 'heal':
      for (const { owner, c } of targets(e.target)) heal(ctx, owner, c, e.amount === 'all' ? c.damage : e.amount);
      return;
    case 'cureStatus':
      for (const { owner, c } of targets(e.target)) {
        if (c.status.length) ctx.emit({ t: 'statusClear', player: owner, uid: c.uid });
        c.status = [];
      }
      return;
    case 'applyStatus': {
      const tl = e.target === 'self' ? targets('self') : targets('opponentActive');
      for (const { owner, c } of tl) applyStatus(ctx, owner, c, e.status);
      return;
    }
    case 'damage':
      for (const { owner, c } of targets(e.target)) dealDamage(ctx, owner, c, e.amount);
      return;
    case 'discardEnergy': {
      const tl = e.target === 'self' ? targets('self') : targets('opponentActive');
      for (const { owner, c } of tl) {
        const n = e.count === 'all' ? c.energy.length : e.count;
        const removed: string[] = [];
        for (let i = 0; i < n; i++) {
          let idx = e.element && e.element !== 'neutral' ? c.energy.lastIndexOf(e.element) : c.energy.length - 1;
          if (idx < 0 && e.target === 'opponentActive') idx = c.energy.length - 1;
          if (idx < 0) break;
          removed.push(...c.energy.splice(idx, 1));
        }
        ctx.ps(owner).essenceDiscard.push(...(removed as never[]));
        if (removed.length) ctx.emit({ t: 'discardEnergy', player: owner, uid: c.uid, amount: removed.length });
      }
      return;
    }
    case 'attachEssence':
      for (const { owner, c } of targets(e.target)) {
        for (let i = 0; i < e.count; i++) c.energy.push(e.element);
        ctx.emit({ t: 'attach', player: owner, uid: c.uid, text: e.element, amount: e.count });
      }
      return;
    case 'attachEssenceFromDiscard': {
      const tl = targets(e.target);
      if (!tl.length) return;
      const { owner, c } = tl[0];
      for (let i = 0; i < e.count; i++) {
        const idx = me.essenceDiscard.findIndex((x) => !e.element || x === e.element);
        if (idx < 0) break;
        const [el] = me.essenceDiscard.splice(idx, 1);
        c.energy.push(el);
        ctx.emit({ t: 'attach', player: owner, uid: c.uid, text: el });
      }
      return;
    }
    case 'moveEnergy': {
      const from = e.from === 'ownActive' ? me.active : chosen ? locate(s, chosen)?.creature : null;
      const to = e.to === 'ownActive' ? me.active : chosen ? locate(s, chosen)?.creature : null;
      if (!from || !to || from.uid === to.uid) return;
      const n = e.count === 'all' ? from.energy.length : e.count;
      let moved = 0;
      for (let i = 0; i < n; i++) {
        const idx = from.energy.findIndex((x) => !e.element || x === e.element);
        if (idx < 0) break;
        to.energy.push(...from.energy.splice(idx, 1));
        moved++;
      }
      if (moved) ctx.emit({ t: 'attach', player: p, uid: to.uid, amount: moved, text: 'moved' });
      return;
    }
    case 'searchDeck': {
      const found: string[] = [];
      for (let i = 0; i < e.count; i++) {
        const idxs = me.deck.map((c, j) => (instanceMatches(c, e.filter, me) ? j : -1)).filter((j) => j >= 0);
        if (!idxs.length) break;
        const j = idxs[ctx.rng.int(idxs.length)];
        const [ci] = me.deck.splice(j, 1);
        me.hand.push(ci);
        found.push(ci.cardId);
      }
      ctx.rng.shuffle(me.deck);
      ctx.emit({ t: 'search', player: p, text: found.length ? found.map((id) => getCard(id).name).join(', ') : 'Nothing found', amount: found.length });
      return;
    }
    case 'recoverFromDiscard': {
      for (let i = 0; i < e.count; i++) {
        const idxs = me.discard.map((c, j) => (instanceMatches(c, e.filter, me) ? j : -1)).filter((j) => j >= 0);
        if (!idxs.length) break;
        const [ci] = me.discard.splice(idxs[ctx.rng.int(idxs.length)], 1);
        me.hand.push(ci);
        ctx.emit({ t: 'search', player: p, text: `Recovered ${getCard(ci.cardId).name}`, amount: 1 });
      }
      return;
    }
    case 'switchOwn':
      if (chosen) switchActive(ctx, p, chosen);
      return;
    case 'switchOpponent':
      if (chosen) switchActive(ctx, o, chosen);
      return;
    case 'returnToHand': {
      const tl = e.target === 'ownActive' ? targets('ownActive') : targets('chosenOwnBench');
      for (const { c } of tl) {
        me.hand.push(...c.stack);
        if (c.tool) me.discard.push(c.tool);
        me.essenceDiscard.push(...c.energy);
        if (me.active?.uid === c.uid) {
          me.active = null;
          if (!s.pending.some((x) => x.player === p)) s.pending.push({ player: p, kind: 'promote' });
        } else me.bench = me.bench.filter((b) => b.uid !== c.uid);
        ctx.emit({ t: 'info', player: p, text: `${defOf(c).name} returned to hand.` });
      }
      return;
    }
    case 'opponentShuffleHandDraw': {
      op.deck.push(...op.hand);
      op.hand = [];
      ctx.rng.shuffle(op.deck);
      drawCards(ctx, o, e.count);
      return;
    }
    case 'shuffleHandDraw': {
      me.deck.push(...me.hand);
      me.hand = [];
      ctx.rng.shuffle(me.deck);
      drawCards(ctx, p, e.count);
      return;
    }
    case 'discardRandomFromOpponentHand': {
      for (let i = 0; i < e.count && op.hand.length; i++) {
        const [ci] = op.hand.splice(ctx.rng.int(op.hand.length), 1);
        op.discard.push(ci);
        ctx.emit({ t: 'info', player: o, cardId: ci.cardId, text: ci.cardId === HIDDEN_CARD ? 'A card was discarded.' : `${getCard(ci.cardId).name} was discarded from hand.` });
      }
      return;
    }
    case 'revealOpponentHand':
      me.revealedOpponentHandTurn = s.turn;
      ctx.emit({ t: 'info', player: p, text: 'Opponent’s hand revealed.' });
      return;
    case 'preventDamage':
      for (const { c } of targets('self')) c.effects.push({ kind: 'preventDamage', amount: e.amount === 'all' ? FOREVER : e.amount, untilTurn: s.turn + 1 });
      return;
    case 'reduceIncoming':
      for (const { c } of targets('self')) c.effects.push({ kind: 'reduceIncoming', amount: e.amount, untilTurn: s.turn + 1 });
      return;
    case 'weakenOpponent':
      if (op.active) op.active.effects.push({ kind: 'weaken', amount: e.amount, untilTurn: s.turn + 1 });
      return;
    case 'cantRetreat':
      if (op.active) op.active.effects.push({ kind: 'cantRetreat', amount: 0, untilTurn: s.turn + 1 });
      return;
    case 'cantAttackNextTurn':
      for (const { c } of targets('self')) c.effects.push({ kind: 'cantAttack', amount: 0, untilTurn: s.turn + 2 });
      return;
    case 'turnDamageBoost':
      s.buffs.push({ player: p, kind: 'damageBoost', amount: e.amount, element: e.element, turn: s.turn });
      return;
    case 'turnRetreatReduction':
      s.buffs.push({ player: p, kind: 'retreatReduction', amount: e.amount, turn: s.turn });
      return;
    case 'gainPointOnKO':
      return; // handled by the attack resolver
    case 'shuffleDiscardIntoDeck': {
      for (let i = 0; i < e.count && me.discard.length; i++) me.deck.push(...me.discard.splice(ctx.rng.int(me.discard.length), 1));
      ctx.rng.shuffle(me.deck);
      ctx.emit({ t: 'info', player: p, text: 'Cards shuffled back into the deck.' });
      return;
    }
  }
}

export { maxHp };
