import type { TurnExchangeResponse, TurnVisualCue } from '../common/api.types';
import { describeItImageUrl } from '../describe-it/describe-it.data';
import type {
  InteractiveScenarioBeat,
  InteractiveScenarioDef,
  InteractiveScenarioGoal,
  ScenarioSlot,
} from './interactive-scenario.types';

export type ScenarioJudgeTier = 'correct' | 'close' | 'incorrect';

export type ScenarioRuntimeState = {
  scenarioId: string;
  beatIndex: number;
  checkpoints: Record<string, boolean>;
  attemptCount: number;
  hintsUsed: number;
  goalHintLevels: Record<string, number>;
  /** Wrong attempts per beat id (reset never — analytics). */
  beatAttempts: Record<string, number>;
  /** Learner facts reused in NPC lines. */
  slots: Partial<Record<ScenarioSlot, string>>;
  /** Per-goal outcome for analytics: correct | close | skipped. */
  goalOutcomes: Record<string, 'correct' | 'close' | 'skipped'>;
  /** Last beat answered or moved past — scenario is over. */
  finished: boolean;
};

const DEFAULT_MAX_ATTEMPTS = 3;

export function initScenarioRuntime(
  scenario: InteractiveScenarioDef,
): ScenarioRuntimeState {
  const checkpoints: Record<string, boolean> = {};
  for (const goal of scenario.goals) checkpoints[goal.id] = false;
  return {
    scenarioId: scenario.id,
    beatIndex: 0,
    checkpoints,
    attemptCount: 0,
    hintsUsed: 0,
    goalHintLevels: {},
    beatAttempts: {},
    slots: {},
    goalOutcomes: {},
    finished: false,
  };
}

/** Older in-memory sessions (pre 20-turn) may lack the new fields. */
function withDefaults(state: ScenarioRuntimeState): ScenarioRuntimeState {
  return {
    ...state,
    checkpoints: { ...state.checkpoints },
    goalHintLevels: { ...(state.goalHintLevels ?? {}) },
    beatAttempts: { ...(state.beatAttempts ?? {}) },
    slots: { ...(state.slots ?? {}) },
    goalOutcomes: { ...(state.goalOutcomes ?? {}) },
    finished: state.finished ?? false,
  };
}

// ---------------------------------------------------------------------------
// Text helpers
// ---------------------------------------------------------------------------

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[^\p{L}\p{N}\s']/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokens(text: string): Set<string> {
  return new Set(normalize(text).split(' ').filter(Boolean));
}

