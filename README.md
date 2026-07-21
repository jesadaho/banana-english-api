# Banana English API

NestJS backend for Banana English — AI English conversation practice for Thai learners.

**Phase 1:** Text-only API. STT runs on the Flutter client (Groq Whisper). TTS uses Gemini (`gemini-2.5-flash-preview-tts`, voice Puck) via `/api/tts/synthesize`.

## Stack

- NestJS 10 + TypeScript
- Google Gemini 3.5 Flash (chat, hints, report, Thai-mix correction)
- Google Gemini TTS (`gemini-2.5-flash-preview-tts`, voice Puck)
- In-memory session store (MVP)

## Setup

```bash
cp .env.example .env
# Edit .env with your API keys

npm install
npm run start:dev
```

Server runs at `http://localhost:8000`.

## Environment

| Variable | Description |
|----------|-------------|
| `GEMINI_API_KEY` | Google Gemini API key (chat + TTS) |
| `GEMINI_CHAT_MODEL` | Chat models, comma-separated priority (default `gemini-3.5-flash`) |
| `GEMINI_CHAT_MODEL_COOLDOWN_HOURS` | Skip a model for N hours after 503/high demand (default `2`) |
| `GEMINI_CHAT_FALLBACK_MODEL` | Deprecated — add models to `GEMINI_CHAT_MODEL` instead |
| `GEMINI_TTS_MODEL` | Primary TTS model — single id (default `gemini-3.1-flash-tts-preview`) |
| `GEMINI_TTS_FALLBACK_MODELS` | Fallback TTS models, comma-separated (newer clients + server pool) |
| `GEMINI_TTS_MODEL_COOLDOWN_HOURS` | Skip a TTS model for N hours after 503/high demand (default `2`) |
| `GEMINI_TTS_VOICE` | TTS voice (default `Sadachbia`) |
| `GROQ_API_KEY` | Groq key (served to Flutter via `/api/config/keys`) |
| `PORT` | Server port (default `8000`) |
| `CORS_ORIGINS` | Comma-separated allowed origins |
| `SESSION_DURATION_SECONDS` | Max session length (default `300`) |
| `ONBOARDING_BANANA_BONUS` | Bananas granted on onboarding complete (default `2`) |
| `DAILY_BANANA_DROP` | Bananas granted by daily drop after 08:00 local (default `1`) |

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/api/config/keys` | Client runtime keys (`groqApiKey`) |
| GET | `/topics/daily` | Daily topic list |
| POST | `/sessions` | Start session `{ topicId }` |
| POST | `/sessions/:id/turn` | Send text `{ transcript, thaiMixEnabled }` |
| POST | `/sessions/:id/hints` | Get reply hints |
| POST | `/sessions/:id/end` | End session |
| GET | `/sessions/:id/report` | Daily report |
| POST | `/api/tts/synthesize` | Synthesize speech clips (Gemini TTS) |

## Deploy on Railway

1. Push this repo to GitHub (if not already).
2. Go to [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo** → select `banana-english-api`.
3. Railway auto-detects Node.js. `railway.toml` sets build (`npm run build`) and start (`npm run start:prod`).
4. In **Variables**, add:

   | Variable | Example |
   |----------|---------|
   | `GEMINI_API_KEY` | `AIza...` |
   | `GEMINI_CHAT_MODEL` | `gemini-3.5-flash,gemini-2.5-flash` (optional) |
   | `GEMINI_CHAT_MODEL_COOLDOWN_HOURS` | `2` (optional) |
   | `GEMINI_TTS_MODEL` | `gemini-3.1-flash-tts-preview` |
   | `GEMINI_TTS_FALLBACK_MODELS` | `gemini-2.5-flash-lite-preview-tts,gemini-2.5-pro-preview-tts` (optional) |
   | `GEMINI_TTS_MODEL_COOLDOWN_HOURS` | `2` (optional) |
   | `GROQ_API_KEY` | `gsk_...` |
   | `CORS_ORIGINS` | `http://localhost:8080,https://your-app.web.app` |
   | `SESSION_DURATION_SECONDS` | `300` |
   | `ONBOARDING_BANANA_BONUS` | `2` (optional) |
   | `DAILY_BANANA_DROP` | `1` (optional) |

   `PORT` is injected by Railway automatically — do not set it manually.

5. Open **Settings → Networking → Generate Domain** to get a public URL (e.g. `https://banana-english-api-production.up.railway.app`).
6. Verify: `curl https://<your-domain>/health` → `{"status":"ok"}`.

### Flutter (point to Railway)

```bash
flutter run -d chrome \
  --dart-define=API_BASE_URL=https://<your-railway-domain>
```

Add your Flutter web origin to `CORS_ORIGINS` on Railway.

## Flutter client (local)

```bash
flutter run -d chrome --dart-define=API_BASE_URL=http://localhost:8000
```

## Notes

- No audio upload or server-side TTS in phase 1 — AI turns return `audioUrl: null`; Flutter uses local TTS.
- In-memory sessions reset on server restart. Use Redis/DB for production persistence.
