import { LessonApiClient, type MissionTurnResult } from './lesson-api-client';

export const SCENARIO_TITLES: Record<number, string> = {
  1: 'Scenario 1 — happy path → จบภารกิจ',
  2: 'Scenario 2 — messy / STT หรือ Gemini ติ๊กเร็ว → ยังจบถูกทาง',
  3: 'Scenario 3 — stuck / off-topic → ไม่จบเร็ว บังคับจบที่ maxTurns',
};

export const MISSION_IDS = [
  'coffee_order_easy',
  'meet_new_friend_easy',
] as const;

export type MissionId = (typeof MISSION_IDS)[number];

const ALIASES: Record<string, MissionId> = {
  coffee: 'coffee_order_easy',
  coffee_order_easy: 'coffee_order_easy',
  friend: 'meet_new_friend_easy',
  meet_new_friend: 'meet_new_friend_easy',
  meet_new_friend_easy: 'meet_new_friend_easy',
};

const LEARNER = 'Nana';
const UNLOCK_MISSION: MissionId = 'meet_new_friend_easy';

const FRIEND_HAPPY_LINES = [
  "Hi, I'm Nana.",
  "I'm from Bangkok.",
  'I work at a school.',
  'What do you like, Max?',
  "That's cool!",
];

/** Messy / STT-ish: study instead of work; short hobby ask. */
const FRIEND_MESSY_LINES = [
  "Hi, I'm Nana.",
  "I'm from Bangkok.",
  "I'm studying",
  'What do you like, Max?',
  "That's cool!",
];

const COFFEE_HAPPY_LINES = [
  "I'd like a latte.",
  'How much is it?',
  'Card please.',
];

const COFFEE_MESSY_LINES = [
  "I'd like a latte.",
  'How much?',
  'hard plates',
];

const STUCK_LINES = [
  'hello',
  'um',
  'the weather is nice',
  'okay',
  'yeah',
  'I see',
  'hmm',
  'right',
];

export type ScenarioRunResult = {
  lessonId: string;
  scenario: number;
  ok: boolean;
  steps: number;
  totalMs: number;
  error?: string;
};

