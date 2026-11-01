import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { EssenceElement } from '../cards/types';
import { validateDeck } from '../engine';
import { supabase } from '../lib/supabase';
import { useAuth } from '../state/auth';
import { useDecks, type DeckRecord } from '../state/data';
import { ElementIcon, artUrl } from '../ui/Card';
import { deckCover } from '../ui/DeckPicker';
import { Confirm, Empty, Modal, SectionTitle, Spinner, useToast } from '../ui/kit';

export default function Decks() {
  const decks = useDecks();
  const { session } = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const [del, setDel] = useState<DeckRecord | null>(null);
  const [rename, setRename] = useState<DeckRecord | null>(null);
  const [newName, setNewName] = useState('');

  const create = async () => {
    const { data, error } = await supabase!.from('decks').insert({ user_id: session!.user.id, name: 'New deck', cards: [], essence: [] }).select('id').single();
    if (error) return toast(error.message, 'error');
    nav(`/decks/${data.id}`);
  };
  const duplicate = async (d: DeckRecord) => {
    const { error } = await supabase!.from('decks').insert({ user_id: session!.user.id, name: `${d.name} copy`.slice(0, 32), cards: d.cards, essence: d.essence });
    if (error) toast(error.message, 'error'); else { toast('Deck duplicated', 'success'); decks.reload(); }
  };
  const remove = async () => {
    const { error } = await supabase!.from('decks').delete().eq('id', del!.id);
    setDel(null);
    if (error) toast(error.message, 'error'); else { toast('Deck deleted'); decks.reload(); }
  };
  const doRename = async () => {
    const name = newName.trim().slice(0, 32);
    if (!name) return;
    const { error } = await supabase!.from('decks').update({ name, updated_at: new Date().toISOString() }).eq('id', rename!.id);
    setRename(null);
    if (error) toast(error.message, 'error'); else decks.reload();
  };

  return (
    <div className="space-y-5">
      <SectionTitle right={<button className="btn-primary" onClick={create}>+ New deck</button>}>Decks</SectionTitle>
      {decks.loading ? <Spinner /> : decks.data.length === 0 ? <Empty title="No decks yet">Create your first deck from your collection.</Empty> : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {decks.data.map((d) => {
            const v = validateDeck({ cards: d.cards, essence: d.essence as EssenceElement[] });
            return (
              <div key={d.id} className="panel overflow-hidden">
                <Link to={`/decks/${d.id}`} className="checker flex h-32 items-center justify-center bg-black/20">
                  <img src={artUrl(deckCover({ cards: d.cards, essence: [] }))} alt="" className="h-[85%] object-contain drop-shadow-lg" />
                </Link>
                <div className="p-4">
                  <div className="flex items-center gap-2">
                    <p className="min-w-0 flex-1 truncate font-display text-xl font-bold">{d.name}</p>
                    {d.essence.map((e) => <ElementIcon key={e} el={e as EssenceElement} size={18} />)}
                  </div>
                  <p className={`text-xs font-bold ${v.ok ? 'text-mint-300' : 'text-amber-300'}`}>{d.cards.length} cards · {v.ok ? 'Ready to battle' : v.errors[0]}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link to={`/decks/${d.id}`} className="btn-mint !py-1.5 text-sm">Edit</Link>
                    <button className="btn-ghost !py-1.5 text-sm" onClick={() => { setRename(d); setNewName(d.name); }}>Rename</button>
                    <button className="btn-ghost !py-1.5 text-sm" onClick={() => duplicate(d)}>Duplicate</button>
                    <button className="btn-ghost !py-1.5 text-sm text-red-300" onClick={() => setDel(d)}>Delete</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <Confirm open={!!del} title={`Delete “${del?.name}”?`} body="This can’t be undone. Your cards stay in your collection." confirmLabel="Delete" danger onCancel={() => setDel(null)} onConfirm={remove} />
      <Modal open={!!rename} onClose={() => setRename(null)}>
        <h3 className="font-display text-xl font-bold">Rename deck</h3>
        <input className="input mt-3" maxLength={32} value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && doRename()} autoFocus />
        <div className="mt-4 flex justify-end gap-2"><button className="btn-ghost" onClick={() => setRename(null)}>Cancel</button><button className="btn-primary" onClick={doRename}>Save</button></div>
      </Modal>
    </div>
  );
}
