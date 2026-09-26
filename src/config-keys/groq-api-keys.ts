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
