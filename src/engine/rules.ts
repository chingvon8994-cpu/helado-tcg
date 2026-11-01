import { ESSENCE_ELEMENTS, type EssenceElement } from '../cards/types';
import { copyKey, getCard, hasCard } from '../cards/registry';

/** Every number that shapes a match lives here, so formats can be tuned without code changes. */
export interface RuleConfig {
  deckSize: number;
  maxCopies: number;
  minBasics: number;
  maxEssenceTypes: number;
  openingHand: number;
  benchSize: number;
  pointsToWin: number;
  primePoints: number;
  weaknessBonus: number;
  resistanceReduction: number;
  poisonDamage: number;
  burnDamage: number;
  firstPlayerGetsEssence: boolean;
  /** Global turn number after which the match ends (higher points wins, otherwise draw). */
  maxTurns: number;
  /** Evolution blocked while turn number <= this value (i.e. each player's first turn). */
  noEvolveBeforeTurn: number;
}

export const DEFAULT_RULES: RuleConfig = {
  deckSize: 20,
  maxCopies: 2,
  minBasics: 1,
  maxEssenceTypes: 3,
  openingHand: 5,
  benchSize: 3,
  pointsToWin: 3,
  primePoints: 2,
  weaknessBonus: 20,
  resistanceReduction: 20,
  poisonDamage: 10,
  burnDamage: 20,
  firstPlayerGetsEssence: false,
  maxTurns: 60,
  noEvolveBeforeTurn: 2,
};

export interface DeckList {
  cards: string[]; // card ids, one entry per copy
  essence: EssenceElement[];
}

export interface DeckValidation {
  ok: boolean;
  errors: string[];
}

export function validateDeck(deck: DeckList, rules: RuleConfig = DEFAULT_RULES): DeckValidation {
  const errors: string[] = [];
  if (deck.cards.length !== rules.deckSize) errors.push(`Deck must contain exactly ${rules.deckSize} cards (has ${deck.cards.length}).`);
  const unknown = deck.cards.filter((id) => !hasCard(id));
  if (unknown.length) errors.push(`Unknown cards: ${[...new Set(unknown)].join(', ')}`);
  const counts = new Map<string, number>();
  let basics = 0;
  for (const id of deck.cards) {
    if (!hasCard(id)) continue;
    const c = getCard(id);
    const k = copyKey(c);
    counts.set(k, (counts.get(k) ?? 0) + 1);
    if (c.category === 'creature' && c.stage === 'basic') basics++;
  }
  for (const [name, n] of counts) if (n > rules.maxCopies) errors.push(`At most ${rules.maxCopies} copies of “${name}” (has ${n}).`);
  if (basics < rules.minBasics) errors.push(`Deck needs at least ${rules.minBasics} Basic creature.`);
  if (deck.essence.length < 1) errors.push('Choose at least 1 Essence type.');
  if (deck.essence.length > rules.maxEssenceTypes) errors.push(`Choose at most ${rules.maxEssenceTypes} Essence types.`);
  if (new Set(deck.essence).size !== deck.essence.length) errors.push('Essence types must be unique.');
  if (deck.essence.some((e) => !(ESSENCE_ELEMENTS as readonly string[]).includes(e))) errors.push('Invalid Essence type.');
  return { ok: errors.length === 0, errors };
}
