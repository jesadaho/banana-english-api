import { Injectable, NotFoundException } from '@nestjs/common';
import {
  dealEmojiSpeakCards,
  emojiSpeakPoolById,
  isEmojiSpeakPoolId,
} from './emoji-speak.data';

@Injectable()
export class EmojiSpeakService {
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
