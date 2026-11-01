import { useId, type ReactNode } from 'react';
import { Scene } from './Scene';

/**
 * Vector illustrations for Trainer cards. Items/tools/terrains are drawn objects; Supporters use a
 * stylised character-portrait emblem (a bust silhouette with a signature outfit and accessory).
 * NOTE: Supporter portraits are emblem art — bespoke character paintings are listed as pending in
 * docs/ART.md.
 */

function Frame({ a, b, children }: { a: string; b: string; children: ReactNode }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg viewBox="0 0 100 70" preserveAspectRatio="xMidYMid slice" className="h-full w-full">
      <defs>
        <radialGradient id={`${id}bg`} cx="50%" cy="40%" r="75%"><stop offset="0" stopColor={a} /><stop offset="1" stopColor={b} /></radialGradient>
      </defs>
      <rect width="100" height="70" fill={`url(#${id}bg)`} />
      {Array.from({ length: 10 }, (_, i) => <circle key={i} cx={(i * 31) % 100} cy={(i * 17) % 70} r=".9" fill="#fff" opacity=".35" />)}
      {children}
    </svg>
  );
}

interface PortraitSpec { skin: string; hair: string; outfit: string; accent: string; bg: [string, string]; hat?: 'chef' | 'cap' | 'beret' | 'ranger' | 'captain' | 'bun' | 'none'; extra?: 'glasses' | 'mask' | 'scarf' | 'apron' | 'whistle' | 'telescope' | 'book' }

function Portrait({ p }: { p: PortraitSpec }) {
  return (
    <Frame a={p.bg[0]} b={p.bg[1]}>
      <circle cx="50" cy="35" r="30" fill="#fff" opacity=".12" />
      {/* shoulders */}
      <path d="M22 72 Q24 50 50 48 Q76 50 78 72Z" fill={p.outfit} />
      <path d="M44 48 L50 58 L56 48Z" fill={p.accent} />
      {p.extra === 'apron' && <path d="M38 56 H62 V72 H38Z" fill="#fff" opacity=".9" />}
      {p.extra === 'scarf' && <path d="M38 47 Q50 54 62 47 L60 52 Q50 58 40 52Z" fill={p.accent} />}
      {p.extra === 'whistle' && <><path d="M44 48 Q50 60 56 48" stroke="#fff" strokeWidth=".8" fill="none" /><rect x="48" y="58" width="5" height="3" rx="1" fill="#ffd36f" /></>}
      {/* neck + head */}
      <rect x="45" y="38" width="10" height="11" rx="3" fill={p.skin} />
      <ellipse cx="50" cy="30" rx="12" ry="13.5" fill={p.skin} />
      <path d="M38 28 Q39 14 50 15 Q61 14 62 28 Q57 21 50 22 Q43 21 38 28Z" fill={p.hair} />
      {p.hat === 'bun' && <circle cx="50" cy="13" r="5" fill={p.hair} />}
      {p.hat === 'chef' && <path d="M38 20 Q36 8 44 9 Q46 3 52 5 Q60 3 61 10 Q66 12 62 20Z" fill="#fff" />}
      {p.hat === 'cap' && <><path d="M37 22 Q38 12 50 12 Q62 12 63 22Z" fill={p.accent} /><path d="M58 21 Q68 21 70 24 L58 24Z" fill={p.accent} /></>}
      {p.hat === 'beret' && <ellipse cx="48" cy="17" rx="14" ry="5" fill={p.accent} />}
      {p.hat === 'ranger' && <><ellipse cx="50" cy="20" rx="20" ry="3.5" fill="#7a5530" /><path d="M41 20 Q42 10 50 10 Q58 10 59 20Z" fill="#9b6d3d" /></>}
      {p.hat === 'captain' && <><path d="M38 21 Q38 11 50 11 Q62 11 62 21Z" fill="#f4f1ea" /><rect x="37" y="19" width="26" height="3.5" rx="1" fill="#1d2a4a" /><circle cx="50" cy="15" r="2" fill="#ffd36f" /></>}
      {/* face */}
      <circle cx="45.5" cy="31" r="1.3" fill="#2a1710" />
      <circle cx="54.5" cy="31" r="1.3" fill="#2a1710" />
      <path d="M46.5 36 Q50 38.5 53.5 36" stroke="#2a1710" strokeWidth=".9" fill="none" strokeLinecap="round" />
      <circle cx="43" cy="35" r="1.6" fill="#ff8c9c" opacity=".5" />
      <circle cx="57" cy="35" r="1.6" fill="#ff8c9c" opacity=".5" />
      {p.extra === 'glasses' && <g fill="none" stroke="#2a1710" strokeWidth=".9"><circle cx="45.5" cy="31" r="3.2" /><circle cx="54.5" cy="31" r="3.2" /><path d="M48.7 31 H51.3" /></g>}
      {p.extra === 'mask' && <path d="M39 28 Q50 25 61 28 L60 33 Q55 31 50 33 Q45 31 40 33Z" fill="#1d1430" />}
      {p.extra === 'telescope' && <g transform="rotate(-25 74 46)"><rect x="64" y="42" width="22" height="6" rx="2" fill="#c99a2e" /><rect x="84" y="41" width="4" height="8" rx="1" fill="#8f6a1c" /></g>}
      {p.extra === 'book' && <g><rect x="62" y="52" width="14" height="11" rx="1" fill="#5a3f8f" /><path d="M69 52 V63" stroke="#d3c6f2" strokeWidth=".8" /></g>}
    </Frame>
  );
}

