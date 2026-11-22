import { Injectable, NotFoundException } from '@nestjs/common';
import {
  dealEmojiSpeakCards,
  EMOJI_SPEAK_POOLS,
  emojiSpeakPoolById,
  isEmojiSpeakPoolId,
} from './emoji-speak.data';

@Injectable()
export class EmojiSpeakService {
  progressCatalog() {
    return {
      pools: Object.fromEntries(Object.entries(EMOJI_SPEAK_POOLS).map(([id, pool]) => [
        id,
        [...new Set(pool.items.map((item) => JSON.stringify([
          item.emoji.trim(), item.answer.trim().toLowerCase(), (item.promptTh ?? '').trim(),
        ])))],
      ])),
    };
  }

  getPool(poolId: string) {
    const pool = emojiSpeakPoolById(poolId);
    if (!pool) throw new NotFoundException(`Emoji Speak pool not found: ${poolId}`);
    return pool;
  }

  isKnownPool(poolId: string): boolean {
    return isEmojiSpeakPoolId(poolId);
  }

  dealForPool(poolId: string, count?: number) {
    const pool = this.getPool(poolId);
    const items = dealEmojiSpeakCards(poolId, count);
    return {
      poolId,
      title: pool.title,
      dealCount: items.length,
      items,
    };
  }
}
