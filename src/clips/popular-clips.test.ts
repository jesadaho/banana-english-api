import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { rankPopularClips } from './popular-clips';

type Card = { id: string; title: string };

const views: Card[] = [
  { id: 'a', title: 'Alpha' },
  { id: 'b', title: 'Beta' },
  { id: 'c', title: 'Gamma' },
  { id: 'd', title: 'Delta' },
  { id: 'e', title: 'Epsilon' },
];

describe('rankPopularClips', () => {
  it('ranks by completed plays in the provided counts (7-day window is the query)', () => {
    const ranked = rankPopularClips(
      views,
      [
        { clipId: 'c', n: 2 },
        { clipId: 'a', n: 9 },
        { clipId: 'b', n: 5 },
      ],
      { parrotoViews: () => 0, limit: 3 },
    );
    assert.deepEqual(
      ranked.map((v) => v.id),
      ['a', 'b', 'c'],
    );
  });

  it('ignores zero / unknown clip ids in completed counts', () => {
    const ranked = rankPopularClips(
      views,
      [
        { clipId: 'a', n: 0 },
        { clipId: 'missing', n: 99 },
        { clipId: 'b', n: 3 },
      ],
      { parrotoViews: () => 0, limit: 5 },
    );
    assert.deepEqual(
      ranked.map((v) => v.id),
      ['b'],
    );
  });

  it('fills with Parroto when completes are thin, without duplicating', () => {
    const ranked = rankPopularClips(
      views,
      [{ clipId: 'a', n: 4 }],
      {
        parrotoViews: (title) =>
          title === 'Gamma' ? 100 : title === 'Beta' ? 50 : 0,
        limit: 3,
      },
    );
    assert.deepEqual(
      ranked.map((v) => v.id),
      ['a', 'c', 'b'],
    );
  });

  it('uses progress counts only after completes and Parroto', () => {
    const ranked = rankPopularClips(
      views,
      [{ clipId: 'a', n: 1 }],
      {
        parrotoViews: (title) => (title === 'Beta' ? 10 : 0),
        progressCounts: [
          { clipId: 'd', n: 500 },
          { clipId: 'e', n: 200 },
          { clipId: 'a', n: 999 }, // already picked via completes
        ],
        limit: 4,
      },
    );
    assert.deepEqual(
      ranked.map((v) => v.id),
      ['a', 'b', 'd', 'e'],
    );
  });

  it('stops at the limit once enough completes exist', () => {
    const many = Array.from({ length: 12 }, (_, i) => ({
      id: `c${i}`,
      title: `T${i}`,
    }));
    const completed = many.map((v, i) => ({ clipId: v.id, n: 100 - i }));
    const ranked = rankPopularClips(many, completed, {
      parrotoViews: () => 999,
      limit: 10,
    });
    assert.equal(ranked.length, 10);
    assert.deepEqual(
      ranked.map((v) => v.id),
      many.slice(0, 10).map((v) => v.id),
    );
  });
});
