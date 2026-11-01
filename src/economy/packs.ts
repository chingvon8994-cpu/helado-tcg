import { cardsInExpansion, getExpansion } from '../cards/registry';
import type { CardDef, Rarity } from '../cards/types';

/**
 * Pack probabilities. Each slot is a weighted rarity table; weights for rarities that don't exist
 * in an expansion are dropped and the rest renormalised. Edit freely — nothing else hardcodes odds.
 */
export interface PackConfig {
  slots: Partial<Record<Rarity, number>>[];
}

const COMMON_SLOT = { common: 100 };
export const DEFAULT_PACK: PackConfig = {
  slots: [
    COMMON_SLOT,
    COMMON_SLOT,
    COMMON_SLOT,
    { common: 30, uncommon: 62, rare: 8 },
    { uncommon: 52, rare: 30, double_rare: 10, illustration_rare: 5.5, ultra_rare: 2, secret_rare: 0.5 },
  ],
};

export const PACK_CONFIGS: Record<string, PackConfig> = {
  genesis: DEFAULT_PACK,
  wildfront: DEFAULT_PACK,
  celestial: {
    slots: [
      COMMON_SLOT,
      COMMON_SLOT,
      { common: 70, uncommon: 30 },
      { common: 20, uncommon: 65, rare: 15 },
      { uncommon: 45, rare: 32, double_rare: 13, illustration_rare: 6.5, ultra_rare: 2.8, secret_rare: 0.7 },
    ],
  },
};

export type RandomInt = (maxExclusive: number) => number;

/** Effective slot odds for an expansion (rarities it lacks are removed). */
export function slotOdds(expansionId: string): { rarity: Rarity; pct: number }[][] {
  const pool = cardsInExpansion(expansionId);
  const present = new Set(pool.map((c) => c.rarity));
  const cfg = PACK_CONFIGS[expansionId] ?? DEFAULT_PACK;
  return cfg.slots.map((slot) => {
    const entries = (Object.entries(slot) as [Rarity, number][]).filter(([r, w]) => present.has(r) && w > 0);
    const total = entries.reduce((n, [, w]) => n + w, 0);
    return entries.map(([rarity, w]) => ({ rarity, pct: (w / total) * 100 }));
  });
}

/**
 * Rolls one pack. `randInt` must be a secure RNG on the server (crypto.randomInt).
 * Cards always come from the real card database for that expansion.
 */
export function rollPack(expansionId: string, randInt: RandomInt): CardDef[] {
  getExpansion(expansionId); // throws for unknown expansions
  const pool = cardsInExpansion(expansionId);
  const byRarity = new Map<Rarity, CardDef[]>();
  for (const c of pool) byRarity.set(c.rarity, [...(byRarity.get(c.rarity) ?? []), c]);
  const odds = slotOdds(expansionId);
  return odds.map((slot) => {
    // Weighted pick using integer arithmetic on basis points for exactness.
    const scaled = slot.map((s) => ({ r: s.rarity, w: Math.round(s.pct * 100) }));
    const total = scaled.reduce((n, s) => n + s.w, 0);
    let roll = randInt(total);
    let rarity = scaled[scaled.length - 1].r;
    for (const s of scaled) {
      if (roll < s.w) { rarity = s.r; break; }
      roll -= s.w;
    }
    const cards = byRarity.get(rarity)!;
    return cards[randInt(cards.length)];
  });
}
