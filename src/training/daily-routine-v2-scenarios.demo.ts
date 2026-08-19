/**
 * Demo — Daily Routine v2: pool exact (scripted) vs out-of-pool AI 3-tier assess.
 */
import {
  buildDailyRoutineAfterUser,
  buildDailyRoutineOpening,
  pinDailyRoutineAiReply,
} from './scripts/daily-routine.script';
import { scoreDailyRoutineStep } from '../lessons/lessons.data';

type Turn = { speaker: string; textEn?: string };

const VOCAB_SETUP: Turn[] = [
  { speaker: 'user', textEn: "I'm ready" },
  {
    speaker: 'ai',
    textEn: 'เก่งมากครับ! มาเริ่มกันเลย คำว่า ตื่นนอน ในภาษาอังกฤษคือคำไหนครับ? ⏰',
  },
];

function show(
  name: string,
  userSpeech: string,
  setup: Turn[],
  ai?: { assessmentTier: 'correct' | 'close' | 'incorrect'; textEn: string },
) {
  const history: Turn[] = [
    { speaker: 'ai', textEn: buildDailyRoutineOpening('Nana').textEn },
    ...setup,
    { speaker: 'user', textEn: userSpeech },
  ];
  const route = buildDailyRoutineAfterUser({ turns: history, learnerFirstName: 'Nana' });
  const step = setup.filter((t) => t.speaker === 'user').length + 1;
  const tier = scoreDailyRoutineStep(step, userSpeech);

  console.log('\n' + '═'.repeat(72));
  console.log(name);
  console.log(`User: "${userSpeech}" | pool tier: ${tier}`);
  console.log(`Route: ${route?.deferToAi ? '→ AI assess' : '→ scripted'}`);

  const reply =
    route?.deferToAi && ai
      ? pinDailyRoutineAiReply(history, {
          textEn: ai.textEn,
          textTh: '',
          isLessonComplete: false,
          expectsUserSpeech: true,
          assessmentTier: ai.assessmentTier,
        })
      : route;

  if (ai) console.log(`AI tier: ${ai.assessmentTier}`);
  console.log(`Reply: ${reply?.textEn?.slice(0, 110)}…`);
  console.log(`Next expected: ${reply?.expectedSpeech ?? '(none)'}`);
}

console.log('Daily Routine v2 — full lane model');

show('A) IN POOL exact → scripted (no AI)', "I'm ready", []);

show('B) OUT OF POOL → AI incorrect → explain + repeat', 'go to work', VOCAB_SETUP, {
  assessmentTier: 'incorrect',
  textEn: 'ยังไม่ใช่ครับ คำที่ต้องการคือ "wake up" ลองพูดตามนะครับ',
});

show('C) OUT OF POOL → AI close → tweak + advance', 'get up', VOCAB_SETUP, {
  assessmentTier: 'close',
  textEn: 'เกือบเป๊ะครับ! ปกติจะพูดว่า "wake up" ไปต่อกันเลย!',
});

show('D) OUT OF POOL → AI correct → praise + advance', "I get up at 7 o'clock.", [
  ...VOCAB_SETUP,
  { speaker: 'user', textEn: 'wake up' },
  { speaker: 'ai', textEn: 'wake time ask' },
], {
  assessmentTier: 'correct',
  textEn: 'ถูกต้องครับ! เก่งมาก',
});

console.log('\n' + '═'.repeat(72));
console.log('incorrect ครั้งที่ 2 (ไม่ผ่าน AI): replay → scripted soft-advance');
console.log('═'.repeat(72));
