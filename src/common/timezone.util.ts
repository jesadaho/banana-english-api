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
