import type { LessonConfig } from './lessons.data';
import specs from './foundation-v7-lessons.authoring.json';
import { FOUNDATION_V7_CHOICE_BEATS } from './foundation-v7-choice-beats.data';

export type V7TeachingPattern = 'choose_and_reuse' | 'contrast_and_apply' | 'decode_and_use' | 'situation_and_respond';

// Explicit curriculum assignments; changes here alter teaching rhythm, not content.
export const FOUNDATION_V7_PATTERNS: Record<string, V7TeachingPattern> = {
  fnd_v7_please_and_thank_you: 'situation_and_respond', fnd_v7_say_that_again: 'situation_and_respond',
  fnd_v7_goodbye_see_you: 'choose_and_reuse',
  fnd_v7_i_am_you_are: 'choose_and_reuse', fnd_v7_not_and_are_you: 'contrast_and_apply',
  fnd_v7_he_she_it_we_they: 'contrast_and_apply', fnd_v7_my_family: 'choose_and_reuse',
  fnd_v7_one_or_more: 'contrast_and_apply',
  fnd_v7_this_is_that_is: 'contrast_and_apply', fnd_v7_colours_and_size: 'choose_and_reuse', fnd_v7_these_and_those: 'contrast_and_apply',
  fnd_v7_my_and_your: 'choose_and_reuse', fnd_v7_his_her_our_their: 'contrast_and_apply', fnd_v7_have_and_has: 'contrast_and_apply',
  fnd_v7_numbers_0_10: 'decode_and_use', fnd_v7_eleven_to_twenty: 'decode_and_use',
  fnd_v7_letter_names_a_m: 'decode_and_use', fnd_v7_letter_names_n_z: 'decode_and_use',
  fnd_v7_twenty_to_one_hundred: 'decode_and_use', fnd_v7_what_time_is_it: 'decode_and_use',
  fnd_v7_days_and_simple_plans: 'choose_and_reuse', fnd_v7_prices_and_paying: 'situation_and_respond',
  fnd_v7_i_like_i_dont_like: 'choose_and_reuse', fnd_v7_do_you_like_it: 'choose_and_reuse', fnd_v7_want_need_and_please: 'choose_and_reuse',
  fnd_v7_i_can: 'choose_and_reuse', fnd_v7_cant_and_can_you: 'choose_and_reuse',
  fnd_v7_my_day: 'choose_and_reuse', fnd_v7_her_day_his_day: 'contrast_and_apply', fnd_v7_do_does_every_day: 'contrast_and_apply',
  fnd_v7_happening_now: 'choose_and_reuse', fnd_v7_are_they_working: 'contrast_and_apply',
  fnd_v7_what_or_who: 'contrast_and_apply', fnd_v7_where_when_how_much_and_how_many: 'contrast_and_apply',
  fnd_v7_there_is_there_are: 'contrast_and_apply', fnd_v7_in_on_under_next_to: 'contrast_and_apply', fnd_v7_go_straight_turn_left: 'situation_and_respond',
  fnd_v7_where_is_it: 'contrast_and_apply', fnd_v7_how_do_you_go: 'choose_and_reuse',
};

const APPLICATION_STEMS: Record<string, string> = {
  fnd_v7_not_and_are_you: 'Are you...?', fnd_v7_he_she_it_we_they: 'We are...',
  fnd_v7_one_or_more: '..., please', fnd_v7_this_is_that_is: 'This is...',
  fnd_v7_these_and_those: 'Those are...', fnd_v7_his_her_our_their: 'These are...',
  fnd_v7_have_and_has: 'He has...', fnd_v7_her_day_his_day: 'He eats...',
  fnd_v7_do_does_every_day: 'Does he...?', fnd_v7_are_they_working: 'Is he...?',
  fnd_v7_what_or_who: 'What is...?', fnd_v7_where_when_how_much_and_how_many: 'Where is...?',
  fnd_v7_there_is_there_are: 'There is...', fnd_v7_in_on_under_next_to: 'The bag is...',
  fnd_v7_where_is_it: 'Where is...?',
};

