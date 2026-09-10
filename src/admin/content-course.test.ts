import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { classifyContentCourse } from './content-course';

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

  it('puts parked leftover lessons in other', () => {
    assert.equal(classifyContentCourse('weather'), 'other');
    assert.equal(classifyContentCourse('shopping_basics'), 'other');
  });
});
