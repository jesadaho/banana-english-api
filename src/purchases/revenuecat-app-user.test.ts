import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  anonymousIdFromGuestAppUserId,
  revenueCatAppUserId,
  revenueCatAppUserIdCandidates,
} from './revenuecat-app-user';

test('guest without Firebase buys under guest_<anonymousId>', () => {
  const user = { firebaseUid: null, anonymousId: 'abc-123' };
  assert.equal(revenueCatAppUserId(user), 'guest_abc-123');
  assert.deepEqual(revenueCatAppUserIdCandidates(user), ['guest_abc-123']);
});

test('signed-in user prefers Firebase uid but still checks guest id', () => {
  const user = { firebaseUid: 'fb-uid', anonymousId: 'abc-123' };
  assert.equal(revenueCatAppUserId(user), 'fb-uid');
  assert.deepEqual(revenueCatAppUserIdCandidates(user), [
    'fb-uid',
    'guest_abc-123',
  ]);
});

test('webhook maps guest app user id back to anonymousId', () => {
  assert.equal(anonymousIdFromGuestAppUserId('guest_abc-123'), 'abc-123');
  assert.equal(anonymousIdFromGuestAppUserId('fb-uid'), null);
  assert.equal(anonymousIdFromGuestAppUserId('guest_'), null);
});
