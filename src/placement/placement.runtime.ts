import { randomUUID } from 'crypto';
import { isScenarioNoise } from '../interactive-scenario/interactive-scenario.runtime';
import { describeItImageUrl } from '../describe-it/describe-it.data';
import {
  PLACEMENT_QUESTION_BY_ID,
  PLACEMENT_STAGES,
  getPlacementQuestion,
} from './placement.bank';
import {
  b1Gate,
  deriveEligibility,
  nextQuestionId,
  shouldEarlyStopAfter,
  buildSessionResult,
} from './placement.routing';
import type {
  PlacementEntrySource,
  PlacementItemResult,
  PlacementQuestion,
  PlacementRuntimeState,
  PlacementTurnReply,
} from './placement.types';
import { PLACEMENT_SCENARIO_ID } from './placement.types';

const REPLAY_HINT_TH = 'ฟังไม่ทัน กดฟังซ้ำได้';
const CLOSING_EN =
  'Thank you for talking with Teacher Bee. Let’s see where you can start!';
const CLOSING_TH = 'ขอบคุณที่คุยกับครูบีนะครับ มาดูจุดเริ่มต้นของคุณกัน!';
const Q18_VARIANT =
  'You said {problem}. What did you do, and what happened next?';

export function isPlacementScenarioId(id: string): boolean {
  return id.trim() === PLACEMENT_SCENARIO_ID;
}

export function initPlacementRuntime(params: {
  entrySource: PlacementEntrySource;
  learnerName: string;
}): PlacementRuntimeState {
  return {
    scenarioId: PLACEMENT_SCENARIO_ID,
    entrySource: params.entrySource,
    learnerName: params.learnerName.trim(),
    openingPlayed: false,
    audioOnlyAnnounced: false,
    currentQuestionId: null,
    askedQuestionIds: [],
    results: {},
    captureRetries: {},
    consecutiveZeros: 0,
    facts: {},
    finished: false,
    result: null,
  };
}

function fillName(template: string, name: string): string {
  const n = name.trim() || 'there';
  return template.replace(/\{name\}/g, n);
}

export function exactPromptFor(
  q: PlacementQuestion,
  state: PlacementRuntimeState,
): { prompt: string; variantId: string } {
  if (q.id === 'Q18' && state.facts.storyProblem) {
    return {
      prompt: Q18_VARIANT.replace('{problem}', state.facts.storyProblem),
      variantId: 'Q18.contextual',
    };
  }
  return {
    prompt: fillName(q.npcEn, state.learnerName),
    variantId: `${q.id}.base`,
  };
}

function openingLines(state: PlacementRuntimeState): {
  en: string;
  th: string;
} {
  if (state.entrySource === 'profile_settings') {
    return {
      en: 'Let’s try an English level check. Answer as much as you can.',
      th: 'มาลองวัดระดับภาษาอังกฤษกันครับ ตอบเท่าที่ได้เลย',
    };
  }
  return {
    en: 'Hello, I am Teacher Bee. I help you speak English with confidence. Today we will check your English level. Answer as much as you can.',
    th: 'สวัสดีครับ ผมครูพี่บี กล้วยหอมที่จะมาช่วยให้คุณพูดภาษาอังกฤษได้อย่างมั่นใจ วันนี้เรามาวัดระดับภาษาอังกฤษของคุณกัน ตอบเท่าที่ได้เลยครับ',
  };
}

function hideTranscript(q: PlacementQuestion): boolean {
  return q.delivery === 'audio_only' || q.delivery === 'picture_audio';
}

function progressInStage(state: PlacementRuntimeState): {
  progressTurn: number;
  progressMax: number;
} {
  const id = state.currentQuestionId ?? 'Q01';
  const q = getPlacementQuestion(id);
  const stage = PLACEMENT_STAGES.find(
    (s) => s.id === (q?.stage ?? 'foundation_entry'),
  )!;
  const asked = stage.questionIds.filter((qid) =>
    state.askedQuestionIds.includes(qid),
  ).length;
  return {
    progressTurn: Math.min(asked, stage.questionIds.length),
    progressMax: stage.questionIds.length,
  };
}

function npcForQuestion(
  state: PlacementRuntimeState,
  q: PlacementQuestion,
  prefixEn = '',
  prefixTh = '',
): PlacementTurnReply {
  const { prompt } = exactPromptFor(q, state);
  const { progressTurn, progressMax } = progressInStage({
    ...state,
    currentQuestionId: q.id,
  });
  const hide = hideTranscript(q);
  let textTh = prefixTh;
  if (q.transitionTh && !state.audioOnlyAnnounced) {
    textTh = [prefixTh, q.transitionTh].filter(Boolean).join(' ');
  }
  if (!textTh) textTh = REPLAY_HINT_TH;
  const spoken = [prefixEn, prompt].filter(Boolean).join(' ');
  return {
    aiResponse: spoken,
    textTh,
    expectsUserSpeech: true,
    canSkip: true,
    hideNpcTranscript: hide,
    imagePath: q.imagePath,
    isTaskComplete: false,
    progressTurn,
    progressMax,
  };
}

