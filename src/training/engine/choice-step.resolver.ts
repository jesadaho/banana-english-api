import type { ChoiceStepTier } from '../../lessons/lessons.data';
import { looksLikeSoftTeachReveal } from '../../lessons/lessons.data';

export type ChoiceStepContext = {
  progress: number;
  step: number;
  attempt: number;
  tier: ChoiceStepTier;
};

type HistoryTurn = { speaker: string; textEn?: string };

/**
 * Replay choice-lesson history (same rules as computeThreeTierChoiceProgress)
 * and return live step / attempt / tier for the latest user turn.
 */
export function resolveChoiceStepContext(
  history: HistoryTurn[],
  maxStep: number,
  scoreStep: (step: number, text: string) => ChoiceStepTier,
  progressFn: (history: HistoryTurn[]) => number,
): ChoiceStepContext {
  let progress = 0;
  let attempt = 0;
  let awaitingCorrection = false;
  let wrongAttempts = 0;
  let lastTier: ChoiceStepTier = 'wrong';

  for (const turn of history) {
    if (turn.speaker === 'user') {
      const text = (turn.textEn ?? '').trim();
      if (!text || text.startsWith('[') || text.startsWith('(')) continue;
      const next = progress + 1;
      if (next > maxStep) continue;

      const tier = scoreStep(next, text);
      lastTier = tier;
      attempt++;

      if (
        progress >= 1 &&
        scoreStep(1, text) === 'exact' &&
        tier !== 'exact' &&
        next === 2
      ) {
        continue;
      }

      if (awaitingCorrection) {
        if (tier === 'exact') {
          progress = next;
          awaitingCorrection = false;
          wrongAttempts = 0;
          attempt = 0;
        } else if (tier === 'near' || tier === 'close') {
          awaitingCorrection = false;
          wrongAttempts = 0;
        } else {
          wrongAttempts++;
          awaitingCorrection = false;
          if (wrongAttempts >= 2) {
            progress = next;
            wrongAttempts = 0;
            attempt = 0;
          }
        }
        continue;
      }

      if (tier === 'exact') {
        progress = next;
        wrongAttempts = 0;
        attempt = 0;
        continue;
      }

      if (tier === 'near' || tier === 'close') {
        wrongAttempts = 0;
        continue;
      }

      wrongAttempts++;
      if (wrongAttempts >= 2) {
        progress = next;
        wrongAttempts = 0;
        attempt = 0;
      }
      continue;
    }

    if (turn.speaker === 'ai' && looksLikeSoftTeachReveal(turn.textEn ?? '')) {
      awaitingCorrection = true;
    }
  }

  const liveProgress = progressFn(history);
  const step = Math.min(liveProgress + 1, maxStep);
  return {
    progress: liveProgress,
    step,
    attempt: Math.max(attempt, 1),
    tier: lastTier,
  };
}
