export const DEFAULT_LESSON_ID = 'ee_about_me_daily_routine';

export type Json = Record<string, unknown>;

export type TurnResult = {
  currentTurn: number;
  progressTurn?: number;
  progressMax?: number;
  expectsUserSpeech?: boolean;
  expectedSpeech?: string | null;
  guidedStem?: string | null;
  aiResponse?: string;
  isTaskComplete?: boolean;
};

export class DailyRoutineApiClient {
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
  ): Promise<{ status: number; json: Json }> {
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

    if (expectOk && !res.ok) {
      const detail =
        typeof json.message === 'string'
          ? json.message
          : typeof json.detail === 'string'
            ? json.detail
            : text.slice(0, 500);
      const debug =
        typeof json.debug === 'string' ? `\nDEBUG: ${json.debug}` : '';
      throw new Error(`${method} ${path} → ${res.status}: ${detail}${debug}`);
    }

    return { status: res.status, json };
  }

  parseTurn(payload: Json): TurnResult {
    const block = (payload.opening ?? payload) as Json;
    const gs = block.guidedSpeaking as Json | undefined;
    return {
      currentTurn: block.currentTurn as number,
      progressTurn: block.progressTurn as number | undefined,
      progressMax: block.progressMax as number | undefined,
      expectsUserSpeech: block.expectsUserSpeech as boolean | undefined,
      expectedSpeech: (block.expectedSpeech as string | null | undefined) ?? null,
      guidedStem: (gs?.stem as string | null | undefined) ?? null,
      aiResponse:
        (block.aiResponse as string | undefined) ??
        ((payload.opening as Json | undefined)?.aiResponse as string | undefined),
      isTaskComplete: block.isTaskComplete as boolean | undefined,
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

  async startLesson(lessonId = DEFAULT_LESSON_ID): Promise<{
    sessionId: string;
    turn: TurnResult;
  }> {
    const start = await this.request('POST', '/sessions', {
      sessionType: 'training',
      lessonId,
      teachingLanguage: 'thai',
    });
    const sessionId = (start.json.session as Json).id as string;
    return { sessionId, turn: this.parseTurn(start.json) };
  }

  async sendUserSpeech(
    sessionId: string,
    currentTurn: number,
    userSpeech: string,
    expectOk = true,
  ): Promise<{ status: number; turn: TurnResult; json: Json }> {
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
    };
  }
}
