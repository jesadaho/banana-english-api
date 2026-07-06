# Banana English API

NestJS backend for Banana English — AI English conversation practice for Thai learners.

**Phase 1:** Text-only API. STT runs on the Flutter client (Groq Whisper). TTS runs on the client when `audioUrl` is null.

## Stack

- NestJS 10 + TypeScript
- OpenAI GPT-4o (chat, hints, report, Thai-mix correction)
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
| `OPENAI_API_KEY` | OpenAI API key |
| `GROQ_API_KEY` | Groq key (served to Flutter via `/api/config/keys`) |
| `PORT` | Server port (default `8000`) |
| `CORS_ORIGINS` | Comma-separated allowed origins |
| `SESSION_DURATION_SECONDS` | Max session length (default `300`) |

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

## Deploy on Railway

1. Push this repo to GitHub (if not already).
2. Go to [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo** → select `banana-english-api`.
3. Railway auto-detects Node.js. `railway.toml` sets build (`npm run build`) and start (`npm run start:prod`).
4. In **Variables**, add:

   | Variable | Example |
   |----------|---------|
   | `OPENAI_API_KEY` | `sk-...` |
   | `GROQ_API_KEY` | `gsk_...` |
   | `CORS_ORIGINS` | `http://localhost:8080,https://your-app.web.app` |
   | `SESSION_DURATION_SECONDS` | `300` |

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
