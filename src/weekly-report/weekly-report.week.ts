import {
  dateKeyDaysAgo,
  getIsoWeekKey,
  getUserLocalTime,
  parseDateKey,
  previousDateKey,
} from '../common/timezone.util';

export const WEEKLY_REPORT_HOUR = 19;
export const WEEKLY_REPORT_KEEP_WEEKS = 12;
export const WEEKLY_GONE_DAYS = 14;
export const WEEKLY_JOB_BATCH = 300;
export const WEEKLY_REPORT_TYPE = 'weekly_report';

const BANGKOK = 'Asia/Bangkok';

export type WeekWindow = {
  weekKey: string;
  timezone: string;
  sundayDateKey: string;
  dateKeys: string[];
  startUtc: Date;
  endUtc: Date;
};

export function bangkokWeekKey(now = new Date()): string {
  return getIsoWeekKey(BANGKOK, now);
}

/** Monday–Sunday local date keys ending on the Sunday that contains `now`. */
export function localWeekDateKeys(timezone: string, now = new Date()): string[] {
  const { dateKey } = getUserLocalTime(timezone, now);
  const [y, m, d] = dateKey.split('-').map(Number);
  const jsDay = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const mondayOffset = jsDay === 0 ? 6 : jsDay - 1;
  const monday = dateKeyDaysAgo(dateKey, mondayOffset);
  const keys = [monday];
  for (let i = 0; i < 6; i += 1) {
    const prev = parseDateKey(keys[keys.length - 1]!);
    prev.setUTCDate(prev.getUTCDate() + 1);
    const yy = prev.getUTCFullYear();
    const mm = String(prev.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(prev.getUTCDate()).padStart(2, '0');
    keys.push(`${yy}-${mm}-${dd}`);
  }
  return keys;
}

export function weekWindow(timezone: string, now = new Date()): WeekWindow {
  const dateKeys = localWeekDateKeys(timezone, now);
  const sundayDateKey = dateKeys[6]!;
  return {
    weekKey: bangkokWeekKey(now),
    timezone,
    sundayDateKey,
    dateKeys,
    startUtc: parseDateKey(dateKeys[0]!),
    endUtc: new Date(parseDateKey(sundayDateKey).getTime() + 24 * 60 * 60 * 1000),
  };
}

/** UTC calendar days that overlap a local Mon–Sun week (±1). */
export function utcDaysCovering(dateKeys: string[]): Date[] {
  const extraStart = previousDateKey(dateKeys[0]!);
  const extraEndDate = parseDateKey(dateKeys[6]!);
  extraEndDate.setUTCDate(extraEndDate.getUTCDate() + 1);
  const extraEnd = `${extraEndDate.getUTCFullYear()}-${String(extraEndDate.getUTCMonth() + 1).padStart(2, '0')}-${String(extraEndDate.getUTCDate()).padStart(2, '0')}`;
  return [extraStart, ...dateKeys, extraEnd].map((key) => parseDateKey(key));
}

export function dateKeyFromUtcDate(day: Date): string {
  const y = day.getUTCFullYear();
  const m = String(day.getUTCMonth() + 1).padStart(2, '0');
  const d = String(day.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function activeDaysBits(dateKeys: string[], active: Set<string>): string {
  return dateKeys.map((key) => (active.has(key) ? '1' : '0')).join('');
}

export function isSundayEvening(timezone: string, now = new Date()): boolean {
  const local = getUserLocalTime(timezone, now);
  if (local.hour !== WEEKLY_REPORT_HOUR) return false;
  const [y, m, d] = local.dateKey.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay() === 0;
}

export function previousWeekKey(weekKey: string): string {
  const match = /^(\d{4})-W(\d{2})$/.exec(weekKey);
  if (!match) return weekKey;
  const year = Number(match[1]);
  const week = Number(match[2]);
  if (week > 1) return `${year}-W${String(week - 1).padStart(2, '0')}`;
  return `${year - 1}-W52`;
}
