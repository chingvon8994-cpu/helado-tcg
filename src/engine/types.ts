import type { Element, EssenceElement, Status } from '../cards/types';
import type { RuleConfig } from './rules';

export type PlayerIndex = 0 | 1;

export interface CardInstance {
  uid: string;
  cardId: string;
}

export interface TimedEffect {
  kind: 'preventDamage' | 'reduceIncoming' | 'weaken' | 'cantRetreat' | 'cantAttack';
  amount: number; // Infinity is encoded as 9999
  /** Effect is removed during the checkup that ends this global turn. */
  untilTurn: number;
}

export interface InPlayCreature {
  uid: string; // uid of the top card
  cardId: string; // top card id
  stack: CardInstance[]; // evolution stack, bottom (basic) first, top last
  damage: number;
  energy: Element[];
  tool: CardInstance | null;
  status: Status[];
  playedTurn: number; // turn the basic was put into play
  evolvedTurn: number; // turn of last evolution (-1 if never)
  abilityUsedTurn: number;
  effects: TimedEffect[];
}

export interface TurnBuff {
  player: PlayerIndex;
  kind: 'damageBoost' | 'retreatReduction';
  amount: number;
  element?: Element;
  turn: number;
}

export interface PlayerState {
  deck: CardInstance[];
  hand: CardInstance[];
  discard: CardInstance[];
  /** Essence that was discarded (from retreats, effects and knockouts). */
  essenceDiscard: Element[];
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
  /** Opponent's hand was revealed to this player at this turn (Peek effects). */
  revealedOpponentHandTurn: number;
}

export type Pending = { player: PlayerIndex; kind: 'promote' };

export type WinReason = 'points' | 'noCreatures' | 'concede' | 'turnLimit' | 'timeout';

export interface GameEvent {
  t:
    | 'turnStart' | 'draw' | 'essence' | 'playBasic' | 'evolve' | 'attach' | 'trainer' | 'ability' | 'retreat' | 'switch'
    | 'attack' | 'damage' | 'heal' | 'status' | 'statusClear' | 'coin' | 'ko' | 'points' | 'promote' | 'checkup'
    | 'discardEnergy' | 'search' | 'gameOver' | 'info' | 'setup';
  player?: PlayerIndex;
  uid?: string;
  cardId?: string;
  amount?: number;
  text?: string;
  coins?: boolean[];
  weakness?: boolean;
  status?: Status;
}

export interface GameState {
  id: string;
  rules: RuleConfig;
  turn: number; // 0 during setup, then 1,2,3...
  current: PlayerIndex; // whose turn it is
  firstPlayer: PlayerIndex;
  phase: 'setup' | 'main' | 'over';
  pending: Pending[];
  players: [PlayerState, PlayerState];
  terrain: { card: CardInstance; owner: PlayerIndex } | null;
  buffs: TurnBuff[];
  rng: number;
  nextUid: number;
  winner: PlayerIndex | 'draw' | null;
  winReason: WinReason | null;
  /** What to do once all pending promotions are resolved. */
  resume: 'endTurn' | 'startNext' | null;
  /** If this creature is knocked out by the current attack, its KO is worth +1 point. */
  bonusPointUid: string | null;
  /** Knockouts scored by each player (for missions/stats). */
  kos: [number, number];
  /** Monotonic counter, used by the server for optimistic concurrency. */
  version: number;
  log: GameEvent[];
}

export type Action =
  | { type: 'setupActive'; handUid: string }
  | { type: 'setupBench'; handUid: string }
  | { type: 'setupDone' }
  | { type: 'playBasic'; handUid: string }
  | { type: 'evolve'; handUid: string; targetUid: string }
  | { type: 'attachEssence'; targetUid: string }
  | { type: 'playTrainer'; handUid: string; targetUid?: string }
  | { type: 'useAbility'; creatureUid: string; targetUid?: string }
  | { type: 'retreat'; benchUid: string }
  | { type: 'attack'; index: number; targetUid?: string }
  | { type: 'endTurn' }
  | { type: 'promote'; benchUid: string }
  | { type: 'concede' };

export type ActionResult = { ok: true; state: GameState; events: GameEvent[] } | { ok: false; error: string };
