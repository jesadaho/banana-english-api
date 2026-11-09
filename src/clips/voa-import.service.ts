import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { resolveGroqApiKeys } from '../config-keys/groq-api-keys';
import { PrismaService } from '../prisma/prisma.service';
import { ClipsService } from './clips.service';
import {
  type SttWord,
  VOA_CREDIT,
  alignSentences,
  dialogueSentences,
  isVoaLessonUrl,
  isVoaUrl,
  parseVoaLesson,
  parseVoaSeries,
  pickVoaVideos,
} from './voa-import.rules';
import { parseYoutubeId } from './clips.rules';

const UA = 'Mozilla/5.0 (compatible; BananaEnglishImporter/1.0)';
const STT_MAX_BYTES = 24 * 1024 * 1024; // Groq Whisper upload limit (free tier 25MB)

/**
 * VOA Learning English → Clip, no human step:
 * page → dialogue + VOA mp4 → Groq Whisper word times → aligned sentences →
 * Gemini Thai + dictation picks → draft (or published) clip.
 */
@Injectable()
export class VoaImportService {
  private readonly logger = new Logger(VoaImportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly clips: ClipsService,
  ) {}

  /** Lessons listed on a series page (e.g. /p/5644.html), with import status. */
  async listSeries(url: string) {
    if (!isVoaUrl(url) || isVoaLessonUrl(url)) throw new BadRequestException('voa_series_url_invalid');
    const lessons = parseVoaSeries(await this.fetchText(url));
    const existing = await this.prisma.clip.findMany({
      where: { sourceUrl: { in: lessons.map((l) => l.url) } },
      select: { id: true, sourceUrl: true, status: true },
    });
    const byUrl = new Map(existing.map((c) => [c.sourceUrl, c]));
    return {
      lessons: lessons.map((l) => ({
        ...l,
        clipId: byUrl.get(l.url)?.id ?? null,
        status: byUrl.get(l.url)?.status ?? null,
      })),
    };
  }

