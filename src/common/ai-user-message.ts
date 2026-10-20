import { BadGatewayException } from '@nestjs/common';

/** App sends this when Settings → Chat debug logs is on. */
export const CHAT_DEBUG_HEADER = 'x-chat-debug';

export function isChatDebugRequest(req: {
  headers?: Record<string, string | string[] | undefined>;
}): boolean {
  const raw =
    req.headers?.[CHAT_DEBUG_HEADER] ?? req.headers?.['X-Chat-Debug'];
  if (raw == null) return false;
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value === '1' || value.toLowerCase() === 'true';
}

export function isGeminiBillingError(err: unknown): boolean {
  const raw = err instanceof Error ? err.message : String(err);
  return (
    /\bGemini API failed \(402\)/.test(raw) ||
    /"code":\s*402/.test(raw) ||
    raw.includes('prepaid credits are depleted') ||
    raw.includes('RESOURCE_EXHAUSTED')
  );
}

/** Maps Gemini / upstream AI failures to short user-facing copy. */
export function formatAiServiceUserMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const lower = raw.toLowerCase();

  if (
    lower.includes('recitation') ||
    lower.includes('finishreason=safety') ||
    lower.includes('response blocked')
  ) {
    return 'ครูพี่บีข้ามประโยคนี้ไปก่อนนะ ลองพูดอีกครั้ง';
  }

  if (
    lower.includes('max_tokens') ||
    lower.includes('truncated')
  ) {
    return 'ครูพี่บีตอบยาวเกินไป ลองกดไมค์พูดอีกครั้งนะ';
  }

  if (
    lower.includes('high demand') ||
    lower.includes('unavailable') ||
    lower.includes('"code": 503') ||
    /\b503\b/.test(lower) ||
    lower.includes('timeout after') ||
    lower.includes('504') ||
    lower.includes('429') ||
    lower.includes('resource_exhausted') ||
    lower.includes('prepaid credits') ||
    /\b402\b/.test(lower) ||
    lower.includes('invalid json after retries') ||
    isGeminiBillingError(err)
  ) {
    return (
      'กำลังใช้งานหนาแน่น — We are experiencing high demand. ' +
      'ลองใหม่อีกครั้งในสักครู่นะ'
    );
  }

  return 'ครูพี่บีตอบไม่สำเร็จ ลองใหม่อีกครั้งนะ';
}

function aiErrorDebugText(err: unknown): string {
  if (err instanceof Error) {
    return (err.stack ?? err.message).slice(0, 4000);
  }
  return String(err).slice(0, 4000);
}

export function aiServiceBadGatewayBody(
  err: unknown,
  chatDebug: boolean,
): string | { message: string; debug: string } {
  const message = formatAiServiceUserMessage(err);
  if (!chatDebug) return message;
  return { message, debug: aiErrorDebugText(err) };
}

export function throwAiServiceBadGateway(
  err: unknown,
  chatDebug = false,
): never {
  throw new BadGatewayException(aiServiceBadGatewayBody(err, chatDebug));
}
