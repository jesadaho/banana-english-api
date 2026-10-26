/**
 * Cache conversation lines in each character's voice.
 *
 *   npx tsx scripts/build-conversation-tts-bank.ts
 *
 * Resumes from src/tts/conversation-tts-bank.json. A missing clip stays on
 * live TTS; this script never writes the Teacher B bank.
 */
import { createSign, randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as admin from 'firebase-admin';
import { UserRefreshClient } from 'google-auth-library';
import { publicHeroUrl } from '../src/articles/article-hero';
import {
  CONVERSATION_TTS_MODEL,
  collectConversationBankJobs,
  collectTeacherScenarioBankJobs,
  conversationClipObjectPath,
  type ConversationTtsBank,
} from '../src/tts/conversation-tts-bank';
import { synthesisText } from '../src/tts/tts-speech-text';

const BANK_PATH = resolve(__dirname, '../src/tts/conversation-tts-bank.json');
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

function base64Url(input: string | Buffer): string {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf8') : input;
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function ttsCredentials(): { client_email: string; private_key: string } | null {
  const jsonRaw = process.env.GOOGLE_CLOUD_TTS_CREDENTIALS_JSON?.trim();
  if (jsonRaw) {
    const parsed = JSON.parse(jsonRaw) as {
      client_email?: string;
      private_key?: string;
    };
    if (parsed.client_email && parsed.private_key) {
      return {
        client_email: parsed.client_email,
        private_key: parsed.private_key.replace(/\\n/g, '\n'),
      };
    }
  }
  const clientEmail = process.env.GOOGLE_CLOUD_TTS_CLIENT_EMAIL?.trim();
  const privateKey = process.env.GOOGLE_CLOUD_TTS_PRIVATE_KEY?.replace(
    /\\n/g,
    '\n',
  )?.trim();
  if (clientEmail && privateKey) {
    return { client_email: clientEmail, private_key: privateKey };
  }
  return null;
}

async function mintAccessToken(): Promise<string> {
  const creds = ttsCredentials();
  if (creds) {
    const nowSec = Math.floor(Date.now() / 1000);
    const header = { alg: 'RS256', typ: 'JWT' };
    const payload = {
      iss: creds.client_email,
      sub: creds.client_email,
      aud: 'https://oauth2.googleapis.com/token',
      iat: nowSec,
      exp: nowSec + 3600,
      scope: 'https://www.googleapis.com/auth/cloud-platform',
      jti: randomUUID(),
    };
    const unsigned = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(payload))}`;
    const signer = createSign('RSA-SHA256');
    signer.update(unsigned);
    signer.end();
    const assertion = `${unsigned}.${base64Url(signer.sign(creds.private_key))}`;
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      }),
    });
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(
        `Google token mint failed (${response.status}): ${errText.slice(0, 180)}`,
      );
    }
    const data = (await response.json()) as { access_token?: string };
    if (!data.access_token) throw new Error('Google token response missing access_token');
    return data.access_token;
  }

  const refreshToken = firebaseCliRefreshToken();
  if (!refreshToken) {
    throw new Error(
      'Cloud TTS credentials missing. Set GOOGLE_CLOUD_TTS_* or run firebase login.',
    );
  }
  const client = new UserRefreshClient(
    FIREBASE_CLI_CLIENT_ID,
    FIREBASE_CLI_CLIENT_SECRET,
    refreshToken,
  );
  const { token } = await client.getAccessToken();
  if (!token) throw new Error('Could not refresh Firebase CLI access token');
  return token;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function synthesizeMp3(
  token: string,
  text: string,
  voice: string,
  prompt: string,
): Promise<Buffer> {
  let lastError = 'TTS failed';
  for (let attempt = 1; attempt <= 8; attempt++) {
    const response = await fetch(
      'https://texttospeech.googleapis.com/v1/text:synthesize',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'x-goog-user-project':
            process.env.FIREBASE_PROJECT_ID?.trim() || 'banana-english-ecf11',
        },
        body: JSON.stringify({
          input: { prompt, text },
          voice: {
            languageCode: 'en-US',
            name: voice,
            model_name: CONVERSATION_TTS_MODEL,
          },
          audioConfig: {
            audioEncoding: 'MP3',
            sampleRateHertz: 24000,
          },
        }),
      },
    );
    if (response.ok) {
      const data = (await response.json()) as { audioContent?: string };
      if (!data.audioContent) throw new Error('TTS response missing audioContent');
      return Buffer.from(data.audioContent, 'base64');
    }
    const errText = await response.text();
    lastError = `TTS failed (${response.status}): ${errText.slice(0, 240)}`;
    if (response.status !== 429 || attempt === 8) {
      throw new Error(lastError);
    }
    console.error(`rate limited, waiting ${attempt * 15}s`);
    await sleep(attempt * 15_000);
  }
  throw new Error(lastError);
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
      contentType: 'audio/mpeg',
      cacheControl: 'public, max-age=31536000, immutable',
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
      'Content-Type': 'audio/mpeg',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
    body: buffer,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Upload failed for ${path}: ${res.status} ${body.slice(0, 240)}`);
  }
}

