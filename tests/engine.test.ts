import { describe, expect, it } from 'vitest';
import {
  applyAction, createMatch, getPlayerView, legalActions, validateDeck, DEFAULT_RULES, HIDDEN_CARD,
} from '../src/engine';
import { act, creature, giveHand, quickSetup, scenario, TEST_DECK_A, TEST_DECK_B, withSeedFor } from './util';

const newMatch = (seed = 7) => createMatch([TEST_DECK_A, TEST_DECK_B], { seed, firstPlayer: 0 });

describe('deck validation', () => {
  it('accepts legal decks and rejects broken ones', () => {
    expect(validateDeck(TEST_DECK_A).ok).toBe(true);
    expect(validateDeck(TEST_DECK_B).ok).toBe(true);
    const tooMany = { ...TEST_DECK_A, cards: [...TEST_DECK_A.cards.slice(0, 17), 'GEN-001', 'GEN-001', 'GEN-001'] };
    expect(validateDeck(tooMany).errors.join()).toMatch(/At most 2 copies/);
    expect(validateDeck({ ...TEST_DECK_A, cards: TEST_DECK_A.cards.slice(1) }).ok).toBe(false);
    const noBasics = { cards: Array.from({ length: 20 }, (_, i) => ['GEN-071', 'GEN-072', 'GEN-073', 'GEN-081', 'GEN-082', 'GEN-090', 'GEN-095', 'GEN-002', 'GEN-005', 'GEN-071'][i % 10]), essence: ['verdant'] as const };
    expect(validateDeck({ ...noBasics, essence: ['verdant'] }).ok).toBe(false);
    expect(validateDeck({ ...TEST_DECK_A, essence: [] }).ok).toBe(false);
    expect(validateDeck({ ...TEST_DECK_A, cards: [...TEST_DECK_A.cards.slice(1), 'NOPE-1'] }).ok).toBe(false);
  });
  it('rules are configurable', () => {
    expect(validateDeck(TEST_DECK_A, { ...DEFAULT_RULES, deckSize: 30 }).ok).toBe(false);
  });
});

describe('setup', () => {
  it('deals an opening hand that always contains a basic', () => {
    for (let seed = 1; seed < 60; seed++) {
      const s = createMatch([TEST_DECK_A, TEST_DECK_B], { seed });
      for (const ps of s.players) {
        expect(ps.hand).toHaveLength(5);
        expect(ps.deck).toHaveLength(15);
        expect(legalActions(s, s.players.indexOf(ps) as 0 | 1).some((a) => a.type === 'setupActive')).toBe(true);
      }
    }
  });
  it('is deterministic for a seed', () => {
    expect(JSON.stringify(newMatch(5))).toEqual(JSON.stringify(newMatch(5)));
  });
  it('requires an active before finishing setup, then starts turn 1', () => {
    let s = newMatch();
    expect(applyAction(s, 0, { type: 'setupDone' }).ok).toBe(false);
    s = quickSetup(s);
    expect(s.phase).toBe('main');
    expect(s.turn).toBe(1);
    expect(s.current).toBe(0);
    expect(s.players[0].hand).toHaveLength(5); // 4 left after setup + 1 draw
    expect(s.players[0].essenceCurrent).toBeNull(); // first player gets no essence on turn 1
  });
});

describe('turn flow, drawing and essence', () => {
  it('alternates turns, draws one card and generates essence', () => {
    let s = quickSetup(newMatch());
    const deck1 = s.players[1].deck.length;
    s = act(s, 0, { type: 'endTurn' });
    expect(s.turn).toBe(2);
    expect(s.current).toBe(1);
    expect(s.players[1].deck.length).toBe(deck1 - 1);
    expect(s.players[1].essenceCurrent).not.toBeNull();
    expect(TEST_DECK_B.essence).toContain(s.players[1].essenceCurrent);
    s = act(s, 1, { type: 'endTurn' });
    expect(s.turn).toBe(3);
    expect(s.current).toBe(0);
  });
  it('attaches essence once per turn and unused essence fades', () => {
    let s = quickSetup(newMatch());
    s = act(s, 0, { type: 'endTurn' });
    const uid = s.players[1].active!.uid;
    const el = s.players[1].essenceCurrent!;
    s = act(s, 1, { type: 'attachEssence', targetUid: uid });
    expect(s.players[1].active!.energy).toEqual([el]);
    expect(applyAction(s, 1, { type: 'attachEssence', targetUid: uid }).ok).toBe(false);
    s = act(s, 1, { type: 'endTurn' });
    expect(s.players[0].essenceCurrent).not.toBeNull();
    s = act(s, 0, { type: 'endTurn' });
    expect(s.players[0].essenceCurrent).toBeNull();
  });
  it('does not lose when the deck runs out of cards', () => {
    let s = quickSetup(newMatch());
    s.players[1].deck = [];
    s = act(s, 0, { type: 'endTurn' });
    expect(s.phase).toBe('main');
    expect(s.current).toBe(1);
  });
});

