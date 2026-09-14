import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { TAP_TO_CONTINUE_SENTINEL } from '../common/api.types';
import { FOUNDATION_V7_NODES } from '../learn-path/foundation-v7-path.data';
import { toFoundationV7ClientChapters } from '../learn-path/foundation-v7-path.view';
import { pickUserSpeechForTurn } from './lesson-turn-driver';
import {
  FOUNDATION_V7_LESSON_IDS,
  FOUNDATION_V7_LESSONS,
} from './foundation-v7-lessons.data';
import lessonSpecs from './foundation-v7-lessons.authoring.json';
import {
  LESSON_PROGRESSION_ORDER,
  getAllLessons,
  getLesson,
  lessonUsesTapToContinue,
  resolveLessonProgressTurn,
} from './lessons.data';
import { LessonsService } from './lessons.service';

const FROZEN_CHAPTER_1_LESSON_IDS = [
  'greetings',
  'introductions',
  'yes_no_maybe',
] as const;

const PLEASE_THANKS = 'fnd_v7_u02n01';

type AuthoredSpec = (typeof lessonSpecs)[keyof typeof lessonSpecs];

function pathLessonNodes() {
  return FOUNDATION_V7_NODES.filter((node) => node.type === 'lesson');
}

function coreFlowStepCount(spec: AuthoredSpec): number {
  return 1 + spec.blocks.length * 2 + 2;
}

function authoredHappyPathTurns(spec: AuthoredSpec) {
  return [
    { expectsUserSpeech: false },
    ...spec.blocks.flatMap((block) => [
      { expectsUserSpeech: false },
      { expectsUserSpeech: true, expectedSpeech: block.repeat },
    ]),
    { expectsUserSpeech: true, expectedSpeech: spec.recall.answerEn },
    { expectsUserSpeech: false, isTaskComplete: true },
  ];
}