export function formatMs(ms: number): string {
  if (ms < 1) return `${(ms * 1000).toFixed(0)} µs`;
  if (ms < 1000) return `${ms.toFixed(2)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

function formatCheckpoints(checkpoints: Record<string, boolean>): string {
  const keys = Object.keys(checkpoints);
  if (keys.length === 0) return '(none)';
  return keys.map((key) => `${key}=${checkpoints[key] ? 'true' : 'false'}`).join(' ');
}

function allTrue(checkpoints: Record<string, boolean>): boolean {
  const values = Object.values(checkpoints);
  return values.length > 0 && values.every(Boolean);
}

export function parseMissionScenarioArgs(argv: string[]): {
  missionIds: MissionId[];
  scenarios: number[];
} {
  const args = argv.slice(2);
  const missionIds: MissionId[] = [];
  const scenarios: number[] = [];

  for (const arg of args) {
    if (/^\d+$/.test(arg)) {
      const n = Number(arg);
      if (!Number.isInteger(n) || n < 1 || n > 3) {
        throw new Error('scenario must be 1–3');
      }
      if (!scenarios.includes(n)) scenarios.push(n);
      continue;
    }
    const id = ALIASES[arg];
    if (!id) {
      throw new Error(
        `unknown mission: ${arg} (use coffee_order_easy / meet_new_friend_easy)`,
      );
    }
    if (!missionIds.includes(id)) missionIds.push(id);
  }

  return {
    missionIds: missionIds.length > 0 ? missionIds : [...MISSION_IDS],
    scenarios: scenarios.length > 0 ? scenarios : [1, 2, 3],
  };
}

async function playUntilComplete(
  client: LessonApiClient,
  sessionId: string,
  startTurn: MissionTurnResult,
  lines: string[],
  maxTurns: number,
): Promise<{ turn: MissionTurnResult; steps: number; totalMs: number }> {
  let turn = startTurn;
  let currentTurn = startTurn.currentTurn;
  let steps = 0;
  let totalMs = 0;

  console.log(`\nOpening: ${turn.aiResponse}`);
  console.log(`Checkpoints: ${formatCheckpoints(turn.checkpoints)}`);

  for (const speech of lines) {
    if (turn.isTaskComplete || steps >= maxTurns) break;
    steps += 1;
    const res = await client.sendMissionSpeech(sessionId, currentTurn, speech);
    totalMs += res.durationMs;
    turn = res.turn;
    currentTurn = turn.currentTurn;
    console.log(`\nStep ${steps}`);
    console.log(`User: ${speech}`);
    console.log(`Reply: ${turn.aiResponse}`);
    console.log(`Checkpoints: ${formatCheckpoints(turn.checkpoints)}`);
    console.log(`complete: ${turn.isTaskComplete}`);
    console.log(`response time : ${formatMs(res.durationMs)}`);
  }

  while (!turn.isTaskComplete && steps < maxTurns) {
    steps += 1;
    const speech = STUCK_LINES[(steps - 1) % STUCK_LINES.length];
    const res = await client.sendMissionSpeech(sessionId, currentTurn, speech);
    totalMs += res.durationMs;
    turn = res.turn;
    currentTurn = turn.currentTurn;
    console.log(`\nStep ${steps} (pad)`);
    console.log(`User: ${speech}`);
    console.log(`Reply: ${turn.aiResponse}`);
    console.log(`Checkpoints: ${formatCheckpoints(turn.checkpoints)}`);
    console.log(`complete: ${turn.isTaskComplete}`);
    console.log(`response time : ${formatMs(res.durationMs)}`);
  }

  return { turn, steps, totalMs };
}

async function completeMissionForUnlock(
  client: LessonApiClient,
  simulationId: MissionId,
): Promise<void> {
  const start = await client.startSimulation(simulationId);
  const played = await playUntilComplete(
    client,
    start.sessionId,
    start.turn,
    FRIEND_HAPPY_LINES,
    start.maxTurns,
  );
  if (!played.turn.isTaskComplete) {
    throw new Error(`unlock ${simulationId} did not complete`);
  }
  await client.getSessionReport(start.sessionId);
}

async function startMissionSession(
  client: LessonApiClient,
  simulationId: MissionId,
): Promise<Awaited<ReturnType<LessonApiClient['startSimulation']>>> {
  try {
    return await client.startSimulation(simulationId);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!/Series locked/i.test(message)) throw err;
    console.log(
      `\nSeries locked — completing ${UNLOCK_MISSION} first so Everyday Life unlocks…`,
    );
    await client.refillBananas();
    await completeMissionForUnlock(client, UNLOCK_MISSION);
    await client.refillBananas();
    return client.startSimulation(simulationId);
  }
}

function finishOk(
  missionId: string,
  scenario: number,
  steps: number,
  totalMs: number,
): ScenarioRunResult {
  console.log(`\n${'─'.repeat(72)}`);
  console.log(
    `✅ ${missionId} scenario ${scenario} complete · ${steps} turns · ${formatMs(totalMs)}`,
  );
  return { lessonId: missionId, scenario, ok: true, steps, totalMs };
}

function finishFail(
  missionId: string,
  scenario: number,
  steps: number,
  totalMs: number,
  error: string,
): ScenarioRunResult {
  console.error(`\n❌ ${missionId} scenario ${scenario} failed: ${error}`);
  return { lessonId: missionId, scenario, ok: false, steps, totalMs, error };
}

function linesFor(missionId: MissionId, scenario: number): string[] {
  if (missionId === 'coffee_order_easy') {
    if (scenario === 1) return COFFEE_HAPPY_LINES;
    if (scenario === 2) return COFFEE_MESSY_LINES;
    return STUCK_LINES;
  }
  if (scenario === 1) return FRIEND_HAPPY_LINES;
  if (scenario === 2) return FRIEND_MESSY_LINES;
  return STUCK_LINES;
}

function assertScenario(
  missionId: MissionId,
  scenario: number,
  turn: MissionTurnResult,
  steps: number,
  maxTurns: number,
): string | null {
  if (missionId === 'coffee_order_easy') {
    if (scenario === 1 || scenario === 2) {
      if (!turn.isTaskComplete) return 'mission did not complete';
      if (!turn.checkpoints.payment_completed) {
        return 'payment_completed stayed false';
      }
      return null;
    }
    if (turn.isTaskComplete && steps <= 2) {
      return 'completed too early on off-topic speech';
    }
    if (!turn.isTaskComplete) {
      return `did not force-close by maxTurns (${steps}/${maxTurns})`;
    }
    if (steps >= maxTurns && /\?/.test(turn.aiResponse)) {
      return `last reply still asks a question: ${turn.aiResponse}`;
    }
    return null;
  }

  if (scenario === 1 && turn.isTaskComplete && steps < 4) {
    return `completed too early (arc ${steps} turns, need ~5)`;
  }
  if (scenario === 2 && steps === 1 && turn.isTaskComplete) {
    return 'Gemini/heuristic completed after one hello';
  }
  if (scenario === 3 && turn.isTaskComplete && steps <= 2) {
    return 'completed too early on off-topic speech';
  }
  if (!turn.isTaskComplete) {
    return `did not complete by maxTurns (${steps}/${maxTurns})`;
  }
  if (scenario === 1 && !allTrue(turn.checkpoints)) {
    return `checkpoints incomplete: ${formatCheckpoints(turn.checkpoints)}`;
  }
  if (scenario === 3 && steps >= maxTurns && /\?/.test(turn.aiResponse)) {
    return `last reply still asks a question: ${turn.aiResponse}`;
  }
  return null;
}

export async function runMissionScenario(
  apiBase: string,
  missionId: MissionId,
  scenario: number,
  runIndex: number,
): Promise<ScenarioRunResult> {
  const anonUser = `${missionId}-s${scenario}-prod-${Date.now()}-${runIndex}`;
  const client = new LessonApiClient(apiBase, anonUser, true);

  console.log(`\n${'='.repeat(80)}`);
  console.log(`${missionId} — ${SCENARIO_TITLES[scenario]}`);
  console.log(`API: ${apiBase} · Learner: ${LEARNER}`);
  console.log('='.repeat(80));

  try {
    await client.request('PUT', '/users/me', { displayName: LEARNER });
    await client.refillBananas();

    const start = await startMissionSession(client, missionId);
    const lines = linesFor(missionId, scenario);
    const played = await playUntilComplete(
      client,
      start.sessionId,
      start.turn,
      lines,
      start.maxTurns,
    );

    const error = assertScenario(
      missionId,
      scenario,
      played.turn,
      played.steps,
      start.maxTurns,
    );
    if (error) {
      return finishFail(
        missionId,
        scenario,
        played.steps,
        played.totalMs,
        error,
      );
    }

    try {
      await client.getSessionReport(start.sessionId);
    } catch (err) {
      console.warn(
        `report skipped: ${err instanceof Error ? err.message : err}`,
      );
    }

    return finishOk(missionId, scenario, played.steps, played.totalMs);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return finishFail(missionId, scenario, 0, 0, error);
  }
}
