import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ALL_CARDS, copyKey, getCard } from '../cards/registry';
import { ESSENCE_ELEMENTS, type CardDef, type EssenceElement } from '../cards/types';
import { DEFAULT_RULES, validateDeck } from '../engine';
import { supabase } from '../lib/supabase';
import { useCollection, useDecks } from '../state/data';
import { CardView, ElementIcon } from '../ui/Card';
import { DEFAULT_FILTERS, FilterBar, applyFilters } from '../ui/CardFilters';
import { Confirm, Modal, Spinner, useToast } from '../ui/kit';

export default function DeckEditor() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const decks = useDecks();
  const owned = useCollection();
  const deck = decks.data.find((d) => d.id === id);
  const [name, setName] = useState('');
  const [cards, setCards] = useState<string[]>([]);
  const [essence, setEssence] = useState<EssenceElement[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [f, setF] = useState({ ...DEFAULT_FILTERS, owned: 'owned' as const });
  const [inspect, setInspect] = useState<CardDef | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [saving, setSaving] = useState(false);
  const rules = DEFAULT_RULES;

  useEffect(() => {
    if (deck && !loaded) { setName(deck.name); setCards(deck.cards); setEssence(deck.essence as EssenceElement[]); setLoaded(true); }
  }, [deck, loaded]);

  const counts = useMemo(() => { const m = new Map<string, number>(); cards.forEach((c) => m.set(c, (m.get(c) ?? 0) + 1)); return m; }, [cards]);
  const nameCounts = useMemo(() => { const m = new Map<string, number>(); cards.forEach((c) => { const k = copyKey(getCard(c)); m.set(k, (m.get(k) ?? 0) + 1); }); return m; }, [cards]);
  const pool = useMemo(() => applyFilters(ALL_CARDS, f, owned.data), [f, owned.data]);
  const v = validateDeck({ cards, essence }, rules);

  const canAdd = (c: CardDef) => cards.length < rules.deckSize && (counts.get(c.id) ?? 0) < (owned.data[c.id] ?? 0) && (nameCounts.get(copyKey(c)) ?? 0) < rules.maxCopies;
  const add = (c: CardDef) => {
    if (!canAdd(c)) return;
    setCards([...cards, c.id]); setDirty(true);
    if (c.category === 'creature' && ESSENCE_ELEMENTS.includes(c.element as EssenceElement) && !essence.includes(c.element as EssenceElement) && essence.length < rules.maxEssenceTypes) setEssence([...essence, c.element as EssenceElement]);
  };
  const remove = (cid: string) => { const i = cards.lastIndexOf(cid); if (i >= 0) { setCards(cards.filter((_, j) => j !== i)); setDirty(true); } };
  const toggleEssence = (e: EssenceElement) => { setDirty(true); setEssence(essence.includes(e) ? essence.filter((x) => x !== e) : essence.length < rules.maxEssenceTypes ? [...essence, e] : essence); };

  const save = async () => {
    setSaving(true);
    const { error } = await supabase!.from('decks').update({ name: name.trim().slice(0, 32) || 'Deck', cards, essence, updated_at: new Date().toISOString() }).eq('id', id!);
    setSaving(false);
    if (error) return toast(error.message, 'error');
    setDirty(false);
    toast(v.ok ? 'Deck saved — ready to battle!' : 'Saved. Finish the deck to battle with it.', 'success');
  };

  if (decks.loading || owned.loading) return <Spinner />;
  if (!deck) return <div className="panel p-8 text-center">Deck not found.</div>;
  const grouped = [...counts.entries()].map(([cid, n]) => ({ card: getCard(cid), n })).sort((a, b) => (a.card.category === b.card.category ? a.card.name.localeCompare(b.card.name) : a.card.category === 'creature' ? -1 : 1));

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="min-w-0 space-y-3">
        <FilterBar f={f} set={(x) => setF(x as typeof f)} showOwned />
        <div className="grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-3">
          {pool.map((c) => {
            const have = owned.data[c.id] ?? 0;
            const inDeck = counts.get(c.id) ?? 0;
            const ok = canAdd(c);
            return (
              <div key={c.id} className="relative">
                <CardView card={c} width={130} className="!w-full" dim={!have} onClick={() => (have ? add(c) : setInspect(c))} />
                <span className="absolute -top-1 left-1 rounded-full bg-black/70 px-2 text-[11px] font-bold">{inDeck}/{have}</span>
                <button className="absolute -right-1 -top-1 rounded-full bg-white/90 px-1.5 text-xs font-bold text-[#2a1710]" onClick={() => setInspect(c)}>i</button>
                {!ok && have > 0 && <div className="pointer-events-none absolute inset-0 rounded-xl bg-black/40" />}
              </div>
            );
          })}
        </div>
      </div>
      <aside className="panel h-fit space-y-4 p-4 lg:sticky lg:top-20">
        <input className="input font-display text-lg font-bold" maxLength={32} value={name} onChange={(e) => { setName(e.target.value); setDirty(true); }} />
        <div>
          <p className="mb-1 text-xs font-bold uppercase text-white/60">Essence types ({essence.length}/{rules.maxEssenceTypes})</p>
          <div className="flex flex-wrap gap-1.5">
            {ESSENCE_ELEMENTS.map((e) => (
              <button key={e} onClick={() => toggleEssence(e)} className={`rounded-full p-0.5 transition ${essence.includes(e) ? 'ring-2 ring-white' : 'opacity-40 hover:opacity-80'}`}><ElementIcon el={e} size={28} /></button>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between text-xs font-bold uppercase text-white/60"><span>Cards</span><span className={cards.length === rules.deckSize ? 'text-mint-300' : ''}>{cards.length}/{rules.deckSize}</span></div>
          <div className="h-2 overflow-hidden rounded-full bg-black/30"><div className="h-full bg-berry-400 transition-all" style={{ width: `${(cards.length / rules.deckSize) * 100}%` }} /></div>
          <ul className="mt-3 max-h-[40vh] space-y-1 overflow-auto pr-1">
            {grouped.map(({ card, n }) => (
              <li key={card.id} className="flex items-center gap-2 rounded-xl bg-white/5 px-2 py-1.5 text-sm">
                {card.category === 'creature' ? <ElementIcon el={card.element} size={18} /> : <span className="w-[18px] text-center text-xs">🂠</span>}
                <button className="min-w-0 flex-1 truncate text-left font-bold" onClick={() => setInspect(card)}>{card.name}</button>
                <span className="font-display font-bold">×{n}</span>
                <button className="rounded-lg bg-white/10 px-2 font-bold hover:bg-red-500/60" onClick={() => remove(card.id)}>−</button>
              </li>
            ))}
            {!grouped.length && <li className="text-sm text-white/50">Tap cards on the left to add them.</li>}
          </ul>
        </div>
        {!v.ok && <ul className="space-y-1 rounded-xl bg-amber-400/10 p-2 text-xs text-amber-200">{v.errors.map((e) => <li key={e}>• {e}</li>)}</ul>}
        <div className="flex gap-2">
          <button className="btn-ghost" onClick={() => (dirty ? setLeaving(true) : nav('/decks'))}>Back</button>
          <button className="btn-primary flex-1" disabled={saving || !dirty} onClick={save}>{saving ? 'Saving…' : 'Save deck'}</button>
        </div>
        <p className="text-[11px] text-white/50">Rules: {rules.deckSize} cards · max {rules.maxCopies} copies per name · at least {rules.minBasics} Basic creature · 1–{rules.maxEssenceTypes} Essence types.</p>
      </aside>
      <Modal open={!!inspect} onClose={() => setInspect(null)} bare>{inspect && <div onClick={() => setInspect(null)}><CardView card={inspect} width={Math.min(340, window.innerWidth - 40)} tilt /></div>}</Modal>
      <Confirm open={leaving} title="Discard unsaved changes?" confirmLabel="Discard" danger onCancel={() => setLeaving(false)} onConfirm={() => nav('/decks')} />
    </div>
  );
}
