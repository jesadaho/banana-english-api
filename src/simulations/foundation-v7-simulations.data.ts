import type { SimulationConfig } from './simulations.data';
import specs from './foundation-v7-simulations.authoring.json';

export const FOUNDATION_V7_SIMULATIONS: SimulationConfig[] = specs.map((spec, index) => ({
  simulationId: spec.simulationId, title: spec.titleEn, missionNumber: index + 2,
  missionTitleTh: spec.titleEn, scenarioTh: spec.scenarioTh,
  goalsTh: spec.goals.map(g => g.th), goalsEn: spec.goals.map(g => g.en),
  difficulty: 'easy', estimatedMinutes: spec.maxTurns >= 5 ? 4 : 3, bananaCost: 1,
  foundationMission: true, maxTurns: spec.maxTurns,
  successCriteria: spec.goals.map(g => g.id),
  systemInstruction: `Foundation A1 V7 conversation: ${spec.titleEn}. ${spec.role}\n
Learner-visible role brief: ${spec.scenarioTh}\n
Communication goals:\n${spec.goals.map(g => `${g.id}: ${g.en}; example, not a mandatory script: ${g.example}`).join('\n')}
You are the conversation partner, not an examiner. Keep each reply under fifteen English words where possible, with one question at most. textTh must translate aiResponse faithfully, not add unrelated coaching. Use slow, clear, natural English; allow repetition. Accept short meaningful answers, minor mistakes and fictional profiles. Mark a checkpoint only when the learner actually communicates it; never mark every goal true just because a turn elapsed. Packed meaningful replies may satisfy more than one goal, but do not treat a generic yes as all goals. Never claim there is an image unless it was provided. Never invent mechanics or new required grammar. At the reply cap close neutrally even if goals remain; never fabricate success.`,
  openingPrompt: `Open with exactly: "${spec.openingEn}". Translate it into Thai in textTh. This is the opening, so all checkpoints remain false.`,
  completionReplyEn: 'Thanks for talking with me!', completionReplyTh: 'ขอบคุณที่คุยด้วยกันนะครับ!',
  fallbackReplyEn: 'Thanks for practising. You can try again anytime.', fallbackReplyTh: 'ขอบคุณที่มาฝึกด้วยกันครับ กลับมาลองใหม่ได้เสมอครับ',
  vocabDrill: spec.goals.map(g => ({word: g.example, meaningTh: g.th, pronunciation: ''})),
}));