function titleCase(s: string): string {
  return s
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

const NOT_A_NAME = new Set([
  'a', 'an', 'the', 'ready', 'fine', 'good', 'ok', 'okay', 'happy', 'tired',
  'hungry', 'from', 'not', 'here', 'very', 'so', 'a', 'student', 'teacher',
  'doctor', 'great', 'well', 'thai', 'sorry', 'yes', 'no', 'hello', 'hi',
  'twenty', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen',
  'sixteen', 'seventeen', 'eighteen', 'nineteen', 'thirty', 'forty', 'fifty',
  'living', 'going', 'in', 'is', 'my', 'name', 'and', 'nice', 'to', 'meet', 'you',
  'i', "i'm", 'im', 'am', 'me', 'it', 'what', 'maybe', 'thank', 'thanks',
  // places (so "Thailand" alone is not taken as a name)
  'thailand', 'bangkok', 'chiang', 'phuket', 'pattaya', 'japan', 'china', 'korea',
  'laos', 'vietnam', 'myanmar', 'cambodia', 'malaysia', 'singapore', 'england', 'america',
]);

/** "My name is maya" / "I'm Max" / "Maya" → "Maya". */
export function extractName(transcript: string): string | null {
  const raw = normalize(transcript);
  if (!raw) return null;
  const m = raw.match(
    /\b(?:my name is|my name's|my name|call me|i am|i'm|im)\s+([\p{L}][\p{L}'-]*)/u,
  );
  if (m) {
    const candidate = m[1]!;
    // "I'm ready" / "I am fine" — a frame was used but no name was given.
    return !NOT_A_NAME.has(candidate) && !/^\d/.test(candidate)
      ? titleCase(candidate)
      : null;
  }
  const words = raw.split(' ').filter((w) => !['hi', 'hello', 'hey'].includes(w));
  if (words.length >= 1 && words.length <= 2 && !NOT_A_NAME.has(words[0]!)) {
    return titleCase(words[0]!);
  }
  return null;
}

/** "I live in chiang mai" → "Chiang Mai"; falls back to "from X". */
export function extractCity(transcript: string): string | null {
  const raw = normalize(transcript);
  const grab = (re: RegExp): string | null => {
    const m = raw.match(re);
    if (!m?.[1]) return null;
    const words = m[1].split(' ');
    const out: string[] = [];
    for (const w of words) {
      if (['and', 'i', 'but', 'now', 'city', 'too', 'with', 'my'].includes(w)) break;
      out.push(w);
      if (out.length >= 3) break;
    }
    const s = out.join(' ').trim();
    return s ? titleCase(s) : null;
  };
  return grab(/\blive (?:in|at) ([\p{L} ]+)/u) ?? grab(/\bfrom ([\p{L} ]+)/u);
}

function looksLikeQuestion(transcript: string): boolean {
  if (transcript.includes('?')) return true;
  const raw = normalize(transcript);
  return /^(how|what|what's|whats|where|where's|who|who's|when|do|does|are|is|can|could|would|have|did)\b/.test(
    raw,
  );
}

/** Teacher John's answers to the learner's free question (A1-safe English). */
export function answerLearnerQuestion(transcript: string): string {
  const raw = normalize(transcript);
  const rules: Array<[RegExp, string]> = [
    [/\bhow are you\b/, "I'm great, thank you!"],
    [/\bhow old\b/, 'I am thirty-five.'],
    [/\b(your name|who are you)\b/, 'My name is John. I am your teacher!'],
    [/\bwhere are you from\b|\bfrom\b/, "I'm from Canada."],
    [/\bwhere do you live\b|\blive\b/, 'I live in Bangkok now.'],
    [/\bbirthday\b/, 'My birthday is in June.'],
    [/\bwhat (do you do|is your job)\b|\bjob\b|\bwork\b/, 'I am a teacher. I work every day!'],
    [/\bwhat time\b|\bwake up\b/, 'I wake up at six.'],
    [/\b(do you like|you like)\b/, 'Yes, I do!'],
    [/\bcan you\b/, 'Yes, I can!'],
    [/\b(do you have|have you)\b/, 'Yes, I do!'],
    [/\bare you\b/, 'Yes, I am!'],
    [/\bdo you\b/, 'Yes, I do!'],
    [/\bwhere is\b/, 'It is over there.'],
    [/\bwhat is this\b|\bwhat is that\b/, 'It is my bag!'],
    [/\bwho is\b/, 'That is my friend, Max.'],
  ];
  for (const [re, answer] of rules) {
    if (re.test(raw)) return answer;
  }
  return 'Hmm, good one!';
}

/** Fill {name}/{city}. Returns null if a slot is missing. */
function fillStrict(
  template: string,
  slots: ScenarioRuntimeState['slots'],
): string | null {
  let missing = false;
  const out = template.replace(/\{(name|city)\}/g, (_, key: ScenarioSlot) => {
    const v = slots[key];
    if (!v) missing = true;
    return v ?? '';
  });
  return missing ? null : out;
}

/** Fill {name}/{city} with friendly fallbacks — never leaves a placeholder. */
function fillLoose(
  template: string,
  slots: ScenarioRuntimeState['slots'],
): string {
  return template
    .replace(/\{name\}/g, slots.name ?? 'my friend')
    .replace(/\{city\}/g, slots.city ?? 'your city')
    .replace(/^my friend/, 'My friend');
}

function pickPraise(
  beat: InteractiveScenarioBeat,
  slots: ScenarioRuntimeState['slots'],
): string {
  for (const line of beat.praiseEn) {
    const filled = fillStrict(line, slots);
    if (filled) return filled;
  }
  return beat.praiseEn.length ? fillLoose(beat.praiseEn[0]!, slots) : '';
}

function joinTh(note: string, line: string): string {
  return [note, line].filter((x) => x.trim()).join(' · ');
}

/** Model answer revealed after a failed beat (goal hint, slots filled). */
function revealModel(
  scenario: InteractiveScenarioDef,
  beat: InteractiveScenarioBeat,
  slots: ScenarioRuntimeState['slots'],
): string | null {
  const goal = scenario.goals.find((g) => beat.focusGoalIds.includes(g.id));
  const model = goal?.hints.modelEn?.trim();
  return model ? fillLoose(model, slots) : null;
}

/** Empty / noise transcripts — never worth an AI call. */
export function isScenarioNoise(transcript: string): boolean {
  const raw = normalize(transcript);
  if (!raw) return true;
  const words = raw.split(' ');
  return (
    words.length === 1 &&
    ['uh', 'um', 'hmm', 'ah', 'eh', 'er', 'mm', 'banana', 'test', 'asdf', 'zzz'].includes(words[0]!)
  );
}

// ---------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------

/** Meaning-oriented local match — examples + regex seeds, not exclusive scripts. */
export function softMatchGoal(
  transcript: string,
  goal: InteractiveScenarioGoal,
): boolean {
  const raw = normalize(transcript);
  if (!raw || isScenarioNoise(transcript)) return false;
  const t = tokens(raw);

  for (const example of goal.acceptExamples) {
    const ex = normalize(example);
    if (!ex) continue;
    if (` ${raw} `.includes(` ${ex} `)) return true;
    const exTokens = [...tokens(ex)];
    if (exTokens.length > 1 && exTokens.every((w) => t.has(w))) return true;
  }

  if (goal.id === 'name' && extractName(transcript) !== null) return true;
  if (goal.id === 'ask_back') return looksLikeQuestion(transcript);

  for (const src of goal.matchPatterns ?? []) {
    try {
      if (new RegExp(src, 'iu').test(raw)) return true;
    } catch {
      // bad authored regex — ignore
    }
  }
  return false;
}

export function currentScenarioBeat(
  scenario: InteractiveScenarioDef,
  state: Pick<ScenarioRuntimeState, 'beatIndex'>,
): InteractiveScenarioBeat {
  return scenario.beats[Math.min(state.beatIndex, scenario.beats.length - 1)]!;
}

/** True when the transcript passes the current beat without AI help. */
export function localMatchCurrentBeat(
  scenario: InteractiveScenarioDef,
  state: ScenarioRuntimeState,
  transcript: string,
): boolean {
  const beat = currentScenarioBeat(scenario, state);
  if (beat.ungraded) return true;
  if (beat.learnerMayAsk && looksLikeQuestion(transcript)) return true;
  return beat.focusGoalIds.some((id) => {
    const goal = scenario.goals.find((g) => g.id === id);
    return goal ? softMatchGoal(transcript, goal) : false;
  });
}

// ---------------------------------------------------------------------------
// Turn building
// ---------------------------------------------------------------------------

function visualForBeat(
  scenario: InteractiveScenarioDef,
  beat: InteractiveScenarioBeat,
): TurnVisualCue | null {
  const scene = scenario.scenes.find((s) => s.id === beat.sceneId);
  const imageAsset = beat.imageAsset ?? scene?.imageAsset;
  if (!imageAsset && !beat.visualLayout && !beat.imagePath) return null;
  return {
    sceneId: beat.sceneId,
    imageAsset,
    ...(beat.imagePath ? { imageUrl: describeItImageUrl(beat.imagePath) } : {}),
    // focus_image only once a dedicated per-beat image exists; until then the
    // emoji cards carry the stimulus and John stays beside the scene.
    layout: beat.imageAsset ? (beat.visualLayout ?? 'beside_teacher') : 'beside_teacher',
  };
}

function nextOpenBeatIndex(
  scenario: InteractiveScenarioDef,
  from: number,
  checkpoints: Record<string, boolean>,
): number {
  let idx = from;
  while (idx < scenario.beats.length - 1) {
    const b = scenario.beats[idx]!;
    if (b.ungraded || b.focusGoalIds.length === 0) break;
    if (!b.focusGoalIds.every((id) => checkpoints[id])) break;
    idx += 1;
  }
  return idx;
}

export function buildScenarioOpening(
  scenario: InteractiveScenarioDef,
  rawState: ScenarioRuntimeState,
): TurnExchangeResponse {
  const state = withDefaults(rawState);
  const beat = currentScenarioBeat(scenario, state);
  return {
    aiResponse: fillLoose(scenario.openingEn || beat.promptEn, state.slots),
    textTh: scenario.openingTh ?? beat.promptTh ?? '',
    isTaskComplete: false,
    updatedCheckpoints: { ...state.checkpoints },
    feedbackHints: { mispronouncedWords: [] },
    currentTurn: 0,
    expectsUserSpeech: true,
    visual: visualForBeat(scenario, beat),
    emojiChoice: beat.emojiChoice ?? null,
  };
}

export function processScenarioTurn(params: {
  scenario: InteractiveScenarioDef;
  state: ScenarioRuntimeState;
  transcript: string;
  /** Optional AI verdict for the current beat (used when local match failed). */
  judge?: ScenarioJudgeTier | null;
  /** Minimal correction of the learner's own sentence (AI judge, close tier). */
  judgeCorrected?: string | null;
}): { state: ScenarioRuntimeState; reply: TurnExchangeResponse } {
  const { scenario } = params;
  const state = withDefaults(params.state);
  state.attemptCount += 1;
  const transcript = params.transcript.trim();
  const beat = currentScenarioBeat(scenario, state);
  const maxAttempts = scenario.maxAttemptsPerBeat ?? DEFAULT_MAX_ATTEMPTS;

  if (state.finished) {
    return {
      state,
      reply: {
        aiResponse: fillLoose(scenario.completionEn, state.slots),
        textTh: scenario.completionTh,
        isTaskComplete: true,
        updatedCheckpoints: { ...state.checkpoints },
        feedbackHints: { mispronouncedWords: [] },
        currentTurn: state.attemptCount,
        expectsUserSpeech: false,
        assessmentTier: 'correct',
        visual: visualForBeat(scenario, beat),
      },
    };
  }

  const localPass = localMatchCurrentBeat(scenario, state, transcript);
  const tier: ScenarioJudgeTier = localPass
    ? 'correct'
    : (params.judge ?? 'incorrect');
  const passed = tier !== 'incorrect';
  const isLastBeat = state.beatIndex >= scenario.beats.length - 1;

  let reaction = '';
  let wasSoftAdvance = false;
  /** Thai line prepended to the next subtitle (answer reveal / recast). */
  let noteTh = '';

  if (passed) {
    for (const id of beat.focusGoalIds) {
      state.checkpoints[id] = true;
      state.goalOutcomes[id] = tier === 'close' ? 'close' : 'correct';
    }
    const captures = beat.capture
      ? Array.isArray(beat.capture) ? beat.capture : [beat.capture]
      : [];
    if (captures.includes('name')) {
      const name = extractName(transcript);
      if (name) state.slots.name = name;
    }
    if (captures.includes('city')) {
      const city = extractCity(transcript);
      if (city) state.slots.city = city;
    }
    const praise = pickPraise(beat, state.slots);
    reaction = beat.learnerMayAsk
      ? `${answerLearnerQuestion(transcript)} ${praise}`.trim()
      : praise;
    // Close = pass, but model the fixed version of the learner's own sentence.
    const corrected = params.judgeCorrected?.trim().replace(/[.!?]+$/, '');
    if (tier === 'close' && corrected) {
      reaction = `${reaction} We say: ${corrected}.`.trim();
      noteTh = `เกือบถูกแล้ว! พูดว่า “${corrected}.”`;
    }
  } else {
    const attempts = (state.beatAttempts[beat.id] ?? 0) + 1;
    state.beatAttempts[beat.id] = attempts;

    if (attempts < maxAttempts) {
      const focusGoal = scenario.goals.find((g) =>
        beat.focusGoalIds.includes(g.id),
      );
      const retryEn = fillLoose(beat.retryEn ?? beat.promptEn, state.slots);
      const aiResponse =
        attempts === 1
          ? `Hmm… not yet. Try again! ${retryEn}`
          : `Almost! ${retryEn}`;
      const reply: TurnExchangeResponse = {
        aiResponse,
        textTh: `ลองอีกครั้งนะครับ — ${beat.retryTh ?? focusGoal?.hints.intentTh ?? ''}`.trim(),
        isTaskComplete: false,
        updatedCheckpoints: { ...state.checkpoints },
        feedbackHints: { mispronouncedWords: [] },
        currentTurn: state.attemptCount,
        expectsUserSpeech: true,
        assessmentTier: 'incorrect',
        visual: visualForBeat(scenario, beat),
        emojiChoice: attempts >= 2 ? null : (beat.emojiChoice ?? null),
        guidedSpeaking: attempts >= 2 ? (beat.retryGuided ?? null) : null,
      };
      return { state, reply };
    }

    // Out of attempts (assessment: 1) — reveal the model answer, then move on.
    // Goal stays unchecked.
    for (const id of beat.focusGoalIds) {
      if (!state.checkpoints[id]) state.goalOutcomes[id] = 'skipped';
    }
    wasSoftAdvance = true;
    const model = revealModel(scenario, beat, state.slots);
    reaction = model
      ? `You can say: ${model} Next!`
      : 'OK, next!';
    noteTh = model ? `เฉลย: “${model}”` : '';
  }

  if (isLastBeat) {
    state.finished = true;
    const closing = fillLoose(scenario.completionEn, state.slots);
    return {
      state,
      reply: {
        aiResponse: wasSoftAdvance
          ? `${reaction.replace(/ Next!$/, '')} ${closing}`.trim()
          : `${reaction} ${closing}`.trim(),
        textTh: joinTh(noteTh, scenario.completionTh),
        isTaskComplete: true,
        updatedCheckpoints: { ...state.checkpoints },
        feedbackHints: { mispronouncedWords: [] },
        currentTurn: state.attemptCount,
        expectsUserSpeech: false,
        assessmentTier: passed ? tier : 'incorrect',
        wasSoftAdvance,
        visual: visualForBeat(scenario, beat),
      },
    };
  }

  state.beatIndex = nextOpenBeatIndex(
    scenario,
    state.beatIndex + 1,
    state.checkpoints,
  );
  const next = currentScenarioBeat(scenario, state);
  const nextPrompt = fillLoose(next.promptEn, state.slots);

  return {
    state,
    reply: {
      aiResponse: `${reaction} ${nextPrompt}`.trim(),
      textTh: joinTh(noteTh, next.promptTh ?? ''),
      isTaskComplete: false,
      updatedCheckpoints: { ...state.checkpoints },
      feedbackHints: { mispronouncedWords: [] },
      currentTurn: state.attemptCount,
      expectsUserSpeech: true,
      assessmentTier: passed ? tier : 'incorrect',
      wasSoftAdvance,
      visual: visualForBeat(scenario, next),
      emojiChoice: next.emojiChoice ?? null,
    },
  };
}

export function scenarioHintForState(
  scenario: InteractiveScenarioDef,
  rawState: ScenarioRuntimeState,
): {
  hints: Array<{ id: string; label: string; sentenceEn: string; pronunciation?: string }>;
  nextState: ScenarioRuntimeState;
} {
  const state = withDefaults(rawState);
  const beat = currentScenarioBeat(scenario, state);
  const focusId =
    beat.focusGoalIds.find((id) => !state.checkpoints[id]) ??
    beat.focusGoalIds[0];
  const goal = scenario.goals.find((g) => g.id === focusId);
  if (!goal) {
    return { hints: [], nextState: state };
  }
  const level = Math.min((state.goalHintLevels[goal.id] ?? 0) + 1, 3);
  const nextState: ScenarioRuntimeState = {
    ...state,
    hintsUsed: state.hintsUsed + 1,
    goalHintLevels: { ...state.goalHintLevels, [goal.id]: level },
  };
  const hints = [
    { id: `${goal.id}_intent`, label: 'เจตนา', sentenceEn: goal.hints.intentTh },
    { id: `${goal.id}_starter`, label: 'เริ่มพูด', sentenceEn: goal.hints.starterEn },
    { id: `${goal.id}_model`, label: 'ประโยคเต็ม', sentenceEn: goal.hints.modelEn },
  ].slice(0, level);
  return { hints, nextState };
}
