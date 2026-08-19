#!/usr/bin/env node
/**
 * Extract About Me lesson logic + choice-board utilities from lessons.data.ts
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const dataPath = path.join(root, 'src/lessons/lessons.data.ts');
const lines = fs.readFileSync(dataPath, 'utf8').split('\n');

function slice(start, end) {
  return lines.slice(start - 1, end).join('\n');
}

function removeRanges(ranges) {
  const drop = new Set();
  for (const [start, end] of ranges) {
    for (let i = start; i <= end; i++) drop.add(i);
  }
  return lines.filter((_, idx) => !drop.has(idx + 1));
}

function dedupeBuildGuidedSpeakingFromBoard(source) {
  const dup = source.indexOf('function buildGuidedSpeakingFromBoard', 200);
  if (dup <= 0) return source;
  const end = source.indexOf('\n}', dup) + 2;
  return source.slice(0, dup) + source.slice(end);
}

let choiceBoardBody = slice(9070, 9611);
choiceBoardBody = choiceBoardBody.replace(
  'function forceGuidedBoardSoftTeachIfNeeded(',
  'export function forceGuidedBoardSoftTeachIfNeeded(',
);
choiceBoardBody = choiceBoardBody.replace(
  'function resolveForcedBoardTextEn(',
  'export function resolveForcedBoardTextEn(',
);
choiceBoardBody = choiceBoardBody.replace(
  /ReturnType<typeof normalizeGuidedSpeaking>/g,
  'GuidedSpeakingCard',
);

const choiceBoardHeader = `import type { LessonTeachingLanguage } from './lesson-teaching';

/** Normalized Guided Speaking card shape (matches normalizeGuidedSpeaking output). */
export type GuidedSpeakingCard = {
  stem: string;
  emoji: string;
  label?: string;
  speak: string;
  options?: Array<{ emoji: string; label?: string; speak: string }>;
};

function buildGuidedSpeakingFromBoard(
  board: ForcedGuidedBoard,
): GuidedSpeakingCard {
  const first = board.options[0];
  const options = board.options.map((o) => ({ ...o }));
  if (options.length === 1) {
    return {
      stem: board.stem,
      emoji: first.emoji,
      speak: first.speak,
      ...(first.label ? { label: first.label } : {}),
    };
  }
  return {
    stem: board.stem,
    emoji: first.emoji,
    speak: first.speak,
    ...(first.label ? { label: first.label } : {}),
    options,
  };
}

`;

const choiceBoardPath = path.join(root, 'src/lessons/choice-board.ts');
fs.writeFileSync(
  choiceBoardPath,
  dedupeBuildGuidedSpeakingFromBoard(choiceBoardHeader + choiceBoardBody + '\n'),
);

const aboutMeBody = [
  slice(11219, 15370),
  '',
  slice(15483, 15750),
  '',
  slice(18585, 18821),
  '',
  slice(18828, 18861),
].join('\n');

const aboutMeHeader = `import {
  aroundTownRoleplayIntroSpeech,
  looksLikeAroundTownRoleplayBridge,
  normalizeGuidedSpeaking,
} from '../../lessons/lessons.data';
import {
  type ChoiceStepTier,
  type ForcedGuidedBoard,
  computeThreeTierChoiceProgress,
  createBoardChoiceScorer,
  forceGuidedBoardSoftTeachIfNeeded,
  looksLikeSoftTeachReveal,
  pendingThreeTierSoftTeach,
  resolveBoardTextEn,
  resolveForcedBoardTextEn,
} from '../../lessons/choice-board';
import type { LessonTeachingLanguage } from '../../lessons/lesson-teaching';

type AroundTownIntroForceResult = {
  textEn: string;
  textTh: string | null;
  expectsUserSpeech: false;
  expectedSpeech: null;
  roleplayIntro: unknown;
  roleplayNpc: null;
  guidedSpeaking: null;
  emojiChoice: null;
  isTaskComplete: false;
};

function aroundTownIntroAlreadyShown(
  history: Array<{
    speaker: string;
    roleplayIntro?: unknown;
    roleplayNpc?: unknown;
  }>,
): boolean {
  return history.some(
    (t) =>
      t.speaker === 'ai' &&
      (t.roleplayIntro != null || t.roleplayNpc != null),
  );
}

function latestShoppingLookingForUserText(
  history: Array<{ speaker: string; textEn?: string }>,
): string | null {
  for (let i = history.length - 1; i >= 0; i--) {
    const t = history[i];
    if (t?.speaker !== 'user') continue;
    const text = (t.textEn ?? '').trim();
    if (text) return text;
  }
  return null;
}

