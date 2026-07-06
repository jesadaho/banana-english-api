export interface Topic {
  id: string;
  titleTh: string;
  titleEn: string;
  icon: string;
}

export const TOPICS: Topic[] = [
  {
    id: 'intro',
    titleTh: 'แนะนำตัวฉบับง่าย',
    titleEn: 'Simple Self Introduction',
    icon: '👋',
  },
  {
    id: 'coffee',
    titleTh: 'สั่งกาแฟที่คาเฟ่',
    titleEn: 'Ordering Coffee at a Cafe',
    icon: '☕',
  },
  {
    id: 'pets',
    titleTh: 'คุยเรื่องสัตว์เลี้ยง / เลี้ยงแมว',
    titleEn: 'Talking About Pets',
    icon: '🐱',
  },
];

export const TOPIC_CONTEXT: Record<string, string> = {
  intro: 'Banana English onboarding introduction — 3-turn script with Teacher B (ครูพี่บี).',
  coffee: 'The learner is practicing ordering coffee at a cafe in English.',
  pets: 'The learner is practicing talking about pets in English.',
};

export const BROTHER_BANANA_PERSONA = `You are Teacher B / ครูพี่บี (also known as Brother Banana), a friendly AI English teacher for Thai learners.
- Speak in simple, encouraging English (1-2 short sentences max per reply).
- Be warm, patient, and supportive — reduce learner anxiety.
- Stay on the conversation topic.
- After your English reply, always provide a natural Thai translation in textTh.`;

export const THAI_MIX_PROMPT = `The learner spoke English mixed with Thai words.
Convert their utterance into natural, correct English while preserving the meaning.
Return ONLY the corrected English sentence, nothing else.`;

export const HINTS_PROMPT = `Based on the last AI message in this conversation, generate exactly 3 short reply suggestions
the learner could say next. Each hint needs:
- id: hint_1, hint_2, hint_3
- label: short Thai label (2-4 words) describing the intent
- sentenceEn: the full English sentence to say

Return JSON matching the schema.`;

export const REPORT_PROMPT = `Summarize this English practice session for a Thai learner.
Provide encouraging feedback, one grammar tip based on their mistakes, and 3-5 useful vocab words from the conversation.
Return JSON matching the schema.`;

export function getTopic(topicId: string): Topic | undefined {
  return TOPICS.find((t) => t.id === topicId);
}

export function conversationSystemPrompt(topicId: string): string {
  const context =
    TOPIC_CONTEXT[topicId] ?? 'General English conversation practice.';
  return `${BROTHER_BANANA_PERSONA}\n\nTopic context: ${context}`;
}

export function openingUserPrompt(topicId: string): string {
  const topic = getTopic(topicId);
  const title = topic?.titleEn ?? 'English practice';
  return (
    `Start the conversation about: ${title}. ` +
    'Greet the learner warmly as Brother Banana and ask an easy opening question.'
  );
}
