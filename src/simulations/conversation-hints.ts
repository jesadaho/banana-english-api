import type { HintOption } from '../common/api.types';
import type { SimulationConfig } from './simulations.data';

function normalizeLine(text: string): string {
  return text
    .toLowerCase()
    .replace(/[“”"']/g, '')
    .replace(/[.!?…,]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Starters such as "I'm …" are not a line the learner can say. */
function isSpeakable(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 2) return false;
  return !/…|\.\.\./.test(trimmed);
}

function pronunciationFor(
  config: SimulationConfig,
  sentence: string,
): string {
  const key = normalizeLine(sentence);
  const match = config.vocabDrill.find(
    (item) => normalizeLine(item.word) === key,
  );
  return match?.pronunciation?.trim() ?? '';
}

/**
 * Stuck-sheet lines for the next open conversation goal.
 * The expected answer comes first. A different full model line may follow.
 * Incomplete starters are left out.
 */
export function simulationExpectedHints(
  config: SimulationConfig,
  checkpoints: Record<string, boolean> | undefined,
): HintOption[] {
  const states = checkpoints ?? {};
  let index = config.successCriteria.findIndex((id) => !states[id]);
  if (index < 0) index = config.successCriteria.length - 1;
  if (index < 0) return [];

  const goalId = config.successCriteria[index] ?? `goal_${index}`;
  const label = config.goalsTh[index]?.trim() || 'ประโยคนี้';
  const alignedVocab =
    config.vocabDrill.length === config.successCriteria.length
      ? config.vocabDrill[index]?.word?.trim() ?? ''
      : '';
  const example =
    config.goalExamples?.[index]?.trim() || alignedVocab;
  const model = config.goalHints?.[index]?.modelEn?.trim() ?? '';

  const lines: Array<{ label: string; sentence: string }> = [];
  const push = (sentence: string, lineLabel: string) => {
    const trimmed = sentence.trim();
    if (!isSpeakable(trimmed)) return;
    if (lines.some((line) => normalizeLine(line.sentence) === normalizeLine(trimmed))) {
      return;
    }
    lines.push({ label: lineLabel, sentence: trimmed });
  };

  push(example, label);
  push(model, config.goalHints?.[index]?.intentTh?.trim() || label);

  return lines.map((line, i) => ({
    id: `expected_${goalId}_${i}`,
    label: line.label,
    sentenceEn: line.sentence,
    pronunciation: pronunciationFor(config, line.sentence),
  }));
}
