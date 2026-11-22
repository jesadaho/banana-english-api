import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  classifyContentCourse,
  contentItemTitle,
  foundationV7PathPosition,
  foundationV7StageCatalog,
  foundationV7StageIdForRating,
  foundationV7StageIdForSession,
} from './content-course';

describe('classifyContentCourse', () => {
  it('puts Foundations path lessons together', () => {
    assert.equal(classifyContentCourse('greetings'), 'foundation');
    assert.equal(classifyContentCourse('asking_questions'), 'foundation');
    assert.equal(classifyContentCourse('ee_about_me_family'), 'foundation');
    assert.equal(classifyContentCourse('fnd_v2_how_do_you_feel'), 'foundation');
    assert.equal(
      classifyContentCourse('foundation_first_conversation'),
      'foundation',
    );
  });

  it('puts Adventure and pronunciation in their own courses', () => {
    assert.equal(classifyContentCourse('ee_around_town_coffee'), 'everyday');
    assert.equal(classifyContentCourse('ee_stories_yesterday'), 'everyday');
    assert.equal(classifyContentCourse('pron_th_1'), 'pronunciation');
  });

  it('puts hub minigames in minigame', () => {
    assert.equal(classifyContentCourse('game_say_it'), 'minigame');
    assert.equal(classifyContentCourse('game_explain_it'), 'minigame');
    assert.equal(classifyContentCourse('game_emoji_speak'), 'minigame');
    assert.equal(classifyContentCourse('game_word_cards'), 'minigame');
    assert.equal(contentItemTitle('game_word_cards'), 'Word Cards');
    assert.equal(classifyContentCourse('game_speak_challenge'), 'minigame');
    assert.equal(classifyContentCourse('game_word_choice'), 'minigame');
  });

  it('puts foundation stage score ids in foundation', () => {
    assert.equal(classifyContentCourse('say_it:fnd_v7_u03n04'), 'foundation');
    assert.equal(
      classifyContentCourse('describe_it:fnd_v7_u03n05'),
      'foundation',
    );
    assert.equal(classifyContentCourse('skip_quiz:v7_u04'), 'foundation');
    assert.equal(classifyContentCourse('word_cards:word_cards_v7_u04'), 'foundation');
    assert.equal(classifyContentCourse('listen_drill:listen_drill_v7_u04'), 'foundation');
  });

  it('tags stage scores with their chapter', () => {
    const skip = foundationV7PathPosition('skip_quiz:v7_u04');
    assert.equal(skip?.chapterNumber, 4);
    assert.equal(skip?.code, '4.0');
    assert.equal(skip?.nodeOrder, null);
    assert.ok(skip?.chapterTitleEn);
    const sayIt = foundationV7PathPosition('say_it:fnd_v7_u03n04');
    assert.equal(sayIt?.chapterNumber, 3);
    assert.ok(sayIt?.chapterTitleEn);
  });

  it('lists every map node in chapter order, not only scored games', () => {
    // Foundation only (A2 stages share chapter codes like 1.1).
    const stages = foundationV7StageCatalog().filter((s) => !/(^|:)a2_/.test(s.gameId));
    const chapter1 = stages.filter((stage) => stage.code.startsWith('1.'));
    // Same map as the app: Listen Up (easy) sits before the conversation.
    assert.deepEqual(
      chapter1.map((stage) => stage.code),
      ['1.1', '1.2', '1.3', '1.4', '1.L', '1.5'],
    );
    assert.deepEqual(
      chapter1.map((stage) => stage.nodeOrder),
      [1, 2, 3, 4, 5, 6],
    );
    const chapter2 = stages.filter(
      (stage) => stage.code.startsWith('2.') && stage.kind !== 'skip_quiz',
    );
    assert.deepEqual(
      chapter2.map((stage) => [stage.code, stage.nodeOrder]),
      [
        ['2.1', 1],
        ['2.2', 2],
        ['2.3', 3],
        ['2.4', 4],
        ['2.5', 5],
        ['2.L', 6],
        ['2.6', 7],
      ],
    );
  });

  it('places generated Listen Up (easy) like the app map', () => {
    const drill = foundationV7PathPosition('listen_drill:listen_drill_v7_u04');
    assert.equal(drill?.code, '4.L');
    assert.equal(drill?.chapterNumber, 4);
    assert.equal(drill?.nodeId, 'v7_u04_ld');
    const ch1 = foundationV7StageCatalog().filter(
      (s) => s.code.startsWith('1.') && !/(^|:)a2_/.test(s.gameId),
    );
    assert.deepEqual(
      ch1.map((s) => [s.code, s.nodeId, s.nodeOrder]),
      [
        ['1.1', 'v7_u01n01', 1],
        ['1.2', 'v7_u01n02', 2],
        ['1.3', 'v7_u01n03', 3],
        ['1.4', 'v7_u01n04', 4],
        ['1.L', 'v7_u01_ld', 5],
        ['1.5', 'v7_u01n05', 6],
      ],
    );
    assert.equal(
      ch1.find((s) => s.code === '1.3')?.gameId,
      'say_it:fnd_v2_first_conversation',
    );
  });

  it('places Adventure A2 after Foundations, and maps pronunciation sessions', () => {
    const a2 = foundationV7PathPosition('new_words:a2_c01n01');
    assert.equal(a2?.code, '1.1');
    assert.equal(a2?.chapterNumber, 1);
    assert.ok((a2?.order ?? 0) > (foundationV7PathPosition('skip_quiz:v7_u04')?.order ?? Infinity));
    assert.equal(foundationV7PathPosition('skip_quiz:a2_c02')?.code, '2.0');
    assert.equal(foundationV7StageIdForSession({ lessonId: 'pron_final_s_1', simulationId: null }), 'v7_u05n03');
    assert.match(contentItemTitle('v7_u04n04'), /coming soon$/);
  });

  it('maps lesson ratings onto the same stage ids as the score table', () => {
    assert.equal(foundationV7StageIdForRating('greetings'), 'v7_u01n01');
    assert.equal(foundationV7StageIdForRating('yes_no_maybe'), 'v7_u01n04');
    assert.equal(
      foundationV7StageIdForRating('foundation_first_conversation'),
      'v7_u01n05',
    );
    assert.equal(
      foundationV7StageIdForRating('fnd_v2_first_conversation'),
      'say_it:fnd_v2_first_conversation',
    );
    assert.equal(foundationV7StageIdForRating('game_say_it'), null);
  });

  it('puts parked leftover lessons in other', () => {
    assert.equal(classifyContentCourse('weather'), 'other');
    assert.equal(classifyContentCourse('shopping_basics'), 'other');
  });
});