function readBank(): ConversationTtsBank {
  try {
    return JSON.parse(readFileSync(BANK_PATH, 'utf8')) as ConversationTtsBank;
  } catch {
    return { model: CONVERSATION_TTS_MODEL, clips: {} };
  }
}

function writeBank(bank: ConversationTtsBank) {
  const clips = Object.fromEntries(
    Object.entries(bank.clips).sort(([a], [b]) => a.localeCompare(b)),
  );
  writeFileSync(
    BANK_PATH,
    `${JSON.stringify({ model: CONVERSATION_TTS_MODEL, clips }, null, 2)}\n`,
  );
}

async function main() {
  const speakerFilter = process.argv
    .find((arg) => arg.startsWith('--speaker='))
    ?.slice('--speaker='.length)
    ?.trim();
  const jobs = (
    process.argv.includes('--only-scenario-teachers')
      ? collectTeacherScenarioBankJobs()
      : collectConversationBankJobs()
  ).filter((job) => !speakerFilter || job.voice.speaker === speakerFilter);
  const bank = readBank();
  const bucketName = storageBucketName();
  const versionMs = Date.now();
  let token = await mintAccessToken();
  let mintedAt = Date.now();
  let created = 0;
  let blocked = 0;

  async function freshToken(): Promise<string> {
    if (Date.now() - mintedAt > 45 * 60 * 1000) {
      token = await mintAccessToken();
      mintedAt = Date.now();
    }
    return token;
  }

  console.log(`${jobs.length} character lines`);
  for (let i = 0; i < jobs.length; i++) {
    const job = jobs[i];
    if (bank.clips[job.hash]?.url) {
      console.log(`[${i + 1}/${jobs.length}] skip ${job.voice.speaker}`);
      continue;
    }
    await sleep(2000);
    const text = synthesisText(job.text);
    let audio: Buffer;
    try {
      audio = await synthesizeMp3(
        await freshToken(),
        text,
        job.voice.voice,
        job.voice.prompt,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('TTS failed (401)')) {
        token = await mintAccessToken();
        mintedAt = Date.now();
        audio = await synthesizeMp3(token, text, job.voice.voice, job.voice.prompt);
      } else if (message.includes('TTS failed (400)')) {
        blocked++;
        console.error(
          `[${i + 1}/${jobs.length}] blocked ${job.voice.speaker}: ${job.text.slice(0, 80)}`,
        );
        continue;
      } else {
        throw err;
      }
    }
    const objectPath = conversationClipObjectPath(job.hash);
    const uploaded = await uploadWithAdmin(bucketName, objectPath, audio);
    if (!uploaded) await uploadWithCliToken(bucketName, objectPath, audio);
    bank.clips[job.hash] = {
      voice: job.voice.voice,
      text: job.text,
      url: publicHeroUrl(bucketName, objectPath, versionMs),
    };
    writeBank(bank);
    created++;
    console.log(
      `[${i + 1}/${jobs.length}] ${job.voice.speaker} ${audio.length} bytes ${job.text.slice(0, 60)}`,
    );
  }

  console.log(
    `done ${Object.keys(bank.clips).length} clips (${created} new, ${blocked} blocked)`,
  );
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(message);
  process.exit(1);
});