const PORTRAITS: Record<string, PortraitSpec> = {
  nieve: { skin: '#f3c9a8', hair: '#f4f1ea', outfit: '#ff8cc6', accent: '#ffd36f', bg: ['#ffe3ef', '#ff9fcf'], hat: 'bun', extra: 'apron' },
  rocky: { skin: '#c98d62', hair: '#3b2216', outfit: '#d94b3c', accent: '#fff', bg: ['#ffd9a8', '#e86a3c'], hat: 'cap', extra: 'whistle' },
  menta: { skin: '#f0c4a0', hair: '#1f6b52', outfit: '#2fc595', accent: '#9ff3d4', bg: ['#d8fff0', '#2fc595'], hat: 'beret', extra: 'scarf' },
  tamarindo: { skin: '#a8714a', hair: '#2a1710', outfit: '#6a8f3a', accent: '#c4692d', bg: ['#e9f5c9', '#6fc15a'], hat: 'ranger', extra: 'scarf' },
  horchata: { skin: '#e8b996', hair: '#7a4b2a', outfit: '#f4f1ea', accent: '#d58c3f', bg: ['#fff6e9', '#e9b06d'], hat: 'chef', extra: 'apron' },
  paleta: { skin: '#d9a07a', hair: '#151018', outfit: '#3b2a52', accent: '#ff6fb5', bg: ['#3b2a52', '#120a22'], hat: 'none', extra: 'mask' },
  nuez: { skin: '#b5835e', hair: '#5a3f2a', outfit: '#1d2a6b', accent: '#c99a2e', bg: ['#2a2f7a', '#05061a'], hat: 'none', extra: 'telescope' },
  vainilla: { skin: '#f6d6bd', hair: '#e9d18a', outfit: '#8f6bd1', accent: '#f3e6ff', bg: ['#f3e6ff', '#8f6bd1'], hat: 'bun', extra: 'book' },
  pistacho: { skin: '#e2b08c', hair: '#4a7d3a', outfit: '#1d2a4a', accent: '#9fe07a', bg: ['#c9f5b8', '#2a6b52'], hat: 'captain', extra: 'glasses' },
};

