import poolsJson from './info-task-pools.json';

export type InfoTaskSourceMode = 'text' | 'audio';

export type InfoTaskOption = {
  id: string;
  label: string;
};

export type InfoTaskItem = {
  id: string;
  sourceMode: InfoTaskSourceMode;
  sourceContent: string;
  taskTh: string;
  options: InfoTaskOption[];
  correctOptionId: string;
  explanationTh: string;
  transcriptEn?: string;
  vocabTags?: string[];
};

export type InfoTaskPool = {
  title: string;
  introTh?: string;
  items: InfoTaskItem[];
};

const catalog = poolsJson as Record<string, InfoTaskPool>;

export const INFO_TASK_DEAL_COUNT = 5;
export const INFO_TASK_POOLS = catalog;

export function infoTaskPoolById(poolId: string): InfoTaskPool | undefined {
  return INFO_TASK_POOLS[poolId];
}

export function isValidInfoTaskPack(pool: InfoTaskPool | undefined): boolean {
  if (!pool || pool.items.length < INFO_TASK_DEAL_COUNT) return false;
  return pool.items.every(
    (item) =>
      item.options.length >= 3 &&
      item.options.some((opt) => opt.id === item.correctOptionId),
  );
}

/** Shuffle options while preserving option IDs and correctness. */
export function shuffleInfoTaskOptions<T extends InfoTaskOption>(
  options: T[],
  random: () => number = Math.random,
): T[] {
  const copy = [...options];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function dealInfoTaskItems(
  poolId: string,
  count = INFO_TASK_DEAL_COUNT,
  random: () => number = Math.random,
): InfoTaskItem[] {
  const pool = infoTaskPoolById(poolId);
  if (!pool) return [];
  const shuffled = [...pool.items];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  // Prefer unique source cards in a deal so learners cannot guess from repeats.
  const picked: InfoTaskItem[] = [];
  const seenSources = new Set<string>();
  for (const item of shuffled) {
    if (picked.length >= count) break;
    const key = item.sourceContent.trim();
    if (seenSources.has(key)) continue;
    seenSources.add(key);
    picked.push(item);
  }
  // Fill remaining slots if the pool is too small to uniquify.
  for (const item of shuffled) {
    if (picked.length >= count) break;
    if (picked.some((p) => p.id === item.id)) continue;
    picked.push(item);
  }

  return picked.map((item) => ({
    ...item,
    options: shuffleInfoTaskOptions(item.options, random),
  }));
}
