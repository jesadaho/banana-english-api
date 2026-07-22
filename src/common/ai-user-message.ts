/** Maps Gemini / upstream AI failures to short user-facing copy. */
export function formatAiServiceUserMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const lower = raw.toLowerCase();

  if (
    lower.includes('high demand') ||
    lower.includes('unavailable') ||
    lower.includes('"code": 503') ||
    /\b503\b/.test(lower) ||
    lower.includes('timeout after') ||
    lower.includes('504') ||
    lower.includes('429') ||
    lower.includes('resource_exhausted') ||
    lower.includes('invalid json after retries')
  ) {
    return (
      'กำลังใช้งานหนาแน่น — We are experiencing high demand. ' +
      'ลองใหม่อีกครั้งในสักครู่นะ'
    );
  }

  return 'ครูพี่บีตอบไม่สำเร็จ ลองใหม่อีกครั้งนะ';
}
