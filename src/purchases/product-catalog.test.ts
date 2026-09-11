import assert from 'node:assert/strict';
import {
  bananasForProduct,
  isKnownBananaPack,
  listBananaPacks,
} from './product-catalog';

assert.equal(bananasForProduct('banana_tickets_28'), 60);
assert.equal(bananasForProduct('banana_tickets_70'), 150);
assert.equal(bananasForProduct('unknown'), null);
assert.equal(isKnownBananaPack('banana_tickets_28'), true);
assert.equal(isKnownBananaPack('banana_tickets_70'), true);
assert.equal(isKnownBananaPack('other'), false);

const packs = listBananaPacks();
assert.equal(packs.length, 1);
assert.deepEqual(packs[0], {
  productId: 'banana_tickets_28',
  bananas: 60,
  fallbackPrice: '฿79',
  bestValue: true,
});

console.log('product-catalog.test.ts OK');
