/** Public Bunny pull zone, for example https://banana-english.b-cdn.net */
function cutsceneBaseUrl(): string {
  return (process.env.BUNNY_CUTSCENE_BASE_URL ?? '').trim().replace(/\/$/, '');
}

/**
 * simulationId -> object path on the Bunny pull zone, or an absolute https URL.
 * Add a row only after that conversation's mp4 is uploaded.
 * Relative paths are served as `{BUNNY_CUTSCENE_BASE_URL}/{path}`.
 */
export const CONVERSATION_CUTSCENES: Record<string, string> = {
  foundation_first_conversation:
    'https://banana-english-cutscenes.b-cdn.net/conversation-cutscenes/v7_u01n05.mp4?v=6',
  a2_c01n09:
    'https://banana-english-cutscenes.b-cdn.net/conversation-cutscenes/a2_c01n09.mp4?v=2',
};

export function conversationCutsceneUrl(
  simulationId: string,
  clips: Record<string, string> = CONVERSATION_CUTSCENES,
  base = cutsceneBaseUrl(),
): string | undefined {
  const raw = clips[simulationId]?.trim();
  if (!raw) return undefined;
  if (/^https:\/\//i.test(raw)) return raw;
  const origin = base.trim().replace(/\/$/, '');
  if (!origin) return undefined;
  return `${origin}/${raw.replace(/^\//, '')}`;
}
