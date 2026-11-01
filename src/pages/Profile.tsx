import { useMemo, useState } from 'react';
import { getCard } from '../cards/registry';
import { ACHIEVEMENTS } from '../economy/missions';
import { api } from '../lib/api';
import { supabase } from '../lib/supabase';
import { useAuth } from '../state/auth';
import { useAchievements, useCollection, useResults, useStats } from '../state/data';
import { Avatar, Confirm, Modal, Scoops, SectionTitle, useToast } from '../ui/kit';
import { ResultRow } from './Home';

export default function Profile() {
  const { summary, refresh, signOut } = useAuth();
  const stats = useStats();
  const results = useResults(30);
  const ach = useAchievements();
  const owned = useCollection();
  const toast = useToast();
  const [username, setUsername] = useState('');
  const [editName, setEditName] = useState(false);
  const [pickAvatar, setPickAvatar] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const avatars = useMemo(() => [...new Set(Object.keys(owned.data).map((id) => getCard(id)).filter((c) => c.category === 'creature' && c.art.image).map((c) => c.art.image!))], [owned.data]);
  if (!summary) return null;
  const p = summary.profile;
  const s = stats.data;
  const games = s ? s.wins + s.losses + s.draws : 0;

  const saveName = async () => {
    try { await api('account.setUsername', { username }); toast('Username updated', 'success'); setEditName(false); refresh(); } catch (e) { toast((e as Error).message, 'error'); }
  };
  const saveAvatar = async (a: string) => {
    const { error } = await supabase!.from('profiles').update({ avatar: a }).eq('id', p.id);
    if (error) toast(error.message, 'error'); else { setPickAvatar(false); refresh(); }
  };

  return (
    <div className="space-y-8">
      <section className="panel flex flex-wrap items-center gap-5 p-6">
        <button onClick={() => setPickAvatar(true)} title="Change avatar"><Avatar name={p.avatar} size={96} /></button>
        <div className="flex-1">
          <p className="font-display text-4xl font-extrabold">{p.username}</p>
          <p className="text-white/60">Level {p.level} · {p.xp} XP</p>
          <div className="mt-2 flex gap-2"><button className="btn-ghost !py-1.5 text-sm" onClick={() => { setUsername(p.username); setEditName(true); }}>Change username</button><button className="btn-ghost !py-1.5 text-sm" onClick={() => setLeaving(true)}>Sign out</button></div>
        </div>
        <span className="rounded-full bg-black/30 px-4 py-2 text-2xl"><Scoops n={summary.scoops} /></span>
      </section>

      <section>
        <SectionTitle>Statistics</SectionTitle>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[['Matches', games], ['Wins', s?.wins ?? 0], ['Win rate', games ? `${Math.round(((s?.wins ?? 0) / games) * 100)}%` : '—'], ['Online wins', s?.online_wins ?? 0], ['Expert wins', s?.expert_wins ?? 0], ['Knockouts', s?.knockouts ?? 0], ['Packs opened', s?.packs_opened ?? 0], ['Unique cards', Object.keys(owned.data).length]].map(([k, v]) => (
            <div key={k} className="panel p-4"><p className="text-xs font-bold uppercase text-white/50">{k}</p><p className="font-display text-3xl font-extrabold">{v}</p></div>
          ))}
        </div>
      </section>

      <section>
        <SectionTitle>Achievements</SectionTitle>
        <div className="grid gap-2 sm:grid-cols-2">
          {ACHIEVEMENTS.map((a) => {
            const got = ach.data.find((x) => x.achievement_id === a.id);
            return (
              <div key={a.id} className={`panel flex items-center gap-3 p-3 ${got ? '' : 'opacity-50'}`}>
                <span className="text-2xl">{got ? '🏆' : '🔒'}</span>
                <div className="flex-1"><p className="font-bold">{a.title}</p><p className="text-xs text-white/60">{a.description}</p></div>
                <Scoops n={a.reward} className="text-sm" />
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <SectionTitle>Match history</SectionTitle>
        {results.data.length ? <div className="space-y-2">{results.data.map((r) => <ResultRow key={r.match_id} r={r} />)}</div> : <p className="text-sm text-white/60">No matches yet.</p>}
      </section>

      <Modal open={editName} onClose={() => setEditName(false)}>
        <h3 className="font-display text-xl font-bold">Change username</h3>
        <input className="input mt-3" maxLength={16} value={username} onChange={(e) => setUsername(e.target.value)} />
        <p className="mt-1 text-xs text-white/50">3–16 letters, numbers or underscores.</p>
        <div className="mt-4 flex justify-end gap-2"><button className="btn-ghost" onClick={() => setEditName(false)}>Cancel</button><button className="btn-primary" onClick={saveName}>Save</button></div>
      </Modal>
      <Modal open={pickAvatar} onClose={() => setPickAvatar(false)} wide>
        <h3 className="font-display text-xl font-bold">Choose an avatar</h3>
        <p className="text-xs text-white/60">Any creature you own can be your avatar.</p>
        <div className="mt-3 grid grid-cols-5 gap-2 sm:grid-cols-8">{avatars.map((a) => <button key={a} onClick={() => saveAvatar(a)} className={`rounded-2xl p-1 ${a === p.avatar ? 'ring-2 ring-berry-400' : ''}`}><Avatar name={a} size={56} /></button>)}</div>
      </Modal>
      <Confirm open={leaving} title="Sign out?" confirmLabel="Sign out" onCancel={() => setLeaving(false)} onConfirm={() => { setLeaving(false); signOut(); }} />
    </div>
  );
}
