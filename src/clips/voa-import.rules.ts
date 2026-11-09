/**
 * VOA Learning English importer — pure parsing + timing helpers.
 * VOA-produced text/audio/video is public domain (credit VOA); AP / other
 * licensed material on the same pages is NOT, so we only take the lesson
 * dialogue and VOA's own video.
 */

export const VOA_HOST = 'learningenglish.voanews.com';
export const VOA_CREDIT = 'Voice of America (VOA Learning English) · public domain';

export type VoaVideoFile = { url: string; base: string; quality: string };

export type VoaLesson = {
  title: string;
  thumbnailUrl: string;
  /** Main lesson video files (first video on the page), all qualities. */
  videos: VoaVideoFile[];
  /** Dialogue lines in order: "Anna: Hi there!" → { speaker, text }. */
  lines: Array<{ speaker: string; text: string }>;
};

export function isVoaUrl(url: string): boolean {
  try {
    return new URL(url).hostname === VOA_HOST;
  } catch {
    return false;
  }
}

/** Series page (/p/5644.html, /z/…) vs a lesson article (/a/…/123.html). */
export function isVoaLessonUrl(url: string): boolean {
  try {
    return /^\/a\//.test(new URL(url).pathname);
  } catch {
    return false;
  }
}

const ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', hellip: '…', mdash: '—', ndash: '–',
};

export function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[name.toLowerCase()] ?? m);
}

/** Block-aware HTML → text lines (scripts/styles dropped). */
export function htmlToLines(html: string): string[] {
  const text = html
    .replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li|tr|section|article|header|figure|figcaption|blockquote)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');
  return decodeEntities(text)
    .split('\n')
    .map((l) => l.replace(/[ \t ]+/g, ' ').trim())
    .filter(Boolean);
}

function meta(html: string, prop: string): string {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${prop}["'][^>]*content=["']([^"']*)["']|<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${prop}["']`,
    'i',
  );
  const m = re.exec(html);
  return decodeEntities((m?.[1] ?? m?.[2] ?? '').trim());
}

const SPEAKER = /^([A-Z][A-Za-z.'’-]*(?: [A-Z][A-Za-z.'’-]*){0,2}):\s*(\S.*)$/;
const STOP_HEADINGS = [
  'speaking practice', 'pronunciation practice', 'pronunciation', 'learning strategy',
  'test yourself', 'new words', 'words in this lesson', 'words in this story',
  'grammar', 'writing', 'practice', 'quiz', 'lesson resources', 'ask the teacher',
  'free materials', 'download', 'related', 'see comments', 'comments',
];

/** Lines of the "Conversation" block (or the first run of speaker lines). */
export function extractDialogue(lines: string[]): Array<{ speaker: string; text: string }> {
  const lower = lines.map((l) => l.toLowerCase().replace(/[:.]$/, ''));
  let start = lower.findIndex((l) => l === 'conversation' || l === 'the conversation');
  if (start < 0) start = lines.findIndex((l) => SPEAKER.test(l)) - 1;
  if (start < -1) return [];
  const out: Array<{ speaker: string; text: string }> = [];
  let speaker = '';
  for (let i = start + 1; i < lines.length; i++) {
    const l = lines[i];
    if (STOP_HEADINGS.includes(lower[i])) break;
    const m = SPEAKER.exec(l);
    if (m) {
      speaker = m[1];
      out.push({ speaker, text: m[2].trim() });
    } else if (out.length > 0) {
      // Plain line inside the conversation: narrator, or a speaker's next paragraph.
      if (l.length > 400 || /^(©|copyright|share|print|email)/i.test(l)) break;
      out.push({ speaker: speaker || 'Narrator', text: l });
    }
  }
  return out;
}

