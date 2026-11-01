import { ELEMENT_META } from './elements';
import type { Ability, Attack, CardFilter, DamageMod, Effect, Passive, TargetSel } from './types';

/** Generates card rules text from structured definitions, so text always matches behaviour. */

const target = (t: TargetSel): string => ({
  self: 'this creature', ownActive: 'your Active creature', opponentActive: 'your opponent’s Active creature',
  chosenOwn: '1 of your creatures', chosenOwnBench: '1 of your Benched creatures', chosenOpponent: '1 of your opponent’s creatures',
  chosenOpponentBench: '1 of your opponent’s Benched creatures', allOwn: 'each of your creatures', allOwnBench: 'each of your Benched creatures',
  allOpponentBench: 'each of your opponent’s Benched creatures', randomOpponent: 'a random opposing creature',
}[t]);

const el = (e: string) => ELEMENT_META[e as keyof typeof ELEMENT_META]?.label ?? e;

function filterText(f: CardFilter): string {
  const parts: string[] = [];
  if (f.stage) parts.push(f.stage === 'basic' ? 'Basic' : f.stage === 'stage1' ? 'Stage 1' : 'Stage 2');
  if (f.element) parts.push(el(f.element));
  if (f.trainerKind) parts.push(f.trainerKind[0].toUpperCase() + f.trainerKind.slice(1));
  if (f.evolvesFromInPlay) return 'creature that evolves from one of your creatures in play';
  parts.push(f.category === 'trainer' ? (f.trainerKind ? 'card' : 'Trainer card') : f.category === 'creature' ? 'creature' : 'card');
  return parts.join(' ');
}

export function effectText(e: Effect): string {
  const coin = e.coin ? 'Flip a coin. If heads, ' : '';
  const cap = (s: string) => (coin ? s : s[0].toUpperCase() + s.slice(1));
  const t = (() => {
    switch (e.type) {
      case 'draw': return `draw ${e.count} card${e.count > 1 ? 's' : ''}.`;
      case 'heal': return `heal ${e.amount === 'all' ? 'all' : e.amount} damage from ${target(e.target)}.`;
      case 'cureStatus': return `remove all status conditions from ${target(e.target)}.`;
      case 'applyStatus': return `${e.target === 'self' ? 'this creature' : 'your opponent’s Active creature'} is now ${e.status[0].toUpperCase() + e.status.slice(1)}.`;
      case 'damage': return `do ${e.amount} damage to ${target(e.target)}.`;
      case 'discardEnergy': return `discard ${e.count === 'all' ? 'all' : e.count}${e.element && e.element !== 'neutral' ? ` ${el(e.element)}` : ''} Essence from ${e.target === 'self' ? 'this creature' : 'your opponent’s Active creature'}.`;
      case 'attachEssence': return `attach ${e.count} ${el(e.element)} Essence to ${target(e.target)}.`;
      case 'attachEssenceFromDiscard': return `attach ${e.count}${e.element ? ` ${el(e.element)}` : ''} Essence from your discard pile to ${target(e.target)}.`;
      case 'moveEnergy': return `move ${e.count === 'all' ? 'all' : e.count} Essence from ${e.from === 'ownActive' ? 'your Active creature' : '1 of your Benched creatures'} to ${e.to === 'ownActive' ? 'your Active creature' : '1 of your Benched creatures'}.`;
      case 'searchDeck': return `put ${e.count} random ${filterText(e.filter)}${e.count > 1 ? 's' : ''} from your deck into your hand.`;
      case 'recoverFromDiscard': return `put ${e.count} random ${filterText(e.filter)}${e.count > 1 ? 's' : ''} from your discard pile into your hand.`;
      case 'switchOwn': return 'switch your Active creature with 1 of your Benched creatures.';
      case 'switchOpponent': return 'switch your opponent’s Active creature with 1 of their Benched creatures.';
      case 'returnToHand': return `return ${e.target === 'ownActive' ? 'your Active creature' : '1 of your Benched creatures'} and its cards to your hand.`;
      case 'opponentShuffleHandDraw': return `your opponent shuffles their hand into their deck and draws ${e.count} cards.`;
      case 'shuffleHandDraw': return `shuffle your hand into your deck and draw ${e.count} cards.`;
      case 'discardRandomFromOpponentHand': return `discard ${e.count} random card${e.count > 1 ? 's' : ''} from your opponent’s hand.`;
      case 'revealOpponentHand': return 'look at your opponent’s hand.';
      case 'preventDamage': return e.amount === 'all' ? 'during your opponent’s next turn, prevent all damage done to this creature by attacks.' : `during your opponent’s next turn, this creature takes ${e.amount} less damage from attacks.`;
      case 'reduceIncoming': return `during your opponent’s next turn, this creature takes ${e.amount} less damage from attacks.`;
      case 'weakenOpponent': return `during your opponent’s next turn, attacks used by the Defending creature do ${e.amount} less damage.`;
      case 'cantRetreat': return 'during your opponent’s next turn, the Defending creature can’t retreat.';
      case 'cantAttackNextTurn': return 'during your next turn, this creature can’t attack.';
      case 'turnDamageBoost': return `during this turn, attacks used by your${e.element ? ` ${el(e.element)}` : ''} creatures do +${e.amount} damage to your opponent’s Active creature.`;
      case 'turnRetreatReduction': return `during this turn, your Active creature’s Retreat Cost is ${e.amount} less.`;
      case 'gainPointOnKO': return 'if your opponent’s Active creature is Knocked Out by this attack, take 1 more point.';
      case 'shuffleDiscardIntoDeck': return `shuffle ${e.count} random cards from your discard pile into your deck.`;
    }
  })();
  return coin + cap(t);
}

