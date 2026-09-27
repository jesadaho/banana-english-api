import type { TurnExchangeResponse, TurnVisualCue } from '../common/api.types';
import type {
  InteractiveScenarioBeat,
  InteractiveScenarioDef,
  InteractiveScenarioGoal,
} from './interactive-scenario.types';

export type ScenarioRuntimeState = {
  scenarioId: string;
  beatIndex: number;
  checkpoints: Record<string, boolean>;
  attemptCount: number;
  hintsUsed: number;
  goalHintLevels: Record<string, number>;
};

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
  };
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s']/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokens(text: string): Set<string> {
  return new Set(normalize(text).split(' ').filter(Boolean));
}

/** Meaning-oriented soft match — examples seed, not exclusive scripts. */
export function softMatchGoal(
  transcript: string,
  goal: InteractiveScenarioGoal,
): boolean {
  const raw = normalize(transcript);
  if (!raw) return false;
  const t = tokens(raw);

  for (const example of goal.acceptExamples) {
    const ex = normalize(example);
    if (!ex) continue;
    if (raw.includes(ex) || ex.includes(raw)) return true;
    const exTokens = [...tokens(ex)];
    if (exTokens.length > 0 && exTokens.every((w) => t.has(w))) return true;
  }

  switch (goal.id) {
    case 'greet':
      return /\b(hi|hello|hey|good\s+(morning|afternoon|evening))\b/.test(raw);
    case 'name':
      return (
        /\b(my name is|i am|i'm)\b/.test(raw) ||
        (t.has('name') && t.size >= 2)
      );
    case 'from':
      return /\b(from|i'm from|i am from)\b/.test(raw);
    case 'like_or_have':
      return /\b(like|love|have|has)\b/.test(raw);
    case 'can_or_do':
      return (
        /\bcan\b/.test(raw) ||
        /\b(i study|i work|i walk|i play|i read|every day)\b/.test(raw)
      );
    case 'ask_back':
      return (
        raw.includes('?') ||
        /^(how|what|where|who|do|does|are|is|can)\b/.test(raw)
      );
    case 'goodbye':
      return /\b(bye|goodbye|see you|thank you|thanks)\b/.test(raw);
    default:
      return false;
  }
}

function allGoalsDone(
  scenario: InteractiveScenarioDef,
  checkpoints: Record<string, boolean>,
): boolean {
  return scenario.goals.every((g) => checkpoints[g.id] === true);
}

function stickyMerge(
  prev: Record<string, boolean>,
  next: Record<string, boolean>,
): Record<string, boolean> {
  const out = { ...prev };
  for (const [k, v] of Object.entries(next)) {
    if (v) out[k] = true;
  }
  return out;
}

function visualForBeat(
  scenario: InteractiveScenarioDef,
  beat: InteractiveScenarioBeat,
): TurnVisualCue | null {
  const scene = scenario.scenes.find((s) => s.id === beat.sceneId);
  if (!scene?.imageAsset && !beat.visualLayout) return null;
  return {
    sceneId: beat.sceneId,
    imageAsset: scene?.imageAsset,
    layout: beat.visualLayout ?? 'beside_teacher',
  };
}

function currentBeat(
  scenario: InteractiveScenarioDef,
  beatIndex: number,
): InteractiveScenarioBeat {
  return scenario.beats[Math.min(beatIndex, scenario.beats.length - 1)]!;
}

function advanceBeatIndex(
  scenario: InteractiveScenarioDef,
  beatIndex: number,
  checkpoints: Record<string, boolean>,
): number {
  let idx = beatIndex;
  while (idx < scenario.beats.length - 1) {
    const beat = scenario.beats[idx]!;
    const focusDone = beat.focusGoalIds.every((id) => checkpoints[id]);
    if (!focusDone) break;
    idx += 1;
  }
  return idx;
}

export function buildScenarioOpening(
  scenario: InteractiveScenarioDef,
  state: ScenarioRuntimeState,
): TurnExchangeResponse {
  const beat = currentBeat(scenario, state.beatIndex);
  return {
    aiResponse: scenario.openingEn || beat.promptEn,
    textTh: scenario.openingTh ?? beat.promptTh ?? '',
    isTaskComplete: false,
    updatedCheckpoints: { ...state.checkpoints },
    feedbackHints: { mispronouncedWords: [] },
    currentTurn: 0,
    expectsUserSpeech: true,
    visual: visualForBeat(scenario, beat),
  };
}

export function processScenarioTurn(params: {
  scenario: InteractiveScenarioDef;
  state: ScenarioRuntimeState;
  transcript: string;
}): { state: ScenarioRuntimeState; reply: TurnExchangeResponse } {
  const { scenario } = params;
  let state = {
    ...params.state,
    checkpoints: { ...params.state.checkpoints },
    attemptCount: params.state.attemptCount + 1,
  };
  const transcript = params.transcript.trim();
  const beat = currentBeat(scenario, state.beatIndex);

  const newly: Record<string, boolean> = {};
  let matchedFocus = false;
  for (const goalId of beat.focusGoalIds) {
    if (state.checkpoints[goalId]) continue;
    const goal = scenario.goals.find((g) => g.id === goalId);
    if (!goal) continue;
    if (softMatchGoal(transcript, goal)) {
      newly[goalId] = true;
      matchedFocus = true;
    }
  }

  // Free-ask beat: also accept any clear question for ask_back.
  if (beat.learnerMayAsk && !state.checkpoints['ask_back']) {
    const askGoal = scenario.goals.find((g) => g.id === 'ask_back');
    if (askGoal && softMatchGoal(transcript, askGoal)) {
      newly['ask_back'] = true;
      matchedFocus = true;
    }
  }

  state.checkpoints = stickyMerge(state.checkpoints, newly);
  const prevBeat = state.beatIndex;
  state.beatIndex = advanceBeatIndex(scenario, state.beatIndex, state.checkpoints);
  const nextBeat = currentBeat(scenario, state.beatIndex);
  const done = allGoalsDone(scenario, state.checkpoints);

  let aiResponse: string;
  let textTh: string;
  let assessmentTier: TurnExchangeResponse['assessmentTier'];

  if (done) {
    aiResponse = scenario.completionEn;
    textTh = scenario.completionTh;
    assessmentTier = 'correct';
  } else if (matchedFocus) {
    assessmentTier = 'correct';
    if (state.beatIndex > prevBeat) {
      aiResponse = nextBeat.promptEn;
      textTh = nextBeat.promptTh ?? '';
    } else {
      aiResponse = 'Good! ' + nextBeat.promptEn;
      textTh = nextBeat.promptTh ?? '';
    }
  } else {
    assessmentTier = 'incorrect';
    const focusGoal = scenario.goals.find((g) =>
      beat.focusGoalIds.includes(g.id) && !state.checkpoints[g.id],
    );
    aiResponse = focusGoal
      ? `Try again. ${beat.promptEn}`
      : beat.promptEn;
    textTh = focusGoal
      ? `ลองอีกครั้งนะครับ — ${focusGoal.hints.intentTh}`
      : (beat.promptTh ?? '');
  }

  const reply: TurnExchangeResponse = {
    aiResponse,
    textTh,
    isTaskComplete: done,
    updatedCheckpoints: { ...state.checkpoints },
    feedbackHints: { mispronouncedWords: [] },
    currentTurn: state.attemptCount,
    expectsUserSpeech: !done,
    assessmentTier,
    visual: visualForBeat(scenario, done ? nextBeat : currentBeat(scenario, state.beatIndex)),
  };

  return { state, reply };
}

export function scenarioHintForState(
  scenario: InteractiveScenarioDef,
  state: ScenarioRuntimeState,
): {
  hints: Array<{ id: string; label: string; sentenceEn: string; pronunciation?: string }>;
  nextState: ScenarioRuntimeState;
} {
  const beat = currentBeat(scenario, state.beatIndex);
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
    {
      id: `${goal.id}_intent`,
      label: 'เจตนา',
      sentenceEn: goal.hints.intentTh,
    },
    {
      id: `${goal.id}_starter`,
      label: 'เริ่มพูด',
      sentenceEn: goal.hints.starterEn,
    },
    {
      id: `${goal.id}_model`,
      label: 'ประโยคเต็ม',
      sentenceEn: goal.hints.modelEn,
    },
  ].slice(0, level);
  return { hints, nextState };
}