export function extractVideos(html: string): VoaVideoFile[] {
  const seen = new Set<string>();
  const files: VoaVideoFile[] = [];
  const re = /https?:\/\/voa-video[a-z0-9.-]*\.[a-z.]+\/[^"'\s<>?]+?\.mp4/gi;
  for (const m of html.matchAll(re)) {
    const url = m[0];
    if (seen.has(url)) continue;
    seen.add(url);
    const q = /_(\d{3,4}p|hq|mobile)\.mp4$/i.exec(url)?.[1]?.toLowerCase() ?? 'default';
    files.push({ url, base: url.replace(/(_(\d{3,4}p|hq|mobile))?\.mp4$/i, ''), quality: q });
  }
  if (files.length === 0) return [];
  const main = files[0].base;
  return files.filter((f) => f.base === main);
}

export function parseVoaLesson(html: string): VoaLesson {
  const rawTitle = meta(html, 'og:title') || /<title>([^<]*)<\/title>/i.exec(html)?.[1] || '';
  return {
    title: decodeEntities(rawTitle).replace(/\s*[|-]\s*VOA.*$/i, '').trim(),
    thumbnailUrl: meta(html, 'og:image'),
    videos: extractVideos(html),
    lines: extractDialogue(htmlToLines(html)),
  };
}

/** Lesson links on a series page (absolute, deduped, page order). */
export function parseVoaSeries(html: string): Array<{ url: string; title: string }> {
  const out: Array<{ url: string; title: string }> = [];
  const seen = new Set<string>();
  const re = /<a[^>]+href=["']((?:https?:\/\/learningenglish\.voanews\.com)?\/a\/[^"'#?]+?\.html)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const m of html.matchAll(re)) {
    const url = m[1].startsWith('http') ? m[1] : `https://${VOA_HOST}${m[1]}`;
    if (seen.has(url)) continue;
    const titleAttr = /title=["']([^"']+)["']/i.exec(m[0])?.[1];
    const title = decodeEntities((titleAttr ?? m[2].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim());
    if (!title) continue;
    seen.add(url);
    out.push({ url, title });
  }
  return out;
}

const DISPLAY_ORDER = ['480p', 'default', '720p', '360p', 'hq', '1080p', '240p', 'mobile'];
const STT_ORDER = ['240p', 'mobile', 'default', '360p', '480p', 'hq', '720p', '1080p'];

/** Video the app plays (mid quality) and the small one we send to STT. */
export function pickVoaVideos(files: VoaVideoFile[]): { play: string; stt: string } | null {
  if (files.length === 0) return null;
  const by = (order: string[]) =>
    [...files].sort((a, b) => rank(order, a.quality) - rank(order, b.quality))[0].url;
  return { play: by(DISPLAY_ORDER), stt: by(STT_ORDER) };
}

function rank(order: string[], q: string): number {
  const i = order.indexOf(q);
  return i < 0 ? order.length : i;
}

/** Dialogue turns → sentences (a long turn becomes several practice lines). */
export function dialogueSentences(lines: Array<{ speaker: string; text: string }>): string[] {
  const out: string[] = [];
  for (const { text } of lines) {
    const parts = text.match(/[^.!?]+[.!?]+["”’)]*|[^.!?]+$/g) ?? [text];
    let buf = '';
    for (const p of parts.map((x) => x.trim()).filter(Boolean)) {
      buf = buf ? `${buf} ${p}` : p;
      // Keep tiny bits ("Oh." "Hi!") with the next sentence of the same turn.
      if (buf.split(/\s+/).length >= 3) {
        out.push(buf);
        buf = '';
      }
    }
    if (buf) {
      if (out.length && buf.split(/\s+/).length < 2 && parts.length > 1) out[out.length - 1] += ` ${buf}`;
      else out.push(buf);
    }
  }
  return out;
}

export type SttWord = { word: string; start: number; end: number };

const norm = (w: string) => w.toLowerCase().replace(/[^a-z0-9']/g, '').replace(/’/g, "'");

/**
 * Give each sentence start/end (ms) from Whisper word timestamps: align the
 * transcript's words to the heard words in order (LCS), then take the first /
 * last matched word of each sentence. Unmatched sentences are interpolated.
 */
export function alignSentences(
  sentences: string[],
  words: SttWord[],
): Array<{ text: string; startMs: number; endMs: number }> {
  const tTok: Array<{ s: number; w: string }> = [];
  sentences.forEach((s, si) => {
    for (const w of s.split(/\s+/)) {
      const n = norm(w);
      if (n) tTok.push({ s: si, w: n });
    }
  });
  const hTok = words.map((w) => ({ ...w, n: norm(w.word) })).filter((w) => w.n);
  const n = tTok.length;
  const m = hTok.length;
  // LCS table (Uint16 rows keep memory small: ~ n*m*2 bytes).
  const dp: Uint16Array[] = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = tTok[i].w === hTok[j].n
        ? dp[i + 1][j + 1] + 1
        : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const first: number[] = sentences.map(() => -1);
  const last: number[] = sentences.map(() => -1);
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (tTok[i].w === hTok[j].n) {
      const si = tTok[i].s;
      const startMs = Math.round(hTok[j].start * 1000);
      const endMs = Math.round(hTok[j].end * 1000);
      if (first[si] < 0) first[si] = startMs;
      last[si] = endMs;
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      i++;
    } else {
      j++;
    }
  }
  // Interpolate gaps from neighbours.
  const out = sentences.map((text, k) => ({ text, startMs: first[k], endMs: last[k] }));
  for (let k = 0; k < out.length; k++) {
    if (out[k].startMs >= 0) continue;
    const prevEnd = k > 0 ? out[k - 1].endMs : 0;
    let nk = k + 1;
    while (nk < out.length && out[nk].startMs < 0) nk++;
    const nextStart = nk < out.length ? out[nk].startMs : prevEnd + 3000 * (nk - k);
    const slot = Math.max(800, (nextStart - prevEnd) / (nk - k));
    out[k].startMs = Math.round(prevEnd + 50);
    out[k].endMs = Math.round(prevEnd + slot - 50);
  }
  // Pad a little (STT word edges are tight) without overlapping neighbours.
  for (let k = 0; k < out.length; k++) {
    const prevEnd = k > 0 ? out[k - 1].endMs : 0;
    const nextStart = k + 1 < out.length ? out[k + 1].startMs : Number.MAX_SAFE_INTEGER;
    out[k].startMs = Math.max(prevEnd, out[k].startMs - 150);
    out[k].endMs = Math.min(Math.max(nextStart - 20, out[k].startMs + 300), out[k].endMs + 300);
    if (out[k].endMs <= out[k].startMs) out[k].endMs = out[k].startMs + 300;
  }
  return out;
}
