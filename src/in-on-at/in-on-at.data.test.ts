import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  dealInOnAt,
  IN_ON_AT_ITEMS,
  inOnAtPoolFor,
} from './in-on-at.data';

function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

test('pool items are well formed', () => {
  const ids = new Set<string>();
  for (const item of IN_ON_AT_ITEMS) {
    assert.ok(!ids.has(item.id), `duplicate id ${item.id}`);
    ids.add(item.id);
    assert.ok(['in', 'on', 'at'].includes(item.answer), item.id);
    assert.equal(item.prompt.split('___').length, 2, `${item.id} needs one blank`);
    assert.ok(item.word.length > 0 && item.reasonTh.length > 0, item.id);
    assert.ok(item.promptTh.includes('___'), `${item.id} promptTh needs a blank`);
  }
  assert.ok(inOnAtPoolFor('time').length >= 60);
  assert.ok(inOnAtPoolFor('place').length >= 60);
});

for (const topic of ['time', 'place', 'mix']) {
  test(`${topic} deal: 7 items, 2-3 per answer, 2+ traps, no repeats`, () => {
    for (let seed = 1; seed <= 50; seed++) {
      const deal = dealInOnAt(topic, 7, seeded(seed));
      assert.equal(deal.length, 7);
      for (const answer of ['in', 'on', 'at']) {
        const n = deal.filter((d) => d.answer === answer).length;
        assert.ok(n >= 2 && n <= 3);
      }
      assert.ok(deal.filter((d) => d.trap).length >= 2);
      assert.equal(new Set(deal.map((d) => d.id)).size, 7);
      if (topic === 'mix') {
        assert.ok(deal.some((d) => d.topic === 'time'));
        assert.ok(deal.some((d) => d.topic === 'place'));
      } else {
        assert.ok(deal.every((d) => d.topic === topic));
      }
    }
  });
}

test('unknown topic deals nothing', () => {
  assert.deepEqual(dealInOnAt('nope'), []);
});
