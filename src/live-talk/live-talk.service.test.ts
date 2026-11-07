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
    communityAdmin: true,
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
  it('rejects users who are not community admin', async () => {
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
            },
            { title: 'Coffee chat' },
          ),
        (err: unknown) =>
          err instanceof ForbiddenException &&
          String((err as ForbiddenException).message).includes('Community admin'),
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

  it('creates a live room when the user is community admin', async () => {
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

describe('LiveTalkService.joinRoom', () => {
  it('blocks Seed speakers in A1 rooms', async () => {
    const prisma = {
      liveTalkRoom: {
        findUnique: async () => roomRow(),
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

describe('LiveTalkService.leaveByLivekitIdentity', () => {
  it('ends the room when the host disconnects', async () => {
    const updates: Array<Record<string, unknown>> = [];
    const participantUpdates: Array<Record<string, unknown>> = [];
    const prisma = {
      liveTalkRoom: {
        findUnique: async () => ({
          id: 'room-1',
          hostUserId: 'host-1',
          livekitRoomName: 'lt_abc',
          status: 'live',
        }),
        updateMany: async (args: { data: Record<string, unknown> }) => {
          updates.push(args.data);
          return { count: 1 };
        },
      },
      liveTalkParticipant: {
        updateMany: async (args: { data: Record<string, unknown> }) => {
          participantUpdates.push(args.data);
          return { count: 1 };
        },
      },
    };
    const service = new LiveTalkService(prisma as unknown as PrismaService);
    const result = await service.leaveByLivekitIdentity('lt_abc', 'host-1');
    assert.equal(result.ended, true);
    assert.equal(updates[0]?.status, 'ended');
    assert.ok(participantUpdates[0]?.leftAt instanceof Date);
  });

  it('ignores non-host disconnects so role changes do not end the room', async () => {
    const prisma = {
      liveTalkRoom: {
        findUnique: async () => ({
          id: 'room-1',
          hostUserId: 'host-1',
          livekitRoomName: 'lt_abc',
          status: 'live',
        }),
        updateMany: async () => {
          throw new Error('should not end room');
        },
      },
      liveTalkParticipant: {
        updateMany: async () => {
          throw new Error('should not mark leave');
        },
      },
    };
    const service = new LiveTalkService(prisma as unknown as PrismaService);
    const result = await service.leaveByLivekitIdentity('lt_abc', 'guest-1');
    assert.equal(result.ignored, true);
    assert.equal(result.left, false);
  });
});