function historyHasFavoritesGroupStepCue(
  history: Array<{
    speaker: string;
    textEn?: string;
    roleplayNpc?: unknown;
  }>,
): boolean {
  return history.some((t) => {
    if (t.speaker !== 'ai' || t.roleplayNpc != null) return false;
    const text = t.textEn ?? '';
    const lower = text.toLowerCase();
    return (
      text.includes('กินด้วยกัน') ||
      lower.includes('eat together') ||
      (lower.includes('do you') && lower.includes('together'))
    );
  });
}

function satisfiesFavoritesGroupAnswer(userText: string): boolean {
  const t = userText
    .trim()
    .toLowerCase()
    .replace(/[.!?]+$/g, '')
    .replace(/\s+/g, ' ');
  if (!t) return false;
  return (
    t.includes('we ') ||
    t.includes('eat together') ||
    t.includes('watch movies') ||
    /^(yes|yeah|yep|we do)\b/.test(t)
  );
}

function matchesExactFromScorer(
  scoreStep: (step: number, text: string) => ChoiceStepTier,
): (step: number, text: string) => boolean {
  return (step, text) => scoreStep(step, text) === 'exact';
}

`;

const aboutMePath = path.join(root, 'src/training/about-me/about-me.lessons.ts');
fs.mkdirSync(path.dirname(aboutMePath), { recursive: true });
fs.writeFileSync(aboutMePath, aboutMeHeader + aboutMeBody + '\n');

const lessonTeachingPath = path.join(root, 'src/lessons/lesson-teaching.ts');
fs.writeFileSync(
  lessonTeachingPath,
  `import type { LessonLanguageMix } from './lessons.data';

export type LessonTeachingLanguage = 'thai' | 'english';

export const LESSON_TEACHING_LANGUAGE_MIX: Record<
  LessonTeachingLanguage,
  LessonLanguageMix
> = {
  thai: { thai: 70, english: 30 },
  english: { thai: 15, english: 85 },
};

export function normalizeLessonTeachingLanguage(
  value: string | undefined | null,
): LessonTeachingLanguage {
  return value === 'english' ? 'english' : 'thai';
}
`,
);

const indexPath = path.join(root, 'src/training/about-me/index.ts');
fs.writeFileSync(
  indexPath,
  `export * from './about-me.lessons';\nexport * from './registry';\n`,
);

const registrySrc = path.join(root, 'src/training/scripts/about-me.registry.ts');
let registry = fs.readFileSync(registrySrc, 'utf8');
registry = registry.replace(
  /from '\.\.\/\.\.\/lessons\/lessons\.data'/,
  "from './about-me.lessons'",
);
registry = registry.replace(
  "from './choice-lesson.script'",
  "from '../scripts/choice-lesson.script'",
);
registry = registry.replace(
  /^\s*aroundTownRoleplayIntroSpeech,\n/m,
  '',
);
registry = registry.replace(
  "import type { ScriptTurnResult } from './types'",
  "import type { ScriptTurnResult } from '../scripts/types'",
);
registry = registry.replace(
  "import {\n  buildDailyRoutineScriptedReplyFromProgress",
  "import { aroundTownRoleplayIntroSpeech } from '../../lessons/lessons.data';\nimport {\n  buildDailyRoutineScriptedReplyFromProgress",
);
fs.writeFileSync(path.join(root, 'src/training/about-me/registry.ts'), registry);

fs.writeFileSync(registrySrc, "export * from '../about-me/registry';\n");

const removed = removeRanges([
  [9070, 9611],
  [11219, 15370],
  [15483, 15750],
  [18454, 18468],
  [18585, 18821],
  [18828, 18861],
]);

const importBlock = `import type { LessonTeachingLanguage } from './lesson-teaching';
import {
  LESSON_TEACHING_LANGUAGE_MIX,
  normalizeLessonTeachingLanguage,
} from './lesson-teaching';
import { buildSoftTeachRevealLine } from './choice-board';

`;

const firstLine = removed[0];
const insertAt =
  firstLine === 'export type LessonDifficulty = ' ||
  removed.findIndex((l) => l.startsWith('export type LessonDifficulty')) === 0
    ? 0
    : 0;
const withImports =
  insertAt === 0
    ? [importBlock + removed[0], ...removed.slice(1)]
    : removed;

const reexportBlock = `
// --- Refactored: choice boards + About Me lesson scripts ---
export type { LessonTeachingLanguage } from './lesson-teaching';
export {
  normalizeLessonTeachingLanguage,
  LESSON_TEACHING_LANGUAGE_MIX,
} from './lesson-teaching';
export * from './choice-board';
export * from '../training/about-me';
`;

fs.writeFileSync(dataPath, withImports.join('\n') + reexportBlock + '\n');

console.log('Refactor extract complete.');
