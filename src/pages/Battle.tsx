import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { DIFFICULTIES, type Difficulty } from '../ai';
import { SOLO_REWARDS } from '../economy/rewards';
import { AI_OPPONENTS } from '../game/aiDecks';
import { api } from '../lib/api';
import { backendConfigured } from '../lib/supabase';
import { useAuth } from '../state/auth';
import { useDecks } from '../state/data';
import { DeckPicker, deckChoices } from '../ui/DeckPicker';
import { Avatar, Scoops, SectionTitle, useToast } from '../ui/kit';

const DIFF_COLOR: Record<Difficulty, string> = { beginner: '#5fe3b5', easy: '#6fc8ff', normal: '#ffd36f', expert: '#ff6fb5' };

export default function Battle() {
  const { session } = useAuth();
  const decks = useDecks();
  const nav = useNavigate();
  const toast = useToast();
  const [params] = useSearchParams();
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const choices = useMemo(() => deckChoices(decks.data, !session), [decks.data, session]);
  const [deckId, setDeckId] = useState<string | null>(null);
  const [code, setCode] = useState(params.get('join') ?? '');
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState<{ matchId: string; mode: string; opponentName: string; turn: number }[]>([]);

  useEffect(() => { if (!deckId && choices.length) setDeckId(choices[0].id); }, [choices, deckId]);
  useEffect(() => {
    if (!session) return;
    api<{ matches: typeof active }>('match.active').then((r) => setActive(r.matches)).catch(() => undefined);
  }, [session]);

  const deck = choices.find((d) => d.id === deckId) ?? null;
  const onlineReady = backendConfigured && !!session;
  const serverDeckId = deck && deck.source !== 'loaner' ? deck.id : null;

  const startSolo = async () => {
    if (!serverDeckId) return toast('Pick one of your decks.', 'error');
    setBusy(true);
    try {
      const r = await api<{ matchId: string }>('solo.start', { deckId: serverDeckId, difficulty });
      nav(`/match/${r.matchId}`);
    } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  };
  const startPractice = () => {
    if (!deck) return;
    const pool = AI_OPPONENTS[difficulty];
    const opp = pool[Math.floor(Math.random() * pool.length)];
    nav('/practice/play', { state: { playerDeck: deck.list, aiDeck: opp.deck, difficulty, opponentName: opp.name, opponentAvatar: opp.avatar, opponentTitle: opp.title } });
  };
  const createRoom = async () => {
    if (!serverDeckId) return toast('Pick one of your decks.', 'error');
    setBusy(true);
    try {
      const r = await api<{ room: { id: string } }>('room.create', { deckId: serverDeckId });
      nav(`/room/${r.room.id}`);
    } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  };
  const joinRoom = async () => {
    if (!serverDeckId) return toast('Pick one of your decks.', 'error');
    setBusy(true);
    try {
      const r = await api<{ room: { id: string } }>('room.join', { code, deckId: serverDeckId });
      nav(`/room/${r.room.id}`);
    } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-8">
      {active.length > 0 && (
        <section className="panel p-4">
          <SectionTitle>Matches in progress</SectionTitle>
          <div className="flex flex-wrap gap-2">
            {active.map((m) => <Link key={m.matchId} to={`/match/${m.matchId}`} className="btn-mint">Resume vs {m.opponentName} · turn {m.turn}</Link>)}
          </div>
        </section>
      )}

      <section>
        <SectionTitle>Your deck</SectionTitle>
        <DeckPicker choices={choices} value={deckId} onChange={setDeckId} />
        {session && <Link to="/decks" className="text-sm font-bold text-berry-300 hover:underline">Build or edit decks →</Link>}
      </section>

      <section>
        <SectionTitle>Choose an opponent</SectionTitle>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {DIFFICULTIES.map((d) => {
            const opp = AI_OPPONENTS[d.id][0];
            return (
              <button key={d.id} onClick={() => setDifficulty(d.id)} className={`relative overflow-hidden rounded-3xl border-2 p-4 text-left transition ${difficulty === d.id ? 'scale-[1.02] border-white bg-white/10' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}>
                <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-30" style={{ background: DIFF_COLOR[d.id] }} />
                <Avatar name={opp.avatar} size={48} />
                <p className="mt-2 font-display text-xl font-extrabold" style={{ color: DIFF_COLOR[d.id] }}>{d.label}</p>
                <p className="text-xs text-white/70">{d.blurb}</p>
                <p className="mt-2 text-xs font-bold text-white/60">Win: <Scoops n={SOLO_REWARDS[d.id].win} className="text-white" /></p>
              </button>
            );
          })}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="panel flex flex-col p-5">
          <h3 className="font-display text-2xl font-extrabold">Solo Battle</h3>
          <p className="mt-1 flex-1 text-sm text-white/70">Ranked vs the AI on our servers. Earn Scoops, XP and mission progress.</p>
          <button className="btn-primary mt-4" disabled={!onlineReady || busy || !serverDeckId} onClick={startSolo}>{onlineReady ? 'Start Solo Battle' : 'Sign in to earn rewards'}</button>
        </div>
        <div className="panel flex flex-col p-5">
          <h3 className="font-display text-2xl font-extrabold">Practice</h3>
          <p className="mt-1 flex-1 text-sm text-white/70">Test any deck against the AI instantly in your browser. No rewards, no risk.</p>
          <button className="btn-mint mt-4" disabled={!deck} onClick={startPractice}>Start Practice</button>
        </div>
        <div className="panel flex flex-col p-5">
          <h3 className="font-display text-2xl font-extrabold">Play a Friend</h3>
          <p className="mt-1 text-sm text-white/70">Create a private room and share the code, or join a friend’s room.</p>
          <button className="btn-primary mt-4" disabled={!onlineReady || busy || !serverDeckId} onClick={createRoom}>Create room</button>
          <div className="mt-3 flex gap-2">
            <input className="input uppercase tracking-widest" maxLength={6} placeholder="CODE" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
            <button className="btn-ghost" disabled={!onlineReady || busy || code.length < 6 || !serverDeckId} onClick={joinRoom}>Join</button>
          </div>
          {!onlineReady && <p className="mt-2 text-xs text-amber-200/80">{backendConfigured ? 'Sign in to play online.' : 'Online play requires Supabase to be configured.'}</p>}
        </div>
      </section>
    </div>
  );
}
