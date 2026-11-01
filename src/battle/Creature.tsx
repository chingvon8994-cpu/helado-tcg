import { AnimatePresence, motion } from 'framer-motion';
import { ELEMENT_META } from '../cards/elements';
import { getCard, getCreature } from '../cards/registry';
import type { Status } from '../cards/types';
import type { InPlayCreature } from '../engine';
import { ElementIcon, artUrl } from '../ui/Card';
import { Scene } from '../ui/art/Scene';

export const STATUS_STYLE: Record<Status, { label: string; color: string; icon: string }> = {
  asleep: { label: 'Asleep', color: '#6f7dff', icon: 'Zz' },
  paralyzed: { label: 'Paralyzed', color: '#ffc21a', icon: 'ϟ' },
  poisoned: { label: 'Poisoned', color: '#9b4fd8', icon: '☠' },
  burned: { label: 'Burned', color: '#ff5a1f', icon: '♨' },
  confused: { label: 'Confused', color: '#e04fd8', icon: '?' },
};

export interface Fx { damage?: number; heal?: number; ko?: boolean; lunge?: 'up' | 'down'; key: number }

export function CreatureToken({
  c, hp, size, targetable, selected, onClick, fx, active,
}: { c: InPlayCreature; hp: number; size: number; targetable?: boolean; selected?: boolean; onClick?: () => void; fx?: Fx; active?: boolean }) {
  const def = getCreature(c.cardId);
  const m = ELEMENT_META[def.element];
  const left = Math.max(0, hp - c.damage);
  const pct = Math.max(0, Math.min(100, (left / hp) * 100));
  const tool = c.tool ? getCard(c.tool.cardId) : null;
  return (
    <motion.div
      layoutId={c.stack[0].uid}
      onClick={onClick}
      animate={fx?.lunge ? { y: [0, fx.lunge === 'up' ? -28 : 28, 0], scale: [1, 1.08, 1] } : { y: 0 }}
      transition={{ duration: 0.45 }}
      className={`relative shrink-0 cursor-pointer select-none rounded-2xl ${targetable ? 'target-pulse' : ''} ${selected ? 'ring-4 ring-berry-400' : ''} ${fx?.damage ? 'shake' : ''}`}
      style={{ width: size, background: def.prime ? 'linear-gradient(135deg,#fff6d1,#ffd36f,#c99a2e)' : `linear-gradient(160deg, ${m.light}, ${m.color} 50%, ${m.dark})`, padding: size * 0.035 }}
    >
      <div className="overflow-hidden rounded-[12px] bg-[#fff8ef] text-[#2a1710]">
        <div className="flex items-center gap-1 px-1.5 pt-1" style={{ fontSize: Math.max(9, size * 0.085) }}>
          <span className="min-w-0 flex-1 truncate font-display font-extrabold leading-tight">{def.name}</span>
          <ElementIcon el={def.element} size={Math.max(12, size * 0.11)} />
        </div>
        <div className="relative mx-1 mt-0.5 aspect-[100/70] overflow-hidden rounded-lg">
          <Scene scene={def.art.scene ?? m.scene} className="absolute inset-0 h-full w-full" />
          {def.art.image && <img src={artUrl(def.art.image)} alt={def.name} draggable={false} className="absolute inset-0 m-auto max-h-[90%] max-w-[90%] object-contain drop-shadow" />}
          {def.prime && <span className="absolute right-1 top-1 rounded bg-[#ffd36f] px-1 text-[9px] font-extrabold italic">PRIME</span>}
          {tool && <span title={tool.name} className="absolute bottom-1 left-1 rounded-md bg-[#7f6bd1] px-1 text-[9px] font-bold text-white">⚙ {tool.name}</span>}
        </div>
        <div className="px-1.5 pb-1 pt-1">
          <div className="h-2 overflow-hidden rounded-full bg-black/15">
            <motion.div className="h-full rounded-full" animate={{ width: `${pct}%` }} style={{ background: pct > 50 ? '#2fc595' : pct > 25 ? '#ffc21a' : '#ff4b4b' }} />
          </div>
          <div className="mt-0.5 flex items-center justify-between font-display font-extrabold" style={{ fontSize: Math.max(10, size * 0.09) }}>
            <span>{left}<span className="opacity-50">/{hp}</span></span>
            <span className="flex flex-wrap justify-end gap-0.5">{c.energy.map((e, i) => <ElementIcon key={i} el={e} size={Math.max(11, size * 0.1)} />)}</span>
          </div>
        </div>
      </div>
      {c.status.length > 0 && (
        <div className="absolute -left-2 top-1/3 flex flex-col gap-1">
          {c.status.map((st) => (
            <span key={st} title={STATUS_STYLE[st].label} className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-extrabold text-white shadow ring-2 ring-white" style={{ background: STATUS_STYLE[st].color }}>{STATUS_STYLE[st].icon}</span>
          ))}
        </div>
      )}
      {active && c.effects.length > 0 && (
        <span className="absolute -right-2 top-1/3 rounded-full bg-sky-500 px-1.5 py-0.5 text-[10px] font-bold text-white shadow" title={c.effects.map((e) => e.kind).join(', ')}>✦{c.effects.length}</span>
      )}
      <AnimatePresence>
        {fx?.damage ? (
          <motion.span key={`d${fx.key}`} initial={{ opacity: 0, y: 0, scale: 0.6 }} animate={{ opacity: 1, y: -40, scale: 1.3 }} exit={{ opacity: 0 }} transition={{ duration: 0.8 }} className="pointer-events-none absolute inset-x-0 top-1/3 text-center font-display text-3xl font-extrabold text-red-500 [text-shadow:0_2px_0_#fff,0_0_10px_#fff]">
            -{fx.damage}
          </motion.span>
        ) : null}
        {fx?.heal ? (
          <motion.span key={`h${fx.key}`} initial={{ opacity: 0, y: 0 }} animate={{ opacity: 1, y: -36 }} exit={{ opacity: 0 }} transition={{ duration: 0.8 }} className="pointer-events-none absolute inset-x-0 top-1/3 text-center font-display text-2xl font-extrabold text-mint-400 [text-shadow:0_2px_0_#10291f]">
            +{fx.heal}
          </motion.span>
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
}

export function EmptySlot({ size, targetable, onClick, label }: { size: number; targetable?: boolean; onClick?: () => void; label?: string }) {
  return (
    <div onClick={onClick} className={`flex shrink-0 items-center justify-center rounded-2xl border-2 border-dashed text-center text-[11px] font-bold ${targetable ? 'target-pulse cursor-pointer border-mint-400 text-mint-300' : 'border-white/15 text-white/25'}`} style={{ width: size, aspectRatio: '0.94' }}>
      {label}
    </div>
  );
}
