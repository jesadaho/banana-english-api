import type { InteractiveScenarioDef } from '../interactive-scenario/interactive-scenario.types';
import { PLACEMENT_BANDS, PLACEMENT_QUESTIONS } from './placement.bank';
import { PLACEMENT_SCENARIO_ID } from './placement.types';

/** Client chrome for the Teacher Bee speaking placement. Turns are owned by placement.runtime. */
export const ONBOARDING_PLACEMENT_BEE: InteractiveScenarioDef = {
  id: PLACEMENT_SCENARIO_ID,
  mode: 'assessment',
  teacher: 'banana',
  ttsVoiceProfile: 'teacher_b',
  titleEn: 'A Day Out with Teacher Bee',
  titleTh: 'วัดระดับกับครูบี',
  bananaCost: 0,
  estimatedMinutes: 12,
  maxAttemptsPerBeat: 1,
  scenes: [
    {
      id: 'day_out',
      titleEn: 'A Day Out',
      titleTh: 'ออกไปเที่ยววันหนึ่ง',
    },
  ],
  goals: PLACEMENT_BANDS.map((b) => ({
    id: b.id,
    labelTh: b.id,
    labelEn: b.id,
    meaningRubric: 'Placement band (server-owned, not a Final Interview goal).',
    acceptExamples: [],
    hints: { intentTh: '', starterEn: '', modelEn: '' },
  })),
  beats: [
    {
      id: 'placement_start',
      sceneId: 'day_out',
      ungraded: true,
      focusGoalIds: [],
      npcBriefEn: 'Speaking placement with Teacher Bee.',
      promptEn: 'Answer as much as you can.',
      praiseEn: [],
    },
  ],
  openingEn: 'Answer as much as you can.',
  completionEn: 'Thank you for talking with Teacher Bee.',
  completionTh: 'ขอบคุณที่คุยกับครูบีนะครับ',
};

export const PLACEMENT_IMAGE_PATHS = PLACEMENT_QUESTIONS.map((q) => q.imagePath).filter(
  (p): p is string => Boolean(p),
);
