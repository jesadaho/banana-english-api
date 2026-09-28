import type {
  EmojiChoicePrompt,
  GuidedSpeakingPrompt,
  TurnVisualCue,
} from '../common/api.types';
import type { TtsVoiceProfileId } from '../tts/tts-voice-profiles';

export type InteractiveScenarioMode = 'practice' | 'review' | 'assessment';
export type InteractiveScenarioTeacher = 'john' | 'minnie' | 'banana';

/** Learner facts captured from answers and reused in NPC lines ({name}, {city}). */
export type ScenarioSlot = 'name' | 'city';

export interface InteractiveScenarioGoalHint {
  intentTh: string;
  starterEn: string;
  modelEn: string;
}

export interface InteractiveScenarioGoal {
  id: string;
  labelTh: string;
  labelEn: string;
  /** Rubric for meaning-based pass (not exclusive script). Also sent to the AI judge. */
  meaningRubric: string;
  /** Example acceptable utterances — soft-accept seeds, not the only answers. */
  acceptExamples: string[];
  /**
   * Fast local pass: regex sources tested (case-insensitive) against the
   * normalized transcript. Any match = correct. No match → AI judge (if wired).
   */
  matchPatterns?: string[];
  /** Foundation chapter numbers this goal measures (analytics / authoring). */
  measuresChapters?: number[];
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
  /** Per-beat image (overrides scene image). */
  imageAsset?: string;
  focusGoalIds: string[];
  /** What the teacher may say / ask this beat (English). Also AI-judge context. */
  npcBriefEn: string;
  /** Opening / prompt line for this beat when entered. English only (TTS). */
  promptEn: string;
  promptTh?: string;
  /** Closing free-ask beat — learner may invent a question; NPC answers it. */
  learnerMayAsk?: boolean;
  /** Stimulus cards shown with the prompt (content cue, not the full answer). */
  emojiChoice?: EmojiChoicePrompt;
  /** Scaffold shown from the 2nd wrong attempt on this beat. */
  retryGuided?: GuidedSpeakingPrompt;
  /** Simpler re-ask after a wrong answer (defaults to promptEn). */
  retryEn?: string;
  retryTh?: string;
  /**
   * Said right after a correct answer, before the next prompt.
   * First line whose {slots} can all be filled is used (rotates by attempt).
   */
  praiseEn: string[];
  /** Capture learner fact(s) from this beat's answer. */
  capture?: ScenarioSlot | ScenarioSlot[];
}

export interface InteractiveScenarioDef {
  id: string;
  mode: InteractiveScenarioMode;
  teacher: InteractiveScenarioTeacher;
  /** TTS voice profile the client should request for NPC lines. */
  ttsVoiceProfile?: TtsVoiceProfileId;
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
  /**
   * Wrong attempts on one beat before revealing the model answer and moving on
   * (goal stays unchecked). 1 = assessment (no retry).
   */
  maxAttemptsPerBeat?: number;
  /** Soft ceiling for abandon analytics only — not required for pass. */
  softAttemptCeiling?: number;
}
