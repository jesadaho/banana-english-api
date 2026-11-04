import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  LIVE_TALK_SPEAKER_CAP,
  canCreateLiveTalkRoom,
  canSpeakAtLevel,
  canSubmitLiveTalkLeaveRating,
  decideJoin,
  decidePromote,
  liveTalkCreateOpen,
  shouldSampleLiveTalkLeaveRating,
} from './live-talk.rules';
import { mintLiveKitJwt } from './live-talk.token';

describe('canSpeakAtLevel', () => {
  it('blocks Seed bands from A1 rooms', () => {
    assert.equal(canSpeakAtLevel('Seed', 'a1'), false);
    assert.equal(canSpeakAtLevel('Seed+', 'a1'), false);
    assert.equal(canSpeakAtLevel('Seed++', 'a1'), false);
    assert.equal(canSpeakAtLevel(null, 'a1'), false);
  });

  it('allows A1 and above in A1 rooms', () => {
    assert.equal(canSpeakAtLevel('A1', 'a1'), true);
    assert.equal(canSpeakAtLevel('A1+', 'a1'), true);
    assert.equal(canSpeakAtLevel('A2', 'a1'), true);
  });

  it('requires A2 for a2 rooms', () => {
    assert.equal(canSpeakAtLevel('A1', 'a2'), false);
    assert.equal(canSpeakAtLevel('A2', 'a2'), true);
  });

  it('lets anyone speak when listen_all', () => {
    assert.equal(canSpeakAtLevel(null, 'listen_all'), true);
    assert.equal(canSpeakAtLevel('Seed', 'listen_all'), true);
  });
});

describe('decideJoin', () => {
  it('always lets listeners in', () => {
    const d = decideJoin({
      requested: 'listener',
      roomStatus: 'live',
      speakerCount: 10,
      band: 'Seed',
      minSpeakLevel: 'a1',
      isHost: false,
    });
    assert.deepEqual(d, { ok: true, role: 'listener' });
  });

  it('rejects speakers when full', () => {
    const d = decideJoin({
      requested: 'speaker',
      roomStatus: 'live',
      speakerCount: LIVE_TALK_SPEAKER_CAP,
      band: 'A1',
      minSpeakLevel: 'a1',
      isHost: false,
    });
    assert.deepEqual(d, { ok: false, reason: 'speaker_full' });
  });

  it('rejects speakers below A1', () => {
    const d = decideJoin({
      requested: 'speaker',
      roomStatus: 'live',
      speakerCount: 2,
      band: 'Seed',
      minSpeakLevel: 'a1',
      isHost: false,
    });
    assert.deepEqual(d, { ok: false, reason: 'level_too_low' });
  });

  it('lets the host rejoin as host even when full', () => {
    const d = decideJoin({
      requested: 'speaker',
      roomStatus: 'live',
      speakerCount: LIVE_TALK_SPEAKER_CAP,
      band: 'Seed',
      minSpeakLevel: 'a1',
      isHost: true,
    });
    assert.deepEqual(d, { ok: true, role: 'host' });
  });

  it('blocks join after the room ended', () => {
    const d = decideJoin({
      requested: 'listener',
      roomStatus: 'ended',
      speakerCount: 1,
      band: 'A1',
      minSpeakLevel: 'a1',
      isHost: false,
    });
    assert.deepEqual(d, { ok: false, reason: 'room_ended' });
  });
});

describe('decidePromote', () => {
  it('promotes an A1 listener when a seat is free', () => {
    const d = decidePromote({
      speakerCount: 3,
      band: 'A1',
      minSpeakLevel: 'a1',
    });
    assert.deepEqual(d, { ok: true, role: 'speaker' });
  });
});

describe('canCreateLiveTalkRoom', () => {
  it('opens for everyone on staging', () => {
    assert.equal(liveTalkCreateOpen({ RAILWAY_ENVIRONMENT: 'staging' }), true);
    assert.equal(
      canCreateLiveTalkRoom(
        { communityAdmin: false },
        { RAILWAY_PUBLIC_DOMAIN: 'banana-english-api-staging.up.railway.app' },
      ),
      true,
    );
  });

  it('stays admin-only in production', () => {
    const prod = {
      LIVE_TALK_OPEN_CREATE: 'false',
      RAILWAY_ENVIRONMENT: 'production',
    };
    assert.equal(liveTalkCreateOpen(prod), false);
    assert.equal(canCreateLiveTalkRoom({ communityAdmin: false }, prod), false);
    assert.equal(canCreateLiveTalkRoom({ communityAdmin: true }, prod), true);
  });
});

describe('mintLiveKitJwt', () => {
  it('signs a three-part HS256 token', () => {
    const token = mintLiveKitJwt(
      {
        identity: 'u1',
        displayName: 'May',
        room: 'lt_abc',
        canPublish: true,
      },
      'apikey',
      'secret',
    );
    assert.equal(token.split('.').length, 3);
  });
});

describe('canSubmitLiveTalkLeaveRating', () => {
  const now = new Date('2026-11-04T07:30:00.000Z');

  it('rejects listens shorter than 3 minutes', () => {
    assert.deepEqual(
      canSubmitLiveTalkLeaveRating({
        listenedMs: 3 * 60 * 1000 - 1,
        timezone: 'Asia/Bangkok',
        now,
      }),
      { ok: false, reason: 'too_soon' },
    );
  });

  it('rejects a second rating on the same local day', () => {
    assert.deepEqual(
      canSubmitLiveTalkLeaveRating({
        listenedMs: 3 * 60 * 1000,
        lastRatedAt: new Date('2026-11-04T01:00:00.000Z'),
        timezone: 'Asia/Bangkok',
        now,
      }),
      { ok: false, reason: 'already_rated_today' },
    );
  });

  it('allows a rating after 3 minutes when none today', () => {
    assert.deepEqual(
      canSubmitLiveTalkLeaveRating({
        listenedMs: 3 * 60 * 1000,
        lastRatedAt: new Date('2026-11-03T10:00:00.000Z'),
        timezone: 'Asia/Bangkok',
        now,
      }),
      { ok: true },
    );
  });
});

describe('shouldSampleLiveTalkLeaveRating', () => {
  it('keeps 30 percent of eligible exits', () => {
    assert.equal(shouldSampleLiveTalkLeaveRating(0), true);
    assert.equal(shouldSampleLiveTalkLeaveRating(0.29), true);
    assert.equal(shouldSampleLiveTalkLeaveRating(0.3), false);
  });
});
