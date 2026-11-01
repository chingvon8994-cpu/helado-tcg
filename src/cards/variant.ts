import type { ArtRef, CardDef, Rarity } from './types';

/** Declares an alternate-art print. Gameplay fields are inherited from `variantOf` by the registry. */
export function variant(v: { id: string; name: string; variantOf: string; expansion: string; number: number; rarity: Rarity; art: ArtRef; flavor?: string }): CardDef {
  return v as unknown as CardDef;
}