  async importLesson(body: {
    url?: unknown;
    level?: unknown;
    category?: unknown;
    publish?: unknown;
    replace?: unknown;
    /** Embed this YouTube video (VOA's own upload); empty = search VOA's channel. */
    youtubeUrl?: unknown;
  }) {
    const url = String(body.url ?? '').trim().replace(/[?#].*$/, '');
    if (!isVoaUrl(url) || !isVoaLessonUrl(url)) throw new BadRequestException('voa_lesson_url_invalid');

    const existing = await this.prisma.clip.findFirst({ where: { sourceUrl: url } });
    if (existing && body.replace !== true) {
      return { skipped: true, ...(await this.clips.adminGet(existing.id)) };
    }

    const lesson = parseVoaLesson(await this.fetchText(url));
    const sentences = dialogueSentences(lesson.lines);
    const videos = pickVoaVideos(lesson.videos);
    if (!videos) throw new BadRequestException('voa_no_video');
    if (sentences.length < 2) throw new BadRequestException('voa_no_dialogue');

    const words = await this.transcribeWords(videos.stt);
    const timed = alignSentences(sentences, words);
    const lastEnd = timed.at(-1)?.endMs ?? 0;
    this.logger.log(`VOA ${url}: ${sentences.length} lines, ${words.length} STT words`);

    // Play VOA's own YouTube upload (embed); timings come from VOA's mp4 of
    // the same video. Shift times in the editor if the upload is cut differently.
    const youtubeId =
      parseYoutubeId(String(body.youtubeUrl ?? '')) ??
      (await this.findVoaYoutubeId(lesson.title));
    const data = {
      source: youtubeId ? 'youtube' : 'video',
      youtubeId: youtubeId ?? '',
      videoUrl: videos.play,
      sourceUrl: url,
      credit: VOA_CREDIT,
      title: lesson.title.slice(0, 120) || 'VOA lesson',
      thumbnailUrl: lesson.thumbnailUrl,
      level: ['A1', 'A2', 'B1', 'B2'].includes(String(body.level)) ? String(body.level) : 'A1',
      category: typeof body.category === 'string' && body.category ? body.category : 'stories',
      durationSec: Math.ceil(lastEnd / 1000),
    };
    const clip = existing
      ? await this.prisma.clip.update({ where: { id: existing.id }, data })
      : await this.prisma.clip.create({ data });

    await this.clips.adminSaveSentences(clip.id, { sentences: timed });
    try {
      await this.clips.adminPrepare(clip.id, { force: true });
    } catch (err) {
      // Thai/dictation can be re-run from the editor; the clip is still usable.
      this.logger.warn(`VOA prepare failed for ${clip.id}: ${String(err)}`);
    }
    if (body.publish === true) {
      try {
        await this.clips.adminUpdate(clip.id, { status: 'published' });
      } catch (err) {
        this.logger.warn(`VOA publish failed for ${clip.id}: ${String(err)}`);
      }
    }
    return { skipped: false, ...(await this.clips.adminGet(clip.id)) };
  }

  /**
   * VOA uploads its lessons to YouTube too. Find the upload with the official
   * YouTube Data API (search on VOA Learning English's channel by title).
   * Needs YOUTUBE_API_KEY; without it (or no match) we keep the mp4.
   */
  private async findVoaYoutubeId(title: string): Promise<string | null> {
    const key = process.env.YOUTUBE_API_KEY?.trim();
    if (!key || !title) return null;
    try {
      const q = new URLSearchParams({
        part: 'snippet',
        type: 'video',
        maxResults: '5',
        q: `${title} VOA Learning English`,
        key,
      });
      const res = await fetch(`https://www.googleapis.com/youtube/v3/search?${q}`, {
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        this.logger.warn(`YouTube search ${res.status}: ${(await res.text()).slice(0, 160)}`);
        return null;
      }
      const json = (await res.json()) as {
        items?: Array<{ id?: { videoId?: string }; snippet?: { title?: string; channelTitle?: string } }>;
      };
      const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
      const want = norm(title);
      const hit = (json.items ?? []).find(
        (it) =>
          /voa learning english/i.test(it.snippet?.channelTitle ?? '') &&
          norm(it.snippet?.title ?? '').includes(want),
      );
      return hit?.id?.videoId ?? null;
    } catch (err) {
      this.logger.warn(`YouTube search failed: ${String(err)}`);
      return null;
    }
  }

  private async fetchText(url: string): Promise<string> {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'text/html' },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new BadRequestException(`voa_fetch_${res.status}`);
    return res.text();
  }

  /** Groq Whisper (verbose_json, word timestamps) on the small VOA mp4. */
  private async transcribeWords(videoUrl: string): Promise<SttWord[]> {
    const keys = resolveGroqApiKeys((k) => process.env[k]);
    if (keys.length === 0) throw new ServiceUnavailableException('groq_not_configured');
    const media = await fetch(videoUrl, {
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(60_000),
    });
    if (!media.ok) throw new BadRequestException(`voa_video_${media.status}`);
    const bytes = Buffer.from(await media.arrayBuffer());
    if (bytes.length > STT_MAX_BYTES) throw new BadRequestException('voa_video_too_large_for_stt');

    let lastErr = '';
    for (const key of [...keys].sort(() => Math.random() - 0.5)) {
      const form = new FormData();
      form.append('file', new Blob([bytes], { type: 'video/mp4' }), 'lesson.mp4');
      form.append('model', process.env.CLIPS_STT_MODEL || 'whisper-large-v3-turbo');
      form.append('response_format', 'verbose_json');
      form.append('timestamp_granularities[]', 'word');
      form.append('language', 'en');
      const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}` },
        body: form,
        signal: AbortSignal.timeout(120_000),
      });
      if (res.ok) {
        const json = (await res.json()) as { words?: SttWord[] };
        return (json.words ?? []).filter(
          (w) => typeof w.word === 'string' && Number.isFinite(w.start) && Number.isFinite(w.end),
        );
      }
      lastErr = `${res.status} ${(await res.text()).slice(0, 160)}`;
      if (res.status !== 429 && res.status < 500) break;
    }
    throw new ServiceUnavailableException(`stt_failed: ${lastErr}`);
  }
}