const ITEMS: Record<string, () => ReactNode> = {
  salve: () => (
    <Frame a="#fff1f8" b="#ff9fcf">
      <path d="M36 34 H64 L60 60 Q50 64 40 60Z" fill="#fff" stroke="#d6a07a" strokeWidth="1.2" />
      <path d="M33 34 Q50 28 67 34" stroke="#e9b06d" strokeWidth="3" fill="none" />
      <circle cx="42" cy="26" r="8" fill="#ffb3d6" /><circle cx="58" cy="26" r="8" fill="#9ff3d4" /><circle cx="50" cy="20" r="9" fill="#fff3c2" />
      <circle cx="50" cy="10" r="3" fill="#e0204a" /><path d="M50 7 Q53 2 57 3" stroke="#3b7d2a" strokeWidth=".8" fill="none" />
      <path d="M45 46 H55 M50 41 V51" stroke="#ff6fb5" strokeWidth="3" strokeLinecap="round" />
    </Frame>
  ),
  scope: () => (
    <Frame a="#e5f6ff" b="#6fc8ff">
      <circle cx="44" cy="32" r="16" fill="#cdeeff" stroke="#3b2216" strokeWidth="3" />
      {['#ff6fb5', '#ffd36f', '#5fe3b5', '#6f9bff', '#fff'].map((c, i) => <rect key={i} x={36 + i * 4} y={26 + (i % 2) * 8} width="4" height="1.6" rx=".8" fill={c} transform={`rotate(${i * 35} ${38 + i * 4} ${27 + (i % 2) * 8})`} />)}
      <path d="M56 44 L70 58" stroke="#3b2216" strokeWidth="6" strokeLinecap="round" />
      <path d="M36 22 Q40 18 46 19" stroke="#fff" strokeWidth="1.5" fill="none" opacity=".8" />
    </Frame>
  ),
  spoon: () => (
    <Frame a="#fff6e9" b="#e9b06d">
      <g transform="rotate(-30 50 35)">
        <ellipse cx="50" cy="20" rx="9" ry="12" fill="#ff8cc6" stroke="#c92c7a" strokeWidth="1" />
        <rect x="48" y="30" width="4" height="30" rx="2" fill="#ff8cc6" stroke="#c92c7a" strokeWidth="1" />
      </g>
      <path d="M20 50 Q30 40 40 50" stroke="#fff" strokeWidth="2" fill="none" markerEnd="" />
      <path d="M62 22 Q72 14 80 22" stroke="#fff" strokeWidth="2" fill="none" />
      <path d="M38 48 l3 4 l-5 0Z M80 22 l-1 5 l-4 -3Z" fill="#fff" />
    </Frame>
  ),
  bell: () => (
    <Frame a="#e9f8ff" b="#7cc4ef">
      <path d="M36 50 Q36 24 50 22 Q64 24 64 50Z" fill="#bfe8fb" stroke="#3b6e9c" strokeWidth="1.5" />
      <rect x="32" y="49" width="36" height="5" rx="2.5" fill="#3b6e9c" />
      <circle cx="50" cy="58" r="3.5" fill="#ffd36f" />
      <path d="M50 22 V16" stroke="#3b6e9c" strokeWidth="2" />
      <text x="70" y="22" fontSize="8" fill="#fff" fontWeight="bold">z</text><text x="76" y="15" fontSize="6" fill="#fff" fontWeight="bold">z</text>
      {[20, 80, 26, 74].map((x, i) => <path key={i} d={`M${x} ${30 + i * 5} l2 -2 l2 2 l-2 2Z`} fill="#fff" />)}
    </Frame>
  ),
  pouch: () => (
    <Frame a="#ffe9d1" b="#b86c26">
      <path d="M32 34 Q30 60 50 60 Q70 60 68 34 Q60 30 50 31 Q40 30 32 34Z" fill="#7a3f1d" />
      <path d="M34 34 Q50 26 66 34" stroke="#ffd36f" strokeWidth="2.5" fill="none" />
      {[[42, 26], [50, 23], [58, 26]].map(([x, y], i) => <rect key={i} x={x - 4} y={y - 4} width="8" height="8" rx="1.5" fill="#4a2410" stroke="#2a1710" />)}
    </Frame>
  ),
  waffle: () => (
    <Frame a="#fff6e9" b="#ffd6b0">
      <path d="M30 18 L50 62 L70 18Z" fill="#e9b06d" stroke="#8f511c" strokeWidth="1.5" />
      {[24, 32, 40].map((y) => <path key={y} d={`M${30 + (y - 18) * 0.45} ${y} H${70 - (y - 18) * 0.45}`} stroke="#b86c26" strokeWidth="1" />)}
      {[0, 1, 2, 3].map((i) => <path key={i} d={`M${36 + i * 8} 18 L${50} 62`} stroke="#b86c26" strokeWidth=".8" />)}
      <path d="M26 18 Q50 6 74 18 L72 22 Q50 12 28 22Z" fill="#5fe3b5" opacity=".9" />
    </Frame>
  ),
  cherry: () => (
    <Frame a="#ffe3ef" b="#ff6f91">
      <path d="M44 22 Q50 8 64 10" stroke="#3b7d2a" strokeWidth="1.6" fill="none" />
      <path d="M58 26 Q60 14 64 10" stroke="#3b7d2a" strokeWidth="1.6" fill="none" />
      <path d="M64 10 Q74 6 76 12 Q70 14 64 10Z" fill="#5fbf4a" />
      <circle cx="42" cy="36" r="11" fill="#e0204a" /><circle cx="60" cy="38" r="11" fill="#c8102e" />
      <circle cx="38" cy="32" r="3" fill="#fff" opacity=".6" /><circle cx="56" cy="34" r="3" fill="#fff" opacity=".6" />
    </Frame>
  ),
  trailmix: () => (
    <Frame a="#fff1d6" b="#c4692d">
      <path d="M30 30 H70 L66 62 H34Z" fill="#f4f1ea" stroke="#8f511c" strokeWidth="1" />
      <path d="M30 30 H70 V36 H30Z" fill="#c4692d" />
      {[[40, 26, '#7a3f1d'], [48, 24, '#ffd36f'], [56, 25, '#e0204a'], [62, 27, '#7a3f1d'], [44, 22, '#5fe3b5']].map(([x, y, c], i) => <ellipse key={i} cx={x as number} cy={y as number} rx="3.5" ry="2.5" fill={c as string} />)}
      <text x="50" y="52" fontSize="7" textAnchor="middle" fill="#8f511c" fontWeight="bold">MIX</text>
    </Frame>
  ),
  compass: () => (
    <Frame a="#f1ffe0" b="#5fbf4a">
      <circle cx="50" cy="36" r="20" fill="#ffd36f" stroke="#8f6a1c" strokeWidth="2" />
      <circle cx="50" cy="36" r="16" fill="#fff6e9" />
      <path d="M50 22 L54 36 L50 50 L46 36Z" fill="#e0204a" />
      <path d="M50 36 L54 36 L50 50 L46 36Z" fill="#3b2216" />
      <circle cx="50" cy="36" r="2" fill="#8f6a1c" />
      <path d="M36 36 h2 M62 36 h2 M50 22 v-2" stroke="#8f6a1c" strokeWidth="1" />
    </Frame>
  ),
  lasso: () => (
    <Frame a="#fff1d6" b="#a8521f">
      <ellipse cx="50" cy="32" rx="22" ry="12" fill="none" stroke="#e9b06d" strokeWidth="3" />
      <ellipse cx="50" cy="32" rx="22" ry="12" fill="none" stroke="#8f511c" strokeWidth="1" strokeDasharray="2 2" />
      <path d="M68 38 Q78 52 64 64" stroke="#e9b06d" strokeWidth="3" fill="none" />
      <path d="M44 20 l12 0 l-6 -8Z" fill="#ff6fb5" />
    </Frame>
  ),
  canteen: () => (
    <Frame a="#ffe2c4" b="#ff5a1f">
      <circle cx="50" cy="40" r="17" fill="#6b4a2a" stroke="#3b2216" strokeWidth="1.5" />
      <circle cx="50" cy="40" r="12" fill="#ff7a3c" />
      <path d="M50 30 Q56 38 50 48 Q44 38 50 30Z" fill="#ffd36f" />
      <rect x="46" y="18" width="8" height="6" rx="1" fill="#3b2216" />
      <path d="M33 30 Q30 14 50 14 Q70 14 67 30" stroke="#a8521f" strokeWidth="2" fill="none" />
    </Frame>
  ),
  collar: () => (
    <Frame a="#ede6ff" b="#6c4bb5">
      <ellipse cx="50" cy="38" rx="22" ry="10" fill="none" stroke="#2a1a52" strokeWidth="6" />
      {[-18, -9, 0, 9, 18].map((dx, i) => <path key={i} d={`M${50 + dx - 2} ${46 + Math.abs(dx) * -0.2} l2 7 l2 -7Z`} fill="#dde8ec" />)}
      <circle cx="50" cy="49" r="3" fill="#ffd36f" />
    </Frame>
  ),
  saddle: () => (
    <Frame a="#f2fbff" b="#a9c7ff">
      <path d="M26 44 Q50 22 74 44 Q50 52 26 44Z" fill="#c4692d" stroke="#7a3912" strokeWidth="1.2" />
      {[0, 1, 2].map((i) => <path key={i} d={`M${34 + i * 12} 30 q8 -14 14 -6 q-6 2 -14 6Z`} fill="#fff" stroke="#c9d6dc" strokeWidth=".6" />)}
    </Frame>
  ),
  sorbet: () => (
    <Frame a="#1d1a55" b="#05061a">
      {Array.from({ length: 18 }, (_, i) => <circle key={i} cx={(i * 37) % 100} cy={(i * 19) % 70} r=".7" fill="#fff" />)}
      <path d="M36 40 H64 Q62 60 50 60 Q38 60 36 40Z" fill="#c9d6ff" opacity=".9" />
      <circle cx="44" cy="34" r="9" fill="#b48cff" /><circle cx="56" cy="34" r="9" fill="#6fc8ff" /><circle cx="50" cy="26" r="9" fill="#ff9fcf" />
      <path d="M50 12 l1.5 4 l4 0 l-3 2.5 l1 4 l-3.5 -2.3 l-3.5 2.3 l1 -4 l-3 -2.5 l4 0Z" fill="#ffe56f" />
    </Frame>
  ),
  comet: () => (
    <Frame a="#2a1d6b" b="#05061a">
      <path d="M20 58 Q40 40 62 26" stroke="#6fc8ff" strokeWidth="10" opacity=".25" fill="none" strokeLinecap="round" />
      <path d="M26 54 Q42 40 62 26" stroke="#fff" strokeWidth="3" opacity=".5" fill="none" strokeLinecap="round" />
      <path d="M58 20 L70 22 L72 34 L62 36 L56 28Z" fill="#c9a2ff" stroke="#fff" strokeWidth=".8" />
      <path d="M62 24 L68 26 L66 32" stroke="#fff" strokeWidth=".6" fill="none" />
    </Frame>
  ),
  mirror: () => (
    <Frame a="#d3c6f2" b="#2a1a52">
      <ellipse cx="50" cy="32" rx="16" ry="20" fill="#e8e4ff" stroke="#c99a2e" strokeWidth="3" />
      <path d="M44 22 Q48 18 54 20" stroke="#fff" strokeWidth="2" fill="none" />
      <path d="M56 26 a8 8 0 1 0 0 12 a6 6 0 1 1 0 -12Z" fill="#8f6bd1" />
      <rect x="47" y="51" width="6" height="14" rx="2" fill="#c99a2e" />
    </Frame>
  ),
  recall: () => (
    <Frame a="#fff6e9" b="#5fe3b5">
      <path d="M38 48 Q38 26 50 24 Q62 26 62 48Z" fill="#9ff3d4" stroke="#1f6b52" strokeWidth="1.5" />
      <rect x="35" y="47" width="30" height="4" rx="2" fill="#1f6b52" />
      <path d="M70 30 a14 14 0 1 1 -6 -10" stroke="#fff" strokeWidth="2" fill="none" />
      <path d="M62 16 l3 5 l-6 1Z" fill="#fff" />
    </Frame>
  ),
  cape: () => (
    <Frame a="#120a2e" b="#3c1f6b">
      <path d="M34 18 Q50 12 66 18 L74 62 Q50 54 26 62Z" fill="#5fe3b5" opacity=".85" />
      <path d="M34 18 Q50 12 66 18 L70 40 Q50 32 30 40Z" fill="#ff6fe3" opacity=".6" />
      <circle cx="50" cy="18" r="3" fill="#ffd36f" />
    </Frame>
  ),
  plating: () => (
    <Frame a="#dde8ec" b="#34474f">
      <path d="M50 14 L70 22 V38 Q70 54 50 62 Q30 54 30 38 V22Z" fill="#7f9aa6" stroke="#1e2a30" strokeWidth="1.5" />
      <path d="M50 14 L70 22 V38 Q70 54 50 62Z" fill="#5c7480" />
      {[[42, 28], [58, 28], [50, 44]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="1.6" fill="#dde8ec" />)}
      <path d="M62 16 l6 -6 l-2 6 l6 -2" stroke="#ff9d3c" strokeWidth="1.5" fill="none" />
    </Frame>
  ),
};