describe('placing creatures and evolution', () => {
  it('benches basics up to the bench limit', () => {
    const s = scenario('GEN-001', 'GEN-007');
    giveHand(s, 0, ['GEN-004', 'GEN-004', 'GEN-010', 'GEN-001']);
    let t = s;
    for (let i = 0; i < 3; i++) t = act(t, 0, legalActions(t, 0).find((a) => a.type === 'playBasic')!);
    expect(t.players[0].bench).toHaveLength(3);
    expect(legalActions(t, 0).some((a) => a.type === 'playBasic')).toBe(false);
  });
  it('evolves onto a matching creature, keeping damage and energy, clearing status', () => {
    const s = scenario('GEN-001', 'GEN-007', { aExtra: { damage: 30, energy: ['verdant'], status: ['poisoned'] } });
    const [h] = giveHand(s, 0, ['GEN-002']);
    const t = act(s, 0, { type: 'evolve', handUid: h.uid, targetUid: s.players[0].active!.uid });
    const a = t.players[0].active!;
    expect(a.cardId).toBe('GEN-002');
    expect(a.stack).toHaveLength(2);
    expect(a.damage).toBe(30);
    expect(a.energy).toEqual(['verdant']);
    expect(a.status).toEqual([]);
  });
  it('blocks evolution on the first turns, same-turn plays and wrong species', () => {
    const s = scenario('GEN-001', 'GEN-007');
    const [h, wrong] = giveHand(s, 0, ['GEN-002', 'GEN-005']);
    s.players[0].active!.playedTurn = 3;
    expect(applyAction(s, 0, { type: 'evolve', handUid: h.uid, targetUid: s.players[0].active!.uid }).ok).toBe(false);
    s.players[0].active!.playedTurn = 0;
    expect(applyAction(s, 0, { type: 'evolve', handUid: wrong.uid, targetUid: s.players[0].active!.uid }).ok).toBe(false);
    s.turn = 2;
    expect(applyAction(s, 0, { type: 'evolve', handUid: h.uid, targetUid: s.players[0].active!.uid }).ok).toBe(false);
  });
});

describe('attacks and damage', () => {
  it('requires the right essence', () => {
    const s = scenario('GEN-001', 'GEN-007');
    expect(applyAction(s, 0, { type: 'attack', index: 0 }).ok).toBe(false);
    s.players[0].active!.energy = ['blaze'];
    expect(applyAction(s, 0, { type: 'attack', index: 0 }).ok).toBe(false);
    s.players[0].active!.energy = ['verdant'];
    expect(applyAction(s, 0, { type: 'attack', index: 0 }).ok).toBe(true);
    s.players[0].active!.energy = ['verdant', 'blaze'];
    expect(applyAction(s, 0, { type: 'attack', index: 1 }).ok).toBe(true); // neutral paid by blaze
  });
  it('deals printed damage, ends the turn, and applies weakness', () => {
    const s = scenario('GEN-001', 'GEN-007', { aExtra: { energy: ['verdant'] } });
    const t = act(s, 0, { type: 'attack', index: 0 });
    expect(t.players[1].active!.damage).toBe(20);
    expect(t.current).toBe(1);
    // Blaze attacker vs Verdant defender (weak to Blaze) → +20
    const w = scenario('GEN-004', 'GEN-001', { aExtra: { energy: ['blaze', 'blaze'] } });
    const u = act(w, 0, { type: 'attack', index: 1 });
    expect(u.players[1].active!.damage).toBe(60);
    expect(u.log.some((e) => e.t === 'damage' && e.weakness)).toBe(true);
  });
  it('applies conditional damage modifiers', () => {
    const s = scenario('GEN-007', 'GEN-010', { aExtra: { energy: ['tide', 'tide'] }, bExtra: { damage: 10 } });
    expect(act(s, 0, { type: 'attack', index: 1 }).players[1].active!.damage).toBe(10 + 60);
    const b = scenario('GEN-005', 'GEN-060', { aExtra: { energy: ['blaze', 'blaze'] }, bExtra: { status: ['burned'] } });
    expect(act(b, 0, { type: 'attack', index: 0 }).players[1].active!.damage).toBe(70 + 20); // +20 burn at checkup
  });
  it('coin-flip damage uses the seeded RNG', () => {
    const s = scenario('GEN-002', 'GEN-007', { aExtra: { energy: ['verdant'] } });
    const twoHeads = withSeedFor(s, 0, { type: 'attack', index: 0 }, (st) => st.players[1].active!.damage === 60);
    expect(twoHeads.log.filter((e) => e.t === 'coin').at(-1)!.coins).toEqual([true, true]);
    withSeedFor(s, 0, { type: 'attack', index: 0 }, (st) => st.players[1].active!.damage === 20);
  });
  it('self-discard and heal effects resolve', () => {
    const s = scenario('GEN-005', 'GEN-007', { aExtra: { energy: ['blaze', 'blaze', 'verdant'] } });
    const t = act(s, 0, { type: 'attack', index: 1 });
    expect(t.players[0].active!.energy).toEqual(['blaze', 'verdant']);
    expect(t.players[0].essenceDiscard).toEqual(['blaze']);
    const h = scenario('GEN-010', 'GEN-007', { aExtra: { energy: ['tide'], damage: 50 } });
    expect(act(h, 0, { type: 'attack', index: 0 }).players[0].active!.damage).toBe(20);
  });
});

