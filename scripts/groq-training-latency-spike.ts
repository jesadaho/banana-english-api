/**
 * Compare training turn latency: Groq vs Gemini (direct API calls).
 *
 * Usage:
 *   GEMINI_API_KEY=... GROQ_API_KEY=... tsx scripts/groq-training-latency-spike.ts
 *
 * Optional:
 *   LESSON_ID=greetings
 *   GROQ_CHAT_MODEL=llama-3.3-70b-versatile
 *   GEMINI_CHAT_MODEL=gemini-3.1-flash-lite
 *   RUNS=3
 */

import { getLesson } from '../src/lessons/lessons.data';
import {
  buildLessonSystemInstruction,
  renderOpeningPrompt,
  teachingLanguageFromConfig,
} from '../src/lessons/lesson-prompt';
import { lessonUsesTapToContinue } from '../src/lessons/lessons.data';

const LESSON_ID = process.env.LESSON_ID ?? 'greetings';
const RUNS = Number(process.env.RUNS ?? '3');
const GROQ_MODEL =
  process.env.GROQ_CHAT_MODEL ?? 'llama-3.3-70b-versatile';
const GEMINI_MODEL =
  process.env.GEMINI_CHAT_MODEL ?? 'gemini-3.1-flash-lite';
const GROQ_KEY = process.env.GROQ_API_KEY ?? '';
const GEMINI_KEY = process.env.GEMINI_API_KEY ?? '';

const REPLY_SCHEMA = {
  type: 'object',
  properties: {
    textEn: { type: 'string' },
    textTh: { type: 'string' },
    isLessonComplete: { type: 'boolean' },
    expectsUserSpeech: { type: 'boolean' },
    expectedSpeech: { type: 'string' },
  },
  required: ['textEn', 'textTh', 'isLessonComplete'],
};

function buildOpeningPrompt(lessonId: string): {
  systemInstruction: string;
  userPrompt: string;
} {
  const config = getLesson(lessonId);
  if (!config) throw new Error(`Lesson not found: ${lessonId}`);
  const lang = teachingLanguageFromConfig(config);
  const openingPrompt = renderOpeningPrompt(config, lang);
  const phrases = config.targetPhrases.map((p) => `- ${p}`).join('\n');
  const systemInstruction = `${buildLessonSystemInstruction(config, lang)}

Learner first name: เพื่อน
Target phrases:
${phrases}

Return JSON with textEn, textTh, isLessonComplete, expectsUserSpeech, expectedSpeech.`;

  const userPrompt = `${openingPrompt}

Respond with ONLY one JSON object. No markdown.`;

  return { systemInstruction, userPrompt };
}

async function callGroq(
  systemInstruction: string,
  userPrompt: string,
): Promise<{ ms: number; ok: boolean; preview: string }> {
  const started = performance.now();
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${GROQ_KEY}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        {
          role: 'system',
          content:
            systemInstruction +
            `\n\nSchema:\n${JSON.stringify(REPLY_SCHEMA)}`,
        },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.4,
      max_tokens: 512,
      response_format: { type: 'json_object' },
    }),
  });
  const ms = performance.now() - started;
  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    error?: { message?: string };
  };
  if (!res.ok) {
    return {
      ms,
      ok: false,
      preview: json.error?.message ?? JSON.stringify(json).slice(0, 200),
    };
  }
  const text = json.choices?.[0]?.message?.content ?? '';
  try {
    JSON.parse(text);
    return { ms, ok: true, preview: text.slice(0, 120) };
  } catch {
    return { ms, ok: false, preview: text.slice(0, 200) };
  }
}

async function callGemini(
  systemInstruction: string,
  userPrompt: string,
): Promise<{ ms: number; ok: boolean; preview: string }> {
  const started = performance.now();
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': GEMINI_KEY,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        generationConfig: {
          maxOutputTokens: 512,
          temperature: 0.4,
          responseMimeType: 'application/json',
          responseSchema: REPLY_SCHEMA,
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    },
  );
  const ms = performance.now() - started;
  const json = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    error?: { message?: string };
  };
  if (!res.ok) {
    return {
      ms,
      ok: false,
      preview: json.error?.message ?? JSON.stringify(json).slice(0, 200),
    };
  }
  const text =
    json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ??
    '';
  try {
    JSON.parse(text);
    return { ms, ok: true, preview: text.slice(0, 120) };
  } catch {
    return { ms, ok: false, preview: text.slice(0, 200) };
  }
}

function avg(nums: number[]): number {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
}

async function main(): Promise<void> {
  if (!GROQ_KEY) {
    console.error('GROQ_API_KEY required');
    process.exitCode = 1;
    return;
  }
  if (!GEMINI_KEY) {
    console.error('GEMINI_API_KEY required');
    process.exitCode = 1;
    return;
  }

  const { systemInstruction, userPrompt } = buildOpeningPrompt(LESSON_ID);
  const speechFlag = lessonUsesTapToContinue(LESSON_ID);
  console.log(`Lesson: ${LESSON_ID} (tapToContinue=${speechFlag})`);
  console.log(`Groq model: ${GROQ_MODEL}`);
  console.log(`Gemini model: ${GEMINI_MODEL}`);
  console.log(`Runs: ${RUNS}\n`);

  const groqMs: number[] = [];
  const geminiMs: number[] = [];

  for (let i = 0; i < RUNS; i++) {
    console.log(`── Run ${i + 1}/${RUNS} ──`);
    const groq = await callGroq(systemInstruction, userPrompt);
    console.log(
      `  Groq   ${groq.ok ? 'OK' : 'FAIL'} ${Math.round(groq.ms)}ms — ${groq.preview.replace(/\n/g, ' ')}`,
    );
    if (groq.ok) groqMs.push(groq.ms);

    const gem = await callGemini(systemInstruction, userPrompt);
    console.log(
      `  Gemini ${gem.ok ? 'OK' : 'FAIL'} ${Math.round(gem.ms)}ms — ${gem.preview.replace(/\n/g, ' ')}`,
    );
    if (gem.ok) geminiMs.push(gem.ms);
  }

  console.log('\n── Summary (opening prompt only) ──');
  console.log(
    `Groq   avg=${Math.round(avg(groqMs))}ms min=${groqMs.length ? Math.round(Math.min(...groqMs)) : '-'}ms (${groqMs.length}/${RUNS} ok)`,
  );
  console.log(
    `Gemini avg=${Math.round(avg(geminiMs))}ms min=${geminiMs.length ? Math.round(Math.min(...geminiMs)) : '-'}ms (${geminiMs.length}/${RUNS} ok)`,
  );
  if (groqMs.length && geminiMs.length) {
    const delta = Math.round(avg(groqMs) - avg(geminiMs));
    console.log(
      `Delta: Groq ${delta > 0 ? '+' : ''}${delta}ms vs Gemini (${delta < 0 ? 'Groq faster' : 'Gemini faster'})`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