// Authored cold opens keep the existing first turn purposeful and consistent.
const FOUNDATION_V7_OPENINGS: Record<string, string> = {
  fnd_v7_goodbye_see_you: 'เรียนจบแล้วแต่ยังยืนมองหน้ากันอยู่ครับ 😅 วันนี้เราจะฝึกจบบทสนทนาด้วย Goodbye, See you และ See you tomorrow',
  fnd_v7_i_am_you_are: 'วันนี้เราจะฝึกบอกความรู้สึกของตัวเองและอีกฝ่ายครับ ถ้าพูดถึงตัวเอง เริ่มด้วย I am… “ฉันพร้อม” พูดว่า I am ready. ลองพูดตามครับ',
  fnd_v7_not_and_are_you: 'วันนี้เราจะฝึกบอกว่า “ไม่” และถามความรู้สึกของอีกฝ่ายครับ I am tired. แปลว่า “ฉันเหนื่อย” เติม not หลัง am เป็น I am not tired. แปลว่า “ฉันไม่เหนื่อย” ลองพูดว่า I am not tired. ครับ',
  fnd_v7_one_or_more: 'Max ขอหนังสือหนึ่งเล่ม แต่พนักงานกำลังจะยกมาทั้งกองครับ 📚😳 วันนี้เราจะฝึกบอกให้ชัดว่าต้องการหนึ่งชิ้นหรือหลายชิ้น',
  fnd_v7_this_is_that_is: 'บนโต๊ะมีหนังสืออยู่ใกล้หนึ่งเล่ม และกระเป๋าอยู่อีกฝั่งหนึ่งครับ วันนี้เราจะฝึกชี้ของใกล้และไกลด้วย this และ that',
  fnd_v7_colours_and_size: 'มีกระเป๋าหลายใบครับ ถ้าบอกแค่ว่า “เอาใบนั้น” มีโอกาสได้ผิดใบสูงมาก 😅 วันนี้เราจะใช้สีและขนาดช่วยบอกให้ชัดขึ้น',
  fnd_v7_these_and_those: 'หนังสือรอบนี้ไม่ได้มาเล่มเดียวครับ มากันเป็นแก๊งเลย 📚 วันนี้เราจะพูดถึงของหลายชิ้นที่อยู่ใกล้และไกลด้วย these และ those',
  fnd_v7_my_and_your: 'โทรศัพท์สองเครื่องวางอยู่ติดกันครับ หยิบผิดขึ้นมาเรื่องอาจยาวกว่าบทเรียน 😅 วันนี้เราจะฝึกบอกว่าอะไรเป็นของฉันและอะไรเป็นของคุณ',
  fnd_v7_his_her_our_their: 'บนโต๊ะมีหนังสือของ Ben โทรศัพท์ของ Anna และกุญแจของเพื่อนอีกกลุ่มครับ วันนี้เราจะฝึกบอกว่าแต่ละอย่างเป็นของใคร แล้วช่วยคืนของให้ถูกเจ้าของกัน',
  fnd_v7_have_and_has: 'Teacher B อยากรู้ว่าแต่ละคนมีอะไรบ้างครับ—ยังไม่ถึงขั้นขอตรวจกระเป๋านะ 😄 วันนี้เราจะฝึกบอกว่าเราและคนอื่นมีอะไรด้วย have และ has',
  fnd_v7_what_time_is_it: 'เพื่อนบอกว่าเจอกันตอนแปด แต่ถ้าเราไปถึงตอนเก้า ภาษาอังกฤษอาจไม่ใช่ปัญหาเดียวแล้วครับ 😅 วันนี้เราจะฝึกถามและบอกเวลาให้ชัดเจน',
  fnd_v7_days_and_simple_plans: 'Max อยากนัดวันฝึก แต่คนหนึ่งจำว่าวันจันทร์ อีกคนจำว่าวันศุกร์ครับ วันนี้เราจะใช้ชื่อวันที่เรียนแล้ววางแผนง่าย ๆ ให้ตรงกัน',
  fnd_v7_do_you_like_it: 'เราบอกสิ่งที่ตัวเองชอบได้แล้ว ต่อไปถึงเวลาสืบเรื่องคนอื่นบ้างครับ 🕵️ วันนี้เราจะฝึกถามและตอบว่าใครชอบอะไร',
  fnd_v7_want_need_and_please: 'อยากได้กาแฟกับต้องการความช่วยเหลือฟังคล้ายกัน แต่ความเร่งด่วนคนละเรื่องเลยครับ 😄 วันนี้เราจะแยก want กับ need และฝึกขออย่างสุภาพ',
  fnd_v7_i_can: 'Teacher B บอกว่าทำอาหารได้ครับ ส่วนรสชาติเป็นอีกเรื่องหนึ่ง 👨‍🍳😅 วันนี้เราจะฝึกบอกสิ่งที่ตัวเองทำได้ด้วย can',
  fnd_v7_cant_and_can_you: 'ทำไม่ได้ไม่ใช่เรื่องน่าอายครับ—อย่างน้อยบอกก่อนลงสระก็ดีกว่า 🏊 วันนี้เราจะฝึกบอกสิ่งที่ทำไม่ได้และถามความสามารถของอีกฝ่าย',
  fnd_v7_my_day: 'สวัสดีครับ ปกติตื่นกี่โมงครับ หรือกดเลื่อนปลุกจนโทรศัพท์ยอมแพ้? ⏰😴 วันนี้เราจะฝึกเล่ากิจวัตรประจำวันของตัวเอง',
  fnd_v7_her_day_his_day: 'เราเล่าเรื่องตัวเองได้แล้ว ต่อไปลองดูหนึ่งวันของ Ben กับ Anna กันครับ วันนี้เราจะฝึกเล่ากิจวัตรของคนอื่นด้วย he และ she',
  fnd_v7_happening_now: 'Max อ่านหนังสือเป็นประจำ แต่ตอนนี้เขากำลังกินข้าวครับ—คนละเวลาก็ใช้คนละรูปประโยค วันนี้เราจะพูดถึงสิ่งที่กำลังเกิดขึ้นตอนนี้',
  fnd_v7_are_they_working: 'ทุกคนดูยุ่งมากครับ แต่คนหนึ่งอาจทำงาน ส่วนอีกคนอาจกำลังกินอยู่ วันนี้เราจะฝึกถามและตอบว่าคนอื่นกำลังทำอะไรอยู่ตอนนี้',
  fnd_v7_there_is_there_are: 'Teacher B เพิ่งเข้าห้องใหม่และอยากรู้ว่าข้างในมีอะไรบ้างครับ วันนี้เราจะฝึกบอกว่ามีสิ่งหนึ่งหรือหลายสิ่งอยู่ในห้อง',
  fnd_v7_in_on_under_next_to: 'กุญแจหายอีกแล้วครับ ข่าวดีคือยังอยู่ในห้อง ข่าวร้ายคือคำว่า “อยู่ในห้อง” ยังกว้างไป 😅 วันนี้เราจะฝึกบอกตำแหน่งให้ละเอียดขึ้น',
  fnd_v7_where_is_it: 'มีคาเฟ่ ร้านค้า และสถานีอยู่แถวนี้ครับ แต่รู้ชื่ออย่างเดียวยังไปไม่ถูก 😅 วันนี้เราจะฝึกถามและบอกว่าสถานที่อยู่ที่ไหน',
  fnd_v7_how_do_you_go: 'สถานีอยู่ไม่ไกลครับ แต่จะไปรถเมล์ รถไฟ หรือแท็กซี่ดี? วันนี้เราจะฝึกบอกและถามวิธีเดินทางแบบง่าย ๆ',
  // These lessons are currently off the path, but remain buildable for content tooling.
  fnd_v7_letter_names_a_m: 'วันนี้เราจะฝึกชื่อเรียกตัวอักษร A ถึง M เพื่อใช้ฟังและสะกดคำภาษาอังกฤษครับ',
  fnd_v7_letter_names_n_z: 'วันนี้เราจะฝึกชื่อเรียกตัวอักษร N ถึง Z แล้วนำไปใช้ขอและฟังการสะกดคำครับ',
};

