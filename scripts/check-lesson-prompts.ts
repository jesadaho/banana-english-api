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

if (failed === 0) {
  console.log(`OK — ${LESSONS.length} lessons × 2 modes`);
  process.exit(0);
} else {
  console.error(`FAILED — ${failed} issue(s)`);
  process.exit(1);
}
