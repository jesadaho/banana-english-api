/**
 * Generate the Chapter 1 TTS bank and upload it to Firebase Storage.
 *
 *   npx tsx scripts/build-chapter1-tts-bank.ts
 *
 * Resumes from src/tts/tts-bank.json. Skips lines that already have a URL.
 */
import { createSign, randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as admin from 'firebase-admin';
import { UserRefreshClient } from 'google-auth-library';
import { publicHeroUrl } from '../src/articles/article-hero';
import { collectChapter1BankLines } from '../src/tts/chapter1-tts-lines';
import {
  collectAdventureA2BankLines,
  collectFoundationBankLines,
} from '../src/tts/chapter2-tts-lines';
import {
  collectConversationBankLines,
  collectFoundationConversationBankLines,
} from '../src/tts/conversation-tts-lines';
import {
  TTS_BANK_MODEL,
  TTS_BANK_PROMPT,
  TTS_BANK_VOICE,
  ttsBankKey,
  ttsBankObjectPath,
  type TtsBankFile,
} from '../src/tts/tts-bank';
import { BARE_PRAISE_LINES } from '../src/tts/english-praises';
import { synthesisText } from '../src/tts/tts-speech-text';
import { getTurn2Script } from '../src/topics/intro_script';
import { V7_LEGACY_FLOWS } from '../src/lessons/foundation-v7-legacy-flows';

/** Spoken lines seen on live TTS that the lesson walker does not emit. */
function extraBankLines(): string[] {
  const seeYou = V7_LEGACY_FLOWS.fnd_v7_goodbye_see_you
    .map((step) => step.presentation?.text ?? '')
    .find((text) => text.startsWith('ถ้ารู้ว่าจะเจอกันพรุ่งนี้'));
  if (!seeYou) throw new Error('missing See you tomorrow teaching line');
  return [
    seeYou,
    'เวลาเจอคำที่ลงท้ายด้วย S อย่าลืมเติมเสียง s หรือ z สั้น ๆ ตอนท้ายครับ',
    'เรียนครบแล้วครับ Newbie คุณทำบทเรียนจบโดยได้รับคำแนะนำบางส่วน ลองฝึกอีกครั้งเพื่อให้คล่องขึ้นนะครับ',
    'สุดยอดครับ! 🎉 วันนี้คุณทักทายได้หลายแบบแล้ว ทั้ง Hello, Hi และทักทายตามเวลาในวัน 🍌',
    'สุดยอดครับ! 🎉 วันนี้คุณแนะนำตัวเป็นภาษาอังกฤษได้แล้ว ทั้งบอกชื่อ บอกว่ามาจากไหน และตอบเวลาพบคนใหม่ได้ 🍌',
    'เรียนครบแล้วครับ ลองทบทวนบทนี้อีกครั้งนะครับ',
    'Your mother! Is she a teacher?',
  ];
}

const BANK_PATH = resolve(__dirname, '../src/tts/tts-bank.json');
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
      throw new Error(`Google token mint failed (${response.status}): ${errText.slice(0, 180)}`);
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
  prompt: string | null,
  model: string,
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
          input: prompt ? { prompt, text } : { text },
          voice: {
            languageCode: 'en-US',
            name: TTS_BANK_VOICE,
            model_name: model,
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

function readBank(): TtsBankFile {
  try {
    return JSON.parse(readFileSync(BANK_PATH, 'utf8')) as TtsBankFile;
  } catch {
    return { model: TTS_BANK_MODEL, voice: TTS_BANK_VOICE, lines: {} };
  }
}

function writeBank(bank: TtsBankFile) {
  const lines = Object.fromEntries(
    Object.entries(bank.lines).sort(([a], [b]) => a.localeCompare(b)),
  );
  writeFileSync(
    BANK_PATH,
    `${JSON.stringify({ model: bank.model, voice: bank.voice, lines }, null, 2)}\n`,
  );
}

const CONVERSATION_MODEL = 'gemini-2.5-flash-tts';

async function main() {
  const conversationA1 = process.argv.includes('--conversation-a1');
  const lessonLines = new Set(
    [
      ...collectChapter1BankLines(),
      ...(await collectFoundationBankLines(2, 16)),
      ...(await collectAdventureA2BankLines(1, 8)),
      getTurn2Script().textEn,
      ...extraBankLines(),
    ].map((line) => ttsBankKey(line)),
  );
  const conversationLines = conversationA1
    ? collectFoundationConversationBankLines().filter((line) => !lessonLines.has(line))
    : collectConversationBankLines();
  const lines = conversationA1
    ? conversationLines
    : [...new Set([...lessonLines, ...conversationLines])].sort((a, b) =>
        a.localeCompare(b),
      );
  const bank = readBank();
  bank.model = TTS_BANK_MODEL;
  bank.voice = TTS_BANK_VOICE;
  const bucketName = storageBucketName();
  const versionMs = Date.now();
  let token = await mintAccessToken();
  let mintedAt = Date.now();
  let created = 0;

  async function freshToken(): Promise<string> {
    if (Date.now() - mintedAt > 45 * 60 * 1000) {
      token = await mintAccessToken();
      mintedAt = Date.now();
    }
    return token;
  }

  async function synthesizeFresh(
    text: string,
    prompt: string | null,
    model: string,
  ): Promise<Buffer> {
    try {
      return await synthesizeMp3(await freshToken(), text, prompt, model);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (!message.includes('TTS failed (401)')) throw err;
      token = await mintAccessToken();
      mintedAt = Date.now();
      return synthesizeMp3(token, text, prompt, model);
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const spoken = lines[i];
    const key = ttsBankKey(spoken);
    const model = conversationA1 ? CONVERSATION_MODEL : TTS_BANK_MODEL;
    const objectPath = ttsBankObjectPath(spoken, model);
    const objectHash = objectPath.slice('tts/v1/'.length, -'.mp3'.length);
    const ready = conversationA1
      ? bank.lines[key]?.includes(objectHash)
      : Boolean(bank.lines[key]);
    if (ready) {
      console.log(`[${i + 1}/${lines.length}] skip`);
      continue;
    }
    if (conversationA1) await sleep(8000);
    const text = synthesisText(spoken);
    const prompt = (BARE_PRAISE_LINES as readonly string[]).includes(spoken)
      ? null
      : TTS_BANK_PROMPT;
    let audio: Buffer;
    try {
      audio = await synthesizeFresh(text, prompt, model);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (!message.includes('TTS failed (400)')) throw err;
      if (prompt) {
        try {
          audio = await synthesizeFresh(text, null, model);
        } catch (retryErr) {
          const retryMessage = retryErr instanceof Error ? retryErr.message : String(retryErr);
          if (!retryMessage.includes('TTS failed (400)')) throw retryErr;
          console.error(`[${i + 1}/${lines.length}] blocked ${spoken.slice(0, 80)}`);
          continue;
        }
      } else {
        console.error(`[${i + 1}/${lines.length}] blocked ${spoken.slice(0, 80)}`);
        continue;
      }
    }
    const uploaded = await uploadWithAdmin(bucketName, objectPath, audio);
    if (!uploaded) await uploadWithCliToken(bucketName, objectPath, audio);
    bank.lines[key] = publicHeroUrl(bucketName, objectPath, versionMs);
    writeBank(bank);
    created++;
    console.log(`[${i + 1}/${lines.length}] ${audio.length} bytes`);
  }

  console.log(`done ${Object.keys(bank.lines).length} lines (${created} new)`);
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(message);
  process.exit(1);
});
