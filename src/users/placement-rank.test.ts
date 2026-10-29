import assert from 'node:assert/strict';
import test from 'node:test';
import {
  placementRankFor,
  placementRankScore,
  placementRankScoreFromResult,
  showsPlacementRank,
} from './placement-rank';

test('Seed does not show a percentile', () => {
  assert.equal(showsPlacementRank('Seed'), false);
  assert.equal(showsPlacementRank('Seed+'), true);
  assert.equal(showsPlacementRank('Seed++'), true);
  assert.equal(showsPlacementRank(null), false);
});

test('higher band always outranks more points in a lower band', () => {
  assert.ok(placementRankScore('A1', 0) > placementRankScore('Seed+', 40));
  assert.ok(placementRankScore('Seed', 0) > placementRankScore(null, 30));
});

test('score from stored result sums only 0/1/2 question scores', () => {
  const score = placementRankScoreFromResult({
    publicResult: 'A2',
    questionResults: [{ score: 2 }, { score: 1 }, { score: null }, { score: -1 }],
  });
  assert.equal(score, placementRankScore('A2', 3));
  assert.equal(placementRankScoreFromResult(null), null);
});

test('rank needs enough testers', () => {
  assert.equal(placementRankFor([1, 2, 3], 2), null);
});

test('top of the pile beats 99% and bottom beats 0%', () => {
  const scores = Array.from({ length: 100 }, (_, i) => i);
  assert.deepEqual(placementRankFor(scores, 99), {
    betterThanPercent: 99,
    topPercent: 1,
    testers: 100,
  });
  assert.equal(placementRankFor(scores, 0)?.betterThanPercent, 0);
});

test('ties count half', () => {
  const scores = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1];
  assert.equal(placementRankFor(scores, 1)?.betterThanPercent, 50);
  assert.equal(placementRankFor(scores, 1)?.topPercent, 50);
});

test('three quarters below gives Top 25%', () => {
  const scores = [...Array(75).fill(1), 5, ...Array(24).fill(9)];
  const rank = placementRankFor(scores, 5);
  assert.equal(rank?.betterThanPercent, 75);
  assert.equal(rank?.topPercent, 25);
});
