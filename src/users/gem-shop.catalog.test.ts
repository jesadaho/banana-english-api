import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  GEM_SHOP_APP_ICON_CLASSIC,
  GEM_SHOP_APP_ICON_SENSEI_B,
  GEM_SHOP_STREAK_REVIVAL,
  GEM_SHOP_STREAK_SHIELD,
  resolveGemShopSku,
} from './gem-shop.catalog';

describe('gem shop catalog', () => {
  it('resolves streak and app icon skus', () => {
    assert.deepEqual(resolveGemShopSku(GEM_SHOP_STREAK_SHIELD), {
      kind: 'streak_shield',
      price: 120,
    });
    assert.deepEqual(resolveGemShopSku(GEM_SHOP_STREAK_REVIVAL), {
      kind: 'streak_revival',
      price: 300,
    });
    assert.equal(resolveGemShopSku(GEM_SHOP_APP_ICON_CLASSIC)?.price, 0);
    assert.equal(resolveGemShopSku(GEM_SHOP_APP_ICON_SENSEI_B)?.price, 750);
  });

  it('resolves paid avatars and rejects grant-only / free', () => {
    assert.equal(resolveGemShopSku('owl')?.price, 500);
    assert.equal(resolveGemShopSku('frog_chick'), null);
    assert.equal(resolveGemShopSku('bogy'), null);
    assert.equal(resolveGemShopSku('nope'), null);
  });
});
