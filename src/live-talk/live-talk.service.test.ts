import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ForbiddenException } from '@nestjs/common';
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
