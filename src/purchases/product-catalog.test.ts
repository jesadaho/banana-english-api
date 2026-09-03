import assert from 'node:assert/strict';
import { bananasForProduct, isKnownBananaPack } from './product-catalog';

assert.equal(bananasForProduct('banana_tickets_28'), 28);
assert.equal(bananasForProduct('banana_tickets_70'), 70);
assert.equal(bananasForProduct('unknown'), null);
assert.equal(isKnownBananaPack('banana_tickets_28'), true);
assert.equal(isKnownBananaPack('banana_tickets_70'), true);
assert.equal(isKnownBananaPack('other'), false);

console.log('product-catalog.test.ts OK');
