import type { LessonConfig } from '../lessons/lessons.data';
import specsJson from './phonics-lessons.authoring.json';

export const PHONICS_LESSON_SPECS = specsJson;
export const PHONICS_LESSON_IDS = specsJson.map(spec => spec.lessonId);
const lessonIds = new Set(PHONICS_LESSON_IDS);
export function isPhonicsLesson(id: string): boolean { return lessonIds.has(id); }

/** These are ordinary training lessons, not deterministic mini-game quizzes. */
export const PHONICS_LESSONS: LessonConfig[] = specsJson.map(spec => {
  const board = {
    options: spec.choices.map(choice => ({
      emoji: choice.symbol,
      label: choice.word,
      speak: choice.word,
    })),
  };
  const steps = [
    `Welcome: explain today's goal, ${spec.titleEn}, briefly in the learner's teaching language. No speech request. expectsUserSpeech=false. Do not model or reveal the reserved transfer word.`,
    `Notice: explain the authored sound/spelling idea: ${spec.tipTh}. New codes: ${spec.introducedCodes.join(', ') || 'none; cumulative practice'}. Model the FIRST familiar example ${spec.models[0]} as a natural whole word. Distinguish letter names from their sounds. No question. expectsUserSpeech=false.`,
    ...spec.models.flatMap((word, i) => [
      `Model ${i + 1}: model ONLY ${word} as one natural whole word. Explain its relevant spelling-to-sound relationship using previously taught components and today's code. Do not chant alphabet names, pronounce a silent e, or insert an extra vowel between consonants. Meaning can be explained briefly. expectsUserSpeech=false.`,
      `Speak ${i + 1}: ask for ONLY ${word}. expectsUserSpeech=true, expectedSpeech="${word}". Advance after an attempt; provide one retry only if the learner asks for help. Optional visual support on this beat only: ${JSON.stringify({options:[{emoji:word,label:word,speak:word}]})}. The emoji field intentionally contains text, not pictorial emoji.`,
    ]),
    `Compare: revisit the two already modeled examples ${spec.choices.map(c => c.word).join(' and ')}. Give this optional emojiChoice board: ${JSON.stringify(board)}. Ask the learner to choose one and SAY its whole word or phrase; tapping alone is not a speaking attempt. Either option is acceptable, this is not a scored quiz. expectsUserSpeech=true, expectedSpeech="".`,
    `Try first: present the printed word ${spec.transfer} WITHOUT speaking/modeling it or showing its meaning first. Set emojiChoice={"options":[{"emoji":"${spec.transfer}","label":"${spec.transfer}","speak":"${spec.transfer}"}]}, expectedSpeech="${spec.transfer}", expectsUserSpeech=true. Spoken textEn asks only "ลองอ่านคำบนการ์ดด้วยตัวเองครับ" or its teaching-language equivalent; it MUST NOT contain the target. Do not claim pronunciation or decoding mastery from a transcript match. ${spec.lessonId.includes('_th') ? 'TH spelling alone cannot determine voicing. This is an exploratory attempt, not a right/wrong test.' : ''}`,
    `Reveal: after the attempt, model ${spec.transfer} naturally and explain its meaning and relevant spelling. This is the first tutor audio exposure to the transfer target. No question. expectsUserSpeech=false.`,
    `Read again: invite the learner to say ${spec.transfer} once more with the model now available. expectsUserSpeech=true, expectedSpeech="${spec.transfer}".`,
    `Use it model: model ${spec.phrase}, explain its meaning, then stop. A phrase is scaffolded use, not an unseen decoding test. Where present, teach the weak spoken article a as a modeled function word, not the short vowel in mat. expectsUserSpeech=false.`,
    `Use it speak: ask for exactly ${spec.phrase}. expectsUserSpeech=true, expectedSpeech="${spec.phrase}".`,
    `Complete: summarize what was practised, not what was mastered. Set isLessonComplete=true, expectsUserSpeech=false, expectedSpeech="". Clear emojiChoice. No new task or exam.`,
  ];
  return {
    lessonId: spec.lessonId, titleEn: spec.titleEn, titleTh: spec.titleTh,
    goalEn: `Read and say familiar words using ${spec.titleEn}; then try a new combination.`,
    goalTh: `${spec.titleTh} แล้วลองอ่านคำใหม่ก่อนฟังเฉลย`,
    difficulty: 'beginner', languageMix: {thai:70,english:30},
    estimatedMinutesMin: spec.estimatedMinutes[0], estimatedMinutesMax: spec.estimatedMinutes[1],
    targetPhrases: [...new Set([...spec.models, spec.transfer, spec.phrase])],
    targetLabel: 'word or short phrase', coachOnly: true, listenOnlyTurns: 2,
    progressMax: steps.length, maxTurns: steps.length * 2,
    systemInstruction: `Phonics speaking Lesson v2, ${spec.titleEn}. Teach ONE adult beginner in their chosen teaching language, not a classroom of children.
Reuse the existing Lesson JSON and Continue/microphone flow. No sorting, tile building, timed quiz, pass threshold or separate Skill Check. Visual choices are optional support for speaking.
Safety: you receive transcript text, NOT acoustic evidence. Do not judge phoneme accuracy, vowel quality/length, voicing, mouth position or accent from it. Do not call a pronunciation wrong/right or claim an improvement you cannot hear. Completion means participation. A lexical match is not a phonics mastery score. Never block the learner on isolated-phoneme STT.
Use natural whole-word TTS models in this version. Do not send raw IPA, letter-by-letter spellings, underscore patterns or Thai respellings to TTS as if they were verified phoneme audio. Isolated sounds and slow joined phoneme audio require reviewed recordings; do not pretend they were played. Written patterns such as a_e are visual descriptions, not pronounceable targets. Explain the sound via familiar words; the live audio quality needs playtesting before production.
Follow the numbered Core Flow forward. Keep tutor model audio separate from learner speaking turns. Never reveal the reserved word ${spec.transfer} in tutor text, examples, optional choices or subtitles before Try first. At Try first show it only in emojiChoice/expectedSpeech, never in spoken textEn/textTh. After the attempt reveal and model it. Do not add untaught words, sounds or exceptions as independent decoding tasks.
EmojiChoice uses {options:[{emoji,label,speak}]}; emoji MAY be a letter/string such as sh or a_e. label and speak MUST be whole words aligned to the current task, never an IPA symbol. Do not attach choices to listen-only turns. Do not invent highlighted animation, asset playback, audio buttons or a new UI. If visual support is unavailable, model then repeat and do not claim an independent reading attempt occurred.
Explain new mappings in small chunks, model and speak. Each speaking turn asks one utterance. Brief help or one retry on request, then model and advance. End listening turns without a question and expectsUserSpeech=false. Never praise a Continue button press. Keep isLessonComplete=false until Complete.
Core Flow:\n${steps.map((s,i) => `${i+1}. ${s}`).join('\n')}`,
    openingPrompt: `Welcome the learner to ${spec.titleEn} with one short goal in their teaching language. This is the Welcome step only. No target modeling, no question, no emojiChoice. expectsUserSpeech=false, expectedSpeech="", isLessonComplete=false. Use the existing Lesson JSON schema.`,
  };
});
