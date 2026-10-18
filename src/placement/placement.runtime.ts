import { randomUUID } from 'crypto';
import { isScenarioNoise } from '../interactive-scenario/interactive-scenario.runtime';
import { describeItImageUrl } from '../describe-it/describe-it.data';
import {
  PLACEMENT_BANDS,
  PLACEMENT_QUESTION_BY_ID,
  getPlacementQuestion,
} from './placement.bank';
import {
  bandEligibleScores,
  bandStatus,
  buildSessionResult,
  nextQuestionId,
  shouldEarlyStopAfter,
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

function exactPromptFor(
  q: PlacementQuestion,
  state: PlacementRuntimeState,
): { prompt: string; variantId: string } {
  if (q.id === 'Q12') {
    const act = state.facts.weekendActivity;
    if (act) {
      return {
        prompt: `What did you think of ${act}?`,
        variantId: 'Q12.personalized',
      };
    }
    return { prompt: q.npcEn, variantId: 'Q12.base' };
  }
  if (q.id === 'Q14') {
    if (state.facts.preference === 'beach') {
      return {
        prompt: 'Why would you choose the beach?',
        variantId: 'Q14.beach',
      };
    }
    if (state.facts.preference === 'mountains') {
      return {
        prompt: 'Why would you choose the mountains?',
        variantId: 'Q14.mountains',
      };
    }
    return {
      prompt: 'What do you like about the beach or the mountains?',
      variantId: 'Q14.fallback',
    };
  }
  if (q.id === 'Q17' && state.facts.weekendActivity === 'home') {
    return {
      prompt: 'Tell me about a day you remember well. What happened?',
      variantId: 'Q17.near_home',
    };
  }
  if (q.id === 'Q18' && state.facts.storyProblem) {
    return {
      prompt: `You said ${state.facts.storyProblem}. How did you deal with that?`,
      variantId: 'Q18.personalized',
    };
  }
  return { prompt: fillName(q.npcEn, state.learnerName), variantId: `${q.id}.base` };
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

function progressInBand(state: PlacementRuntimeState): {
  progressTurn: number;
  progressMax: number;
} {
  const id = state.currentQuestionId ?? 'Q01';
  const q = getPlacementQuestion(id);
  const band = PLACEMENT_BANDS.find((b) => b.id === (q?.band ?? 'A1'))!;
  const asked = band.questionIds.filter((qid) =>
    state.askedQuestionIds.includes(qid),
  ).length;
  return { progressTurn: Math.min(asked, 4), progressMax: 4 };
}

function npcForQuestion(
  state: PlacementRuntimeState,
  q: PlacementQuestion,
  prefixEn = '',
  prefixTh = '',
): PlacementTurnReply {
  const { prompt } = exactPromptFor(q, state);
  const { progressTurn, progressMax } = progressInBand({
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
  return {
    state: next,
    reply: {
      ...body,
      aiResponse: state.openingPlayed ? body.aiResponse : `${open.en} ${q01.npcEn.replace('{name}', state.learnerName || 'there')}`,
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

/** Fast local 0/1/2 when the answer is obvious. null = call the evaluator. */
export function heuristicPlacementEval(
  q: PlacementQuestion,
  transcript: string,
  skipped: boolean,
): Omit<PlacementItemResult, 'questionId' | 'attemptId' | 'exactPrompt' | 'variantId'> | null {
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

  if (q.id === 'Q03' && /\b(phone|phones|bag)\b/.test(lower) && !/\bbook/.test(lower)) {
    return {
      status: 'scored',
      score: 0,
      eligibleForPlacement: true,
      evidence: [raw.slice(0, 80)],
      reasonCode: 'off_topic',
    };
  }
  if (q.id === 'Q03' && /\bbook/.test(lower)) {
    return {
      status: 'scored',
      score: 2,
      eligibleForPlacement: true,
      evidence: [raw.slice(0, 80)],
      reasonCode: 'target_met',
    };
  }
  if (q.id === 'Q06' && /\b(seven|7|7:00|07:00)\b/.test(lower)) {
    return {
      status: 'scored',
      score: 2,
      eligibleForPlacement: true,
      evidence: [raw.slice(0, 80)],
      reasonCode: 'target_met',
    };
  }
  if (q.id === 'Q10' && /\b(nine thirty|9:30|09:30)\b/.test(lower)) {
    return {
      status: 'scored',
      score: 2,
      eligibleForPlacement: true,
      evidence: [raw.slice(0, 80)],
      reasonCode: 'target_met',
    };
  }
  if (q.id === 'Q10' && /\b(nine|9:00|09:00)\b/.test(lower) && !/thirty|30/.test(lower)) {
    return {
      status: 'scored',
      score: 1,
      eligibleForPlacement: true,
      evidence: [raw.slice(0, 80)],
      reasonCode: 'target_partially_demonstrated',
    };
  }
  if (q.id === 'Q04' && /\bwater\b/.test(lower)) {
    return {
      status: 'scored',
      score: 2,
      eligibleForPlacement: true,
      evidence: [raw.slice(0, 80)],
      reasonCode: 'target_met',
    };
  }
  if (q.id === 'Q11') {
    const past = /\b(went|stayed|watched|played|did|was|were)\b/.test(lower);
    const who =
      /\b(friend|friends|family|mom|dad|alone|myself|sister|brother|with)\b/.test(
        lower,
      );
    if (past && who) {
      return {
        status: 'scored',
        score: 2,
        eligibleForPlacement: true,
        evidence: [raw.slice(0, 80)],
        reasonCode: 'target_met',
      };
    }
    if (past || who) {
      return {
        status: 'scored',
        score: 1,
        eligibleForPlacement: true,
        evidence: [raw.slice(0, 80)],
        reasonCode: 'target_partially_demonstrated',
      };
    }
  }
  if (thaiOnly(raw)) {
    return {
      status: 'scored',
      score: 1,
      eligibleForPlacement: true,
      evidence: [raw.slice(0, 80)],
      reasonCode: 'target_partially_demonstrated',
    };
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
  if (q.id === 'Q11') {
    if (/\bmovie|film\b/.test(lower)) next.weekendActivity = 'the movie';
    else if (/\bbeach\b/.test(lower)) next.weekendActivity = 'that place';
    else if (/\bhome|house|alone\b/.test(lower)) next.weekendActivity = 'home';
    else if (transcript.trim()) next.weekendActivity = 'that';
  }
  if (q.id === 'Q13') {
    if (/\bmountain/.test(lower)) next.preference = 'mountains';
    else if (/\bbeach|sea\b/.test(lower)) next.preference = 'beach';
    else next.preference = 'other';
  }
  if (q.id === 'Q17' && /\b(late|rain|miss|cancel|wrong)\b/.test(lower)) {
    next.storyProblem = transcript.trim().slice(0, 80);
  }
  return next;
}

export function applyPlacementEvaluation(
  state: PlacementRuntimeState,
  evaluation: PlacementItemResult,
): { state: PlacementRuntimeState; reply: PlacementTurnReply } {
  const q = getPlacementQuestion(evaluation.questionId);
  if (!q) {
    return finish(state, 'insufficient_evidence');
  }

  const results = { ...state.results, [q.id]: evaluation };
  let asked = state.askedQuestionIds.includes(q.id)
    ? state.askedQuestionIds
    : [...state.askedQuestionIds, q.id];

  let next: PlacementRuntimeState = {
    ...state,
    results,
    askedQuestionIds: asked,
    facts: captureFacts(q, evaluation.evidence[0] ?? '', state.facts),
    consecutiveZeros:
      evaluation.eligibleForPlacement && evaluation.score === 0
        ? state.consecutiveZeros + 1
        : evaluation.eligibleForPlacement
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
    const scores = bandEligibleScores(next, q.band);
    const status = bandStatus(scores);
    if (q.band === 'B1' && status === 'confirmed') {
      return finish(next, 'b1_confirmed');
    }
    return finish(next, status === 'insufficient_evidence' ? 'insufficient_evidence' : 'band_not_confirmed');
  }

  const nextQ = getPlacementQuestion(upcoming)!;
  next = {
    ...next,
    currentQuestionId: nextQ.id,
    askedQuestionIds: next.askedQuestionIds.includes(nextQ.id)
      ? next.askedQuestionIds
      : [...next.askedQuestionIds, nextQ.id],
    audioOnlyAnnounced:
      next.audioOnlyAnnounced || Boolean(nextQ.transitionTh) || nextQ.id === 'Q09',
  };

  const ack = q.afterScoreEn ?? 'Thanks!';
  const prefixTh = nextQ.transitionTh && !state.audioOnlyAnnounced ? nextQ.transitionTh : '';
  return { state: next, reply: npcForQuestion(next, nextQ, ack, prefixTh) };
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
  const { progressTurn, progressMax } = progressInBand(state);
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
  return {
    questionId: q.id,
    attemptId: randomUUID(),
    exactPrompt: prompt,
    variantId,
    ...partial,
  };
}

export function currentPlacementQuestion(
  state: PlacementRuntimeState,
): PlacementQuestion | undefined {
  return state.currentQuestionId
    ? PLACEMENT_QUESTION_BY_ID.get(state.currentQuestionId)
    : undefined;
}
