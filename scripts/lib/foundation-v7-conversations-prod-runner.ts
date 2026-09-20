import { FOUNDATION_V7_CATALOG } from '../../src/learn-path/foundation-v7-path.data.ts';
import { getSimulation } from '../../src/simulations/simulations.data.ts';
import specs from '../../src/simulations/foundation-v7-simulations.authoring.json';
import { LessonApiClient, type MissionTurnResult } from './lesson-api-client';

export const SCENARIO_TITLES: Record<number, string> = {
  1: 'Scenario 1 — happy path → จบภารกิจตามเป้าหมาย',
  2: 'Scenario 2 — messy / สั้นกว่าสคริปต์ → ยังจบถูกทาง',
  3: 'Scenario 3 — stuck / off-topic → บังคับจบที่ maxTurns โดยไม่ปั้นสำเร็จ',
};

export const LEARNER = 'Nana';

export const AUTHORED_V7_CONVERSATION_IDS = specs.map(
  (spec) => spec.simulationId,
);

export const FROZEN_V7_CONVERSATION_IDS = conversationIdsInChapter('v7_u01');

export const ALL_V7_PATH_CONVERSATION_IDS = [
  ...FROZEN_V7_CONVERSATION_IDS,
  ...AUTHORED_V7_CONVERSATION_IDS,
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

const HAPPY_OVERRIDES: Record<string, string[]> = {
  foundation_first_conversation: [
    'Hi!',
    'My name is Nana.',
    "I'm from Thailand.",
    'Yes, I do.',
  ],
  foundation_v7_u02n04: ['Yes', 'Thank you', 'See you tomorrow'],
  foundation_v7_u03n06: ['Yes, I am hungry', 'Yes, I am ready', "Let's go"],
  foundation_v7_u04n06: [
    'This is my sister',
    'She is a doctor',
    'This is my father',
    'He is a teacher',
  ],
  foundation_v7_u06n08: ['That bag, please', 'The blue bag', 'Thank you'],
  foundation_v7_u07n07: [
    'Yes, I have a phone',
    'Yes, this is my phone',
    'Yes, I have your book',
  ],
  foundation_v7_u08n10: ['My name is Sam', 'Yes, Sam', 'I am sixteen'],
  foundation_v7_u09n09: [
    'One ticket, please',
    'Friday at ten?',
    'How much is it',
    'Here you are',
  ],
  foundation_v7_u10n07: ['Tea, please', 'Yes, please', 'Thank you'],
  foundation_v7_u11n06: ['Yes, I can', 'Can you cook?', 'Yes, I can'],
  foundation_v7_u12n08: [
    'I wake up at seven',
    'No, I do not',
    'Yes, Friday at ten',
  ],
  foundation_v7_u13n06: [
    'I am cooking',
    'No, I am not',
    'Yes, she is cooking',
  ],
  foundation_v7_u14n06: ['When is the class', 'Where is the class', 'Thank you'],
  foundation_v7_u15n08: ['Where is the room', 'Turn left', 'Thank you'],
  foundation_v7_u16n10: [
    'I am going to the station',
    'I want to go by bus',
    'Thank you',
  ],
};

const MESSY_OVERRIDES: Record<string, string[]> = {
  foundation_first_conversation: ['Hello.', "I'm Nana.", 'Thailand.', 'Maybe.'],
};

function conversationIdsInChapter(chapterId: string): string[] {
  const chapter = FOUNDATION_V7_CATALOG.chapters.find(
    (ch) => ch.id === chapterId,
  );
  return (chapter?.items ?? [])
    .filter((node) => node.type === 'conversation')
    .map((node) => node.contentRef.simulationId)
    .filter((id): id is string => Boolean(id));
}

function specFor(simulationId: string) {
  return specs.find((spec) => spec.simulationId === simulationId);
}

export function happyLinesFor(simulationId: string): string[] {
  const override = HAPPY_OVERRIDES[simulationId];
  if (override) return override;
  const examples = specFor(simulationId)?.goals.map((goal) => goal.example) ?? [];
  if (examples.length === 0) {
    throw new Error(`no happy-path lines for ${simulationId}`);
  }
  return examples;
}

function messyFrom(line: string): string {
  if (/thank you/i.test(line)) return 'Thanks.';
  if (/please say that again/i.test(line)) return 'Again, please.';
  if (/,\s*please/i.test(line)) return line.replace(/,\s*please\.?/i, '.').trim();
  return line.replace(/\?$/, '').replace(/\.$/, '');
}

function messyLinesFor(simulationId: string): string[] {
  return MESSY_OVERRIDES[simulationId] ?? happyLinesFor(simulationId).map(messyFrom);
}

function linesFor(simulationId: string, scenario: number): string[] {
  if (scenario === 1) return happyLinesFor(simulationId);
  if (scenario === 2) return messyLinesFor(simulationId);
  return STUCK_LINES;
}

const ALIASES = new Map<string, string>();
for (const id of ALL_V7_PATH_CONVERSATION_IDS) ALIASES.set(id, id);
for (const spec of specs) {
  ALIASES.set(spec.nodeId, spec.simulationId);
  ALIASES.set(spec.titleEn.toLowerCase(), spec.simulationId);
}
for (const node of FOUNDATION_V7_CATALOG.chapters.flatMap((ch) => ch.items)) {
  if (node.type !== 'conversation' || !node.contentRef.simulationId) continue;
  ALIASES.set(node.id, node.contentRef.simulationId);
  ALIASES.set(node.titleEn.toLowerCase(), node.contentRef.simulationId);
}

function resolveSimulationId(arg: string): string | undefined {
  return ALIASES.get(arg) ?? ALIASES.get(arg.toLowerCase());
}

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
  return keys
    .map((key) => `${key}=${checkpoints[key] ? 'true' : 'false'}`)
    .join(' ');
}

