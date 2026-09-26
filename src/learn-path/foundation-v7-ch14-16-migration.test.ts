import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  FOUNDATION_V7_NODE_MIGRATION,
  migrateFoundationV7NodeId,
} from './foundation-v7-ch14-16-migration';
import { FOUNDATION_V7_NODES, FOUNDATION_V7_CATALOG } from './foundation-v7-path.data';
import { dealInfoTaskItems, isValidInfoTaskPack, infoTaskPoolById } from '../info-task/info-task.data';
import { resolveSkipQuizPool } from './foundation-v7-skip-quiz';
import { LearnPathService } from './learn-path.service';
import { FOUNDATION_V7_SIMULATIONS } from '../simulations/foundation-v7-simulations.data';
import { getSimulation } from '../simulations/simulations.data';
import { happyLinesFor } from '../../scripts/lib/foundation-v7-conversations-prod-runner.ts';
import { newWordsPoolById } from '../new-words/new-words.data';
import { dealSayItPhrases } from '../say-it/say-it.data';

describe('Foundation V7 Ch14–16 migration', () => {
  it('maps legacy You Ask First to Plan My Class without completing price/quantity siblings', () => {
    assert.equal(migrateFoundationV7NodeId('v7_u14n06'), 'v7_u14tn08f');
    assert.equal(migrateFoundationV7NodeId('v7_u14tn08'), 'v7_u14tn08f');
    assert.equal(migrateFoundationV7NodeId('v7_u14n03'), 'v7_u14tn01');
    assert.equal(migrateFoundationV7NodeId('v7_u14n01'), 'v7_u14n01');
    assert.equal(migrateFoundationV7NodeId('v7_u16n10'), null);
  });

  it('keeps migration targets on the live path when non-null', () => {
    const live = new Set(FOUNDATION_V7_NODES.map((n) => n.id));
    for (const [legacy, next] of Object.entries(FOUNDATION_V7_NODE_MIGRATION)) {
      if (next == null) continue;
      assert.ok(live.has(next), `${legacy} → ${next} missing from catalog`);
    }
  });

  it('does not treat Around Town as the previous skip-quiz chapter for Ch16', () => {
    const pool = resolveSkipQuizPool('v7_u15');
    assert.equal(pool.previousChapterId, 'v7_u14_time_numbers');
    assert.notEqual(pool.previousChapterId, 'v7_u16');
  });
});

describe('Info task pools', () => {
  it('deals five shuffled options with stable correct IDs', () => {
    for (const poolId of [
      'info_task_calendar_1',
      'info_task_calendar_2',
      'info_task_ticket',
      'info_task_find_my_class',
    ]) {
      assert.ok(isValidInfoTaskPack(infoTaskPoolById(poolId)), poolId);
      const deal = dealInfoTaskItems(poolId, 5, () => 0.42);
      assert.equal(deal.length, 5, poolId);
      for (const item of deal) {
        assert.equal(item.options.length, 3);
        assert.ok(item.options.some((o) => o.id === item.correctOptionId));
      }
    }
  });

  it('keeps calendar/ticket distractors distinct from the correct option', () => {
    for (const poolId of [
      'info_task_calendar_1',
      'info_task_calendar_2',
      'info_task_ticket',
    ]) {
      for (const item of infoTaskPoolById(poolId)!.items) {
        const labels = item.options.map((o) => o.label);
        assert.equal(new Set(labels).size, labels.length, `${poolId}:${item.id}`);
        assert.ok(item.options.find((o) => o.id === item.correctOptionId));
      }
    }
  });
});

