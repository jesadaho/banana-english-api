/**
 * Resolve Groq API keys from env.
 *
 * Prefer `GROQ_API_KEYS` (comma/semicolon/newline separated) for load-balancing
 * across orgs. Fall back to single `GROQ_API_KEY` for backward compatibility.
 */
export function parseGroqApiKeys(env: {
  GROQ_API_KEY?: string;
  GROQ_API_KEYS?: string;
}): string[] {
  const fromList = String(env.GROQ_API_KEYS ?? '')
    .split(/[,;\n]/)
    .map((k) => k.trim())
    .filter(Boolean);
  if (fromList.length > 0) {
    return [...new Set(fromList)];
  }
  const single = String(env.GROQ_API_KEY ?? '').trim();
  return single ? [single] : [];
}

export function resolveGroqApiKeys(getEnv: (key: string) => string | undefined): string[] {
  return parseGroqApiKeys({
    GROQ_API_KEY: getEnv('GROQ_API_KEY'),
    GROQ_API_KEYS: getEnv('GROQ_API_KEYS'),
  });
}

export type GroqClientKey = {
  key: string;
  keyId: string;
};

/** Whisper RPM window — keep a hot key out of client issuance. */
export const GROQ_KEY_COOLDOWN_MS = 60_000;

export function groqKeyId(index: number): string {
  return `k${index + 1}`;
}

export function groqKeyIdForSecret(keys: string[], secret: string): string | undefined {
  const index = keys.indexOf(secret);
  return index >= 0 ? groqKeyId(index) : undefined;
}

/** Round-robin cursor so each app config fetch gets one key from the pool. */
let clientKeyCursor = 0;
const hotUntilMs = new Map<string, number>();

export function resetGroqClientKeyState(): void {
  clientKeyCursor = 0;
  hotUntilMs.clear();
}

export function markGroqKeyHot(
  keyId: string,
  now = Date.now(),
  cooldownMs = GROQ_KEY_COOLDOWN_MS,
): void {
  const id = keyId.trim();
  if (!id) return;
  hotUntilMs.set(id, now + cooldownMs);
}

export function isGroqKeyHot(keyId: string, now = Date.now()): boolean {
  const until = hotUntilMs.get(keyId);
  if (until == null) return false;
  if (until <= now) {
    hotUntilMs.delete(keyId);
    return false;
  }
  return true;
}

/** Pick one cool key for a Flutter client (do not expose the full pool). */
export function pickGroqApiKeyForClient(
  keys: string[],
  now = Date.now(),
): GroqClientKey | undefined {
  if (keys.length === 0) return undefined;
  for (let step = 0; step < keys.length; step++) {
    const index = (clientKeyCursor + step) % keys.length;
    const keyId = groqKeyId(index);
    if (isGroqKeyHot(keyId, now)) continue;
    clientKeyCursor = (index + 1) % keys.length;
    return { key: keys[index]!, keyId };
  }
  return undefined;
}