import { V7_LEGACY_FLOWS } from './foundation-v7-legacy-flows';
export interface V7TeachingStep {
  kind: 'welcome' | 'model_repeat' | 'model_group' | 'repeat' | 'choice' | 'guided_use' | 'recall' | 'complete';
  instruction: string;
  expectsUserSpeech: boolean;
  expectedSpeech?: string;
  presentation?: {
    text: string;
    successText?: string;
    incorrectHintTh?: string;
    answerMode: 'single' | 'any';
    stem: string;
    options: { emoji: string; label: string; speak: string; meaningTh?: string; recapText?: string }[];
  };
}

export function buildFoundationV7Steps(lessonId: string): V7TeachingStep[] {
  if (V7_LEGACY_FLOWS[lessonId]) return V7_LEGACY_FLOWS[lessonId];
  const spec = specs[lessonId as keyof typeof specs];
  const choice = FOUNDATION_V7_CHOICE_BEATS[lessonId];
  const pattern = FOUNDATION_V7_PATTERNS[lessonId];
  if (!spec || !choice || !pattern) throw new Error('Missing V7 authored flow: ' + lessonId);
  const steps: V7TeachingStep[] = [];
  const add = (kind: V7TeachingStep['kind'], instruction: string, expectedSpeech?: string) =>
    steps.push({ kind, instruction, expectsUserSpeech: expectedSpeech !== undefined, expectedSpeech });
  const opening = FOUNDATION_V7_OPENINGS[lessonId];
  if (!opening) throw new Error('Missing V7 authored opening: ' + lessonId);
  add('welcome', 'Open with exactly this authored Thai context and goal: ' + JSON.stringify(opening) +
    '. Do not paraphrase, add another greeting, or introduce a new question. ' +
    'No user response is required yet. expectsUserSpeech=false; expectedSpeech="".');
  spec.blocks.forEach((block, index) => {
    const teaching = 'Teach block ' + (index + 1) + ': explain briefly using this meaning cue: ' + block.tipTh +
      '. Model ALL these English forms in this same turn: ' + block.models.join(' | ') +
      '. Never split this model list across later turns.';
    const practice = 'Practise block ' + (index + 1) + ': REQUIRED microphone turn, never a tap-to-continue turn. Ask for ONE repeat; expectedSpeech=' +
      JSON.stringify(block.repeat) + '; expectsUserSpeech=true. Omit cards.';
    if (pattern === 'decode_and_use') {
      add('model_group', teaching + ' Group the number/letter codes; expectsUserSpeech=false; expectedSpeech="".');
      add('repeat', practice, block.repeat);
    } else {
      add('model_repeat', teaching + ' In this SAME turn, finish with ' + practice, block.repeat);
    }
    if (index + 1 === choice.afterBlock) {
      const first = choice.options[0];
      const board = { stem: choice.stem, ...first, options: choice.options };
      const answer = choice.answerMode === 'single'
        ? 'Only the response matching this situation is correct: ' + JSON.stringify(choice.expectedSpeech) +
          '. First miss: ' + choice.incorrectHintTh + ' Keep the same board for one retry.'
        : 'EVERY option is correct. Accept ANY option and meaningful alternatives consistent with the taught pattern. ' +
          'The default expectedSpeech is STT bias only, NEVER the sole answer key. Remember what the learner actually chose. ' +
          'Allow a fictional choice or a truthful alternative when none describes them; never require an untrue personal claim.';
      add('choice', 'Authored choice (' + choice.answerMode + '): ask exactly this meaning in the teaching language: ' +
        choice.promptTh + '. Return guidedSpeaking=' + JSON.stringify(board) +
        '; omit emojiChoice. Labels are cues, speak values are complete utterances. ' +
        'Tapping a card never completes the step by itself; require the spoken utterance. ' + answer,
        choice.expectedSpeech ?? first.speak);
    }
  });
  if (pattern === 'choose_and_reuse') {
    add('recall', 'Choice reuse: REMOVE all cards. Ask the learner to tell you their earlier chosen fact/request/question again. ' +
      'Use THEIR selected speak value as expectedSpeech, including when they chose a non-first card. Accept equivalent phrasing. ' +
      'Do not substitute a scripted preference or ask a new personal question.', choice.options[0].speak);
  } else if (pattern === 'contrast_and_apply') {
    add('guided_use', 'Guided use: ask this meaning: ' + spec.recall.promptTh +
      '. Show ONLY this short stem in the teacher bubble: ' + APPLICATION_STEMS[lessonId] +
      '. Omit choice cards and do not reveal the full answer first. Expected: ' + spec.recall.answerEn +
      '. After the attempt give a brief contextual response; no extra quiz.', spec.recall.answerEn);
  } else {
    add('recall', 'Independent recall: REMOVE all scaffolding; omit emojiChoice and guidedSpeaking. Ask: ' +
      spec.recall.promptTh + '. Do not say the answer first. Expected: ' + spec.recall.answerEn +
      (pattern === 'situation_and_respond'
        ? '. Frame it as the learner speaking to someone; acknowledge the intended request after their answer before closing.'
        : '. Read Thai numerical context in Thai; avoid TTS saying the English answer before the learner.'), spec.recall.answerEn);
  }
  // Contrast lessons finish with the successful guided application rather than repeating the same question without cards.
  const completion = 'completionTh' in spec ? spec.completionTh : spec.goalTh;
  add('complete', 'Complete: briefly name the skill practised (' + completion +
    ') and acknowledge the learner\'s actual response. Do not claim mastery or independence after a hinted answer. ' +
    'Set isLessonComplete=true, expectsUserSpeech=false, expectedSpeech="". No new task.');
  return steps;
}

