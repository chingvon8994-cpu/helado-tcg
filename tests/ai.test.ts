import { describe, expect, it } from 'vitest';
import { chooseAction, type Difficulty } from '../src/ai';
import { createMatch, getPlayerView, legalActions, sameAction, type GameState } from '../src/engine';
import { runAi } from '../src/game/runner';
import { TEST_DECK_A, TEST_DECK_B } from './util';

export function playMatch(a: Difficulty, b: Difficulty, seed: number, decks = [TEST_DECK_A, TEST_DECK_B] as const): GameState {
  let s = createMatch([decks[0], decks[1]], { seed });
  for (let guard = 0; guard < 400 && s.phase !== 'over'; guard++) {
    const before = s.version;
    s = runAi(s, 0, a, seed * 31 + guard).state;
    s = runAi(s, 1, b, seed * 17 + guard).state;
    if (s.version === before) throw new Error('match stalled');
  }
  return s;
}

describe('AI opponents', () => {
  for (const d of ['beginner', 'easy', 'normal', 'expert'] as Difficulty[]) {
    it(`${d} AI completes full matches using only legal actions`, () => {
      for (let seed = 1; seed <= 3; seed++) {
        const s = playMatch(d, d, seed);
        expect(s.phase).toBe('over');
        expect(['points', 'noCreatures', 'turnLimit']).toContain(s.winReason);
      }
    });
  }

  it('only picks actions that are legal in the real state', () => {
    let s = createMatch([TEST_DECK_A, TEST_DECK_B], { seed: 99 });
    for (let i = 0; i < 120 && s.phase !== 'over'; i++) {
      const p = s.phase === 'setup' ? (s.players[0].setupDone ? 1 : 0) : s.pending.length ? s.pending[0].player : s.current;
      const a = chooseAction(getPlayerView(s, p), 'expert', i);
      expect(legalActions(s, p).some((x) => sameAction(x, a))).toBe(true);
      s = runAi(s, p, 'expert', i, 1).state;
    }
  });

  it('decisions do not depend on hidden information', () => {
    // Two states that differ only in the opponent's hidden hand and deck must yield the same AI choice.
    let s = createMatch([TEST_DECK_A, TEST_DECK_B], { seed: 5, firstPlayer: 0 });
    s = runAi(s, 0, 'easy', 1).state;
    s = runAi(s, 1, 'easy', 1).state;
    const t = structuredClone(s);
    t.players[1].hand = t.players[1].hand.map((c) => ({ ...c, cardId: 'GEN-060' }));
    t.players[1].deck.reverse();
    for (const d of ['normal', 'expert'] as Difficulty[]) {
      expect(chooseAction(getPlayerView(s, 0), d, 3)).toEqual(chooseAction(getPlayerView(t, 0), d, 3));
    }
  });

  it('stronger difficulties beat weaker ones more often than not', () => {
    const wins = (x: Difficulty, y: Difficulty, n: number) => {
      let w = 0;
      for (let seed = 1; seed <= n; seed++) {
        // Alternate seats and decks to remove first-player and deck bias.
        const swap = seed % 2 === 0;
        const s = swap ? playMatch(y, x, seed, [TEST_DECK_B, TEST_DECK_A]) : playMatch(x, y, seed);
        if (s.winner === (swap ? 1 : 0)) w++;
      }
      return w / n;
    };
    expect(wins('expert', 'beginner', 10)).toBeGreaterThan(0.6);
    expect(wins('normal', 'beginner', 10)).toBeGreaterThan(0.55);
  });
});
