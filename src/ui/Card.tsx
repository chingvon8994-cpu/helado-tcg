import { memo, useRef, type CSSProperties, type PointerEvent } from 'react';
import { ELEMENT_META } from '../cards/elements';
import { getExpansion } from '../cards/registry';
import { abilityText, attackText } from '../cards/text';
import type { CardDef, Element, Rarity } from '../cards/types';
import { Illustration } from './art/Illustration';
import { Scene } from './art/Scene';

export const artUrl = (image: string) => `/art/creatures/${image}.webp`;

const GLYPHS: Record<Element, string> = {
  verdant: 'M12 3C6 5 4 10 5 18c0 0 1 1 2 0 1-6 4-9 8-11-3 3-5 6-6 11 7 0 10-6 8-15-1 0-3 0-5 0z',
  blaze: 'M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-5 3-6 0 2 1 3 2 3 0-4-1-6 1-9z',
  tide: 'M2 13c3-3 5-3 8 0s5 3 8 0 4-2 4-2v4s-1 2-4 2-5-3-8-3-5 3-8 3zM4 8c3-3 5-3 8 0s5 3 8 0',
  volt: 'M13 2 5 14h6l-2 8 9-13h-6z',
  psyche: 'M12 6C6 6 2 12 2 12s4 6 10 6 10-6 10-6-4-6-10-6zm0 9a3 3 0 1 1 0-6 3 3 0 0 1 0 6z',
  brawl: 'M6 9h11a3 3 0 0 1 3 3v4a5 5 0 0 1-5 5H9a4 4 0 0 1-4-4v-5zm1-4h3v4H7zm4 0h3v4h-3zm4 1h3v3h-3z',
  shade: 'M15 3a9 9 0 1 0 6 15A8 8 0 0 1 15 3z',
  alloy: 'M12 2 21 7v10l-9 5-9-5V7zm0 6a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  wyrm: 'M3 20 12 3l9 17h-4l-5-9-5 9zM12 14l2 4h-4z',
  neutral: 'M12 2l2.6 6.6L21 9l-5 4.5L17.5 21 12 17l-5.5 4L8 13.5 3 9l6.4-.4z',
};

/** Element symbol. `size` in px, or omit to size with the surrounding font (1.25em). */
export function ElementIcon({ el, size, className = '' }: { el: Element; size?: number; className?: string }) {
  const m = ELEMENT_META[el];
  const dim = size ? `${size}px` : '1.25em';
  return (
    <span
      title={m.label}
      className={`inline-flex shrink-0 items-center justify-center rounded-full ${className}`}
      style={{ width: dim, height: dim, background: `radial-gradient(circle at 35% 30%, ${m.light}, ${m.color} 55%, ${m.dark})`, boxShadow: 'inset 0 -1px 2px rgba(0,0,0,.35), 0 1px 2px rgba(0,0,0,.4)' }}
    >
      <svg viewBox="0 0 24 24" className="h-[64%] w-[64%]" fill={el === 'tide' ? 'none' : '#fff'} stroke={el === 'tide' ? '#fff' : 'none'} strokeWidth={el === 'tide' ? 2.4 : 0} strokeLinecap="round">
        <path d={GLYPHS[el]} fillRule="evenodd" />
      </svg>
    </span>
  );
}

const RARITY_MARK: Record<Rarity, string> = {
  common: '◆', uncommon: '◆◆', rare: '◆◆◆', double_rare: '◆◆◆◆', illustration_rare: '★', ultra_rare: '★★', secret_rare: '♛',
};
export const RARITY_LABEL: Record<Rarity, string> = {
  common: 'Common', uncommon: 'Uncommon', rare: 'Rare', double_rare: 'Double Rare', illustration_rare: 'Illustration Rare', ultra_rare: 'Ultra Rare', secret_rare: 'Secret Rare',
};
export const RARITY_COLOR: Record<Rarity, string> = {
  common: '#cfc6b8', uncommon: '#9ff3d4', rare: '#ffd36f', double_rare: '#ffb36f', illustration_rare: '#ff9fcf', ultra_rare: '#a9b8ff', secret_rare: '#ffe27a',
};
const STAGE_LABEL = { basic: 'Basic', stage1: 'Stage 1', stage2: 'Stage 2' } as const;
const KIND_STYLE = {
  item: { label: 'Item', color: '#4f8fe0' }, supporter: { label: 'Supporter', color: '#e06a3c' }, tool: { label: 'Tool', color: '#7f6bd1' }, terrain: { label: 'Terrain', color: '#2fa57a' },
} as const;

