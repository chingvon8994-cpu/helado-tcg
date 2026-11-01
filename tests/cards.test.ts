import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ALL_CARDS, EXPANSIONS, cardsInExpansion, getCard } from '../src/cards/registry';
import { abilityText, attackText } from '../src/cards/text';
import type { CreatureCard, Element, EssenceElement, TrainerCard } from '../src/cards/types';
import { applyAction, getPlayerView, legalActions, retreatCost, maxHp, type GameState } from '../src/engine';
import { act, creature, giveHand, scenario } from './util';

const creatures = ALL_CARDS.filter((c): c is CreatureCard => c.category === 'creature' && !c.variantOf);
const trainers = ALL_CARDS.filter((c): c is TrainerCard => c.category === 'trainer');

function payFor(cost: Element[], own: Element): EssenceElement[] {
  const fill = (own === 'neutral' || own === 'wyrm' ? 'brawl' : own) as EssenceElement;
  return cost.map((c) => (c === 'neutral' ? fill : c) as EssenceElement);
}

/** A busy board: damaged/statused creatures on both sides, benches, discard piles and essence. */
function rich(attackerId: string, energy: EssenceElement[] = []): GameState {
  const s = scenario(attackerId, 'GEN-011', { aExtra: { energy, damage: 10 }, bExtra: { damage: 20, energy: ['brawl', 'brawl'] } });
  s.players[0].bench.push(creature('GEN-001', { damage: 30, energy: ['verdant', 'tide'], status: [] }), creature('GEN-007'));
  s.players[1].bench.push(creature('GEN-004', { damage: 10 }), creature('GEN-012'));
  s.players[0].discard.push({ uid: 'dz1', cardId: 'GEN-004' }, { uid: 'dz2', cardId: 'GEN-071' });
  s.players[0].essenceDiscard.push('volt', 'blaze', 'verdant');
  s.players[0].deck.push({ uid: 'dz3', cardId: 'GEN-002' }, { uid: 'dz4', cardId: 'GEN-010' });
  giveHand(s, 1, ['GEN-071', 'GEN-072']);
  return s;
}

describe('card database integrity', () => {
  it('has three expansions and ~100+ unique cards', () => {
    expect(EXPANSIONS.map((e) => e.id)).toEqual(['genesis', 'wildfront', 'celestial']);
    expect(ALL_CARDS.length).toBeGreaterThanOrEqual(100);
    for (const e of EXPANSIONS) expect(cardsInExpansion(e.id).length).toBeGreaterThan(25);
    expect(new Set(ALL_CARDS.map((c) => c.id)).size).toBe(ALL_CARDS.length);
  });

  it('every rarity tier exists', () => {
    const r = new Set(ALL_CARDS.map((c) => c.rarity));
    for (const x of ['common', 'uncommon', 'rare', 'double_rare', 'illustration_rare', 'ultra_rare', 'secret_rare']) expect(r.has(x as never)).toBe(true);
  });

  it('evolution chains are complete', () => {
    const species = new Map(creatures.map((c) => [c.species, c]));
    for (const c of creatures) {
      if (c.stage === 'basic') { expect(c.evolvesFrom).toBeUndefined(); continue; }
      const from = species.get(c.evolvesFrom!);
      expect(from, `${c.id} evolves from missing ${c.evolvesFrom}`).toBeDefined();
      expect(from!.stage).toBe(c.stage === 'stage1' ? 'basic' : 'stage1');
    }
  });

  it('every card has artwork on disk and generated rules text', () => {
    for (const c of ALL_CARDS) {
      if (c.art.image) expect(existsSync(join(__dirname, '..', 'public', 'art', 'creatures', `${c.art.image}.webp`)), `${c.id} art ${c.art.image}`).toBe(true);
      if (c.category === 'trainer') { expect(c.art.illustration).toBeTruthy(); expect(c.text.length).toBeGreaterThan(5); }
      if (c.category === 'creature') {
        expect(c.attacks.length).toBeGreaterThan(0);
        for (const a of c.attacks) if (a.effects?.length || a.mods?.length || a.recoil) expect(attackText(a).length).toBeGreaterThan(10);
        if (c.ability) expect(abilityText(c.ability).length).toBeGreaterThan(10);
      }
    }
  });
});

