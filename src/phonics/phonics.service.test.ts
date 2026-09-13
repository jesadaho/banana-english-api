import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ForbiddenException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import {
  isPhonicsNodeId,
  MemoryPhonicsProgressStore,
  PhonicsService,
} from './phonics.service';

function allKeys(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(allKeys);
  if (value == null || typeof value !== 'object') return [];
  return Object.entries(value as Record<string, unknown>).flatMap(
    ([key, child]) => [key, ...allKeys(child)],
  );
}

function createService() {
  const store = new MemoryPhonicsProgressStore();
  const service = new PhonicsService({} as PrismaService, store);
  return { service, store };
}

describe('PhonicsService', () => {
  it('serves exactly the 18 approved new nodes as chapters 6–8', async () => {
    const { service } = createService();
    const course = await service.getLegacyCourse();
    assert.equal(course.chapterCount, 3);
    assert.equal(course.nodeCount, 18);
    assert.deepEqual(
      course.chapters.map((chapter) => chapter.chapter),
      [6, 7, 8],
    );
    assert.deepEqual(
      course.chapters.map((chapter) => chapter.nodes.length),
      [6, 8, 4],
    );
    assert.equal(
      new Set(course.chapters.flatMap((chapter) => chapter.nodes.map((node) => node.id))).size,
      18,
    );
  });

  it('allows rewards only for catalogued Phonics node IDs', () => {
    assert.equal(isPhonicsNodeId('phon_code_1'), true);
    assert.equal(isPhonicsNodeId('phon_final_1'), true);
    assert.equal(isPhonicsNodeId('phon_not_real'), false);
  });

  it('strips every answer key and authoring transcript from learner payloads', async () => {
    const { service } = createService();
    for (const chapter of (await service.getLegacyCourse()).chapters) {
      for (const summary of chapter.nodes) {
        const payload = service.getNode(summary.id);
        const keys = allKeys(payload);
        assert.ok(!keys.some((key) => key.startsWith('authoring')), summary.id);
        assert.ok(!keys.some((key) => key.startsWith('correct')), summary.id);
        assert.ok(!keys.includes('spokenText'), summary.id);
        assert.ok(!keys.includes('transcript'), summary.id);
      }
    }
  });

  it('keeps unseen audio choices opaque and spelling-free', () => {
    const { service } = createService();
    const payload = service.getNode('phon_check_2');
    const activity = payload.activity as {
      items: Array<{
        promptWord: string;
        optionPresentation: string;
        clientOptions: Array<Record<string, unknown>>;
      }>;
    };
    for (const item of activity.items) {
      assert.equal(item.optionPresentation, 'audio_only');
      for (const option of item.clientOptions) {
        assert.deepEqual(Object.keys(option).sort(), ['audioAssetId', 'choiceId']);
        assert.ok(!JSON.stringify(option).toLowerCase().includes(item.promptWord));
      }
    }
  });

  it('scores deterministic answers and never scores speaking', async () => {
    const { service } = createService();
    const result = await service.checkNode('user-1', {
      nodeId: 'phon_blend_1',
      answers: [
        { itemIndex: 0, answer: ['m', 'a', 'p'] },
        { itemIndex: 1, answer: ['s', 'i', 't'] },
      ],
    });
    assert.equal(result.completeSubmission, true);
    assert.equal(result.passed, true);
    assert.equal(result.speakingScored, false);
    assert.equal(result.attemptNumber, 1);
    assert.ok(result.results.every((item) => !('revealedAnswer' in item)));
  });

  it('ignores a client-spoofed attemptNumber and reveals only after a real retry', async () => {
    const { service } = createService();
    const spoofed = await service.checkNode('user-1', {
      nodeId: 'phon_code_1',
      attemptNumber: 2,
      answers: [{ itemIndex: 0, answer: 'x' }],
    });
    const second = await service.checkNode('user-1', {
      nodeId: 'phon_code_1',
      attemptNumber: 2,
      answers: [{ itemIndex: 0, answer: 'x' }],
    });
    assert.equal(spoofed.attemptNumber, 1);
    assert.ok(!('revealedAnswer' in spoofed.results[0]));
    assert.equal(second.attemptNumber, 2);
    assert.equal(second.results[0].revealedAnswer, 'm');
  });

  it('does not pass a partial submission', async () => {
    const { service } = createService();
    const result = await service.checkNode('user-1', {
      nodeId: 'phon_code_1',
      answers: [{ itemIndex: 0, answer: 'm' }],
    });
    assert.equal(result.completeSubmission, false);
    assert.equal(result.passed, false);
    await assert.rejects(
      () => service.assertPassed('user-1', 'phon_code_1'),
      ForbiddenException,
    );
  });

  it('marks a node passed only after a complete qualifying check', async () => {
    const { service } = createService();
    await service.checkNode('user-1', {
      nodeId: 'phon_blend_1',
      answers: [
        { itemIndex: 0, answer: ['m', 'a', 'p'] },
        { itemIndex: 1, answer: ['s', 'i', 't'] },
      ],
    });
    assert.equal(await service.hasPassed('user-1', 'phon_blend_1'), true);
    assert.equal(await service.hasPassed('user-2', 'phon_blend_1'), false);
    await service.assertPassed('user-1', 'phon_blend_1');
    const course = await service.getLegacyCourse('user-1');
    const blend = course.chapters
      .flatMap((chapter) => chapter.nodes)
      .find((node) => node.id === 'phon_blend_1');
    assert.equal(blend?.passed, true);
  });
});
