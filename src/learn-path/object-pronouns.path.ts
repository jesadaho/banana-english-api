import type { FoundationV7Node } from './foundation-v7-path.data';

/**
 * Object pronouns (me / you / him / her / us / them / it) as optional
 * Foundation nodes, spread over the chapters that already have the verbs:
 * Ch 7 for + pronoun (with be), Ch 10 after like / want / need, Ch 11
 * with + pronoun and help. Each set is a lesson then a game, slotted between
 * an existing game and the next lesson so lesson/game keeps alternating.
 * Ch 10 also gets a mid-chapter Listen Up right after its lesson
 * (listen-drill.foundation-v7.json `v7_u10.mid.after`).
 */
type ExtraDef = {
  id: string;
  code: string;
  titleEn: string;
  titleTh: string;
  type: 'lesson' | 'say_it';
  learningTarget: string;
  examples: string[];
  contentRef: FoundationV7Node['contentRef'];
};

type ChapterExtras = { after: string; nodes: ExtraDef[] };

export const OBJECT_PRONOUN_EXTRAS: Readonly<Record<string, ChapterExtras>> = {
  // 7.5 Found It! (describe_it) → [lesson, say_it] → 7.6 Have & Has
  v7_u07: {
    after: 'v7_u07n04',
    nodes: [
      {
        id: 'v7_u07_op1',
        code: '7.P1',
        titleEn: 'For Me, For Her',
        titleTh: 'ของนี้ให้ใคร',
        type: 'lesson',
        learningTarget: 'บอกว่าของให้ใครด้วย for + me / him / her / us / them',
        examples: ['This is for me.', 'The bag is for her.', 'The keys are for them.'],
        contentRef: { lessonId: 'fnd_v7_for_me_for_her' },
      },
      {
        id: 'v7_u07_op2',
        code: '7.P2',
        titleEn: 'Who Is It For?',
        titleTh: 'ให้ใคร',
        type: 'say_it',
        learningTarget: 'พูดว่าของให้ใคร และแยก her bag กับ for her',
        examples: ['This hat is for him.', 'These keys are for us.'],
        contentRef: { topicId: 'fnd_v7_u07_for_whom' },
      },
    ],
  },
  // 10.9 Ask for What You Need (say_it) → [lesson, Listen Up mid, say_it] → Word Cards
  v7_u10: {
    after: 'v7_u10n06',
    nodes: [
      {
        id: 'v7_u10_op1',
        code: '10.P1',
        titleEn: 'I Like It, I Like Them',
        titleTh: 'ใช้ it / them แทนของ',
        type: 'lesson',
        learningTarget: 'ใช้ it / them แทนของ และ him / her / us / them แทนคน',
        examples: ['Yes, I like it.', 'Yes, I like them.', 'They need us.'],
        contentRef: { lessonId: 'fnd_v7_like_it_like_them' },
      },
      {
        id: 'v7_u10_op3',
        code: '10.P2',
        titleEn: 'Him, Her, Us, Them',
        titleTh: 'เขา เธอ พวกเรา พวกเขา',
        type: 'say_it',
        learningTarget: 'ใช้ him / her / us / them / it หลัง like / need',
        examples: ['I like him.', 'They need us.', "I don't like them."],
        contentRef: { topicId: 'fnd_v7_u10_him_her_them' },
      },
    ],
  },
  // 11.6 What I Can Do (say_it) → [lesson, say_it] → 11.7 Ending T
  v7_u11: {
    after: 'v7_u11n09',
    nodes: [
      {
        id: 'v7_u11_op1',
        code: '11.P1',
        titleEn: 'Help Me, Dance With Them',
        titleTh: 'ช่วยฉัน / ทำกับเพื่อน',
        type: 'lesson',
        learningTarget: 'ขอให้ช่วยด้วย help me และชวนทำกิจกรรมด้วย with me / with them',
        examples: ['Can you help me?', 'Can you swim with me?', 'We can dance with them.'],
        contentRef: { lessonId: 'fnd_v7_help_me_with_them' },
      },
      {
        id: 'v7_u11_op2',
        code: '11.P2',
        titleEn: 'Who Can Do It With Me?',
        titleTh: 'ทำกับใครได้',
        type: 'say_it',
        learningTarget: 'ใช้ with + me / him / her / us / them และ help me',
        examples: ['I can sing with her.', 'Can you cook with us?'],
        contentRef: { topicId: 'fnd_v7_u11_with_me' },
      },
    ],
  },
};

function toNode(def: ExtraDef): FoundationV7Node {
  return {
    id: def.id,
    code: def.code,
    order: 0,
    globalOrder: 0,
    titleEn: def.titleEn,
    titleTh: def.titleTh,
    type: def.type,
    beat: 'Practice',
    learningTarget: def.learningTarget,
    activity: def.type === 'lesson' ? 'เรียนกับครู แล้วพูดตาม' : 'ดูโจทย์ภาษาไทย แล้วพูดเป็นภาษาอังกฤษ',
    examples: def.examples,
    estimatedMinutes: def.type === 'lesson' ? [3, 4] : [1, 2],
    difficultyAxes: [1, 1, 1, 1, 1],
    contentRef: def.contentRef,
    // Say It sets open with three guided (tap a card) items.
    ...(def.type === 'say_it' ? { sayItMode: 'guided' as const } : {}),
  };
}

/** Every object-pronoun node, for content lookups (Say It topics, rewards). */
export const OBJECT_PRONOUN_NODES: readonly FoundationV7Node[] = Object.values(
  OBJECT_PRONOUN_EXTRAS,
).flatMap((chapter) => chapter.nodes.map(toNode));

export const OBJECT_PRONOUN_NODE_IDS: ReadonlySet<string> = new Set(
  OBJECT_PRONOUN_NODES.map((node) => node.id),
);

/** This chapter's set and the catalog node it goes after (null = none). */
export function objectPronounNodesForChapter(chapterId: string): {
  after: string;
  nodes: FoundationV7Node[];
} | null {
  const extras = OBJECT_PRONOUN_EXTRAS[chapterId];
  if (!extras) return null;
  return {
    after: extras.after,
    nodes: OBJECT_PRONOUN_NODES.filter((node) =>
      extras.nodes.some((def) => def.id === node.id),
    ),
  };
}
