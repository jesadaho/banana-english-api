import type { TrainingTurnReply } from '../gemini/gemini-chat.service';
import type { TrainingEngineTurnInput } from '../training/engine/training-turn.engine';
import type { TrainingAiGate } from '../training/engine/ai-gate';
import { scriptedAiDebug } from '../common/ai-debug';
import { buildFoundationV7Steps, type V7TeachingStep } from './foundation-v7-lessons.data';
import { FOUNDATION_V7_CHOICE_BEATS } from './foundation-v7-choice-beats.data';
import specs from './foundation-v7-lessons.authoring.json';
import { userTurnWasContinue } from './foundation-v7-turn-guard';

const normalize = (value: string) => value.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/[’']/g, '').replace(/[^a-z0-9]/g, '');

function expandSpeechForms(value: string): string[] {
  const forms = new Set([value]);
  const add = (next: string) => { if (next.trim()) forms.add(next); };
  add(value.replace(/\bdon't\b/gi, 'do not'));
  add(value.replace(/\bdo not\b/gi, "don't"));
  add(value.replace(/\bcan't\b/gi, 'cannot'));
  add(value.replace(/\bcannot\b/gi, "can't"));
  add(value.replace(/\bcan not\b/gi, "can't"));
  add(value.replace(/\s*o['’]?clock\.?/gi, '').replace(/\s+/g, ' ').trim());
  return [...forms];
}

function speechMatches(expected: string, got: string): boolean {
  const gotN = normalize(got);
  return expandSpeechForms(expected).some(form => normalize(form) === gotN)
    || expandSpeechForms(got).some(form => normalize(form) === normalize(expected));
}
const OFF_TOPIC_PROBES = new Set(['goodmorning', 'hellothere']);

const NUMBER_TH: Record<string, string> = {
  zero: 'ศูนย์', one: 'หนึ่ง', two: 'สอง', three: 'สาม', four: 'สี่',
  five: 'ห้า', six: 'หก', seven: 'เจ็ด', eight: 'แปด', nine: 'เก้า', ten: 'สิบ',
};

function v7CorrectPrefix(step: V7TeachingStep, spoken: string): string {
  const option = step.presentation?.options.find(o => speechMatches(o.speak, spoken));
  if (option?.recapText) return option.recapText;
  const authored = step.presentation?.successText;
  if (authored) return authored;
  if (option?.meaningTh) return option.speak + ' แปลว่า “' + option.meaningTh + '” ครับ ';
  const numberTh = NUMBER_TH[normalize(spoken)];
  if (numberTh) return spoken + ' แปลว่า “' + numberTh + '” ครับ ';
  return 'ดีครับ ';
}

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
  if (step.presentation) {
    text = step.presentation.text;
    const p = step.presentation;
    board = p.options.length ? { stem: p.stem, ...p.options[0], options: p.options } : undefined;
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
  const choice = step.presentation ?? FOUNDATION_V7_CHOICE_BEATS[id];
  const isChoice = step.kind === 'choice' || !!step.presentation?.options.length;
  if (current.isLessonComplete) return { reply: current, aiDebug: scriptedAiDebug() };
  // Continue is a UI action, never evidence of a spoken attempt.
  if (step.expectsUserSpeech && userTurnWasContinue(input.userText)) {
    return { reply: { ...current, v7Retry: last?.v7Retry }, aiDebug: scriptedAiDebug() };
  }
  if (!step.expectsUserSpeech) {
    return { reply: renderV7Turn(id, stepNumber + 1, last?.v7Choice), aiDebug: scriptedAiDebug() };
  }
  const accepted = isChoice && choice.answerMode === 'any'
    ? choice.options.map(o => o.speak) : [current.expectedSpeech!];
  const exact = accepted.find(answer => speechMatches(answer, input.userText));
  const saidLabelOnly = isChoice && !exact && choice.options.some(o =>
    speechMatches(o.label, input.userText) && !speechMatches(o.speak, input.userText));
  // A distractor with the wrong meaning must not pass a single-answer choice.
  const distractor = isChoice && choice.answerMode === 'single' &&
    (choice.options.some(o => speechMatches(o.speak, input.userText)) || saidLabelOnly) && !exact;
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
      tutorQuestion: current.textEn + (isChoice && choice.answerMode === 'any'
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
    const hint = saidLabelOnly
      ? 'พูดประโยคเต็มตามตัวช่วยครับ อย่าพูดแค่คำสั้น ๆ'
      : choice.incorrectHintTh;
    const text = (hint || 'ลองอีกครั้งครับ พูดว่า “' + current.expectedSpeech + '”') + ' ' + current.textEn;
    return { reply: { ...current, textEn: text, ttsText: text, assessmentTier: tier, v7Retry: true }, aiDebug };
  }
  const chosen = isChoice && choice.answerMode === 'any'
    ? (exact ?? (tier === 'correct' ? input.userText : current.expectedSpeech))
    : last?.v7Choice;
  const next = renderV7Turn(id, stepNumber + 1, chosen);
  const prefix = tier === 'correct'
    ? v7CorrectPrefix(step, exact ?? chosen ?? current.expectedSpeech ?? input.userText)
    : 'ประโยคนี้พูดว่า “' + current.expectedSpeech + '” ครับ ลองฝึกต่อด้วยกันนะครับ ';
  const text = prefix + next.textEn;
  return { reply: { ...next, textEn: text, ttsText: text, assessmentTier: tier,
    wasSoftAdvance: tier === 'incorrect' }, aiDebug };
}
