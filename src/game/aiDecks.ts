import type { Difficulty } from '../ai';
import type { DeckList } from '../engine';
import { STARTER_DECKS } from './starterDecks';

export interface AiOpponent { name: string; title: string; avatar: string; deck: DeckList }

const d = (ids: Record<string, number>, essence: DeckList['essence']): DeckList => ({
  cards: Object.entries(ids).flatMap(([id, n]) => Array(n).fill(id)),
  essence,
});

/** Curated decks for AI opponents. Stronger tiers field Primes and complete evolution lines. */
export const AI_DECKS = {
  volcanic: d({ 'GEN-004': 2, 'GEN-005': 2, 'GEN-061': 1, 'WLD-011': 2, 'WLD-012': 1, 'WLD-060': 1, 'WLD-022': 1, 'GEN-071': 2, 'GEN-072': 2, 'GEN-081': 2, 'GEN-082': 1, 'GEN-091': 1, 'WLD-095': 1, 'WLD-072': 1 }, ['blaze', 'brawl']),
  frost: d({ 'CEL-001': 2, 'CEL-002': 2, 'CEL-003': 1, 'CEL-004': 2, 'CEL-005': 1, 'CEL-062': 1, 'CEL-063': 1, 'CEL-071': 1, 'GEN-072': 2, 'WLD-072': 1, 'CEL-081': 1, 'GEN-081': 2, 'CEL-095': 1, 'GEN-074': 1, 'CEL-090': 1 }, ['psyche', 'tide']),
  jungle: d({ 'WLD-001': 2, 'WLD-002': 2, 'WLD-003': 1, 'WLD-017': 2, 'WLD-018': 1, 'WLD-019': 1, 'WLD-020': 2, 'WLD-021': 1, 'WLD-061': 1, 'WLD-071': 1, 'GEN-072': 2, 'WLD-081': 1, 'GEN-081': 1, 'WLD-096': 1, 'WLD-072': 1 }, ['verdant', 'shade']),
  legion: d({ 'CEL-016': 2, 'CEL-017': 2, 'CEL-018': 1, 'CEL-014': 2, 'CEL-015': 1, 'CEL-060': 1, 'GEN-018': 2, 'GEN-021': 1, 'GEN-071': 1, 'GEN-072': 2, 'WLD-072': 1, 'GEN-081': 2, 'CEL-091': 1, 'GEN-073': 1 }, ['alloy', 'brawl', 'shade']),
};

const S = STARTER_DECKS;
export const AI_OPPONENTS: Record<Difficulty, AiOpponent[]> = {
  beginner: [
    { name: 'Pip', title: 'Parlor Rookie', avatar: 'nibblpig', deck: S[0].list },
    { name: 'Mo', title: 'Cone Carrier', avatar: 'nekocean', deck: S[1].list },
  ],
  easy: [
    { name: 'Lulu', title: 'Sprinkle Scout', avatar: 'chuchilli', deck: S[1].list },
    { name: 'Benny', title: 'Jungle Barista', avatar: 'cupagato', deck: AI_DECKS.jungle },
  ],
  normal: [
    { name: 'Rosa', title: 'Gelato Ranger', avatar: 'axofuegl', deck: AI_DECKS.volcanic },
    { name: 'Dax', title: 'Brew Master', avatar: 'mochattoa', deck: AI_DECKS.jungle },
    { name: 'Cadet Lima', title: 'Crystal Legion', avatar: 'rokadet', deck: AI_DECKS.legion },
  ],
  expert: [
    { name: 'Maestra Helada', title: 'Region Champion', avatar: 'predtempest', deck: AI_DECKS.frost },
    { name: 'El Sorbete', title: 'Masked Elite', avatar: 'antonarch', deck: AI_DECKS.volcanic },
    { name: 'General Granita', title: 'Legion Commander', avatar: 'colonelcorps', deck: AI_DECKS.legion },
  ],
};

export function aiOpponentsFor(dif: Difficulty): AiOpponent[] {
  return AI_OPPONENTS[dif];
}
