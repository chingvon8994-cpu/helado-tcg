import type { Difficulty } from '../ai';

/**
 * All reward numbers in one place. Server code reads these; clients only display them.
 * Anti-farming rules:
 *   • Matches shorter than MIN_TURNS_FOR_REWARD pay nothing (blocks start-and-concede loops).
 *   • A player who concedes/forfeits/times out never earns match rewards.
 *   • Solo rewards are capped per day; online rewards vs the same opponent are capped per day.
 *   • Every grant is keyed by (reason, ref) in the ledger, so nothing can be paid twice.
 */
export const CURRENCY = { name: 'Scoops', short: 'SC' } as const;
export const STARTING_SCOOPS = 300;
export const DAILY_LOGIN_SCOOPS = 50;
export const FIRST_WIN_OF_DAY_BONUS = 40;
export const MIN_TURNS_FOR_REWARD = 6;
export const SOLO_REWARDED_PER_DAY = 12;
export const ONLINE_SAME_OPPONENT_PER_DAY = 4;

export const SOLO_REWARDS: Record<Difficulty, { win: number; loss: number; xpWin: number; xpLoss: number }> = {
  beginner: { win: 20, loss: 5, xpWin: 15, xpLoss: 5 },
  easy: { win: 35, loss: 8, xpWin: 25, xpLoss: 8 },
  normal: { win: 55, loss: 12, xpWin: 40, xpLoss: 12 },
  expert: { win: 85, loss: 18, xpWin: 60, xpLoss: 18 },
};
export const ONLINE_REWARDS = { win: 70, loss: 20, draw: 30, xpWin: 60, xpLoss: 20 };

/** Time-boxed special events. Multipliers apply to match scoop rewards. */
export interface GameEventDef { id: string; name: string; description: string; start: string; end: string; matchMultiplier: number }
export const SPECIAL_EVENTS: GameEventDef[] = [
  { id: 'launch-week', name: 'Grand Opening Week', description: 'Double Scoops from every rewarded match!', start: '2026-10-31T00:00:00Z', end: '2026-11-14T00:00:00Z', matchMultiplier: 2 },
];
export function activeEvents(now: Date) {
  return SPECIAL_EVENTS.filter((e) => now >= new Date(e.start) && now < new Date(e.end));
}
export function eventMultiplier(now: Date) {
  return activeEvents(now).reduce((m, e) => m * e.matchMultiplier, 1);
}

export interface MatchRewardInput {
  mode: 'solo' | 'online';
  difficulty?: Difficulty | null;
  result: 'win' | 'loss' | 'draw';
  turns: number;
  forfeitedByThisPlayer: boolean;
  rewardedSoloToday: number;
  rewardedVsOpponentToday: number;
  firstWinToday: boolean;
  now: Date;
}

export interface MatchReward { scoops: number; xp: number; notes: string[] }

export function computeMatchReward(i: MatchRewardInput): MatchReward {
  const notes: string[] = [];
  if (i.forfeitedByThisPlayer) return { scoops: 0, xp: 0, notes: ['No rewards for forfeited matches.'] };
  if (i.turns < MIN_TURNS_FOR_REWARD) return { scoops: 0, xp: 0, notes: [`Matches shorter than ${MIN_TURNS_FOR_REWARD} turns don’t earn rewards.`] };
  let scoops = 0;
  let xp = 0;
  if (i.mode === 'solo') {
    const t = SOLO_REWARDS[i.difficulty ?? 'beginner'];
    xp = i.result === 'win' ? t.xpWin : t.xpLoss;
    if (i.rewardedSoloToday >= SOLO_REWARDED_PER_DAY) notes.push('Daily solo Scoop limit reached — XP still counts.');
    else scoops = i.result === 'win' ? t.win : i.result === 'draw' ? Math.round((t.win + t.loss) / 2) : t.loss;
  } else {
    xp = i.result === 'win' ? ONLINE_REWARDS.xpWin : ONLINE_REWARDS.xpLoss;
    if (i.rewardedVsOpponentToday >= ONLINE_SAME_OPPONENT_PER_DAY) notes.push('Reward limit vs this opponent reached today.');
    else scoops = ONLINE_REWARDS[i.result];
  }
  const mult = eventMultiplier(i.now);
  if (scoops > 0 && mult !== 1) {
    scoops = Math.round(scoops * mult);
    notes.push(`Event bonus ×${mult}!`);
  }
  if (scoops > 0 && i.result === 'win' && i.firstWinToday) {
    scoops += FIRST_WIN_OF_DAY_BONUS;
    notes.push(`First win of the day +${FIRST_WIN_OF_DAY_BONUS}`);
  }
  return { scoops, xp, notes };
}

export function levelForXp(xp: number) {
  return Math.floor(Math.sqrt(xp / 40)) + 1;
}
export function xpForLevel(level: number) {
  return (level - 1) ** 2 * 40;
}