export function buildPlacementOpening(
  state: PlacementRuntimeState,
): { state: PlacementRuntimeState; reply: PlacementTurnReply } {
  const q01 = getPlacementQuestion('Q01')!;
  const open = openingLines(state);
  const next: PlacementRuntimeState = {
    ...state,
    openingPlayed: true,
    currentQuestionId: 'Q01',
    askedQuestionIds: state.askedQuestionIds.includes('Q01')
      ? state.askedQuestionIds
      : [...state.askedQuestionIds, 'Q01'],
  };
  const body = npcForQuestion(next, q01, '', `${open.th} ${REPLAY_HINT_TH}`);
  const spokenPrompt = exactPromptFor(q01, next).prompt;
  return {
    state: next,
    reply: {
      ...body,
      aiResponse: state.openingPlayed
        ? body.aiResponse
        : `${open.en} ${spokenPrompt}`,
    },
  };
}

export function placementVisualUrl(imagePath?: string): string | undefined {
  return imagePath ? describeItImageUrl(imagePath) : undefined;
}

function thaiOnly(transcript: string): boolean {
  const letters = transcript.replace(/[^\p{L}]/gu, '');
  if (!letters) return false;
  const thai = (letters.match(/\p{Script=Thai}/gu) ?? []).length;
  return thai / letters.length > 0.8;
}

function scored(
  score: 0 | 1 | 2,
  raw: string,
  reasonCode: PlacementItemResult['reasonCode'],
): Omit<
  PlacementItemResult,
  'questionId' | 'attemptId' | 'exactPrompt' | 'variantId'
> {
  return {
    status: 'scored',
    score,
    eligibleForPlacement: true,
    evidence: [raw.slice(0, 80)],
    reasonCode,
  };
}

/** Fast local 0/1/2 when the answer is obvious. null = call the evaluator. */
export function heuristicPlacementEval(
  q: PlacementQuestion,
  transcript: string,
  skipped: boolean,
): Omit<
  PlacementItemResult,
  'questionId' | 'attemptId' | 'exactPrompt' | 'variantId'
