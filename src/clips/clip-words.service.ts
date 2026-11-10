import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { hitRateLimit, tooManyRequests } from '../common/rate-limit';
import { GeminiChatService } from '../gemini/gemini-chat.service';
import { PrismaService } from '../prisma/prisma.service';
import { pickIpa, wordAt } from './clip-words.rules';

const TAPS_PER_USER_PER_HOUR = 80;
const IPA_TIMEOUT_MS = 2500;

export type ClipWordGlossView = {
  word: string;
  lemma: string;
  pos: string;
  th: string;
  note: string;
  example: string;
  exampleTh: string;
  ipa: string;
  cached: boolean;
};

/**
 * Tap a word in a clip line → Thai meaning in that line's context.
 * Made on the first tap (Gemini + IPA from the free dictionaryapi.dev) and
 * kept per line × word, so every later tap is a DB read.
 */
@Injectable()
export class ClipWordsService {
  private readonly logger = new Logger(ClipWordsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly chat: GeminiChatService,
  ) {}

  async gloss(
    userId: string,
    clipId: string,
    idx: number,
    wordIdx: number,
  ): Promise<ClipWordGlossView> {
    const sentence = await this.prisma.clipSentence.findUnique({
      where: { clipId_idx: { clipId, idx } },
      select: { id: true, text: true, textTh: true, clip: { select: { status: true } } },
    });
    if (!sentence || sentence.clip.status !== 'published') {
      throw new NotFoundException('sentence_not_found');
    }
    const picked = wordAt(sentence.text, wordIdx);
    if (!picked) throw new BadRequestException('word_invalid');

    const hit = await this.prisma.clipWordGloss.findUnique({
      where: { sentenceId_wordIdx: { sentenceId: sentence.id, wordIdx } },
    });
    if (hit && hit.word === picked.word) return { ...view(hit), cached: true };

    const wait = hitRateLimit(`clip-words:${userId}`, TAPS_PER_USER_PER_HOUR, 60 * 60_000);
    if (wait > 0) throw tooManyRequests(wait);

    const g = await this.chat.glossClipWord({
      sentence: sentence.text,
      sentenceTh: sentence.textTh,
      word: picked.word,
      wordIdx,
    });
    if (!g) throw new BadRequestException('gloss_failed');
    const ipa = await this.fetchIpa(g.lemma || picked.core);

    const data = { word: picked.word, ...g, ipa };
    const row = await this.prisma.clipWordGloss.upsert({
      where: { sentenceId_wordIdx: { sentenceId: sentence.id, wordIdx } },
      create: { sentenceId: sentence.id, wordIdx, ...data },
      update: data,
    });
    return { ...view(row), cached: false };
  }

  /** IPA is a nice-to-have: any failure → ''. */
  private async fetchIpa(word: string): Promise<string> {
    if (!/^[a-z][a-z' -]*$/i.test(word)) return '';
    try {
      const res = await fetch(
        `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`,
        { signal: AbortSignal.timeout(IPA_TIMEOUT_MS) },
      );
      if (!res.ok) return '';
      return pickIpa(await res.json());
    } catch (err) {
      this.logger.debug(`ipa ${word}: ${(err as Error)?.message ?? err}`);
      return '';
    }
  }
}

function view(r: {
  word: string;
  lemma: string;
  pos: string;
  th: string;
  note: string;
  example: string;
  exampleTh: string;
  ipa: string;
}): Omit<ClipWordGlossView, 'cached'> {
  return {
    word: r.word,
    lemma: r.lemma,
    pos: r.pos,
    th: r.th,
    note: r.note,
    example: r.example,
    exampleTh: r.exampleTh,
    ipa: r.ipa,
  };
}
