import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { BattleBoard } from '../battle/BattleBoard';
import { useRemoteMatch } from '../battle/controllers';
import { supabase } from '../lib/supabase';
import { useAuth } from '../state/auth';
import { Scoops, Spinner } from '../ui/kit';

interface Result { result: string; scoops: number; xp: number; reason: string | null }

export default function MatchPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const { refresh, summary } = useAuth();
  const ctl = useRemoteMatch(id!);
  const [result, setResult] = useState<Result | null>(null);
  const over = ctl.view?.phase === 'over';

  useEffect(() => {
    if (!over || !supabase) return;
    let tries = 0;
    const load = async () => {
      const { data } = await supabase!.from('match_results').select('result, scoops, xp, reason').eq('match_id', id!).maybeSingle();
      if (data) { setResult(data as Result); refresh(); } else if (tries++ < 5) setTimeout(load, 800);
    };
    load();
  }, [over, id, refresh]);

  if (ctl.error && !ctl.view) return <div className="p-8 text-center"><p className="text-lg font-bold">{ctl.error}</p><button className="btn-primary mt-4" onClick={() => nav('/battle')}>Back</button></div>;
  if (!ctl.view) return <Spinner label="Connecting to match…" />;
  return (
    <BattleBoard
      ctl={ctl}
      myAvatar={summary?.profile.avatar}
      onExit={() => nav('/battle')}
      extraOver={
        result ? (
          <div className="mt-4 rounded-2xl bg-black/30 p-3">
            {result.scoops > 0 || result.xp > 0 ? (
              <p className="flex items-center justify-center gap-3 font-display text-xl font-bold"><Scoops n={result.scoops} /> <span className="text-mint-300">+{result.xp} XP</span></p>
            ) : <p className="text-sm text-white/60">No rewards for this match (too short or forfeited).</p>}
          </div>
        ) : over ? <p className="mt-3 text-sm text-white/50">Tallying rewards…</p> : null
      }
    />
  );
}
