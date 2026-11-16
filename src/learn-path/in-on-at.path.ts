import { inOnAtTopicById, type InOnAtTopicId } from '../in-on-at/in-on-at.data';
import type { FoundationV7Node } from './foundation-v7-path.data';

type ChapterLike = { id: string; number: number };

/**
 * in · on · at practice nodes in the Foundation path (optional, end of the
 * chapter that uses the words): Time after Ch 12 (in the morning, at night,
 * on Monday), Place after Ch 16 (in the bag, on the table).
 */
export const IN_ON_AT_PATH_TOPICS: Readonly<Record<string, InOnAtTopicId>> = {
  v7_u12: 'time',
  v7_u15: 'place',
};

export function inOnAtNodeForChapter(chapter: ChapterLike): FoundationV7Node | null {
  const topicId = IN_ON_AT_PATH_TOPICS[chapter.id];
  const topic = topicId ? inOnAtTopicById(topicId) : undefined;
  if (!topicId || !topic) return null;
  return {
    id: `${chapter.id}_ioa`,
    code: `${chapter.number}.P`,
    order: 0,
    globalOrder: 0,
    titleEn: 'in · on · at',
    titleTh: 'in · on · at',
    type: 'in_on_at',
    beat: 'Practice',
    learningTarget:
      topicId === 'time'
        ? 'ใช้ in / on / at กับเวลาให้ถูก (in the morning, on Monday, at 7)'
        : 'ใช้ in / on / at กับสถานที่ให้ถูก (in the bag, on the table, at home)',
    activity: 'ดูโจทย์ แล้วพูด in / on / at ให้ถูก',
    examples:
      topicId === 'time'
        ? ['in the morning', 'on Monday', 'at night']
        : ['in the bag', 'on the table', 'at home'],
    estimatedMinutes: [2, 3],
    difficultyAxes: [1, 1, 1, 1, 1],
    contentRef: { topicId },
  };
}
