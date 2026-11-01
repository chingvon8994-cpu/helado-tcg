import type { SupabaseClient } from '@supabase/supabase-js';
import type { GameEvent, GameState } from '../engine';
import type { PlayerView } from '../engine/view';
import { InsufficientFundsError, type DeckRow, type MatchRow, type ProfileRow, type ResultRow, type RoomRow, type Store } from './store';

/** Store backed by Supabase Postgres. Must be constructed with the SERVICE ROLE client (server only). */
export class SupabaseStore implements Store {
  constructor(private db: SupabaseClient) {}

  private async rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
    const { data, error } = await this.db.rpc(fn, args);
    if (error) throw new Error(error.message);
    return data as T;
  }
  private must<T>(r: { data: T; error: { message: string } | null }): T {
    if (r.error) throw new Error(r.error.message);
    return r.data;
  }

  async getProfile(userId: string) {
    return this.must(await this.db.from('profiles').select('id, username, avatar, xp, bootstrapped').eq('id', userId).maybeSingle()) as ProfileRow | null;
  }
  async setUsername(userId: string, username: string) {
    const { error } = await this.db.from('profiles').update({ username }).eq('id', userId);
    if (error) {
      if (error.code === '23505') return 'taken' as const;
      throw new Error(error.message);
    }
    return 'ok' as const;
  }
  async markBootstrapped(userId: string) {
    const data = this.must(await this.db.from('profiles').update({ bootstrapped: true }).eq('id', userId).eq('bootstrapped', false).select('id'));
    return (data ?? []).length > 0;
  }
  async getWallet(userId: string) {
    const d = this.must(await this.db.from('wallets').select('scoops').eq('user_id', userId).maybeSingle());
    return (d as { scoops: number } | null)?.scoops ?? 0;
  }
  grantScoops(userId: string, amount: number, reason: string, ref: string) {
    return this.rpc<boolean>('grant_scoops', { p_user: userId, p_amount: amount, p_reason: reason, p_ref: ref });
  }
  async addCards(userId: string, cardIds: string[], source: string, ref: string) {
    await this.rpc('add_cards', { p_user: userId, p_cards: cardIds, p_source: source, p_ref: ref });
  }
  async openPackTx(userId: string, expansionId: string, cost: number, cardIds: string[]) {
    try {
      return await this.rpc<string>('open_pack_tx', { p_user: userId, p_expansion: expansionId, p_cost: cost, p_cards: cardIds });
    } catch (e) {
      if (/INSUFFICIENT_SCOOPS/.test((e as Error).message)) throw new InsufficientFundsError();
      throw e;
    }
  }
  async getCollection(userId: string) {
    const rows = this.must(await this.db.from('collection').select('card_id, quantity').eq('user_id', userId)) as { card_id: string; quantity: number }[];
    return Object.fromEntries(rows.map((r) => [r.card_id, r.quantity]));
  }
  async createDeck(userId: string, name: string, cards: string[], essence: string[]) {
    const d = this.must(await this.db.from('decks').insert({ user_id: userId, name, cards, essence }).select('id').single()) as { id: string };
    return d.id;
  }
  async getDeck(id: string) {
    if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
    return this.must(await this.db.from('decks').select('id, user_id, name, cards, essence').eq('id', id).maybeSingle()) as DeckRow | null;
  }
  async countLedger(userId: string, reason: string, since: string) {
    const r = await this.db.from('scoop_ledger').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('reason', reason).gte('created_at', since);
    if (r.error) throw new Error(r.error.message);
    return r.count ?? 0;
  }
  async createMatch(row: Omit<MatchRow, 'id' | 'created_at' | 'rewards_granted'>) {
    const d = this.must(await this.db.from('matches').insert(row).select('id').single()) as { id: string };
    return d.id;
  }
  async getMatch(id: string) {
    if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
    return this.must(await this.db.from('matches').select('*').eq('id', id).maybeSingle()) as MatchRow | null;
  }
  updateMatch(id: string, expected: number, state: GameState, status: MatchRow['status'], deadline: string | null) {
    return this.rpc<boolean>('update_match_state', {
      p_match: id, p_expected: expected, p_state: state, p_version: state.version, p_status: status, p_deadline: deadline,
      p_winner: state.winner === null ? null : state.winner === 'draw' ? -1 : state.winner, p_reason: state.winReason,
    });
  }
  async writeViews(matchId: string, rows: { userId: string; seat: 0 | 1; view: PlayerView; events: GameEvent[]; status: string; deadline?: string | null }[]) {
    const payload = rows.map((r) => ({ match_id: matchId, user_id: r.userId, seat: r.seat, view: r.view, events: r.events, version: r.view.version, status: r.status, deadline: r.deadline ?? null, updated_at: new Date().toISOString() }));
    this.must(await this.db.from('match_views').upsert(payload, { onConflict: 'match_id,user_id' }));
  }
  async getView(matchId: string, userId: string) {
    const d = this.must(await this.db.from('match_views').select('view, events').eq('match_id', matchId).eq('user_id', userId).maybeSingle());
    return d as { view: PlayerView; events: GameEvent[] } | null;
  }
  async activeMatchesFor(userId: string) {
    return this.must(await this.db.from('matches').select('*').eq('status', 'active').or(`player0.eq.${userId},player1.eq.${userId}`).order('updated_at', { ascending: false }).limit(10)) as MatchRow[];
  }
  markRewardsGranted(matchId: string) {
    return this.rpc<boolean>('mark_rewards_granted', { p_match: matchId });
  }
  recordResult(r: Omit<ResultRow, 'created_at'> & { knockouts: number }) {
    return this.rpc<boolean>('record_match_result', {
      p_match: r.match_id, p_user: r.user_id, p_mode: r.mode, p_opponent: r.opponent_name, p_difficulty: r.difficulty, p_result: r.result,
      p_reason: r.reason, p_turns: r.turns, p_scoops: r.scoops, p_xp: r.xp, p_knockouts: r.knockouts,
    });
  }
  async countResults(userId: string, since: string, f: { mode?: string; opponent?: string; minScoops?: number; result?: string }) {
    let q = this.db.from('match_results').select('id', { count: 'exact', head: true }).eq('user_id', userId).gte('created_at', since);
    if (f.mode) q = q.eq('mode', f.mode);
    if (f.opponent) q = q.eq('opponent_name', f.opponent);
    if (f.minScoops !== undefined) q = q.gte('scoops', f.minScoops);
    if (f.result) q = q.eq('result', f.result);
    const r = await q;
    if (r.error) throw new Error(r.error.message);
    return r.count ?? 0;
  }
  async bumpMission(userId: string, missionId: string, period: string, amount: number) {
    await this.rpc('bump_mission', { p_user: userId, p_mission: missionId, p_period: period, p_amount: amount });
  }
  claimMission(userId: string, missionId: string, period: string, target: number, reward: number) {
    return this.rpc<boolean>('claim_mission', { p_user: userId, p_mission: missionId, p_period: period, p_target: target, p_reward: reward });
  }
  async getMissionProgress(userId: string, periods: string[]) {
    return this.must(await this.db.from('mission_progress').select('mission_id, period_key, progress, claimed').eq('user_id', userId).in('period_key', periods)) as { mission_id: string; period_key: string; progress: number; claimed: boolean }[];
  }
  unlockAchievement(userId: string, id: string, reward: number) {
    return this.rpc<boolean>('unlock_achievement', { p_user: userId, p_achievement: id, p_reward: reward });
  }
  async createRoom(row: Omit<RoomRow, 'id' | 'updated_at'>) {
    return this.must(await this.db.from('rooms').insert(row).select('*').single()) as RoomRow;
  }
  async getRoom(id: string) {
    if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
    return this.must(await this.db.from('rooms').select('*').eq('id', id).maybeSingle()) as RoomRow | null;
  }
  async getRoomByCode(code: string) {
    return this.must(await this.db.from('rooms').select('*').eq('code', code).neq('status', 'closed').maybeSingle()) as RoomRow | null;
  }
  async updateRoom(id: string, patch: Partial<RoomRow>, expectUpdatedAt?: string) {
    let q = this.db.from('rooms').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
    if (expectUpdatedAt) q = q.eq('updated_at', expectUpdatedAt);
    const rows = this.must(await q.select('*')) as RoomRow[];
    return rows[0] ?? null;
  }
}
