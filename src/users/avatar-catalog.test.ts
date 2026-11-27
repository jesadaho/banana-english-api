import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  FREE_AVATAR_IDS,
  avatarSeedCost,
  canUseMemberAvatar,
  isGrantOnlyAvatar,
  isKnownAvatarId,
  resolveDisplayedAvatarId,
} from './avatar-catalog';
import { effectiveSubscriptionTier } from '../subscriptions/subscription.constants';
import { UsersService } from './users.service';

test('frog_chick is a known grant-only Live Talk reward', () => {
  assert.equal(isKnownAvatarId('frog_chick'), true);
  assert.equal(isGrantOnlyAvatar('frog_chick'), true);
  assert.equal((FREE_AVATAR_IDS as readonly string[]).includes('frog_chick'), false);
  assert.equal(resolveDisplayedAvatarId('frog_chick'), 'frog_chick');
});

test('membership avatars cannot be selected by free or insufficient tiers', () => {
  for (const id of ['dj_tiger', 'banana_astronaut', 'cool_black_cat', 'street_lion', 'nerd_chic_girl', 'street_pony_girl', 'navy_beanie_boy', 'cool_capybara', 'headphone_otter', 'star_hippo']) {
    assert.equal(isKnownAvatarId(id), true);
    assert.equal((FREE_AVATAR_IDS as readonly string[]).includes(id), false);
    assert.equal(canUseMemberAvatar(id, 'FREE'), false);
    assert.equal(canUseMemberAvatar(id, 'PRO_MAX'), true);
  }
  assert.equal(canUseMemberAvatar('dj_tiger', 'PRO'), true);
  assert.equal(canUseMemberAvatar('street_lion', 'PRO'), false);
  for (const id of ['nerd_chic_girl', 'street_pony_girl', 'navy_beanie_boy', 'cool_capybara', 'headphone_otter', 'star_hippo']) {
    assert.equal(canUseMemberAvatar(id, 'PRO'), false);
  }
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

test('learners cannot buy grant-only avatars with seeds', async () => {
  const service = Object.create(UsersService.prototype) as UsersService;
  Object.assign(service, {
    prisma: { user: { update: async () => { throw new Error('should not update'); } } },
    getProfile: async () => ({}),
  });
  const user = {
    id: 'test',
    subscriptionTier: 'FREE',
    subscriptionExpiresAt: null,
    unlockedAvatarIds: [],
    bananaSeedBalance: 999999,
  } as any;
  await assert.rejects(service.unlockAvatar(user, 'frog_chick'), /grant-only/);
});
