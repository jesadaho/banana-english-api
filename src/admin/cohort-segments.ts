/**
 * Admin → Cohorts: who drops off and who comes back in the first week.
 * Pure aggregation over one row per new user (see admin-cohorts.controller).
 */
export type CohortUserRow = {
  /** Calendar days since signup (Bangkok) as of today. */
  ageDays: number;
  /** Days after signup with a learning session (0 = signup day). */
  activeDays: number[];
  paid: boolean;
  dims: Record<string, string>;
};

export type RetentionStats = {
  n: number;
  paid: number;
  paidPct: number | null;
  d1: number | null;
  d2: number | null;
  d3: number | null;
  d7: number | null;
  /** Came on D1 but not D2 or D3 (of D1 returners). */
  dropAfterD1: number | null;
  /** Gone on D1 and D2, back on any day 3–7. */
  comeback: number | null;
};

type Acc = {
  n: number;
  paid: number;
  m: Record<'d1' | 'd2' | 'd3' | 'd7' | 'drop' | 'come', number>;
  x: Record<'d1' | 'd2' | 'd3' | 'd7' | 'drop' | 'come', number>;
};

const empty = (): Acc => ({
  n: 0,
  paid: 0,
  m: { d1: 0, d2: 0, d3: 0, d7: 0, drop: 0, come: 0 },
  x: { d1: 0, d2: 0, d3: 0, d7: 0, drop: 0, come: 0 },
});

const pct = (x: number, n: number) => (n > 0 ? Math.round((x / n) * 1000) / 10 : null);

function add(acc: Acc, row: CohortUserRow) {
  const on = (d: number) => row.activeDays.includes(d);
  // A day counts once it is over for this user.
  const done = (d: number) => row.ageDays >= d + 1;
  acc.n++;
  if (row.paid) acc.paid++;
  for (const [k, d] of [['d1', 1], ['d2', 2], ['d3', 3], ['d7', 7]] as const) {
    if (!done(d)) continue;
    acc.m[k]++;
    if (on(d)) acc.x[k]++;
  }
  if (done(3) && on(1)) {
    acc.m.drop++;
    if (!on(2) && !on(3)) acc.x.drop++;
  }
  if (done(7) && !on(1) && !on(2)) {
    acc.m.come++;
    if ([3, 4, 5, 6, 7].some(on)) acc.x.come++;
  }
}

function stats(acc: Acc): RetentionStats {
  return {
    n: acc.n,
    paid: acc.paid,
    paidPct: pct(acc.paid, acc.n),
    d1: pct(acc.x.d1, acc.m.d1),
    d2: pct(acc.x.d2, acc.m.d2),
    d3: pct(acc.x.d3, acc.m.d3),
    d7: pct(acc.x.d7, acc.m.d7),
    dropAfterD1: pct(acc.x.drop, acc.m.drop),
    comeback: pct(acc.x.come, acc.m.come),
  };
}

export function overallStats(rows: CohortUserRow[]): RetentionStats {
  const acc = empty();
  for (const r of rows) add(acc, r);
  return stats(acc);
}

/** Per dimension: one row per value with ≥ minN users, biggest first. */
export function segmentStats(
  rows: CohortUserRow[],
  dims: string[],
  minN = 15,
): Record<string, ({ value: string } & RetentionStats)[]> {
  const out: Record<string, ({ value: string } & RetentionStats)[]> = {};
  for (const dim of dims) {
    const by = new Map<string, Acc>();
    for (const r of rows) {
      const v = r.dims[dim] ?? '(none)';
      const acc = by.get(v) ?? empty();
      add(acc, r);
      by.set(v, acc);
    }
    out[dim] = [...by.entries()]
      .filter(([, acc]) => acc.n >= minN)
      .map(([value, acc]) => ({ value, ...stats(acc) }))
      .sort((a, b) => b.n - a.n);
  }
  return out;
}
