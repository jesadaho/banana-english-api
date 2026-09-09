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
assert.equal(packs.length, 2);
assert.deepEqual(packs[0], {
  productId: 'banana_tickets_28',
  bananas: 60,
  fallbackPrice: '฿99',
  bestValue: false,
});
assert.deepEqual(packs[1], {
  productId: 'banana_tickets_70',
  bananas: 150,
  fallbackPrice: '฿199',
  bestValue: true,
});

console.log('product-catalog.test.ts OK');
