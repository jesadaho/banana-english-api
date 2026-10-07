import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  classifyContentCourse,
  foundationV7PathPosition,
  foundationV7StageCatalog,
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
    const stages = foundationV7StageCatalog();
    const chapter1 = stages.filter((stage) => stage.code.startsWith('1.'));
    assert.deepEqual(
      chapter1.map((stage) => stage.code),
      ['1.1', '1.2', '1.3', '1.4', '1.5'],
    );
    assert.deepEqual(
      chapter1.map((stage) => stage.nodeOrder),
      [1, 2, 3, 4, 5],
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
      ],
    );
  });

  it('puts parked leftover lessons in other', () => {
    assert.equal(classifyContentCourse('weather'), 'other');
    assert.equal(classifyContentCourse('shopping_basics'), 'other');
  });
});
