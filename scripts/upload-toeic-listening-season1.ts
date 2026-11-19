/**
 * Upload Banana Originals · TOEIC Listening Season 1 media:
 * - full.mp3 → Bunny Storage (manifest.storagePath)
 * - cover webp → Firebase Storage
 * Writes clips-cc/banana-originals/toeic-listening/catalog.json for seed.
 *
 *   npx tsx scripts/upload-toeic-listening-season1.ts
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { UserRefreshClient } from 'google-auth-library';
import * as admin from 'firebase-admin';

const SRC_ROOT =
  process.env.TOEIC_LISTENING_SRC?.trim() ||
  '/Users/jesada/Documents/Codex/2026-08-20/users-jesada-project-banana-english-api/outputs/toeic-listening-series';
const AUDIO_ROOT = resolve(SRC_ROOT, 'audio-season-1');
const COVER_ROOT = resolve(SRC_ROOT, 'cover-template/round-v1');
const OUT_DIR = resolve(process.cwd(), 'clips-cc/banana-originals/toeic-listening');

function loadDotEnv() {
  try {
    const raw = readFileSync(resolve(process.cwd(), '.env'), 'utf8');
    for (const rawLine of raw.split(/\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq <= 0) continue;
      const key = line.slice(0, eq).trim();
      let value = line.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (process.env[key] == null || process.env[key] === '') {
        process.env[key] = value.replace(/\\n/g, '\n');
      }
    }
  } catch {
    /* optional */
  }
}

loadDotEnv();

/** Same public OAuth client firebase-tools / describe-it uploader use. */
const FB_CLI_ID =
  '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com';
const FB_CLI_SECRET = 'FAKESECRET_g1h2i3j4k5l6m7n8o9p0';

type ManifestLine = {
  id: string;
  section: string;
  text: string;
  startMs: number;
  endMs: number;
};
type Manifest = {
  episodeId: string;
  title: string;
  durationMs: number;
  storagePath: string;
  lines: ManifestLine[];
};

function storageBucketName(): string {
  const projectId =
    process.env.FIREBASE_PROJECT_ID?.trim() || 'banana-english-ecf11';
  return (
    process.env.FIREBASE_STORAGE_BUCKET?.trim() ||
    `${projectId}.firebasestorage.app`
  );
}

function bunnyBase(): string {
  return (
    process.env.BUNNY_CLIPS_BASE_URL?.trim() ||
    process.env.BUNNY_CUTSCENE_BASE_URL?.trim() ||
    'https://banana-english-cutscenes.b-cdn.net'
  ).replace(/\/$/, '');
}

function firebaseCliRefreshToken(): string | null {
  try {
    const cfgPath = resolve(
      process.env.HOME ?? '',
      '.config/configstore/firebase-tools.json',
    );
    const cfg = JSON.parse(readFileSync(cfgPath, 'utf8')) as {
      tokens?: { refresh_token?: string };
    };
    return cfg.tokens?.refresh_token?.trim() || null;
  } catch {
    return null;
  }
}

function publicFirebaseUrl(bucket: string, path: string): string {
  return (
    `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket)}` +
    `/o/${encodeURIComponent(path)}?alt=media`
  );
}

async function uploadBunny(path: string, buffer: Buffer, contentType: string) {
  const zone = process.env.BUNNY_STORAGE_ZONE_NAME?.trim();
  const password = process.env.BUNNY_STORAGE_PASSWORD?.trim();
  if (!zone || !password) throw new Error('BUNNY_STORAGE_ZONE_NAME / BUNNY_STORAGE_PASSWORD missing');
  // banana-english-cutscenes lives in the Singapore storage region.
  const host =
    process.env.BUNNY_STORAGE_HOST?.trim() || 'https://sg.storage.bunnycdn.com';
  const url = `${host.replace(/\/$/, '')}/${zone}/${path}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      AccessKey: password,
      'Content-Type': contentType,
      accept: 'application/json',
    },
    body: buffer,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Bunny upload failed ${path}: ${res.status} ${body.slice(0, 200)}`);
  }
}

async function uploadFirebase(path: string, buffer: Buffer, contentType: string) {
  const bucketName = storageBucketName();
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (clientEmail && privateKey) {
    const projectId =
      process.env.FIREBASE_PROJECT_ID?.trim() || 'banana-english-ecf11';
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
        storageBucket: bucketName,
      });
    }
    const file = admin.storage().bucket(bucketName).file(path);
    await file.save(buffer, {
      resumable: false,
      metadata: { contentType, cacheControl: 'public, max-age=31536000, immutable' },
    });
    try {
      await file.makePublic();
    } catch {
      /* rules may already allow public read */
    }
    return publicFirebaseUrl(bucketName, path);
  }
  const refreshToken = firebaseCliRefreshToken();
  if (!refreshToken) {
    throw new Error('Firebase credentials missing (FIREBASE_* or firebase login)');
  }
  const client = new UserRefreshClient(FB_CLI_ID, FB_CLI_SECRET, refreshToken);
  const { token } = await client.getAccessToken();
  if (!token) throw new Error('Could not refresh Firebase CLI access token');
  const url =
    `https://storage.googleapis.com/upload/storage/v1/b/${encodeURIComponent(bucketName)}` +
    `/o?uploadType=media&name=${encodeURIComponent(path)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
    body: buffer,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Firebase upload failed ${path}: ${res.status} ${body.slice(0, 240)}`);
  }
  return publicFirebaseUrl(bucketName, path);
}

function findCover(epNum: number): string {
  const prefix = `cover-ep${String(epNum).padStart(2, '0')}-`;
  const hit = readdirSync(COVER_ROOT).find(
    (f) => f.startsWith(prefix) && f.endsWith('.webp'),
  );
  if (!hit) throw new Error(`Missing cover for EP${epNum}`);
  return resolve(COVER_ROOT, hit);
}

