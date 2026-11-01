import { getCard } from '../cards/registry';
import type { EssenceElement } from '../cards/types';
import { validateDeck, type DeckList } from '../engine';
import { AI_DECKS } from '../game/aiDecks';
import { STARTER_DECKS } from '../game/starterDecks';
import type { DeckRecord } from '../state/data';
import { ElementIcon, artUrl } from './Card';

export interface DeckChoice { id: string; name: string; list: DeckList; source: 'starter' | 'mine' | 'loaner' }

export function deckChoices(mine: DeckRecord[], includeLoaners: boolean): DeckChoice[] {
  const out: DeckChoice[] = mine.map((d) => ({ id: d.id, name: d.name, list: { cards: d.cards, essence: d.essence as EssenceElement[] }, source: 'mine' as const }));
  for (const s of STARTER_DECKS) if (!out.some((d) => d.id === s.id)) out.push({ id: s.id, name: s.name, list: s.list, source: 'starter' });
  if (includeLoaners) {
    const names: Record<string, string> = { volcanic: 'Volcanic Wildfront', frost: 'Frost Mind', jungle: 'Jungle Brew', legion: 'Crystal Legion' };
    for (const [k, list] of Object.entries(AI_DECKS)) out.push({ id: `loaner-${k}`, name: `${names[k]} (loaner)`, list, source: 'loaner' });
  }
  return out;
}

/** Most "valuable" creature in a deck, used as its cover art. */
export function deckCover(list: DeckList): string {
  let best = 'axolitl';
  let score = -1;
  for (const id of list.cards) {
    const c = getCard(id);
    if (c.category !== 'creature' || !c.art.image) continue;
    const s = (c.prime ? 1000 : 0) + c.hp;
    if (s > score) { score = s; best = c.art.image; }
  }
  return best;
}

export function DeckPicker({ choices, value, onChange }: { choices: DeckChoice[]; value: string | null; onChange: (id: string) => void }) {
  return (
    <div className="no-scrollbar flex gap-3 overflow-x-auto pb-2">
      {choices.map((d) => {
        const valid = validateDeck(d.list).ok;
        return (
          <button key={d.id} disabled={!valid} onClick={() => onChange(d.id)} className={`relative w-36 shrink-0 overflow-hidden rounded-2xl border-2 p-2 text-left transition ${value === d.id ? 'border-berry-400 bg-berry-400/20' : 'border-white/10 bg-white/5 hover:bg-white/10'} disabled:opacity-40`}>
            <div className="checker flex h-20 items-center justify-center rounded-xl bg-black/20"><img src={artUrl(deckCover(d.list))} alt="" className="h-[90%] object-contain" /></div>
            <p className="mt-1.5 truncate font-display font-bold leading-tight">{d.name}</p>
            <div className="mt-1 flex items-center gap-1">{d.list.essence.map((e) => <ElementIcon key={e} el={e} size={16} />)}<span className="ml-auto text-[10px] font-bold uppercase text-white/50">{valid ? d.source : 'invalid'}</span></div>
          </button>
        );
      })}
    </div>
  );
}
