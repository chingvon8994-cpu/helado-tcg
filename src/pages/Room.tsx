import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { supabase } from '../lib/supabase';
import { useAuth } from '../state/auth';
import { useDecks } from '../state/data';
import { DeckPicker, deckChoices } from '../ui/DeckPicker';
import { Spinner, useToast } from '../ui/kit';

interface Room { id: string; code: string; host: string; guest: string | null; host_ready: boolean; guest_ready: boolean; host_name: string; guest_name: string | null; status: 'open' | 'started' | 'closed'; match_id: string | null }

export default function RoomPage() {
  const { id } = useParams();
  const { session } = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const decks = useDecks();
  const [room, setRoom] = useState<Room | null>(null);
  const [deckId, setDeckId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const choices = useMemo(() => deckChoices(decks.data, false), [decks.data]);
  useEffect(() => { if (!deckId && choices.length) setDeckId(choices[0].id); }, [choices, deckId]);

  const load = useCallback(async () => {
    try { setRoom((await api<{ room: Room }>('room.get', { roomId: id })).room); } catch (e) { toast((e as Error).message, 'error'); nav('/battle'); }
  }, [id, nav, toast]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!supabase) return;
    const ch = supabase.channel(`room-${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${id}` }, (m) => setRoom((r) => ({ ...(r as Room), ...(m.new as Room) })))
      .subscribe();
    const poll = setInterval(load, 10000);
    return () => { supabase!.removeChannel(ch); clearInterval(poll); };
  }, [id, load]);
  useEffect(() => { if (room?.status === 'started' && room.match_id) nav(`/match/${room.match_id}`, { replace: true }); }, [room, nav]);

  if (!room) return <Spinner label="Opening room…" />;
  const isHost = room.host === session?.user.id;
  const myReady = isHost ? room.host_ready : room.guest_ready;
  const invite = `${location.origin}/battle?join=${room.code}`;

  const ready = async (r: boolean) => {
    setBusy(true);
    try { setRoom((await api<{ room: Room }>('room.ready', { roomId: room.id, ready: r, deckId })).room); } catch (e) { toast((e as Error).message, 'error'); load(); } finally { setBusy(false); }
  };
  const leave = async () => { await api('room.leave', { roomId: room.id }).catch(() => undefined); nav('/battle'); };

  if (room.status === 'closed') return <div className="panel p-8 text-center"><p className="font-display text-2xl">This room was closed.</p><button className="btn-primary mt-4" onClick={() => nav('/battle')}>Back</button></div>;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="panel checker p-6 text-center">
        <p className="text-sm font-bold uppercase tracking-widest text-white/60">Room code</p>
        <p className="font-display text-6xl font-extrabold tracking-[.3em] text-berry-300">{room.code}</p>
        <div className="mt-3 flex justify-center gap-2">
          <button className="btn-ghost text-sm" onClick={() => { navigator.clipboard.writeText(room.code); toast('Code copied!', 'success'); }}>Copy code</button>
          <button className="btn-ghost text-sm" onClick={() => { navigator.clipboard.writeText(invite); toast('Invite link copied!', 'success'); }}>Copy invite link</button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[{ n: room.host_name, r: room.host_ready, label: 'Host' }, { n: room.guest_name, r: room.guest_ready, label: 'Guest' }].map((p) => (
          <div key={p.label} className={`panel p-4 ${p.r ? 'ring-2 ring-mint-400' : ''}`}>
            <p className="text-xs font-bold uppercase text-white/50">{p.label}</p>
            <p className="font-display text-xl font-bold">{p.n ?? 'Waiting for a friend…'}</p>
            <p className={`text-sm font-bold ${p.r ? 'text-mint-300' : 'text-white/50'}`}>{p.n ? (p.r ? 'Ready!' : 'Choosing a deck…') : ''}</p>
          </div>
        ))}
      </div>
      <div>
        <p className="mb-2 font-display text-lg font-bold">Your deck</p>
        <DeckPicker choices={choices} value={deckId} onChange={(d) => { setDeckId(d); if (myReady) ready(false); }} />
      </div>
      <div className="flex gap-3">
        <button className="btn-ghost" onClick={leave}>{isHost ? 'Close room' : 'Leave'}</button>
        <button className={myReady ? 'btn-ghost flex-1' : 'btn-mint flex-1'} disabled={busy || !deckId} onClick={() => ready(!myReady)}>{myReady ? 'Not ready' : 'Ready!'}</button>
      </div>
      <p className="text-center text-xs text-white/50">The match starts automatically when both players are ready. Both decks are verified by the server.</p>
    </div>
  );
}
