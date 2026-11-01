import { ELEMENTS, RARITY_ORDER, type CardDef, type Element, type Rarity } from '../cards/types';
import { EXPANSIONS } from '../cards/registry';
import { ElementIcon, RARITY_LABEL } from './Card';

export interface Filters { q: string; element: Element | 'all'; rarity: Rarity | 'all'; category: 'all' | 'creature' | 'item' | 'supporter' | 'tool' | 'terrain'; expansion: string; sort: 'number' | 'rarity' | 'element' | 'name' | 'hp'; owned: 'all' | 'owned' | 'missing' }
export const DEFAULT_FILTERS: Filters = { q: '', element: 'all', rarity: 'all', category: 'all', expansion: 'all', sort: 'number', owned: 'all' };

export function applyFilters(cards: CardDef[], f: Filters, owned?: Record<string, number>) {
  const q = f.q.trim().toLowerCase();
  const out = cards.filter((c) => {
    if (q && !c.name.toLowerCase().includes(q)) return false;
    if (f.expansion !== 'all' && c.expansion !== f.expansion) return false;
    if (f.rarity !== 'all' && c.rarity !== f.rarity) return false;
    if (f.element !== 'all' && (c.category !== 'creature' || c.element !== f.element)) return false;
    if (f.category === 'creature' && c.category !== 'creature') return false;
    if (f.category !== 'all' && f.category !== 'creature' && (c.category !== 'trainer' || c.trainerKind !== f.category)) return false;
    if (owned && f.owned === 'owned' && !owned[c.id]) return false;
    if (owned && f.owned === 'missing' && owned[c.id]) return false;
    return true;
  });
  const exp = (id: string) => EXPANSIONS.findIndex((e) => e.id === id);
  const cmp: Record<Filters['sort'], (a: CardDef, b: CardDef) => number> = {
    number: (a, b) => exp(a.expansion) - exp(b.expansion) || a.number - b.number,
    rarity: (a, b) => RARITY_ORDER.indexOf(b.rarity) - RARITY_ORDER.indexOf(a.rarity) || a.name.localeCompare(b.name),
    element: (a, b) => (a.category === 'creature' ? ELEMENTS.indexOf(a.element) : 99) - (b.category === 'creature' ? ELEMENTS.indexOf(b.element) : 99) || a.name.localeCompare(b.name),
    name: (a, b) => a.name.localeCompare(b.name),
    hp: (a, b) => (b.category === 'creature' ? b.hp : 0) - (a.category === 'creature' ? a.hp : 0),
  };
  return out.sort(cmp[f.sort]);
}

export function FilterBar({ f, set, showOwned }: { f: Filters; set: (f: Filters) => void; showOwned?: boolean }) {
  const sel = 'rounded-xl bg-black/30 border border-white/15 px-2 py-2 text-sm font-bold outline-none';
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <input className="input max-w-xs flex-1" placeholder="Search cards…" value={f.q} onChange={(e) => set({ ...f, q: e.target.value })} />
        <select className={sel} value={f.expansion} onChange={(e) => set({ ...f, expansion: e.target.value })}>
          <option value="all">All sets</option>{EXPANSIONS.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
        </select>
        <select className={sel} value={f.category} onChange={(e) => set({ ...f, category: e.target.value as Filters['category'] })}>
          <option value="all">All types</option><option value="creature">Creatures</option><option value="item">Items</option><option value="supporter">Supporters</option><option value="tool">Tools</option><option value="terrain">Terrains</option>
        </select>
        <select className={sel} value={f.rarity} onChange={(e) => set({ ...f, rarity: e.target.value as Filters['rarity'] })}>
          <option value="all">Any rarity</option>{RARITY_ORDER.map((r) => <option key={r} value={r}>{RARITY_LABEL[r]}</option>)}
        </select>
        <select className={sel} value={f.sort} onChange={(e) => set({ ...f, sort: e.target.value as Filters['sort'] })}>
          <option value="number">Sort: Number</option><option value="rarity">Sort: Rarity</option><option value="element">Sort: Element</option><option value="name">Sort: Name</option><option value="hp">Sort: HP</option>
        </select>
        {showOwned && (
          <select className={sel} value={f.owned} onChange={(e) => set({ ...f, owned: e.target.value as Filters['owned'] })}>
            <option value="all">Owned + missing</option><option value="owned">Owned only</option><option value="missing">Missing only</option>
          </select>
        )}
      </div>
      <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
        <button className={`chip ${f.element === 'all' ? 'bg-white/30' : ''}`} onClick={() => set({ ...f, element: 'all' })}>All</button>
        {ELEMENTS.map((el) => (
          <button key={el} className={`chip ${f.element === el ? 'bg-white/30' : ''}`} onClick={() => set({ ...f, element: el })}><ElementIcon el={el} size={16} /></button>
        ))}
      </div>
    </div>
  );
}