describe('Foundation V7 Ch14–16 playthrough personas', () => {
  function pathService(
    completedLessons: string[] = [],
    miniIds: string[] = [],
    simulations: string[] = [],
  ) {
    return new LearnPathService(
      {
        economyTransaction: {
          findMany: async () =>
            miniIds.map((id) => ({ referenceId: `mini_game:${id}` })),
        },
        userSession: {
          findMany: async () =>
            simulations.map((simulationId) => ({ simulationId })),
        },
        foundationChapterSkip: { findMany: async () => [] },
      } as any,
      { getCompletedLessonIds: async () => new Set(completedLessons) } as any,
      {} as any,
    );
  }

  it('excludes Around Town from the A1 denominator', async () => {
    const view = await pathService().getFoundationV7('user');
    assert.equal(view.progress.totalCount, 156);
    assert.ok(!view.chapters.some((ch) => ch.id === 'v7_u16'));
    assert.equal(view.chapters.at(-1)?.id, 'v7_u15');
    assert.equal(FOUNDATION_V7_CATALOG.chapters.length, 16);
  });

  it('credits Find My Class when the legacy Plan My Class simulation is complete', async () => {
    const view = await pathService([], [], ['foundation_v7_u14n06']).getFoundationV7(
      'user',
    );
    assert.ok(view.progress.completedNodeIds.includes('v7_u14tn08f'));
  });

  it('maps a mid-old-Ch14 When lesson completion only to When or What Time', async () => {
    const view = await pathService(
      ['fnd_v7_where_when_how_much_and_how_many'],
      [],
      [],
    ).getFoundationV7('user');
    assert.ok(view.progress.completedNodeIds.includes('v7_u14tn01'));
    assert.ok(!view.progress.completedNodeIds.includes('v7_u14tn09'));
    assert.ok(!view.progress.completedNodeIds.includes('v7_u14tn12'));
  });

  it('does not inflate A1 completion from Around Town history', async () => {
    const view = await pathService(
      [],
      ['v7_u16n01', 'v7_u16n10'],
      ['foundation_v7_u16n10'],
    ).getFoundationV7('user');
    assert.equal(view.progress.completedCount, 0);
    assert.ok(getSimulation('foundation_v7_u16n10'));
  });

  it('keeps authored hint ladders on the three live Ch14–16 missions', () => {
    for (const id of [
      'foundation_v7_u14n15',
      'foundation_v7_u14tn21',
      'foundation_v7_u15n08',
    ]) {
      const sim = FOUNDATION_V7_SIMULATIONS.find((s) => s.simulationId === id);
      assert.ok(sim, id);
      assert.equal(sim!.goalsTh.length, 3, id);
      assert.equal(sim!.goalHints?.length, 3, id);
      assert.ok(
        sim!.goalHints?.every((h) => h && h.intentTh && h.starterEn && h.modelEn),
        id,
      );
      assert.equal(happyLinesFor(id).length, sim!.minTurns, id);
    }
  });

  it('accepts alternate question order for Plan a Movie happy path length', () => {
    const alternate = [
      'How much is one ticket? When is the movie?',
      'What time is the movie?',
    ];
    assert.equal(alternate.length, happyLinesFor('foundation_v7_u14tn21').length);
  });

  it('ships months 1–4 covering all twelve month names exactly once across NW packs', () => {
    const months = [1, 2, 3, 4].flatMap((n) =>
      (newWordsPoolById(`new_words_months_${n}`)?.items ?? []).map((i) =>
        i.answer.toLowerCase(),
      ),
    );
    assert.equal(months.length, 12);
    assert.equal(new Set(months).size, 12);
  });

  it('deals Months I Remember with Oct/Nov/Dec plus older months', () => {
    const deal = dealSayItPhrases('fnd_v7_u14tn18', 5);
    assert.equal(deal.length, 5);
    const joined = deal.map((p) => p.answerEn).join(' ');
    assert.match(joined, /October/i);
    assert.match(joined, /November/i);
    assert.match(joined, /December/i);
  });

  it('deals Questions in Real Life with schedule, price/qty, and Ch14 review', () => {
    for (let i = 0; i < 8; i++) {
      const deal = dealSayItPhrases('fnd_v7_u14tn20', 5);
      assert.equal(deal.length, 5);
      const joined = deal.map((p) => p.answerEn).join(' | ');
      assert.match(joined, /When is|What time/i, joined);
      assert.match(joined, /How much|How many/i, joined);
      assert.match(joined, /What is|Who is|Where is/i, joined);
    }
  });
});
