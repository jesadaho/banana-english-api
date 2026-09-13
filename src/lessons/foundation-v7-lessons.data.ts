import type { LessonConfig } from './lessons.data';
import specs from './foundation-v7-lessons.authoring.json';

export const FOUNDATION_V7_LESSON_IDS = Object.keys(specs);
export const FOUNDATION_V7_LESSONS: LessonConfig[] = Object.entries(specs).map(([lessonId, spec]) => {
  const targets = [...new Set([...spec.blocks.flatMap(block => block.models), spec.recall.answerEn])];
  const steps = [
    `Welcome: state the practical goal in one short sentence. No question. expectsUserSpeech=false.`,
    ...spec.blocks.flatMap((block, i) => [
      `Teach block ${i + 1}: explain in the learner's teaching language, using this Thai meaning cue: ${block.tipTh}. Model ONLY these English forms, one at a time: ${block.models.join(' | ')}. No speaking request on this turn. expectsUserSpeech=false.`,
      `Practise block ${i + 1}: ask the learner to repeat exactly "${block.repeat}". Set expectedSpeech to that target and expectsUserSpeech=true. After a clear attempt advance; if unclear give at most one retry, then model and advance.`,
    ]),
    `Transfer: ask this meaning-first question (translate it to the teaching language if needed): ${spec.recall.promptTh}. Expected: "${spec.recall.answerEn}". Accept any taught equivalent with the same meaning. Give a short hint on request; at most one retry. expectsUserSpeech=true.`,
    `Complete: warmly summarize one useful thing learned, set isLessonComplete=true, expectsUserSpeech=false and expectedSpeech="". Do not add a new task.`,
  ];
  return {
    lessonId, titleEn: spec.titleEn, titleTh: spec.titleTh, goalEn: `Practise ${spec.titleEn} in a short everyday exchange.`, goalTh: spec.goalTh,
    difficulty: 'beginner', languageMix: { thai: 70, english: 30 },
    estimatedMinutesMin: spec.estimatedMinutes[0], estimatedMinutesMax: spec.estimatedMinutes[1],
    targetPhrases: targets, targetLabel: 'item', listenOnlyTurns: 1,
    progressMax: steps.length, maxTurns: 2 * (steps.length + spec.blocks.length),
    systemInstruction: `Foundation A1 V7: ${spec.titleEn}\nGoal: ${spec.goalTh}\nScope: ${spec.scope}\n
Teach one adult beginner privately in their chosen teaching language. English target models remain English. Use short explanations; no class/group address. Treat alphabet names as letter names, not phonics. Do not claim mastery after exposure or diagnose acoustics from transcript. Use fictional profiles when personal facts are requested. Describe any needed spatial context verbally; never refer to an image that was not provided.
Only the authored blocks introduce new language. Model all listed forms before practice. Do not add grammar or vocabulary outside this scope. A spelling transcript may collapse letters into a name; matching that name is a transcription convenience, not proof of each letter's pronunciation.
Follow each step FORWARD. Never loop to a previous block. Model and practice are separate turns; listen-only turns contain no question and set expectedSpeech="". Speaking turns ask exactly one task. Praise briefly, accept meaningful short variants, and after one retry reveal and advance. Keep isLessonComplete=false until Complete. No pass gate, timed task, invented drag board, or forced picture interaction.
Core Flow:\n${steps.map((step, i) => `${i + 1}. ${step}`).join('\n')}`,
    openingPrompt: `Start ${spec.titleEn} for this learner. Explain today's practical goal briefly in their teaching language. This is the Welcome step only: do not ask a question or start a drill. Set expectsUserSpeech=false, expectedSpeech="", isLessonComplete=false. Return the existing lesson JSON schema.`,
  };
});
