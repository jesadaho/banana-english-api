import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  canBookLiveTalkSession,
  findSessionClash,
  parseSessionInput,
  sessionsOverlap,
} from './live-talk-schedule.rules';

const at = (iso: string) => new Date(iso);

describe('live talk session rules', () => {
  it('treats back-to-back sessions as not overlapping', () => {
    const a = { startsAt: at('2026-11-10T12:00:00Z'), durationMin: 60 };
    const b = { startsAt: at('2026-11-10T13:00:00Z'), durationMin: 30 };
    assert.equal(sessionsOverlap(a, b), false);
    const c = { startsAt: at('2026-11-10T12:30:00Z'), durationMin: 30 };
    assert.equal(sessionsOverlap(a, c), true);
  });

  it('ignores the session itself when editing', () => {
    const mine = { id: 's1', startsAt: at('2026-11-10T12:00:00Z'), durationMin: 60 };
    assert.equal(findSessionClash(mine, [mine]), null);
    const other = { id: 's2', startsAt: at('2026-11-10T12:45:00Z'), durationMin: 30 };
    assert.equal(findSessionClash(mine, [mine, other])?.id, 's2');
  });

  it('validates time, duration and title', () => {
    const now = at('2026-11-08T00:00:00Z');
    assert.deepEqual(parseSessionInput({ startsAt: 'x', title: 't' }, now), {
      ok: false,
      error: 'startsAt_invalid',
    });
    assert.equal(
      (parseSessionInput({ startsAt: '2026-11-08T00:01:00Z', title: 't' }, now) as { error: string }).error,
      'starts_too_soon',
    );
    assert.equal(
      (parseSessionInput({ startsAt: '2026-11-09T00:00:00Z', durationMin: 50, title: 't' }, now) as { error: string }).error,
      'duration_invalid',
    );
    assert.equal(
      (parseSessionInput({ startsAt: '2026-11-09T00:00:00Z', title: '  ' }, now) as { error: string }).error,
      'title_required',
    );
    const ok = parseSessionInput(
      { startsAt: '2026-11-09T13:00:00Z', durationMin: 45, title: ' Small talk ' },
      now,
    );
    assert.equal(ok.ok, true);
    if (ok.ok) {
      assert.equal(ok.value.title, 'Small talk');
      assert.equal(ok.value.durationMin, 45);
    }
  });

  it('lets only official hosts and admins book', () => {
    assert.equal(canBookLiveTalkSession({ hostLevel: 'official' }), true);
    assert.equal(canBookLiveTalkSession({ hostLevel: 'host' }), false);
    assert.equal(canBookLiveTalkSession({ hostLevel: 'none', communityAdmin: true }), true);
  });
});
