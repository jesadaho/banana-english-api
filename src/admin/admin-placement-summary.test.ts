import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  publicResultFromJson,
  summarizePlacementRows,
} from './admin-placement-summary';

describe('admin placement summary', () => {
  it('counts bands, gates, and per-question scores', () => {
    const at = new Date('2026-10-20T05:00:00Z');
    const summary = summarizePlacementRows([
      {
        id: 'u1',
        displayName: 'Ann',
        email: null,
        lastPlacementTestAt: at,
        createdAt: at,
        placementEntryNodeId: 'v7_u01n01',
        placementEntryPathId: 'foundation_v7',
        placementResult: {
          publicResult: 'Seed',
          stopReason: 'early_zero_streak',
          resultStatus: 'early_exit',
          entrySource: 'onboarding',
          resultLabel: 'Seed · พร้อมเติบโต',
          gateResults: { entry: false, a1: false, a2: false, b1: false },
          questionResults: [
            { questionId: 'Q01', status: 'scored', score: 2 },
            { questionId: 'Q02', status: 'scored', score: 0 },
            { questionId: 'Q03', status: 'skipped', score: 0 },
          ],
        },
      },
      {
        id: 'u2',
        displayName: 'Bee',
        email: 'b@x.com',
        lastPlacementTestAt: new Date('2026-10-19T05:00:00Z'),
        createdAt: at,
        placementEntryNodeId: 'a2_c01n01',
        placementEntryPathId: 'adventure_a2',
        placementResult: {
          publicResult: 'A1',
          stopReason: 'band_not_confirmed',
          resultStatus: 'completed',
          entrySource: 'profile_settings',
          gateResults: {
            entry: true,
            a1: true,
            a1Plus: false,
            a2: false,
            b1: false,
          },
          questionResults: [
            { questionId: 'Q01', status: 'scored', score: 2 },
            { questionId: 'Q15', status: 'scored', score: 1 },
            { questionId: 'Q16', status: 'needs_review', score: null },
          ],
        },
      },
      {
        id: 'u3',
        displayName: 'No result',
        email: null,
        lastPlacementTestAt: at,
        createdAt: at,
        placementEntryNodeId: null,
        placementEntryPathId: null,
        placementResult: null,
      },
    ]);

    assert.equal(summary.totals.inRange, 3);
    assert.equal(summary.totals.completed, 2);
    assert.equal(summary.totals.startedOnly, 1);
    assert.deepEqual(
      summary.publicResults.map((row) => [row.key, row.count]),
      [
        ['Seed', 1],
        ['A1', 1],
      ],
    );
    assert.equal(summary.gates.entry, 1);
    assert.equal(summary.gates.a1, 1);
    const q01 = summary.questions.find((q) => q.questionId === 'Q01');
    assert.equal(q01?.asked, 2);
    assert.equal(q01?.score2, 2);
    assert.equal(q01?.avgScore, 2);
    const q16 = summary.questions.find((q) => q.questionId === 'Q16');
    assert.equal(q16?.uneval, 1);
    assert.equal(summary.recent[0]?.displayName, 'Ann');
    assert.equal(publicResultFromJson({ publicResult: 'A2+' }), 'A2+');
  });
});
