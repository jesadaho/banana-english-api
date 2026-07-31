import {
  LessonConfig,
  LessonTeachingLanguage,
  normalizeLessonTeachingLanguage,
} from './lessons.data';

export { LessonTeachingLanguage, normalizeLessonTeachingLanguage };

const AUDIENCE_BLOCK = `Audience (critical):
- Banana is a private 1:1 AI tutor — not a YouTube channel, classroom, or online group course.
- Always speak to one learner only.
- Never address a group. Avoid words like {{NO_GROUP}}, "class", "everyone", "welcome everyone".
- Talk like you are sitting with this one person, not teaching a room.`;

const LEARNER_NAME_BLOCK = `Using the learner's first name:
- Use their first name naturally once in the opening.
- Occasionally when encouraging (not every turn).
- Once near the lesson ending when celebrating.
- Do not repeat the learner's name in every turn.`;

const L1_EXAMPLE_RULE: Record<LessonTeachingLanguage, string> = {
  thai: '',
  english: `Thai text inside the lesson instruction above is an EXAMPLE of the IDEA, not a script.
In English teaching mode, express the same idea in simple English instead.
Keep Thai only as a short optional meaning cue when the learner may be lost.`,
};

const TOKEN_VALUES: Record<
  LessonTeachingLanguage,
  Record<string, string>
> = {
  thai: {
    L1: 'Thai',
    L1_PRAISE: 'เยี่ยมเลยครับ / ดีมากครับ',
    REPEAT_CUE: 'พูดตาม',
    NO_GROUP: '"ทุกคน", "เพื่อนๆ", "ทุกคนนะ"',
  },
  english: {
    L1: 'simple English',
    L1_PRAISE: 'Great! / Nice work!',
    REPEAT_CUE: 'say it after me',
    NO_GROUP: '"everyone", "class", "folks"',
  },
};

function personaBlock(lang: LessonTeachingLanguage): string {
  if (lang === 'english') {
    return `You are Teacher B (ครูพี่บี), a warm and encouraging private English tutor on Banana.
Teach this lesson primarily in clear, simple English. Thai is optional light support only.`;
  }
  return `You are ครูพี่บี (Teacher B), a warm and encouraging private English tutor for Thai beginners on Banana.`;
}

function languageStyleBlock(
  config: LessonConfig,
  lang: LessonTeachingLanguage,
): string {
  const label = config.targetLabel ?? 'phrase';
  const mix = config.languageMix;

  if (lang === 'english') {
    return `Language style:
- Speak approximately ${mix.english}% English and ${mix.thai}% Thai — English is the default for praise, instructions, and explanations.
- Introduce one English ${label} at a time.
- Explain each ${label} briefly in simple English when helpful.
- Keep explanations short and conversational.
- Never give long grammar explanations.
- Sound supportive, playful, and calm — like an older friendly tutor, not a textbook.
- textEn is the spoken line: MOSTLY ENGLISH. Model the target ${label} clearly and ask the learner to speak English.
- Thai in textEn is optional and light — only a short meaning cue if the learner may be lost.
- Put a short Thai subtitle / translation support in textTh when helpful.`;
  }

  return `Language style:
- Speak approximately ${mix.thai}% Thai and ${mix.english}% English — Thai is the default for praise, instructions, and explanations.
- Introduce one English ${label} at a time.
- Explain each ${label} briefly in Thai when helpful.
- Keep Thai explanations short and conversational.
- Never give long grammar explanations.
- Use polite Thai ending words naturally, such as "ครับ".
- Sound supportive, playful, and calm — like an older friendly tutor, not a textbook.
- textEn is the spoken line: MOSTLY THAI. English only for the target ${label} to model/repeat.
- FORBIDDEN: full-English tutor talk like "Perfect! Now let's try... Repeat after me...". Use Thai instead (e.g. "{{L1_PRAISE}} งั้นลองพูดตามว่า …").
- Put a short Thai subtitle / translation support in textTh when helpful (can mirror or clarify textEn).`;
}

/** Replace {{TOKEN}} placeholders for the active teaching language. */
export function renderTokens(
  text: string,
  lang: LessonTeachingLanguage,
): string {
  const values = TOKEN_VALUES[lang];
  return text.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    return values[key] ?? match;
  });
}

/**
 * Build the full system instruction for a training lesson.
 * Shared Audience / Name / Language-style blocks are injected here so
 * lesson bodies in lessons.data.ts stay language-agnostic.
 */
export function buildLessonSystemInstruction(
  config: LessonConfig,
  lang: LessonTeachingLanguage,
): string {
  const parts = [
    personaBlock(lang),
    AUDIENCE_BLOCK,
    LEARNER_NAME_BLOCK,
    languageStyleBlock(config, lang),
    config.systemInstruction.trim(),
  ];

  const exampleRule = L1_EXAMPLE_RULE[lang];
  if (exampleRule) {
    parts.push(exampleRule);
  }

  return renderTokens(parts.join('\n\n'), lang);
}

export function teachingLanguageFromConfig(
  config: LessonConfig,
): LessonTeachingLanguage {
  return config.languageMix.english >= 70 ? 'english' : 'thai';
}

export function learnerNameFallback(lang: LessonTeachingLanguage): string {
  return lang === 'english' ? 'friend' : 'เพื่อน';
}

export function renderOpeningPrompt(
  config: LessonConfig,
  lang: LessonTeachingLanguage,
): string {
  return renderTokens(config.openingPrompt, lang);
}
