import { randomUUID } from 'crypto';
import { isScenarioNoise } from '../interactive-scenario/interactive-scenario.runtime';
import { describeItImageUrl } from '../describe-it/describe-it.data';
import {
  PLACEMENT_PROGRESS_MAX,
  PLACEMENT_QUESTION_BY_ID,
  PLACEMENT_QUESTION_IDS,
  PLACEMENT_STAGES,
  getPlacementQuestion,
} from './placement.bank';
import {
  b1Gate,
  debugReasonFor,
  deriveEligibility,
  displayProgressScore,
  nextQuestionId,
  shouldEarlyStopAfter,
  buildSessionResult,
} from './placement.routing';
import type {
  PlacementEntrySource,
  PlacementItemResult,
  PlacementQuestion,
  PlacementRuntimeState,
  PlacementScore,
  PlacementTurnReply,
} from './placement.types';
import { PLACEMENT_SCENARIO_ID } from './placement.types';

const REPLAY_HINT_TH = 'ฟังไม่ทัน กดฟังซ้ำได้';
const CLOSING_EN =
  'Thank you for talking with Teacher Bee. Let’s see where you can start!';
const CLOSING_TH = 'ขอบคุณที่คุยกับครูบีนะครับ มาดูจุดเริ่มต้นของคุณกัน!';
const Q22_VARIANT = 'You said {problem}. How did you handle it?';

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
    pendingFollowUp: null,
    finished: false,
    result: null,
  };
}

