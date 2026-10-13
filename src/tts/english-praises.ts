import catalog from '../learn-path/foundation-v7-path.catalog.json';
import { canonicalFoundationV7LessonId } from '../lessons/foundation-v7-lesson-id-aliases';

/** Praise clips for Foundation lessons in chapters 2–7. */
export const ENGLISH_PRAISES = ['Good!', 'Great!', 'Excellent!'] as const;

/** Praise clips from Chapter 8 on, after the Nice / Perfect / Well done pack. */
export const LATER_ENGLISH_PRAISES = ['Nice!', 'Perfect!', 'Well done!'] as const;

/** Short praises synthesized without the teacher style prompt. */
export const BARE_PRAISE_LINES = [...ENGLISH_PRAISES, ...LATER_ENGLISH_PRAISES] as const;

export type EnglishPraise =
  | (typeof ENGLISH_PRAISES)[number]
  | (typeof LATER_ENGLISH_PRAISES)[number];

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

/** Stable pick so the same turn hears the same word, and the three words all appear. */
export function englishPraiseFor(seed: string, lessonId?: string): EnglishPraise {
  const canonical = lessonId ? canonicalFoundationV7LessonId(lessonId) : '';
  const set = LATER_PRAISE_LESSONS.has(canonical)
    ? LATER_ENGLISH_PRAISES
    : ENGLISH_PRAISES;
  let hash = 0;
  for (const char of seed) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return set[hash % set.length];
}