export function modText(m: DamageMod, base: number): string {
  switch (m.mode) {
    case 'coinFlips': return m.flips === 1 ? `Flip a coin. If heads, this attack does ${m.perHeads} more damage.` : `Flip ${m.flips} coins. This attack does ${m.perHeads} more damage for each heads.`;
    case 'coinOrNothing': return 'Flip a coin. If tails, this attack does nothing.';
    case 'flipUntilTails': return `Flip a coin until you get tails. This attack does ${m.perHeads} more damage for each heads.`;
    case 'perEnergy': return `This attack does ${m.per} more damage for each${m.element ? ` ${el(m.element)}` : ''} Essence attached to ${m.side === 'self' ? 'this creature' : 'your opponent’s Active creature'}.`;
    case 'perExtraEnergy': return `This attack does ${m.per} more damage for each extra ${el(m.element)} Essence attached to this creature (up to ${m.max}).`;
    case 'ifDamaged': return `If ${m.side === 'self' ? 'this creature' : 'your opponent’s Active creature'} has damage on it, this attack does ${m.bonus} more damage.`;
    case 'ifStatus': return `If your opponent’s Active creature is ${m.status ? m.status[0].toUpperCase() + m.status.slice(1) : 'affected by a status condition'}, this attack does ${m.bonus} more damage.`;
    case 'perBench': return `This attack does ${m.per} more damage for each ${m.side === 'own' ? 'of your Benched creatures' : m.side === 'opponent' ? 'of your opponent’s Benched creatures' : 'Benched creature (both yours and your opponent’s)'}.`;
    case 'perDamageOnSelf': return `This attack does ${m.per} more damage for each 10 damage on this creature.`;
    case 'ifOpponentPrime': return `If your opponent’s Active creature is a Prime, this attack does ${m.bonus} more damage.`;
    case 'ifOpponentElement': return `If your opponent’s Active creature is ${el(m.element)}, this attack does ${m.bonus} more damage.`;
    case 'ifPlayedSupporter': return `If you played a Supporter this turn, this attack does ${m.bonus} more damage.`;
  }
  void base;
}

export function attackText(a: Attack): string {
  if (a.text) return a.text;
  const parts = [...(a.mods ?? []).map((m) => modText(m, a.damage)), ...(a.effects ?? []).map(effectText)];
  if (a.recoil) parts.push(`This creature also does ${a.recoil} damage to itself.`);
  return parts.join(' ');
}

export function passiveText(p: Passive): string {
  const who = p.filter ? describeFilter(p.filter) : 'This creature';
  const where = p.activeOnly ? ' while it is your Active creature' : '';
  switch (p.type) {
    case 'damageReduction': return `${who} takes ${p.amount} less damage from attacks${where}.`;
    case 'hpBonus': return `${who} get${p.filter ? '' : 's'} +${p.amount} HP${where}.`;
    case 'damageBonus': return `Attacks used by ${p.filter ? who.toLowerCase() : 'this creature'} do +${p.amount} damage to the opponent’s Active creature${where}.`;
    case 'retreatReduction': return `${who}’s Retreat Cost is ${p.amount} less.`;
    case 'thorns': return `If ${p.filter ? who.toLowerCase() : 'this creature'} is damaged by an attack${where}, do ${p.amount} damage to the attacking creature.`;
    case 'checkupHeal': return `At the end of its owner’s turn, heal ${p.amount} damage from ${p.filter ? who.toLowerCase() : 'this creature'}.`;
    case 'statusImmune': return `${who} can’t be affected by status conditions.`;
    case 'noWeakness': return `${who} has no Weakness.`;
    case 'statusDamageBonus': return 'Poison and Burn on your opponent’s creatures do 20 more damage between turns.'.replace('20', String(p.amount));
    case 'freeRetreatIfEnergy': return 'If this creature has any Essence attached, it has no Retreat Cost.';
  }
}

function describeFilter(f: NonNullable<Passive['filter']>) {
  const parts = [f.stage === 'basic' ? 'Basic' : f.stage === 'stage1' ? 'Stage 1' : f.stage === 'stage2' ? 'Stage 2' : '', f.element ? el(f.element) : '', f.prime ? 'Prime' : ''].filter(Boolean);
  return `${parts.join(' ')} creatures`.trim();
}

export function abilityText(a: Ability): string {
  if (a.text) return a.text;
  if (a.kind === 'passive') return passiveText(a.passive);
  return `Once during your turn${a.requiresActive ? ', if this creature is your Active creature' : ''}, you may use this ability. ${a.effects.map(effectText).join(' ')}`;
}