export function mentionedMeetingTime(text: string): boolean {
  const t = text.toLowerCase();
  return (
    /\bat\s+(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b/.test(
      t,
    ) ||
    /\b\d{1,2}\s*(a\.?m\.?|p\.?m\.?|o'?clock)\b/.test(t) ||
    /\b(noon|midnight|morning|afternoon|evening|tonight|o'?clock)\b/.test(t) ||
    /\b(โมง|ทุ่ม|นาฬิกา)\b/.test(text)
  );
}

/** 2 = both parts on-point, 1 = only one part or one part unclear, 0 = neither. */
export function combineTwoPartScore(
  first: PlacementScore | null,
  second: PlacementScore | null,
): PlacementScore {
  const a = first ?? 0;
  const b = second ?? 0;
  if (a === 2 && b === 2) return 2;
  if (a >= 1 || b >= 1) return 1;
  return 0;
}

export function followUpPromptFor(
  q: PlacementQuestion,
  firstTranscript: string,
): { prompt: string; variant: string } | null {
  const follow = q.followUp;
  if (!follow) return null;
  if (follow.kind === 'invite_schedule') {
    if (mentionedMeetingTime(firstTranscript) && follow.placePrompt) {
      return { prompt: follow.placePrompt, variant: `${q.id}.place` };
    }
    if (follow.timePrompt) {
      return { prompt: follow.timePrompt, variant: `${q.id}.time` };
    }
  }
  if (follow.prompt) {
    return { prompt: follow.prompt, variant: `${q.id}.follow` };
  }
  return null;
}

export function placementJudgeContext(
  q: PlacementQuestion,
  state: PlacementRuntimeState,
): {
  prompt: string;
  variantId: string;
  target: string;
  requiredEvidence: string;
  anchors2: string[];
  anchors1: string[];
} {
  const pending = state.pendingFollowUp;
  if (pending?.questionId === q.id && q.followUp) {
    return {
      prompt: pending.prompt,
      variantId: pending.variant,
      target: q.followUp.target,
      requiredEvidence: q.followUp.requiredEvidence,
      anchors2: q.followUp.anchors2,
      anchors1: q.followUp.anchors1,
    };
  }
  const { prompt, variantId } = exactPromptFor(q, state);
  return {
    prompt,
    variantId,
    target: q.target,
    requiredEvidence: q.requiredEvidence,
    anchors2: q.anchors2,
    anchors1: q.anchors1,
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
  const pending = state.pendingFollowUp;
  if (pending?.questionId === q.id) {
    return { prompt: pending.prompt, variantId: pending.variant };
  }
  if (q.id === 'Q22' && state.facts.storyProblem) {
    return {
      prompt: Q22_VARIANT.replace('{problem}', state.facts.storyProblem),
      variantId: 'Q22.contextual',
    };
  }
  return {
    prompt: fillName(q.npcEn, state.learnerName),
    variantId: `${q.id}.base`,
  };
}

function openingLines(state: PlacementRuntimeState): string {
  if (state.entrySource === 'profile_settings') {
    return 'มาลองวัดระดับภาษาอังกฤษกันครับ ตอบเท่าที่ได้เลย';
  }
  return 'สวัสดีครับ ผมครูพี่บี กล้วยหอมที่จะมาช่วยให้คุณพูดภาษาอังกฤษได้อย่างมั่นใจ วันนี้เรามาวัดระดับภาษาอังกฤษของคุณกัน ตอบเท่าที่ได้เลยครับ';
}

function hideTranscript(q: PlacementQuestion): boolean {
  return q.delivery === 'audio_only' || q.delivery === 'picture_audio';
}

function progressOverall(state: PlacementRuntimeState): {
  progressTurn: number;
  progressMax: number;
  progressScores: Array<0 | 1 | 2 | -1 | null>;
} {
  const progressScores = PLACEMENT_QUESTION_IDS.map((id) =>
    displayProgressScore(state.results[id]),
  );
  const idx = state.currentQuestionId
    ? PLACEMENT_QUESTION_IDS.indexOf(state.currentQuestionId)
    : -1;
  const progressTurn =
    state.finished || idx < 0
      ? PLACEMENT_PROGRESS_MAX
      : idx + 1;
  return {
    progressTurn,
    progressMax: PLACEMENT_PROGRESS_MAX,
    progressScores,
  };
}

function lastDebugFor(
  evaluation: PlacementItemResult,
): NonNullable<PlacementTurnReply['lastDebug']> {
  return {
    questionId: evaluation.questionId,
    score: evaluation.score,
    status: evaluation.status,
    reason: debugReasonFor({
      reasonCode: evaluation.reasonCode,
      status: evaluation.status,
      reason: evaluation.reason,
      evidence: evaluation.evidence,
    }),
  };
}

function withLastDebug(
  reply: PlacementTurnReply,
  evaluation: PlacementItemResult,
): PlacementTurnReply {
  return {
    ...reply,
    lastDebug: lastDebugFor(evaluation),
    assessmentTier:
      evaluation.score === 2
        ? 'correct'
        : evaluation.score === 1
          ? 'close'
          : evaluation.score === 0
            ? 'incorrect'
            : undefined,
  };
}

function npcForQuestion(
  state: PlacementRuntimeState,
  q: PlacementQuestion,
  prefixEn = '',
  prefixTh = '',
): PlacementTurnReply {
  const { prompt } = exactPromptFor(q, state);
  const { progressTurn, progressMax, progressScores } = progressOverall({
    ...state,
    currentQuestionId: q.id,
  });
  const hide = hideTranscript(q);
  let textTh = prefixTh;
  if (q.transitionTh && !state.audioOnlyAnnounced) {
    textTh = [prefixTh, q.transitionTh].filter(Boolean).join(' ');
  }
  if (!textTh && !hide) textTh = REPLAY_HINT_TH;
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
    progressScores,
  };
}

export function buildPlacementOpening(
  state: PlacementRuntimeState,
): { state: PlacementRuntimeState; reply: PlacementTurnReply } {
  const q01 = getPlacementQuestion('Q01')!;
  const next: PlacementRuntimeState = {
    ...state,
    openingPlayed: true,
    currentQuestionId: 'Q01',
    askedQuestionIds: state.askedQuestionIds.includes('Q01')
      ? state.askedQuestionIds
      : [...state.askedQuestionIds, 'Q01'],
  };
  const introTh = openingLines(state);
  const body = npcForQuestion(next, q01, '', REPLAY_HINT_TH);
  const spokenPrompt = exactPromptFor(q01, next).prompt;
  return {
    state: next,
    reply: {
      ...body,
      aiResponse: `${introTh} ${spokenPrompt}`,
      textTh: REPLAY_HINT_TH,
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
  reason: string,
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
    reason,
  };
}

/** Gemini JSON may send score as `"2"`; gates only accept numeric 0/1/2. */
export function coercePlacementScore(score: unknown): 0 | 1 | 2 | null {
  if (score === 0 || score === 1 || score === 2) return score;
  if (typeof score === 'string' && /^(0|1|2)$/.test(score.trim())) {
    return Number(score.trim()) as 0 | 1 | 2;
  }
  return null;
}

/** Skip, capture noise, and Thai-only only. Communicative 0/1/2 goes to Gemini. */
export function heuristicPlacementEval(
  _q: PlacementQuestion,
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
      reason: 'ข้ามข้อ จึงให้ 0',
    };
  }
  const raw = transcript.trim();
  if (!raw || isScenarioNoise(raw)) return null;
  if (thaiOnly(raw)) {
    return scored(
      1,
      raw,
      'target_partially_demonstrated',
      'ตอบเป็นไทย แสดงว่าเข้าใจโจทย์ แต่ยังไม่พูดอังกฤษ',
    );
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
  if (q.id === 'Q21' && /\b(late|rain|miss|cancel|wrong|change|noisy|problem)\b/.test(lower)) {
    next.storyProblem = transcript.trim().slice(0, 80);
  }
  return next;
}

function ackFor(q: PlacementQuestion): string {
  if (q.afterScoreEn) return q.afterScoreEn;
  if (q.id === 'Q03' || q.id === 'Q05' || q.id === 'Q06' || q.id === 'Q08') {
    return '';
  }
  return 'Thanks!';
}

function canStartFollowUp(item: PlacementItemResult): boolean {
  return (
    (item.status === 'scored' || item.status === 'assisted') &&
    item.score === 2
  );
}

function combineFollowUpResult(
  first: PlacementItemResult,
  second: PlacementItemResult,
): PlacementItemResult {
  const score = combineTwoPartScore(first.score, second.score);
  const assisted = first.status === 'assisted' || second.status === 'assisted';
  const derived = deriveEligibility({
    ...second,
    status: assisted ? 'assisted' : 'scored',
    score,
    eligibleForPlacement: !assisted,
  });
  return {
    ...second,
    status: derived.eligibleForPlacement ? 'scored' : assisted ? 'assisted' : second.status,
    score: derived.score,
    eligibleForPlacement: derived.eligibleForPlacement,
    evidence: [...first.evidence, ...second.evidence]
      .map((part) => part.trim())
      .filter(Boolean)
      .slice(0, 2),
    reasonCode:
      score === 2
        ? 'target_met'
        : score === 1
          ? 'target_partially_demonstrated'
          : 'off_topic',
    reason:
      score === 2
        ? 'ครบทั้งสองส่วนของข้อนี้'
        : score === 1
          ? 'ทำได้เพียงส่วนเดียว หรืออีกส่วนยังสื่อไม่ชัด'
          : 'ยังสื่อสารทั้งสองส่วนไม่ได้',
    variantId: `${first.variantId}+${second.variantId}`,
  };
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
  let normalized: PlacementItemResult = {
    ...evaluation,
    eligibleForPlacement: derived.eligibleForPlacement,
    score: derived.score,
  };

  if (evaluation.status === 'technical_retry') {
    const retries = (state.captureRetries[q.id] ?? 0) + 1;
    const retrying: PlacementRuntimeState = {
      ...state,
      captureRetries: { ...state.captureRetries, [q.id]: retries },
    };
    if (retries <= 1) {
      const retry = npcForQuestion(
        retrying,
        q,
        '',
        'เสียงไม่ชัดครับ ลองพูดอีกครั้ง หรือข้ามข้อนี้ได้',
      );
      return { state: retrying, reply: withLastDebug(retry, normalized) };
    }
    if (state.pendingFollowUp?.questionId === q.id) {
      normalized = combineFollowUpResult(state.pendingFollowUp.first, {
        ...normalized,
        status: 'scored',
        score: 0,
        eligibleForPlacement: true,
        reasonCode: 'capture_error',
        reason: 'รอบสองจับเสียงไม่ชัด',
      });
    }
  } else if (state.pendingFollowUp?.questionId === q.id) {
    const second: PlacementItemResult =
      evaluation.status === 'needs_review'
        ? {
            ...normalized,
            status: 'scored',
            score: 0,
            eligibleForPlacement: true,
            reasonCode: 'uncertain_transcription',
            reason: 'รอบสองประเมินไม่ได้',
          }
        : normalized;
    normalized = combineFollowUpResult(state.pendingFollowUp.first, second);
  } else if (q.followUp && canStartFollowUp(normalized)) {
    const follow = followUpPromptFor(q, normalized.evidence[0] ?? '');
    if (follow) {
      const next: PlacementRuntimeState = {
        ...state,
        pendingFollowUp: {
          questionId: q.id,
          prompt: follow.prompt,
          variant: follow.variant,
          first: normalized,
        },
        currentQuestionId: q.id,
        askedQuestionIds: state.askedQuestionIds.includes(q.id)
          ? state.askedQuestionIds
          : [...state.askedQuestionIds, q.id],
        facts: captureFacts(q, normalized.evidence[0] ?? '', state.facts),
      };
      return {
        state: next,
        reply: withLastDebug(npcForQuestion(next, q), normalized),
      };
    }
  }

  const results = { ...state.results, [q.id]: normalized };
  const asked = state.askedQuestionIds.includes(q.id)
    ? state.askedQuestionIds
    : [...state.askedQuestionIds, q.id];

  let next: PlacementRuntimeState = {
    ...state,
    results,
    askedQuestionIds: asked,
    pendingFollowUp: null,
    facts: captureFacts(q, evaluation.evidence[0] ?? '', state.facts),
    consecutiveZeros:
      normalized.eligibleForPlacement && normalized.score === 0
        ? state.consecutiveZeros + 1
        : normalized.eligibleForPlacement
          ? 0
          : state.consecutiveZeros,
  };

  if (shouldEarlyStopAfter(next, q.id)) {
    const stopped = finish(next, 'early_zero_streak');
    return {
      state: stopped.state,
      reply: withLastDebug(stopped.reply, normalized),
    };
  }

  const upcoming = nextQuestionId(next);
  if (!upcoming) {
    const stopped = finish(
      next,
      q.stage === 'b1' && b1Gate(next)
        ? 'b1_confirmed'
        : stageAskedComplete(next, q.stage)
          ? 'band_not_confirmed'
          : 'insufficient_evidence',
    );
    return {
      state: stopped.state,
      reply: withLastDebug(stopped.reply, normalized),
    };
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
  return {
    state: next,
    reply: withLastDebug(npcForQuestion(next, nextQ, ack, prefixTh), normalized),
  };
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
  const { progressTurn, progressMax, progressScores } = progressOverall(done);
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
      progressScores,
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

/** Scripted Teacher B lines for the Level Test TTS bank. */
export function collectPlacementBankLines(): string[] {
  const lines = new Set<string>();
  const add = (text: string) => {
    const key = text.replace(/\s+/g, ' ').trim();
    if (key) lines.add(key);
  };

  add(
    buildPlacementOpening(
      initPlacementRuntime({ entrySource: 'onboarding', learnerName: '' }),
    ).reply.aiResponse,
  );
  add(
    buildPlacementOpening(
      initPlacementRuntime({
        entrySource: 'profile_settings',
        learnerName: '',
      }),
    ).reply.aiResponse,
  );

  const blank = initPlacementRuntime({
    entrySource: 'onboarding',
    learnerName: '',
  });
  for (const id of PLACEMENT_QUESTION_IDS) {
    const q = getPlacementQuestion(id)!;
    add(exactPromptFor(q, blank).prompt);
    if (q.followUp?.timePrompt) add(q.followUp.timePrompt);
    if (q.followUp?.placePrompt) add(q.followUp.placePrompt);
    if (q.followUp?.prompt) add(q.followUp.prompt);
  }

  for (let i = 0; i < PLACEMENT_QUESTION_IDS.length - 1; i++) {
    const current = getPlacementQuestion(PLACEMENT_QUESTION_IDS[i]!)!;
    const upcoming = getPlacementQuestion(PLACEMENT_QUESTION_IDS[i + 1]!)!;
    add(
      [ackFor(current), exactPromptFor(upcoming, blank).prompt]
        .filter(Boolean)
        .join(' '),
    );
  }

  add(CLOSING_EN);
  return [...lines].sort((a, b) => a.localeCompare(b));
}
