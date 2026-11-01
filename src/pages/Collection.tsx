import { useMemo, useState } from 'react';
import { ALL_CARDS, EXPANSIONS, cardsInExpansion, getExpansion } from '../cards/registry';
import type { CardDef } from '../cards/types';
import { useAuth } from '../state/auth';
import { useCollection, useRecentAcquisitions } from '../state/data';
import { CardView, RARITY_COLOR, RARITY_LABEL } from '../ui/Card';
import { DEFAULT_FILTERS, FilterBar, applyFilters } from '../ui/CardFilters';
import { Modal, SectionTitle, Spinner } from '../ui/kit';

export default function Collection() {
  const { session } = useAuth();
  const owned = useCollection();
  const recent = useRecentAcquisitions(10);
  const [f, setF] = useState(DEFAULT_FILTERS);
  const [inspect, setInspect] = useState<CardDef | null>(null);
  const signedIn = !!session;
  const list = useMemo(() => applyFilters(ALL_CARDS, f, signedIn ? owned.data : undefined), [f, owned.data, signedIn]);
  const ownedCount = (ids: string[]) => ids.filter((id) => owned.data[id]).length;
  const total = ALL_CARDS.length;
  const have = ownedCount(ALL_CARDS.map((c) => c.id));

  return (
    <div className="space-y-6">
      <SectionTitle right={signedIn && <span className="font-display text-lg font-bold text-white/80">{have}/{total} · {Math.round((have / total) * 100)}%</span>}>Collection</SectionTitle>
      {signedIn && (
        <div className="grid gap-3 sm:grid-cols-3">
          {EXPANSIONS.map((e) => {
            const ids = cardsInExpansion(e.id).map((c) => c.id);
            const pct = Math.round((ownedCount(ids) / ids.length) * 100);
            return (
              <button key={e.id} onClick={() => setF({ ...f, expansion: e.id })} className="panel p-4 text-left">
                <p className="font-display text-lg font-bold" style={{ color: e.theme.primary }}>{e.name}</p>
                <p className="text-xs text-white/60">{ownedCount(ids)} / {ids.length} cards</p>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/30"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: e.theme.primary }} /></div>
              </button>
            );
          })}
        </div>
      )}
      {signedIn && recent.data.length > 0 && (
        <div>
          <p className="mb-2 font-display text-lg font-bold">Recently acquired</p>
          <div className="no-scrollbar flex gap-2 overflow-x-auto pb-2">
            {recent.data.map((a, i) => { const c = ALL_CARDS.find((x) => x.id === a.card_id); return c ? <CardView key={i} card={c} width={110} onClick={() => setInspect(c)} /> : null; })}
          </div>
        </div>
      )}
      {!signedIn && <p className="rounded-2xl bg-white/5 p-3 text-sm text-white/70">Browsing the full card catalog. Sign in to track the cards you own.</p>}
      <FilterBar f={f} set={setF} showOwned={signedIn} />
      {owned.loading && signedIn ? <Spinner /> : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-4">
          {list.map((c) => {
            const n = owned.data[c.id] ?? 0;
            const missing = signedIn && !n;
            return (
              <div key={c.id} className="relative">
                {missing ? (
                  <button onClick={() => setInspect(c)} className="checker flex aspect-[63/88] w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-white/15 bg-black/20 p-2 text-center">
                    {c.category === 'creature' && c.art.image && <img src={`/art/creatures/${c.art.image}.webp`} alt="" className="h-1/2 object-contain opacity-60 brightness-0" />}
                    <p className="mt-2 font-display text-sm font-bold text-white/60">{c.name}</p>
                    <p className="text-[10px] font-bold" style={{ color: RARITY_COLOR[c.rarity] }}>{RARITY_LABEL[c.rarity]}</p>
                    <p className="text-[10px] text-white/40">{getExpansion(c.expansion).code} {String(c.number).padStart(3, '0')}</p>
                  </button>
                ) : (
                  <div className="w-full"><CardView card={c} width={150} className="!w-full" onClick={() => setInspect(c)} /></div>
                )}
                {n > 1 && <span className="absolute -right-1 -top-1 rounded-full bg-berry-400 px-2 py-0.5 text-xs font-extrabold text-[#2a1710] shadow">×{n}</span>}
              </div>
            );
          })}
        </div>
      )}
      <Modal open={!!inspect} onClose={() => setInspect(null)} bare>
        {inspect && (
          <div className="flex flex-col items-center gap-3" onClick={() => setInspect(null)}>
            <CardView card={inspect} width={Math.min(360, window.innerWidth - 40)} tilt />
            <p className="text-sm text-white/70">{signedIn ? `You own ${owned.data[inspect.id] ?? 0}` : RARITY_LABEL[inspect.rarity]} · {getExpansion(inspect.expansion).name}</p>
          </div>
        )}
      </Modal>
    </div>
  );
}