const TERRAINS: Record<string, { scene: Parameters<typeof Scene>[0]['scene']; overlay: () => ReactNode }> = {
  festival: { scene: 'parlor', overlay: () => <g>{Array.from({ length: 30 }, (_, i) => <rect key={i} x={(i * 33) % 100} y={(i * 13) % 40} width="2.5" height=".9" rx=".4" fill={['#ff6fb5', '#ffd36f', '#5fe3b5', '#6f9bff'][i % 4]} transform={`rotate(${i * 47} ${(i * 33) % 100} ${(i * 13) % 40})`} />)}<path d="M0 8 Q25 16 50 8 T100 8" stroke="#fff" strokeWidth=".5" fill="none" />{[10, 30, 50, 70, 90].map((x, i) => <path key={i} d={`M${x - 3} ${8 + (i % 2) * 2} l3 6 l3 -6Z`} fill={['#ff6fb5', '#ffd36f', '#5fe3b5'][i % 3]} />)}</g> },
  badlands: { scene: 'canyon', overlay: () => <g><path d="M70 10 Q74 4 78 10 Q82 4 86 10 L82 16 H74Z" fill="#ff5a1f" opacity=".7" />{[20, 50, 80].map((x) => <path key={x} d={`M${x} 64 q2 -6 0 -10 q4 4 3 10Z`} fill="#3b7d2a" />)}</g> },
  canopy: { scene: 'meadow', overlay: () => <g><path d="M0 0 H100 V18 Q90 26 80 18 Q70 28 58 18 Q46 28 34 18 Q22 28 12 18 Q6 24 0 18Z" fill="#2f7a3a" /><path d="M30 18 V48 M70 18 V44" stroke="#7a4b2a" strokeWidth="1.5" /><rect x="22" y="44" width="56" height="8" rx="2" fill="#9b6d3d" /></g> },
  observatory: { scene: 'aurora', overlay: () => <g><path d="M30 60 V42 Q50 24 70 42 V60Z" fill="#dde8ec" /><path d="M44 30 L64 22 L66 28 L48 36Z" fill="#7f9aa6" /><rect x="46" y="48" width="8" height="12" fill="#34474f" /></g> },
  gate: { scene: 'skyruins', overlay: () => <g><rect x="34" y="20" width="6" height="42" fill="#e8dcc4" /><rect x="60" y="20" width="6" height="42" fill="#e8dcc4" /><path d="M30 18 H70 V24 H30Z" fill="#c99a2e" /><path d="M40 30 Q50 22 60 30 V62 H40Z" fill="#ffe9a6" opacity=".55" /></g> },
};

export function Illustration({ name }: { name: string }) {
  if (PORTRAITS[name]) return <Portrait p={PORTRAITS[name]} />;
  if (ITEMS[name]) return <>{ITEMS[name]()}</>;
  const t = TERRAINS[name];
  if (t) {
    return (
      <div className="relative h-full w-full">
        <Scene scene={t.scene} className="absolute inset-0 h-full w-full" />
        <svg viewBox="0 0 100 70" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full">{t.overlay()}</svg>
      </div>
    );
  }
  return <Frame a="#fff" b="#ccc"><text x="50" y="38" textAnchor="middle" fontSize="6" fill="#333">{name}</text></Frame>;
}

export const ILLUSTRATION_KEYS = [...Object.keys(PORTRAITS), ...Object.keys(ITEMS), ...Object.keys(TERRAINS)];
export const PORTRAIT_KEYS = Object.keys(PORTRAITS);
