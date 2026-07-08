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
      'You are Sam, a friendly barista at a busy NYC coffee shop. The user is ordering coffee. Keep your responses short (under 15 words) and ask simple questions. When the customer says they will pay by card (even if speech-to-text garbles it, e.g. "hard plates" means "card please"), immediately complete payment in that turn — never ask them to tap the screen. Close with a line like: "Card, got it! Payment completed. Here is your latte! Enjoy your day!"',
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

/** STT-tolerant card-payment intent (e.g. "hard plates" → "card please"). */
export function detectsCardPaymentIntent(userText: string): boolean {
  const t = userText.toLowerCase().trim();
  const cardPatterns = [
    /\bcards?\b/,
    /\bcredit\b/,
    /\bdebit\b/,
    /\bpay\s*(by|with)?\s*card/,
    /\bhard\s*plates?\b/,
    /\bplates?\s*please\b/,
    /\buse\s*(my\s*)?card\b/,
    /\b(i'll|i will|gonna)\s*pay\b/,
    /\bpay\s*by\s*card\b/,
    /\btap\s*(my\s*)?card\b/,
  ];
  return cardPatterns.some((p) => p.test(t));
}

/** Force payment_completed when card intent is clear and order details are done. */
export function applyPaymentClosureIfNeeded(
  config: SimulationConfig,
  userText: string,
  checkpoints: Record<string, boolean>,
): Record<string, boolean> {
  if (!config.successCriteria.includes('payment_completed')) {
    return checkpoints;
  }
  if (checkpoints.payment_completed) {
    return checkpoints;
  }
  const orderReady =
    (!config.successCriteria.includes('user_specified_drink') ||
      checkpoints.user_specified_drink) &&
    (!config.successCriteria.includes('user_specified_size_or_milk') ||
      checkpoints.user_specified_size_or_milk);
  if (!orderReady || !detectsCardPaymentIntent(userText)) {
    return checkpoints;
  }
  return { ...checkpoints, payment_completed: true };
}
