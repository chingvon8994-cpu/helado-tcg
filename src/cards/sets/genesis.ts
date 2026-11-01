import type { CardDef } from '../types';
import { variant } from '../variant';

/**
 * Expansion 001 — GENESIS.
 * The first 14 entries form the engine "test collection" used by the automated test-suite;
 * they cover basics, evolutions, five elements, statuses, a Prime, and every trainer kind.
 */
export const GENESIS: CardDef[] = [
  // ── Test collection ──────────────────────────────────────────────────────────────
  {
    id: 'GEN-001', name: 'Citriman', species: 'Citriman', expansion: 'genesis', number: 1, rarity: 'common',
    category: 'creature', element: 'verdant', stage: 'basic', hp: 70, weakness: 'blaze', retreat: 1,
    art: { image: 'citriman', scene: 'meadow' },
    attacks: [
      { name: 'Zest Slap', cost: ['verdant'], damage: 20 },
      { name: 'Peel Tackle', cost: ['verdant', 'neutral'], damage: 30, effects: [{ type: 'heal', target: 'self', amount: 10 }] },
    ],
    flavor: 'It rubs fresh citrus oil on its scales to keep pests away from the orchard.',
  },
  {
    id: 'GEN-002', name: 'Crocshot', species: 'Crocshot', expansion: 'genesis', number: 2, rarity: 'uncommon',
    category: 'creature', element: 'verdant', stage: 'stage1', evolvesFrom: 'Citriman', hp: 100, weakness: 'blaze', retreat: 2,
    art: { image: 'crocshot', scene: 'meadow' },
    attacks: [
      { name: 'Seed Volley', cost: ['verdant'], damage: 20, mods: [{ mode: 'coinFlips', flips: 2, perHeads: 20 }], damageSuffix: '+' },
      { name: 'Thornback Rush', cost: ['verdant', 'verdant', 'neutral'], damage: 70 },
    ],
    flavor: 'The spines on its back grow a little longer after every rainstorm.',
  },
  {
    id: 'GEN-004', name: 'Axolitl', species: 'Axolitl', expansion: 'genesis', number: 4, rarity: 'common',
    category: 'creature', element: 'blaze', stage: 'basic', hp: 60, weakness: 'tide', retreat: 1,
    art: { image: 'axolitl', scene: 'volcano' },
    attacks: [
      { name: 'Ember Gill', cost: ['blaze'], damage: 10, effects: [{ type: 'applyStatus', target: 'opponentActive', status: 'burned' }] },
      { name: 'Hot Splash', cost: ['blaze', 'neutral'], damage: 40 },
    ],
    flavor: 'The frills on its head glow brighter the happier it gets.',
  },
  {
    id: 'GEN-005', name: 'Axofuegl', species: 'Axofuegl', expansion: 'genesis', number: 5, rarity: 'uncommon',
    category: 'creature', element: 'blaze', stage: 'stage1', evolvesFrom: 'Axolitl', hp: 90, weakness: 'tide', retreat: 1,
    art: { image: 'axofuegl', scene: 'volcano' },
    attacks: [
      { name: 'Flare Frill', cost: ['blaze', 'neutral'], damage: 40, mods: [{ mode: 'ifStatus', status: 'burned', bonus: 30 }], damageSuffix: '+' },
      { name: 'Drought Wave', cost: ['blaze', 'blaze', 'neutral'], damage: 90, effects: [{ type: 'discardEnergy', target: 'self', count: 1, element: 'blaze' }] },
    ],
    flavor: 'Lakes it swims in have been known to boil dry overnight.',
  },
  {
    id: 'GEN-007', name: 'Nekocean', species: 'Nekocean', expansion: 'genesis', number: 7, rarity: 'common',
    category: 'creature', element: 'tide', stage: 'basic', hp: 70, weakness: 'volt', retreat: 1,
    art: { image: 'nekocean', scene: 'reef' },
    attacks: [
      { name: 'Splash Pounce', cost: ['tide'], damage: 20 },
      { name: 'Riptide Bite', cost: ['tide', 'tide'], damage: 40, mods: [{ mode: 'ifDamaged', side: 'opponent', bonus: 20 }], damageSuffix: '+' },
    ],
    flavor: 'Curious and fearless, it paddles out to greet passing ferries.',
  },
  {
    id: 'GEN-019', name: 'Chuchilli', species: 'Chuchilli', expansion: 'genesis', number: 19, rarity: 'common',
    category: 'creature', element: 'volt', stage: 'basic', hp: 60, weakness: 'brawl', retreat: 1,
    art: { image: 'chuchilli', scene: 'storm' },
    attacks: [
      { name: 'Static Nip', cost: ['volt'], damage: 10, effects: [{ type: 'applyStatus', target: 'opponentActive', status: 'paralyzed', coin: true }] },
      { name: 'Spicy Spark', cost: ['volt', 'volt'], damage: 50 },
    ],
    flavor: 'It stores the heat of the chillies it eats as crackling static.',
  },
  {
    id: 'GEN-010', name: 'Nibblpig', species: 'Nibblpig', expansion: 'genesis', number: 10, rarity: 'common',
    category: 'creature', element: 'neutral', stage: 'basic', hp: 80, weakness: 'brawl', retreat: 2,
    art: { image: 'nibblpig', scene: 'parlor' },
    attacks: [
      { name: 'Snack Break', cost: ['neutral'], damage: 0, effects: [{ type: 'heal', target: 'self', amount: 30 }] },
      { name: 'Belly Flop', cost: ['neutral', 'neutral', 'neutral'], damage: 50, effects: [{ type: 'applyStatus', target: 'opponentActive', status: 'asleep', coin: true }] },
    ],
    flavor: 'It naps for eighteen hours a day and snacks for the other six.',
  },
  {
    id: 'GEN-012', name: 'Posteal', species: 'Posteal', expansion: 'genesis', number: 12, rarity: 'common',
    category: 'creature', element: 'shade', stage: 'basic', hp: 60, weakness: 'brawl', retreat: 1,
    art: { image: 'possteal', scene: 'grotto' },
    attacks: [
      { name: 'Pickpocket', cost: ['shade'], damage: 10, effects: [{ type: 'discardRandomFromOpponentHand', count: 1, coin: true }] },
      { name: 'Grimy Claw', cost: ['shade', 'neutral'], damage: 20, effects: [{ type: 'applyStatus', target: 'opponentActive', status: 'poisoned' }] },
    ],
    flavor: 'It hides the shiny trinkets it steals inside its curled tail.',
  },
  {
    id: 'GEN-060', name: 'Mazocotal Prime', species: 'Mazocotal', expansion: 'genesis', number: 60, rarity: 'double_rare', prime: true,
    category: 'creature', element: 'wyrm', stage: 'basic', hp: 140, retreat: 2,
    art: { image: 'mazocotal', scene: 'skyruins', foil: 'holo' },
    attacks: [
      { name: 'Emerald Gale', cost: ['verdant', 'neutral'], damage: 40, effects: [{ type: 'heal', target: 'allOwn', amount: 10 }] },
      { name: 'Winds of Creation', cost: ['verdant', 'volt', 'neutral'], damage: 110, effects: [{ type: 'discardEnergy', target: 'self', count: 1 }] },
    ],
    flavor: 'Old murals say its wingbeats scattered the first seeds across the Helado Region.',
  },
  {
    id: 'GEN-071', name: 'Sundae Salve', expansion: 'genesis', number: 71, rarity: 'common',
    category: 'trainer', trainerKind: 'item', art: { illustration: 'salve' },
    text: 'Heal 20 damage from 1 of your creatures.', condition: 'anyOwnDamaged',
    effects: [{ type: 'heal', target: 'chosenOwn', amount: 20 }],
  },
  {
    id: 'GEN-072', name: 'Sprinkle Scope', expansion: 'genesis', number: 72, rarity: 'common',
    category: 'trainer', trainerKind: 'item', art: { illustration: 'scope' },
    text: 'Put a random Basic creature from your deck into your hand.',
    effects: [{ type: 'searchDeck', filter: { category: 'creature', stage: 'basic' }, count: 1 }],
  },
  {
    id: 'GEN-073', name: 'Swap Spoon', expansion: 'genesis', number: 73, rarity: 'common',
    category: 'trainer', trainerKind: 'item', art: { illustration: 'spoon' },
    text: 'Switch your Active creature with 1 of your Benched creatures.', condition: 'hasBench',
    effects: [{ type: 'switchOwn' }],
  },
  {
    id: 'GEN-081', name: 'Doña Nieve', expansion: 'genesis', number: 81, rarity: 'uncommon',
    category: 'trainer', trainerKind: 'supporter', art: { illustration: 'nieve' },
    text: 'Draw 2 cards.',
    effects: [{ type: 'draw', count: 2 }],
    flavor: 'The parlor owner who has served every champion in the region.',
  },
  {
    id: 'GEN-082', name: 'Coach Rocky', expansion: 'genesis', number: 82, rarity: 'uncommon',
    category: 'trainer', trainerKind: 'supporter', art: { illustration: 'rocky' },
    text: 'During this turn, attacks used by your creatures do +10 damage to your opponent’s Active creature.',
    effects: [{ type: 'turnDamageBoost', amount: 10 }],
  },
  {
    id: 'GEN-090', name: 'Waffle Cone Shield', expansion: 'genesis', number: 90, rarity: 'uncommon',
    category: 'trainer', trainerKind: 'tool', art: { illustration: 'waffle' },
    text: 'The creature this card is attached to gets +20 HP.',
    tool: { type: 'hpBonus', amount: 20 },
  },
  {
    id: 'GEN-095', name: 'Sprinkle Festival', expansion: 'genesis', number: 95, rarity: 'uncommon',
    category: 'trainer', trainerKind: 'terrain', art: { illustration: 'festival' },
    text: 'Both players’ Basic creatures get +10 HP.',
    field: [{ type: 'hpBonus', amount: 10, filter: { stage: 'basic' } }],
  },
  // ── Genesis expansion ─────────────────────────────────────────────────────────────
  {
    id: 'GEN-003', name: 'Spinoscope', species: 'Spinoscope', expansion: 'genesis', number: 3, rarity: 'rare',
    category: 'creature', element: 'verdant', stage: 'stage2', evolvesFrom: 'Crocshot', hp: 150, weakness: 'blaze', retreat: 3,
    art: { image: 'spinoscope', scene: 'meadow', foil: 'holo' },
    ability: { kind: 'passive', name: 'Bramble Hide', passive: { type: 'thorns', amount: 20, activeOnly: true } },
    attacks: [
      { name: 'Gatling Seed', cost: ['verdant', 'verdant'], damage: 30, mods: [{ mode: 'coinFlips', flips: 4, perHeads: 30 }], damageSuffix: '+' },
      { name: 'Overgrowth Crush', cost: ['verdant', 'verdant', 'neutral', 'neutral'], damage: 130 },
    ],
    flavor: 'It aims through the crystal lens on its crest before firing a hail of seeds.',
  },
  {
    id: 'GEN-006', name: 'Axoplazma', species: 'Axoplazma', expansion: 'genesis', number: 6, rarity: 'rare',
    category: 'creature', element: 'blaze', stage: 'stage2', evolvesFrom: 'Axofuegl', hp: 140, weakness: 'tide', retreat: 2,
    art: { image: 'axoplazma', scene: 'volcano', foil: 'holo' },
    attacks: [
      { name: 'Plasma Frill', cost: ['blaze'], damage: 30, effects: [{ type: 'applyStatus', target: 'opponentActive', status: 'burned' }] },
      { name: 'Plazma Blast', cost: ['blaze', 'blaze', 'neutral'], damage: 80, mods: [{ mode: 'perExtraEnergy', element: 'blaze', per: 30, max: 2 }], damageSuffix: '+' },
    ],
    flavor: 'Arcs of superheated plasma dance between the tips of its fins.',
  },
  {
    id: 'GEN-008', name: 'Jetguar', species: 'Jetguar', expansion: 'genesis', number: 8, rarity: 'uncommon',
    category: 'creature', element: 'tide', stage: 'stage1', evolvesFrom: 'Nekocean', hp: 100, weakness: 'volt', retreat: 1,
    art: { image: 'jetguar', scene: 'reef' },
    attacks: [
      { name: 'Jet Pounce', cost: ['tide'], damage: 30 },
      { name: 'Strong Jaw', cost: ['tide', 'tide', 'neutral'], damage: 70, mods: [{ mode: 'ifDamaged', side: 'opponent', bonus: 20 }], damageSuffix: '+' },
    ],
    flavor: 'It propels itself with bursts of seawater from its shoulder vents.',
  },
  {
    id: 'GEN-009', name: 'Sabrine', species: 'Sabrine', expansion: 'genesis', number: 9, rarity: 'rare',
    category: 'creature', element: 'tide', stage: 'stage2', evolvesFrom: 'Jetguar', hp: 150, weakness: 'volt', retreat: 2,
    art: { image: 'sabrine', scene: 'glacier', foil: 'holo' },
    attacks: [
      { name: 'Undertow', cost: ['tide'], damage: 30, effects: [{ type: 'switchOpponent' }] },
      { name: 'Jet Jaw', cost: ['tide', 'tide', 'neutral'], damage: 110 },
    ],
    flavor: 'Its saber fangs are formed of ice that never melts, even in tropical seas.',
  },
  {
    id: 'GEN-011', name: 'Chubybara', species: 'Chubybara', expansion: 'genesis', number: 11, rarity: 'uncommon',
    category: 'creature', element: 'neutral', stage: 'stage1', evolvesFrom: 'Nibblpig', hp: 120, weakness: 'brawl', retreat: 3,
    art: { image: 'chubybara', scene: 'parlor' },
    ability: { kind: 'passive', name: 'Thick Fluff', passive: { type: 'damageReduction', amount: 10 } },
    attacks: [
      { name: 'Citrus Bonk', cost: ['neutral', 'neutral'], damage: 40 },
      { name: 'Hot Spring Soak', cost: ['neutral', 'neutral', 'neutral'], damage: 70, effects: [{ type: 'heal', target: 'self', amount: 20 }] },
    ],
    flavor: 'Wild fruit grows from its back. Other creatures nap against it for warmth.',
  },
  {
    id: 'GEN-013', name: 'Klepossum', species: 'Klepossum', expansion: 'genesis', number: 13, rarity: 'uncommon',
    category: 'creature', element: 'shade', stage: 'stage1', evolvesFrom: 'Posteal', hp: 90, weakness: 'brawl', retreat: 1,
    art: { image: 'klepossum', scene: 'grotto' },
    ability: { kind: 'activated', name: 'Sans Trace', requiresActive: true, effects: [{ type: 'discardRandomFromOpponentHand', count: 1, coin: true }] },
    attacks: [
      { name: 'Ambush', cost: ['shade', 'neutral'], damage: 30, mods: [{ mode: 'coinFlips', flips: 1, perHeads: 30 }], damageSuffix: '+' },
      { name: 'Ransack', cost: ['shade', 'shade', 'neutral'], damage: 60, mods: [{ mode: 'ifStatus', bonus: 40 }], damageSuffix: '+' },
    ],
    flavor: 'Once per night it raids a different household, never the same one twice.',
  },
  {
    id: 'GEN-014', name: 'Puffun', species: 'Puffun', expansion: 'genesis', number: 14, rarity: 'common',
    category: 'creature', element: 'neutral', stage: 'basic', hp: 60, weakness: 'volt', retreat: 1,
    art: { image: 'puffun', scene: 'parlor' },
    attacks: [{ name: 'Big Peck', cost: ['neutral'], damage: 20, mods: [{ mode: 'coinFlips', flips: 1, perHeads: 10 }], damageSuffix: '+' }],
    flavor: 'It waddles across ice floes and slides down slopes on its round belly.',
  },
  {
    id: 'GEN-015', name: 'Pufflow', species: 'Pufflow', expansion: 'genesis', number: 15, rarity: 'uncommon',
    category: 'creature', element: 'neutral', stage: 'stage1', evolvesFrom: 'Puffun', hp: 100, weakness: 'volt', retreat: 0,
    art: { image: 'pufflow', scene: 'skyruins' },
    ability: { kind: 'activated', name: 'Tailwind', effects: [{ type: 'turnRetreatReduction', amount: 2 }] },
    attacks: [{ name: 'Gale Wings', cost: ['neutral', 'neutral'], damage: 50 }],
    flavor: 'It rides the high winds for days without flapping once.',
  },
  {
    id: 'GEN-016', name: 'Kappish', species: 'Kappish', expansion: 'genesis', number: 16, rarity: 'common',
    category: 'creature', element: 'psyche', stage: 'basic', hp: 60, weakness: 'shade', retreat: 1,
    art: { image: 'kappish', scene: 'aurora' },
    attacks: [
      { name: 'Cursed Touch', cost: ['psyche'], damage: 10, effects: [{ type: 'applyStatus', target: 'opponentActive', status: 'confused', coin: true }] },
      { name: 'Spooky Puff', cost: ['psyche', 'neutral'], damage: 30 },
    ],
    flavor: 'Its cap swells with mysterious gas whenever someone is frightened nearby.',
  },
  {
    id: 'GEN-017', name: 'Kapboom', species: 'Kapboom', expansion: 'genesis', number: 17, rarity: 'uncommon',
    category: 'creature', element: 'psyche', stage: 'stage1', evolvesFrom: 'Kappish', hp: 100, weakness: 'shade', retreat: 2,
    art: { image: 'kapboom', scene: 'aurora' },
    attacks: [
      { name: 'Unstable Molecules', cost: ['psyche', 'neutral'], damage: 40, effects: [{ type: 'damage', target: 'allOpponentBench', amount: 10 }] },
      { name: 'Spore Burst', cost: ['psyche', 'psyche', 'neutral'], damage: 120, recoil: 30 },
    ],
    flavor: 'The plume on its head is a chain reaction waiting to happen.',
  },
  {
    id: 'GEN-018', name: 'Rammi', species: 'Rammi', expansion: 'genesis', number: 18, rarity: 'common',
    category: 'creature', element: 'brawl', stage: 'basic', hp: 70, weakness: 'psyche', retreat: 2,
    art: { image: 'rammi', scene: 'canyon' },
    attacks: [
      { name: 'Headbutt', cost: ['brawl'], damage: 20 },
      { name: 'Reckless Ram', cost: ['brawl', 'neutral'], damage: 50, recoil: 10 },
    ],
    flavor: 'It bonks boulders all day to toughen its helmet-like skull.',
  },
  {
    id: 'GEN-020', name: 'Tsuraichu', species: 'Tsuraichu', expansion: 'genesis', number: 20, rarity: 'uncommon',
    category: 'creature', element: 'volt', stage: 'stage1', evolvesFrom: 'Chuchilli', hp: 100, weakness: 'brawl', retreat: 1,
    art: { image: 'tsuraichu', scene: 'storm' },
    attacks: [
      { name: 'Flash Fire', cost: ['volt'], damage: 30, effects: [{ type: 'applyStatus', target: 'opponentActive', status: 'burned', coin: true }] },
      { name: 'Overcharge', cost: ['volt', 'volt', 'neutral'], damage: 60, mods: [{ mode: 'perEnergy', side: 'self', per: 10 }], damageSuffix: '+' },
    ],
    flavor: 'It discharges a shower of sparks shaped like chilli peppers.',
  },
  {
    id: 'GEN-021', name: 'Bugbarian', species: 'Bugbarian', expansion: 'genesis', number: 21, rarity: 'uncommon',
    category: 'creature', element: 'brawl', stage: 'stage1', evolvesFrom: 'Rammi', hp: 100, weakness: 'psyche', retreat: 2,
    art: { image: 'bugbarian', scene: 'canyon' },
    attacks: [
      { name: 'Horn Hook', cost: ['brawl'], damage: 30 },
      { name: 'Berserk Charge', cost: ['brawl', 'brawl', 'neutral'], damage: 60, mods: [{ mode: 'perDamageOnSelf', per: 10 }], damageSuffix: '+' },
    ],
    flavor: 'The more battles it survives, the wilder its fighting style becomes.',
  },
  {
    id: 'GEN-022', name: 'Crakapace', species: 'Crakapace', expansion: 'genesis', number: 22, rarity: 'rare',
    category: 'creature', element: 'brawl', stage: 'stage2', evolvesFrom: 'Bugbarian', hp: 150, weakness: 'psyche', retreat: 3,
    art: { image: 'crakapace', scene: 'grotto', foil: 'holo' },
    ability: { kind: 'passive', name: 'Perish Shell', passive: { type: 'damageReduction', amount: 20, activeOnly: true } },
    attacks: [
      { name: 'Ghastly Fist', cost: ['brawl', 'neutral'], damage: 50, effects: [{ type: 'weakenOpponent', amount: 20 }] },
      { name: 'Soul Quake', cost: ['brawl', 'brawl', 'neutral', 'neutral'], damage: 140, effects: [{ type: 'damage', target: 'allOwnBench', amount: 10 }] },
    ],
    flavor: 'Spirit flames leak through the cracks in its ancient shell.',
  },
  {
    id: 'GEN-023', name: 'Pokeypine', species: 'Pokeypine', expansion: 'genesis', number: 23, rarity: 'common',
    category: 'creature', element: 'neutral', stage: 'basic', hp: 60, weakness: 'brawl', retreat: 1,
    art: { image: 'pokeypine', scene: 'meadow' },
    attacks: [{ name: 'Quill Jab', cost: ['neutral'], damage: 10, effects: [{ type: 'applyStatus', target: 'opponentActive', status: 'poisoned', coin: true }] }],
    flavor: 'Its quills are soft as a brush until it gets annoyed.',
  },
  {
    id: 'GEN-024', name: 'Punkypine', species: 'Punkypine', expansion: 'genesis', number: 24, rarity: 'uncommon',
    category: 'creature', element: 'neutral', stage: 'stage1', evolvesFrom: 'Pokeypine', hp: 100, weakness: 'brawl', retreat: 1,
    art: { image: 'punkypine', scene: 'canyon' },
    ability: { kind: 'passive', name: 'Iron Barbs', passive: { type: 'thorns', amount: 20, activeOnly: true } },
    attacks: [{ name: 'Mosh Pit', cost: ['neutral', 'neutral', 'neutral'], damage: 60, mods: [{ mode: 'perBench', side: 'opponent', per: 10 }], damageSuffix: '+' }],
    flavor: 'It spikes its quills into wild shapes before every fight.',
  },
  {
    id: 'GEN-025', name: 'Pastelot', species: 'Pastelot', expansion: 'genesis', number: 25, rarity: 'common',
    category: 'creature', element: 'psyche', stage: 'basic', hp: 60, weakness: 'shade', retreat: 1,
    art: { image: 'pastelot', scene: 'parlor' },
    attacks: [
      { name: 'Sweet Veil', cost: ['psyche'], damage: 0, effects: [{ type: 'heal', target: 'allOwn', amount: 10 }, { type: 'cureStatus', target: 'allOwn' }] },
      { name: 'Pastry Toss', cost: ['psyche', 'neutral'], damage: 30 },
    ],
    flavor: 'It smells faintly of fresh pastry and loves to be carried around.',
  },
  {
    id: 'GEN-026', name: 'Coxinrawr', species: 'Coxinrawr', expansion: 'genesis', number: 26, rarity: 'uncommon',
    category: 'creature', element: 'psyche', stage: 'stage1', evolvesFrom: 'Pastelot', hp: 100, weakness: 'shade', retreat: 1,
    art: { image: 'coxinrawr', scene: 'parlor' },
    attacks: [
      { name: 'Prankster Pounce', cost: ['psyche'], damage: 30, effects: [{ type: 'applyStatus', target: 'opponentActive', status: 'confused' }] },
      { name: 'Well-Baked Bash', cost: ['psyche', 'psyche', 'neutral'], damage: 80, mods: [{ mode: 'ifStatus', status: 'confused', bonus: 30 }], damageSuffix: '+' },
    ],
    flavor: 'Its golden crust is surprisingly hard. Its manners, less so.',
  },
  // Primes
  {
    id: 'GEN-061', name: 'Axoplazma Prime', species: 'Axoplazma', expansion: 'genesis', number: 61, rarity: 'double_rare', prime: true,
    category: 'creature', element: 'blaze', stage: 'stage2', evolvesFrom: 'Axofuegl', hp: 180, weakness: 'tide', retreat: 2,
    art: { image: 'axoplazma', scene: 'sunburst', fullArt: false, foil: 'holo' },
    attacks: [
      { name: 'Drought Dance', cost: ['blaze'], damage: 0, effects: [{ type: 'attachEssence', target: 'self', element: 'blaze', count: 1 }, { type: 'applyStatus', target: 'opponentActive', status: 'burned' }] },
      { name: 'Prime Plazma', cost: ['blaze', 'blaze', 'blaze', 'neutral'], damage: 180, effects: [{ type: 'discardEnergy', target: 'self', count: 2, element: 'blaze' }] },
    ],
    flavor: 'When it reaches full power the surrounding air turns to plasma.',
  },
  {
    id: 'GEN-062', name: 'Sabrine Prime', species: 'Sabrine', expansion: 'genesis', number: 62, rarity: 'double_rare', prime: true,
    category: 'creature', element: 'tide', stage: 'stage2', evolvesFrom: 'Jetguar', hp: 180, weakness: 'volt', retreat: 2,
    art: { image: 'sabrine', scene: 'glacier', foil: 'holo' },
    attacks: [
      { name: 'Riptide Fang', cost: ['tide', 'tide'], damage: 70, mods: [{ mode: 'ifOpponentPrime', bonus: 50 }], damageSuffix: '+' },
      { name: 'Glacial Torrent', cost: ['tide', 'tide', 'tide', 'neutral'], damage: 120, effects: [{ type: 'damage', target: 'chosenOpponentBench', amount: 30 }] },
    ],
    flavor: 'Entire bays freeze solid in the wake of its charge.',
  },
  // Trainers
  {
    id: 'GEN-074', name: 'Brain Freeze Bell', expansion: 'genesis', number: 74, rarity: 'uncommon',
    category: 'trainer', trainerKind: 'item', art: { illustration: 'bell' },
    text: 'Flip a coin. If heads, your opponent’s Active creature is now Asleep.',
    effects: [{ type: 'applyStatus', target: 'opponentActive', status: 'asleep', coin: true }],
  },
  {
    id: 'GEN-075', name: 'Fudge Pouch', expansion: 'genesis', number: 75, rarity: 'common',
    category: 'trainer', trainerKind: 'item', art: { illustration: 'pouch' },
    text: 'Remove all status conditions from your Active creature and heal 10 damage from it.', condition: 'ownActiveHasStatus',
    effects: [{ type: 'cureStatus', target: 'ownActive' }, { type: 'heal', target: 'ownActive', amount: 10 }],
  },
  {
    id: 'GEN-083', name: 'Scout Menta', expansion: 'genesis', number: 83, rarity: 'rare',
    category: 'trainer', trainerKind: 'supporter', art: { illustration: 'menta' },
    text: 'Switch your opponent’s Active creature with 1 of their Benched creatures.', condition: 'opponentHasBench',
    effects: [{ type: 'switchOpponent' }],
  },
  {
    id: 'GEN-091', name: 'Cherry Charm', expansion: 'genesis', number: 91, rarity: 'uncommon',
    category: 'trainer', trainerKind: 'tool', art: { illustration: 'cherry' },
    text: 'Attacks used by the creature this card is attached to do +10 damage to your opponent’s Active creature.',
    tool: { type: 'damageBonus', amount: 10 },
  },
  // Alternate-art prints
  variant({ id: 'GEN-101', name: 'Citriman', variantOf: 'GEN-001', expansion: 'genesis', number: 101, rarity: 'illustration_rare', art: { image: 'citriman', scene: 'sunburst', fullArt: true, foil: 'rainbow' } }),
  variant({ id: 'GEN-102', name: 'Axolitl', variantOf: 'GEN-004', expansion: 'genesis', number: 102, rarity: 'illustration_rare', art: { image: 'axolitl', scene: 'volcano', fullArt: true, foil: 'rainbow' } }),
  variant({ id: 'GEN-103', name: 'Nekocean', variantOf: 'GEN-007', expansion: 'genesis', number: 103, rarity: 'illustration_rare', art: { image: 'nekocean', scene: 'reef', fullArt: true, foil: 'rainbow' } }),
  variant({ id: 'GEN-104', name: 'Axoplazma Prime', variantOf: 'GEN-061', expansion: 'genesis', number: 104, rarity: 'ultra_rare', art: { image: 'axoplazma', scene: 'nebula', fullArt: true, foil: 'cosmic' } }),
  variant({ id: 'GEN-105', name: 'Mazocotal Prime', variantOf: 'GEN-060', expansion: 'genesis', number: 105, rarity: 'secret_rare', art: { image: 'mazocotal', scene: 'eclipse', fullArt: true, foil: 'gold' } }),
];
