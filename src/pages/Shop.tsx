import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { EXPANSIONS, cardsInExpansion, getCard } from '../cards/registry';
import type { CardDef, ExpansionDef, Rarity } from '../cards/types';
import { slotOdds } from '../economy/packs';
import { api } from '../lib/api';
import { useAuth } from '../state/auth';
import { useCollection, usePackHistory } from '../state/data';
import { CardBack, CardView, RARITY_COLOR, RARITY_LABEL, artUrl } from '../ui/Card';
import { Scene } from '../ui/art/Scene';
import { Confirm, Modal, Scoops, SectionTitle, useToast } from '../ui/kit';

export function PackArt({ exp, width = 200, onClick }: { exp: ExpansionDef; width?: number; onClick?: () => void }) {
  return (
    <motion.div whileHover={{ y: -6, rotate: -1 }} onClick={onClick} className="relative cursor-pointer select-none" style={{ width, aspectRatio: '0.62' }}>
      <div className="absolute inset-0 overflow-hidden rounded-[18px] shadow-card" style={{ background: `linear-gradient(160deg, ${exp.theme.accent}, ${exp.theme.primary} 40%, ${exp.theme.secondary})` }}>
        <div className="absolute inset-x-0 top-0 h-[7%] bg-[repeating-linear-gradient(90deg,rgba(0,0,0,.25)_0_6px,transparent_6px_12px)]" />
        <div className="absolute inset-x-0 bottom-0 h-[7%] bg-[repeating-linear-gradient(90deg,rgba(0,0,0,.25)_0_6px,transparent_6px_12px)]" />
        <div className="absolute inset-[9%_7%_26%] overflow-hidden rounded-xl ring-2 ring-white/50">
          <Scene scene={exp.packArt.scene} className="absolute inset-0 h-full w-full" />
          {exp.packArt.featured.map((img, i) => (
            <img key={img} src={artUrl(img)} alt="" className="absolute object-contain drop-shadow-lg" style={{ height: i === 0 ? '78%' : '48%', left: i === 0 ? '18%' : i === 1 ? '-6%' : '58%', bottom: i === 0 ? '6%' : '2%', zIndex: i === 0 ? 2 : 1 }} />
          ))}
        </div>
        <div className="absolute inset-x-0 bottom-[9%] text-center">
          <p className="text-[10px] font-extrabold uppercase tracking-[.3em] text-white/80">Helado TCG · {exp.code}</p>
          <p className="font-display text-3xl font-extrabold leading-none text-white [text-shadow:0_3px_0_rgba(0,0,0,.35)]">{exp.name}</p>
        </div>
        <div className="foil foil-holo" style={{ opacity: 0.35 }} />
      </div>
    </motion.div>
  );
}

const BURST: Partial<Record<Rarity, string>> = { rare: '#ffd36f', double_rare: '#ffb36f', illustration_rare: '#ff9fcf', ultra_rare: '#a9b8ff', secret_rare: '#ffe27a' };

