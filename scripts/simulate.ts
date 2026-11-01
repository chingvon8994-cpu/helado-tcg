/**
 * AI strength matrix: `npm run sim -- 20` plays N matches per pairing (seats/decks alternated).
 */
import { createMatch, type GameState } from '../src/engine';
import { runAi } from '../src/game/runner';
import type { Difficulty } from '../src/ai';
import { STARTER_DECKS } from '../src/game/starterDecks';
import { AI_DECKS } from '../src/game/aiDecks';

const N = Number(process.argv[2] ?? 10);
const levels: Difficulty[] = ['beginner', 'easy', 'normal', 'expert'];
const decks = [...STARTER_DECKS.map((d) => d.list), ...Object.values(AI_DECKS)];

function play(a: Difficulty, b: Difficulty, seed: number, da: number, db: number): GameState {
  let s = createMatch([decks[da], decks[db]], { seed });
  for (let g = 0; g < 400 && s.phase !== 'over'; g++) {
    s = runAi(s, 0, a, seed * 31 + g).state;
    s = runAi(s, 1, b, seed * 17 + g).state;
  }
  return s;
}

for (let i = 0; i < levels.length; i++) {
  for (let j = i + 1; j < levels.length; j++) {
    let w = 0, l = 0, turns = 0;
    for (let seed = 1; seed <= N; seed++) {
      const da = seed % decks.length, db = (seed + 1) % decks.length;
      const swap = seed % 2 === 0;
      const s = swap ? play(levels[j], levels[i], seed, db, da) : play(levels[i], levels[j], seed, da, db);
      turns += s.turn;
      const hi = swap ? 0 : 1;
      if (s.winner === hi) w++; else if (s.winner !== 'draw') l++;
    }
    console.log(`${levels[j].padEnd(8)} vs ${levels[i].padEnd(8)}: ${w}W ${l}L ${N - w - l}D  avg turns ${(turns / N).toFixed(1)}`);
  }
}
