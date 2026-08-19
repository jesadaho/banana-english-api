import assert from 'node:assert/strict';
import type { TrainingTurnReply } from '../../gemini/gemini-chat.service';
import {
  buildChoiceLessonAfterUser,
  pinChoiceLessonAiReply,
  type ChoiceLessonBoard,
  type ChoiceLessonDef,
} from '../scripts/choice-lesson.script';
import { getFoundationChoiceLesson } from '../scripts/foundation.registry';
import type { FoundationPoolGateFixture } from './foundation-poolgate.fixtures';
import { FOUNDATION_PROBE_LEARNER } from './foundation-poolgate.fixtures';

export type Turn = { speaker: string; textEn?: string };

export function getDef(fixture: FoundationPoolGateFixture): ChoiceLessonDef {
  const def = getFoundationChoiceLesson(fixture.lessonId);
  if (!def) {
    throw new Error(`missing foundation def: ${fixture.lessonId}`);
  }
  return def;
}

/** Replay exact in-pool answers until the probe step AI line is shown. */
export function buildHistoryAtProbe(
  fixture: FoundationPoolGateFixture,
  name = FOUNDATION_PROBE_LEARNER,
): Turn[] {
  const def = getDef(fixture);
  const turns: Turn[] = [
    { speaker: 'ai', textEn: def.buildOpening(name).textEn },
  ];

  for (const exact of fixture.setupExact) {
    turns.push({ speaker: 'user', textEn: exact });
    const reply = buildChoiceLessonAfterUser(def, {
      turns,
      learnerFirstName: name,
    });
    if (!reply || reply.deferToAi) {
      throw new Error(
        `${fixture.lessonId}: setup "${exact}" should be in-pool scripted`,
      );
    }
    turns.push({ speaker: 'ai', textEn: reply.textEn });
  }

  return turns;
}

export function boardAtProbe(
  fixture: FoundationPoolGateFixture,
  name = FOUNDATION_PROBE_LEARNER,
): ChoiceLessonBoard | null {
  const def = getDef(fixture);
  const base = buildHistoryAtProbe(fixture, name);
  const step = def.progressFn(base) + 1;
  return def.boardForStep(step, base);
}

/** Board shown after a successful exact answer at the probe step. */
export function nextBoardAfterProbeExact(
  fixture: FoundationPoolGateFixture,
  name = FOUNDATION_PROBE_LEARNER,
): ChoiceLessonBoard | null {
  const def = getDef(fixture);
  const turns = withProbeUser(fixture, fixture.exactAtProbe, name);
  const cleared = def.progressFn(turns);
  return def.boardForStep(cleared + 1, turns);
}

export function assertOutOfPool(
  def: ChoiceLessonDef,
  fixture: FoundationPoolGateFixture,
  turns: Turn[],
): void {
  const step = def.progressFn(turns) + 1;
  const tier = def.scoreStep(step, fixture.outOfPoolAtProbe, turns);
  if (tier === 'exact') {
    throw new Error(
      `${fixture.lessonId}: outOfPoolAtProbe must not be exact`,
    );
  }
}

export function mockGeminiReply(
  tier: 'correct' | 'close' | 'incorrect',
  textEn: string,
): TrainingTurnReply {
  return {
    textEn,
    textTh: tier === 'incorrect' ? 'Try again.' : 'Nice!',
    isLessonComplete: false,
    expectsUserSpeech: true,
    assessmentTier: tier,
  };
}

export function withProbeUser(
  fixture: FoundationPoolGateFixture,
  userText: string,
  name = FOUNDATION_PROBE_LEARNER,
): Turn[] {
  return [...buildHistoryAtProbe(fixture, name), { speaker: 'user', textEn: userText }];
}

export function pinGeminiAtProbe(
  def: ChoiceLessonDef,
  fixture: FoundationPoolGateFixture,
  userText: string,
  tier: 'correct' | 'close' | 'incorrect',
  praiseEn: string,
  name = FOUNDATION_PROBE_LEARNER,
): TrainingTurnReply {
  const turns = withProbeUser(fixture, userText, name);
  return pinChoiceLessonAiReply(
    def,
    turns,
    mockGeminiReply(tier, praiseEn),
    undefined,
    name,
  );
}

export function buildSoftAdvanceHistory(
  fixture: FoundationPoolGateFixture,
  name = FOUNDATION_PROBE_LEARNER,
): Turn[] {
  const def = getDef(fixture);
  const turns: Turn[] = [
    ...buildHistoryAtProbe(fixture, name),
    { speaker: 'user', textEn: fixture.wrongAtProbe },
  ];
  const incorrect = pinGeminiAtProbe(
    def,
    fixture,
    fixture.wrongAtProbe,
    'incorrect',
    `ลองพูดตามนะครับ "${fixture.exactAtProbe.replace(/\.$/, '')}"`,
    name,
  );
  turns.push({ speaker: 'ai', textEn: incorrect.textEn ?? '' });
  turns.push({ speaker: 'user', textEn: fixture.wrongAgainAtProbe });
  return turns;
}

/** Assert reply advances to the board after probe step (by expectedSpeech). */
export function assertAdvancedFromProbe(
  fixture: FoundationPoolGateFixture,
  reply: { expectedSpeech?: string | null; textEn?: string | null },
): void {
  const current = boardAtProbe(fixture);
  const next = nextBoardAfterProbeExact(fixture);
  assert.ok(current?.expectedSpeech, `${fixture.lessonId}: missing probe board`);
  assert.ok(next?.expectedSpeech, `${fixture.lessonId}: missing next board`);
  assert.equal(
    reply.expectedSpeech,
    next!.expectedSpeech,
    `${fixture.lessonId}: expectedSpeech should advance`,
  );
  assert.notEqual(
    reply.expectedSpeech,
    current!.expectedSpeech,
    `${fixture.lessonId}: should not stay on probe board`,
  );
}
