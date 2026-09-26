import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { LearnPathService } from './learn-path.service';
import {
  dealSkipQuizPhrases,
  isSkipQuizPassed,
  resolveChaptersToSkipOnPass,
  resolveSkipQuizPool,
  SKIP_QUIZ_MIN_DEAL,
  skipQuizDealCount,
  skipQuizEligibilityPayload,
} from './foundation-v7-skip-quiz';

describe('Foundation V7 skip quiz helpers', () => {
  it('marks chapter 1 ineligible (no previous)', () => {
    const resolved = resolveSkipQuizPool('v7_u01');
    assert.equal(resolved.eligible, false);
    assert.equal(resolved.reason, 'no_previous');
  });

  it('marks chapters with enough previous say_it as eligible', () => {
    const resolved = resolveSkipQuizPool('v7_u02');
    assert.equal(resolved.eligible, true);
    assert.ok(resolved.availableCount >= SKIP_QUIZ_MIN_DEAL);
    assert.equal(resolved.previousChapterId, 'v7_u01');
  });

  it('deals between 5 and 10 phrases when eligible', () => {
    const items = dealSkipQuizPhrases('v7_u03');
    assert.ok(items.length >= 5);
    assert.ok(items.length <= 10);
    assert.ok(items.every((p) => p.answerEn && p.promptTh));
    assert.ok(
      items.every((p) => !p.mode && !p.hintEn && !p.choices?.length),
      'skip quiz must not include guided hints',
    );
  });

  it('exposes the exact deal size on eligibility', () => {
    const payload = skipQuizEligibilityPayload('v7_u03');
    assert.equal(payload.eligible, true);
    assert.equal(payload.questionCount, dealSkipQuizPhrases('v7_u03').length);
    assert.equal(payload.questionCount, skipQuizDealCount(payload.availableCount));
  });

  it('lists every chapter before the target when resolving skip-on-pass', () => {
    const chapters = resolveChaptersToSkipOnPass('v7_u05');
    assert.deepEqual(
      chapters.map((ch) => ch.chapterId),
      ['v7_u01', 'v7_u02', 'v7_u03', 'v7_u04'],
    );
    assert.ok(chapters.every((ch) => ch.playableNodeIds.length > 0));
  });

  it('uses strict > 0.75 pass threshold', () => {
    assert.equal(isSkipQuizPassed(3, 4), false);
    assert.equal(isSkipQuizPassed(4, 5), true);
    assert.equal(isSkipQuizPassed(6, 8), false);
    assert.equal(isSkipQuizPassed(7, 8), true);
  });
});

