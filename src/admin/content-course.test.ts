import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { classifyContentCourse } from './content-course';

describe('classifyContentCourse', () => {
  it('puts original Basics catalog in basic', () => {
    assert.equal(classifyContentCourse('greetings'), 'basic');
    assert.equal(classifyContentCourse('asking_questions'), 'basic');
    assert.equal(classifyContentCourse('ee_about_me_family'), 'basic');
  });

  it('puts Foundation Path-only nodes in foundation', () => {
    assert.equal(classifyContentCourse('fnd_v2_how_do_you_feel'), 'foundation');
    assert.equal(
      classifyContentCourse('fnd_v2_say_first_conversation'),
      'foundation',
    );
    assert.equal(
      classifyContentCourse('foundation_first_conversation'),
      'foundation',
    );
  });

  it('puts Everyday English and pronunciation in their own courses', () => {
    assert.equal(classifyContentCourse('ee_around_town_coffee'), 'everyday');
    assert.equal(classifyContentCourse('ee_stories_yesterday'), 'everyday');
    assert.equal(classifyContentCourse('pron_th_1'), 'pronunciation');
  });

  it('puts parked leftover lessons in other', () => {
    assert.equal(classifyContentCourse('weather'), 'other');
    assert.equal(classifyContentCourse('shopping_basics'), 'other');
  });
});
