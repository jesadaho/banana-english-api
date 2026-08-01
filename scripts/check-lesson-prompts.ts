/**
 * Assert every lesson prompt builds cleanly for Thai and English modes.
 * Run: npx ts-node scripts/check-lesson-prompts.ts
 */
import { LESSONS } from '../src/lessons/lessons.data';
import {
  buildLessonSystemInstruction,
  renderOpeningPrompt,
  renderTokens,
} from '../src/lessons/lesson-prompt';
import { withTeachingLanguage } from '../src/lessons/lessons.data';

const FORBIDDEN_IN_ENGLISH = [
  '70% Thai',
  'MOSTLY THAI',
  'FORBIDDEN: full-English',
  'Use polite Thai ending words',
  'Speak approximately 70% Thai',
];

/**
 * Instructions that order the tutor to speak Thai. A Thai example is fine —
 * L1_EXAMPLE_RULE tells the model to re-express it in English — but a rule
 * saying "ALWAYS map in spoken Thai" contradicts English mode outright.
 *
 * Only the Basics course is held to this. Everyday English is still Thai-only
 * by design; its English-mode content is deliberately deferred.
 */
const THAI_DIRECTIVES = [
  /ALWAYS[^\n]*spoken Thai/,
  /Never write English-only/,
  /Thai first → English second/,
  /Thai ?→ ?English/,
  /Thai digit mapping/,
  /Thai mapper words/,
  /short Thai situations/,
  /ถ้าจะบอกว่า/,
  /ให้พูดตาม/,
];

const isBasics = (lessonId: string) =>
  !lessonId.startsWith('ee_') && !lessonId.startsWith('pron_');

let failed = 0;

for (const base of LESSONS) {
  for (const lang of ['thai', 'english'] as const) {
    const config = withTeachingLanguage(base, lang);
    const sys = buildLessonSystemInstruction(config, lang);
    const opening = renderOpeningPrompt(config, lang);

    if (sys.includes('{{') || opening.includes('{{')) {
      console.error(`[${base.lessonId}/${lang}] leftover {{ token`);
      failed++;
    }

    if (!sys.includes('Core Flow') && !sys.includes('Master Flow')) {
      // ee_about_me_review uses Master Flow
      console.error(`[${base.lessonId}/${lang}] missing Core Flow / Master Flow`);
      failed++;
    }

    if (lang === 'english') {
      for (const bad of FORBIDDEN_IN_ENGLISH) {
        if (sys.includes(bad)) {
          console.error(
            `[${base.lessonId}/english] forbidden remnant: ${JSON.stringify(bad)}`,
          );
          failed++;
        }
      }

      if (isBasics(base.lessonId)) {
        for (const rule of THAI_DIRECTIVES) {
          const hit = rule.exec(`${sys}\n${opening}`);
          if (hit) {
            console.error(
              `[${base.lessonId}/english] Thai directive leaked: ${JSON.stringify(hit[0])}`,
            );
            failed++;
          }
        }
      }
    }

    if (lang === 'thai') {
      if (!sys.includes('MOSTLY THAI') && !sys.includes('70% Thai') && !sys.includes(`${config.languageMix.thai}% Thai`)) {
        console.error(`[${base.lessonId}/thai] missing Thai language-style cue`);
        failed++;
      }
    }
  }
}

// Token renderer sanity
const sample = renderTokens('Say it in {{L1}} then {{REPEAT_CUE}}', 'english');
if (sample !== 'Say it in simple English then say it after me') {
  console.error('renderTokens english mismatch:', sample);
  failed++;
}

// Language-tagged lines: keep the active language, drop the other, preserve indent.
const tagged = ['keep me', '@thai   thai line', '@english   en line'].join('\n');
const expectThai = ['keep me', '  thai line'].join('\n');
const expectEn = ['keep me', '  en line'].join('\n');
if (renderTokens(tagged, 'thai') !== expectThai) {
  console.error('language lines (thai) mismatch:', renderTokens(tagged, 'thai'));
  failed++;
}
if (renderTokens(tagged, 'english') !== expectEn) {
  console.error(
    'language lines (english) mismatch:',
    renderTokens(tagged, 'english'),
  );
  failed++;
}

if (failed === 0) {
  console.log(`OK — ${LESSONS.length} lessons × 2 modes`);
  process.exit(0);
} else {
  console.error(`FAILED — ${failed} issue(s)`);
  process.exit(1);
}
