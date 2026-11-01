import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { aiShouldAct, chooseAction, type Difficulty } from '../ai';
import {
  applyAction, createMatch, determinize, getPlayerView, legalActions, type Action, type DeckList, type GameEvent, type GameState, type PlayerView,
} from '../engine';
import { api, ApiError } from '../lib/api';
import { supabase } from '../lib/supabase';

export interface MatchMeta {
  mode: 'practice' | 'solo' | 'online';
  opponentName: string;
  opponentAvatar?: string;
  opponentTitle?: string;
  difficulty?: string | null;
  deadline?: string | null;
  status: 'active' | 'finished' | 'abandoned';
}

/** Everything the battle UI needs, independent of where the authoritative state lives. */
export interface BattleController {
  view: PlayerView | null;
  legal: Action[];
  meta: MatchMeta;
  events: { id: number; list: GameEvent[] };
  busy: boolean;
  error: string | null;
  send: (a: Action) => Promise<boolean>;
  forfeit: () => Promise<void>;
  claimTimeout?: () => Promise<void>;
}

/** Legal actions computed from the player's own view (hidden cards are placeholders). Display only — the engine/server re-validates. */
export function legalFromView(v: PlayerView | null): Action[] {
  if (!v) return [];
  return legalActions(determinize(v, 1), v.me);
}

// ─── Practice: engine runs in the browser, no rewards ──────────────────────────
export interface PracticeConfig { playerDeck: DeckList; aiDeck: DeckList; difficulty: Difficulty; opponentName: string; opponentAvatar: string; opponentTitle: string }

export function usePracticeMatch(cfg: PracticeConfig | null): BattleController {
  const [state, setState] = useState<GameState | null>(null);
  const [events, setEvents] = useState({ id: 0, list: [] as GameEvent[] });
  const [busy, setBusy] = useState(false);
  const stateRef = useRef<GameState | null>(null);
  stateRef.current = state;

  useEffect(() => {
    if (!cfg) return;
    const seed = Math.floor(Math.random() * 2 ** 31);
    let s = createMatch([cfg.playerDeck, cfg.aiDeck], { seed });
    // AI completes setup immediately (its choices stay hidden until both are ready).
    for (let i = 0; i < 6 && aiShouldAct(getPlayerView(s, 1)); i++) {
      const r = applyAction(s, 1, chooseAction(getPlayerView(s, 1), cfg.difficulty, seed + i));
      if (r.ok) s = r.state;
    }
    setState(s);
  }, [cfg]);

  // Drive the AI one visible step at a time so the player can follow its turn.
  useEffect(() => {
    if (!state || !cfg) return;
    const v = getPlayerView(state, 1);
    if (!aiShouldAct(v)) return;
    setBusy(true);
    const t = setTimeout(() => {
      const cur = stateRef.current!;
      const a = chooseAction(getPlayerView(cur, 1), cfg.difficulty, Math.floor(Math.random() * 2 ** 31));
      const r = applyAction(cur, 1, a);
      if (r.ok) { setState(r.state); setEvents((e) => ({ id: e.id + 1, list: r.events })); }
      else {
        const fb = applyAction(cur, 1, { type: 'endTurn' });
        if (fb.ok) setState(fb.state);
      }
      setBusy(false);
    }, cfg.difficulty === 'expert' ? 450 : 700);
    return () => clearTimeout(t);
  }, [state, cfg]);

  const view = useMemo(() => (state ? getPlayerView(state, 0) : null), [state]);
  const legal = useMemo(() => (state ? legalActions(state, 0) : []), [state]);

  const send = useCallback(async (a: Action) => {
    const cur = stateRef.current;
    if (!cur) return false;
    const r = applyAction(cur, 0, a);
    if (!r.ok) return false;
    setState(r.state);
    setEvents((e) => ({ id: e.id + 1, list: r.events }));
    return true;
  }, []);

  return {
    view, legal, events, busy, error: null, send,
    forfeit: async () => { await send({ type: 'concede' }); },
    meta: { mode: 'practice', opponentName: cfg?.opponentName ?? 'AI', opponentAvatar: cfg?.opponentAvatar, opponentTitle: cfg?.opponentTitle, difficulty: cfg?.difficulty, status: state?.phase === 'over' ? 'finished' : 'active' },
  };
}

