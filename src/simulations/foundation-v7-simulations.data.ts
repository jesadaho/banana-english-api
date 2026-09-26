import type { SimulationConfig } from './simulations.data';
import specs from './foundation-v7-simulations.authoring.json';

type GoalSpec = {
  id: string;
  th: string;
  en: string;
  example: string;
  hints?: { intentTh: string; starterEn: string; modelEn: string };
};

function toSimulationConfig(spec: (typeof specs)[number], index: number): SimulationConfig {
  return {
  simulationId: spec.simulationId, title: spec.titleEn, missionNumber: index + 2,
  missionTitleTh: spec.titleEn, scenarioTh: spec.scenarioTh,
  goalsTh: spec.goals.map((g: GoalSpec) => g.th),
  goalsEn: spec.goals.map((g: GoalSpec) => g.en),
  goalHints: spec.goals.map((g: GoalSpec) => g.hints ?? null),
  difficulty: 'easy' as const, estimatedMinutes: spec.maxTurns >= 5 ? 4 : 3, bananaCost: 1,
  foundationMission: true, minTurns: spec.minTurns, maxTurns: spec.maxTurns,
  successCriteria: spec.goals.map((g: GoalSpec) => g.id),
  systemInstruction: `Foundation A1 V7 conversation: ${spec.titleEn}. ${spec.role}\n
Learner-visible role brief: ${spec.scenarioTh}\n
Communication goals:\n${spec.goals.map((g: GoalSpec) => `${g.id}: ${g.en}; example, not a mandatory script: ${g.example}`).join('\n')}
Use the V2 mission philosophy: create a concrete situation, let the learner use recently taught language to change it, react to what they actually say, and finish with the concrete outcome stated in the role. You are an NPC in that situation, not an oral examiner. Lead the interaction instead of reading out a grammar checklist. This mission needs at least ${spec.minTurns} meaningful learner replies before it may close; if the learner packs several goals into one reply, credit them, react naturally, and create the next relevant situation beat instead of ending early. Never add filler solely to reach the minimum. Keep each reply under fifteen English words where possible, with one question at most. textTh must translate aiResponse faithfully, not add unrelated coaching or the next mission hint${spec.simulationId === 'foundation_v7_u13n06' ? ", except when the role asks you to append a short vocab gloss such as 'too = ด้วย'" : ''}. Use slow, clear, natural English; allow repetition. Accept short meaningful answers, minor mistakes and fictional profiles. Mark a checkpoint only when the learner actually communicates it; never mark every goal true just because a turn elapsed. Packed meaningful replies may satisfy more than one goal, but do not treat a generic yes as all goals. Never claim there is an image unless it was provided. Never invent mechanics or new required grammar. When the mission succeeds, state its concrete outcome before closing. At the reply cap close neutrally if goals remain; never fabricate success.`,
  openingPrompt: `Open with exactly: "${spec.openingEn}". Do not add another question or extra sentence. Translate it into Thai in textTh. This is the opening, so all checkpoints remain false.`,
  completionReplyEn: spec.completionEn, completionReplyTh: spec.completionTh,
  fallbackReplyEn: 'Thanks for practising. You can try again anytime.', fallbackReplyTh: 'ขอบคุณที่มาฝึกด้วยกันครับ กลับมาลองใหม่ได้เสมอครับ',
  vocabDrill: [
    ...spec.goals.map((g: GoalSpec) => ({word: g.example, meaningTh: g.th, pronunciation: ''})),
    ...(spec.simulationId === 'foundation_v7_u13n06'
      ? [{ word: 'too', meaningTh: 'ด้วย', pronunciation: 'ทู' }]
      : []),
  ],
};
}

const activeSpecs = specs.filter(
  (spec) => !String(spec.role ?? '').startsWith('Archived'),
);
const archivedSpecs = specs.filter((spec) =>
  String(spec.role ?? '').startsWith('Archived'),
);

export const FOUNDATION_V7_SIMULATIONS: SimulationConfig[] = activeSpecs.map(
  (spec, index) => toSimulationConfig(spec, index),
);

/** Preserved off-path missions (e.g. Around Town for A2) so old completions still resolve. */
export const FOUNDATION_V7_PRESERVED_SIMULATIONS: SimulationConfig[] =
  archivedSpecs.map((spec, index) =>
    toSimulationConfig(spec, FOUNDATION_V7_SIMULATIONS.length + index),
  );
