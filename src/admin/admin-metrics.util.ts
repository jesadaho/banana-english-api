/** Estimated THB list prices for IAP packs (tax-inclusive display approx). */
export const BANANA_PACK_THB: Record<string, number> = {
  banana_tickets_28: 99,
  banana_tickets_70: 199,
};

export function estimatedThbForProduct(productId: string): number {
  return BANANA_PACK_THB[productId] ?? 0;
}

export type DateRange = {
  from: Date;
  to: Date;
};

/** Inclusive calendar range (from 00:00 UTC of from-day through end of to-day). */
export function parseDateRange(
  fromRaw?: string,
  toRaw?: string,
  defaultDays = 30,
): DateRange {
  const to = toRaw ? startOfUtcDay(new Date(toRaw)) : startOfUtcDay(new Date());
  const from = fromRaw
    ? startOfUtcDay(new Date(fromRaw))
    : new Date(to.getTime() - (defaultDays - 1) * 86_400_000);

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    throw new Error('Invalid from/to date');
  }
  if (from > to) {
    throw new Error('from must be <= to');
  }

  return {
    from,
    to: endOfUtcDay(to),
  };
}

export function previousRange(range: DateRange): DateRange {
  const ms = range.to.getTime() - range.from.getTime();
  const prevTo = new Date(range.from.getTime() - 1);
  const prevFrom = new Date(prevTo.getTime() - ms);
  return { from: startOfUtcDay(prevFrom), to: endOfUtcDay(prevTo) };
}

export function startOfUtcDay(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0),
  );
}

export function endOfUtcDay(d: Date): Date {
  return new Date(
    Date.UTC(
      d.getUTCFullYear(),
      d.getUTCMonth(),
      d.getUTCDate(),
      23,
      59,
      59,
      999,
    ),
  );
}

export function eachUtcDateKey(from: Date, to: Date): string[] {
  const keys: string[] = [];
  let cur = startOfUtcDay(from);
  const end = startOfUtcDay(to);
  while (cur <= end) {
    keys.push(dateKey(cur));
    cur = new Date(cur.getTime() + 86_400_000);
  }
  return keys;
}

export function dateKey(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Monday (UTC) date key for the week containing `d`. */
export function weekStartKey(d: Date): string {
  const day = startOfUtcDay(d);
  const dow = day.getUTCDay(); // 0=Sun … 6=Sat
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  return dateKey(new Date(day.getTime() + mondayOffset * 86_400_000));
}

export function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export type MetricsFilters = {
  /** Only users with onboardingCompleted=true */
  requireOnboarding: boolean;
  /** Only users who linked Google/Apple (firebaseUid set) */
  requireSignedIn: boolean;
  /** Only users with lastAppOpenDate set */
  requireAppOpen: boolean;
  /** Drop users with null/empty acquisitionSource (dashboard "unknown") */
  excludeUnsetSource: boolean;
};

export function parseBoolQuery(raw?: string): boolean {
  if (!raw) return false;
  const v = raw.trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

export function parseMetricsFilters(query: {
  requireOnboarding?: string;
  requireSignedIn?: string;
  requireAppOpen?: string;
  excludeUnsetSource?: string;
}): MetricsFilters {
  return {
    requireOnboarding: parseBoolQuery(query.requireOnboarding),
    requireSignedIn: parseBoolQuery(query.requireSignedIn),
    requireAppOpen: parseBoolQuery(query.requireAppOpen),
    excludeUnsetSource: parseBoolQuery(query.excludeUnsetSource),
  };
}

export function filtersCacheKey(filters: MetricsFilters): string {
  return [
    filters.requireOnboarding ? '1' : '0',
    filters.requireSignedIn ? '1' : '0',
    filters.requireAppOpen ? '1' : '0',
    filters.excludeUnsetSource ? '1' : '0',
  ].join('');
}
