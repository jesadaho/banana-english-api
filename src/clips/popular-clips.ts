/** Popular Now rail size. */
export const POPULAR_CLIP_LIMIT = 10;

/** Rolling window for “เล่นจบ” ranking. */
export const POPULAR_COMPLETES_WINDOW_MS = 7 * 86_400_000;

/**
 * Rank Popular Now: finished plays first, then Parroto views, then weak
 * progress fillers — until [limit] cards.
 */
export function rankPopularClips<T extends { id: string; title: string }>(
  views: readonly T[],
  completedCounts: ReadonlyArray<{ clipId: string; n: number }>,
  options: {
    parrotoViews: (title: string) => number;
    progressCounts?: ReadonlyArray<{ clipId: string; n: number }>;
    limit?: number;
  },
): T[] {
  const limit = options.limit ?? POPULAR_CLIP_LIMIT;
  const byId = new Map(views.map((v) => [v.id, v]));

  const fromCompletes = [...completedCounts]
    .filter((r) => r.n > 0 && byId.has(r.clipId))
    .sort((a, b) => b.n - a.n || a.clipId.localeCompare(b.clipId))
    .map((r) => byId.get(r.clipId)!)
    .slice(0, limit);

  if (fromCompletes.length >= limit) return fromCompletes;

  const picked = new Set(fromCompletes.map((v) => v.id));

  const fromParroto = views
    .filter((v) => !picked.has(v.id))
    .map((v) => ({ v, n: options.parrotoViews(v.title) }))
    .filter((r) => r.n > 0)
    .sort((a, b) => b.n - a.n || a.v.id.localeCompare(b.v.id))
    .map((r) => r.v);

  const merged = [...fromCompletes];
  for (const v of fromParroto) {
    if (merged.length >= limit) break;
    if (picked.has(v.id)) continue;
    picked.add(v.id);
    merged.push(v);
  }
  if (merged.length >= limit) return merged;

  const progress = options.progressCounts ?? [];
  const fromProgress = [...progress]
    .filter((r) => r.n > 0 && !picked.has(r.clipId) && byId.has(r.clipId))
    .sort((a, b) => b.n - a.n || a.clipId.localeCompare(b.clipId))
    .map((r) => byId.get(r.clipId)!);

  for (const v of fromProgress) {
    if (merged.length >= limit) break;
    merged.push(v);
  }
  return merged;
}
