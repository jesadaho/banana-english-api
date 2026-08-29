export interface UserLocalTime {
  dateKey: string;
  hour: number;
}

export function getUserLocalTime(
  timezone: string,
  now = new Date(),
): UserLocalTime {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: 'numeric',
      hour12: false,
    });
    const parts = formatter.formatToParts(now);
    const year = parts.find((p) => p.type === 'year')?.value ?? '1970';
    const month = parts.find((p) => p.type === 'month')?.value ?? '01';
    const day = parts.find((p) => p.type === 'day')?.value ?? '01';
    const hourRaw = parts.find((p) => p.type === 'hour')?.value ?? '0';
    const hour = hourRaw === '24' ? 0 : Number.parseInt(hourRaw, 10);

    return {
      dateKey: `${year}-${month}-${day}`,
      hour,
    };
  } catch {
    const fallback = new Date(now);
    const year = fallback.getUTCFullYear();
    const month = String(fallback.getUTCMonth() + 1).padStart(2, '0');
    const day = String(fallback.getUTCDate()).padStart(2, '0');
    return {
      dateKey: `${year}-${month}-${day}`,
      hour: fallback.getUTCHours(),
    };
  }
}

export function parseDateKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function isSameDateKey(a: Date | null | undefined, dateKey: string): boolean {
  if (!a) return false;
  const y = a.getUTCFullYear();
  const m = String(a.getUTCMonth() + 1).padStart(2, '0');
  const d = String(a.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}` === dateKey;
}

export function previousDateKey(dateKey: string): string {
  const date = parseDateKey(dateKey);
  date.setUTCDate(date.getUTCDate() - 1);
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Walk back N calendar days from a dateKey (N=1 → yesterday). */
export function dateKeyDaysAgo(dateKey: string, days: number): string {
  let key = dateKey;
  for (let i = 0; i < days; i += 1) {
    key = previousDateKey(key);
  }
  return key;
}

/**
 * ISO week key for the learner's local calendar date, e.g. "2026-W35".
 * Week runs Monday–Sunday (ISO-8601).
 */
export function getIsoWeekKey(timezone: string, now = new Date()): string {
  const { dateKey } = getUserLocalTime(timezone, now);
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const dayNum = date.getUTCDay() || 7; // Mon=1 … Sun=7
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const isoYear = date.getUTCFullYear();
  const yearStart = new Date(Date.UTC(isoYear, 0, 1));
  const week = Math.ceil(
    ((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  );
  return `${isoYear}-W${String(week).padStart(2, '0')}`;
}

/** Human label for time until next Monday 00:00 in [timezone], e.g. "5d 12h". */
export function formatWeekResetsIn(timezone: string, now = new Date()): string {
  const { dateKey, hour } = getUserLocalTime(timezone, now);
  const [y, m, d] = dateKey.split('-').map(Number);
  const jsDay = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // Sun=0
  // Full days until next Monday (Monday → 7).
  const daysUntilMonday = jsDay === 0 ? 1 : jsDay === 1 ? 7 : 8 - jsDay;
  const hoursLeftToday = Math.max(0, 24 - hour);
  const totalHours = (daysUntilMonday - 1) * 24 + hoursLeftToday;
  const safe = Math.max(1, totalHours);
  const days = Math.floor(safe / 24);
  const hours = safe % 24;
  if (days <= 0) return `${hours}h`;
  return `${days}d ${hours}h`;
}
