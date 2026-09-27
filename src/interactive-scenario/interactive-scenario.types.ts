import type { TurnVisualCue } from '../common/api.types';

export type InteractiveScenarioMode = 'practice' | 'review' | 'assessment';
export type InteractiveScenarioTeacher = 'john' | 'minnie' | 'banana';

export interface InteractiveScenarioGoalHint {
  intentTh: string;
  starterEn: string;
  modelEn: string;
}

export interface InteractiveScenarioGoal {
  id: string;
  labelTh: string;
  labelEn: string;
  /** Rubric for meaning-based pass (not exclusive script). */
  meaningRubric: string;
  /** Example acceptable utterances — soft-accept seeds, not the only answers. */
  acceptExamples: string[];
  hints: InteractiveScenarioGoalHint;
}

export interface InteractiveScenarioScene {
  id: string;
  titleTh?: string;
  titleEn?: string;
  imageAsset?: string;
  bannerAsset?: string;
}

export interface InteractiveScenarioBeat {
  id: string;
  sceneId: string;
  visualLayout?: TurnVisualCue['layout'];
  focusGoalIds: string[];
  /** What the teacher may say / ask this beat (English). */
  npcBriefEn: string;
  /** Opening / prompt line for this beat when entered. */
  promptEn: string;
  promptTh?: string;
  /** Closing free-ask beat — learner may invent a question. */
  learnerMayAsk?: boolean;
}

export interface InteractiveScenarioDef {
  id: string;
  mode: InteractiveScenarioMode;
  teacher: InteractiveScenarioTeacher;
  titleEn: string;
  titleTh: string;
  bananaCost: number;
  estimatedMinutes: number;
  scenes: InteractiveScenarioScene[];
  goals: InteractiveScenarioGoal[];
  beats: InteractiveScenarioBeat[];
  openingEn: string;
  openingTh?: string;
  completionEn: string;
  completionTh: string;
  /** Soft ceiling for abandon analytics only — not required for pass. */
  softAttemptCeiling?: number;
}
