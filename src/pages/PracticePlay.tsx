import { useMemo } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { BattleBoard } from '../battle/BattleBoard';
import { usePracticeMatch, type PracticeConfig } from '../battle/controllers';
import { Spinner } from '../ui/kit';
import { useAuth } from '../state/auth';

export default function PracticePlay() {
  const loc = useLocation();
  const nav = useNavigate();
  const cfg = useMemo(() => (loc.state as PracticeConfig | null) ?? null, [loc.state]);
  const ctl = usePracticeMatch(cfg);
  const { summary } = useAuth();
  if (!cfg) return <Navigate to="/battle" replace />;
  if (!ctl.view) return <Spinner label="Shuffling decks…" />;
  return (
    <BattleBoard
      ctl={ctl}
      myAvatar={summary?.profile.avatar}
      onExit={() => nav('/battle')}
      extraOver={<p className="mt-3 text-sm text-white/60">Practice matches don’t award Scoops. Try a Solo Battle to earn rewards!</p>}
    />
  );
}
