/** Mission & achievement definitions. Progress is stored server-side per period key. */

export type MissionEvent = 'matchPlayed' | 'matchWon' | 'onlinePlayed' | 'knockout' | 'packOpened' | 'expertWin';

export interface MissionDef {
  id: string;
  period: 'daily' | 'weekly';
  title: string;
  event: MissionEvent;
  target: number;
  reward: number;
}

export const MISSIONS: MissionDef[] = [
  { id: 'd-play3', period: 'daily', title: 'Play 3 rewarded matches', event: 'matchPlayed', target: 3, reward: 30 },
  { id: 'd-win2', period: 'daily', title: 'Win 2 matches', event: 'matchWon', target: 2, reward: 40 },
  { id: 'd-ko6', period: 'daily', title: 'Knock out 6 creatures', event: 'knockout', target: 6, reward: 30 },
  { id: 'd-pack1', period: 'daily', title: 'Open a booster pack', event: 'packOpened', target: 1, reward: 20 },
  { id: 'w-win12', period: 'weekly', title: 'Win 12 matches', event: 'matchWon', target: 12, reward: 200 },
  { id: 'w-online3', period: 'weekly', title: 'Play 3 online matches', event: 'onlinePlayed', target: 3, reward: 150 },
];

export interface AchievementDef { id: string; title: string; description: string; reward: number }
export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first-win', title: 'First Scoop', description: 'Win your first match.', reward: 100 },
  { id: 'first-online-win', title: 'Parlor Champion', description: 'Win an online match.', reward: 150 },
  { id: 'expert-win', title: 'Brain Freeze', description: 'Defeat an Expert AI.', reward: 200 },
  { id: 'first-pack', title: 'Fresh Batch', description: 'Open your first booster pack.', reward: 50 },
  { id: 'collector-50', title: 'Sprinkle Collector', description: 'Own 50 different cards.', reward: 300 },
  { id: 'collector-100', title: 'Grand Sundae', description: 'Own 100 different cards.', reward: 800 },
];

export function dayKey(now: Date) {
  return now.toISOString().slice(0, 10);
}
export function weekKey(now: Date) {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}
export function periodKey(m: MissionDef, now: Date) {
  return m.period === 'daily' ? dayKey(now) : weekKey(now);
}
