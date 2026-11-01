import { randomUUID } from 'node:crypto';
import type { GameEvent, GameState } from '../engine';
import type { PlayerView } from '../engine/view';
import {
  InsufficientFundsError, type DeckRow, type MatchRow, type ProfileRow, type ResultRow, type RoomRow, type Store,
} from './store';

/** In-memory Store with the same semantics as the SQL functions. Used by tests and offline tooling. */
export class MemoryStore implements Store {
  profiles = new Map<string, ProfileRow>();
  wallets = new Map<string, number>();
  ledger: { user: string; amount: number; reason: string; ref: string; at: string }[] = [];
  collection = new Map<string, Map<string, number>>();
  decks = new Map<string, DeckRow>();
  matches = new Map<string, MatchRow>();
  views = new Map<string, { view: PlayerView; events: GameEvent[] }>();
  results: ResultRow[] = [];
  missions = new Map<string, { progress: number; claimed: boolean }>();
  achievements = new Set<string>();
  rooms = new Map<string, RoomRow>();
  packs: { id: string; user_id: string; expansion_id: string; cards: string[]; created_at: string }[] = [];
  acquisitions: { user_id: string; card_id: string; source: string; created_at: string }[] = [];
  clock = () => new Date();
  private tick = 0;

  addUser(id: string, username: string) {
    this.profiles.set(id, { id, username, avatar: 'axolitl', xp: 0, bootstrapped: false });
    this.wallets.set(id, 0);
  }
  private now() {
    return new Date(this.clock().getTime() + this.tick++).toISOString();
  }

