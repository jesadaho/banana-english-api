import assert from 'node:assert/strict';
import { V7_LEGACY_FLOWS } from './foundation-v7-legacy-flows';
import { describe, it } from 'node:test';
import { TAP_TO_CONTINUE_SENTINEL } from '../common/api.types';
import { FOUNDATION_V7_NODES } from '../learn-path/foundation-v7-path.data';
import { toFoundationV7ClientChapters } from '../learn-path/foundation-v7-path.view';
import { pickUserSpeechForTurn } from './lesson-turn-driver';
import {
  FOUNDATION_V7_LESSON_IDS,
  FOUNDATION_V7_LESSONS,
  FOUNDATION_V7_PATTERNS,
  buildFoundationV7Steps,
} from './foundation-v7-lessons.data';
import { FOUNDATION_V7_CHOICE_BEATS } from './foundation-v7-choice-beats.data';
import lessonSpecs from './foundation-v7-lessons.authoring.json';
import {
  LESSON_PROGRESSION_ORDER,
  getAllLessons,
  getLesson,
  lessonUsesTapToContinue,
  resolveLessonProgressTurn,
} from './lessons.data';
import { LessonsService } from './lessons.service';
import { coerceFoundationV7SpeechTurn } from './foundation-v7-turn-guard';
import {
  AUTHORED_V7_LESSON_IDS,
  classifyResult,
  lessonSummaryLabel,
  parseFoundationV7LessonArgs,
} from '../../scripts/lib/foundation-v7-lessons-prod-runner.ts';

const FROZEN_CHAPTER_1_LESSON_IDS = [
  'greetings',
  'introductions',
  'yes_no_maybe',
] as const;

const PLEASE_THANKS = 'fnd_v7_please_and_thank_you';

type AuthoredSpec = (typeof lessonSpecs)[keyof typeof lessonSpecs];

function pathLessonNodes() {
  return FOUNDATION_V7_NODES.filter((node) => node.type === 'lesson');
}