function levelFor(ep: number): string {
  return ep <= 6 ? 'A2' : 'B1';
}

async function main() {
  if (!existsSync(AUDIO_ROOT)) throw new Error(`Missing ${AUDIO_ROOT}`);
  mkdirSync(OUT_DIR, { recursive: true });
  const base = bunnyBase();
  const episodes: Array<Record<string, unknown>> = [];

  for (let i = 1; i <= 18; i++) {
    const ep = `ep${String(i).padStart(2, '0')}`;
    const dir = resolve(AUDIO_ROOT, ep);
    const manifest = JSON.parse(
      readFileSync(resolve(dir, 'manifest.json'), 'utf8'),
    ) as Manifest;
    const mp3 = readFileSync(resolve(dir, 'full.mp3'));
    const coverPath = findCover(i);
    const coverBuf = readFileSync(coverPath);

    console.log(`↑ ${manifest.episodeId} audio ${manifest.storagePath}`);
    await uploadBunny(manifest.storagePath, mp3, 'audio/mpeg');
    const audioUrl = `${base}/${manifest.storagePath}`;

    // Prefer Firebase for covers; fall back to Bunny when Firebase creds are absent.
    const coverStorage = `clips/banana-originals/toeic-listening/${ep}/cover.webp`;
    const bunnyCoverPath = `banana-originals/toeic-listening/covers/${ep}.webp`;
    let thumbnailUrl: string;
    try {
      console.log(`↑ ${manifest.episodeId} cover firebase ${coverStorage}`);
      thumbnailUrl = await uploadFirebase(coverStorage, coverBuf, 'image/webp');
    } catch (err) {
      console.warn(
        `Firebase cover upload failed (${err instanceof Error ? err.message : String(err)}); using Bunny`,
      );
      console.log(`↑ ${manifest.episodeId} cover bunny ${bunnyCoverPath}`);
      await uploadBunny(bunnyCoverPath, coverBuf, 'image/webp');
      thumbnailUrl = `${base}/${bunnyCoverPath}`;
    }

    const id = `toeic_s1_${ep}`;
    const chapters: Array<{ id: string; label: string; fromIdx: number; toIdx: number }> =
      [];
    const bySection = new Map<string, number[]>();
    manifest.lines.forEach((line, idx) => {
      const sec = (line.section || '').trim().toUpperCase();
      if (!sec) return;
      const list = bySection.get(sec) ?? [];
      list.push(idx);
      bySection.set(sec, list);
    });
    // EP02–06 (Question–Response): the script groups 12 mini-scenes into 3
    // chapters (**Chapter N · …**); the manifest carries `chapter` per line.
    const byChapter = new Map<number, number[]>();
    manifest.lines.forEach((line, idx) => {
      const ch = Number((line as { chapter?: number }).chapter ?? 0);
      if (!ch) return;
      const list = byChapter.get(ch) ?? [];
      list.push(idx);
      byChapter.set(ch, list);
    });
    if (bySection.size === 0 && byChapter.size > 0) {
      for (const [ch, idxs] of [...byChapter.entries()].sort((a, b) => a[0] - b[0])) {
        const id = String.fromCharCode(64 + ch);
        chapters.push({ id, label: `Part ${id}`, fromIdx: idxs[0]!, toIdx: idxs[idxs.length - 1]! });
      }
    } else if (bySection.size > 0) {
      for (const [sec, idxs] of [...bySection.entries()].sort((a, b) =>
        a[0].localeCompare(b[0]),
      )) {
        chapters.push({
          id: sec,
          label: `Part ${sec}`,
          fromIdx: idxs[0]!,
          toIdx: idxs[idxs.length - 1]!,
        });
      }
    } else {
      // EP01 photographs etc. have no section markers — split for practice.
      const n = manifest.lines.length;
      const size = Math.max(1, Math.ceil(n / 3));
      for (let i = 0; i < 3; i++) {
        const start = i * size;
        if (start >= n) break;
        const end = i === 2 ? n - 1 : Math.min(n - 1, start + size - 1);
        const id = String.fromCharCode(65 + i);
        chapters.push({ id, label: `Part ${id}`, fromIdx: start, toIdx: end });
      }
    }

    episodes.push({
      id,
      episode: i,
      episodeId: manifest.episodeId,
      title: manifest.title,
      titleTh: '',
      level: levelFor(i),
      category: 'toeic',
      credit: 'Banana Original',
      source: 'audio',
      sourceUrl: `banana-originals://toeic-listening/${ep}`,
      audioUrl,
      storagePath: manifest.storagePath,
      thumbnailUrl,
      durationSec: Math.round(manifest.durationMs / 1000),
      sortOrder: i,
      chapters,
      sentences: manifest.lines.map((line, idx) => ({
        idx,
        startMs: line.startMs,
        endMs: line.endMs,
        text: line.text,
        textTh: '',
        section: (line.section || 'A').toUpperCase(),
      })),
      audioSha256: createHash('sha256').update(mp3).digest('hex'),
    });
    console.log(`✓ ${id} ${manifest.title}`);
  }

  const catalog = {
    series: 'toeic-listening',
    season: 1,
    title: 'TOEIC Listening Practice',
    channel: 'Banana Original',
    bunnyBase: base,
    uploadedAt: new Date().toISOString(),
    episodes,
  };
  const outPath = resolve(OUT_DIR, 'catalog.json');
  writeFileSync(outPath, `${JSON.stringify(catalog, null, 2)}\n`);
  console.log(`Wrote ${outPath} (${episodes.length} episodes)`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
