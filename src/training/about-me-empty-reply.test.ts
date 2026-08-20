import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildChoiceLessonAfterUser,
  pinChoiceLessonAiReply,
} from './scripts/choice-lesson.script';
import {
  ABOUT_ME_FRIENDS,
  ABOUT_ME_PETS,
  ABOUT_ME_WEATHER,
} from './scripts/about-me.registry';

type Turn = {
  speaker: string;
  textEn?: string;
  expectedSpeech?: string | null;
  assessmentTier?: 'correct' | 'close' | 'incorrect';
  wasSoftAdvance?: boolean;
};

describe('About Me empty-reply / soft-hint bugs', () => {
  it('pets: after Your compliment, advance to combo has non-empty reply', () => {
    const history: Turn[] = [
      { speaker: 'ai', textEn: 'Do you have any pets?' },
      { speaker: 'user', textEn: 'I have a dog.' },
      { speaker: 'ai', textEn: 'What is your dog like?' },
      { speaker: 'user', textEn: 'My dog is very friendly.' },
      {
        speaker: 'ai',
        textEn: "How would you compliment your friend's pet?",
      },
      { speaker: 'user', textEn: 'Your dog is very friendly.' },
    ];
    const reply = buildChoiceLessonAfterUser(ABOUT_ME_PETS, {
      turns: history,
      learnerFirstName: 'Nana',
    });
    assert.ok(reply?.textEn?.trim(), 'combo advance must not be blank');
    assert.match(reply!.textEn!, /สองประโยค|ติดกัน|I have a/i);
    assert.match(
      reply!.expectedSpeech ?? '',
      /I have a dog\. My dog is very friendly\./i,
    );
  });

  it('weather: after cold sentence, preference step has non-empty reply', () => {
    const history: Turn[] = [
      { speaker: 'ai', textEn: 'อากาศร้อน?' },
      { speaker: 'user', textEn: 'Hot.' },
      {
        speaker: 'ai',
        textEn: 'How do you say the weather is very cold today?',
      },
      { speaker: 'user', textEn: 'The weather is very cold today.' },
    ];
    const reply = buildChoiceLessonAfterUser(ABOUT_ME_WEATHER, {
      turns: history,
      learnerFirstName: 'Nana',
    });
    assert.ok(reply?.textEn?.trim(), 'preference advance must not be blank');
    assert.match(reply!.textEn!, /ชอบอากาศ|What weather/i);
  });

  it('weather: Gemini correct pin never returns praise-only when next board has cue', () => {
    const prior: Turn[] = [
      { speaker: 'ai', textEn: 'อากาศร้อน?' },
      { speaker: 'user', textEn: 'Hot.' },
      {
        speaker: 'ai',
        textEn: 'How do you say the weather is very cold today?',
      },
    ];
    const turns: Turn[] = [
      ...prior,
      { speaker: 'user', textEn: 'The weather is very cold today....' },
    ];
    const pinned = pinChoiceLessonAiReply(
      ABOUT_ME_WEATHER,
      turns,
      {
        textEn: 'ถูกต้องแล้วครับ',
        textTh: '',
        isLessonComplete: false,
        expectsUserSpeech: true,
        assessmentTier: 'correct',
      },
      2,
      'Nana',
    );
    assert.ok(pinned.textEn.trim().length > 'ถูกต้องครับ!'.length);
    assert.match(pinned.textEn, /ชอบอากาศ|What weather/i);
  });

  it('pets soft-advance after Your uses combo cue (not bare ไปต่อกัน)', () => {
    const history: Turn[] = [
      { speaker: 'ai', textEn: 'Do you have any pets?' },
      { speaker: 'user', textEn: 'I have a dog.' },
      { speaker: 'ai', textEn: 'What is your dog like?' },
      { speaker: 'user', textEn: 'My dog is very friendly.' },
      {
        speaker: 'ai',
        textEn: "How would you compliment your friend's pet?",
      },
      { speaker: 'user', textEn: 'Good morning.' },
      {
        speaker: 'ai',
        textEn: 'ลองพูดตาม Your dog is very friendly.',
        assessmentTier: 'incorrect',
      },
      { speaker: 'user', textEn: 'Hello there.' },
    ];
    const reply = buildChoiceLessonAfterUser(ABOUT_ME_PETS, {
      turns: history,
      learnerFirstName: 'Nana',
    });
    assert.equal(reply?.wasSoftAdvance, true);
    assert.doesNotMatch(reply?.textEn ?? '', /^ไม่เป็นไรครับ ไปต่อกัน!\s*$/);
    assert.match(reply!.textEn!, /สองประโยค|ติดกัน|ไปต่อกันเลย/i);
  });

  it('friends / pets / weather incorrectHintTh avoid full-sentence dump', () => {
    const pets1 = ABOUT_ME_PETS.boardForStep(1, []);
    const weather2 = ABOUT_ME_WEATHER.boardForStep(2, []);
    const friends1 = ABOUT_ME_FRIENDS.boardForStep(1, []);
    assert.match(pets1?.incorrectHintTh ?? '', /I have a\.\.\./);
    assert.doesNotMatch(pets1?.incorrectHintTh ?? '', /I have a dog\./i);
    assert.match(weather2?.incorrectHintTh ?? '', /The weather is very\.\.\./);
    assert.doesNotMatch(
      weather2?.incorrectHintTh ?? '',
      /The weather is very cold today\./i,
    );
    assert.match(friends1?.incorrectHintTh ?? '', /We \.\.\. together/);
    assert.doesNotMatch(
      friends1?.incorrectHintTh ?? '',
      /We play games together\./i,
    );
  });
});
