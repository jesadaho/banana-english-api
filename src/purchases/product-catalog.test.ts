import assert from 'node:assert/strict';
import {
  bananasForProduct,
  isKnownBananaPack,
  listBananaPacks,
} from './product-catalog';

assert.equal(bananasForProduct('banana_tickets_28'), 50);
assert.equal(bananasForProduct('banana_tickets_70'), 120);
assert.equal(bananasForProduct('unknown'), null);
assert.equal(isKnownBananaPack('banana_tickets_28'), true);
assert.equal(isKnownBananaPack('banana_tickets_70'), true);
assert.equal(isKnownBananaPack('other'), false);

const packs = listBananaPacks();
assert.equal(packs.length, 2);
assert.deepEqual(packs[0], {
  productId: 'banana_tickets_28',
  bananas: 50,
  fallbackPrice: '฿99',
  bestValue: false,
});
assert.deepEqual(packs[1], {
  productId: 'banana_tickets_70',
  bananas: 120,
  fallbackPrice: '฿199',
  bestValue: true,
});

console.log('product-catalog.test.ts OK');
