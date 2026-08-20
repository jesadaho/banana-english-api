import {
  pickUserSpeechForTurn,
  toLessonTurnView,
  type LessonTurnView,
} from '../../src/lessons/lesson-turn-driver';

export const DEFAULT_LESSON_ID = 'ee_about_me_daily_routine';

export type Json = Record<string, unknown>;

export type TurnResult = LessonTurnView & {
  currentTurn: number;
  progressTurn?: number;
  progressMax?: number;
  guidedStem?: string | null;
  aiResponse?: string;
};

export type Timed<T> = T & { durationMs: number };

export class LessonApiClient {
  constructor(
    private readonly apiBase: string,
    private readonly anonUser: string,
    private readonly chatDebug = true,
  ) {}

  private headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'X-Anonymous-User-Id': this.anonUser,
      ...(this.chatDebug ? { 'X-Chat-Debug': '1' } : {}),
    };
  }

  async request(
    method: string,
    path: string,
    body?: unknown,
    expectOk = true,
  ): Promise<{ status: number; json: Json; durationMs: number }> {
    const maxAttempts = 3;
    let lastError: Error | undefined;
    let totalMs = 0;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const started = performance.now();
      const res = await fetch(`${this.apiBase}${path}`, {
        method,
        headers: this.headers(),
        body: body == null ? undefined : JSON.stringify(body),
      });

      const text = await res.text();
      let json: Json = {};
      if (text) {
        try {
          json = JSON.parse(text) as Json;
        } catch {
          json = { raw: text };
        }
      }

      totalMs += performance.now() - started;

      if (res.ok || !expectOk) {
        return { status: res.status, json, durationMs: totalMs };
      }

      const detail =
        typeof json.message === 'string'
          ? json.message
          : typeof json.detail === 'string'
            ? json.detail
            : text.slice(0, 500);
      const debug =
        typeof json.debug === 'string' ? `\nDEBUG: ${json.debug}` : '';
      lastError = new Error(
        `${method} ${path} → ${res.status}: ${detail}${debug}`,
      );

      const retryable =
        res.status === 502 || res.status === 503 || res.status === 504;
      if (!retryable || attempt === maxAttempts) break;

      const waitMs = 1000 * attempt;
      console.warn(
        `⚠️  ${method} ${path} → ${res.status} (attempt ${attempt}/${maxAttempts}), retry in ${waitMs}ms…`,
      );
      await new Promise((r) => setTimeout(r, waitMs));
    }

    throw lastError ?? new Error(`${method} ${path} failed`);
  }

  parseTurn(payload: Json): TurnResult {
    const block = (payload.opening ?? payload) as Json;
    const view = toLessonTurnView(block as Record<string, unknown>);
    const gs = block.guidedSpeaking as Json | undefined;
    return {
      ...view,
      currentTurn: block.currentTurn as number,
      progressTurn: block.progressTurn as number | undefined,
      progressMax: block.progressMax as number | undefined,
      guidedStem: (gs?.stem as string | null | undefined) ?? null,
      aiResponse:
        (block.aiResponse as string | undefined) ??
        ((payload.opening as Json | undefined)?.aiResponse as string | undefined),
      isTaskComplete:
        view.isTaskComplete ??
        (block.isTaskComplete as boolean | undefined) ??
        false,
    };
  }

  logTurn(label: string, turn: TurnResult): void {
    console.log(`\n── ${label} ──`);
    console.log(`  currentTurn: ${turn.currentTurn}`);
    console.log(
      `  progress:    ${turn.progressTurn ?? '?'}/${turn.progressMax ?? '?'}`,
    );
    console.log(`  expectsSpeech: ${turn.expectsUserSpeech}`);
    console.log(`  expected:      ${turn.expectedSpeech ?? '(none)'}`);
    console.log(`  guided stem:   ${turn.guidedStem ?? '(none)'}`);
    if (turn.aiResponse) {
      console.log(`  ai:            ${turn.aiResponse.slice(0, 140)}…`);
    }
    console.log(`  complete:      ${turn.isTaskComplete ?? false}`);
  }

  async refillBananas(): Promise<void> {
    await this.request('POST', '/users/me/debug/refill-bananas');
  }

  async startLesson(lessonId = DEFAULT_LESSON_ID): Promise<
    Timed<{
      sessionId: string;
      maxTurns: number;
      turn: TurnResult;
      json: Json;
    }>
  > {
    const start = await this.request('POST', '/sessions', {
      sessionType: 'training',
      lessonId,
      teachingLanguage: 'thai',
    });
    const sessionId = (start.json.session as Json).id as string;
    const maxTurns = ((start.json.session as Json).maxTurns as number) ?? 30;
    return {
      durationMs: start.durationMs,
      sessionId,
      maxTurns,
      turn: this.parseTurn(start.json),
      json: start.json,
    };
  }

  async sendUserSpeech(
    sessionId: string,
    currentTurn: number,
    userSpeech: string,
    expectOk = true,
  ): Promise<{ status: number; turn: TurnResult; json: Json; durationMs: number }> {
    const res = await this.request(
      'POST',
      `/sessions/${sessionId}/turn`,
      {
        userSpeechText: userSpeech,
        currentTurn,
        generateAudio: false,
      },
      expectOk,
    );
    return {
      status: res.status,
      turn: this.parseTurn(res.json),
      json: res.json,
      durationMs: res.durationMs,
    };
  }

  suggestedUserSpeech(turn: TurnResult): string | null {
    return pickUserSpeechForTurn(turn);
  }
}
