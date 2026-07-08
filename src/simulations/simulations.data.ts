export type SimulationDifficulty = 'easy' | 'medium' | 'hard';

export interface SimulationConfig {
  simulationId: string;
  title: string;
  missionNumber: number;
  missionTitleTh: string;
  scenarioTh: string;
  goalsTh: string[];
  difficulty: SimulationDifficulty;
  estimatedMinutes: number;
  bananaCost: number;
  systemInstruction: string;
  successCriteria: string[];
  maxTurns: number;
}

export const SIMULATIONS: SimulationConfig[] = [
  {
    simulationId: 'coffee_order_easy',
    title: 'สั่งกาแฟยามเช้า',
    missionNumber: 1,
    missionTitleTh: 'สั่งกาแฟแก้วแรกที่นิวยอร์ก',
    scenarioTh:
      'คุณเพิ่งเดินเข้าร้านกาแฟตอนเช้าในนิวยอร์ก และมีพนักงานบาริสต้าเดินเข้ามาทักทายพร้อมรับออเดอร์',
    goalsTh: [
      'สั่งกาแฟที่คุณชอบ 1 แก้ว',
      'เลือกขนาด (Size) หรือประเภทนม',
      'ทำท่าจ่ายเงินให้สำเร็จ',
    ],
    difficulty: 'easy',
    estimatedMinutes: 5,
    bananaCost: 1,
    systemInstruction:
      'You are Sam, a friendly barista at a busy NYC coffee shop. The user is ordering coffee. Keep your responses short (under 15 words) and ask simple questions.',
    successCriteria: [
      'user_specified_drink',
      'user_specified_size_or_milk',
      'payment_completed',
    ],
    maxTurns: 8,
  },
];

const LEGACY_TOPIC_TO_SIMULATION: Record<string, string> = {
  coffee: 'coffee_order_easy',
};

export function getSimulation(
  simulationId: string,
): SimulationConfig | undefined {
  return SIMULATIONS.find((s) => s.simulationId === simulationId);
}

export function getAllSimulations(): SimulationConfig[] {
  return SIMULATIONS;
}

export function resolveSimulationIdFromTopic(
  topicId: string,
): string | undefined {
  return LEGACY_TOPIC_TO_SIMULATION[topicId];
}

export function initCheckpointStates(
  criteria: string[],
): Record<string, boolean> {
  return Object.fromEntries(criteria.map((key) => [key, false]));
}

export function mergeCheckpoints(
  current: Record<string, boolean>,
  updated: Record<string, boolean>,
): Record<string, boolean> {
  const merged = { ...current };
  for (const [key, value] of Object.entries(updated)) {
    if (key in merged && value) {
      merged[key] = true;
    }
  }
  return merged;
}

export function allCheckpointsComplete(
  checkpoints: Record<string, boolean>,
): boolean {
  return Object.values(checkpoints).every(Boolean);
}
