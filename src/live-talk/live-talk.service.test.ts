import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import { LiveTalkService } from './live-talk.service';

function adminUser() {
  return {
    id: 'host-1',
    displayName: 'May',
    avatarId: null,
    communityAdmin: false,
    hostLevel: 'official',
    placementResult: { publicResult: 'A1', questionVersion: 'placement-q-v3' },
  };
}

function roomRow(overrides: Record<string, unknown> = {}) {
  const host = {
    id: 'host-1',
    displayName: 'May',
    avatarId: null,
  };
  return {
    id: 'room-1',
    title: 'Coffee chat',
    description: '',
    minSpeakLevel: 'a1',
    hostUserId: 'host-1',
    livekitRoomName: 'lt_abc',
    status: 'live',
    createdAt: new Date('2026-11-01T00:00:00.000Z'),
    host,
    participants: [
      {
        id: 'p-host',
        userId: 'host-1',
        role: 'host',
        user: host,
      },
    ],
    ...overrides,
  };
}

describe('LiveTalkService.createRoom', () => {
  it('rejects users who are not Host or Official', async () => {
    const prev = process.env.LIVE_TALK_OPEN_CREATE;
    process.env.LIVE_TALK_OPEN_CREATE = 'false';
    const service = new LiveTalkService({} as PrismaService);
    try {
      await assert.rejects(
        () =>
          service.createRoom(
            {
              id: 'u1',
              displayName: 'May',
              avatarId: null,
              communityAdmin: false,
              hostLevel: 'none',
            },
            { title: 'Coffee chat' },
          ),
        (err: unknown) =>
          err instanceof ForbiddenException &&
          String((err as ForbiddenException).message).includes('host_only'),
      );
    } finally {
      if (prev === undefined) delete process.env.LIVE_TALK_OPEN_CREATE;
      else process.env.LIVE_TALK_OPEN_CREATE = prev;
    }
  });

  it('lets anyone create when LIVE_TALK_OPEN_CREATE is on', async () => {
    const prev = process.env.LIVE_TALK_OPEN_CREATE;
    process.env.LIVE_TALK_OPEN_CREATE = 'true';
    const created = roomRow();
    const prisma = {
      liveTalkRoom: {
        create: async () => created,
      },
    };
    const service = new LiveTalkService(prisma as unknown as PrismaService);
    try {
      const result = await service.createRoom(
        {
          id: 'u1',
          displayName: 'May',
          avatarId: null,
          communityAdmin: false,
        },
        { title: 'Coffee chat' },
      );
      assert.equal(result.role, 'host');
    } finally {
      if (prev === undefined) delete process.env.LIVE_TALK_OPEN_CREATE;
      else process.env.LIVE_TALK_OPEN_CREATE = prev;
    }
  });

  it('creates a live room when the user is an Official Host', async () => {
    const created = roomRow();
    const prisma = {
      liveTalkRoom: {
        create: async () => created,
      },
    };
    const service = new LiveTalkService(prisma as unknown as PrismaService);
    const result = await service.createRoom(adminUser(), {
      title: 'Coffee chat',
      minSpeakLevel: 'a1',
    });
    assert.equal(result.role, 'host');
    assert.equal(result.room.title, 'Coffee chat');
    assert.equal(result.room.speakerCount, 1);
    assert.equal(result.livekitUrl, '');
    assert.equal(result.token, '');
  });
});

describe('LiveTalkService.sweepStaleRooms', () => {
  it('ends live rooms with no active participants', async () => {
    const ended: string[][] = [];
    const prisma = {
      liveTalkRoom: {
        findMany: async () => [
          {
            id: 'ghost',
            livekitRoomName: 'lt_ghost',
            createdAt: new Date(),
            participants: [],
          },
        ],
        updateMany: async (args: { where: { id: { in: string[] } } }) => {
          ended.push(args.where.id.in);
          return { count: args.where.id.in.length };
        },
      },
      liveTalkParticipant: {
        updateMany: async () => ({ count: 0 }),
      },
    };
    const service = new LiveTalkService(prisma as unknown as PrismaService);
    const count = await service.sweepStaleRooms(new Date(), null);
    assert.equal(count, 1);
    assert.deepEqual(ended, [['ghost']]);
  });

  it('leaves a live room alone when LiveKit still has people', async () => {
    const prisma = {
      liveTalkRoom: {
        findMany: async () => [
          {
            id: 'live',
            livekitRoomName: 'lt_live',
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
            participants: [{ id: 'p1' }],
          },
        ],
        updateMany: async () => {
          throw new Error('should not end');
        },
      },
    };
    const service = new LiveTalkService(prisma as unknown as PrismaService);
    const count = await service.sweepStaleRooms(
      new Date(),
      new Map([['lt_live', 1]]),
    );
    assert.equal(count, 0);
  });
});