describe('every creature attack is implemented', () => {
  for (const c of creatures) {
    it(`${c.id} ${c.name}`, () => {
      c.attacks.forEach((atk, index) => {
        for (const seed of [1, 2, 3]) {
          const s = rich(c.id, payFor(atk.cost, c.element));
          s.rng = seed;
          const variants = legalActions(s, 0).filter((a) => a.type === 'attack' && a.index === index);
          expect(variants.length, `${c.name}/${atk.name} not legal`).toBeGreaterThan(0);
          for (const v of variants) {
            const r = applyAction(s, 0, v);
            expect(r.ok, `${c.name}/${atk.name}: ${!r.ok && r.error}`).toBe(true);
            if (r.ok) expect(r.state.log.some((e) => e.t === 'attack' && e.text === atk.name)).toBe(true);
          }
        }
      });
    });
  }
});

describe('every trainer card is playable and resolves', () => {
  for (const t of trainers) {
    it(`${t.id} ${t.name}`, () => {
      const s = rich('GEN-010', ['brawl']);
      s.players[0].active!.status = ['poisoned'];
      s.players[0].supporterThisTurn = false;
      const [h] = giveHand(s, 0, [t.id]);
      const plays = legalActions(s, 0).filter((a) => a.type === 'playTrainer' && a.handUid === h.uid);
      expect(plays.length, `${t.name} not playable`).toBeGreaterThan(0);
      for (const p of plays) {
        const r = applyAction(s, 0, p);
        expect(r.ok, `${t.name}: ${!r.ok && r.error}`).toBe(true);
      }
    });
  }
});

describe('every activated ability works', () => {
  for (const c of creatures.filter((x) => x.ability?.kind === 'activated')) {
    it(`${c.id} ${c.name}: ${c.ability!.name}`, () => {
      const s = rich(c.id, ['psyche']);
      s.players[1].active!.status = ['asleep'];
      const uses = legalActions(s, 0).filter((a) => a.type === 'useAbility');
      expect(uses.length).toBeGreaterThan(0);
      const t = act(s, 0, uses[0]);
      expect(legalActions(t, 0).some((a) => a.type === 'useAbility')).toBe(false); // once per turn
    });
  }
});