describe('trainer cards', () => {
  it('item: Sundae Salve heals a chosen damaged creature and is only playable when useful', () => {
    const s = scenario('GEN-001', 'GEN-007');
    const [salve] = giveHand(s, 0, ['GEN-071']);
    expect(legalActions(s, 0).some((a) => a.type === 'playTrainer')).toBe(false);
    s.players[0].active!.damage = 30;
    const t = act(s, 0, { type: 'playTrainer', handUid: salve.uid, targetUid: s.players[0].active!.uid });
    expect(t.players[0].active!.damage).toBe(10);
    expect(t.players[0].discard.map((c) => c.cardId)).toContain('GEN-071');
  });
  it('item: Sprinkle Scope fetches a basic; Swap Spoon switches', () => {
    const s = scenario('GEN-001', 'GEN-007');
    s.players[0].deck = [{ uid: 'x1', cardId: 'GEN-071' }, { uid: 'x2', cardId: 'GEN-004' }, { uid: 'x3', cardId: 'GEN-002' }];
    const [scope, spoon] = giveHand(s, 0, ['GEN-072', 'GEN-073']);
    let t = act(s, 0, { type: 'playTrainer', handUid: scope.uid });
    expect(t.players[0].hand.map((c) => c.cardId)).toContain('GEN-004');
    t = act(t, 0, { type: 'playBasic', handUid: 'x2' });
    t.players[0].active!.status = ['poisoned'];
    t = act(t, 0, { type: 'playTrainer', handUid: spoon.uid, targetUid: 'x2' });
    expect(t.players[0].active!.cardId).toBe('GEN-004');
    expect(t.players[0].bench[0].status).toEqual([]);
  });
  it('supporter: one per turn; draw and damage boost work', () => {
    const s = scenario('GEN-001', 'GEN-007', { aExtra: { energy: ['verdant'] } });
    const [nieve, rocky] = giveHand(s, 0, ['GEN-081', 'GEN-082']);
    const handBefore = s.players[0].hand.length;
    let t = act(s, 0, { type: 'playTrainer', handUid: nieve.uid });
    expect(t.players[0].hand.length).toBe(handBefore - 1 + 2);
    expect(applyAction(t, 0, { type: 'playTrainer', handUid: rocky.uid }).ok).toBe(false);
    const u = scenario('GEN-001', 'GEN-007', { aExtra: { energy: ['verdant'] } });
    const [r2] = giveHand(u, 0, ['GEN-082']);
    t = act(u, 0, { type: 'playTrainer', handUid: r2.uid });
    t = act(t, 0, { type: 'attack', index: 0 });
    expect(t.players[1].active!.damage).toBe(30);
    expect(t.buffs).toHaveLength(0); // boost expired at end of turn
  });
  it('tool and terrain modify HP', () => {
    const s = scenario('GEN-001', 'GEN-007', { aExtra: { damage: 75 } });
    const [shield, fest] = giveHand(s, 0, ['GEN-090', 'GEN-095']);
    let t = act(s, 0, { type: 'playTrainer', handUid: shield.uid, targetUid: s.players[0].active!.uid });
    expect(t.players[0].active!.tool?.cardId).toBe('GEN-090');
    expect(legalActions(t, 0).some((a) => a.type === 'playTrainer' && a.handUid === 'nope')).toBe(false);
    t = act(t, 0, { type: 'playTrainer', handUid: fest.uid });
    expect(t.terrain?.card.cardId).toBe('GEN-095');
    // 70 base + 20 shield + 10 terrain = 100 → 75 damage + 20 poison would not KO
    t.players[0].active!.status = ['poisoned'];
    t = act(t, 0, { type: 'endTurn' });
    expect(t.players[0].active!.damage).toBe(85);
  });
});

