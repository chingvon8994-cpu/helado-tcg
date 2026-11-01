/**
 * Card schema. Every card in every expansion is described purely with data from this file;
 * the battle engine interprets these structures and never references individual card IDs.
 * Adding a card = writing a definition. Adding a new *kind* of effect = adding one union member
 * here plus one case in src/engine/effects.ts.
 */

export const ELEMENTS = ['verdant', 'blaze', 'tide', 'volt', 'psyche', 'brawl', 'shade', 'alloy', 'wyrm', 'neutral'] as const;
export type Element = (typeof ELEMENTS)[number];
/** Elements that can be generated as Essence (energy). Wyrm/Neutral creatures use mixed costs. */
export const ESSENCE_ELEMENTS = ['verdant', 'blaze', 'tide', 'volt', 'psyche', 'brawl', 'shade', 'alloy'] as const;
export type EssenceElement = (typeof ESSENCE_ELEMENTS)[number];

export type Rarity = 'common' | 'uncommon' | 'rare' | 'double_rare' | 'illustration_rare' | 'ultra_rare' | 'secret_rare';
export const RARITY_ORDER: Rarity[] = ['common', 'uncommon', 'rare', 'double_rare', 'illustration_rare', 'ultra_rare', 'secret_rare'];

export type Status = 'asleep' | 'paralyzed' | 'poisoned' | 'burned' | 'confused';
export type Stage = 'basic' | 'stage1' | 'stage2';

/** Who an effect points at. "chosen*" selectors require the acting player to pick a target. */
export type TargetSel =
  | 'self' // the creature using the attack/ability (for trainers: your active)
  | 'ownActive'
  | 'opponentActive'
  | 'chosenOwn'
  | 'chosenOwnBench'
  | 'chosenOpponent'
  | 'chosenOpponentBench'
  | 'allOwn'
  | 'allOwnBench'
  | 'allOpponentBench'
  | 'randomOpponent';

export interface CardFilter {
  category?: 'creature' | 'trainer';
  stage?: Stage;
  element?: Element;
  trainerKind?: TrainerKind;
  evolvesFromInPlay?: boolean; // creature that can evolve from something you have in play
}

/** One-shot effects used by attacks, trainer cards and activated abilities. */
export type Effect = (
  | { type: 'draw'; count: number }
  | { type: 'heal'; target: TargetSel; amount: number | 'all' }
  | { type: 'cureStatus'; target: TargetSel }
  | { type: 'applyStatus'; target: 'opponentActive' | 'self'; status: Status }
  | { type: 'damage'; target: TargetSel; amount: number } // direct damage, no weakness/resistance
  | { type: 'discardEnergy'; target: 'self' | 'opponentActive'; count: number | 'all'; element?: Element }
  | { type: 'attachEssence'; target: TargetSel; element: EssenceElement; count: number }
  | { type: 'attachEssenceFromDiscard'; target: TargetSel; element?: EssenceElement; count: number }
  | { type: 'moveEnergy'; from: 'chosenOwnBench' | 'ownActive'; to: 'ownActive' | 'chosenOwnBench'; count: number | 'all'; element?: Element }
  | { type: 'searchDeck'; filter: CardFilter; count: number }
  | { type: 'recoverFromDiscard'; filter: CardFilter; count: number }
  | { type: 'switchOwn' } // swap your active with a chosen benched creature (no retreat cost)
  | { type: 'switchOpponent' } // swap opponent's active with a chosen opponent benched creature
  | { type: 'returnToHand'; target: 'ownActive' | 'chosenOwnBench' } // creature + attached cards to hand/discard
  | { type: 'opponentShuffleHandDraw'; count: number }
  | { type: 'shuffleHandDraw'; count: number }
  | { type: 'discardRandomFromOpponentHand'; count: number }
  | { type: 'revealOpponentHand' }
  | { type: 'preventDamage'; target: 'self'; amount: number | 'all' } // during opponent's next turn
  | { type: 'reduceIncoming'; target: 'self'; amount: number } // during opponent's next turn
  | { type: 'weakenOpponent'; amount: number } // opponent active's attacks do -X next turn
  | { type: 'cantRetreat'; target: 'opponentActive' } // during opponent's next turn
  | { type: 'cantAttackNextTurn'; target: 'self' }
  | { type: 'turnDamageBoost'; amount: number; element?: Element } // your attacks this turn do +X
  | { type: 'turnRetreatReduction'; amount: number }
  | { type: 'gainPointOnKO' } // placeholder-free: if this attack KOs, gain 1 extra point
  | { type: 'shuffleDiscardIntoDeck'; count: number }
) & {
  /** Flip a coin first; effect happens only on heads. */
  coin?: boolean;
};

