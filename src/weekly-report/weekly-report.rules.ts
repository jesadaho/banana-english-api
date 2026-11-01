import type {
  WeeklyAddon,
  WeeklyDecision,
  WeeklySpeakSegment,
} from './weekly-report.types';

export const STREAK_MILESTONES = [7, 14, 30, 60, 100];

export function speakSegment(
  sentences: number,
  activeDays: number,
  words: number,
): WeeklySpeakSegment | 'idle' {
  if (sentences >= 10) return 'active';
  if (sentences >= 1) return 'light';
  if (activeDays > 0 || words > 0) return 'idle_app';
  return 'idle';
}

export function decideSend(input: {
  sentences: number;
  activeDays: number;
  words: number;
  daysSinceLastOpen: number | null;
  createdThisWeek: boolean;
  consecutiveIdleWeeks: number;
}): WeeklyDecision {
  if (input.daysSinceLastOpen != null && input.daysSinceLastOpen > 14 && !input.createdThisWeek) {
    return { send: false, reason: 'gone' };
  }
  const speak = speakSegment(input.sentences, input.activeDays, input.words);
  if (speak === 'idle') {
    if (input.daysSinceLastOpen == null) {
      return input.createdThisWeek
        ? { send: true, speak: 'idle_app', segment: 'first_week' }
        : { send: false, reason: 'gone' };
    }
    if (input.daysSinceLastOpen > 14) return { send: false, reason: 'gone' };
    if (input.consecutiveIdleWeeks >= 2) return { send: false, reason: 'idle_stopped' };
    return { send: true, speak: 'idle', segment: 'idle' };
  }
  return {
    send: true,
    speak,
    segment: input.createdThisWeek ? 'first_week' : speak,
  };
}

export function pickHighestAddon(
  addons: WeeklyAddon[],
  random = Math.random,
): WeeklyAddon | null {
  if (addons.length === 0) return null;
  const best = Math.min(...addons.map((item) => item.rank));
  const top = addons.filter((item) => item.rank === best);
  return top[Math.floor(random() * top.length)] ?? null;
}

export function streakHitMilestone(streakDays: number): boolean {
  return STREAK_MILESTONES.includes(streakDays);
}

export function daysBetweenDateKeys(later: string, earlier: string): number {
  const [ly, lm, ld] = later.split('-').map(Number);
  const [ey, em, ed] = earlier.split('-').map(Number);
  const a = Date.UTC(ly, lm - 1, ld);
  const b = Date.UTC(ey, em - 1, ed);
  return Math.round((a - b) / 86400000);
}

export function positiveDelta(current: number, previous: number): number {
  const delta = current - previous;
  return delta > 0 ? delta : 0;
}
