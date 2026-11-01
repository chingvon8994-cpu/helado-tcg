import { chooseAction, aiShouldAct, type Difficulty } from '../ai';
import { applyAction, getPlayerView, type Action, type GameEvent, type GameState, type PlayerIndex } from '../engine';

/** Plays AI moves for `aiPlayer` until it is a human's move or the game ends. */
export function runAi(state: GameState, aiPlayer: PlayerIndex, difficulty: Difficulty, seed: number, maxSteps = 200) {
  let s = state;
  const actions: Action[] = [];
  const events: GameEvent[] = [];
  for (let i = 0; i < maxSteps; i++) {
    const view = getPlayerView(s, aiPlayer);
    if (!aiShouldAct(view)) break;
    const a = chooseAction(view, difficulty, seed + i * 7919);
    const r = applyAction(s, aiPlayer, a);
    if (!r.ok) {
      // Should never happen: AI only picks from legal actions. Fall back to ending the turn safely.
      const fb = applyAction(s, aiPlayer, { type: 'endTurn' });
      if (!fb.ok) break;
      s = fb.state;
      events.push(...fb.events);
      continue;
    }
    actions.push(a);
    events.push(...r.events);
    s = r.state;
  }
  return { state: s, actions, events };
}
