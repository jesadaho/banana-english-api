/** Mini-games that award one Perfect Star per pool/topic (Flutter local sets). */
export const PERFECT_STAR_GAMES = [
  'emoji_speak',
  'word_choice',
  'speak_challenge',
  'story_builder',
  'whats_happen',
  'say_it',
  'describe_it',
  'explain_it',
  'listen_up',
] as const;

export type PerfectStarGame = (typeof PERFECT_STAR_GAMES)[number];

export type PerfectStarKey = { game: PerfectStarGame; poolId: string };

export const MAX_PERFECT_STAR_KEYS_PER_REQUEST = 500;

const POOL_ID = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,99}$/;

/**
 * Parses `game:poolId` keys sent by the app. Unknown games, malformed pool
 * ids and duplicates are dropped rather than failing the whole upload.
 */
export function parsePerfectStarKeys(raw: unknown): PerfectStarKey[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: PerfectStarKey[] = [];
  for (const item of raw.slice(0, MAX_PERFECT_STAR_KEYS_PER_REQUEST)) {
    if (typeof item !== 'string') continue;
    const sep = item.indexOf(':');
    if (sep <= 0) continue;
    const game = item.slice(0, sep);
    const poolId = item.slice(sep + 1).trim();
    if (!(PERFECT_STAR_GAMES as readonly string[]).includes(game)) continue;
    if (!POOL_ID.test(poolId)) continue;
    const key = `${game}:${poolId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ game: game as PerfectStarGame, poolId });
  }
  return out;
}

export function perfectStarKey(star: { game: string; poolId: string }): string {
  return `${star.game}:${star.poolId}`;
}
