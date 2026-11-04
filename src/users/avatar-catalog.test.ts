import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FREE_AVATAR_IDS, avatarSeedCost, canUseMemberAvatar, isKnownAvatarId, resolveDisplayedAvatarId } from './avatar-catalog';
import { effectiveSubscriptionTier } from '../subscriptions/subscription.constants';
import { UsersService } from './users.service';

test('membership avatars cannot be selected by free or insufficient tiers', () => {
  for (const id of ['dj_tiger', 'banana_astronaut', 'cool_black_cat', 'street_lion']) {
    assert.equal(isKnownAvatarId(id), true);
    assert.equal((FREE_AVATAR_IDS as readonly string[]).includes(id), false);
    assert.equal(canUseMemberAvatar(id, 'FREE'), false);
    assert.equal(canUseMemberAvatar(id, 'PRO_MAX'), true);
  }
  assert.equal(canUseMemberAvatar('dj_tiger', 'PRO'), true);
  assert.equal(canUseMemberAvatar('street_lion', 'PRO'), false);
  const expired = effectiveSubscriptionTier({subscriptionTier: 'PRO_MAX', subscriptionExpiresAt: new Date('2020-01-01')});
  assert.equal(canUseMemberAvatar('street_lion', expired), false);
});

test('gem prices and existing identities remain stable', () => {
  for (const id of ['kenji', 'sky', 'ray', 'owl', 'fox', 'koala']) assert.equal(avatarSeedCost(id), 500);
  assert.equal(avatarSeedCost('white_elephant'), 2500);
  for (const id of ['sunny', 'zig', 'bloo', 'linda']) assert.equal(resolveDisplayedAvatarId(id), id);
  assert.equal(resolveDisplayedAvatarId('unknown'), 'bogy');
});

test('select and unlock endpoints enforce membership even with an old unlocked ID', async () => {
  const service = Object.create(UsersService.prototype) as UsersService;
  const updates: unknown[] = [];
  Object.assign(service, {
    prisma: {user: {update: async (args: unknown) => { updates.push(args); return {}; }}},
    getProfile: async () => ({}),
  });
  const free = {id: 'test', subscriptionTier: 'FREE', subscriptionExpiresAt: null, unlockedAvatarIds: ['street_lion']} as any;
  await assert.rejects(service.selectAvatar(free, 'street_lion'), /Subscription required/);
  await assert.rejects(service.unlockAvatar(free, 'dj_tiger'), /Subscription required/);
  assert.equal(updates.length, 0);
  const pro = {...free, subscriptionTier: 'PRO', subscriptionExpiresAt: new Date('2099-01-01')};
  await service.selectAvatar(pro, 'dj_tiger');
  await assert.rejects(service.selectAvatar(pro, 'street_lion'), /Subscription required/);
  await service.unlockAvatar({...pro, subscriptionTier: 'PRO_MAX'}, 'street_lion');
  assert.equal(updates.length, 2);
});
