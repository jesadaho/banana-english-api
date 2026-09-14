/** Pack catalog copied from Flutter `emoji_speak_pools.dart`. */
import poolsJson from './emoji-speak-pools.generated.json';
import v7PoolsJson from './foundation-v7-pools.json';

export type EmojiSpeakCard = {
  emoji: string;
  answer: string;
  hint: string;
  meaningTh: string;
  promptTh?: string;
};

export type EmojiSpeakPool = {
  title: string;
  dealCount: number;
  items: EmojiSpeakCard[];
};

type GeneratedCatalog = {
  version: number;
  pools: Record<string, EmojiSpeakPool>;
};

const legacyCatalog = poolsJson as GeneratedCatalog;
const catalog: GeneratedCatalog = { ...legacyCatalog, pools: { ...legacyCatalog.pools, ...v7PoolsJson } };

export const EMOJI_SPEAK_POOLS = catalog.pools;

export function isEmojiSpeakPoolId(poolId: string): boolean {
  return poolId in EMOJI_SPEAK_POOLS;
}

export function emojiSpeakPoolById(poolId: string): EmojiSpeakPool | undefined {
  return EMOJI_SPEAK_POOLS[poolId];
}

export function dealEmojiSpeakCards(
  poolId: string,
  count?: number,
): EmojiSpeakCard[] {
  const pool = emojiSpeakPoolById(poolId);
  if (!pool || pool.items.length === 0) return [];
  const dealSize = count && count > 0 ? count : pool.dealCount;
  const cards = [...pool.items];
  for (let i = cards.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards.slice(0, Math.min(dealSize, cards.length));
}
