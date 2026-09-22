import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DescribeItController } from './describe-it.controller';
import { DescribeItService } from './describe-it.service';
import {
  dealDescribeItCards,
  describeItPoolById,
  isValidDescribeItPack,
  listDescribeItPools,
} from './describe-it.data';

const req = { user: { id: 'describe-it-test', displayName: 'Mia' } } as any;

describe('Describe It foundation pack', () => {
  it('lists playable hub pools', () => {
    const pools = listDescribeItPools();
    assert.equal(pools.length, 2);
    assert.deepEqual(
      pools.map((pool) => pool.id).sort(),
      ['fnd_v7_u03n05', 'fnd_v7_u13n05'],
    );
    const lookAtMe = pools.find((pool) => pool.id === 'fnd_v7_u03n05');
    assert.equal(lookAtMe?.poolSize, 6);
    assert.equal(lookAtMe?.locked, false);
  });

  it('deals six Look at Me cards in order with a first-item hint', () => {
    const pool = describeItPoolById('fnd_v7_u03n05');
    assert.ok(isValidDescribeItPack(pool));
    const items = dealDescribeItCards('fnd_v7_u03n05');
    assert.equal(items.length, 6);
    assert.deepEqual(items.map((item) => item.id), [
      '01-happy',
      '02-tired',
      '03-hungry',
      '04-hot',
      '05-cold',
      '06-sick',
    ]);
    assert.equal(items[0].hintEn, 'I am _____');
    assert.equal(items[0].answerEn, 'I am happy.');
    assert.equal(items[0].answerTh, 'ฉันมีความสุข');
    assert.ok(items.every((item) => (item.answerTh ?? '').trim().length > 0));
    assert.ok(items[0].imageUrl.includes('describe-it%2Ffnd_v7_u03n05%2F01-happy.webp'));
    assert.ok(items.slice(1).every((item) => !item.hintEn));
  });

  it('deals five authored Now cards in order with a first-item hint', () => {
    const pool = describeItPoolById('fnd_v7_u13n05');
    assert.ok(isValidDescribeItPack(pool));
    const items = dealDescribeItCards('fnd_v7_u13n05');
    assert.equal(items.length, 5);
    assert.deepEqual(items.map((item) => item.id), [
      '01-she-is-reading',
      '02-he-is-eating',
      '03-they-are-waiting',
      '04-he-is-cooking',
      '05-they-are-walking',
    ]);
    assert.equal(items[0].hintEn, 'She _____');
    assert.equal(items[0].answerEn, 'She is reading.');
    assert.equal(items[0].answerTh, 'เธอกำลังอ่านหนังสือ');
    assert.ok(items.every((item) => (item.answerTh ?? '').trim().length > 0));
    assert.ok(items[0].imageUrl.includes('describe-it%2Ffnd_v7_u13n05%2F01-she-is-reading.webp'));
    assert.ok(items.slice(1).every((item) => !item.hintEn));
  });

  it('starts for 1 banana and completes with the canonical reward id', async () => {
    const calls: any[] = [];
    const spends: any[] = [];
    const scores: any[] = [];
    const claimed = new Set<string>();
    const controller = new DescribeItController(
      new DescribeItService(),
      {
        applyMiniGameRewards: async (p: any) => {
          calls.push(p);
          claimed.add(p.gameId);
          return p;
        },
        recordMiniGameScore: async (p: any) => {
          scores.push(p);
        },
        hasClaimedMiniGameReward: async (_userId: string, gameId: string) =>
          claimed.has(gameId),
        spendBananas: async (
          userId: string,
          amount: number,
          referenceId: string,
          source: string,
        ) => {
          spends.push({ userId, amount, referenceId, source });
        },
        refundBananas: async () => {
          throw new Error('should not refund on successful start');
        },
      } as any,
      { markActivity: async () => {} } as any,
    );
    const start = await controller.startPool(req, 'fnd_v7_u03n05');
    assert.equal(start.bananaCost, 1);
    assert.equal(start.dealCount, 6);
    assert.equal(spends.length, 1);
    assert.equal(spends[0].amount, 1);
    assert.equal(spends[0].source, 'describe_it_start');
    const reward = await controller.completePool(req, 'fnd_v7_u03n05', {
      correctCount: 5,
      totalCount: 6,
    });
    assert.equal((reward as any).gameId, 'describe_it:fnd_v7_u03n05');
    assert.equal(calls.length, 1);
    assert.equal(scores.length, 1);
    assert.equal(scores[0].correctCount, 5);
    assert.equal(scores[0].totalCount, 6);
    assert.equal(scores[0].kind, 'describe_it');

    const replay = await controller.startPool(req, 'fnd_v7_u03n05');
    assert.equal(replay.bananaCost, 0);
    assert.equal(spends.length, 1, 'replay must not charge again');

    const startNow = await controller.startPool(req, 'fnd_v7_u13n05');
    assert.equal(startNow.dealCount, 5);
    assert.equal(startNow.bananaCost, 1);
    await controller.completePool(req, 'fnd_v7_u13n05');
    assert.equal(calls.length, 2);
    assert.equal(scores.length, 2);
    assert.equal(spends.length, 2);
    await assert.rejects(controller.completePool(req, 'fnd_v7_unknown'));
  });
});
