import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './auth';

/** Small read hooks over RLS-protected tables. Writes to server-owned data go through `api()`. */
function useQuery<T>(fn: () => Promise<T>, deps: unknown[], initial: T) {
  const [data, setData] = useState<T>(initial);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const run = useCallback(async () => {
    setLoading(true);
    try { setData(await fn()); setError(null); } catch (e) { setError((e as Error).message); } finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => { run(); }, [run]);
  return { data, loading, error, reload: run };
}

const must = <T,>(r: { data: T | null; error: { message: string } | null }): T => {
  if (r.error) throw new Error(r.error.message);
  return r.data as T;
};

export function useCollection() {
  const { session } = useAuth();
  return useQuery(async () => {
    if (!supabase || !session) return {} as Record<string, number>;
    const rows = must(await supabase.from('collection').select('card_id, quantity'));
    return Object.fromEntries((rows as { card_id: string; quantity: number }[]).map((r) => [r.card_id, r.quantity]));
  }, [session?.user.id], {} as Record<string, number>);
}

export interface DeckRecord { id: string; name: string; cards: string[]; essence: string[]; updated_at: string }
export function useDecks() {
  const { session } = useAuth();
  return useQuery(async () => {
    if (!supabase || !session) return [] as DeckRecord[];
    return must(await supabase.from('decks').select('id, name, cards, essence, updated_at').order('updated_at', { ascending: false })) as DeckRecord[];
  }, [session?.user.id], [] as DeckRecord[]);
}

export interface Acquisition { card_id: string; source: string; created_at: string }
export function useRecentAcquisitions(limit = 12) {
  const { session } = useAuth();
  return useQuery(async () => {
    if (!supabase || !session) return [] as Acquisition[];
    return must(await supabase.from('card_acquisitions').select('card_id, source, created_at').neq('source', 'starter').order('created_at', { ascending: false }).limit(limit)) as Acquisition[];
  }, [session?.user.id, limit], [] as Acquisition[]);
}

export interface ResultRecord { match_id: string; mode: string; opponent_name: string; difficulty: string | null; result: 'win' | 'loss' | 'draw'; reason: string | null; turns: number; scoops: number; xp: number; created_at: string }
export function useResults(limit = 10) {
  const { session } = useAuth();
  return useQuery(async () => {
    if (!supabase || !session) return [] as ResultRecord[];
    return must(await supabase.from('match_results').select('*').order('created_at', { ascending: false }).limit(limit)) as ResultRecord[];
  }, [session?.user.id, limit], [] as ResultRecord[]);
}

export interface Stats { wins: number; losses: number; draws: number; online_wins: number; solo_wins: number; expert_wins: number; knockouts: number; packs_opened: number }
export function useStats() {
  const { session } = useAuth();
  return useQuery(async () => {
    if (!supabase || !session) return null;
    return must(await supabase.from('player_stats').select('*').maybeSingle()) as Stats | null;
  }, [session?.user.id], null as Stats | null);
}

export function useAchievements() {
  const { session } = useAuth();
  return useQuery(async () => {
    if (!supabase || !session) return [] as { achievement_id: string; unlocked_at: string }[];
    return must(await supabase.from('achievements').select('achievement_id, unlocked_at')) as { achievement_id: string; unlocked_at: string }[];
  }, [session?.user.id], [] as { achievement_id: string; unlocked_at: string }[]);
}

export interface PackRecord { id: string; expansion_id: string; cards: string[]; created_at: string }
export function usePackHistory(limit = 20) {
  const { session } = useAuth();
  return useQuery(async () => {
    if (!supabase || !session) return [] as PackRecord[];
    return must(await supabase.from('pack_opens').select('id, expansion_id, cards, created_at').order('created_at', { ascending: false }).limit(limit)) as PackRecord[];
  }, [session?.user.id, limit], [] as PackRecord[]);
}
