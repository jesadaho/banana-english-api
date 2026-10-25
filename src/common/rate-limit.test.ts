import { strict as assert } from 'node:assert';
import { beforeEach, test } from 'node:test';
import { clientIp, hitRateLimit, resetRateLimits } from './rate-limit';

beforeEach(() => resetRateLimits());

test('allows up to the limit, then asks to wait', () => {
  const now = 1_000_000;
  for (let i = 0; i < 3; i++) {
    assert.equal(hitRateLimit('k', 3, 60_000, now), 0);
  }
  assert.equal(hitRateLimit('k', 3, 60_000, now + 1_000), 59);
});

test('window resets', () => {
  const now = 1_000_000;
  hitRateLimit('k', 1, 1_000, now);
  assert.ok(hitRateLimit('k', 1, 1_000, now) > 0);
  assert.equal(hitRateLimit('k', 1, 1_000, now + 1_001), 0);
});

test('keys are separate', () => {
  const now = 1_000_000;
  hitRateLimit('a', 1, 60_000, now);
  assert.equal(hitRateLimit('b', 1, 60_000, now), 0);
});

test('clientIp reads the first forwarded address', () => {
  assert.equal(
    clientIp({ headers: { 'x-forwarded-for': '1.2.3.4, 10.0.0.1' } }),
    '1.2.3.4',
  );
  assert.equal(clientIp({ headers: {}, ip: '5.6.7.8' }), '5.6.7.8');
});
