import { useId } from 'react';
import type { SceneKey } from '../../cards/types';

/**
 * Procedurally drawn illustration backdrops. Each creature is composited onto one of these
 * scenes; full-art and special rarities use the more dramatic scenes (nebula, eclipse, sunburst...).
 */
export function Scene({ scene, className }: { scene: SceneKey; className?: string }) {
  const id = useId().replace(/:/g, '');
  const g = (n: string) => `${id}-${n}`;
  const url = (n: string) => `url(#${g(n)})`;
  const sky = (top: string, bottom: string, name = 'sky') => (
    <linearGradient id={g(name)} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={top} /><stop offset="1" stopColor={bottom} /></linearGradient>
  );
  const common = { viewBox: '0 0 100 70', preserveAspectRatio: 'xMidYMid slice', className, xmlns: 'http://www.w3.org/2000/svg' } as const;

  switch (scene) {
    case 'meadow':
      return (
        <svg {...common}>
          <defs>{sky('#bfe9ff', '#fdf6d8')}<radialGradient id={g('sun')}><stop offset="0" stopColor="#fff7c2" /><stop offset="1" stopColor="#fff7c2" stopOpacity="0" /></radialGradient></defs>
          <rect width="100" height="70" fill={url('sky')} />
          <circle cx="78" cy="14" r="18" fill={url('sun')} />
          <path d="M0 44 Q20 30 42 40 T100 36 V70 H0Z" fill="#9edc7a" />
          <path d="M0 52 Q28 42 55 50 T100 48 V70 H0Z" fill="#6fc15a" />
          <path d="M0 60 Q30 54 60 60 T100 58 V70 H0Z" fill="#4ea544" />
          {[8, 22, 37, 63, 80, 92].map((x, i) => <circle key={i} cx={x} cy={58 + (i % 3) * 3} r="1.1" fill={['#ff8cc6', '#fff', '#ffd36f'][i % 3]} />)}
        </svg>
      );
    case 'volcano':
      return (
        <svg {...common}>
          <defs>{sky('#3a0f1a', '#ff7a3c')}<linearGradient id={g('lava')} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffd36f" /><stop offset="1" stopColor="#ff4b1f" /></linearGradient></defs>
          <rect width="100" height="70" fill={url('sky')} />
          <path d="M10 70 L42 22 L50 26 L58 20 L92 70Z" fill="#4a1a12" />
          <path d="M46 24 L50 34 L54 23 L52 40 L57 70 H44 L48 42Z" fill={url('lava')} opacity=".9" />
          <path d="M0 60 Q25 52 50 62 T100 58 V70 H0Z" fill="#2b0e0a" />
          {[20, 34, 66, 80].map((x, i) => <circle key={i} cx={x} cy={14 + i * 3} r=".8" fill="#ffd36f" opacity=".8" />)}
        </svg>
      );
    case 'reef':
      return (
        <svg {...common}>
          <defs>{sky('#5fd4ff', '#0b3f8f')}</defs>
          <rect width="100" height="70" fill={url('sky')} />
          {[0, 1, 2, 3].map((i) => <path key={i} d={`M${i * 30 - 10} 0 L${i * 30 + 5} 0 L${i * 30 + 25} 70 L${i * 30 + 10} 70Z`} fill="#fff" opacity=".07" />)}
          <path d="M0 62 Q20 56 40 62 T80 60 T100 62 V70 H0Z" fill="#f5d9a0" />
          <path d="M12 62 q-2 -10 2 -16 q3 6 1 10 q4 -6 6 -2 q-3 4 -3 8Z" fill="#ff6f91" />
          <path d="M82 62 q0 -12 4 -14 q1 6 -1 9 q4 -3 5 1 q-3 2 -4 4Z" fill="#ffb36f" />
          {[18, 30, 70, 88, 55].map((x, i) => <circle key={i} cx={x} cy={12 + i * 8} r={0.8 + (i % 2)} fill="none" stroke="#fff" strokeWidth=".4" opacity=".7" />)}
        </svg>
      );
    case 'storm':
      return (
        <svg {...common}>
          <defs>{sky('#2b2550', '#ffd36f')}</defs>
          <rect width="100" height="70" fill={url('sky')} />
          <ellipse cx="25" cy="10" rx="30" ry="10" fill="#1b1638" opacity=".8" />
          <ellipse cx="75" cy="8" rx="35" ry="11" fill="#1b1638" opacity=".85" />
          <path d="M62 14 L56 30 L62 30 L54 48 L70 26 L63 26 L68 14Z" fill="#fff2a8" />
          <path d="M18 16 L15 26 L19 26 L14 36 L24 23 L20 23 L23 16Z" fill="#fff2a8" opacity=".7" />
          <path d="M0 58 Q30 50 60 58 T100 55 V70 H0Z" fill="#3b3352" />
        </svg>
      );
    case 'aurora':
      return (
        <svg {...common}>
          <defs>{sky('#120a2e', '#3c1f6b')}<linearGradient id={g('a')} x1="0" x2="1"><stop offset="0" stopColor="#5fe3b5" stopOpacity="0" /><stop offset=".5" stopColor="#5fe3b5" /><stop offset="1" stopColor="#ff6fe3" stopOpacity="0" /></linearGradient></defs>
          <rect width="100" height="70" fill={url('sky')} />
          <path d="M-5 30 Q25 5 50 22 T105 14" stroke={url('a')} strokeWidth="9" fill="none" opacity=".55" />
          <path d="M-5 40 Q30 18 55 32 T105 26" stroke={url('a')} strokeWidth="5" fill="none" opacity=".35" />
          {Array.from({ length: 22 }, (_, i) => <circle key={i} cx={(i * 37) % 100} cy={(i * 23) % 40} r=".45" fill="#fff" opacity=".8" />)}
          <path d="M0 60 L18 50 L30 58 L46 46 L62 57 L78 48 L100 58 V70 H0Z" fill="#1c1240" />
        </svg>
      );
    case 'canyon':
      return (
        <svg {...common}>
          <defs>{sky('#ffcf8a', '#ff8a5c')}</defs>
          <rect width="100" height="70" fill={url('sky')} />
          <circle cx="22" cy="18" r="8" fill="#fff1c2" opacity=".85" />
          <path d="M0 34 H30 V40 H44 V70 H0Z" fill="#c4692d" />
          <path d="M60 30 H100 V70 H52 V40 H60Z" fill="#a8521f" />
          <path d="M0 44 H44 M52 46 H100" stroke="#e08b4c" strokeWidth="1.5" />
          <path d="M0 62 Q50 54 100 62 V70 H0Z" fill="#7a3912" />
        </svg>
      );
    case 'grotto':
      return (
        <svg {...common}>
          <defs>{sky('#1a1030', '#4b2a6b')}<radialGradient id={g('glow')}><stop offset="0" stopColor="#b48cff" stopOpacity=".6" /><stop offset="1" stopColor="#b48cff" stopOpacity="0" /></radialGradient></defs>
          <rect width="100" height="70" fill={url('sky')} />
          <circle cx="50" cy="36" r="30" fill={url('glow')} />
          <path d="M0 0 H100 V8 L90 18 L84 8 L74 22 L66 6 L56 14 L46 4 L36 16 L28 6 L16 20 L8 8 L0 14Z" fill="#120a22" />
          <path d="M0 70 V58 L12 52 L22 60 L36 54 L50 62 L66 52 L80 60 L100 54 V70Z" fill="#120a22" />
          {[14, 30, 72, 86].map((x, i) => <circle key={i} cx={x} cy={40 + (i % 2) * 8} r="1" fill="#7dffd7" opacity=".8" />)}
        </svg>
      );
    case 'foundry':
      return (
        <svg {...common}>
          <defs>{sky('#5c6f78', '#1e2a30')}</defs>
          <rect width="100" height="70" fill={url('sky')} />
          {[[18, 20, 12], [82, 16, 10], [70, 52, 14]].map(([x, y, r], i) => (
            <g key={i} opacity=".35" transform={`translate(${x} ${y})`}>
              <circle r={r} fill="none" stroke="#c9d6dc" strokeWidth="3" strokeDasharray="3 2.4" />
              <circle r={r * 0.45} fill="#c9d6dc" />
            </g>
          ))}
          <path d="M0 58 H100 V70 H0Z" fill="#12191d" />
          <path d="M0 58 H100" stroke="#ff9d3c" strokeWidth=".6" opacity=".8" />
        </svg>
      );
    case 'skyruins':
      return (
        <svg {...common}>
          <defs>{sky('#8fd0ff', '#ffe9c9')}</defs>
          <rect width="100" height="70" fill={url('sky')} />
          {[[14, 26], [86, 22]].map(([x, h], i) => (
            <g key={i}><rect x={x - 4} y={70 - h - 20} width="8" height={h + 20} fill="#e8dcc4" /><rect x={x - 6} y={70 - h - 22} width="12" height="3" fill="#cbbd9f" /></g>
          ))}
          <ellipse cx="30" cy="60" rx="34" ry="8" fill="#fff" opacity=".9" />
          <ellipse cx="75" cy="62" rx="36" ry="9" fill="#fff" opacity=".85" />
          <ellipse cx="50" cy="16" rx="18" ry="4" fill="#fff" opacity=".6" />
        </svg>
      );
    case 'parlor':
      return (
        <svg {...common}>
          <defs>{sky('#ffe3ef', '#ffd6b0')}<pattern id={g('chk')} width="10" height="10" patternUnits="userSpaceOnUse"><rect width="5" height="5" fill="#3b2216" /><rect x="5" y="5" width="5" height="5" fill="#3b2216" /></pattern></defs>
          <rect width="100" height="70" fill={url('sky')} />
          {[0, 1, 2, 3, 4, 5].map((i) => <rect key={i} x={i * 18} y="0" width="9" height="46" fill="#ffc2dc" opacity=".55" />)}
          <path d="M0 46 H100 V70 H0Z" fill="#fff6e9" />
          <path d="M0 46 H100 V70 H0Z" fill={url('chk')} opacity=".85" />
          <path d="M0 44 Q5 50 10 44 T20 44 T30 44 T40 44 T50 44 T60 44 T70 44 T80 44 T90 44 T100 44 V46 H0Z" fill="#ff8cc6" />
        </svg>
      );
    case 'glacier':
      return (
        <svg {...common}>
          <defs>{sky('#d9f4ff', '#7cc4ef')}</defs>
          <rect width="100" height="70" fill={url('sky')} />
          <path d="M0 50 L14 26 L26 40 L40 18 L56 42 L70 24 L86 44 L100 30 V70 H0Z" fill="#eaf8ff" />
          <path d="M14 26 L18 40 L26 40Z M40 18 L44 36 L56 42Z M70 24 L74 40 L86 44Z" fill="#a9dcf5" />
          <path d="M0 60 Q50 52 100 60 V70 H0Z" fill="#bfe8fb" />
        </svg>
      );
    case 'starfield':
      return (
        <svg {...common}>
          <defs>{sky('#05061a', '#1d1a55')}</defs>
          <rect width="100" height="70" fill={url('sky')} />
          {Array.from({ length: 60 }, (_, i) => <circle key={i} cx={(i * 53) % 100} cy={(i * 31) % 70} r={i % 7 === 0 ? 0.8 : 0.35} fill="#fff" opacity={0.4 + (i % 5) * 0.12} />)}
          <path d="M10 60 Q50 30 95 8" stroke="#fff" strokeWidth=".3" opacity=".5" />
        </svg>
      );
    case 'eclipse':
      return (
        <svg {...common}>
          <defs>{sky('#090313', '#3a0f2a')}<radialGradient id={g('c')}><stop offset=".55" stopColor="#ffd36f" stopOpacity="0" /><stop offset=".62" stopColor="#ffd36f" /><stop offset="1" stopColor="#ff6f3c" stopOpacity="0" /></radialGradient></defs>
          <rect width="100" height="70" fill={url('sky')} />
          <circle cx="50" cy="30" r="30" fill={url('c')} />
          <circle cx="50" cy="30" r="17" fill="#07020d" />
          {Array.from({ length: 30 }, (_, i) => <circle key={i} cx={(i * 41) % 100} cy={(i * 17) % 70} r=".35" fill="#ffe7b0" opacity=".6" />)}
        </svg>
      );
    case 'nebula':
      return (
        <svg {...common}>
          <defs>
            {sky('#0b0626', '#2a0f4a')}
            <radialGradient id={g('n1')}><stop offset="0" stopColor="#ff6fe3" stopOpacity=".7" /><stop offset="1" stopColor="#ff6fe3" stopOpacity="0" /></radialGradient>
            <radialGradient id={g('n2')}><stop offset="0" stopColor="#6fc8ff" stopOpacity=".7" /><stop offset="1" stopColor="#6fc8ff" stopOpacity="0" /></radialGradient>
          </defs>
          <rect width="100" height="70" fill={url('sky')} />
          <ellipse cx="30" cy="30" rx="40" ry="24" fill={url('n1')} />
          <ellipse cx="72" cy="42" rx="40" ry="26" fill={url('n2')} />
          {Array.from({ length: 40 }, (_, i) => <circle key={i} cx={(i * 47) % 100} cy={(i * 29) % 70} r={i % 9 === 0 ? 0.8 : 0.3} fill="#fff" opacity=".8" />)}
        </svg>
      );
    case 'sunburst':
      return (
        <svg {...common}>
          <defs><radialGradient id={g('s')}><stop offset="0" stopColor="#fff6c9" /><stop offset="1" stopColor="#ff9fcf" /></radialGradient></defs>
          <rect width="100" height="70" fill={url('s')} />
          {Array.from({ length: 18 }, (_, i) => (
            <path key={i} d="M50 35 L-20 30 L-20 40Z" fill="#fff" opacity=".22" transform={`rotate(${i * 20} 50 35)`} />
          ))}
        </svg>
      );
  }
}