function coreFlowStepCount(id: string, spec: AuthoredSpec): number {
  return 4 + spec.blocks.length * (FOUNDATION_V7_PATTERNS[id] === 'decode_and_use' ? 2 : 1);
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

  it('registers exactly the 39 authored V7 flows and keeps them off the lesson hub', async () => {
    const authoredIds = Object.keys(lessonSpecs);
    const pathAuthored = pathLessonNodes()
      .map((node) => node.contentRef.lessonId)
      .filter((id): id is string => Boolean(id?.startsWith('fnd_v7_')));

    assert.equal(FOUNDATION_V7_LESSONS.length, 39);
    assert.deepEqual(FOUNDATION_V7_LESSON_IDS, authoredIds);
    assert.deepEqual(pathAuthored.slice().sort(), authoredIds.filter(id => !['fnd_v7_letter_names_a_m', 'fnd_v7_letter_names_n_z', 'fnd_v7_say_that_again'].includes(id)).sort());
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

  it('keeps authored blocks, recognition, recall and Core Flow progressMax in sync', () => {
    for (const [id, spec] of Object.entries(lessonSpecs)) {
      const lesson = getLesson(id)!;
      if (V7_LEGACY_FLOWS[id]) {
        assert.equal(lesson.progressMax, V7_LEGACY_FLOWS[id].length);
        assert.equal(lesson.listenOnlyTurns, 0);
        continue;
      }
      const node = pathLessonNodes().find((n) => n.contentRef.lessonId === id);
      const steps = coreFlowStepCount(id, spec);

      assert.ok(lesson, id);
      assert.equal(Boolean(node), !['fnd_v7_letter_names_a_m', 'fnd_v7_letter_names_n_z'].includes(id), id);
      assert.equal(lesson.titleEn, spec.titleEn, id);
      assert.equal(lesson.titleTh, spec.titleTh, id);
      if (node) assert.equal(node.titleEn, spec.titleEn, id);
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
      assert.match(lesson.systemInstruction, /Authored choice/);
      assert.match(lesson.systemInstruction, /isLessonComplete=true/);
      assert.match(lesson.openingPrompt, /expectsUserSpeech=false/);
    }
  });

  it('gives every V7 lesson an authored first-turn context and learner goal', () => {
    for (const id of FOUNDATION_V7_LESSON_IDS) {
      const lesson = getLesson(id)!;
      const first = buildFoundationV7Steps(id)[0];

      assert.match(first.instruction, /(วันนี้|เราจะ|ลองพูด|ลองถาม|ลองนับ)/, id);
      assert.match(first.instruction, /(ฝึก|เรียน|ใช้|พูด|บอก|ถาม)/, id);
      assert.doesNotMatch(first.instruction, /state the practical goal briefly/, id);
      if (!V7_LEGACY_FLOWS[id]) {
        assert.match(first.instruction, /Open with exactly this authored Thai context and goal/, id);
        assert.match(lesson.openingPrompt, /exact authored opening/, id);
      }
    }
  });

  it('models zero through five before the first Numbers 0–10 counting task', () => {
    const first = buildFoundationV7Steps('fnd_v7_numbers_0_10')[0];
    assert.match(first.instruction, /zero, one, two, three, four, five/);
    assert.equal(first.expectedSpeech, 'four');
    assert.ok(first.presentation?.options.some(option => option.speak === 'four'));
  });

  it('keeps prerequisite vocabulary teaching inside revised first turns', () => {
    assert.match(buildFoundationV7Steps('fnd_v7_eleven_to_twenty')[0].instruction, /eleven คือสิบเอ็ด/);
    assert.match(buildFoundationV7Steps('fnd_v7_prices_and_paying')[0].instruction, /ticket คือตั๋ว/);
    assert.match(buildFoundationV7Steps('fnd_v7_i_like_i_dont_like')[0].instruction, /I like coffee/);
  });

  it('authors choices for every lesson with valid timing and distinct cues', () => {
    assert.deepEqual(Object.keys(FOUNDATION_V7_CHOICE_BEATS).sort(), Object.keys(lessonSpecs).sort());
    for (const [id, choice] of Object.entries(FOUNDATION_V7_CHOICE_BEATS)) {
      const spec = lessonSpecs[id as keyof typeof lessonSpecs];
      assert.ok(choice.afterBlock >= 1 && choice.afterBlock <= spec.blocks.length, id);
      assert.ok(choice.options.length >= 2 && choice.options.length <= 6, id);
      assert.equal(new Set(choice.options.map(o => o.label)).size, choice.options.length, id);
      for (const o of choice.options) {
        assert.ok(o.label.split(/\s+/).length <= 3, id + ': cue too long');
        assert.ok(o.emoji && o.speak, id);
        assert.doesNotMatch(o.speak, /She have|Do he|Is they/, id);
      }
      if (choice.answerMode === 'single') {
        assert.equal(choice.options.filter(o => o.speak === choice.expectedSpeech).length, 1, id);
        assert.ok(choice.incorrectHintTh, id);
      } else {
        assert.equal(choice.expectedSpeech, undefined, id + ': free choice has no single key');
      }
    }
  });

  it('keeps four different teaching rhythms short and speech-focused', () => {
    assert.equal(new Set(Object.values(FOUNDATION_V7_PATTERNS)).size, 4);
    for (const [id, spec] of Object.entries(lessonSpecs)) {
      const steps = buildFoundationV7Steps(id);
      if (V7_LEGACY_FLOWS[id]) {
        assert.ok(steps.slice(0, -1).every(s => s.expectsUserSpeech));
        assert.equal(steps.at(-1)!.kind, 'complete');
        assert.ok(steps.length <= 9);
        continue;
      }
      assert.equal(steps.length, coreFlowStepCount(id, spec), id);
      assert.ok(steps.length <= 12, id);
      assert.equal(steps.filter(s => s.kind === 'choice').length, 1, id);
      assert.equal(steps.at(-1)!.kind, 'complete', id);
      assert.equal(pickUserSpeechForTurn(steps[0]), TAP_TO_CONTINUE_SENTINEL);
      assert.ok(steps.filter(s => s.expectsUserSpeech).length >= spec.blocks.length + 2, id);
    }
    assert.ok(buildFoundationV7Steps('fnd_v7_letter_names_a_m').some(s => s.kind === 'model_group'));
    assert.ok(buildFoundationV7Steps('fnd_v7_goodbye_see_you').some(s => /Choice reuse/.test(s.instruction)));
  });

  it('ships real guided board payloads and accepts non-first personal options in its tutor contract', () => {
    for (const [id, choice] of Object.entries(FOUNDATION_V7_CHOICE_BEATS)) {
      const step = buildFoundationV7Steps(id).find(s => s.kind === 'choice')!;
      if (V7_LEGACY_FLOWS[id]) continue; // Step-local boards tested by runtime suite.
      const json = step.instruction.split('Return guidedSpeaking=')[1].split('; omit emojiChoice')[0];
      const board = JSON.parse(json);
      assert.equal(board.stem, choice.stem);
      assert.deepEqual(board.options, choice.options);
      if (choice.answerMode === 'any') {
        assert.match(step.instruction, /EVERY option is correct/);
        assert.match(step.instruction, /NEVER the sole answer key/);
        for (const option of board.options.slice(1)) {
          assert.ok(step.instruction.includes(option.speak), id);
        }
      }
    }
    const reuse = buildFoundationV7Steps('fnd_v7_goodbye_see_you').find(s => s.kind === 'recall')!;
    assert.match(reuse.instruction, /THEIR selected speak value/);
  });

  it('Please & Thank You practises Sorry and Excuse me separately', () => {
    const spec = lessonSpecs[PLEASE_THANKS];
    const max = getLesson(PLEASE_THANKS)!.progressMax!;
    assert.equal(max, buildFoundationV7Steps(PLEASE_THANKS).length);
    assert.equal(max, 8);
    assert.deepEqual(spec.blocks.map((block) => block.repeat), [
      'Please',
      'Sorry',
      'Excuse me',
    ]);

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
    assert.equal(done, max);
  });

  it('keeps reviewed transfer, scope and completion contracts explicit', () => {
    assert.equal(
      lessonSpecs.fnd_v7_eleven_to_twenty.recall.answerEn,
      'I am twenty years old',
    );
    assert.equal(
      lessonSpecs.fnd_v7_he_she_it_we_they.titleEn,
      'He, She, It, We, They',
    );
    assert.equal(
      lessonSpecs.fnd_v7_where_when_how_much_and_how_many.titleEn,
      'Where, When, How Much & How Many',
    );
    assert.match(
      getLesson('fnd_v7_say_that_again')!.systemInstruction,
      /จบบทแล้วครับ.*ขอซ้ำ ขอช้า/,
    );
  });

  it('makes every practice a microphone turn and every model group one milestone', () => {
    const prices = getLesson('fnd_v7_prices_and_paying')!;
    const paymentSteps = buildFoundationV7Steps(prices.lessonId).filter(s => s.expectedSpeech?.replace(/\.$/, '') === 'Here you are');
    assert.equal(paymentSteps.length, 2, 'model followed by contextual payment');
    assert.ok(paymentSteps.every(s => s.expectsUserSpeech));

    const letters = getLesson('fnd_v7_letter_names_a_m')!;
    assert.match(letters.systemInstruction, /Model ALL these English forms in this same turn/);
    assert.match(letters.systemInstruction, /Never split this model list across later turns/);
    assert.match(letters.systemInstruction, /alphabet groups such as A–D are modeled together/);
  });

  it('opens the mic when Prices & Paying repeats a Continue lecture', () => {
    const phrases = getLesson('fnd_v7_prices_and_paying')!.targetPhrases;
    const lecture =
      'How much is it? ใช้ถามราคา และ One ticket, please ใช้ขอซื้อตั๋วครับ';
    const stuck = coerceFoundationV7SpeechTurn({
      isLessonComplete: false,
      previousUserWasContinue: true,
      previousAiText: lecture,
      textEn: lecture,
      expectsUserSpeech: false,
      expectedSpeech: null,
      hasBoard: false,
      targetPhrases: phrases,
    });
    assert.equal(stuck.expectsUserSpeech, true);
    assert.ok(phrases.includes(stuck.expectedSpeech!));

    const asked = coerceFoundationV7SpeechTurn({
      isLessonComplete: false,
      previousUserWasContinue: true,
      previousAiText: 'ขอตั๋วหนึ่งใบอย่างสุภาพครับ',
      textEn: 'ลองพูดตามว่า One ticket, please',
      expectsUserSpeech: false,
      expectedSpeech: null,
      hasBoard: false,
      targetPhrases: phrases,
    });
    assert.equal(asked.expectsUserSpeech, true);
    assert.equal(asked.expectedSpeech, 'One ticket, please');
  });

  it('parses authored lessons and PoolGate scenarios 1–5 by default', () => {
    assert.deepEqual(parseFoundationV7LessonArgs(['node', 'script']), {
      lessonIds: [...AUTHORED_V7_LESSON_IDS],
      scenarios: [1, 2, 3, 4, 5],
    });
    assert.deepEqual(parseFoundationV7LessonArgs(['node', 'script', '1']), {
      lessonIds: [...AUTHORED_V7_LESSON_IDS],
      scenarios: [1],
    });
    assert.deepEqual(
      parseFoundationV7LessonArgs(['node', 'script', 'fnd_v7_prices_and_paying', '4']),
      {
        lessonIds: ['fnd_v7_prices_and_paying'],
        scenarios: [4],
      },
    );
    assert.deepEqual(parseFoundationV7LessonArgs(['node', 'script', 'ch2']), {
      lessonIds: ['fnd_v7_please_and_thank_you', 'fnd_v7_goodbye_see_you'],
      scenarios: [1, 2, 3, 4, 5],
    });
    assert.deepEqual(
      parseFoundationV7LessonArgs(['node', 'script', 'frozen', '2']),
      {
        lessonIds: ['greetings', 'introductions', 'yes_no_maybe'],
        scenarios: [2],
      },
    );
    assert.deepEqual(
      parseFoundationV7LessonArgs(['node', 'script', 'fnd_v7_u11n01']),
      {
        lessonIds: ['fnd_v7_i_can'],
        scenarios: [1, 2, 3, 4, 5],
      },
    );
    assert.throws(
      () => parseFoundationV7LessonArgs(['node', 'script', 'unknown']),
      /unknown V7 lesson/,
    );
  });

  it('classifies scripted incorrect retries as out-of-pool so scenario 4/5 can recover', () => {
    assert.equal(
      classifyResult({
        aiDebug: { source: 'scripted' },
        assessmentTier: 'incorrect',
        aiResponse: 'ลองอีกครั้งครับ พูดว่า “Please”',
      }),
      'incorrect out pool',
    );
    assert.equal(
      classifyResult({
        aiDebug: { source: 'scripted' },
        assessmentTier: 'incorrect',
        wasSoftAdvance: true,
        aiResponse: 'ประโยคนี้พูดว่า “Please” ครับ ลองฝึกต่อด้วยกันนะครับ',
      }),
      'wrong (soft-advance)',
    );
  });
});
