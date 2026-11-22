import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ClipsService } from './clips.service';
import { POPULAR_COMPLETES_WINDOW_MS } from './popular-clips';
import type { GeminiChatService } from '../gemini/gemini-chat.service';
import type { PrismaService } from '../prisma/prisma.service';

describe('ClipsService Popular Now (7-day completes)', () => {
  it('queries finished plays in the last 7 days, not opens or older completes', async () => {
    let sessionWhere: Record<string, unknown> | undefined;
    const prisma = {
      clip: {
        findMany: async () => [
          {
            id: 'hot',
            title: 'Hot Clip',
            titleTh: '',
            level: 'A1',
            category: 'listening',
            source: 'youtube',
            youtubeId: 'aaaaaaaaaaa',
            videoUrl: '',
            sourceUrl: '',
            credit: '',
            durationSec: 60,
            thumbnailUrl: '',
            sortOrder: 0,
            status: 'published',
            createdAt: new Date(),
            _count: { sentences: 1 },
          },
          {
            id: 'cold',
            title: 'Cold Clip',
            titleTh: '',
            level: 'A1',
            category: 'listening',
            source: 'youtube',
            youtubeId: 'bbbbbbbbbbb',
            videoUrl: '',
            sourceUrl: '',
            credit: '',
            durationSec: 60,
            thumbnailUrl: '',
            sortOrder: 1,
            status: 'published',
            createdAt: new Date(),
            _count: { sentences: 1 },
          },
        ],
      },
      clipProgress: {
        findMany: async () => [],
        groupBy: async () => [],
      },
      clipSession: {
        groupBy: async (args: { where: Record<string, unknown> }) => {
          sessionWhere = args.where;
          return [{ clipId: 'hot', _count: { _all: 7 } }];
        },
      },
      user: {
        findUnique: async () => ({
          id: 'u1',
          placementResult: null,
        }),
      },
    };

    const service = new ClipsService(
      prisma as unknown as PrismaService,
      {} as GeminiChatService,
    );
    const before = Date.now();
    const home = await service.listForUser('u1');
    const after = Date.now();

    assert.ok(sessionWhere);
    const completedAt = sessionWhere!.completedAt as { gte: Date };
    assert.ok(completedAt?.gte instanceof Date);
    const age = after - completedAt.gte.getTime();
    assert.ok(
      age >= POPULAR_COMPLETES_WINDOW_MS - 5_000 &&
        age <= POPULAR_COMPLETES_WINDOW_MS + (after - before) + 5_000,
      `expected ~7d window, got ${age}ms`,
    );
    assert.equal('createdAt' in sessionWhere!, false);

    assert.equal(home.popular[0]?.id, 'hot');
  });
});
