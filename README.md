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

## Flutter client

```bash
flutter run -d chrome --dart-define=API_BASE_URL=http://localhost:8000
```

## Notes

- No audio upload or server-side TTS in phase 1 — AI turns return `audioUrl: null`; Flutter uses local TTS.
- In-memory sessions reset on server restart. Use Redis/DB for production persistence.