function PackOpening({ exp, cards, newIds, onDone, onAgain }: { exp: ExpansionDef; cards: CardDef[]; newIds: Set<string>; onDone: () => void; onAgain: () => void }) {
  const [stage, setStage] = useState<'pack' | 'reveal' | 'summary'>('pack');
  const [revealed, setRevealed] = useState(0);
  const w = Math.min(280, window.innerWidth - 80);
  // Reveal order: commons first, best card last for suspense.
  const order = cards;
  const current = order[revealed];
  const next = () => (revealed + 1 >= order.length ? setStage('summary') : setRevealed(revealed + 1));

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/85 backdrop-blur" onClick={() => stage === 'reveal' && next()}>
      <AnimatePresence mode="wait">
        {stage === 'pack' && (
          <motion.div key="pack" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1, rotate: [0, -2, 2, -2, 0] }} exit={{ scale: 1.4, opacity: 0, filter: 'brightness(3)' }} transition={{ rotate: { repeat: Infinity, duration: 1.2 } }} className="flex flex-col items-center gap-6" onClick={(e) => { e.stopPropagation(); setStage('reveal'); }}>
            <PackArt exp={exp} width={w * 0.95} />
            <p className="animate-pulse font-display text-xl font-bold">Tap to open!</p>
          </motion.div>
        )}
        {stage === 'reveal' && current && (
          <motion.div key={`c${revealed}`} className="relative flex flex-col items-center gap-4" initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ x: -260, opacity: 0, rotate: -12 }}>
            {BURST[current.rarity] && (
              <motion.div className="pointer-events-none absolute left-1/2 top-[45%] -z-10 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full" initial={{ scale: 0, opacity: 0 }} animate={{ scale: [0, 1.2, 1], opacity: [0, 0.9, 0.6], rotate: 180 }} transition={{ duration: 1.2, delay: 0.35 }} style={{ background: `conic-gradient(from 0deg, transparent, ${BURST[current.rarity]}, transparent 30%, ${BURST[current.rarity]} 50%, transparent 70%, ${BURST[current.rarity]})`, filter: 'blur(18px)' }} />
            )}
            <motion.div initial={{ rotateY: 180 }} animate={{ rotateY: 0 }} transition={{ duration: 0.55, delay: 0.15 }} style={{ transformStyle: 'preserve-3d' }} className="relative">
              <CardView card={current} width={w} tilt />
              {newIds.has(current.id) && <span className="absolute -right-3 -top-3 rotate-12 rounded-full bg-mint-400 px-3 py-1 font-display text-lg font-extrabold text-[#10291f] shadow-card">NEW!</span>}
            </motion.div>
            <p className="font-display text-xl font-bold" style={{ color: RARITY_COLOR[current.rarity] }}>{RARITY_LABEL[current.rarity]}</p>
            <div className="flex gap-1.5">{order.map((_, i) => <span key={i} className={`h-2 w-2 rounded-full ${i <= revealed ? 'bg-white' : 'bg-white/25'}`} />)}</div>
            <p className="text-xs text-white/60">Tap to continue</p>
          </motion.div>
        )}
        {stage === 'summary' && (
          <motion.div key="sum" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex max-h-full flex-col items-center gap-5 overflow-auto p-4" onClick={(e) => e.stopPropagation()}>
            <p className="font-display text-3xl font-extrabold">Your pulls</p>
            <div className="flex flex-wrap justify-center gap-3">
              {order.map((c, i) => (
                <motion.div key={i} initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: i * 0.08 }} className="relative">
                  <CardView card={c} width={Math.min(150, (window.innerWidth - 60) / 3)} />
                  {newIds.has(c.id) && <span className="absolute -right-2 -top-2 rounded-full bg-mint-400 px-2 text-xs font-extrabold text-[#10291f]">NEW</span>}
                </motion.div>
              ))}
            </div>
            <div className="flex gap-3">
              <button className="btn-ghost" onClick={onDone}>Done</button>
              <button className="btn-primary" onClick={onAgain}>Open another · <Scoops n={exp.packPrice} /></button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {stage === 'reveal' && <button className="absolute right-4 top-4 btn-ghost !py-1.5 text-sm" onClick={(e) => { e.stopPropagation(); setStage('summary'); }}>Skip</button>}
    </div>
  );
}

