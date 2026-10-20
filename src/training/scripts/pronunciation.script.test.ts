import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getLesson } from '../../lessons/lessons.data';
import { isTrainingV2Lesson } from '../training-v2.config';
import {
  buildPronunciationAfterUser,
  buildPronunciationOpening,
  collectPronunciationBankLines,
} from './pronunciation.script';

describe('pronunciation script', () => {
  const config = getLesson('pron_th_1');
  if (!config) throw new Error('missing pron_th_1');

  it('is on training v2 so Gemini is not called', () => {
    assert.equal(isTrainingV2Lesson('pron_th_1'), true);
    assert.equal(isTrainingV2Lesson('pron_th_2'), true);
    assert.equal(isTrainingV2Lesson('fnd_v6_pron_catch_slowly'), true);
  });

  it('opens from the chapter intro without asking for speech', () => {
    const opening = buildPronunciationOpening(config);
    assert.equal(opening.expectsUserSpeech, false);
    assert.equal(opening.isLessonComplete, false);
    assert.match(opening.ttsText ?? '', /ยินดีต้อนรับสู่ Chapter 1/);
  });

  it('walks listen steps then practices the first word', () => {
    const opening = buildPronunciationOpening(config);
    let turns = [
      {
        speaker: 'ai' as const,
        textEn: opening.textEn,
        expectsUserSpeech: false,
      },
    ];
    let reply = buildPronunciationAfterUser({
      config,
      turns,
      userText: '(tapped Continue)',
      learnerFirstName: 'Ann',
    });
    assert.ok(reply);
    assert.equal(reply.expectsUserSpeech, false);

    while (reply && reply.expectsUserSpeech === false && !reply.isLessonComplete) {
      turns = [
        ...turns,
        { speaker: 'user' as const, textEn: '(tapped Continue)' },
        {
          speaker: 'ai' as const,
          textEn: reply.textEn,
          expectsUserSpeech: false,
          completionStatus: reply.completionStatus,
        },
      ];
      reply = buildPronunciationAfterUser({
        config,
        turns,
        userText: '(tapped Continue)',
        learnerFirstName: 'Ann',
      });
    }

    assert.ok(reply);
    assert.equal(reply.expectsUserSpeech, true);
    assert.equal(reply.expectedSpeech, 'think');
  });

  it('banks intros, tips, and target words without learner names', () => {
    const lines = collectPronunciationBankLines('Ann');
    assert.ok(lines.includes('think'));
    assert.ok(lines.some((line) => line.includes('แลบปลายลิ้น')));
    assert.ok(lines.every((line) => !/\bAnn\b/.test(line)));
    assert.ok(lines.length > 80);
  });
});