describe('Foundation V7 skip quiz service', () => {
  function buildService(opts: {
    bananaBalance?: number;
    attempts?: Map<string, any>;
    skips?: Map<string, any>;
    spendCalls?: Array<{ amount: number; referenceId: string; source: string }>;
    refundCalls?: Array<{ amount: number; referenceId: string; source: string }>;
  } = {}) {
    const attempts = opts.attempts ?? new Map<string, any>();
    const skips = opts.skips ?? new Map<string, any>();
    const spendCalls = opts.spendCalls ?? [];
    const refundCalls = opts.refundCalls ?? [];
    let balance = opts.bananaBalance ?? 10;

    const prisma = {
      foundationSkipQuizAttempt: {
        findUnique: async ({ where }: any) => {
          const key = where.userId_idempotencyKey;
          if (!key) return null;
          return attempts.get(`${key.userId}:${key.idempotencyKey}`) ?? null;
        },
        findUniqueOrThrow: async ({ where }: any) => {
          const key = where.userId_idempotencyKey;
          const row = attempts.get(`${key.userId}:${key.idempotencyKey}`);
          if (!row) throw new Error('missing attempt');
          return row;
        },
        findFirst: async ({ where }: any) => {
          for (const row of attempts.values()) {
            if (row.id === where.id && row.userId === where.userId) return row;
          }
          return null;
        },
        create: async ({ data }: any) => {
          const key = `${data.userId}:${data.idempotencyKey}`;
          if (attempts.has(key)) {
            throw new Prisma.PrismaClientKnownRequestError('Unique constraint', {
              code: 'P2002',
              clientVersion: 'test',
            });
          }
          const row = { ...data, id: data.id ?? `attempt_${attempts.size + 1}` };
          attempts.set(key, row);
          attempts.set(`id:${row.id}`, row);
          return row;
        },
        update: async ({ where, data }: any) => {
          for (const [key, row] of attempts.entries()) {
            if (row.id === where.id) {
              const next = { ...row, ...data };
              attempts.set(key, next);
              return next;
            }
          }
          throw new Error('attempt not found');
        },
      },
      foundationChapterSkip: {
        findMany: async () => [...skips.values()],
        findUnique: async ({ where }: any) => {
          const key = where.userId_pathId_chapterId;
          return skips.get(`${key.userId}:${key.pathId}:${key.chapterId}`) ?? null;
        },
        upsert: async ({ where, create, update }: any) => {
          const key = where.userId_pathId_chapterId;
          const id = `${key.userId}:${key.pathId}:${key.chapterId}`;
          const existing = skips.get(id);
          const row = existing ? { ...existing, ...update } : { ...create, id: `skip_${skips.size + 1}` };
          skips.set(id, row);
          return row;
        },
      },
      economyTransaction: { findMany: async () => [] },
      userSession: { findMany: async () => [] },
    };

    const economy = {
      spendBananas: async (
        _userId: string,
        amount: number,
        referenceId: string,
        source: string,
      ) => {
        if (balance < amount) throw new BadRequestException('Insufficient banana balance');
        balance -= amount;
        spendCalls.push({ amount, referenceId, source });
        return { bananaBalance: balance };
      },
      refundBananas: async (
        _userId: string,
        amount: number,
        referenceId: string,
        source: string,
      ) => {
        balance += amount;
        refundCalls.push({ amount, referenceId, source });
        return { bananaBalance: balance };
      },
      recordMiniGameScore: async () => {},
    };

    const service = new LearnPathService(
      prisma as any,
      { getCompletedLessonIds: async () => new Set() } as any,
      economy as any,
    );

    return { service, attempts, skips, spendCalls, refundCalls, getBalance: () => balance };
  }

  it('returns eligibility false for chapter 1 and true for chapter 2', () => {
    const { service } = buildService();
    assert.equal(service.getSkipQuizEligibility('v7_u01').eligible, false);
    assert.equal(service.getSkipQuizEligibility('v7_u02').eligible, true);
  });

  it('start charges once and returns items; retry with same key does not charge again', async () => {
    const { service, spendCalls, getBalance } = buildService({ bananaBalance: 5 });
    const first = await service.startSkipQuiz('user-1', 'v7_u02', 'key-a', 'Nana');
    assert.ok(first.attemptId);
    assert.ok(Array.isArray(first.items));
    assert.ok(first.totalCount >= 5 && first.totalCount <= 10);
    assert.equal(first.bananaCost, 1);
    assert.equal(spendCalls.length, 1);
    assert.equal(getBalance(), 4);

    const second = await service.startSkipQuiz('user-1', 'v7_u02', 'key-a', 'Nana');
    assert.equal(second.attemptId, first.attemptId);
    assert.deepEqual(second.items, first.items);
    assert.equal(spendCalls.length, 1);
    assert.equal(getBalance(), 4);
  });

  it('start on chapter 1 returns 400 without charging', async () => {
    const { service, spendCalls } = buildService({ bananaBalance: 5 });
    await assert.rejects(
      () => service.startSkipQuiz('user-1', 'v7_u01', 'key-b'),
      (err: unknown) => err instanceof BadRequestException,
    );
    assert.equal(spendCalls.length, 0);
  });

  it('complete pass upserts skip and unlocks next chapter on path GET', async () => {
    const { service, spendCalls } = buildService({ bananaBalance: 5 });
    const started = await service.startSkipQuiz('user-1', 'v7_u02', 'key-pass');
    assert.equal(spendCalls.length, 1);

    const result = await service.completeSkipQuiz(
      'user-1',
      'v7_u02',
      started.attemptId,
      started.totalCount,
    );
    assert.equal(result.passed, true);
    assert.equal(result.skippedChapterId, 'v7_u01');
    assert.deepEqual(result.skippedChapterIds, ['v7_u01']);
    assert.ok(result.skippedNodeIds.length > 0);

    const path = await service.getFoundationV7('user-1', ['say_it_guided']);
    assert.ok(path.progress.skippedNodeIds.length > 0);
    assert.equal(path.progress.currentNodeId, 'v7_u02n01');
    assert.ok(path.chapters.find((ch: any) => ch.id === 'v7_u02')?.skipQuizEligible === true);
  });

  it('complete pass into a later chapter skips every chapter before the target', async () => {
    const { service, skips } = buildService({ bananaBalance: 5 });
    const started = await service.startSkipQuiz('user-1', 'v7_u05', 'key-jump');
    const result = await service.completeSkipQuiz(
      'user-1',
      'v7_u05',
      started.attemptId,
      started.totalCount,
    );
    assert.equal(result.passed, true);
    assert.deepEqual(result.skippedChapterIds, [
      'v7_u01',
      'v7_u02',
      'v7_u03',
      'v7_u04',
    ]);
    assert.equal(skips.size, 4);

    const path = await service.getFoundationV7('user-1', ['say_it_guided']);
    assert.equal(path.progress.currentNodeId?.startsWith('v7_u05'), true);
    for (const chapterId of result.skippedChapterIds) {
      const chapter = path.chapters.find((ch: any) => ch.id === chapterId);
      assert.ok(chapter, chapterId);
      const playable = chapter.items.filter((n: any) => !n.comingSoon);
      assert.ok(playable.length > 0, chapterId);
      assert.ok(
        playable.every((n: any) => path.progress.skippedNodeIds.includes(n.id)),
        chapterId,
      );
    }
  });

  it('complete below threshold does not skip chapter', async () => {
    const { service } = buildService({ bananaBalance: 5 });
    const started = await service.startSkipQuiz('user-1', 'v7_u02', 'key-fail');
    const failCount = Math.floor(started.totalCount * 0.75);
    const result = await service.completeSkipQuiz(
      'user-1',
      'v7_u02',
      started.attemptId,
      failCount,
    );
    assert.equal(result.passed, false);
    assert.equal(result.skippedChapterId, null);
    assert.deepEqual(result.skippedNodeIds, []);

    const path = await service.getFoundationV7('user-1');
    assert.deepEqual(path.progress.skippedNodeIds, []);
    assert.equal(path.progress.currentNodeId, 'v7_u01n01');
  });
});
