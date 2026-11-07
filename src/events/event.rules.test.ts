import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ANOMALY_ATTEMPT_COUNT,
  ANOMALY_SCORE_THRESHOLD,
  FINALIZING_DELAY_MS,
  type EventClock,
} from './event.types';
import {
  bangkokMinuteKey,
  clockStatus,
  defaultEventAvatarId,
  eventsApiEnabled,
  isAnomalousAttemptRate,
  isAnomalousScore,
  isEventGameKey,
  parseBangkokDateTime,
  rankMatchesTier,
  shouldDistribute,
  shouldNotifyEndingSoon,
  shouldSnapshot,
  tierForRank,
  validateRewardTiers,
} from './event.rules';

function clock(overrides: Partial<EventClock> = {}): EventClock {
  return {
    enabled: true,
    startsAt: new Date('2026-11-01T00:00:00+07:00'),
    endsAt: new Date('2026-11-30T23:59:59+07:00'),
    status: 'DRAFT',
    rewardHold: false,
    autoDistributeRewards: true,
    snapshotAt: null,
    ...overrides,
  };
}

describe('event.rules', () => {
  it('accepts known game keys', () => {
    assert.equal(isEventGameKey('emoji_speak_endless'), true);
    assert.equal(isEventGameKey('word_cards_endless'), true);
    assert.equal(isEventGameKey('explain_it_challenge'), true);
    assert.equal(isEventGameKey('describe_it'), false);
  });

  it('parses Bangkok local dates including end of day', () => {
    const start = parseBangkokDateTime('2026-11-01');
    assert.equal(start.toISOString(), '2026-10-31T17:00:00.000Z');
    const end = parseBangkokDateTime('2026-11-30', { endOfDay: true });
    assert.equal(end.toISOString(), '2026-11-30T16:59:59.000Z');
    const noon = parseBangkokDateTime('2026-11-05T15:30');
    assert.equal(noon.toISOString(), '2026-11-05T08:30:00.000Z');
  });

  it('advances Draft → Scheduled → Active → Ended from the clock', () => {
    const event = clock();
    assert.equal(clockStatus(event, new Date('2026-10-31T16:59:59Z')), 'SCHEDULED');
    assert.equal(clockStatus(event, new Date('2026-11-01T00:00:00+07:00')), 'ACTIVE');
    assert.equal(clockStatus(event, new Date('2026-11-30T23:59:59+07:00')), 'ACTIVE');
    assert.equal(clockStatus(event, new Date('2026-12-01T00:00:00+07:00')), 'ENDED');
  });

  it('keeps disabled future events in Draft and does not reopen Rewarded', () => {
    assert.equal(
      clockStatus(clock({ enabled: false }), new Date('2026-11-05T00:00:00+07:00')),
      'DRAFT',
    );
    assert.equal(
      clockStatus(
        clock({ status: 'REWARDED', snapshotAt: new Date() }),
        new Date('2026-12-01T00:00:00+07:00'),
      ),
      'REWARDED',
    );
  });

  it('snapshots after endsAt and distributes after the Finalizing delay', () => {
    const ended = clock({ status: 'ENDED' });
    const now = new Date('2026-12-01T00:10:00+07:00');
    assert.equal(shouldSnapshot(ended, now), true);
    assert.equal(shouldSnapshot({ ...ended, snapshotAt: now }, now), false);

    const snapshotAt = new Date('2026-12-01T00:00:00+07:00');
    const finalizing = clock({
      status: 'FINALIZING',
      snapshotAt,
    });
    assert.equal(shouldDistribute(finalizing, snapshotAt), false);
    assert.equal(
      shouldDistribute(finalizing, new Date(snapshotAt.getTime() + FINALIZING_DELAY_MS)),
      true,
    );
    assert.equal(
      shouldDistribute({ ...finalizing, rewardHold: true }, new Date(snapshotAt.getTime() + FINALIZING_DELAY_MS)),
      false,
    );
    assert.equal(
      shouldDistribute(
        { ...finalizing, autoDistributeRewards: false },
        new Date(snapshotAt.getTime() + FINALIZING_DELAY_MS),
      ),
      false,
    );
  });

  it('flags ending-soon in the last 24 hours of an Active event', () => {
    const event = clock({ status: 'ACTIVE' });
    assert.equal(
      shouldNotifyEndingSoon(event, new Date('2026-11-29T23:59:59+07:00'), false),
      true,
    );
    assert.equal(
      shouldNotifyEndingSoon(event, new Date('2026-11-29T23:59:59+07:00'), true),
      false,
    );
    assert.equal(
      shouldNotifyEndingSoon(event, new Date('2026-11-20T00:00:00+07:00'), false),
      false,
    );
  });

  it('maps ranks onto non-overlapping tiers', () => {
    const tiers = [
      { rankFrom: 1, rankTo: 1, name: 'gold' },
      { rankFrom: 2, rankTo: 10, name: 'silver' },
      { rankFrom: 11, rankTo: 100, name: 'bronze' },
    ];
    assert.equal(tierForRank(1, tiers)?.name, 'gold');
    assert.equal(tierForRank(10, tiers)?.name, 'silver');
    assert.equal(tierForRank(11, tiers)?.name, 'bronze');
    assert.equal(tierForRank(101, tiers), null);
    assert.equal(rankMatchesTier(1, 1, 1), true);
    assert.throws(() =>
      validateRewardTiers([
        { rankFrom: 1, rankTo: 5, nameTh: 'A', nameEn: 'A' },
        { rankFrom: 5, rankTo: 10, nameTh: 'B', nameEn: 'B' },
      ]),
    );
  });

  it('flags suspicious scores and attempt bursts', () => {
    assert.equal(isAnomalousScore(ANOMALY_SCORE_THRESHOLD), true);
    assert.equal(isAnomalousScore(ANOMALY_SCORE_THRESHOLD - 1), false);
    assert.equal(isAnomalousAttemptRate(ANOMALY_ATTEMPT_COUNT), true);
    assert.equal(isAnomalousAttemptRate(ANOMALY_ATTEMPT_COUNT - 1), false);
  });

  it('mints event avatar ids that cannot collide with catalog names', () => {
    const id = defaultEventAvatarId('3f2a8c1e-9b44-4d21-ae01-abcdef123456', 1);
    assert.match(id, /^event_[a-z0-9]+_1$/);
    assert.equal(id.startsWith('event_'), true);
  });

  it('keys scheduler locks on the Bangkok minute', () => {
    assert.equal(bangkokMinuteKey(new Date('2026-11-05T08:44:10Z')), '2026-11-05T15:44');
  });

  it('keeps the events API on by default with an explicit kill-switch', () => {
    assert.equal(
      eventsApiEnabled({ RAILWAY_PUBLIC_DOMAIN: 'banana-english-api-staging.up.railway.app' }),
      true,
    );
    assert.equal(
      eventsApiEnabled({ RAILWAY_PUBLIC_DOMAIN: 'banana-english-api-production.up.railway.app' }),
      true,
    );
    assert.equal(eventsApiEnabled({ NODE_ENV: 'production' }), true);
    assert.equal(eventsApiEnabled({ EVENTS_ENABLED: 'true', NODE_ENV: 'production' }), true);
    assert.equal(eventsApiEnabled({ EVENTS_ENABLED: 'false', RAILWAY_ENVIRONMENT: 'staging' }), false);
  });
});
