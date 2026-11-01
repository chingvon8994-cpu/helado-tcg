import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { EXPANSIONS, getCard } from '../cards/registry';
import { activeEvents, DAILY_LOGIN_SCOOPS, xpForLevel } from '../economy/rewards';
import { api } from '../lib/api';
import { backendConfigured } from '../lib/supabase';
import { useAuth } from '../state/auth';
import { useRecentAcquisitions, useResults } from '../state/data';
import { CardView } from '../ui/Card';
import { Avatar, Scoops, SectionTitle, useToast } from '../ui/kit';
import { PackArt } from './Shop';

interface Mission { id: string; title: string; period: 'daily' | 'weekly'; target: number; reward: number; progress: number; claimed: boolean }

export default function Home() {
  const { session, summary, refresh, setScoops } = useAuth();
  const toast = useToast();
  const recent = useRecentAcquisitions(8);
  const results = useResults(5);
  const [missions, setMissions] = useState<Mission[]>([]);
  const featured = EXPANSIONS[EXPANSIONS.length - 1];
  const events = activeEvents(new Date());

  const loadMissions = () => api<{ missions: Mission[] }>('missions.list').then((r) => setMissions(r.missions)).catch(() => undefined);
  useEffect(() => { if (session) loadMissions(); }, [session]);

  if (!session || !summary) {
    return (
      <div className="space-y-10">
        <section className="panel checker relative overflow-hidden p-6 md:p-10">
          <div className="relative z-10 max-w-lg">
            <h1 className="font-display text-4xl font-extrabold leading-tight md:text-5xl">Collect, build and battle in the <span className="text-berry-400">Helado Region</span>.</h1>
            <p className="mt-3 text-white/75">A fast, friendly trading card game starring 70+ original Fakemon across three expansions. Open packs, build 20-card decks and challenge AI rivals or friends.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              {backendConfigured && <Link to="/login" className="btn-primary">Create a free account</Link>}
              <Link to="/battle" className="btn-mint">Play Practice now</Link>
              <Link to="/collection" className="btn-ghost">Browse cards</Link>
            </div>
          </div>
          <div className="pointer-events-none absolute -right-10 top-4 hidden gap-2 lg:flex">
            {['GEN-103', 'WLD-104', 'CEL-104'].map((id, i) => <div key={id} style={{ transform: `rotate(${(i - 1) * 8}deg) translateY(${Math.abs(i - 1) * 20}px)` }}><CardView card={getCard(id)} width={180} /></div>)}
          </div>
        </section>
        <section className="grid gap-4 md:grid-cols-3">
          {[['⚔', 'Fast battles', 'Matches last about 10 minutes. First to 3 points wins.'], ['✦', '4 AI difficulties', 'From Beginner to an Expert that plans whole turns.'], ['🍦', 'Collect & trade up', 'Earn Scoops, open packs, chase Secret Rares.']].map(([i, t, d]) => (
            <div key={t} className="panel p-5"><p className="text-3xl">{i}</p><p className="mt-2 font-display text-xl font-bold">{t}</p><p className="text-sm text-white/70">{d}</p></div>
          ))}
        </section>
      </div>
    );
  }

  const p = summary.profile;
  const lvlFloor = xpForLevel(p.level);
  const lvlCeil = xpForLevel(p.level + 1);
  const claimDaily = async () => {
    try { const r = await api<{ scoops: number }>('economy.claimDaily'); setScoops(r.scoops); toast(`+${DAILY_LOGIN_SCOOPS} Scoops! See you tomorrow.`, 'success'); refresh(); } catch (e) { toast((e as Error).message, 'error'); }
  };
  const claimMission = async (m: Mission) => {
    try { const r = await api<{ scoops: number }>('missions.claim', { missionId: m.id }); setScoops(r.scoops); toast(`Mission complete! +${m.reward} Scoops`, 'success'); loadMissions(); } catch (e) { toast((e as Error).message, 'error'); }
  };

  return (
    <div className="space-y-8">
      <section className="panel flex flex-wrap items-center gap-4 p-5">
        <Avatar name={p.avatar} size={72} />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-white/60">Welcome back,</p>
          <p className="font-display text-3xl font-extrabold leading-tight">{p.username}</p>
          <div className="mt-1 flex items-center gap-2 text-xs font-bold text-white/70">
            <span>Lv {p.level}</span>
            <div className="h-2 w-24 overflow-hidden rounded-full bg-black/30 sm:w-40"><div className="h-full bg-mint-400" style={{ width: `${((p.xp - lvlFloor) / (lvlCeil - lvlFloor)) * 100}%` }} /></div>
            <span>{p.xp - lvlFloor}/{lvlCeil - lvlFloor} XP</span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className="rounded-full bg-black/30 px-4 py-2 text-xl"><Scoops n={summary.scoops} /></span>
          {!summary.dailyClaimed ? <button className="btn-mint !py-2 text-sm" onClick={claimDaily}>Claim daily +{DAILY_LOGIN_SCOOPS}</button> : <span className="text-xs text-white/50">Daily reward claimed ✓</span>}
        </div>
      </section>

      {events.map((e) => (
        <section key={e.id} className="drip rounded-3xl bg-gradient-to-r from-berry-500 to-[#ff9f6f] p-5 text-[#2a1710]" style={{ ['--drip' as string]: '#ff7fa8' }}>
          <p className="text-xs font-extrabold uppercase tracking-widest">Special event · until {new Date(e.end).toLocaleDateString()}</p>
          <p className="font-display text-2xl font-extrabold">{e.name}</p>
          <p className="font-semibold">{e.description}</p>
        </section>
      ))}

      <section className="grid gap-3 sm:grid-cols-3">
        <Link to="/battle" className="panel group p-5 transition hover:bg-white/10"><p className="font-display text-2xl font-extrabold group-hover:text-berry-300">Solo Battle →</p><p className="text-sm text-white/60">Beat the AI for Scoops & XP.</p></Link>
        <Link to="/battle" className="panel group p-5 transition hover:bg-white/10"><p className="font-display text-2xl font-extrabold group-hover:text-mint-300">Play a Friend →</p><p className="text-sm text-white/60">Private rooms with a code.</p></Link>
        <Link to="/decks" className="panel group p-5 transition hover:bg-white/10"><p className="font-display text-2xl font-extrabold group-hover:text-cone-300">Build a Deck →</p><p className="text-sm text-white/60">20 cards, up to 3 Essence types.</p></Link>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <section>
          <SectionTitle>Missions</SectionTitle>
          <div className="space-y-2">
            {missions.map((m) => {
              const done = m.progress >= m.target;
              return (
                <div key={m.id} className="panel flex items-center gap-3 p-3">
                  <span className={`chip ${m.period === 'daily' ? 'bg-berry-400/30' : 'bg-mint-400/30'}`}>{m.period}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold">{m.title}</p>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-black/30"><div className="h-full bg-berry-400" style={{ width: `${(m.progress / m.target) * 100}%` }} /></div>
                  </div>
                  <span className="text-xs font-bold text-white/60">{m.progress}/{m.target}</span>
                  {m.claimed ? <span className="text-sm text-mint-300">✓</span> : <button className="btn-primary !px-3 !py-1.5 text-sm" disabled={!done} onClick={() => claimMission(m)}><Scoops n={m.reward} /></button>}
                </div>
              );
            })}
          </div>
        </section>
        <section>
          <SectionTitle>Featured</SectionTitle>
          <Link to="/shop" className="panel flex flex-col items-center gap-3 p-4">
            <PackArt exp={featured} width={170} />
            <p className="text-center text-sm text-white/70">{featured.tagline}</p>
          </Link>
        </section>
      </div>

      <section>
        <SectionTitle right={<Link to="/collection" className="text-sm font-bold text-berry-300">Collection →</Link>}>Recent cards</SectionTitle>
        {recent.data.length ? <div className="no-scrollbar flex gap-3 overflow-x-auto pb-2">{recent.data.map((a, i) => <CardView key={i} card={getCard(a.card_id)} width={120} />)}</div> : <p className="text-sm text-white/60">Open a pack in the Shop to start your collection!</p>}
      </section>

      <section>
        <SectionTitle right={<Link to="/profile" className="text-sm font-bold text-berry-300">History →</Link>}>Recent matches</SectionTitle>
        {results.data.length ? (
          <div className="space-y-2">{results.data.map((r) => <ResultRow key={r.match_id} r={r} />)}</div>
        ) : <p className="text-sm text-white/60">No matches yet — jump into a Solo Battle!</p>}
      </section>
    </div>
  );
}

export function ResultRow({ r }: { r: { result: string; opponent_name: string; mode: string; turns: number; scoops: number; xp: number; created_at: string; reason: string | null } }) {
  const color = r.result === 'win' ? 'text-mint-300' : r.result === 'loss' ? 'text-red-300' : 'text-white/70';
  return (
    <div className="panel flex items-center gap-3 p-3 text-sm">
      <span className={`w-14 font-display text-lg font-extrabold uppercase ${color}`}>{r.result}</span>
      <div className="min-w-0 flex-1"><p className="truncate font-bold">vs {r.opponent_name}</p><p className="text-[11px] text-white/50">{r.mode} · {r.turns} turns · {r.reason} · {new Date(r.created_at).toLocaleDateString()}</p></div>
      {r.scoops > 0 && <Scoops n={r.scoops} />}
      {r.xp > 0 && <span className="text-xs font-bold text-mint-300">+{r.xp} XP</span>}
    </div>
  );
}