function allTrue(checkpoints: Record<string, boolean>): boolean {
  const values = Object.values(checkpoints);
  return values.length > 0 && values.every(Boolean);
}

export function parseFoundationV7ConversationArgs(argv: string[]): {
  simulationIds: string[];
  scenarios: number[];
} {
  const args = argv.slice(2);
  const simulationIds: string[] = [];
  const scenarios: number[] = [];

  const add = (ids: readonly string[]) => {
    for (const id of ids) {
      if (!simulationIds.includes(id)) simulationIds.push(id);
    }
  };

  for (const arg of args) {
    if (/^\d+$/.test(arg)) {
      const n = Number(arg);
      if (!Number.isInteger(n) || n < 1 || n > 3) {
        throw new Error('scenario must be 1–3');
      }
      if (!scenarios.includes(n)) scenarios.push(n);
      continue;
    }
    if (arg === 'all') {
      add(ALL_V7_PATH_CONVERSATION_IDS);
      continue;
    }
    if (arg === 'authored' || arg === 'new') {
      add(AUTHORED_V7_CONVERSATION_IDS);
      continue;
    }
    if (arg === 'frozen' || arg === 'ch1') {
      add(FROZEN_V7_CONVERSATION_IDS);
      continue;
    }
    const chapter =
      arg === 'ch2' ? (['ch2', '02'] as const) : arg.match(/^u(\d{2})$/i);
    if (chapter) {
      const fromPath = conversationIdsInChapter(`v7_u${chapter[1]}`);
      if (fromPath.length === 0) {
        throw new Error(`no V7 conversations in chapter ${arg}`);
      }
      add(fromPath);
      continue;
    }
    const id = resolveSimulationId(arg);
    if (!id) {
      throw new Error(
        `unknown V7 conversation: ${arg} (use authored / frozen / all / ch2 / u03 / foundation_v7_u02n04)`,
      );
    }
    add([id]);
  }

  return {
    simulationIds:
      simulationIds.length > 0
        ? simulationIds
        : [...AUTHORED_V7_CONVERSATION_IDS],
    scenarios: scenarios.length > 0 ? scenarios : [1],
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

function finishOk(
  simulationId: string,
  scenario: number,
  steps: number,
  totalMs: number,
): ScenarioRunResult {
  console.log(`\n${'─'.repeat(72)}`);
  console.log(
    `✅ ${simulationId} scenario ${scenario} complete · ${steps} turns · ${formatMs(totalMs)}`,
  );
  return { lessonId: simulationId, scenario, ok: true, steps, totalMs };
}

function finishFail(
  simulationId: string,
  scenario: number,
  steps: number,
  totalMs: number,
  error: string,
): ScenarioRunResult {
  console.error(`\n❌ ${simulationId} scenario ${scenario} failed: ${error}`);
  return { lessonId: simulationId, scenario, ok: false, steps, totalMs, error };
}

function assertScenario(
  simulationId: string,
  scenario: number,
  turn: MissionTurnResult,
  steps: number,
  maxTurns: number,
): string | null {
  if (!turn.isTaskComplete) {
    return `did not complete by maxTurns (${steps}/${maxTurns})`;
  }
  if (scenario === 3) {
    if (steps < maxTurns) {
      return `stuck path should reach the turn cap (${steps}/${maxTurns})`;
    }
    if (allTrue(turn.checkpoints)) {
      return `invented success from off-topic replies: ${formatCheckpoints(turn.checkpoints)}`;
    }
    return null;
  }
  const minTurns = specFor(simulationId)?.minTurns;
  if (scenario === 1 && minTurns && steps !== minTurns) {
    return `expected ${minTurns} turns, got ${steps}`;
  }
  if (scenario === 2 && minTurns && steps < minTurns) {
    return `completed before minTurns (${steps}/${minTurns})`;
  }
  if (steps < 1) {
    return 'completed with no learner replies';
  }
  if (!allTrue(turn.checkpoints)) {
    return `checkpoints incomplete: ${formatCheckpoints(turn.checkpoints)}`;
  }
  const fallback = getSimulation(simulationId)?.fallbackReplyEn;
  if (steps >= maxTurns && fallback && turn.aiResponse === fallback) {
    return `hit the turn cap with a fallback close instead of the mission outcome`;
  }
  return null;
}

export async function runFoundationV7Conversation(
  apiBase: string,
  simulationId: string,
  scenario: number,
  runIndex: number,
): Promise<ScenarioRunResult> {
  const config = getSimulation(simulationId);
  const title = config?.title ?? specFor(simulationId)?.titleEn ?? simulationId;
  const anonUser = `${simulationId}-s${scenario}-v7-${Date.now()}-${runIndex}`;
  const client = new LessonApiClient(apiBase, anonUser, true);

  console.log(`\n${'='.repeat(80)}`);
  console.log(`${simulationId} — ${title}`);
  console.log(`${SCENARIO_TITLES[scenario]}`);
  console.log(`API: ${apiBase} · Learner: ${LEARNER}`);
  console.log('='.repeat(80));

  try {
    await client.request('PUT', '/users/me', { displayName: LEARNER });
    await client.refillBananas();

    const start = await client.startSimulation(simulationId);
    const played = await playUntilComplete(
      client,
      start.sessionId,
      start.turn,
      linesFor(simulationId, scenario),
      start.maxTurns,
    );

    const error = assertScenario(
      simulationId,
      scenario,
      played.turn,
      played.steps,
      start.maxTurns,
    );
    if (error) {
      return finishFail(
        simulationId,
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

    return finishOk(simulationId, scenario, played.steps, played.totalMs);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    if (/Series locked/i.test(error)) {
      return finishFail(
        simulationId,
        scenario,
        0,
        0,
        `Series locked — V7 conversations should not use Adventure unlock (${error})`,
      );
    }
    return finishFail(simulationId, scenario, 0, 0, error);
  }
}
