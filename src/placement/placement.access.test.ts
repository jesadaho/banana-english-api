import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  addDaysToDateKey,
  isPaidPlacementRetest,
  normalizePlacementEntrySource,
  placementRetestStatus,
  placementRuntimeEntrySource,
  shouldStampPlacementTest,
} from './placement.access';

describe('placement retest access', () => {
  it('charges growth and settings, not onboarding or debug', () => {
    assert.equal(isPaidPlacementRetest('growth'), true);
    assert.equal(isPaidPlacementRetest('profile_settings'), true);
    assert.equal(isPaidPlacementRetest('onboarding'), false);
    assert.equal(isPaidPlacementRetest('debug'), false);
    assert.equal(shouldStampPlacementTest('debug'), false);
    assert.equal(shouldStampPlacementTest('onboarding'), true);
    assert.equal(placementRuntimeEntrySource('growth'), 'profile_settings');
    assert.equal(placementRuntimeEntrySource('debug'), 'profile_settings');
    assert.equal(placementRuntimeEntrySource('onboarding'), 'onboarding');
    assert.equal(normalizePlacementEntrySource('growth'), 'growth');
    assert.equal(normalizePlacementEntrySource('weird'), 'onboarding');
  });

  it('makes the first test free', () => {
    const first = placementRetestStatus(
      { timezone: 'Asia/Bangkok', lastPlacementTestAt: null },
      new Date('2026-10-20T10:00:00+07:00'),
    );
    assert.equal(first.available, true);
    assert.equal(first.bananaCost, 0);
    assert.equal(first.daysRemaining, 0);
  });

  it('locks 30 learner-local days after a test, then costs 5 bananas', () => {
    const user = {
      timezone: 'Asia/Bangkok',
      lastPlacementTestAt: new Date('2026-10-08T12:00:00+07:00'),
    };
    const locked = placementRetestStatus(
      user,
      new Date('2026-10-20T09:37:00+07:00'),
    );
    assert.equal(locked.available, false);
    assert.equal(locked.bananaCost, 5);
    assert.equal(locked.daysRemaining, 18);
    assert.equal(locked.nextAvailableDateKey, '2026-11-07');
    assert.equal(locked.cooldownDays, 30);

    const open = placementRetestStatus(
      user,
      new Date('2026-11-07T00:00:00+07:00'),
    );
    assert.equal(open.available, true);
    assert.equal(open.bananaCost, 5);
    assert.equal(open.daysRemaining, 0);
  });

  it('counts 30 days remaining when taken today', () => {
    const sameDay = placementRetestStatus(
      {
        timezone: 'Asia/Bangkok',
        lastPlacementTestAt: new Date('2026-10-20T08:00:00+07:00'),
      },
      new Date('2026-10-20T10:50:00+07:00'),
    );
    assert.equal(sameDay.available, false);
    assert.equal(sameDay.daysRemaining, 30);
    assert.equal(addDaysToDateKey('2026-10-20', 30), '2026-11-19');
  });
});