> | null {
  if (skipped) {
    return {
      status: 'skipped',
      score: 0,
      eligibleForPlacement: true,
      evidence: [],
      reasonCode: 'user_skipped',
    };
  }
  const raw = transcript.trim();
  if (!raw || isScenarioNoise(raw)) return null;
  const lower = raw.toLowerCase();

  if (q.id === 'Q04') {
    const pluralKeys = /\bkeys\b/.test(lower);
    const owners = /\b(they|their|may|max|have)\b/.test(lower);
    if (pluralKeys && owners) return scored(2, raw, 'target_met');
    if (/\bkey\b/.test(lower) && !pluralKeys) {
      return scored(1, raw, 'target_partially_demonstrated');
    }
  }
  if (q.id === 'Q06') {
    if (/\byes\b/.test(lower) && /\bred\b/.test(lower)) {
      return scored(0, raw, 'off_topic');
    }
    const no = /\b(no|not|isn't|is not)\b/.test(lower);
    const blue = /\bblue\b/.test(lower);
    if (no && blue) return scored(2, raw, 'target_met');
    if (no || blue) return scored(1, raw, 'target_partially_demonstrated');
  }
  if (q.id === 'Q09') {
    if (/\b(how much|what's the price|what is the price)\b/.test(lower)) {
      return scored(2, raw, 'target_met');
    }
  }
  if (q.id === 'Q11') {
    const past = /\b(went|stayed|watched|played|did|was|were)\b/.test(lower);
    const who =
      /\b(friend|friends|family|mom|dad|alone|myself|sister|brother|with)\b/.test(
        lower,
      );
    if (past && who) return scored(2, raw, 'target_met');
    if (past || who) {
      return scored(1, raw, 'target_partially_demonstrated');
    }
  }
  if (thaiOnly(raw)) {
    return scored(1, raw, 'target_partially_demonstrated');
  }
  return null;
}

function captureFacts(
  q: PlacementQuestion,
  transcript: string,
  facts: PlacementRuntimeState['facts'],
): PlacementRuntimeState['facts'] {
  const lower = transcript.toLowerCase();
  const next = { ...facts };
  if (q.id === 'Q17' && /\b(late|rain|miss|cancel|wrong|change)\b/.test(lower)) {
    next.storyProblem = transcript.trim().slice(0, 80);
  }
  return next;
}

function ackFor(q: PlacementQuestion): string {
  if (q.id === 'Q03' || q.id === 'Q05' || q.id === 'Q06') return '';
  return q.afterScoreEn ?? 'Thanks!';
}

export function applyPlacementEvaluation(
  state: PlacementRuntimeState,
  evaluation: PlacementItemResult,
): { state: PlacementRuntimeState; reply: PlacementTurnReply } {
  const q = getPlacementQuestion(evaluation.questionId);
  if (!q) {
    return finish(state, 'insufficient_evidence');
  }

  const derived = deriveEligibility(evaluation);
  const normalized: PlacementItemResult = {
    ...evaluation,
    eligibleForPlacement: derived.eligibleForPlacement,
    score: derived.score,
  };

  const results = { ...state.results, [q.id]: normalized };
  const asked = state.askedQuestionIds.includes(q.id)
    ? state.askedQuestionIds
    : [...state.askedQuestionIds, q.id];

  let next: PlacementRuntimeState = {
    ...state,
    results,
    askedQuestionIds: asked,
    facts: captureFacts(q, evaluation.evidence[0] ?? '', state.facts),
    consecutiveZeros:
      normalized.eligibleForPlacement && normalized.score === 0
        ? state.consecutiveZeros + 1
        : normalized.eligibleForPlacement
          ? 0
          : state.consecutiveZeros,
  };

  if (evaluation.status === 'technical_retry') {
    const retries = (state.captureRetries[q.id] ?? 0) + 1;
    next = {
      ...next,
      captureRetries: { ...state.captureRetries, [q.id]: retries },
    };
    if (retries <= 1) {
      const retry = npcForQuestion(
        next,
        q,
        '',
        'เสียงไม่ชัดครับ ลองพูดอีกครั้ง หรือข้ามข้อนี้ได้',
      );
      return { state: next, reply: retry };
    }
  }

  if (shouldEarlyStopAfter(next, q.id)) {
    return finish(next, 'early_zero_streak');
  }

  const upcoming = nextQuestionId(next);
  if (!upcoming) {
    if (q.stage === 'b1' && b1Gate(next)) {
      return finish(next, 'b1_confirmed');
    }
    return finish(
      next,
      stageAskedComplete(next, q.stage)
        ? 'band_not_confirmed'
        : 'insufficient_evidence',
    );
  }

  const nextQ = getPlacementQuestion(upcoming)!;
  next = {
    ...next,
    currentQuestionId: nextQ.id,
    askedQuestionIds: next.askedQuestionIds.includes(nextQ.id)
      ? next.askedQuestionIds
      : [...next.askedQuestionIds, nextQ.id],
    audioOnlyAnnounced:
      next.audioOnlyAnnounced ||
      Boolean(nextQ.transitionTh) ||
      nextQ.id === 'Q11',
  };

  const ack = ackFor(q);
  const prefixTh =
    nextQ.transitionTh && !state.audioOnlyAnnounced ? nextQ.transitionTh : '';
  return { state: next, reply: npcForQuestion(next, nextQ, ack, prefixTh) };
}

function stageAskedComplete(
  state: PlacementRuntimeState,
  stageId: PlacementQuestion['stage'],
): boolean {
  const stage = PLACEMENT_STAGES.find((s) => s.id === stageId)!;
  return stage.questionIds.every((id) => state.askedQuestionIds.includes(id));
}

function finish(
  state: PlacementRuntimeState,
  reason: Parameters<typeof buildSessionResult>[1],
): { state: PlacementRuntimeState; reply: PlacementTurnReply } {
  const result = buildSessionResult(state, reason);
  const done: PlacementRuntimeState = {
    ...state,
    finished: true,
    currentQuestionId: null,
    result,
  };
  const { progressTurn, progressMax } = progressInStage(state);
  return {
    state: done,
    reply: {
      aiResponse: CLOSING_EN,
      textTh: CLOSING_TH,
      expectsUserSpeech: false,
      canSkip: false,
      hideNpcTranscript: false,
      isTaskComplete: true,
      progressTurn,
      progressMax,
      result,
    },
  };
}

export function makeItemResult(
  q: PlacementQuestion,
  state: PlacementRuntimeState,
  partial: Omit<
    PlacementItemResult,
    'questionId' | 'attemptId' | 'exactPrompt' | 'variantId'
  >,
): PlacementItemResult {
  const { prompt, variantId } = exactPromptFor(q, state);
  const derived = deriveEligibility(partial);
  return {
    questionId: q.id,
    attemptId: randomUUID(),
    exactPrompt: prompt,
    variantId,
    ...partial,
    eligibleForPlacement: derived.eligibleForPlacement,
    score: derived.score,
  };
}

export function currentPlacementQuestion(
  state: PlacementRuntimeState,
): PlacementQuestion | undefined {
  return state.currentQuestionId
    ? PLACEMENT_QUESTION_BY_ID.get(state.currentQuestionId)
    : undefined;
}