/** Ways an attack's printed damage can be modified. */
export type DamageMod =
  | { mode: 'coinFlips'; flips: number; perHeads: number } // printed damage is base; + perHeads × heads
  | { mode: 'coinOrNothing' } // tails → attack does nothing
  | { mode: 'flipUntilTails'; perHeads: number }
  | { mode: 'perEnergy'; side: 'self' | 'opponent'; per: number; element?: Element }
  | { mode: 'perExtraEnergy'; element: Element; per: number; max: number }
  | { mode: 'ifDamaged'; side: 'self' | 'opponent'; bonus: number }
  | { mode: 'ifStatus'; status?: Status; bonus: number }
  | { mode: 'perBench'; side: 'own' | 'opponent' | 'both'; per: number }
  | { mode: 'perDamageOnSelf'; per: number } // +per for each 10 damage on this creature
  | { mode: 'ifOpponentPrime'; bonus: number }
  | { mode: 'ifOpponentElement'; element: Element; bonus: number }
  | { mode: 'ifPlayedSupporter'; bonus: number };

export interface Attack {
  name: string;
  cost: Element[]; // 'neutral' entries can be paid by any essence
  damage: number;
  /** Shown after the number, e.g. "+" or "×". Pure display. */
  damageSuffix?: '+' | '×' | '';
  mods?: DamageMod[];
  effects?: Effect[];
  /** Damage dealt to the attacker after the attack. */
  recoil?: number;
  text?: string; // rules text shown on card (auto-generated if absent)
}

/** Continuous effects: creature abilities, tools and terrains. */
export type Passive = (
  | { type: 'damageReduction'; amount: number }
  | { type: 'hpBonus'; amount: number }
  | { type: 'damageBonus'; amount: number } // this creature's attacks deal +X to opponent active
  | { type: 'retreatReduction'; amount: number }
  | { type: 'thorns'; amount: number } // when damaged by an attack while active, attacker takes X
  | { type: 'checkupHeal'; amount: number }
  | { type: 'statusImmune' }
  | { type: 'noWeakness' }
  | { type: 'statusDamageBonus'; amount: number } // poison/burn on opposing creatures deal +X
  | { type: 'freeRetreatIfEnergy' } // retreat cost 0 if this has any energy
) & {
  /** Only applies while this creature is the Active one. */
  activeOnly?: boolean;
  /** For terrains/tools: which creatures are affected. */
  filter?: { element?: Element; stage?: Stage; prime?: boolean };
};

export type Ability =
  | { kind: 'passive'; name: string; text?: string; passive: Passive }
  | {
      kind: 'activated';
      name: string;
      text?: string;
      requiresActive?: boolean;
      effects: Effect[];
    };

export type TrainerKind = 'item' | 'supporter' | 'tool' | 'terrain';

export type PlayCondition =
  | 'ownActiveDamaged'
  | 'anyOwnDamaged'
  | 'hasBench'
  | 'opponentHasBench'
  | 'ownActiveHasStatus'
  | 'discardHasCreature'
  | 'discardHasEssenceCost'
  | 'behindOnPoints';

interface CardBase {
  id: string; // e.g. "GEN-001"
  name: string;
  expansion: string; // expansion id
  number: number; // collector number inside expansion
  rarity: Rarity;
  art: ArtRef;
  flavor?: string;
  /** If set, this card is an alternate-art print of another card and shares its gameplay. */
  variantOf?: string;
}

export interface ArtRef {
  /** Creature art file under /art/creatures (without extension) or vector illustration key. */
  image?: string;
  illustration?: string; // key into the vector illustration registry (trainers/items)
  scene?: SceneKey; // background scene
  fullArt?: boolean;
  /** CSS-level treatments. */
  foil?: 'none' | 'holo' | 'rainbow' | 'gold' | 'cosmic';
  focus?: { x?: number; y?: number; scale?: number };
}

export type SceneKey =
  | 'meadow' | 'volcano' | 'reef' | 'storm' | 'aurora' | 'canyon' | 'grotto' | 'foundry' | 'skyruins' | 'parlor'
  | 'starfield' | 'eclipse' | 'nebula' | 'sunburst' | 'glacier';

export interface CreatureCard extends CardBase {
  category: 'creature';
  element: Element;
  stage: Stage;
  evolvesFrom?: string; // species name
  hp: number;
  prime?: boolean; // worth 2 points when knocked out
  weakness?: Element;
  resistance?: Element;
  retreat: number;
  attacks: Attack[];
  ability?: Ability;
  species: string; // used for evolution matching and deck-copy limits
}

export interface TrainerCard extends CardBase {
  category: 'trainer';
  trainerKind: TrainerKind;
  text: string;
  effects?: Effect[]; // item / supporter
  tool?: Passive; // tool
  field?: Passive[]; // terrain
  condition?: PlayCondition;
}

export type CardDef = CreatureCard | TrainerCard;

export interface ExpansionDef {
  id: string;
  code: string;
  name: string;
  tagline: string;
  releaseOrder: number;
  theme: { primary: string; secondary: string; accent: string };
  packArt: { featured: string[]; scene: SceneKey };
  packPrice: number;
}