describe('LiveTalkService.joinRoom', () => {
  it('blocks Seed speakers in A1 rooms', async () => {
    const prisma = {
      liveTalkRoom: {
        findUnique: async () => roomRow(),
      },
      liveTalkParticipant: {
        findFirst: async () => null,
      },
    };
    const service = new LiveTalkService(prisma as unknown as PrismaService);
    await assert.rejects(
      () =>
        service.joinRoom(
          {
            id: 'u2',
            displayName: 'Bee',
            avatarId: null,
            communityAdmin: false,
            placementResult: {
              publicResult: 'Seed',
              questionVersion: 'placement-q-v3',
            },
          },
          'room-1',
          'speaker',
        ),
      (err: unknown) =>
        err instanceof ForbiddenException &&
        (err as ForbiddenException).message === 'level_too_low',
    );
  });

  it('blocks a 11th speaker', async () => {
    const speakers = Array.from({ length: 10 }, (_, i) => ({
      id: `p-${i}`,
      userId: `u-${i}`,
      role: i === 0 ? 'host' : 'speaker',
      user: { id: `u-${i}`, displayName: `P${i}`, avatarId: null },
    }));
    const prisma = {
      liveTalkRoom: {
        findUnique: async () =>
          roomRow({
            participants: speakers,
          }),
      },
      liveTalkParticipant: {
        findFirst: async () => null,
      },
    };
    const service = new LiveTalkService(prisma as unknown as PrismaService);
    await assert.rejects(
      () =>
        service.joinRoom(
          {
            id: 'u-new',
            displayName: 'New',
            avatarId: null,
            communityAdmin: false,
            placementResult: {
              publicResult: 'A1',
              questionVersion: 'placement-q-v3',
            },
          },
          'room-1',
          'speaker',
        ),
      (err: unknown) =>
        err instanceof ForbiddenException &&
        (err as ForbiddenException).message === 'speaker_full',
    );
  });

  it('blocks a 9th listener', async () => {
    const listeners = Array.from({ length: 8 }, (_, i) => ({
      id: `l-${i}`,
      userId: `l-${i}`,
      role: 'listener',
      user: { id: `l-${i}`, displayName: `L${i}`, avatarId: null },
    }));
    const prisma = {
      liveTalkRoom: {
        findUnique: async () =>
          roomRow({
            participants: [...roomRow().participants, ...listeners],
          }),
      },
      liveTalkParticipant: {
        findFirst: async () => null,
      },
    };
    const service = new LiveTalkService(prisma as unknown as PrismaService);
    await assert.rejects(
      () =>
        service.joinRoom(
          {
            id: 'u-new',
            displayName: 'New',
            avatarId: null,
            communityAdmin: false,
          },
          'room-1',
          'listener',
        ),
      (err: unknown) =>
        err instanceof ForbiddenException &&
        (err as ForbiddenException).message === 'listener_full',
    );
  });
});

describe('LiveTalkService.submitRating', () => {
  function ratingPrisma(overrides: Record<string, unknown> = {}) {
    const created: Record<string, unknown>[] = [];
    return {
      created,
      prisma: {
        liveTalkRoom: {
          findUnique: async () => ({ id: 'room-1' }),
        },
        liveTalkRating: {
          findUnique: async () => null,
          findFirst: async () => null,
          create: async (args: { data: Record<string, unknown> }) => {
            created.push(args.data);
            return { id: 'rate-1', ...args.data };
          },
        },
        liveTalkParticipant: {
          findMany: async () => [
            { joinedAt: new Date(Date.now() - 4 * 60 * 1000) },
          ],
        },
        user: {
          findUnique: async () => ({ timezone: 'Asia/Bangkok' }),
        },
        ...overrides,
      },
    };
  }

  it('stores a downvote with feedback', async () => {
    const { created, prisma } = ratingPrisma();
    const service = new LiveTalkService(prisma as unknown as PrismaService);
    const result = await service.submitRating(
      {
        id: 'u2',
        displayName: 'Bee',
        avatarId: null,
        communityAdmin: false,
      },
      'room-1',
      { rating: 'down', feedback: 'too quiet' },
    );
    assert.equal(result.ok, true);
    assert.equal(created[0]?.rating, 'down');
    assert.equal(created[0]?.feedback, 'too quiet');
  });

  it('rejects a second rating the same day', async () => {
    const { prisma } = ratingPrisma({
      liveTalkRating: {
        findUnique: async () => null,
        findFirst: async () => ({
          createdAt: new Date(),
        }),
        create: async () => {
          throw new Error('should not create');
        },
      },
    });
    const service = new LiveTalkService(prisma as unknown as PrismaService);
    await assert.rejects(
      () =>
        service.submitRating(
          {
            id: 'u2',
            displayName: 'Bee',
            avatarId: null,
            communityAdmin: false,
          },
          'room-1',
          { rating: 'up' },
        ),
      (err: unknown) =>
        err instanceof BadRequestException &&
        String((err as BadRequestException).message).includes(
          'already_rated_today',
        ),
    );
  });
});

