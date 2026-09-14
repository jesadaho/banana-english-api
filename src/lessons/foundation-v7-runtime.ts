import type { TrainingTurnReply } from '../gemini/gemini-chat.service';
import type { TrainingEngineTurnInput } from '../training/engine/training-turn.engine';
import type { TrainingAiGate } from '../training/engine/ai-gate';
import { scriptedAiDebug } from '../common/ai-debug';
import { buildFoundationV7Steps } from './foundation-v7-lessons.data';
import { FOUNDATION_V7_CHOICE_BEATS } from './foundation-v7-choice-beats.data';
import specs from './foundation-v7-lessons.authoring.json';
import { userTurnWasContinue } from './foundation-v7-turn-guard';

const normalize = (value: string) => value.toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]/g, '');
const OFF_TOPIC_PROBES = new Set(['goodmorning', 'hellothere']);

/** PoolGate off-topic probes must stay incorrect even if Gemini likes the English. */
export function isFoundationV7OffTopicProbe(
  userText: string,
  expected?: string | null,
): boolean {
  const got = normalize(userText);
  if (!got || !OFF_TOPIC_PROBES.has(got)) return false;
  return got !== normalize(expected ?? '');
}
export function renderV7Turn(id: string, stepNumber: number, chosen?: string): TrainingTurnReply {
  const spec = specs[id as keyof typeof specs];
  const steps = buildFoundationV7Steps(id);
  const index = Math.min(Math.max(stepNumber - 1, 0), steps.length - 1);
  const step = steps[index];
  const choice = FOUNDATION_V7_CHOICE_BEATS[id];
  const blockIndex = steps.slice(0, index + 1).filter(s => s.kind === 'model_repeat' || s.kind === 'model_group').length - 1;
  const block = spec.blocks[blockIndex];
  let text = '';
  let expected = step.expectedSpeech;
  let board: TrainingTurnReply['guidedSpeaking'];
  if (step.kind === 'welcome') text = 'วันนี้เราจะฝึก' + spec.goalTh + 'ครับ';
  if (step.kind === 'model_repeat' || step.kind === 'model_group') {
    text = block.tipTh + 'ครับ ' + block.models.join(' · ');
    if (step.kind === 'model_repeat') text += ' ลองพูดตามว่า “' + block.repeat + '” ครับ';
  }
  if (step.kind === 'repeat') text = 'ลองพูดตามว่า “' + block.repeat + '” ครับ';
  if (step.kind === 'choice') {
    text = choice.promptTh + 'ครับ เลือกคำช่วยแล้วพูดผ่านไมค์ครับ';
    board = { stem: choice.stem, ...choice.options[0], options: choice.options.map(o => ({ ...o })) };
    expected = choice.expectedSpeech ?? choice.options[0].speak;
  }
  if (step.kind === 'guided_use') {
    const stem = step.instruction.split('teacher bubble: ')[1]?.split('. Omit choice')[0] ?? '';
    text = spec.recall.promptTh + 'ครับ เริ่มด้วย “' + stem + '”';
  }
  if (step.kind === 'recall') {
    if (step.instruction.startsWith('Choice reuse:')) {
      expected = chosen || choice.options[0].speak;
      text = 'ลองพูดประโยคที่คุณเลือกเมื่อกี้อีกครั้ง โดยไม่ดูตัวช่วยครับ';
    } else text = spec.recall.promptTh + 'ครับ';
  }
  if (step.kind === 'complete') {
    text = 'จบบทนี้แล้วครับ วันนี้เราได้ฝึก' + spec.goalTh + ' ขอบคุณที่ฝึกด้วยกันครับ';
    expected = undefined;
  }
  return {
    textEn: text, textTh: '', ttsText: text,
    expectsUserSpeech: step.expectsUserSpeech, expectedSpeech: expected,
    guidedSpeaking: board, emojiChoice: undefined,
    isLessonComplete: step.kind === 'complete',
    v7Step: index + 1, v7Retry: false, v7Choice: chosen,
  };
}

