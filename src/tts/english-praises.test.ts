import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  A2_PRAISES,
  EARLY_PRAISES,
  LATER_PRAISES,
  a2EnglishPraiseFor,
  englishPraiseFor,
} from './english-praises';

describe('praise pools (EN+TH 50/50)', () => {
  it('keeps equal English and Thai counts in every pool', () => {
    assert.equal(EARLY_PRAISES.length, 6);
    assert.equal(EARLY_PRAISES.filter((p) => /[A-Za-z]/.test(p)).length, 3);
    assert.equal(EARLY_PRAISES.filter((p) => /[ก-๙]/.test(p)).length, 3);
    assert.equal(LATER_PRAISES.length, 6);
    assert.equal(LATER_PRAISES.filter((p) => /[ก-๙]/.test(p)).length, 3);
    assert.equal(A2_PRAISES.length, 6);
    assert.equal(A2_PRAISES.filter((p) => /[ก-๙]/.test(p)).length, 3);
  });

  it('picks both languages across seeds', () => {
    const early = new Set(
      Array.from({ length: 60 }, (_, i) => englishPraiseFor(`seed-${i}`, 'greetings')),
    );
    assert.ok([...early].some((p) => /[ก-๙]/.test(p)), 'early pool should hit Thai');
    assert.ok([...early].some((p) => /^[A-Za-z]/.test(p)), 'early pool should hit English');

    const a2 = new Set(Array.from({ length: 60 }, (_, i) => a2EnglishPraiseFor(`a2-${i}`)));
    assert.ok([...a2].some((p) => /[ก-๙]/.test(p)), 'A2 pool should hit Thai');
    assert.ok([...a2].some((p) => /^[A-Za-z]/.test(p)), 'A2 pool should hit English');
  });
});
