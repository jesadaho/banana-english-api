/**
 * Upload Describe It web cards to Firebase Storage.
 *
 *   npx tsx scripts/upload-describe-it-images.ts
 *   npx tsx scripts/upload-describe-it-images.ts fnd_v7_u03n05
 *
 * Uses FIREBASE_* service-account env if present, otherwise the logged-in
 * Firebase CLI refresh token.
 */
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import * as admin from 'firebase-admin';
import { UserRefreshClient } from 'google-auth-library';
import { publicHeroUrl } from '../src/articles/article-hero';
import { DESCRIBE_IT_POOLS } from '../src/describe-it/describe-it.data';

const OUTPUT_ROOT =
  '/Users/jesada/Documents/Codex/2026-08-20/new-chat-2/output/describe-it';

/** Local web folder + optional filename remap (storage id → local file). */
const POOL_SOURCES: Record<
  string,
  { dir: string; localName?: (itemId: string) => string }
> = {
  fnd_v7_u13n05: {
    dir: `${OUTPUT_ROOT}/v7_u13n05/web`,
  },
  fnd_v7_u03n05: {
    dir: `${OUTPUT_ROOT}/v7_u03n05/web`,
    localName: (itemId) => `${itemId}-v1.webp`,
  },
  fnd_v7_u04n05: {
    dir: `${OUTPUT_ROOT}/v7_u04n05/web`,
    localName: (itemId) => `${itemId}-v1.webp`,
  },
  fnd_v7_u05n05: {
    dir: `${OUTPUT_ROOT}/v7_u05n05/web`,
    localName: (itemId) => `${itemId}-v1.webp`,
  },
  fnd_v7_u06n06: {
    dir: `${OUTPUT_ROOT}/v7_u06n06/web`,
    localName: (itemId) =>
      itemId === '08-those-white-books'
        ? `${itemId}-v2.webp`
        : `${itemId}-v1.webp`,
  },
  fnd_v7_u06n16: {
    dir: `${OUTPUT_ROOT}/v7_u06n16-v1/web`,
  },
};

const FIREBASE_CLI_CLIENT_ID =
  '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com';
const FIREBASE_CLI_CLIENT_SECRET = 'j9iVZfS8kkCEFUPaAeJV0sAi';

function loadDotEnv() {
  const envPath = resolve(__dirname, '../.env');
  try {
    const text = readFileSync(envPath, 'utf8');
    for (const rawLine of text.split(/\r?\n/)) {
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
    // Local .env is optional when credentials are already in the environment.
  }
}

loadDotEnv();

function storageBucketName(): string {
  const projectId =
    process.env.FIREBASE_PROJECT_ID?.trim() || 'banana-english-ecf11';
  return (
    process.env.FIREBASE_STORAGE_BUCKET?.trim() ||
    `${projectId}.firebasestorage.app`
  );
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

async function uploadWithAdmin(bucketName: string, path: string, buffer: Buffer) {
  const projectId =
    process.env.FIREBASE_PROJECT_ID?.trim() || 'banana-english-ecf11';
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!clientEmail || !privateKey) return false;
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
      storageBucket: bucketName,
    });
  }
  const file = admin.storage().bucket(bucketName).file(path);
  await file.save(buffer, {
    resumable: false,
    metadata: {
      contentType: 'image/webp',
      cacheControl: 'public, max-age=3600',
    },
  });
  try {
    await file.makePublic();
  } catch {
    // Public Storage rules already allow unauthenticated reads.
  }
  return true;
}

async function uploadWithCliToken(bucketName: string, path: string, buffer: Buffer) {
  const refreshToken = firebaseCliRefreshToken();
  if (!refreshToken) {
    throw new Error(
      'Firebase credentials missing. Add FIREBASE_* to .env or run firebase login.',
    );
  }
  const client = new UserRefreshClient(
    FIREBASE_CLI_CLIENT_ID,
    FIREBASE_CLI_CLIENT_SECRET,
    refreshToken,
  );
  const { token } = await client.getAccessToken();
  if (!token) throw new Error('Could not refresh Firebase CLI access token');
  const url =
    `https://storage.googleapis.com/upload/storage/v1/b/${encodeURIComponent(bucketName)}` +
    `/o?uploadType=media&name=${encodeURIComponent(path)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'image/webp',
      'Cache-Control': 'public, max-age=3600',
    },
    body: buffer,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Upload failed for ${path}: ${res.status} ${body.slice(0, 240)}`);
  }
}

async function uploadPool(poolId: string) {
  const pool = DESCRIBE_IT_POOLS[poolId];
  if (!pool) throw new Error(`Missing pool ${poolId}`);
  const source = POOL_SOURCES[poolId];
  if (!source) throw new Error(`No local source mapped for ${poolId}`);

  const bucketName = storageBucketName();
  const versionMs = Date.now();
  for (const item of pool.items) {
    const fileName = source.localName?.(item.id) ?? `${item.id}.webp`;
    const localPath = `${source.dir}/${fileName}`;
    const buffer = await readFile(localPath);
    const uploaded = await uploadWithAdmin(bucketName, item.imagePath, buffer);
    if (!uploaded) {
      await uploadWithCliToken(bucketName, item.imagePath, buffer);
    }
    console.log(`${item.id}\t${publicHeroUrl(bucketName, item.imagePath, versionMs)}`);
  }
}

async function main() {
  const only = process.argv[2]?.trim();
  const poolIds = only ? [only] : Object.keys(POOL_SOURCES);
  for (const poolId of poolIds) {
    console.log(`\n== ${poolId} ==`);
    await uploadPool(poolId);
  }
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(message);
  process.exit(1);
});