export async function runV7Turn(input: TrainingEngineTurnInput, gate: TrainingAiGate) {
  const id = input.config.lessonId;
  const last = [...input.turns].reverse().find(t => t.speaker === 'ai');
  const stepNumber = last?.v7Step ?? input.sessionProgressTurn ?? 1;
  const current = renderV7Turn(id, stepNumber, last?.v7Choice);
  const step = buildFoundationV7Steps(id)[current.v7Step! - 1];
  const choice = FOUNDATION_V7_CHOICE_BEATS[id];
  if (current.isLessonComplete) return { reply: current, aiDebug: scriptedAiDebug() };
  // Continue is a UI action, never evidence of a spoken attempt.
  if (step.expectsUserSpeech && userTurnWasContinue(input.userText)) {
    return { reply: { ...current, v7Retry: last?.v7Retry }, aiDebug: scriptedAiDebug() };
  }
  if (!step.expectsUserSpeech) {
    return { reply: renderV7Turn(id, stepNumber + 1, last?.v7Choice), aiDebug: scriptedAiDebug() };
  }
  const accepted = step.kind === 'choice' && choice.answerMode === 'any'
    ? choice.options.map(o => o.speak) : [current.expectedSpeech!];
  const exact = accepted.find(answer => normalize(answer) === normalize(input.userText));
  // A distractor with the wrong meaning must not pass a single-answer choice.
  const distractor = step.kind === 'choice' && choice.answerMode === 'single' &&
    choice.options.some(o => normalize(o.speak) === normalize(input.userText)) && !exact;
  let tier: 'correct' | 'close' | 'incorrect' = exact ? 'correct' : 'incorrect';
  let aiDebug = scriptedAiDebug();
  if (!exact && isFoundationV7OffTopicProbe(input.userText, current.expectedSpeech)) {
    tier = 'incorrect';
  } else if (!exact && !distractor) {
    const result = await gate.runChoiceLessonAssess({
      lessonTitle: input.config.titleEn, coreStep: stepNumber,
      coreStepMax: input.config.progressMax!,
      expectedSpeech: current.expectedSpeech ?? null,
      exampleAnswer: current.expectedSpeech ?? null,
      tutorQuestion: current.textEn + (step.kind === 'choice' && choice.answerMode === 'any'
        ? '\nEvery option is valid; accept truthful alternatives. ' + accepted.join(' | ') : ''),
      incorrectHintTh: choice.incorrectHintTh ?? null,
      userText: input.userText, originalText: input.originalText,
      history: input.turns, learnerFirstName: input.learnerFirstName,
      teachingLanguage: 'thai', languageMix: input.config.languageMix,
    });
    tier = result.reply.assessmentTier ?? 'incorrect';
    aiDebug = result.aiDebug;
  }
  if (tier === 'incorrect' && !last?.v7Retry) {
    const hint = step.kind === 'choice' ? choice.incorrectHintTh : undefined;
    const text = (hint || 'ลองอีกครั้งครับ พูดว่า “' + current.expectedSpeech + '”') + ' ' + current.textEn;
    return { reply: { ...current, textEn: text, ttsText: text, assessmentTier: tier, v7Retry: true }, aiDebug };
  }
  const chosen = step.kind === 'choice' && choice.answerMode === 'any'
    ? (exact ?? (tier === 'correct' ? input.userText : current.expectedSpeech))
    : last?.v7Choice;
  const next = renderV7Turn(id, stepNumber + 1, chosen);
  const prefix = tier === 'correct' ? 'ดีครับ ' :
    'ประโยคนี้พูดว่า “' + current.expectedSpeech + '” ครับ ลองฝึกต่อด้วยกันนะครับ ';
  const text = prefix + next.textEn;
  return { reply: { ...next, textEn: text, ttsText: text, assessmentTier: tier,
    wasSoftAdvance: tier === 'incorrect' }, aiDebug };
}