describe('Foundation V7 lessons', () => {
  it('ships all 39 path lesson nodes with real configs, including frozen Chapter 1', () => {
    const nodes = pathLessonNodes();
    const client = toFoundationV7ClientChapters()
      .flatMap((chapter) => chapter.items)
      .filter((node) => node.nodeType === 'lesson');

    assert.equal(nodes.length, 39);
    assert.equal(client.length, 39);
    assert.ok(client.every((node) => !node.comingSoon && node.lessonId));
    assert.ok(client.every((node) => getLesson(node.lessonId!) != null));
    assert.equal(new Set(nodes.map((node) => node.contentRef.lessonId)).size, 39);

    assert.deepEqual(
      nodes.slice(0, 3).map((node) => node.contentRef.lessonId),
      [...FROZEN_CHAPTER_1_LESSON_IDS],
    );
    for (const id of FROZEN_CHAPTER_1_LESSON_IDS) {
      assert.ok(getLesson(id), id);
    }
  });

  it('registers exactly the 36 authored V7 flows and keeps them off the lesson hub', async () => {
    const authoredIds = Object.keys(lessonSpecs);
    const pathAuthored = pathLessonNodes()
      .map((node) => node.contentRef.lessonId)
      .filter((id): id is string => Boolean(id?.startsWith('fnd_v7_')));

    assert.equal(FOUNDATION_V7_LESSONS.length, 36);
    assert.deepEqual(FOUNDATION_V7_LESSON_IDS, authoredIds);
    assert.deepEqual(pathAuthored.slice().sort(), authoredIds.slice().sort());
    assert.ok(authoredIds.every((id) => id.startsWith('fnd_v7_')));

    const lessons = new LessonsService({} as any, {} as any);
    for (const lesson of FOUNDATION_V7_LESSONS) {
      assert.equal(getLesson(lesson.lessonId), lesson);
      assert.equal(await lessons.isLessonUnlockedForUser('user', lesson.lessonId), true);
      assert.equal(LESSON_PROGRESSION_ORDER.includes(lesson.lessonId), false);
      assert.equal(
        getAllLessons().some((row) => row.lessonId === lesson.lessonId),
        false,
      );
    }
  });

  it('keeps authored blocks, transfer, tap-to-continue and Core Flow progressMax in sync', () => {
    for (const [id, spec] of Object.entries(lessonSpecs)) {
      const lesson = getLesson(id)!;
      const node = pathLessonNodes().find((n) => n.contentRef.lessonId === id);
      const steps = coreFlowStepCount(spec);

      assert.ok(lesson, id);
      assert.ok(node, id);
      assert.equal(lesson.titleEn, spec.titleEn, id);
      assert.equal(lesson.titleTh, spec.titleTh, id);
      assert.equal(node!.titleEn, spec.titleEn, id);
      assert.equal(lessonUsesTapToContinue(id), true, id);
      assert.equal(lesson.listenOnlyTurns, 1, id);
      assert.equal(lesson.progressMax, steps, id);
      assert.ok(lesson.progressMax! < lesson.maxTurns, id);
      assert.equal(lesson.estimatedMinutesMin, spec.estimatedMinutes[0], id);
      assert.equal(lesson.estimatedMinutesMax, spec.estimatedMinutes[1], id);
      assert.ok(spec.estimatedMinutes[0] < spec.estimatedMinutes[1], id);

      assert.ok(spec.blocks.length > 0, id);
      assert.ok(spec.goalTh.trim(), id);
      assert.ok(spec.scope.trim(), id);
      assert.ok(spec.recall.promptTh.trim(), id);
      assert.ok(spec.recall.answerEn.trim(), id);

      for (const block of spec.blocks) {
        assert.ok(block.tipTh.trim(), `${id} missing tip`);
        assert.ok(block.models.length > 0, `${id} empty models`);
        assert.ok(block.models.includes(block.repeat), `${id}: practice must follow its model`);
        for (const target of block.models) {
          assert.match(target, /[A-Za-z]/, `${id}: ${target}`);
          assert.ok(lesson.targetPhrases.includes(target), `${id}: ${target}`);
        }
      }
      assert.ok(lesson.targetPhrases.includes(spec.recall.answerEn), id);

      assert.match(lesson.systemInstruction, /Teach block 1/);
      assert.match(lesson.systemInstruction, /Practise block 1/);
      assert.match(lesson.systemInstruction, /Transfer:/);
      assert.match(lesson.systemInstruction, /isLessonComplete=true/);
      assert.match(lesson.openingPrompt, /expectsUserSpeech=false/);
    }
  });

  it('drives the authored happy path with Continue, then modeled speech, then done', () => {
    for (const [id, spec] of Object.entries(lessonSpecs)) {
      const picked = authoredHappyPathTurns(spec).map((turn) =>
        pickUserSpeechForTurn(turn),
      );
      const expected = [
        TAP_TO_CONTINUE_SENTINEL,
        ...spec.blocks.flatMap((block) => [
          TAP_TO_CONTINUE_SENTINEL,
          block.repeat,
        ]),
        spec.recall.answerEn,
        null,
      ];
      assert.deepEqual(picked, expected, id);
      assert.equal(picked.length, coreFlowStepCount(spec), id);
    }
  });

  it('Please & Thank You opens at 1/7, retries stay, correct advances, complete fills', () => {
    const spec = lessonSpecs[PLEASE_THANKS];
    const max = getLesson(PLEASE_THANKS)!.progressMax!;
    assert.equal(max, coreFlowStepCount(spec));
    assert.equal(max, 7);

    const opening = resolveLessonProgressTurn(PLEASE_THANKS, 0, max, {
      textEn: 'วันนี้ฝึกพูด Please และ Thank you นะครับ',
      expectsUserSpeech: false,
      isTaskComplete: false,
    });
    assert.equal(opening, 1);

    const firstAsk = resolveLessonProgressTurn(PLEASE_THANKS, 1, max, {
      textEn: 'ลองพูดตามนะครับ Please',
      expectsUserSpeech: true,
      expectedSpeech: spec.blocks[0].repeat,
      isTaskComplete: false,
    });
    assert.equal(firstAsk, 1);

    const correct = resolveLessonProgressTurn(
      PLEASE_THANKS,
      1,
      max,
      {
        textEn: 'เยี่ยมเลยครับ ต่อไป Excuse me',
        expectsUserSpeech: true,
        expectedSpeech: spec.blocks[1].repeat,
        isTaskComplete: false,
        assessmentTier: 'correct',
      },
      { expectedSpeech: spec.blocks[0].repeat },
    );
    assert.equal(correct, 2);

    const retry = resolveLessonProgressTurn(
      PLEASE_THANKS,
      1,
      max,
      {
        textEn: 'ยังไม่ตรงครับ ลองพูดตามนะครับ Please',
        expectsUserSpeech: true,
        expectedSpeech: spec.blocks[0].repeat,
        isTaskComplete: false,
        assessmentTier: 'incorrect',
      },
      { expectedSpeech: spec.blocks[0].repeat },
    );
    assert.equal(retry, 1);

    const done = resolveLessonProgressTurn(PLEASE_THANKS, 2, max, {
      textEn: 'เก่งมากครับ Nana',
      expectsUserSpeech: false,
      isTaskComplete: true,
    });
    assert.equal(done, 7);
  });
});
