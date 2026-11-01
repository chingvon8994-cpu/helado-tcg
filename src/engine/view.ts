import type { EssenceElement } from '../cards/types';
import { HIDDEN_CARD, other } from './helpers';
import { Rng } from './rng';
import type { RuleConfig } from './rules';
import type { CardInstance, GameEvent, GameState, InPlayCreature, Pending, PlayerIndex, TurnBuff } from './types';

/**
 * What one player is allowed to know. Sent to clients and given to AI opponents —
 * the AI never receives the full GameState, so it cannot cheat.
 */
export interface PlayerSideView {
  hand: CardInstance[] | null; // null when hidden
  handCount: number;
  deckCount: number;
  /** Own remaining deck contents as an unordered multiset (you know your own decklist). */
  deckContents: string[] | null;
  discard: CardInstance[];
  essenceDiscard: string[];
  active: InPlayCreature | null;
  bench: InPlayCreature[];
  points: number;
  essenceTypes: EssenceElement[];
  essenceCurrent: EssenceElement | null;
  essenceNext: EssenceElement;
  attachedThisTurn: boolean;
  supporterThisTurn: boolean;
  retreatedThisTurn: boolean;
  setupDone: boolean;
}

export interface PlayerView {
  matchId: string;
  me: PlayerIndex;
  rules: RuleConfig;
  turn: number;
  current: PlayerIndex;
  firstPlayer: PlayerIndex;
  phase: GameState['phase'];
  pending: Pending[];
  terrain: GameState['terrain'];
  buffs: TurnBuff[];
  winner: GameState['winner'];
  winReason: GameState['winReason'];
  version: number;
  kos: [number, number];
  you: PlayerSideView;
  opponent: PlayerSideView;
  log: GameEvent[];
}

export function getPlayerView(s: GameState, me: PlayerIndex): PlayerView {
  const side = (p: PlayerIndex, mine: boolean): PlayerSideView => {
    const ps = s.players[p];
    const revealed = !mine && s.players[me].revealedOpponentHandTurn === s.turn;
    // During setup the opponent's choices stay hidden until both players are done.
    const hideField = !mine && s.phase === 'setup';
    return {
      hand: mine || revealed ? structuredClone(ps.hand) : null,
      handCount: ps.hand.length + (hideField ? (ps.active ? 1 : 0) + ps.bench.length : 0),
      deckCount: ps.deck.length,
      deckContents: mine ? ps.deck.map((c) => c.cardId).sort() : null,
      discard: structuredClone(ps.discard),
      essenceDiscard: [...ps.essenceDiscard],
      active: hideField ? null : structuredClone(ps.active),
      bench: hideField ? [] : structuredClone(ps.bench),
      points: ps.points,
      essenceTypes: [...ps.essenceTypes],
      essenceCurrent: ps.essenceCurrent,
      essenceNext: ps.essenceNext,
      attachedThisTurn: ps.attachedThisTurn,
      supporterThisTurn: ps.supporterThisTurn,
      retreatedThisTurn: ps.retreatedThisTurn,
      setupDone: ps.setupDone,
    };
  };
  return {
    matchId: s.id, me, rules: s.rules, turn: s.turn, current: s.current, firstPlayer: s.firstPlayer, phase: s.phase,
    pending: [...s.pending], terrain: structuredClone(s.terrain), buffs: [...s.buffs], winner: s.winner, winReason: s.winReason,
    version: s.version, kos: [...s.kos] as [number, number], you: side(me, true), opponent: side(other(me), false), log: s.log.slice(-40).map(redactEvent(me)),
  };
}

/** Events are public, except card identities that the viewer should not learn. */
const redactEvent = (_me: PlayerIndex) => (e: GameEvent): GameEvent => e;

/**
 * Builds a plausible full GameState from a PlayerView, for AI look-ahead.
 * Hidden zones are filled with placeholder cards and our own deck order is re-randomised,
 * so simulations only ever use information the AI legitimately has.
 */
export function determinize(v: PlayerView, seed: number): GameState {
  const rng = new Rng(seed);
  let uid = 1_000_000;
  const hidden = (n: number): CardInstance[] => Array.from({ length: n }, () => ({ uid: `h${uid++}`, cardId: HIDDEN_CARD }));
  const me = v.me;
  const build = (sv: PlayerSideView, mine: boolean) => ({
    deck: mine ? rng.shuffle((sv.deckContents ?? []).map((cardId) => ({ uid: `d${uid++}`, cardId }))) : hidden(sv.deckCount),
    hand: sv.hand ? structuredClone(sv.hand) : hidden(sv.handCount),
    discard: structuredClone(sv.discard),
    essenceDiscard: [...sv.essenceDiscard] as never[],
    active: structuredClone(sv.active),
    bench: structuredClone(sv.bench),
    points: sv.points,
    essenceTypes: [...sv.essenceTypes],
    essenceCurrent: sv.essenceCurrent,
    essenceNext: sv.essenceNext,
    attachedThisTurn: sv.attachedThisTurn,
    supporterThisTurn: sv.supporterThisTurn,
    retreatedThisTurn: sv.retreatedThisTurn,
    setupDone: sv.setupDone,
    revealedOpponentHandTurn: -1,
  });
  const players = me === 0 ? [build(v.you, true), build(v.opponent, false)] : [build(v.opponent, false), build(v.you, true)];
  return {
    id: v.matchId, rules: v.rules, turn: v.turn, current: v.current, firstPlayer: v.firstPlayer, phase: v.phase,
    pending: [...v.pending], players: players as unknown as GameState['players'], terrain: structuredClone(v.terrain), buffs: [...v.buffs],
    rng: rng.seed, nextUid: 2_000_000, winner: v.winner, winReason: v.winReason, version: v.version, log: [],
    resume: null, bonusPointUid: null, kos: [0, 0],
  };
}
