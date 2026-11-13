import listenDrillJson from './listen-drill.foundation-v7.json';
import type { FoundationV7Node } from './foundation-v7-path.data';

/**
 * Listen Up (easy) node per chapter: hear a sentence, then tap the words in
 * order (like clip Dictation). Sentences are the ones taught in the chapter
 * plus the questions the conversation partner asks, so the learner already
 * knows them by ear before the conversation. Optional — never blocks the path.
 */
export const LISTEN_DRILL_MIN_ITEMS = 4;

export type ListenDrillItem = {
  id: string;
  text: string;
  textTh: string;
  source: 'lesson' | 'conversation';
  speaker?: string;
};

type AuthoredItem = Omit<ListenDrillItem, 'id'>;

const authored = listenDrillJson as Record<string, AuthoredItem[]>;

type ChapterLike = {
  id: string;
  number: number;
};

const isTalkNode = (node: Pick<FoundationV7Node, 'type'>) =>
  node.type === 'conversation' || node.type === 'interactive_scenario';

/**
 * Before the chapter's closing talk block (e.g. Ch 8: conversation then the
 * Minnie interview → before the conversation). Generated optional nodes in
 * between are skipped. End of chapter when it has no talk node.
 */
export function listenDrillInsertIndex(items: readonly Pick<FoundationV7Node, 'type'>[]): number {
  let index = items.length;
  for (let i = items.length - 1; i >= 0; i--) {
    const type = items[i].type;
    if (isTalkNode(items[i])) index = i;
    else if (type === 'word_cards' || type === 'listen_drill') continue;
    else if (index < items.length) break;
  }
  return index;
}

/** The talk node the drill prepares for (its voice is used for its lines). */
export function listenDrillTalkNode<T extends Pick<FoundationV7Node, 'type'>>(
  items: readonly T[],
): T | undefined {
  const node = items[listenDrillInsertIndex(items)];
  return node && isTalkNode(node) ? node : undefined;
}

export function listenDrillNodeId(chapterId: string): string {
  return `${chapterId}_ld`;
}

export function listenDrillPoolId(chapterId: string): string {
  return `listen_drill_${chapterId}`;
}

export function listenDrillItemsForChapter(chapterId: string): ListenDrillItem[] {
  return (authored[chapterId] ?? [])
    .filter((item) => item.text?.trim() && item.textTh?.trim())
    .map((item, index) => ({
      id: `${chapterId}_ld_${index + 1}`,
      text: item.text.trim(),
      textTh: item.textTh.trim(),
      source: item.source === 'conversation' ? 'conversation' : 'lesson',
      ...(item.speaker ? { speaker: item.speaker } : {}),
    }));
}

/** Catalog-shaped node, or null when the chapter has too few sentences. */
export function listenDrillNodeForChapter(chapter: ChapterLike): FoundationV7Node | null {
  const items = listenDrillItemsForChapter(chapter.id);
  if (items.length < LISTEN_DRILL_MIN_ITEMS) return null;
  return {
    id: listenDrillNodeId(chapter.id),
    code: `${chapter.number}.L`,
    order: 0,
    globalOrder: 0,
    titleEn: 'Listen Up',
    titleTh: 'ฝึกฟัง',
    type: 'listen_drill',
    beat: 'Listen',
    learningTarget: 'ฟังประโยคของบทนี้ให้คุ้นหู ก่อนไปคุยจริง',
    activity: 'ฟังประโยค แล้วแตะคำเรียงให้ถูก',
    examples: items.slice(0, 3).map((item) => item.text),
    estimatedMinutes: [2, 3],
    difficultyAxes: [1, 1, 1, 1, 1],
    contentRef: { poolId: listenDrillPoolId(chapter.id) },
  };
}
