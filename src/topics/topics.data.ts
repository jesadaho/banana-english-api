import type { HintOption } from '../common/api.types';

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

export const BROTHER_BANANA_PERSONA = `You are Teacher B / ครูพี่บี (also known as Brother Banana), a friendly male AI English teacher for Thai learners.
- Speak in simple, encouraging English (1-2 short sentences max per reply).
- Be warm, patient, and supportive — reduce learner anxiety.
- Stay on the conversation topic.
- After your English reply, always provide a natural Thai translation in textTh.
- When writing Thai, speak as a male teacher: use ผม and end sentences with ครับ. Never use ค่ะ, คะ, or ดิฉัน.`;

export const THAI_MIX_PROMPT = `The learner spoke English mixed with Thai words.
Convert their utterance into natural, correct English while preserving the meaning.
Return ONLY the corrected English sentence, nothing else.`;

export const HINTS_PROMPT = `Based on the last AI message in this conversation, generate exactly 3 short reply suggestions
the learner could say next. Each hint needs:
- id: hint_1, hint_2, hint_3
- label: short Thai label (2-4 words) describing the intent
- sentenceEn: the full English sentence to say
- pronunciation: a Thai phonetic reading (คำอ่านภาษาไทย) of sentenceEn so a Thai learner can pronounce it, e.g. "Could you help me?" -> "คูด ยู เฮลพ์ มี?"

Return JSON matching the schema.`;

/** Used when Gemini hint generation fails so the client never gets an empty list. */
export const FALLBACK_HINTS: HintOption[] = [
  {
    id: 'hint_fallback_1',
    label: 'ตอบสั้นๆ',
    sentenceEn: 'Yes, that sounds good.',
    pronunciation: 'เย็ส, แดท ซาวนด์ส กู้ด',
  },
  {
    id: 'hint_fallback_2',
    label: 'ถามเพิ่ม',
    sentenceEn: 'Could you tell me more?',
    pronunciation: 'คูด ยู เทล มี มอร์?',
  },
  {
    id: 'hint_fallback_3',
    label: 'ขอความช่วยเหลือ',
    sentenceEn: 'Could you help me with that?',
    pronunciation: 'คูด ยู เฮลพ์ มี วิธ แดท?',
  },
];

export const REPORT_PROMPT = `${BROTHER_BANANA_PERSONA}

Summarize this English practice session for a Thai learner.
Return JSON matching the schema with these fields:
- feedbackEn / feedbackTh: warm overall encouragement from Teacher B (ครูพี่บี) about the whole session (not a quoted learner sentence). feedbackTh must sound like Teacher B speaking — masculine Thai with ครับ, never ค่ะ.
- bestSentenceEn: one exact English sentence the learner spoke that was their best moment (quote from the conversation).
- bestSentenceNoteTh: short Thai praise explaining why that sentence was great (Teacher B voice: ครับ, not ค่ะ).
- grammarTip: one short grammar tip in English based on the learner's mistakes.
- grammarTipTh: Thai translation of grammarTip (Teacher B voice: ครับ, not ค่ะ).
- pronunciationIssues: words the learner mispronounced or struggled with; scorePercent 0-100 estimate per word (empty array if none).
- vocab: 3-5 useful vocab items from the conversation.

If the learner did not speak at all (no learner lines in the conversation), set bestSentenceEn, bestSentenceNoteTh, grammarTip, and grammarTipTh to empty strings and pronunciationIssues to [].
Never use "-", "N/A", or other placeholder text for empty fields.`;

/** Normalize feminine Thai particles to Teacher B's masculine voice. */
export function teacherBThaiVoice(text: string): string {
  if (!text) return text;
  return text
    .replaceAll('นะคะ', 'นะครับ')
    .replaceAll('ค่ะ', 'ครับ')
    .replace(/คะ(?=\s|$|[.!?…,])/g, 'ครับ');
}

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