export default function Shop() {
  const { summary, setScoops } = useAuth();
  const toast = useToast();
  const owned = useCollection();
  const history = usePackHistory(10);
  const [confirm, setConfirm] = useState<ExpansionDef | null>(null);
  const [opening, setOpening] = useState<{ exp: ExpansionDef; cards: CardDef[]; newIds: Set<string> } | null>(null);
  const [odds, setOdds] = useState<ExpansionDef | null>(null);
  const [busy, setBusy] = useState(false);

  const buy = async (exp: ExpansionDef) => {
    setConfirm(null);
    setBusy(true);
    try {
      const before = owned.data;
      const r = await api<{ cards: string[]; scoops: number; unlocked: string[] }>('shop.openPack', { expansionId: exp.id });
      setScoops(r.scoops);
      const cards = r.cards.map(getCard);
      const newIds = new Set(cards.filter((c) => !before[c.id]).map((c) => c.id));
      setOpening({ exp, cards, newIds });
      owned.reload();
      history.reload();
      if (r.unlocked.length) toast(`Achievement unlocked! (+Scoops)`, 'success');
    } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-8">
      <SectionTitle right={summary && <span className="rounded-full bg-black/30 px-3 py-1.5"><Scoops n={summary.scoops} /></span>}>Card Shop</SectionTitle>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {EXPANSIONS.map((exp) => {
          const pool = cardsInExpansion(exp.id);
          const have = pool.filter((c) => owned.data[c.id]).length;
          const afford = (summary?.scoops ?? 0) >= exp.packPrice;
          return (
            <div key={exp.id} className="panel flex flex-col items-center gap-4 p-5">
              <PackArt exp={exp} width={190} onClick={() => afford && setConfirm(exp)} />
              <p className="text-center text-sm text-white/70">{exp.tagline}</p>
              <p className="text-xs font-bold text-white/50">{pool.length} cards · you own {have}</p>
              <div className="flex w-full gap-2">
                <button className="btn-ghost text-sm" onClick={() => setOdds(exp)}>Odds</button>
                <button className="btn-primary flex-1" disabled={!afford || busy} onClick={() => setConfirm(exp)}>Buy · <Scoops n={exp.packPrice} /></button>
              </div>
            </div>
          );
        })}
      </div>

      <section>
        <SectionTitle>Pack history</SectionTitle>
        {history.data.length === 0 ? <p className="text-sm text-white/60">No packs opened yet.</p> : (
          <div className="space-y-2">
            {history.data.map((p) => (
              <div key={p.id} className="panel flex items-center gap-3 overflow-x-auto p-3">
                <div className="w-28 shrink-0"><p className="font-display font-bold">{EXPANSIONS.find((e) => e.id === p.expansion_id)?.name}</p><p className="text-[11px] text-white/50">{new Date(p.created_at).toLocaleString()}</p></div>
                {p.cards.map((cid, i) => <CardView key={i} card={getCard(cid)} width={64} />)}
              </div>
            ))}
          </div>
        )}
      </section>

      <Confirm open={!!confirm} title={`Open a ${confirm?.name} pack?`} body={<>This costs <Scoops n={confirm?.packPrice ?? 0} />. Each pack contains 5 cards.</>} confirmLabel="Open pack" onCancel={() => setConfirm(null)} onConfirm={() => buy(confirm!)} />
      <Modal open={!!odds} onClose={() => setOdds(null)}>
        {odds && (
          <div>
            <h3 className="font-display text-2xl font-bold">{odds.name} pull rates</h3>
            <p className="text-xs text-white/60">Rolled on the server. Each card of a rarity is equally likely.</p>
            <div className="mt-3 space-y-2">
              {slotOdds(odds.id).map((slot, i) => (
                <div key={i} className="rounded-xl bg-black/25 p-2 text-sm">
                  <p className="font-bold">Card {i + 1}</p>
                  <div className="flex flex-wrap gap-x-3">{slot.map((s) => <span key={s.rarity} style={{ color: RARITY_COLOR[s.rarity] }}>{RARITY_LABEL[s.rarity]} {s.pct.toFixed(s.pct < 1 ? 2 : 1)}%</span>)}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>
      {opening && <PackOpening key={opening.cards.map((c) => c.id).join()} exp={opening.exp} cards={opening.cards} newIds={opening.newIds} onDone={() => setOpening(null)} onAgain={() => { const e = opening.exp; setOpening(null); buy(e); }} />}
      {busy && <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50"><CardBack width={120} className="animate-bounce" /></div>}
    </div>
  );
}
