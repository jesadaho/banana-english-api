import { PLACEMENT_QUESTIONS } from '../placement/placement.bank';
import { placementBandFromResult } from '../placement/placement-band';

/** Every item ever asked (v3 S01/S03 plus retired Q01), so old rows still count. */
const SUMMARY_QUESTION_IDS = PLACEMENT_QUESTIONS.map((q) => q.id);

export const PLACEMENT_BAND_ORDER = [
  'Seed',
  'Seed+',
  'Seed++',
  'A1',
  'A1+',
  'A2',
  'A2+',
  'B1',
] as const;

export type PlacementSummaryRow = {
  id: string;
  displayName: string | null;
  email: string | null;
  lastPlacementTestAt: Date | null;
  createdAt: Date;
  placementEntryNodeId: string | null;
  placementEntryPathId: string | null;
  placementResult: unknown;
};

type QuestionAgg = {
  asked: number;
  score0: number;
  score1: number;
  score2: number;
  skip: number;
  uneval: number;
  scoreSum: number;
  scored: number;
};

function emptyQuestion(): QuestionAgg {
  return {
    asked: 0,
    score0: 0,
    score1: 0,
    score2: 0,
    skip: 0,
    uneval: 0,
    scoreSum: 0,
    scored: 0,
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function bump(map: Record<string, number>, key: string) {
  const label = key.trim() || 'unknown';
  map[label] = (map[label] ?? 0) + 1;
}

function ranked(map: Record<string, number>, order: readonly string[] = []) {
  const keys = [
    ...order.filter((k) => (map[k] ?? 0) > 0),
    ...Object.keys(map)
      .filter((k) => !order.includes(k))
      .sort((a, b) => (map[b] ?? 0) - (map[a] ?? 0)),
  ];
  return keys.map((key) => ({ key, count: map[key] ?? 0 }));
}

export function publicResultFromJson(value: unknown): string | null {
  return placementBandFromResult(value);
}

export function summarizePlacementRows(rows: PlacementSummaryRow[]) {
  const bands: Record<string, number> = {};
  const stopReasons: Record<string, number> = {};
  const entrySources: Record<string, number> = {};
  const statuses: Record<string, number> = {};
  const gates = {
    seedPlus: 0,
    entry: 0,
    a1: 0,
    a1Plus: 0,
    a2: 0,
    a2Plus: 0,
    b1: 0,
  };
  const questions = Object.fromEntries(
    SUMMARY_QUESTION_IDS.map((id) => [id, emptyQuestion()]),
  ) as Record<string, QuestionAgg>;

  let completed = 0;
  let inconclusive = 0;
  let startedOnly = 0;

  for (const row of rows) {
    const result = asRecord(row.placementResult);
    if (!result) {
      startedOnly += 1;
      continue;
    }
    completed += 1;
    const band = publicResultFromJson(result);
    if (band) bump(bands, band);
    else {
      inconclusive += 1;
      bump(bands, 'none');
    }
    if (typeof result.stopReason === 'string') bump(stopReasons, result.stopReason);
    if (typeof result.entrySource === 'string') bump(entrySources, result.entrySource);
    if (typeof result.resultStatus === 'string') bump(statuses, result.resultStatus);

    const gateResults = asRecord(result.gateResults);
    if (gateResults) {
      if (gateResults.seedPlus === true) gates.seedPlus += 1;
      if (gateResults.entry === true) gates.entry += 1;
      if (gateResults.a1 === true) gates.a1 += 1;
      if (gateResults.a1Plus === true) gates.a1Plus += 1;
      if (gateResults.a2 === true) gates.a2 += 1;
      if (gateResults.a2Plus === true) gates.a2Plus += 1;
      if (gateResults.b1 === true) gates.b1 += 1;
    }

    const items = result.questionResults;
    if (!Array.isArray(items)) continue;
    for (const item of items) {
      const rec = asRecord(item);
      if (!rec) continue;
      const id = typeof rec.questionId === 'string' ? rec.questionId : '';
      if (!id || !questions[id]) continue;
      const agg = questions[id];
      agg.asked += 1;
      const status = typeof rec.status === 'string' ? rec.status : '';
      const score = rec.score;
      if (status === 'skipped') agg.skip += 1;
      else if (status === 'needs_review' || status === 'technical_retry') {
        agg.uneval += 1;
      } else if (score === 0 || score === 1 || score === 2) {
        agg.scored += 1;
        agg.scoreSum += score;
        if (score === 0) agg.score0 += 1;
        if (score === 1) agg.score1 += 1;
        if (score === 2) agg.score2 += 1;
      } else {
        agg.uneval += 1;
      }
    }
  }

  const recent = [...rows]
    .sort((a, b) => {
      const at = (a.lastPlacementTestAt ?? a.createdAt).getTime();
      const bt = (b.lastPlacementTestAt ?? b.createdAt).getTime();
      return bt - at;
    })
    .slice(0, 40)
    .map((row) => {
      const result = asRecord(row.placementResult);
      const items = Array.isArray(result?.questionResults)
        ? result.questionResults
        : [];
      let asked = 0;
      let scoreSum = 0;
      for (const item of items) {
        const rec = asRecord(item);
        if (!rec) continue;
        if (rec.score === 0 || rec.score === 1 || rec.score === 2) {
          asked += 1;
          scoreSum += rec.score;
        } else if (typeof rec.questionId === 'string') {
          asked += 1;
        }
      }
      return {
        userId: row.id,
        displayName: row.displayName,
        email: row.email,
        publicResult: publicResultFromJson(row.placementResult),
        resultLabel:
          typeof result?.resultLabel === 'string' ? result.resultLabel : null,
        stopReason:
          typeof result?.stopReason === 'string' ? result.stopReason : null,
        entrySource:
          typeof result?.entrySource === 'string' ? result.entrySource : null,
        startNode: row.placementEntryNodeId,
        asked,
        scoreSum,
        at: (row.lastPlacementTestAt ?? row.createdAt).toISOString(),
      };
    });

  return {
    totals: {
      inRange: rows.length,
      completed,
      startedOnly,
      inconclusive,
    },
    publicResults: ranked(bands, PLACEMENT_BAND_ORDER),
    stopReasons: ranked(stopReasons),
    entrySources: ranked(entrySources, [
      'onboarding',
      'profile_settings',
      'growth',
      'debug',
    ]),
    resultStatuses: ranked(statuses),
    gates,
    questions: SUMMARY_QUESTION_IDS.map((id) => {
      const q = questions[id];
      return {
        questionId: id,
        asked: q.asked,
        score0: q.score0,
        score1: q.score1,
        score2: q.score2,
        skip: q.skip,
        uneval: q.uneval,
        avgScore: q.scored === 0 ? null : Math.round((q.scoreSum / q.scored) * 100) / 100,
      };
    }),
    recent,
  };
}