interface CardViewProps {
  card: CardDef;
  width?: number;
  tilt?: boolean;
  dim?: boolean;
  className?: string;
  style?: CSSProperties;
  onClick?: () => void;
}

/** Renders any card from its definition. Fully data-driven: new cards need no UI changes. */
export const CardView = memo(function CardView({ card, width = 220, tilt = false, dim = false, className = '', style, onClick }: CardViewProps) {
  const ref = useRef<HTMLDivElement>(null);
  const foil = card.art.foil ?? (card.rarity === 'rare' ? 'holo' : 'none');
  const onMove = (e: PointerEvent) => {
    if (!tilt || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    ref.current.style.setProperty('--mx', `${x * 100}%`);
    ref.current.style.setProperty('--my', `${y * 100}%`);
    ref.current.style.transform = `perspective(900px) rotateY(${(x - 0.5) * 16}deg) rotateX(${(0.5 - y) * 16}deg)`;
  };
  const onLeave = () => {
    if (ref.current) ref.current.style.transform = '';
  };
  const glow = ['double_rare', 'illustration_rare', 'ultra_rare', 'secret_rare'].includes(card.rarity) ? `rarity-glow-${card.rarity}` : '';

  return (
    <div
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      onClick={onClick}
      className={`tcg-card shadow-card transition-transform duration-150 ${glow} ${onClick ? 'cursor-pointer' : ''} ${dim ? 'grayscale opacity-50' : ''} ${className}`}
      style={{ ['--w' as string]: `${width}px`, ...style }}
    >
      {card.category === 'creature' ? <CreatureFace card={card} /> : <TrainerFace card={card} />}
      {foil !== 'none' && <div className={`foil foil-${foil}`} />}
      {(card.rarity === 'secret_rare' || card.rarity === 'ultra_rare' || card.rarity === 'illustration_rare') && <div className="sparkle" />}
    </div>
  );
});

function Cost({ cost, size }: { cost: Element[]; size: string }) {
  return (
    <span className="flex shrink-0 gap-[2%]" style={{ minWidth: `calc(${size} * 2.2)` }}>
      {cost.length === 0 ? <span className="opacity-60" style={{ fontSize: size }}>–</span> : cost.map((c, i) => <ElementIcon key={i} el={c} />)}
    </span>
  );
}

function CreatureFace({ card }: { card: Extract<CardDef, { category: 'creature' }> }) {
  const m = ELEMENT_META[card.element];
  const exp = getExpansion(card.expansion);
  const full = !!card.art.fullArt;
  const frame = card.prime
    ? `linear-gradient(135deg, #ffe9a6, ${m.color} 30%, #fff6d1 50%, ${m.color} 70%, #b58400)`
    : `linear-gradient(160deg, ${m.light}, ${m.color} 45%, ${m.dark})`;
  const art = (
    <div className="absolute inset-0 overflow-hidden">
      <Scene scene={card.art.scene ?? m.scene} className="absolute inset-0 h-full w-full" />
      {card.art.image && (
        <img
          src={artUrl(card.art.image)}
          alt={card.name}
          draggable={false}
          loading="lazy"
          className="absolute left-1/2 top-1/2 max-h-[88%] max-w-[88%] -translate-x-1/2 -translate-y-1/2 object-contain drop-shadow-[0_4px_6px_rgba(0,0,0,.45)]"
          style={{ transform: `translate(-50%, -50%) scale(${card.art.focus?.scale ?? 1})` }}
        />
      )}
    </div>
  );

  const header = (
    <div className="flex items-center gap-[3%] px-[4%] pt-[3%]" style={{ textShadow: full ? '0 1px 3px rgba(0,0,0,.8)' : undefined }}>
      <span className={`rounded-full px-[3%] py-[.5%] text-[0.62em] font-extrabold uppercase tracking-wide ${full ? 'bg-black/40 text-white' : 'bg-black/25 text-white'}`}>{STAGE_LABEL[card.stage]}</span>
      <span className={`min-w-0 flex-1 truncate font-display font-extrabold leading-none ${full ? 'text-white' : 'text-[#2a1710]'}`} style={{ fontSize: card.name.length > 14 ? '0.88em' : card.name.length > 11 ? '1em' : '1.15em' }}>
        {card.name}
      </span>
      <span className={`font-display font-extrabold leading-none ${full ? 'text-white' : 'text-[#2a1710]'}`}><span className="text-[0.6em]">HP</span><span className="text-[1.25em]">{card.hp}</span></span>
      <span className="text-[1.2em] leading-none"><ElementIcon el={card.element} /></span>
    </div>
  );

  const body = (
    <div className={`flex flex-col gap-[3%] px-[5%] ${full ? 'text-white' : 'text-[#2a1710]'}`}>
      {card.ability && (
        <div className="rounded-[0.5em] px-[3%] py-[2%]" style={{ background: full ? 'rgba(180,40,90,.55)' : 'linear-gradient(90deg,#ffd3e6,#ffe9f3)' }}>
          <div className="flex items-center gap-[3%]"><span className="rounded bg-[#c92c7a] px-[2%] text-[0.6em] font-extrabold uppercase text-white">Ability</span><span className="font-display text-[0.95em] font-extrabold">{card.ability.name}</span></div>
          <p className="mt-[1%] text-[0.62em] leading-snug">{abilityText(card.ability)}</p>
        </div>
      )}
      {card.attacks.map((a, i) => {
        const txt = attackText(a);
        return (
          <div key={i}>
            <div className="flex items-center gap-[3%]">
              <Cost cost={a.cost} size="1em" />
              <span className="min-w-0 flex-1 font-display text-[0.98em] font-extrabold leading-none">{a.name}</span>
              {a.damage > 0 || a.damageSuffix ? <span className="font-display text-[1.15em] font-extrabold">{a.damage}{a.damageSuffix ?? ''}</span> : null}
            </div>
            {txt && <p className="mt-[1%] text-[0.6em] leading-snug opacity-90">{txt}</p>}
          </div>
        );
      })}
    </div>
  );

  const footer = (
    <div className={`mt-auto flex items-center gap-[3%] px-[5%] pb-[2.5%] text-[0.58em] font-bold ${full ? 'text-white/90' : 'text-[#2a1710]/80'}`}>
      <span className="flex items-center gap-[1%]">Weak {card.weakness ? <><ElementIcon el={card.weakness} /> +20</> : '—'}</span>
      <span className="flex items-center gap-[1%]">Retreat {card.retreat === 0 ? '—' : Array.from({ length: card.retreat }, (_, i) => <ElementIcon key={i} el="neutral" />)}</span>
      <span className="ml-auto whitespace-nowrap" style={{ color: full ? RARITY_COLOR[card.rarity] : undefined }}>{exp.code} {String(card.number).padStart(3, '0')} {RARITY_MARK[card.rarity]}</span>
    </div>
  );

  if (full) {
    return (
      <div className="absolute inset-0 overflow-hidden rounded-[inherit]" style={{ background: frame, padding: '2.2%' }}>
        <div className="relative h-full w-full overflow-hidden rounded-[0.7em]">
          {art}
          <div className="absolute inset-x-0 top-0">{header}</div>
          {card.prime && <PrimeBadge />}
          <div className="absolute inset-x-0 bottom-0 flex flex-col gap-[2%] bg-gradient-to-t from-black/85 via-black/60 to-transparent pt-[16%]">{body}{footer}</div>
        </div>
      </div>
    );
  }
  return (
    <div className="absolute inset-0 overflow-hidden rounded-[inherit]" style={{ background: frame, padding: '3%' }}>
      <div className="flex h-full flex-col overflow-hidden rounded-[0.6em]" style={{ background: `linear-gradient(180deg, ${m.light} 0%, #fff8ef 35%, #fff8ef 100%)` }}>
        {header}
        <div className="relative mx-[4%] mt-[2%] aspect-[100/70] overflow-hidden rounded-[0.4em] ring-[0.15em] ring-black/20">
          {art}
          {card.prime && <PrimeBadge />}
        </div>
        {card.flavor && <p className="mx-[5%] mt-[1.5%] line-clamp-1 text-center text-[0.5em] italic text-[#2a1710]/60">{card.flavor}</p>}
        <div className="mt-[2%]">{body}</div>
        {footer}
      </div>
    </div>
  );
}

function PrimeBadge() {
  return (
    <span className="absolute right-[3%] top-[18%] rounded-[0.4em] px-[3%] py-[1%] font-display text-[0.8em] font-extrabold italic text-[#2a1710] shadow" style={{ background: 'linear-gradient(135deg,#fff6d1,#ffd36f,#c99a2e)' }}>
      PRIME
    </span>
  );
}

function TrainerFace({ card }: { card: Extract<CardDef, { category: 'trainer' }> }) {
  const k = KIND_STYLE[card.trainerKind];
  const exp = getExpansion(card.expansion);
  return (
    <div className="absolute inset-0 overflow-hidden rounded-[inherit]" style={{ background: 'linear-gradient(160deg,#f6f2ea,#c9c2b4 50%,#8f887a)', padding: '3%' }}>
      <div className="flex h-full flex-col overflow-hidden rounded-[0.6em] bg-[#fffaf2] text-[#2a1710]">
        <div className="flex items-center gap-[3%] px-[4%] pt-[3%]">
          <span className="rounded-full px-[3%] py-[.5%] text-[0.62em] font-extrabold uppercase tracking-wide text-white" style={{ background: k.color }}>{k.label}</span>
          <span className="min-w-0 flex-1 truncate font-display font-extrabold leading-none" style={{ fontSize: card.name.length > 16 ? '0.9em' : '1.1em' }}>{card.name}</span>
        </div>
        <div className="relative mx-[4%] mt-[3%] aspect-[100/70] overflow-hidden rounded-[0.4em] ring-[0.15em] ring-black/15">
          <Illustration name={card.art.illustration ?? card.id} />
        </div>
        <div className="mx-[5%] mt-[4%] rounded-[0.5em] border-[0.12em] px-[4%] py-[3%]" style={{ borderColor: k.color }}>
          <p className="text-[0.72em] font-semibold leading-snug">{card.text}</p>
        </div>
        {card.trainerKind === 'supporter' && <p className="mx-[5%] mt-[2%] text-[0.5em] opacity-60">You may play only 1 Supporter card during your turn.</p>}
        {card.trainerKind === 'tool' && <p className="mx-[5%] mt-[2%] text-[0.5em] opacity-60">Attach to 1 of your creatures. Each creature may hold 1 Tool.</p>}
        {card.trainerKind === 'terrain' && <p className="mx-[5%] mt-[2%] text-[0.5em] opacity-60">Stays in play until another Terrain replaces it.</p>}
        <div className="mt-auto flex px-[5%] pb-[2.5%] text-[0.58em] font-bold opacity-80">
          <span className="ml-auto">{exp.code} {String(card.number).padStart(3, '0')} {RARITY_MARK[card.rarity]}</span>
        </div>
      </div>
    </div>
  );
}

export function CardBack({ width = 120, className = '' }: { width?: number; className?: string }) {
  return (
    <div className={`tcg-card shadow-card ${className}`} style={{ ['--w' as string]: `${width}px` }}>
      <div className="absolute inset-0 overflow-hidden rounded-[inherit] p-[5%]" style={{ background: 'linear-gradient(160deg,#4a2a1c,#2a1710)' }}>
        <div className="checker relative flex h-full w-full items-center justify-center overflow-hidden rounded-[0.6em] border-[0.15em] border-[#e9b06d]/70" style={{ background: 'radial-gradient(circle at 50% 40%, #ff8cc6, #c92c7a 70%)' }}>
          <svg viewBox="0 0 64 64" className="w-[55%] drop-shadow-lg">
            <path d="M20 30 L32 60 L44 30 Z" fill="#e9b06d" stroke="#663917" strokeWidth="2" />
            <circle cx="32" cy="22" r="14" fill="#fff6e9" /><circle cx="23" cy="27" r="8" fill="#ffd3e6" /><circle cx="41" cy="27" r="8" fill="#9ff3d4" /><circle cx="32" cy="9" r="4" fill="#e0204a" />
          </svg>
          <span className="absolute bottom-[6%] font-display text-[0.8em] font-extrabold tracking-widest text-white/90">HELADO</span>
        </div>
      </div>
    </div>
  );
}