export const FOUNDATION_V7_LESSON_IDS = Object.keys(specs);
export const FOUNDATION_V7_LESSONS: LessonConfig[] = Object.entries(specs).map(([lessonId, spec]) => {
  const steps = buildFoundationV7Steps(lessonId);
  const choice = FOUNDATION_V7_CHOICE_BEATS[lessonId];
  return {
    lessonId, titleEn: spec.titleEn, titleTh: spec.titleTh,
    goalEn: 'Practise ' + spec.titleEn + ' in a short everyday exchange.', goalTh: spec.goalTh,
    difficulty: 'beginner', languageMix: { thai: 70, english: 30 },
    estimatedMinutesMin: spec.estimatedMinutes[0], estimatedMinutesMax: spec.estimatedMinutes[1],
    targetPhrases: [...new Set([...spec.blocks.flatMap(block => block.models), spec.recall.answerEn, ...choice.options.map(o => o.speak)])],
    targetLabel: 'item', listenOnlyTurns: steps[0].expectsUserSpeech ? 0 : 1, progressMax: steps.length,
    maxTurns: steps.length + steps.filter(step => step.expectsUserSpeech).length + 2,
    systemInstruction: 'Foundation A1 V7: ' + spec.titleEn + '\nGoal: ' + spec.goalTh + '\nScope: ' + spec.scope +
      '\nTeaching pattern: ' + FOUNDATION_V7_PATTERNS[lessonId] + `
ALL teacher narration, praise, explanations and requests stay in the learner's selected teaching language.
Never drift into English teacher directions when teaching in Thai. English target forms remain English.
Follow Core Flow forward, one numbered step per progress milestone. A retry stays on its current milestone.
Every speaking step sets expectsUserSpeech=true and expectedSpeech. Omit cards except on the authored choice step.
Only introduce language in authored models; scaffold recombinations of taught words with the supplied stem.
Choice prompts and boards are authored: do not invent distractors or derive labels from full sentences.
For any-mode accept ALL options, not only expectedSpeech. Respond to the actual selected option and remember it.
For single-mode assess meaning in context; do not accept a distractor just because it appears on a card.
Use the authored hint on the first miss; at most one retry, then briefly model and move on. Do not praise a wrong answer.
On card-free application give a short specific hint on request/error, never a new question.
Never add a recognition quiz after every model. Do not repeat the same application question as a second test.
Treat alphabet names as letter names, not phonics; alphabet groups such as A–D are modeled together.
Do not infer pronunciation accuracy from a spelling transcript or diagnose acoustics from text.
Do not refer to an unseen image. Emojis are cues; state spatial relationships and fictional facts in the question.
Keep isLessonComplete=false until Complete. Use only existing guidedSpeaking/microphone/Continue mechanics.
Core Flow:
` + steps.map((step, i) => (i + 1) + '. ' + step.instruction + (step.presentation ? '\nAuthored payload: ' + JSON.stringify({ ...step.presentation, expectedSpeech: step.expectedSpeech, expectsUserSpeech: step.expectsUserSpeech, isLessonComplete: step.kind === 'complete' }) : '')).join('\n'),
    openingPrompt: V7_LEGACY_FLOWS[lessonId] ? 'Start at Core Flow step 1, including its microphone task and authored board. expectsUserSpeech=true. Do not add a welcome-only turn.' : 'Start ' + spec.titleEn + '. Use only the exact authored opening from Core Flow step 1. ' +
      'Do not paraphrase or add another greeting. expectsUserSpeech=false, expectedSpeech="", isLessonComplete=false. Return the existing lesson JSON schema.',
  };
});
