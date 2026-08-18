const PHRASE_NEAR_MISS_ALIASES: Record<string, string> = {
  morining: 'morning',
  mornin: 'morning',
  mornign: 'morning',
  afternon: 'afternoon',
  afternoom: 'afternoon',
  evning: 'evening',
  eveing: 'evening',
  helo: 'hello',
  hlo: 'hello',
};

export type AnswerScore = {
  matched: boolean;
  matchedPhrase: string | null;
  normalized: string;
};

function normalizeSpeechText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function maxEditDistanceForWord(target: string): number {
  const len = target.length;
  if (len <= 3) return 1;
  if (len <= 5) return 2;
  return 3;
}

function editDistanceAtMost(a: string, b: string, maxDist: number): boolean {
  if (a === b) return true;
  if (maxDist <= 0) return false;
  if (Math.abs(a.length - b.length) > maxDist) return false;

  const prev = new Array<number>(b.length + 1);
  const curr = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    let rowMin = curr[0];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    if (rowMin > maxDist) return false;
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }

  return prev[b.length] <= maxDist;
}

function matchNormalizedAgainstPhrases(
  normalized: string,
  phrases: string[],
): string | null {
  const sorted = [...phrases].sort((a, b) => b.length - a.length);
  for (const phrase of sorted) {
    const target = normalizeSpeechText(phrase);
    if (!target) continue;
    if (normalized === target) return phrase;
    const escaped = target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(?:^|\\s)${escaped}(?:\\s|$)`);
    if (re.test(normalized)) return phrase;
  }

  const tokens = normalized.split(/\s+/).filter(Boolean);
  if (tokens.length === 1) {
    const alias = PHRASE_NEAR_MISS_ALIASES[normalized];
    if (alias) {
      const canonical = sorted.find(
        (p) => normalizeSpeechText(p) === alias,
      );
      if (canonical) return canonical;
    }

    for (const phrase of sorted) {
      const target = normalizeSpeechText(phrase);
      if (!target || target.includes(' ')) continue;
      const maxDist = maxEditDistanceForWord(target);
      if (editDistanceAtMost(normalized, target, maxDist)) {
        return phrase;
      }
    }
  }

  return null;
}

/** Match learner transcript against target phrase list (STT-tolerant). */
export function scoreAnswer(
  userMessage: string,
  phrases: string[],
  displayTranscript?: string,
): AnswerScore {
  const normalized = normalizeSpeechText(userMessage);
  const matched =
    matchNormalizedAgainstPhrases(normalized, phrases) ??
    (displayTranscript && displayTranscript !== userMessage
      ? matchNormalizedAgainstPhrases(
          normalizeSpeechText(displayTranscript),
          phrases,
        )
      : null);

  return {
    matched: matched != null,
    matchedPhrase: matched,
    normalized,
  };
}

/** Accept "Morning!" style variants for multi-word greetings. */
export function scoreGreetingVariant(
  userMessage: string,
  expected: string,
  displayTranscript?: string,
): AnswerScore {
  const base = scoreAnswer(userMessage, [expected], displayTranscript);
  if (base.matched) return base;

  const normalized = base.normalized;
  const target = normalizeSpeechText(expected);
  if (!target.includes(' ')) return base;

  const lastWord = target.split(/\s+/).pop() ?? '';
  if (!lastWord) return base;

  const variantScore = scoreAnswer(userMessage, [lastWord], displayTranscript);
  if (variantScore.matched) {
    return { ...variantScore, matchedPhrase: expected };
  }

  if (normalized === lastWord || normalized === `${lastWord}s`) {
    return { matched: true, matchedPhrase: expected, normalized };
  }

  return base;
}
