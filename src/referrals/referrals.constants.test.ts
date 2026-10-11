import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  bangkokMonthStart,
  generateReferralCode,
  normalizeReferralCode,
} from './referrals.constants';

test('normalizeReferralCode accepts typed, linked and clipboard forms', () => {
  assert.equal(normalizeReferralCode('BANANA-K7Q2'), 'BANANA-K7Q2');
  assert.equal(normalizeReferralCode(' banana-k7q2 '), 'BANANA-K7Q2');
  assert.equal(normalizeReferralCode('k7q2'), 'BANANA-K7Q2');
  assert.equal(normalizeReferralCode('BANANA K7Q2'), 'BANANA-K7Q2');
  assert.equal(normalizeReferralCode('BANANA-REF:BANANA-K7Q2'), 'BANANA-K7Q2');
  assert.equal(normalizeReferralCode(''), null);
  assert.equal(normalizeReferralCode('BANANA-!!'), null);
});

test('generateReferralCode uses the BANANA- prefix and safe alphabet', () => {
  const code = generateReferralCode();
  assert.match(code, /^BANANA-[A-HJKMNP-Z2-9]{4}$/);
});

test('bangkokMonthStart rolls over at Bangkok midnight, not UTC', () => {
  // 2026-10-31 18:00 UTC is already Nov 1 01:00 in Bangkok.
  assert.equal(
    bangkokMonthStart(new Date('2026-10-31T18:00:00Z')).toISOString(),
    '2026-10-31T17:00:00.000Z',
  );
  assert.equal(
    bangkokMonthStart(new Date('2026-10-15T00:00:00Z')).toISOString(),
    '2026-09-30T17:00:00.000Z',
  );
});
