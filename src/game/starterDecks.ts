import type { DeckList } from '../engine';

export interface StarterDeck {
  id: string;
  name: string;
  description: string;
  list: DeckList;
}

const d = (ids: Record<string, number>, essence: DeckList['essence']): DeckList => ({
  cards: Object.entries(ids).flatMap(([id, n]) => Array(n).fill(id)),
  essence,
});

/** Starter decks — granted to new accounts and used by AI opponents. Built from the test collection. */
export const STARTER_DECKS: StarterDeck[] = [
  {
    id: 'starter-orchard', name: 'Orchard & Ember', description: 'Verdant and Blaze lines with steady healing.',
    list: d({ 'GEN-001': 2, 'GEN-002': 2, 'GEN-004': 2, 'GEN-005': 2, 'GEN-010': 2, 'GEN-060': 1, 'GEN-071': 2, 'GEN-072': 2, 'GEN-073': 1, 'GEN-081': 2, 'GEN-090': 1, 'GEN-095': 1 }, ['verdant', 'blaze']),
  },
  {
    id: 'starter-tidal', name: 'Tidal Static', description: 'Tide, Volt and Shade disruption.',
    list: d({ 'GEN-007': 2, 'GEN-019': 2, 'GEN-012': 2, 'GEN-010': 2, 'GEN-001': 2, 'GEN-002': 2, 'GEN-071': 2, 'GEN-072': 2, 'GEN-073': 1, 'GEN-082': 2, 'GEN-090': 1 }, ['tide', 'volt', 'shade']),
  },
];