  async getProfile(userId: string) { return this.profiles.get(userId) ?? null; }
  async setUsername(userId: string, username: string) {
    for (const p of this.profiles.values()) if (p.id !== userId && p.username.toLowerCase() === username.toLowerCase()) return 'taken' as const;
    this.profiles.get(userId)!.username = username;
    return 'ok' as const;
  }
  async markBootstrapped(userId: string) {
    const p = this.profiles.get(userId)!;
    if (p.bootstrapped) return false;
    p.bootstrapped = true;
    return true;
  }
  async getWallet(userId: string) { return this.wallets.get(userId) ?? 0; }
  async grantScoops(userId: string, amount: number, reason: string, ref: string) {
    if (this.ledger.some((l) => l.user === userId && l.reason === reason && l.ref === ref)) return false;
    this.ledger.push({ user: userId, amount, reason, ref, at: this.now() });
    this.wallets.set(userId, (this.wallets.get(userId) ?? 0) + amount);
    return true;
  }
  async addCards(userId: string, cardIds: string[], source = 'reward') {
    const m = this.collection.get(userId) ?? new Map<string, number>();
    for (const c of cardIds) {
      m.set(c, (m.get(c) ?? 0) + 1);
      this.acquisitions.push({ user_id: userId, card_id: c, source, created_at: this.now() });
    }
    this.collection.set(userId, m);
  }
  async openPackTx(userId: string, _exp: string, cost: number, cardIds: string[]) {
    const bal = this.wallets.get(userId) ?? 0;
    if (bal < cost) throw new InsufficientFundsError();
    const id = randomUUID();
    this.wallets.set(userId, bal - cost);
    this.ledger.push({ user: userId, amount: -cost, reason: 'pack', ref: id, at: this.now() });
    this.packs.push({ id, user_id: userId, expansion_id: _exp, cards: cardIds, created_at: this.now() });
    await this.addCards(userId, cardIds, 'pack');
    return id;
  }
  async getCollection(userId: string) { return Object.fromEntries(this.collection.get(userId) ?? []); }
  async createDeck(userId: string, name: string, cards: string[], essence: string[]) {
    const id = randomUUID();
    this.decks.set(id, { id, user_id: userId, name, cards, essence });
    return id;
  }
  async getDeck(id: string) { return this.decks.get(id) ?? null; }
  async countLedger(userId: string, reason: string, since: string) {
    return this.ledger.filter((l) => l.user === userId && l.reason === reason && l.at >= since).length;
  }
  async createMatch(row: Omit<MatchRow, 'id' | 'created_at' | 'rewards_granted'>) {
    const id = randomUUID();
    this.matches.set(id, { ...structuredClone(row), id, created_at: this.now(), rewards_granted: false });
    return id;
  }
  async getMatch(id: string) { const m = this.matches.get(id); return m ? structuredClone(m) : null; }
  async updateMatch(id: string, expected: number, state: GameState, status: MatchRow['status'], deadline: string | null) {
    const m = this.matches.get(id);
    if (!m || m.version !== expected) return false;
    Object.assign(m, { state: structuredClone(state), version: state.version, status, turn_deadline: deadline });
    return true;
  }
  async writeViews(matchId: string, rows: { userId: string; view: PlayerView; events: GameEvent[] }[]) {
    for (const r of rows) this.views.set(`${matchId}:${r.userId}`, structuredClone({ view: r.view, events: r.events }));
  }
  async getView(matchId: string, userId: string) { return this.views.get(`${matchId}:${userId}`) ?? null; }
  async activeMatchesFor(userId: string) {
    return [...this.matches.values()].filter((m) => m.status === 'active' && (m.player0 === userId || m.player1 === userId));
  }
  async markRewardsGranted(id: string) {
    const m = this.matches.get(id)!;
    if (m.rewards_granted || m.status === 'active') return false;
    m.rewards_granted = true;
    return true;
  }
  async recordResult(r: Omit<ResultRow, 'created_at'> & { knockouts: number }) {
    if (this.results.some((x) => x.match_id === r.match_id && x.user_id === r.user_id)) return false;
    const { knockouts: _k, ...row } = r;
    this.results.push({ ...row, created_at: this.now() });
    const p = this.profiles.get(r.user_id)!;
    p.xp += r.xp;
    if (r.scoops > 0) await this.grantScoops(r.user_id, r.scoops, 'match', r.match_id);
    return true;
  }
  async countResults(userId: string, since: string, f: { mode?: string; opponent?: string; minScoops?: number; result?: string }) {
    return this.results.filter((r) => r.user_id === userId && r.created_at >= since && (!f.mode || r.mode === f.mode)
      && (!f.opponent || r.opponent_name === f.opponent) && (f.minScoops === undefined || r.scoops >= f.minScoops)
      && (!f.result || r.result === f.result)).length;
  }
  async bumpMission(u: string, m: string, p: string, amount: number) {
    const k = `${u}:${m}:${p}`;
    const cur = this.missions.get(k) ?? { progress: 0, claimed: false };
    cur.progress += amount;
    this.missions.set(k, cur);
  }
  async claimMission(u: string, m: string, p: string, target: number, reward: number) {
    const cur = this.missions.get(`${u}:${m}:${p}`);
    if (!cur || cur.claimed || cur.progress < target) return false;
    cur.claimed = true;
    await this.grantScoops(u, reward, 'mission', `${m}:${p}`);
    return true;
  }
  async getMissionProgress(u: string, periods: string[]) {
    return [...this.missions.entries()]
      .map(([k, v]) => { const [user, mission_id, period_key] = k.split(':'); return { user, mission_id, period_key, ...v }; })
      .filter((x) => x.user === u && periods.includes(x.period_key))
      .map(({ user: _u, ...rest }) => rest);
  }
  async unlockAchievement(u: string, id: string, reward: number) {
    const k = `${u}:${id}`;
    if (this.achievements.has(k)) return false;
    this.achievements.add(k);
    if (reward > 0) await this.grantScoops(u, reward, 'achievement', id);
    return true;
  }
  async createRoom(row: Omit<RoomRow, 'id' | 'updated_at'>) {
    if ([...this.rooms.values()].some((r) => r.code === row.code)) throw new Error('duplicate code');
    const r: RoomRow = { ...row, id: randomUUID(), updated_at: this.now() };
    this.rooms.set(r.id, r);
    return { ...r };
  }
  async getRoom(id: string) { const r = this.rooms.get(id); return r ? { ...r } : null; }
  async getRoomByCode(code: string) { const r = [...this.rooms.values()].find((x) => x.code === code); return r ? { ...r } : null; }
  async updateRoom(id: string, patch: Partial<RoomRow>, expect?: string) {
    const r = this.rooms.get(id);
    if (!r || (expect && r.updated_at !== expect)) return null;
    Object.assign(r, patch, { updated_at: this.now() });
    return { ...r };
  }
}
