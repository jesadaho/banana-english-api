import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DescribeItController } from './describe-it.controller';
import { DescribeItService } from './describe-it.service';
import {
  dealDescribeItCards,
  describeItPoolById,
  isValidDescribeItPack,
} from './describe-it.data';

const req = { user: { id: 'describe-it-test', displayName: 'Mia' } } as any;

describe('Describe It foundation pack', () => {
  it('deals five authored cards in order with a first-item hint', () => {
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
    assert.ok(items[0].imageUrl.includes('describe-it%2Ffnd_v7_u13n05%2F01-she-is-reading.webp'));
    assert.ok(items.slice(1).every((item) => !item.hintEn));
  });

  it('starts free and completes with the canonical reward id', async () => {
    const calls: any[] = [];
    const controller = new DescribeItController(
      new DescribeItService(),
      {
        applyMiniGameRewards: async (p: any) => {
          calls.push(p);
          return p;
        },
        spendBananas: async () => {
          throw new Error('Describe It Foundation start should remain free');
        },
      } as any,
      { markActivity: async () => {} } as any,
    );
    const start = await controller.startPool(req, 'fnd_v7_u13n05');
    assert.equal(start.bananaCost, 0);
    assert.equal(start.dealCount, 5);
    const reward = await controller.completePool(req, 'fnd_v7_u13n05');
    assert.equal((reward as any).gameId, 'describe_it:fnd_v7_u13n05');
    assert.equal(calls.length, 1);
    await assert.rejects(controller.completePool(req, 'fnd_v7_unknown'));
  });
});
