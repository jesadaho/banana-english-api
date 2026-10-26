import type { TurnExchangeResponse, TurnVisualCue } from '../common/api.types';
import { describeItImageUrl } from '../describe-it/describe-it.data';
import type {
  InteractiveScenarioBeat,
  InteractiveScenarioDef,
  InteractiveScenarioGoal,
  InteractiveScenarioTeacher,
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

/** "I like playing games" → "playing games". */
export function extractHobby(transcript: string): string | null {
  const raw = normalize(transcript);
  const m = raw.match(/\b(?:like|love|enjoy)\s+(?:to\s+)?(.+)$/);
  if (!m?.[1]) return null;
  const hobby = m[1]
    .replace(/\b(in my free time|a lot|very much|too)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!hobby || hobby.split(' ').length > 6) return null;
  return hobby;
}

/** "I'd like to join the art club" → "art club". */
export function extractClub(transcript: string): string | null {
  const raw = normalize(transcript);
  const m = raw.match(/\b(?:the\s+)?([a-z]+(?:\s+[a-z]+)?)\s+club\b/);
  return m?.[1] ? `${m[1]} club` : null;
}

/** "How about Saturday evening?" → "Saturday evening". */
export function extractWhen(transcript: string): string | null {
  const raw = normalize(transcript);
  const day = raw.match(
    /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/,
  );
  if (!day) return null;
  return `${titleCase(day[1]!)} evening`;
}

function captureSlots(
  captures: ScenarioSlot[],
  transcript: string,
  slots: ScenarioRuntimeState['slots'],
) {
  for (const slot of captures) {
    if (slot === 'name') {
      const name = extractName(transcript);
      if (name) slots.name = name;
    } else if (slot === 'city') {
      const city = extractCity(transcript);
      if (city) slots.city = city;
    } else if (slot === 'hobby') {
      const hobby = extractHobby(transcript);
      if (hobby) slots.hobby = hobby;
    } else if (slot === 'club') {
      const club = extractClub(transcript);
      if (club) slots.club = club;
    } else if (slot === 'when') {
      const when = extractWhen(transcript);
      if (when) slots.when = when;
    }
  }
}

function shouldSkipBeat(
  beat: InteractiveScenarioBeat,
  slots: ScenarioRuntimeState['slots'],
): boolean {
  const rule = beat.skipWhenSlot;
  if (!rule) return false;
  const value = slots[rule.slot];
  if (!value) return false;
  try {
    return new RegExp(rule.pattern, 'iu').test(value);
  } catch {
    return false;
  }
}

/** Mark skipped beats done and return the first beat that still needs asking. */
function consumeSkippedBeats(
  scenario: InteractiveScenarioDef,
  from: number,
  state: ScenarioRuntimeState,
): { index: number; confirm: string } {
  let idx = from;
  let confirm = '';
  while (idx < scenario.beats.length) {
    const beat = scenario.beats[idx]!;
    if (!shouldSkipBeat(beat, state.slots)) break;
    for (const id of beat.focusGoalIds) {
      state.checkpoints[id] = true;
      if (!state.goalOutcomes[id]) state.goalOutcomes[id] = 'correct';
    }
    if (beat.skipConfirmEn) {
      confirm = fillLoose(beat.skipConfirmEn, state.slots);
    }
    if (idx >= scenario.beats.length - 1) break;
    idx += 1;
  }
  return { index: idx, confirm };
}

function looksLikeQuestion(transcript: string): boolean {
  if (transcript.includes('?')) return true;
  const raw = normalize(transcript);
  return /^(how|what|what's|whats|where|where's|who|who's|when|do|does|are|is|can|could|would|have|did)\b/.test(
    raw,
  );
}

function teacherNameLine(teacher: InteractiveScenarioTeacher): string {
  if (teacher === 'minnie') return 'My name is Minnie!';
  if (teacher === 'nina') return 'My name is Nina!';
  return 'My name is John. I am your teacher!';
}

function teacherAnswers(teacher: InteractiveScenarioTeacher): Array<[RegExp, string]> {
  const from =
    teacher === 'minnie' ? "I'm from England." :
    teacher === 'nina' ? "I'm from Bangkok." :
    "I'm from Canada.";
  const age =
    teacher === 'minnie' ? 'I am twenty-eight.' :
    teacher === 'nina' ? 'I am twenty-four.' :
    'I am thirty-five.';
  const extra: Array<[RegExp, string]> =
    teacher === 'nina'
      ? [
          [/\bgood at\b/, "I'm good at exploring new places!"],
          [/\bkey ring\b/, "It's 80 baht."],
          [/\bpostcard\b/, "It's 30 baht."],
          [/\bbag\b/, "It's 120 baht."],
          [/\bhow much\b/, "It's 80 baht."],
        ]
      : [];
  return [
    ...extra,
    [/\bhow are you\b/, "I'm great, thank you!"],
    [/\bhow old\b/, age],
    [/\b(your name|who are you)\b/, teacherNameLine(teacher)],
    [/\bwhere are you from\b|\bfrom\b/, from],
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
}

/** Teacher answers to the learner's free question (A1-safe English). */
export function answerLearnerQuestion(
  transcript: string,
  teacher: InteractiveScenarioTeacher = 'john',
): string {
  const raw = normalize(transcript);
  for (const [re, answer] of teacherAnswers(teacher)) {
    if (re.test(raw)) return answer;
  }
  return 'Hmm, good one!';
}

function politeParticle(teacher: InteractiveScenarioTeacher): 'ครับ' | 'ค่ะ' {
  return teacher === 'minnie' || teacher === 'nina' ? 'ค่ะ' : 'ครับ';
}

/** Latin letters only, uppercased — "Maya" → "MAYA", "Somchai" → "SOMCHAI". */
export function latinLettersOf(name: string | undefined): string {
  return (name ?? '').toUpperCase().replace(/[^A-Z]/g, '');
}

/** "Maya" → "M A Y A". Null when there are fewer than 2 Latin letters. */
export function spellNameOut(name: string | undefined): string | null {
  const letters = latinLettersOf(name);
  return letters.length >= 2 ? letters.split('').join(' ') : null;
}

const LETTER_TOKENS: Record<string, string> = {
  a: 'a', ay: 'a', ey: 'a', ei: 'a',
  b: 'b', bee: 'b', be: 'b',
  c: 'c', see: 'c', sea: 'c', cee: 'c',
  d: 'd', dee: 'd',
  e: 'e', ee: 'e',
  f: 'f', ef: 'f', eff: 'f',
  g: 'g', gee: 'g',
  h: 'h', aitch: 'h', haitch: 'h',
  i: 'i', eye: 'i', aye: 'i',
  j: 'j', jay: 'j',
  k: 'k', kay: 'k',
  l: 'l', el: 'l', ell: 'l',
  m: 'm', em: 'm',
  n: 'n', en: 'n',
  o: 'o', oh: 'o', owe: 'o',
  p: 'p', pee: 'p', pe: 'p',
  q: 'q', cue: 'q', queue: 'q', kyu: 'q',
  r: 'r', ar: 'r', are: 'r',
  s: 's', ess: 's', es: 's',
  t: 't', tee: 't', tea: 't',
  u: 'u', you: 'u', yu: 'u',
  v: 'v', vee: 'v',
  w: 'w',
  x: 'x', ex: 'x', eks: 'x',
  y: 'y', why: 'y', wai: 'y',
  z: 'z', zee: 'z', zed: 'z',
};

/** "M A Y A" / "em ay why ay" → "MAYA". */
export function extractSpelledLetters(transcript: string): string {
  const raw = normalize(transcript)
    .replace(/\b(my name is|i spell|it is spelled|it's spelled|is spelled)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const tokens = raw.split(' ').filter(Boolean);
  const letters: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]!;
    if (t === 'double' && tokens[i + 1] === 'u') {
      letters.push('w');
      i += 1;
      continue;
    }
    if (t === 'doubleu' || t === 'doubleyou') {
      letters.push('w');
      continue;
    }
    if (/^[a-z]$/.test(t)) {
      letters.push(t);
      continue;
    }
    const mapped = LETTER_TOKENS[t];
    if (mapped) letters.push(mapped);
  }
  return letters.join('').toUpperCase();
}

/** Spelling beat: letters of the captured name, or the name said as a word. */
export function matchNameSpelling(
  transcript: string,
  name: string | undefined,
): boolean {
  if (isScenarioNoise(transcript)) return false;
  const expected = latinLettersOf(name);
  const raw = normalize(transcript);
  const tokens = raw.split(' ').filter(Boolean);
  const spokenWord = raw.replace(/[^a-z]/g, '');
  if (expected.length >= 2) {
    const want = expected.toLowerCase();
    if (spokenWord === want || tokens.includes(want)) return true;
  }
  const spelled = extractSpelledLetters(transcript);
  if (expected.length >= 2) return spelled === expected;
  return spelled.length >= 2;
}

const SLOT_FALLBACK: Record<ScenarioSlot, string> = {
  name: 'my friend',
  city: 'your city',
  hobby: 'that',
  club: 'that club',
  when: 'Saturday evening',
};

/** Fill {slots}. Returns null if a referenced slot is missing. */
function fillStrict(
  template: string,
  slots: ScenarioRuntimeState['slots'],
): string | null {
  let missing = false;
  const out = template.replace(
    /\{(name|city|hobby|club|when)\}/g,
    (_, key: ScenarioSlot) => {
      const v = slots[key];
      if (!v) missing = true;
      return v ?? '';
    },
  );
  return missing ? null : out;
}

/** Fill {slots} with friendly fallbacks — never leaves a placeholder. */
function fillLoose(
  template: string,
  slots: ScenarioRuntimeState['slots'],
): string {
  return template
    .replace(/\{(name|city|hobby|club|when)\}/g, (_, key: ScenarioSlot) => slots[key] ?? SLOT_FALLBACK[key])
    .replace(/^my friend/, 'My friend');
}

const RETRY_LEAD_FIRST = 'Hmm… not yet. Try again!';
const RETRY_LEAD_AGAIN = 'Almost!';

/**
 * Every fixed line a scenario speaks, one clip each: openings, prompts,
 * retries, praise, teacher answers and closings. Never the joined
 * "reaction + next question" string — playback stitches halves via speechParts.
 * Lines with {slots} are learner-specific and stay live.
 */
export function collectInteractiveScenarioBankLines(
  scenarios: InteractiveScenarioDef[],
): string[] {
  const lines = new Set<string>();
  const add = (text: string | null | undefined) => {
    const key = (text ?? '').replace(/\s+/g, ' ').trim();
    if (key && !key.includes('{')) lines.add(key);
  };
  add(RETRY_LEAD_FIRST);
  add(RETRY_LEAD_AGAIN);
  add('OK, next!');
  add('Hmm, good one!');
  const teachers = new Set(scenarios.map((s) => s.teacher));
  for (const teacher of ['john', 'minnie', 'nina'] as const) {
    if (!teachers.has(teacher)) continue;
    for (const [, answer] of teacherAnswers(teacher)) add(answer);
  }
  for (const scenario of scenarios) {
    add(scenario.openingEn);
    add(scenario.completionEn);
    for (const beat of scenario.beats) {
      add(beat.promptEn);
      add(beat.retryEn);
      add(beat.skipConfirmEn);
      for (const praise of beat.praiseEn) add(praise);
    }
  }
  return [...lines];
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
  if (beat.sttMode === 'name_spelling') {
    return spellNameOut(slots.name) ?? 'M A Y A';
  }
  const goal = scenario.goals.find((g) => beat.focusGoalIds.includes(g.id));
  const model = goal?.hints.modelEn?.trim();
  return model ? fillLoose(model, slots) : null;
}

function sttFields(
  beat: InteractiveScenarioBeat,
  slots: ScenarioRuntimeState['slots'],
): Pick<TurnExchangeResponse, 'expectedSpeech' | 'sttMode'> {
  if (beat.sttMode === 'name_spelling') {
    return {
      expectedSpeech: spellNameOut(slots.name) ?? 'M A Y A',
      sttMode: 'name_spelling',
    };
  }
  const expected = beat.expectedSpeech?.trim();
  return expected ? { expectedSpeech: fillLoose(expected, slots) } : {};
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
  if (beat.sttMode === 'name_spelling') {
    return matchNameSpelling(transcript, state.slots.name);
  }
  if (beat.learnerMayAsk && looksLikeQuestion(transcript)) {
    const patterned = beat.focusGoalIds
      .map((id) => scenario.goals.find((g) => g.id === id))
      .filter((g): g is InteractiveScenarioGoal => Boolean(g?.matchPatterns?.length));
    if (patterned.length === 0) return true;
    return patterned.some((g) => softMatchGoal(transcript, g));
  }
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
    // focus_image only for bundled per-beat art; remote picture cards
    // (imageUrl) render beside John.
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
    ...sttFields(beat, state.slots),
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
    captureSlots(captures, transcript, state.slots);
    const praise = pickPraise(beat, state.slots);
    const answersBack =
      beat.learnerMayAsk &&
      (scenario.teacher === 'john' ||
        scenario.teacher === 'minnie' ||
        scenario.teacher === 'nina');
    reaction = answersBack
      ? `${answerLearnerQuestion(transcript, scenario.teacher)} ${praise}`.trim()
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
      const retryLead = attempts === 1 ? RETRY_LEAD_FIRST : RETRY_LEAD_AGAIN;
      const aiResponse = `${retryLead} ${retryEn}`;
      const reply: TurnExchangeResponse = {
        aiResponse,
        speechParts: { lead: retryLead, body: retryEn },
        textTh: `ลองอีกครั้งนะ${politeParticle(scenario.teacher)} — ${beat.retryTh ?? focusGoal?.hints.intentTh ?? ''}`.trim(),
        isTaskComplete: false,
        updatedCheckpoints: { ...state.checkpoints },
        feedbackHints: { mispronouncedWords: [] },
        currentTurn: state.attemptCount,
        expectsUserSpeech: true,
        assessmentTier: 'incorrect',
        visual: visualForBeat(scenario, beat),
        emojiChoice: attempts >= 2 ? null : (beat.emojiChoice ?? null),
        guidedSpeaking: attempts >= 2 ? (beat.retryGuided ?? null) : null,
        ...sttFields(beat, state.slots),
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
    const closingLead = wasSoftAdvance
      ? reaction.replace(/ Next!$/, '')
      : reaction;
    return {
      state,
      reply: {
        aiResponse: `${closingLead} ${closing}`.trim(),
        speechParts: { lead: closingLead, body: closing },
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

  const skipped = consumeSkippedBeats(scenario, state.beatIndex + 1, state);
  if (skipped.confirm) reaction = `${reaction} ${skipped.confirm}`.trim();
  state.beatIndex = nextOpenBeatIndex(
    scenario,
    skipped.index,
    state.checkpoints,
  );
  const next = currentScenarioBeat(scenario, state);
  const nextPrompt = fillLoose(next.promptEn, state.slots);

  return {
    state,
    reply: {
      aiResponse: `${reaction} ${nextPrompt}`.trim(),
      speechParts: { lead: reaction, body: nextPrompt },
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
      ...sttFields(next, state.slots),
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

// ---------------------------------------------------------------------------
// Scene-level resume (multi-scene checkpoints)
// ---------------------------------------------------------------------------

export type ScenarioSceneProgress = {
  completedSceneIds: string[];
  checkpoints: Record<string, boolean>;
  goalOutcomes: Record<string, 'correct' | 'close' | 'skipped'>;
  slots: Partial<Record<ScenarioSlot, string>>;
};

/** Scenes whose every beat lies before `beatIndex` (or all scenes once finished). */
export function completedSceneIds(
  scenario: InteractiveScenarioDef,
  state: Pick<ScenarioRuntimeState, 'beatIndex' | 'finished'>,
): string[] {
  return scenario.scenes
    .filter((scene) => {
      const indexes = scenario.beats
        .map((beat, index) => (beat.sceneId === scene.id ? index : -1))
        .filter((index) => index >= 0);
      if (indexes.length === 0) return false;
      return state.finished || Math.max(...indexes) < state.beatIndex;
    })
    .map((scene) => scene.id);
}

/**
 * Start state for a learner who already finished some scenes: jump to the first
 * beat of the first unfinished scene and restore what earlier scenes earned.
 * Returns null when there is nothing to resume.
 */
export function resumeScenarioRuntime(
  scenario: InteractiveScenarioDef,
  progress: ScenarioSceneProgress | null | undefined,
): ScenarioRuntimeState | null {
  if (!progress || progress.completedSceneIds.length === 0) return null;
  const done = new Set(progress.completedSceneIds);
  const firstOpen = scenario.beats.findIndex((beat) => !done.has(beat.sceneId));
  if (firstOpen <= 0) return null;
  const state = initScenarioRuntime(scenario);
  for (const goal of scenario.goals) {
    state.checkpoints[goal.id] = Boolean(progress.checkpoints[goal.id]);
  }
  state.goalOutcomes = { ...progress.goalOutcomes };
  state.slots = { ...progress.slots };
  state.beatIndex = firstOpen;
  return state;
}

/** Opening line when resuming mid-scenario: the first open beat's prompt. */
export function buildScenarioResumeOpening(
  scenario: InteractiveScenarioDef,
  state: ScenarioRuntimeState,
): TurnExchangeResponse {
  const beat = currentScenarioBeat(scenario, state);
  const scene = scenario.scenes.find((s) => s.id === beat.sceneId);
  const intro = scene?.titleEn ? `Welcome back! Next: ${scene.titleEn}.` : 'Welcome back!';
  return {
    aiResponse: `${intro} ${fillLoose(beat.promptEn, state.slots)}`.trim(),
    textTh: joinTh(
      scene?.titleTh ? `กลับมาต่อที่ฉาก “${scene.titleTh}”` : 'กลับมาเล่นต่อ',
      beat.promptTh ?? '',
    ),
    isTaskComplete: false,
    updatedCheckpoints: { ...state.checkpoints },
    feedbackHints: { mispronouncedWords: [] },
    currentTurn: 0,
    expectsUserSpeech: true,
    visual: visualForBeat(scenario, beat),
    emojiChoice: beat.emojiChoice ?? null,
    ...sttFields(beat, state.slots),
  };
}
