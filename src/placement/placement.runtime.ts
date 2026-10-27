import { randomUUID } from 'crypto';
import { isScenarioNoise } from '../interactive-scenario/interactive-scenario.runtime';
import { describeItImageUrl } from '../describe-it/describe-it.data';
import {
  PLACEMENT_FIRST_QUESTION_ID,
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
  const lead = prefixEn.trim();
  const spoken = [lead, prompt].filter(Boolean).join(' ');
  return {
    aiResponse: spoken,
    ...(lead ? { speechParts: { lead, body: prompt } } : {}),
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
  const firstId = PLACEMENT_FIRST_QUESTION_ID;
  const q01 = getPlacementQuestion(firstId)!;
  const next: PlacementRuntimeState = {
    ...state,
    openingPlayed: true,
    currentQuestionId: firstId,
    askedQuestionIds: state.askedQuestionIds.includes(firstId)
      ? state.askedQuestionIds
      : [...state.askedQuestionIds, firstId],
  };
  const introTh = openingLines(state);
  const body = npcForQuestion(next, q01, '', REPLAY_HINT_TH);
  const spokenPrompt = exactPromptFor(q01, next).prompt;
  return {
    state: next,
    reply: {
      ...body,
      aiResponse: `${introTh} ${spokenPrompt}`,
      speechParts: { lead: introTh, body: spokenPrompt },
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

/**
 * Lines Whisper-style ASR invents on silence or room noise. A learner never
 * answers a placement item with these, so they mean "ask again", not 0.
 */
const ASR_HALLUCINATIONS = new Set([
  'thank you',
  'thank you very much',
  'thank you so much',
  'thanks',
  'thanks for watching',
  'thank you for watching',
  'please subscribe',
  'bye',
  'bye bye',
  'you',
  'great',
  'hey',
  'hey hey',
  "i'm a t",
]);

function normalizeAsr(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[^a-z0-9' ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * STT runs with language=en, so Thai like "ทำไม่ได้" / "ไม่รู้" / "ไม่เข้าใจ"
 * comes back translated ("You can't do it.", "I don't know."). That is the
 * learner saying they cannot answer: score 0 like a skip, no retry.
 * Whole utterance only — "I don't know her name" is still an answer.
 */
export function placementSaysCannotAnswer(transcript: string): boolean {
  const said = normalizeAsr(transcript);
  if (!said) return false;
  return /^(sorry )?(you can(?:'t|not)(?: do it)?|i can(?:'t|not)(?: do it| answer)?|i don'?t know(?: (?:the answer|how|what to say))?|i don'?t understand|i'?m not sure|no idea|i have no idea)$/.test(
    said,
  );
}

/** Reason text the runtime reads to swap the retry line for "don't repeat me". */
export const PLACEMENT_ECHO_REASON = 'พูดตามคำถามของครู';

/**
 * Whisper echoes its bias prompt ("Thai learner practicing spoken English
 * with a Thai accent.") when the take is near-silent — prod v2.4 scored
 * "Thai learner." / "Tai learner practicing." as off-topic 0s. Ask again.
 */
export function placementSttPromptLeak(transcript: string): boolean {
  const said = normalizeAsr(transcript);
  if (!said) return false;
  return (
    /\bt(h)?ai (learner|accent)/.test(said) ||
    /\blearner practi[cs]ing\b/.test(said) ||
    /\bpracti[cs]ing spoken english\b/.test(said) ||
    /\bwith a t(h)?ai accent\b/.test(said) ||
    /\btranscribe both languages\b/.test(said) ||
    /\bcasual t(h)?ai and english\b/.test(said)
  );
}

/** True when the transcript is ASR noise (silence / room sound). Ask again. */
export function placementCaptureNoise(transcript: string): boolean {
  const said = normalizeAsr(transcript);
  if (!said) return true;
  if (ASR_HALLUCINATIONS.has(said)) return true;
  if (placementSttPromptLeak(transcript)) return true;
  const words = said.split(' ');
  return words.every((w) => w.replace(/'/g, '').length <= 1);
}

/**
 * True when the learner repeated the teacher's line instead of answering
 * (lesson drills train "พูดตาม"). Ask again with a "don't repeat" hint.
 */
export function placementEchoOfTeacher(transcript: string, teacherLine: string): boolean {
  const words = normalizeAsr(transcript).split(' ').filter(Boolean);
  const teacherWords = new Set(
    normalizeAsr(teacherLine)
      .split(' ')
      .filter((w) => w.length > 2),
  );
  const content = words.filter((w) => w.length > 2);
  if (teacherWords.size < 3 || content.length < 3) return false;
  const overlap = content.filter((w) => teacherWords.has(w)).length;
  return overlap >= 3 && overlap / content.length >= 0.8;
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
  if (placementSaysCannotAnswer(raw)) {
    return scored(
      0,
      raw,
      'no_communicative_answer',
      'บอกว่าตอบไม่ได้ (ภาษาไทยที่ระบบถอดเป็นอังกฤษ)',
    );
  }
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

const NOT_A_NAME = new Set([
  'hello', 'hi', 'hey', 'yes', 'no', 'ok', 'okay', 'good', 'morning',
  'afternoon', 'evening', 'thank', 'thanks', 'you', 'what', "what's", 'whats',
  'your', 'name', 'is', 'the', 'a', 'and', 'teacher', 'bee', 'please', 'sorry',
]);

const FEELINGS = new Set([
  'happy', 'sad', 'tired', 'sleepy', 'hungry', 'thirsty', 'ready', 'hot',
  'cold', 'fine', 'good', 'great', 'ok', 'okay', 'well', 'bored', 'sick',
  'excited', 'angry', 'nervous', 'busy', 'alright', 'awesome', 'cool',
  'relaxed', 'stressed', 'worried', 'lazy', 'full', 'bad', 'nice', 'perfect',
  'wonderful', 'fantastic', 'calm', 'fresh', 'sleepy', 'scared', 'shy',
]);

/** "three" as Thai speakers say it and Whisper writes it (prod v2.4 Q06). */
const THREE_STRONG = new Set([
  'three', 'threes', "three's", '3', 'tree', 'trees', 'tri', 'trii', 'ttri',
  'ttrii', 'tui', 'tie', 'thai', 'sri', 'thee',
]);
/** Count as three only next to an apple word ("T-Apples", "tea apple"). */
const THREE_WEAK = new Set(['t', 'tea', 'tee', 'ti', 'tia', 'te', 'tee']);
const OTHER_NUMBERS = new Set([
  'zero', 'one', 'two', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  'ten', '0', '1', '2', '4', '5', '6', '7', '8', '9', '10',
]);

function isAppleWord(word: string): boolean {
  return (
    /^(appl|epp|appo|apo$|apel|aple|appel)/.test(word) ||
    word === 'effort' ||
    word === 'efforts'
  );
}

type LocalScore = Omit<
  PlacementItemResult,
  'questionId' | 'attemptId' | 'exactPrompt' | 'variantId'
>;

function scoreS01(raw: string, words: string[]): LocalScore | null {
  const said = words.join(' ');
  if (/\b(my name(?:'s| is)?|name is|i'?m|i am|call me)\s+[a-z0-9]/.test(said)) {
    return scored(2, raw, 'target_met', 'บอกชื่อเป็นประโยค');
  }
  const content = words.filter((w) => !NOT_A_NAME.has(w));
  if (words.length <= 3 && content.length >= 1) {
    return scored(
      1,
      raw,
      'target_partially_demonstrated',
      'บอกแค่ชื่อ ยังไม่เป็นประโยค (My name is …)',
    );
  }
  return null;
}

function scoreS03(raw: string, words: string[]): LocalScore | null {
  const said = words.join(' ');
  const feeling = words.some((w) => FEELINGS.has(w));
  if (!feeling) return null;
  // "am happy" too: ASR often drops the I'm.
  if (/\b(i'?m|i am|am|i feel|feel|feeling)\b/.test(said)) {
    return scored(2, raw, 'target_met', 'บอกความรู้สึกเป็นประโยค');
  }
  if (words.length <= 3) {
    return scored(
      1,
      raw,
      'target_partially_demonstrated',
      'บอกแค่คำความรู้สึก ยังไม่ใช้ I’m …',
    );
  }
  return null;
}

function scoreQ06(raw: string, words: string[]): LocalScore | null {
  const apple = words.some(isAppleWord);
  const three = words.some(
    (w) => THREE_STRONG.has(w) || (apple && THREE_WEAK.has(w)),
  );
  if (three) {
    return scored(2, raw, 'target_met', 'บอกจำนวน 3 ได้ (รับสำเนียง tree / tri / tui)');
  }
  if (words.some((w) => OTHER_NUMBERS.has(w))) {
    return scored(0, raw, 'off_topic', 'บอกจำนวนไม่ตรงกับภาพ');
  }
  if (apple) {
    return scored(1, raw, 'target_partially_demonstrated', 'บอกแค่ apple ยังไม่บอกจำนวน');
  }
  return null;
}

/**
 * Deterministic scoring for short, closed items (no Gemini call, no tokens).
 * Run after skip / noise / echo / "can't answer" / Thai-only checks; null
 * means "let Gemini judge".
 */
export function placementLocalScore(
  q: PlacementQuestion,
  transcript: string,
): LocalScore | null {
  const raw = transcript.trim();
  const words = normalizeAsr(raw)
    .split(' ')
    .map((w) => w.replace(/^'+|'+$/g, ''))
    .filter(Boolean);
  if (!words.length) return null;
  switch (q.id) {
    case 'S01':
      return scoreS01(raw, words);
    case 'S03':
      return scoreS03(raw, words);
    case 'Q06':
      return scoreQ06(raw, words);
    default:
      return null;
  }
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
    status: assisted ? 'assisted' : 'scored',
    score,
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
        evaluation.reason === PLACEMENT_ECHO_REASON
          ? 'ไม่ต้องพูดตามครูนะครับ ลองตอบคำถามดู หรือข้ามข้อนี้ได้'
          : 'เสียงไม่ชัดครับ ลองพูดอีกครั้ง หรือข้ามข้อนี้ได้',
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
    } else {
      // Second unclear capture: count it as 0 so the stage can still be
      // judged on the other items (an ineligible row fails the gate outright).
      normalized = {
        ...normalized,
        status: 'scored',
        score: 0,
        eligibleForPlacement: true,
        reasonCode: 'capture_error',
        reason: 'จับเสียงไม่ชัดสองครั้ง จึงให้ 0',
      };
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

/** Scripted Teacher B lines for the Level Test TTS bank — halves, never joined. */
export function collectPlacementBankLines(): string[] {
  const lines = new Set<string>();
  const add = (text: string | null | undefined) => {
    const key = (text ?? '').replace(/\s+/g, ' ').trim();
    if (key && !key.includes('{')) lines.add(key);
  };

  add('Thanks!');
  for (const source of ['onboarding', 'profile_settings'] as const) {
    const opened = buildPlacementOpening(
      initPlacementRuntime({ entrySource: source, learnerName: '' }),
    ).reply;
    add(opened.speechParts?.lead);
    add(opened.speechParts?.body);
  }

  const blank = initPlacementRuntime({
    entrySource: 'onboarding',
    learnerName: '',
  });
  for (const id of PLACEMENT_QUESTION_IDS) {
    const q = getPlacementQuestion(id)!;
    add(exactPromptFor(q, blank).prompt);
    add(q.afterScoreEn);
    add(q.followUp?.timePrompt);
    add(q.followUp?.placePrompt);
    add(q.followUp?.prompt);
  }

  add(CLOSING_EN);
  return [...lines].sort((a, b) => a.localeCompare(b));
}
