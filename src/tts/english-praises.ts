import catalog from '../learn-path/foundation-v7-path.catalog.json';
import { canonicalFoundationV7LessonId } from '../lessons/foundation-v7-lesson-id-aliases';

/**
 * Short praise clips played on correct answers (separate audio from the body).
 * Each pool is 50/50 English / Thai so learners hear both.
 *
 * Thai lines stay short and calm with ครับ — avoid punchy “acting” openers.
 */

/** Chapters 2–7 — 3 EN + 3 TH. */
export const ENGLISH_PRAISES = ['Good!', 'Great!', 'Excellent!'] as const;
export const THAI_PRAISES = ['ดีมากครับ', 'เยี่ยมมากครับ', 'ถูกต้องครับ'] as const;
export const EARLY_PRAISES = [...ENGLISH_PRAISES, ...THAI_PRAISES] as const;

/** Chapter 8+ — 3 EN + 3 TH. */
export const LATER_ENGLISH_PRAISES = ['Nice!', 'Perfect!', 'Well done!'] as const;
export const LATER_THAI_PRAISES = ['ดีมากครับ', 'เยี่ยมมากครับ', 'เยี่ยมครับ'] as const;
export const LATER_PRAISES = [...LATER_ENGLISH_PRAISES, ...LATER_THAI_PRAISES] as const;

/** Adventure A2 — 3 EN + 3 TH. */
export const A2_ENGLISH_PRAISES = ["That's right!", 'Very good!', 'Excellent!'] as const;
export const A2_THAI_PRAISES = ['ดีมากครับ', 'เยี่ยมมากครับ', 'ถูกต้องครับ'] as const;
export const A2_PRAISES = [...A2_ENGLISH_PRAISES, ...A2_THAI_PRAISES] as const;

/** All praise lines that must be in the TTS bank (teacher voice). */
export const BARE_PRAISE_LINES = [
  ...new Set<string>([...EARLY_PRAISES, ...LATER_PRAISES, ...A2_PRAISES]),
] as const;

export type EnglishPraise = (typeof EARLY_PRAISES)[number] | (typeof LATER_PRAISES)[number];
export type A2EnglishPraise = (typeof A2_PRAISES)[number];

type Catalog = {
  chapters: Array<{
    number: number;
    items: Array<{ type: string; contentRef?: { lessonId?: string } }>;
  }>;
};

const LATER_PRAISE_LESSONS = new Set(
  (catalog as Catalog).chapters
    .filter((chapter) => chapter.number >= 8)
    .flatMap((chapter) =>
      chapter.items.flatMap((item) =>
        item.type === 'lesson' && item.contentRef?.lessonId
          ? [item.contentRef.lessonId]
          : [],
      ),
    ),
);

function hashSeed(seed: string): number {
  let hash = 0;
  for (const char of seed) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return hash;
}

/** Stable pick from the 50/50 EN+TH pool for this lesson's chapter band. */
export function englishPraiseFor(seed: string, lessonId?: string): EnglishPraise {
  const canonical = lessonId ? canonicalFoundationV7LessonId(lessonId) : '';
  const set = LATER_PRAISE_LESSONS.has(canonical) ? LATER_PRAISES : EARLY_PRAISES;
  return set[hashSeed(seed) % set.length];
}

/** Stable A2 praise pick (EN+TH 50/50). */
export function a2EnglishPraiseFor(seed: string): A2EnglishPraise {
  return A2_PRAISES[hashSeed(seed) % A2_PRAISES.length];
}