// ─── Server matches (solo vs AI with rewards, or online PvP) ───────────────────
interface MatchPayload { matchId: string; mode: 'solo' | 'online'; seat: 0 | 1; status: MatchMeta['status']; difficulty: string | null; opponentName: string; opponentAvatar?: string; deadline: string | null; view: PlayerView; events: GameEvent[]; opponent?: { name: string; avatar: string; title: string } }

export function useRemoteMatch(matchId: string): BattleController & { loading: boolean } {
  const [payload, setPayload] = useState<MatchPayload | null>(null);
  const [events, setEvents] = useState({ id: 0, list: [] as GameEvent[] });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const versionRef = useRef(-1);

  const accept = useCallback((p: Partial<MatchPayload> & { view: PlayerView }, evts: GameEvent[]) => {
    if (p.view.version < versionRef.current) return; // stale (out-of-order realtime)
    const isNew = p.view.version > versionRef.current;
    versionRef.current = p.view.version;
    setPayload((old) => ({ ...(old ?? ({} as MatchPayload)), ...p } as MatchPayload));
    if (isNew && evts.length) setEvents((e) => ({ id: e.id + 1, list: evts }));
  }, []);

  const load = useCallback(async () => {
    try {
      const p = await api<MatchPayload>('match.state', { matchId });
      accept(p, []);
      setError(null);
    } catch (e) { setError((e as Error).message); }
  }, [matchId, accept]);

  useEffect(() => { load(); }, [load]);

  // Realtime: our own redacted view row changes whenever the opponent acts.
  useEffect(() => {
    if (!supabase) return;
    const ch = supabase
      .channel(`match-${matchId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'match_views', filter: `match_id=eq.${matchId}` }, (msg) => {
        const row = msg.new as { view: PlayerView; events: GameEvent[]; status: MatchMeta['status']; deadline: string | null };
        if (row?.view) accept({ view: row.view, status: row.status, deadline: row.deadline }, row.events ?? []);
      })
      .subscribe((status) => { if (status === 'SUBSCRIBED') load(); }); // resync after (re)connect
    // Fallback polling keeps things moving if realtime is unavailable.
    const poll = setInterval(() => { if (document.visibilityState === 'visible') load(); }, 15000);
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    return () => { supabase!.removeChannel(ch); clearInterval(poll); window.removeEventListener('focus', onFocus); };
  }, [matchId, accept, load]);

  const send = useCallback(async (a: Action) => {
    if (!payload) return false;
    setBusy(true);
    try {
      const p = await api<MatchPayload>('match.action', { matchId, action: a, version: payload.view.version });
      accept(p, p.events);
      setError(null);
      return true;
    } catch (e) {
      if (e instanceof ApiError && e.data.conflict) await load();
      setError((e as Error).message);
      return false;
    } finally { setBusy(false); }
  }, [payload, matchId, accept, load]);

  const view = payload?.view ?? null;
  const legal = useMemo(() => legalFromView(view), [view]);

  return {
    loading: !payload && !error,
    view, legal, events, busy, error, send,
    forfeit: async () => { const p = await api<MatchPayload>('match.forfeit', { matchId }); accept(p, p.events); },
    claimTimeout: async () => {
      try { const p = await api<MatchPayload>('match.claimTimeout', { matchId }); accept(p, p.events); } catch (e) { setError((e as Error).message); }
    },
    meta: {
      mode: payload?.mode ?? 'solo', opponentName: payload?.opponentName ?? '…', opponentAvatar: payload?.opponentAvatar, difficulty: payload?.difficulty, deadline: payload?.deadline,
      status: payload?.status ?? 'active',
    },
  };
}
