import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { hashPaywallArm, PAYWALL_ARMS, paywallArmFor, parsePaywallAbSettings } from './paywall-ab';

describe('paywall A/B', () => {
  const on = parsePaywallAbSettings('', '2026-11-24T00:00:00+07:00');
  const after = new Date('2026-11-25T00:00:00Z');

  it('splits users about 1/3 each, stable per user', () => {
    const counts = { A: 0, B: 0, C: 0 };
    for (let i = 0; i < 3000; i++) counts[hashPaywallArm(`u${i}`)]++;
    for (const k of ['A', 'B', 'C'] as const) assert.ok(counts[k] > 900 && counts[k] < 1100, `${k}=${counts[k]}`);
    assert.equal(hashPaywallArm('abc'), hashPaywallArm('abc'));
  });

  it('serves the stored arm, nothing before start or when off', () => {
    assert.equal(paywallArmFor({ id: 'x', paywallArm: 'C' }, on, after), 'C');
    assert.equal(paywallArmFor({ id: 'x' }, on, new Date('2026-11-20T00:00:00Z')), null);
    assert.equal(paywallArmFor({ id: 'x', paywallArm: 'B' }, parsePaywallAbSettings('off'), after), null);
  });

  it('arms map to the three offers', () => {
    assert.deepEqual(
      Object.values(PAYWALL_ARMS).map((a) => a.productId),
      ['pro_yearly', 'pro_monthly', 'promax_monthly'],
    );
  });
});