describe('status conditions', () => {
  it('poison and burn deal damage at checkup', () => {
    const s = scenario('GEN-001', 'GEN-007', { bExtra: { status: ['poisoned'] } });
    expect(act(s, 0, { type: 'endTurn' }).players[1].active!.damage).toBe(10);
    const b = scenario('GEN-001', 'GEN-007', { bExtra: { status: ['burned'] } });
    expect(act(b, 0, { type: 'endTurn' }).players[1].active!.damage).toBe(20);
  });
  it('asleep and paralyzed block attacking and retreating', () => {
    for (const st of ['asleep', 'paralyzed'] as const) {
      const s = scenario('GEN-001', 'GEN-007', { aExtra: { energy: ['verdant', 'verdant'], status: [st] } });
      s.players[0].bench.push(creature('GEN-004'));
      const legal = legalActions(s, 0);
      expect(legal.some((a) => a.type === 'attack')).toBe(false);
      expect(legal.some((a) => a.type === 'retreat')).toBe(false);
    }
  });
  it('paralysis wears off after the affected player’s turn', () => {
    const s = scenario('GEN-019', 'GEN-007', { aExtra: { energy: ['volt'] } });
    const t = withSeedFor(s, 0, { type: 'attack', index: 0 }, (st) => st.players[1].active!.status.includes('paralyzed'));
    expect(legalActions(t, 1).some((a) => a.type === 'attack')).toBe(false);
    const u = act(t, 1, { type: 'endTurn' });
    expect(u.players[1].active!.status).not.toContain('paralyzed');
  });
  it('sleep can wake on a coin flip; confusion can fail an attack', () => {
    const s = scenario('GEN-001', 'GEN-007', { bExtra: { status: ['asleep'] } });
    withSeedFor(s, 0, { type: 'endTurn' }, (st) => st.players[1].active!.status.includes('asleep'));
    withSeedFor(s, 0, { type: 'endTurn' }, (st) => !st.players[1].active!.status.includes('asleep'));
    const c = scenario('GEN-001', 'GEN-007', { aExtra: { energy: ['verdant'], status: ['confused'] } });
    withSeedFor(c, 0, { type: 'attack', index: 0 }, (st) => st.players[1].active!.damage === 0);
    withSeedFor(c, 0, { type: 'attack', index: 0 }, (st) => st.players[1].active!.damage === 20);
  });
  it('poison from an attack persists into checkup', () => {
    const s = scenario('GEN-012', 'GEN-001', { aExtra: { energy: ['shade', 'shade'] } });
    const t = act(s, 0, { type: 'attack', index: 1 });
    expect(t.players[1].active!.status).toContain('poisoned');
    expect(t.players[1].active!.damage).toBe(30); // 20 attack + 10 poison at checkup
  });
});

describe('retreat', () => {
  it('discards essence equal to the retreat cost, once per turn', () => {
    const s = scenario('GEN-001', 'GEN-007', { aExtra: { energy: ['verdant', 'blaze'] } });
    const b1 = creature('GEN-004');
    const b2 = creature('GEN-010');
    s.players[0].bench.push(b1, b2);
    const t = act(s, 0, { type: 'retreat', benchUid: b1.uid });
    expect(t.players[0].active!.uid).toBe(b1.uid);
    expect(t.players[0].bench.find((c) => c.cardId === 'GEN-001')!.energy).toHaveLength(1);
    expect(applyAction(t, 0, { type: 'retreat', benchUid: b2.uid }).ok).toBe(false);
  });
});

