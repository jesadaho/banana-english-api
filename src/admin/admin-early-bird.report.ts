export type EarlyBirdStatus = 'reserved' | 'purchased' | 'walk_in';

export type EarlyBirdReservedUser = {
  id: string;
  displayName: string | null;
  email: string | null;
  earlyBirdReservedAt: Date | null;
  earlyBirdReserveSource: string | null;
};

export type EarlyBirdPurchase = {
  userId: string;
  createdAt: Date;
  priceThb: number | null;
  platform: string | null;
  productId: string | null;
  isSandbox: boolean | null;
  user: { displayName: string | null; email: string | null };
};

export type EarlyBirdRow = {
  userId: string;
  displayName: string | null;
  email: string | null;
  reservedAt: string | null;
  source: string | null;
  status: EarlyBirdStatus;
  purchasedAt: string | null;
  productId: string | null;
  platform: string | null;
  priceThb: number | null;
  isSandbox: boolean | null;
};

const BANGKOK_OFFSET_MS = 7 * 3_600_000;

export function bangkokDayKey(d: Date): string {
  return new Date(d.getTime() + BANGKOK_OFFSET_MS).toISOString().slice(0, 10);
}

/**
 * One row per user who reserved and/or bought Early Bird. The first store
 * purchase per user counts; renewals are not new buyers.
 */
export function buildEarlyBirdRows(
  reserved: EarlyBirdReservedUser[],
  purchases: EarlyBirdPurchase[],
): EarlyBirdRow[] {
  const firstPurchase = new Map<string, EarlyBirdPurchase>();
  for (const p of purchases) {
    const prev = firstPurchase.get(p.userId);
    if (!prev || p.createdAt < prev.createdAt) firstPurchase.set(p.userId, p);
  }
  const rows: EarlyBirdRow[] = [];
  const seen = new Set<string>();
  for (const u of reserved) {
    if (!u.earlyBirdReservedAt) continue;
    seen.add(u.id);
    const bought = firstPurchase.get(u.id);
    rows.push({
      userId: u.id,
      displayName: u.displayName,
      email: u.email,
      reservedAt: u.earlyBirdReservedAt.toISOString(),
      source: u.earlyBirdReserveSource,
      status: bought ? 'purchased' : 'reserved',
      purchasedAt: bought?.createdAt.toISOString() ?? null,
      productId: bought?.productId ?? null,
      platform: bought?.platform ?? null,
      priceThb: bought?.priceThb ?? null,
      isSandbox: bought?.isSandbox ?? null,
    });
  }
  for (const [userId, bought] of firstPurchase) {
    if (seen.has(userId)) continue;
    rows.push({
      userId,
      displayName: bought.user.displayName,
      email: bought.user.email,
      reservedAt: null,
      source: null,
      status: 'walk_in',
      purchasedAt: bought.createdAt.toISOString(),
      productId: bought.productId,
      platform: bought.platform,
      priceThb: bought.priceThb,
      isSandbox: bought.isSandbox,
    });
  }
  rows.sort((a, b) => latest(b).localeCompare(latest(a)));
  return rows;
}

function latest(row: EarlyBirdRow): string {
  const a = row.reservedAt ?? '';
  const b = row.purchasedAt ?? '';
  return a > b ? a : b;
}

export function summarizeEarlyBird(rows: EarlyBirdRow[], now = new Date()) {
  const today = bangkokDayKey(now);
  const reservedRows = rows.filter((r) => r.reservedAt);
  const converted = rows.filter((r) => r.status === 'purchased').length;
  const paid = rows.filter((r) => r.purchasedAt && !r.isSandbox);
  return {
    reserved: reservedRows.length,
    reservedToday: reservedRows.filter((r) => bangkokDayKey(new Date(r.reservedAt!)) === today)
      .length,
    converted,
    conversionPct:
      reservedRows.length > 0 ? Math.round((converted / reservedRows.length) * 1000) / 10 : null,
    walkIn: rows.filter((r) => r.status === 'walk_in').length,
    buyers: paid.length,
    revenueThb: paid.reduce((sum, r) => sum + (r.priceThb ?? 0), 0),
    sandboxBuyers: rows.filter((r) => r.purchasedAt && r.isSandbox).length,
  };
}

export function earlyBirdDaily(rows: EarlyBirdRow[], from: Date, to: Date) {
  const days = new Map<string, { day: string; reservations: number; purchases: number }>();
  for (let t = from.getTime(); t <= to.getTime(); t += 86_400_000) {
    const day = bangkokDayKey(new Date(t));
    days.set(day, { day, reservations: 0, purchases: 0 });
  }
  for (const r of rows) {
    if (r.reservedAt) {
      const slot = days.get(bangkokDayKey(new Date(r.reservedAt)));
      if (slot) slot.reservations += 1;
    }
    if (r.purchasedAt) {
      const slot = days.get(bangkokDayKey(new Date(r.purchasedAt)));
      if (slot) slot.purchases += 1;
    }
  }
  return [...days.values()];
}

export function filterEarlyBirdRows(
  rows: EarlyBirdRow[],
  params: { status?: string; q?: string; from: Date; to: Date },
): EarlyBirdRow[] {
  const q = params.q?.trim().toLowerCase() ?? '';
  const fromIso = params.from.toISOString();
  const toIso = params.to.toISOString();
  const inRange = (iso: string | null) => !!iso && iso >= fromIso && iso <= toIso;
  return rows.filter((r) => {
    if (params.status && params.status !== 'all' && r.status !== params.status) return false;
    if (!inRange(r.reservedAt) && !inRange(r.purchasedAt)) return false;
    if (!q) return true;
    return [r.userId, r.displayName, r.email].some((v) => v?.toLowerCase().includes(q));
  });
}
