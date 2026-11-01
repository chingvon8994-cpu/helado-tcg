import type { GameEvent, GameState } from '../engine';
import type { PlayerView } from '../engine/view';

/**
 * Persistence boundary for all trusted server logic. `SupabaseStore` implements it against
 * Postgres (via SECURITY DEFINER functions); `MemoryStore` implements identical semantics for tests.
 */
export interface ProfileRow { id: string; username: string; avatar: string; xp: number; bootstrapped: boolean }
export interface DeckRow { id: string; user_id: string; name: string; cards: string[]; essence: string[] }
export interface MatchRow {
  id: string;
  mode: 'online' | 'solo';
  status: 'active' | 'finished' | 'abandoned';
  player0: string;
  player1: string | null;
  ai_difficulty: string | null;
  state: GameState;
  version: number;
  turn_deadline: string | null;
  rewards_granted: boolean;
  created_at: string;
}
export interface RoomRow {
  id: string;
  code: string;
  host: string;
  guest: string | null;
  host_deck: string | null;
  guest_deck: string | null;
  host_ready: boolean;
  guest_ready: boolean;
  host_name: string;
  guest_name: string | null;
  status: 'open' | 'started' | 'closed';
  match_id: string | null;
  updated_at: string;
}
export interface ResultRow { match_id: string; user_id: string; mode: string; opponent_name: string; difficulty: string | null; result: 'win' | 'loss' | 'draw'; reason: string | null; turns: number; scoops: number; xp: number; created_at: string }

export class InsufficientFundsError extends Error {
  constructor() { super('Not enough Scoops.'); }
}

export interface Store {
  getProfile(userId: string): Promise<ProfileRow | null>;
  setUsername(userId: string, username: string): Promise<'ok' | 'taken'>;
  markBootstrapped(userId: string): Promise<boolean>; // true only for the first call
  getWallet(userId: string): Promise<number>;
  grantScoops(userId: string, amount: number, reason: string, ref: string): Promise<boolean>;
  addCards(userId: string, cardIds: string[], source: string, ref: string): Promise<void>;
  openPackTx(userId: string, expansionId: string, cost: number, cardIds: string[]): Promise<string>;
  getCollection(userId: string): Promise<Record<string, number>>;
  createDeck(userId: string, name: string, cards: string[], essence: string[]): Promise<string>;
  getDeck(deckId: string): Promise<DeckRow | null>;
  countLedger(userId: string, reason: string, sinceIso: string): Promise<number>;

  createMatch(row: Omit<MatchRow, 'id' | 'created_at' | 'rewards_granted'>): Promise<string>;
  getMatch(id: string): Promise<MatchRow | null>;
  updateMatch(id: string, expectedVersion: number, state: GameState, status: MatchRow['status'], deadline: string | null): Promise<boolean>;
  writeViews(matchId: string, rows: { userId: string; seat: 0 | 1; view: PlayerView; events: GameEvent[]; status: string; deadline?: string | null }[]): Promise<void>;
  getView(matchId: string, userId: string): Promise<{ view: PlayerView; events: GameEvent[] } | null>;
  activeMatchesFor(userId: string): Promise<MatchRow[]>;
  markRewardsGranted(matchId: string): Promise<boolean>;
  recordResult(r: Omit<ResultRow, 'created_at'> & { knockouts: number }): Promise<boolean>;
  countResults(userId: string, sinceIso: string, filter: { mode?: string; opponent?: string; minScoops?: number; result?: string }): Promise<number>;

  bumpMission(userId: string, missionId: string, period: string, amount: number): Promise<void>;
  claimMission(userId: string, missionId: string, period: string, target: number, reward: number): Promise<boolean>;
  getMissionProgress(userId: string, periods: string[]): Promise<{ mission_id: string; period_key: string; progress: number; claimed: boolean }[]>;
  unlockAchievement(userId: string, id: string, reward: number): Promise<boolean>;

  createRoom(row: Omit<RoomRow, 'id' | 'updated_at'>): Promise<RoomRow>;
  getRoom(id: string): Promise<RoomRow | null>;
  getRoomByCode(code: string): Promise<RoomRow | null>;
  /** Conditional update: applies only if `expectUpdatedAt` still matches (prevents join races). */
  updateRoom(id: string, patch: Partial<RoomRow>, expectUpdatedAt?: string): Promise<RoomRow | null>;
}