describe('effect mechanics', () => {
  it('switchOpponent, bench damage and recoil', () => {
    const s = rich('GEN-009', ['tide']);
    const benchUid = s.players[1].bench[0].uid;
    expect(legalActions(s, 0).filter((a) => a.type === 'attack' && a.index === 0)).toHaveLength(2); // one per target
    const t = act(s, 0, { type: 'attack', index: 0, targetUid: benchUid });
    expect(t.players[1].active!.uid).toBe(benchUid); // Undertow pulled the benched creature in
    const blade = rich('WLD-060', ['brawl', 'brawl', 'brawl']);
    const bt = blade.players[1].bench[1].uid;
    const bb = act(blade, 0, { type: 'attack', index: 1, targetUid: bt });
    expect(bb.players[1].bench.find((x) => x.uid === bt)!.damage).toBe(20);
    const k = rich('GEN-017', ['psyche', 'psyche', 'psyche']);
    const u = act(k, 0, { type: 'attack', index: 1 });
    expect(u.players[0].active!.damage).toBe(10 + 30);
    const b = act(rich('GEN-017', ['psyche', 'psyche']), 0, { type: 'attack', index: 0 });
    expect(b.players[1].bench.map((x) => x.damage)).toEqual([20, 10]);
  });

  it('attaches essence from the zone and from the discard pile', () => {
    const t = act(rich('GEN-061', ['blaze']), 0, { type: 'attack', index: 0 });
    expect(t.players[0].active!.energy).toEqual(['blaze', 'blaze']);
    const z = act(rich('WLD-014', ['volt']), 0, { type: 'attack', index: 0 });
    expect(z.players[0].active!.energy).toEqual(['volt', 'volt']); // only one volt was in the discard
  });

  it('moveEnergy ability and Comet Fragment', () => {
    const s = rich('CEL-007');
    const benchUid = s.players[0].bench[0].uid;
    const t = act(s, 0, { type: 'useAbility', creatureUid: s.players[0].active!.uid, targetUid: benchUid });
    expect(t.players[0].active!.energy).toHaveLength(1);
    const [h] = giveHand(s, 0, ['CEL-072']);
    const u = act(s, 0, { type: 'playTrainer', handUid: h.uid, targetUid: benchUid });
    expect(u.players[0].active!.energy).toHaveLength(2);
    expect(u.players[0].bench[0].energy).toHaveLength(0);
  });

  it('Evolution Compass only finds evolutions of creatures in play', () => {
    const s = rich('GEN-010');
    s.players[0].deck = [{ uid: 'e1', cardId: 'GEN-005' }, { uid: 'e2', cardId: 'GEN-002' }, { uid: 'e3', cardId: 'GEN-071' }];
    const [h] = giveHand(s, 0, ['WLD-072']);
    const t = act(s, 0, { type: 'playTrainer', handUid: h.uid });
    expect(t.players[0].hand.map((c) => c.cardId)).toContain('GEN-002'); // Citriman is benched → Crocshot
  });

  it('Recall Bell returns the active and forces a promotion before continuing', () => {
    const s = rich('GEN-010', ['brawl']);
    const [h] = giveHand(s, 0, ['CEL-074']);
    let t = act(s, 0, { type: 'playTrainer', handUid: h.uid });
    expect(t.players[0].active).toBeNull();
    expect(t.pending).toEqual([{ player: 0, kind: 'promote' }]);
    expect(t.players[0].hand.map((c) => c.cardId)).toContain('GEN-010');
    t = act(t, 0, { type: 'promote', benchUid: t.players[0].bench[1].uid });
    expect(t.current).toBe(0);
    expect(legalActions(t, 0).some((a) => a.type === 'endTurn')).toBe(true);
  });

  it('hand disruption, hand reset and reveal', () => {
    const s = rich('GEN-010');
    const [p] = giveHand(s, 0, ['WLD-083']);
    const t = act(s, 0, { type: 'playTrainer', handUid: p.uid });
    expect(t.players[1].hand).toHaveLength(3);
    const [n] = giveHand(s, 0, ['CEL-081']);
    expect(act(s, 0, { type: 'playTrainer', handUid: n.uid }).players[0].hand).toHaveLength(5);
    const [m] = giveHand(s, 0, ['CEL-073']);
    const r = act(s, 0, { type: 'playTrainer', handUid: m.uid });
    expect(getPlayerView(r, 0).opponent.hand).toHaveLength(2);
    expect(getPlayerView(act(r, 0, { type: 'endTurn' }), 0).opponent.hand).toBeNull();
  });

  it('timed protection, weaken, cantRetreat and cantAttack', () => {
    const h = act(rich('WLD-018', ['verdant']), 0, { type: 'attack', index: 0 });
    expect(h.players[0].active!.effects.some((e) => e.kind === 'reduceIncoming')).toBe(true);
    const c = act(rich('GEN-022', ['brawl', 'brawl']), 0, { type: 'attack', index: 0 });
    expect(c.players[1].active!.effects.some((e) => e.kind === 'weaken')).toBe(true);
    const w = act(rich('WLD-009', ['shade', 'shade']), 0, { type: 'attack', index: 0 });
    expect(legalActions(w, 1).some((a) => a.type === 'retreat')).toBe(false);
    const fs = rich('CEL-010', ['volt', 'verdant', 'volt', 'volt']);
    fs.players[1].active = creature('CEL-018'); // 170 HP so Forest Roar does not KO
    let f = act(fs, 0, { type: 'attack', index: 1 });
    f = act(f, 1, { type: 'endTurn' });
    expect(legalActions(f, 0).some((a) => a.type === 'attack')).toBe(false);
    f = act(f, 0, { type: 'endTurn' });
    f = act(f, 1, { type: 'endTurn' });
    expect(f.players[0].active!.effects).toHaveLength(0);
  });

  it('Vengeful Soul takes an extra point on a knockout', () => {
    const s = rich('CEL-062', ['psyche', 'psyche', 'psyche']);
    s.players[1].active!.damage = 100;
    const t = act(s, 0, { type: 'attack', index: 1 });
    expect(t.players[0].points).toBe(2);
  });

  it('passives: thorns, checkup heal, status immunity, no weakness, status bonus, free retreat', () => {
    const th = rich('GEN-010', ['brawl']);
    th.players[1].active = creature('GEN-024'); // Punkypine, Iron Barbs
    const a = act(th, 0, { type: 'attack', index: 0 });
    void a;
    const th2 = rich('GEN-018', ['brawl']);
    th2.players[1].active = creature('GEN-024');
    expect(act(th2, 0, { type: 'attack', index: 0 }).players[0].active!.damage).toBe(10 + 20);

    const sl = rich('WLD-019');
    sl.players[0].active!.damage = 50;
    expect(act(sl, 0, { type: 'endTurn' }).players[0].active!.damage).toBe(30);

    const im = rich('GEN-019', ['volt']);
    im.players[1].active = creature('WLD-018');
    const st = act(im, 0, { type: 'attack', index: 0 });
    expect(st.players[1].active!.status).toEqual([]);

    const nw = rich('CEL-016', ['alloy', 'alloy']); // Alloy attacker vs Predtempest (weak to shade) — check noWeakness via shade attacker
    void nw;
    const sh = rich('GEN-012', ['shade', 'shade']);
    sh.players[1].active = creature('CEL-003');
    expect(act(sh, 0, { type: 'attack', index: 1 }).players[1].active!.damage).toBe(20 + 10); // no +20 weakness, +10 poison

    const sf = rich('WLD-010', ['shade']);
    sf.players[1].active!.status = ['poisoned'];
    expect(act(sf, 0, { type: 'endTurn' }).players[1].active!.damage).toBe(20 + 10 + 20);

    const fr = rich('CEL-015', ['alloy']);
    expect(retreatCost(fr, 0, fr.players[0].active!)).toBe(0);
  });

  it('terrains: hp, retreat and damage bonuses apply to both players', () => {
    const s = rich('CEL-011', ['tide']);
    const [g] = giveHand(s, 0, ['CEL-096']);
    const t = act(s, 0, { type: 'playTrainer', handUid: g.uid });
    expect(retreatCost(t, 0, t.players[0].active!)).toBe(0);
    const o = rich('GEN-007');
    const [ob] = giveHand(o, 0, ['CEL-095']);
    const u = act(o, 0, { type: 'playTrainer', handUid: ob.uid });
    expect(maxHp(u, 0, u.players[0].active!)).toBe(90);
    const b = rich('GEN-018', ['brawl']);
    const [bd] = giveHand(b, 0, ['WLD-095']);
    const v = act(b, 0, { type: 'playTrainer', handUid: bd.uid });
    expect(act(v, 0, { type: 'attack', index: 0 }).players[1].active!.damage).toBe(20 + (20 + 10 + 20 - 10)); // prior 20 + (20 base +10 terrain +20 weakness -10 Thick Fluff)
    // Playing a second copy of the same terrain is not allowed.
    const [g2] = giveHand(t, 0, ['CEL-096']);
    expect(legalActions(t, 0).some((a) => a.type === 'playTrainer' && a.handUid === g2.uid)).toBe(false);
  });

  it('alt-art variants share gameplay with their base card', () => {
    const v = getCard('GEN-105');
    const b = getCard('GEN-060');
    expect(v.category).toBe('creature');
    if (v.category === 'creature' && b.category === 'creature') {
      expect(v.attacks).toEqual(b.attacks);
      expect(v.hp).toBe(b.hp);
      expect(v.rarity).toBe('secret_rare');
    }
  });
});

describe('prebuilt decks', () => {
  it('starter and AI decks are all legal', async () => {
    const { STARTER_DECKS } = await import('../src/game/starterDecks');
    const { AI_DECKS } = await import('../src/game/aiDecks');
    const { validateDeck } = await import('../src/engine');
    for (const dk of [...STARTER_DECKS.map((x) => x.list), ...Object.values(AI_DECKS)]) expect(validateDeck(dk).errors).toEqual([]);
  });
});
