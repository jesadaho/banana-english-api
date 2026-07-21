/** Parses a comma/semicolon-separated Gemini model priority list. */
export function parseGeminiModels(
  primary: string | undefined,
  defaultModel: string,
  legacyFallback?: string,
): string[] {
  const raw = (primary ?? defaultModel)
    .split(/[,;]/)
    .map((model) => model.trim())
    .filter(Boolean);

  const seen = new Set<string>();
  const models: string[] = [];

  for (const model of raw) {
    if (seen.has(model)) continue;
    seen.add(model);
    models.push(model);
  }

  const fallback = legacyFallback?.trim();
  if (fallback && !seen.has(fallback)) {
    models.push(fallback);
  }

  return models.length > 0 ? models : [defaultModel];
}

/** @deprecated Prefer parseGeminiModels — kept for chat call sites. */
export function parseGeminiChatModels(
  primary: string | undefined,
  legacyFallback?: string,
): string[] {
  return parseGeminiModels(primary, 'gemini-3.5-flash', legacyFallback);
}

/**
 * Rotates through models. Marks a model unavailable for a cooldown window
 * after high-demand / transient API errors so traffic shifts to the next model.
 */
export class GeminiModelPool {
  private readonly cooldownUntil = new Map<string, number>();

  constructor(
    private readonly models: readonly string[],
    private readonly cooldownMs: number,
  ) {}

  /** Models to try now — skips models still in cooldown when possible. */
  activeModels(): string[] {
    const now = Date.now();
    const available = this.models.filter((model) => {
      const until = this.cooldownUntil.get(model);
      return until == null || until <= now;
    });
    return available.length > 0 ? [...available] : [...this.models];
  }

  /** Temporarily deprioritize a model after a retryable failure. */
  markUnavailable(model: string, now = Date.now()): number | null {
    if (this.cooldownMs <= 0) return null;
    const until = now + this.cooldownMs;
    this.cooldownUntil.set(model, until);
    return until;
  }

  cooldownHours(): number {
    return this.cooldownMs / (60 * 60 * 1000);
  }
}
