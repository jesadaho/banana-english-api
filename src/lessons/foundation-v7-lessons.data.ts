import type { LessonConfig } from './lessons.data';
import specs from './foundation-v7-lessons.authoring.json';

const RECOGNITION_EMOJIS = ['1️⃣', '2️⃣', '3️⃣'] as const;

function unique(items: string[]): string[] {
  return [...new Set(items)];
}

function recognitionTarget(block: { models: string[]; repeat: string }): string {
  return block.models.find((model) => model !== block.repeat) ?? block.repeat;
}

function recognitionOptions(
  blocks: Array<{ models: string[]; repeat: string }>,
  blockIndex: number,
): Array<{ emoji: string; label: string; speak: string }> {
  const target = recognitionTarget(blocks[blockIndex]);
  const distractors = unique(blocks.flatMap((block) => block.models))
    .filter((model) => model !== target)
    .slice(blockIndex % 2, blockIndex % 2 + 2);
  const choices = unique([target, ...distractors]).slice(0, 3);

  // Rotate the answer position so learners cannot pass by always choosing card 1.
  const answerPosition = blockIndex % choices.length;
  choices.splice(answerPosition, 0, choices.splice(0, 1)[0]);

  return choices.map((speak, index) => ({
    emoji: RECOGNITION_EMOJIS[index],
    label: speak,
    speak,
  }));
}

export const FOUNDATION_V7_LESSON_IDS = Object.keys(specs);
export const FOUNDATION_V7_LESSONS: LessonConfig[] = Object.entries(specs).map(([lessonId, spec]) => {
  const completionTh = 'completionTh' in spec ? spec.completionTh : undefined;
  const targets = [...new Set([...spec.blocks.flatMap(block => block.models), spec.recall.answerEn])];
  const steps = [
    `Welcome: state the practical goal in one short sentence. No question. expectsUserSpeech=false.`,
    ...spec.blocks.flatMap((block, i) => {
      const expected = recognitionTarget(block);
      const options = recognitionOptions(spec.blocks, i);
      return [
        `Teach block ${i + 1}: this is exactly ONE listen-only turn. Explain in the learner's teaching language, using this Thai meaning cue: ${block.tipTh}. Model ALL these English forms in this same turn, in order: ${block.models.join(' | ')}. Never split this model list across later turns. No speaking request on this turn. expectsUserSpeech=false and expectedSpeech="".`,
        `Practise block ${i + 1}: this is a REQUIRED microphone turn, never a tap-to-continue turn. Ask the learner to repeat exactly "${block.repeat}". Set expectedSpeech="${block.repeat}" and expectsUserSpeech=true. After a clear attempt advance to the next Core Flow step; if unclear give at most one microphone retry, then model and advance. Never turn this step into another listen-only explanation.`,
        `Recognise block ${i + 1}: give ONE tiny everyday situation in the learner's teaching language that makes "${expected}" the clearly appropriate response. Do not reveal the answer in the question. Return emojiChoice with EXACTLY these cards: ${JSON.stringify(options)}. The learner chooses a card and says its full speak value through the microphone; tapping a card never completes the step by itself. Set expectedSpeech="${expected}" and expectsUserSpeech=true. Keep this exact board on one retry.`,
      ];
    }),
    `Independent recall: REMOVE all scaffolding—omit emojiChoice and guidedSpeaking. Ask this meaning-first question in the learner's teaching language: ${spec.recall.promptTh}. Expected: "${spec.recall.answerEn}". Accept any taught equivalent with the same meaning. Give one short, target-specific hint on the first miss; after a second miss model the answer once and advance. expectsUserSpeech=true.`,
    `Complete: ${completionTh ? `say this closing in the learner's teaching language: "${completionTh}".` : 'warmly summarize one useful thing learned.'} Clearly signal that the learner succeeded. Set isLessonComplete=true, expectsUserSpeech=false and expectedSpeech="". Do not add a new task or roleplay question.`,
  ];
  return {
    lessonId, titleEn: spec.titleEn, titleTh: spec.titleTh, goalEn: `Practise ${spec.titleEn} in a short everyday exchange.`, goalTh: spec.goalTh,
    difficulty: 'beginner', languageMix: { thai: 70, english: 30 },
    estimatedMinutesMin: spec.estimatedMinutes[0], estimatedMinutesMax: spec.estimatedMinutes[1],
    targetPhrases: targets, targetLabel: 'item', listenOnlyTurns: 1,
    progressMax: steps.length, maxTurns: 2 * (steps.length + spec.blocks.length),
    systemInstruction: `Foundation A1 V7: ${spec.titleEn}\nGoal: ${spec.goalTh}\nScope: ${spec.scope}\n
Teach one adult beginner privately in their chosen teaching language. ALL teacher narration, praise, explanations and requests must stay in that teaching language for the whole lesson; English is reserved for target forms being modeled or quoted. Never drift into English teacher directions such as "Great! Now, please say..." when the teaching language is Thai. Use short explanations; no class/group address. Treat alphabet names as letter names, not phonics. Do not claim mastery after exposure or diagnose acoustics from transcript. Use fictional profiles when personal facts are requested. Describe any needed spatial context verbally; never refer to an image that was not provided.
Only the authored blocks introduce new language. Model all listed forms before practice. Do not add grammar or vocabulary outside this scope. A spelling transcript may collapse letters into a name; matching that name is a transcription convenience, not proof of each letter's pronunciation.
Follow each step FORWARD. Every numbered Core Flow step is exactly one progress milestone. Never loop to a previous block. Model and practice are separate turns; listen-only turns contain no question and set expectedSpeech="". Speaking turns ask exactly one task and must set expectsUserSpeech=true. Recognition is guided practice, not a test: use a short concrete situation, show the authored cards, and require speech after the learner chooses. Never reveal the correct card in the question. Omit every choice card on Independent recall so support visibly fades. Never split a Teach block's model list into extra turns: alphabet groups such as A–D are modeled together in one turn. Praise briefly, accept meaningful short variants, and after one retry reveal and advance. Keep isLessonComplete=false until Complete. No pass gate, timed task, invented drag board, or forced picture interaction.
Core Flow:\n${steps.map((step, i) => `${i + 1}. ${step}`).join('\n')}`,
    openingPrompt: `Start ${spec.titleEn} for this learner. Explain today's practical goal briefly in their teaching language. This is the Welcome step only: do not ask a question or start a drill. Set expectsUserSpeech=false, expectedSpeech="", isLessonComplete=false. Return the existing lesson JSON schema.`,
  };
});
