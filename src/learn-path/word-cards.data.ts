import { emojiSpeakPoolById } from '../emoji-speak/emoji-speak.data';
import { newWordsPoolById } from '../new-words/new-words.data';
import type { FoundationV7Node } from './foundation-v7-path.data';

/**
 * Word Cards review node at the end of each chapter: memorise emoji cards,
 * then say the word of the one that stays. Words come from the chapter's
 * New Words + Emoji Speak packs. Optional — never blocks the path.
 */
export const WORD_CARDS_MIN_WORDS = 4;

export type WordCardItem = {
  emoji: string;
  answer: string;
  meaningTh: string;
  acceptedAnswers: string[];
};

type ChapterLike = {
  id: string;
  number: number;
  items: readonly FoundationV7Node[];
};

export function wordCardsNodeId(chapterId: string): string {
  return `${chapterId}_wc`;
}

export function wordCardsPoolId(chapterId: string): string {
  return `word_cards_${chapterId}`;
}

/** New Words + Emoji Speak words of the chapter, first occurrence wins. */
export function wordCardsItemsForChapter(chapter: ChapterLike): WordCardItem[] {
  const byAnswer = new Map<string, WordCardItem>();
  for (const node of chapter.items) {
    const poolId = node.contentRef.poolId;
    if (!poolId) continue;
    const cards =
      node.type === 'new_words'
        ? newWordsPoolById(poolId)?.items ?? []
        : node.type === 'emoji_speak'
          ? emojiSpeakPoolById(poolId)?.items ?? []
          : [];
    for (const card of cards) {
      const answer = card.answer?.trim();
      const emoji = card.emoji?.trim();
      const meaningTh = card.meaningTh?.trim();
      if (!answer || !emoji || !meaningTh) continue;
      const key = answer.toLowerCase();
      if (byAnswer.has(key)) continue;
      byAnswer.set(key, {
        emoji,
        answer,
        meaningTh,
        acceptedAnswers: [answer, ...(card.acceptedAnswers ?? [])],
      });
    }
  }
  return [...byAnswer.values()];
}

/** Catalog-shaped node, or null when the chapter has too few words. */
export function wordCardsNodeForChapter(chapter: ChapterLike): FoundationV7Node | null {
  const items = wordCardsItemsForChapter(chapter);
  if (items.length < WORD_CARDS_MIN_WORDS) return null;
  return {
    id: wordCardsNodeId(chapter.id),
    code: `${chapter.number}.R`,
    order: 0,
    globalOrder: 0,
    titleEn: 'Word Cards',
    titleTh: 'ทวนคำศัพท์',
    type: 'word_cards',
    beat: 'Review',
    learningTarget: 'ทวนคำศัพท์ของบทนี้',
    activity: 'จำการ์ดอีโมจิ แล้วพูดคำของใบที่ถูกเลือก',
    examples: items.slice(0, 3).map((item) => item.answer),
    estimatedMinutes: [2, 3],
    difficultyAxes: [1, 1, 1, 1, 1],
    contentRef: { poolId: wordCardsPoolId(chapter.id) },
  };
}

/**
 * Index in the chapter where the review goes: just before the closing
 * conversation / scenario, else at the end.
 */
export function wordCardsInsertIndex(items: readonly FoundationV7Node[]): number {
  for (let i = items.length - 1; i >= 0; i--) {
    const type = items[i].type;
    if (type === 'conversation' || type === 'interactive_scenario') return i;
  }
  return items.length;
}
