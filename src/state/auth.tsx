import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from '../lib/api';
import { backendConfigured, supabase } from '../lib/supabase';

export interface Summary {
  profile: { id: string; username: string; avatar: string; xp: number; level: number; bootstrapped: boolean };
  scoops: number;
  dailyClaimed: boolean;
}

interface AuthState {
  ready: boolean;
  session: Session | null;
  summary: Summary | null;
  refresh: () => Promise<void>;
  setScoops: (n: number) => void;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthState>(null as never);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(!backendConfigured);
  const [session, setSession] = useState<Session | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);

  const refresh = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase.auth.getSession();
    if (!data.session) { setSummary(null); return; }
    // Bootstrap is idempotent: grants starter decks/scoops on the first ever call only.
    const s = await api<Summary>('account.bootstrap');
    setSummary(s);
  }, []);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session) await refresh().catch(() => undefined);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => {
      setSession(s);
      if (s) refresh().catch(() => undefined);
      else setSummary(null);
    });
    return () => sub.subscription.unsubscribe();
  }, [refresh]);

  const value = useMemo<AuthState>(() => ({
    ready, session, summary, refresh,
    setScoops: (n) => setSummary((s) => (s ? { ...s, scoops: n } : s)),
    signOut: async () => { await supabase?.auth.signOut(); setSummary(null); },
  }), [ready, session, summary, refresh]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
