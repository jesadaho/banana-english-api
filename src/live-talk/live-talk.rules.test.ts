import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  LIVE_TALK_CONNECT_GRACE_MS,
  LIVE_TALK_MAX_LIVE_MS,
  LIVE_TALK_LISTENER_CAP,
  LIVE_TALK_SPEAKER_CAP,
  canChangeHostLevel,
  canCreateLiveTalkRoom,
  canModerateInRoom,
  countsAsSpeaker,
  hostLevelOf,
  canSpeakAtLevel,
  canSubmitLiveTalkLeaveRating,
  decideJoin,
  decidePromote,
  isStaleLiveTalkRoom,
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
  it('lets listeners in when a seat is free', () => {
    const d = decideJoin({
      requested: 'listener',
      roomStatus: 'live',
      speakerCount: LIVE_TALK_SPEAKER_CAP,
      listenerCount: 0,
      band: 'Seed',
      minSpeakLevel: 'a1',
      isHost: false,
    });
    assert.deepEqual(d, { ok: true, role: 'listener' });
  });

  it('rejects listeners when full', () => {
    const d = decideJoin({
      requested: 'listener',
      roomStatus: 'live',
      speakerCount: 1,
      listenerCount: LIVE_TALK_LISTENER_CAP,
      band: 'Seed',
      minSpeakLevel: 'a1',
      isHost: false,
    });
    assert.deepEqual(d, { ok: false, reason: 'listener_full' });
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

  it('stays Host+ / Official in production', () => {
    const prod = {
      LIVE_TALK_OPEN_CREATE: 'false',
      RAILWAY_ENVIRONMENT: 'production',
    };
    assert.equal(liveTalkCreateOpen(prod), false);
    assert.equal(canCreateLiveTalkRoom({ hostLevel: 'none' }, prod), false);
    assert.equal(canCreateLiveTalkRoom({ hostLevel: 'trainee' }, prod), false);
    assert.equal(canCreateLiveTalkRoom({ hostLevel: 'host' }, prod), true);
    assert.equal(canCreateLiveTalkRoom({ hostLevel: 'official' }, prod), true);
  });
});

describe('isStaleLiveTalkRoom', () => {
  const now = new Date('2026-11-02T08:00:00.000Z');
  const room = {
    id: 'r1',
    livekitRoomName: 'lt_abc',
    createdAt: new Date('2026-11-02T07:50:00.000Z'),
    activeCount: 1,
  };

  it('ends rooms with nobody still joined', () => {
    assert.equal(
      isStaleLiveTalkRoom({ ...room, activeCount: 0 }, now, null),
      true,
    );
  });

  it('keeps a fresh empty LiveKit miss inside the grace window', () => {
    const occupancy = new Map<string, number>();
    assert.equal(
      isStaleLiveTalkRoom(
        {
          ...room,
          createdAt: new Date(now.getTime() - 30_000),
        },
        now,
        occupancy,
      ),
      false,
    );
  });

  it('ends a ghost room after grace when LiveKit is empty', () => {
    const occupancy = new Map<string, number>();
    assert.equal(
      isStaleLiveTalkRoom(
        {
          ...room,
          createdAt: new Date(now.getTime() - LIVE_TALK_CONNECT_GRACE_MS),
        },
        now,
        occupancy,
      ),
      true,
    );
  });

  it('keeps rooms that still have LiveKit participants', () => {
    const occupancy = new Map([['lt_abc', 2]]);
    assert.equal(
      isStaleLiveTalkRoom(
        {
          ...room,
          createdAt: new Date(now.getTime() - LIVE_TALK_MAX_LIVE_MS * 2),
        },
        now,
        occupancy,
      ),
      false,
    );
  });

  it('ends rooms past max age when occupancy is unknown', () => {
    assert.equal(
      isStaleLiveTalkRoom(
        {
          ...room,
          createdAt: new Date(now.getTime() - LIVE_TALK_MAX_LIVE_MS),
        },
        now,
        null,
      ),
      true,
    );
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

describe('host levels', () => {
  it('reads unknown or missing levels as none', () => {
    assert.equal(hostLevelOf({}), 'none');
    assert.equal(hostLevelOf({ hostLevel: 'boss' }), 'none');
    assert.equal(hostLevelOf({ hostLevel: 'trainee' }), 'trainee');
  });

  it('lets Host and Official open rooms, not Trainee', () => {
    const prod = { RAILWAY_ENVIRONMENT: 'production' };
    assert.equal(canCreateLiveTalkRoom({ hostLevel: 'trainee' }, prod), false);
    assert.equal(canCreateLiveTalkRoom({ hostLevel: 'host' }, prod), true);
    assert.equal(canCreateLiveTalkRoom({ hostLevel: 'official' }, prod), true);
  });

  it('counts co-hosts as speakers and lets them moderate', () => {
    assert.equal(countsAsSpeaker('cohost'), true);
    assert.equal(canModerateInRoom('cohost'), true);
    assert.equal(canModerateInRoom('speaker'), false);
  });

  it('only Official Hosts change levels, and never to or from Official', () => {
    const official = { hostLevel: 'official' };
    assert.equal(
      canChangeHostLevel({ actor: official, from: 'none', to: 'trainee' }),
      true,
    );
    assert.equal(
      canChangeHostLevel({ actor: official, from: 'host', to: 'official' }),
      false,
    );
    assert.equal(
      canChangeHostLevel({ actor: { hostLevel: 'host' }, from: 'none', to: 'trainee' }),
      false,
    );
    assert.equal(
      canChangeHostLevel({
        actor: { hostLevel: 'none' },
        from: 'trainee',
        to: 'host',
      }),
      false,
    );
  });
});
