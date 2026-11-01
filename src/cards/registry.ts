import type { CardDef, CreatureCard, ExpansionDef, TrainerCard } from './types';
import { EXPANSIONS } from './expansions';
import { GENESIS } from './sets/genesis';
import { WILDFRONT } from './sets/wildfront';
import { CELESTIAL } from './sets/celestial';

/**
 * Card registry. To add an expansion: create src/cards/sets/<name>.ts exporting CardDef[],
 * add its ExpansionDef in expansions.ts and append it to SET_LISTS below. Nothing else changes.
 */
const SET_LISTS: CardDef[][] = [GENESIS, WILDFRONT, CELESTIAL];

const byId = new Map<string, CardDef>();

function register(list: CardDef[]) {
  for (const raw of list) {
    if (byId.has(raw.id)) throw new Error(`Duplicate card id ${raw.id}`);
    byId.set(raw.id, raw);
  }
}
SET_LISTS.forEach(register);

// Resolve alternate-art variants: they inherit all gameplay fields from their base print.
for (const [id, card] of byId) {
  if (!card.variantOf) continue;
  const base = byId.get(card.variantOf);
  if (!base) throw new Error(`Variant ${id} references missing base ${card.variantOf}`);
  const { id: _i, number: _n, rarity: _r, art: _a, expansion: _e, variantOf: _v, flavor: _f, ...gameplay } = base;
  byId.set(id, { ...gameplay, ...card, flavor: card.flavor ?? base.flavor } as CardDef);
}

export const ALL_CARDS: CardDef[] = [...byId.values()].sort((a, b) =>
  a.expansion === b.expansion ? a.number - b.number : expansionOrder(a.expansion) - expansionOrder(b.expansion),
);

function expansionOrder(id: string) {
  return EXPANSIONS.find((e) => e.id === id)?.releaseOrder ?? 99;
}

export function getCard(id: string): CardDef {
  const c = byId.get(id);
  if (!c) throw new Error(`Unknown card ${id}`);
  return c;
}
export function hasCard(id: string) {
  return byId.has(id);
}
export function getCreature(id: string): CreatureCard {
  const c = getCard(id);
  if (c.category !== 'creature') throw new Error(`${id} is not a creature`);
  return c;
}
export function getTrainer(id: string): TrainerCard {
  const c = getCard(id);
  if (c.category !== 'trainer') throw new Error(`${id} is not a trainer`);
  return c;
}
export function cardsInExpansion(expansionId: string): CardDef[] {
  return ALL_CARDS.filter((c) => c.expansion === expansionId);
}
export function getExpansion(id: string): ExpansionDef {
  const e = EXPANSIONS.find((x) => x.id === id);
  if (!e) throw new Error(`Unknown expansion ${id}`);
  return e;
}
/** Name used for the per-deck copy limit (alt-arts share their base name). */
export function copyKey(card: CardDef) {
  return card.name;
}
export { EXPANSIONS };