describe('knockouts and victory', () => {
  it('awards points, requires a promotion, then continues', () => {
    const s = scenario('GEN-005', 'GEN-007', { aExtra: { energy: ['blaze', 'blaze', 'blaze'] }, bExtra: { damage: 20 } });
    const bench = creature('GEN-019');
    s.players[1].bench.push(bench);
    let t = act(s, 0, { type: 'attack', index: 1 });
    expect(t.players[0].points).toBe(1);
    expect(t.players[1].active).toBeNull();
    expect(t.pending).toEqual([{ player: 1, kind: 'promote' }]);
    expect(t.players[1].discard.map((c) => c.cardId)).toContain('GEN-007');
    expect(applyAction(t, 0, { type: 'endTurn' }).ok).toBe(false);
    t = act(t, 1, { type: 'promote', benchUid: bench.uid });
    expect(t.players[1].active!.uid).toBe(bench.uid);
    expect(t.current).toBe(1);
    expect(t.turn).toBe(4);
  });
  it('Prime creatures are worth 2 points; reaching 3 points wins', () => {
    const s = scenario('GEN-005', 'GEN-060', { aExtra: { energy: ['blaze', 'blaze', 'blaze'] }, bExtra: { damage: 120 } });
    s.players[0].points = 1;
    s.players[1].bench.push(creature('GEN-019'));
    const t = act(s, 0, { type: 'attack', index: 1 });
    expect(t.players[0].points).toBe(3);
    expect(t.phase).toBe('over');
    expect(t.winner).toBe(0);
    expect(t.winReason).toBe('points');
    expect(legalActions(t, 0)).toEqual([]);
  });
  it('a player with no creatures left loses', () => {
    const s = scenario('GEN-005', 'GEN-007', { aExtra: { energy: ['blaze', 'blaze', 'blaze'] }, bExtra: { damage: 40 } });
    const t = act(s, 0, { type: 'attack', index: 1 });
    expect(t.winner).toBe(0);
    expect(t.winReason).toBe('noCreatures');
  });
  it('checkup knockouts are scored and can end the game', () => {
    const s = scenario('GEN-001', 'GEN-007', { bExtra: { damage: 60, status: ['poisoned'] } });
    const t = act(s, 0, { type: 'endTurn' });
    expect(t.players[0].points).toBe(1);
    expect(t.winner).toBe(0);
  });
  it('concede and turn limit end the match', () => {
    const s = quickSetup(newMatch());
    const c = act(s, 1, { type: 'concede' });
    expect(c.winner).toBe(0);
    expect(c.winReason).toBe('concede');
    let t = structuredClone(s);
    t.rules = { ...t.rules, maxTurns: 2 };
    t = act(t, 0, { type: 'endTurn' });
    t = act(t, 1, { type: 'endTurn' });
    expect(t.phase).toBe('over');
    expect(t.winReason).toBe('turnLimit');
    expect(t.winner).toBe('draw');
  });
});

describe('invalid actions', () => {
  it('rejects acting out of turn, malformed payloads and unknown uids', () => {
    const s = quickSetup(newMatch());
    expect(applyAction(s, 1, { type: 'endTurn' }).ok).toBe(false);
    expect(applyAction(s, 0, { type: 'attack', index: 5 }).ok).toBe(false);
    expect(applyAction(s, 0, { type: 'playBasic', handUid: 'nope' }).ok).toBe(false);
    expect(applyAction(s, 0, { type: 'hack' } as never).ok).toBe(false);
    expect(applyAction(s, 0, null as never).ok).toBe(false);
    expect(applyAction(s, 0, { type: 'attack', index: '0' } as never).ok).toBe(false);
  });
  it('never mutates the input state', () => {
    const s = quickSetup(newMatch());
    const snap = JSON.stringify(s);
    act(s, 0, { type: 'endTurn' });
    expect(JSON.stringify(s)).toBe(snap);
  });
});

describe('player views', () => {
  it('hide the opponent hand, deck order and rng', () => {
    const s = quickSetup(newMatch());
    const v = getPlayerView(s, 0);
    expect(v.opponent.hand).toBeNull();
    expect(v.opponent.deckContents).toBeNull();
    expect(v.you.hand).toHaveLength(s.players[0].hand.length);
    expect(JSON.stringify(v)).not.toContain('"rng"');
    expect(v.you.deckContents).toHaveLength(s.players[0].deck.length);
    const json = JSON.stringify(v);
    for (const c of s.players[1].hand) expect(json).not.toContain(`"${c.uid}"`);
  });
  it('hide the opponent setup choices until both players are ready', () => {
    let s = newMatch();
    s = act(s, 0, legalActions(s, 0).find((a) => a.type === 'setupActive')!);
    const v = getPlayerView(s, 1);
    expect(v.opponent.active).toBeNull();
    expect(v.opponent.handCount).toBe(5);
    expect(HIDDEN_CARD).toBe('__hidden__');
  });
});
