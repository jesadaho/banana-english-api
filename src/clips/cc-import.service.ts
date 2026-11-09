import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { GeminiChatService } from '../gemini/gemini-chat.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  cleanCues,
  cueStartIndexes,
  limitSegments,
  needsPunctuation,
  parseCues,
  segmentsToWords,
  splitLongLines,
  splitPunctuated,
} from './cc-import.rules';
import { CLIP_CATEGORIES, CLIP_LEVELS, parseYoutubeId } from './clips.rules';
import { ClipsService } from './clips.service';
import { alignSentences } from './voa-import.rules';

const DEFAULT_MAX_SECONDS = 7 * 60;
const MIN_WORDS = 25;

/**
 * Caption file (.srt / .vtt) + YouTube id → timed clip, no human step:
 * clean auto-caption roll-up → AI punctuation (if missing) → align sentences
 * to caption times → Thai + dictation → draft / published YouTube clip.
 */
@Injectable()
export class CcImportService {
  private readonly logger = new Logger(CcImportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly clips: ClipsService,
    private readonly chat: GeminiChatService,
  ) {}

  async importCaptions(body: {
    youtube?: unknown;
    title?: unknown;
    channel?: unknown;
    level?: unknown;
    category?: unknown;
    captions?: unknown;
    maxSeconds?: unknown;
    publish?: unknown;
    replace?: unknown;
  }) {
    const youtubeId = parseYoutubeId(String(body.youtube ?? ''));
    if (!youtubeId) throw new BadRequestException('youtube_invalid');
    const sourceUrl = `https://www.youtube.com/watch?v=${youtubeId}`;
    const existing = await this.prisma.clip.findFirst({ where: { sourceUrl } });
    if (existing && body.replace !== true) {
      return { skipped: true, ...(await this.clips.adminGet(existing.id)) };
    }

    const maxMs = Math.max(30, Math.min(30 * 60, Number(body.maxSeconds) || DEFAULT_MAX_SECONDS)) * 1000;
    const { segments: all, auto } = cleanCues(parseCues(String(body.captions ?? '')));
    const segments = limitSegments(all, maxMs);
    const words = segmentsToWords(segments);
    if (words.length < MIN_WORDS) throw new BadRequestException('captions_too_short');

    const text = segments.map((s) => s.text).join(' ');
    // Long sentences (manual captions are often 20–45 words) are split at
    // natural breaks so each practice line is short enough to hear and rebuild.
    // Manual captions: cue boundaries are where the speaker pauses — prefer
    // them as split points. (Auto-caption cues are arbitrary roll-ups.)
    const manual = !needsPunctuation(segments);
    const sentences = manual
      ? splitLongLines(splitPunctuated(text), undefined, cueStartIndexes(segments))
      : splitLongLines(await this.chat.punctuateCaptions(text));
    if (sentences.length < 2) throw new BadRequestException('captions_no_sentences');
    const timed = alignSentences(sentences, words);
    const truncated = all.length > segments.length;
    this.logger.log(
      `CC ${youtubeId}: ${sentences.length} lines (${auto ? 'auto' : 'manual'} captions${truncated ? ', truncated' : ''})`,
    );

    const level = String(body.level ?? '').toUpperCase();
    const category = String(body.category ?? '').toLowerCase();
    const channel = String(body.channel ?? '').trim();
    const data = {
      source: 'youtube',
      youtubeId,
      videoUrl: '',
      sourceUrl,
      credit: channel ? `YouTube · ${channel}` : 'YouTube',
      title: String(body.title ?? '').trim().slice(0, 120) || youtubeId,
      thumbnailUrl: `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`,
      level: (CLIP_LEVELS as readonly string[]).includes(level) ? level : 'A2',
      category: (CLIP_CATEGORIES as readonly string[]).includes(category) ? category : 'daily',
      durationSec: Math.ceil((timed.at(-1)?.endMs ?? 0) / 1000),
    };
    const clip = existing
      ? await this.prisma.clip.update({ where: { id: existing.id }, data })
      : await this.prisma.clip.create({ data });
    await this.clips.adminSaveSentences(clip.id, { sentences: timed });
    try {
      await this.clips.adminPrepare(clip.id, { force: true });
    } catch (err) {
      this.logger.warn(`CC prepare failed for ${clip.id}: ${String(err)}`);
    }
    if (body.publish === true) {
      try {
        await this.clips.adminUpdate(clip.id, { status: 'published' });
      } catch (err) {
        this.logger.warn(`CC publish failed for ${clip.id}: ${String(err)}`);
      }
    }
    return {
      skipped: false,
      auto,
      truncated,
      ...(await this.clips.adminGet(clip.id)),
    };
  }
}
