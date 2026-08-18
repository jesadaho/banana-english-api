import type { AiDebug } from './api.types';

export function scriptedAiDebug(partial?: Partial<AiDebug>): AiDebug {
  return {
    source: 'scripted',
    geminiMs: 0,
    geminiAttempts: 0,
    ...partial,
  };
}

export function attachAiDebug<T>(
  response: T,
  chatDebug: boolean,
  aiDebug: AiDebug | undefined,
  handlerStartedAt: number,
): T & { aiDebug?: AiDebug } {
  if (!chatDebug) return response as T & { aiDebug?: AiDebug };
  return {
    ...response,
    aiDebug: {
      ...(aiDebug ?? scriptedAiDebug()),
      handlerMs: Math.round(performance.now() - handlerStartedAt),
    },
  };
}