const bee = {
  id: 'p-bee',
  userId: 'u2',
  role: 'speaker',
  mutedByHost: false,
  user: { id: 'u2', displayName: 'Bee', avatarId: null },
};

function guestUser() {
  return {
    id: 'u2',
    displayName: 'Bee',
    avatarId: null,
    communityAdmin: false,
    placementResult: { publicResult: 'A1', questionVersion: 'placement-q-v3' },
  };
}

function roomWithBee() {
  const base = roomRow();
  return roomRow({
    participants: [...base.participants, bee],
  });
}

describe('LiveTalkService.kickParticipant', () => {
  it('rejects non-hosts', async () => {
    const service = new LiveTalkService({
      liveTalkRoom: { findUnique: async () => roomWithBee() },
    } as unknown as PrismaService);
    await assert.rejects(
      () => service.kickParticipant(guestUser(), 'room-1', 'host-1'),
      (err: unknown) =>
        err instanceof ForbiddenException &&
        (err as ForbiddenException).message === 'host_only',
    );
  });

  it('rejects kicking yourself', async () => {
    const service = new LiveTalkService({
      liveTalkRoom: { findUnique: async () => roomWithBee() },
    } as unknown as PrismaService);
    await assert.rejects(
      () => service.kickParticipant(adminUser(), 'room-1', 'host-1'),
      (err: unknown) =>
        err instanceof ForbiddenException &&
        (err as ForbiddenException).message === 'cannot_moderate_self',
    );
  });

  it('marks the speaker kicked and drops them from the room', async () => {
    const participants = [...roomRow().participants, { ...bee }];
    const updates: unknown[] = [];
    const prisma = {
      liveTalkRoom: {
        findUnique: async () => roomRow({ participants }),
      },
      liveTalkParticipant: {
        updateMany: async (args: { data: Record<string, unknown> }) => {
          updates.push(args.data);
          const idx = participants.findIndex((p) => p.userId === 'u2');
          if (idx >= 0) participants.splice(idx, 1);
          return { count: 1 };
        },
      },
    };
    const service = new LiveTalkService(prisma as unknown as PrismaService);
    const result = await service.kickParticipant(adminUser(), 'room-1', 'u2');
    assert.equal(result.ok, true);
    assert.equal(updates.length, 1);
    assert.ok((updates[0] as { kickedAt?: Date }).kickedAt instanceof Date);
    assert.equal(result.room.speakerCount, 1);
  });

  it('blocks a kicked user from rejoining', async () => {
    const service = new LiveTalkService({
      liveTalkRoom: { findUnique: async () => roomRow() },
      liveTalkParticipant: {
        findFirst: async () => ({ kickedAt: new Date(), mutedByHost: false }),
      },
    } as unknown as PrismaService);
    await assert.rejects(
      () => service.joinRoom(guestUser(), 'room-1', 'listener'),
      (err: unknown) =>
        err instanceof ForbiddenException &&
        (err as ForbiddenException).message === 'kicked',
    );
  });
});

describe('LiveTalkService.muteParticipant', () => {
  it('rejects non-hosts', async () => {
    const service = new LiveTalkService({
      liveTalkRoom: { findUnique: async () => roomWithBee() },
    } as unknown as PrismaService);
    await assert.rejects(
      () => service.muteParticipant(guestUser(), 'room-1', 'host-1', true),
      (err: unknown) =>
        err instanceof ForbiddenException &&
        (err as ForbiddenException).message === 'host_only',
    );
  });

  it('sets mutedByHost on the speaker', async () => {
    const participants = [...roomRow().participants, { ...bee }];
    const prisma = {
      liveTalkRoom: {
        findUnique: async () => roomRow({ participants }),
      },
      liveTalkParticipant: {
        updateMany: async (args: { data: { mutedByHost?: boolean } }) => {
          const target = participants.find((p) => p.userId === 'u2');
          if (target && args.data.mutedByHost !== undefined) {
            target.mutedByHost = args.data.mutedByHost;
          }
          return { count: 1 };
        },
      },
    };
    const service = new LiveTalkService(prisma as unknown as PrismaService);
    const result = await service.muteParticipant(
      adminUser(),
      'room-1',
      'u2',
      true,
    );
    assert.equal(result.ok, true);
    assert.equal(
      result.room.speakers.find((p) => p.userId === 'u2')?.mutedByHost,
      true,
    );
  });
});

