/**
 * Speaking-game hints, decided here and sent with every dealt item so the
 * app only follows them (no app release to change hint behaviour).
 *
 * Code defaults below; override without a code change with env
 * `HINT_POLICY` (JSON, read per request), e.g.
 *   {"describe_it":{"a1":{"frame":{"later":"none"}},"pools":{"fnd_v7_u12n06_day_in_pictures":{"wordBank":"always"}}},
 *    "say_it":{"a1":{"letterHints":1}}}
 * Order: pools[id] over a1 (Foundation ids `fnd_…`) over default over code.
 */

export type FrameMode = 'full' | 'first_word' | 'none';
export type WordBankMode = 'never' | 'retry' | 'always';

export type HintPolicy = {
  /** Describe It sentence frame (`hintEn`): first item, later items, a missed item's 2nd try. */
  frame: { first: FrameMode; later: FrameMode; retry: FrameMode };
  /** Tap Mode word bank while speaking. `retry` = only when a missed item comes back. */
  wordBank: WordBankMode;
  /** Say It letter-hint uses per round (0 hides the button). */
  letterHints: number;
  /** Say It "show answer" button. */
  reveal: boolean;
};

/** Sent on each dealt item as `hint`. */
export type ItemHint = {
  /** Frame on the first try (null = none). */
  frame: string | null;
  /** Frame when a missed item comes back (null = none). */
  retryFrame: string | null;
  wordBank: WordBankMode;
  letterHints: number;
  reveal: boolean;
};

export type HintGame = 'describe_it' | 'say_it';

type PolicyPatch = Partial<Omit<HintPolicy, 'frame'>> & { frame?: Partial<HintPolicy['frame']> };
type GameOverrides = { default?: PolicyPatch; a1?: PolicyPatch; pools?: Record<string, PolicyPatch> };

const BASE: HintPolicy = {
  frame: { first: 'full', later: 'full', retry: 'full' },
  wordBank: 'never',
  letterHints: 3,
  reveal: true,
};

/** A1: frame fades out after the first item; word bank only on a 2nd try. */
const CODE_DEFAULTS: Record<HintGame, GameOverrides> = {
  describe_it: {
    a1: { frame: { first: 'full', later: 'first_word', retry: 'full' }, wordBank: 'retry' },
  },
  say_it: {
    a1: { wordBank: 'retry' },
  },
};

const FRAME_MODES: FrameMode[] = ['full', 'first_word', 'none'];
const BANK_MODES: WordBankMode[] = ['never', 'retry', 'always'];

function cleanPatch(raw: unknown): PolicyPatch {
  if (!raw || typeof raw !== 'object') return {};
  const r = raw as Record<string, unknown>;
  const out: PolicyPatch = {};
  if (r.frame && typeof r.frame === 'object') {
    const f = r.frame as Record<string, unknown>;
    const frame: Partial<HintPolicy['frame']> = {};
    for (const k of ['first', 'later', 'retry'] as const) {
      if (FRAME_MODES.includes(f[k] as FrameMode)) frame[k] = f[k] as FrameMode;
    }
    out.frame = frame;
  }
  if (BANK_MODES.includes(r.wordBank as WordBankMode)) out.wordBank = r.wordBank as WordBankMode;
  if (typeof r.letterHints === 'number' && Number.isInteger(r.letterHints)) {
    out.letterHints = Math.max(0, Math.min(10, r.letterHints));
  }
  if (typeof r.reveal === 'boolean') out.reveal = r.reveal;
  return out;
}

function apply(base: HintPolicy, patch: PolicyPatch | undefined): HintPolicy {
  if (!patch) return base;
  const p = cleanPatch(patch);
  return {
    frame: { ...base.frame, ...(p.frame ?? {}) },
    wordBank: p.wordBank ?? base.wordBank,
    letterHints: p.letterHints ?? base.letterHints,
    reveal: p.reveal ?? base.reveal,
  };
}

/** Parsed `HINT_POLICY` env; bad JSON = no overrides. */
export function parseHintPolicyEnv(raw: string | undefined): Partial<Record<HintGame, GameOverrides>> {
  if (!raw?.trim()) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as Partial<Record<HintGame, GameOverrides>>) : {};
  } catch {
    return {};
  }
}

export function isA1Content(id: string): boolean {
  return id.startsWith('fnd_');
}

export function hintPolicyFor(
  game: HintGame,
  contentId: string,
  env: Partial<Record<HintGame, GameOverrides>> = parseHintPolicyEnv(process.env.HINT_POLICY),
): HintPolicy {
  const code = CODE_DEFAULTS[game] ?? {};
  const over = env[game] ?? {};
  const a1 = isA1Content(contentId);
  let p = BASE;
  p = apply(p, code.default);
  p = apply(p, over.default);
  if (a1) {
    p = apply(p, code.a1);
    p = apply(p, over.a1);
  }
  p = apply(p, code.pools?.[contentId]);
  p = apply(p, over.pools?.[contentId]);
  return p;
}

/** `She is a _____` → `She ___` (short frames stay as they are). */
export function frameText(hint: string | null | undefined, mode: FrameMode): string | null {
  const h = (hint ?? '').trim();
  if (!h || mode === 'none') return null;
  if (mode === 'full') return h;
  const words = h.split(/\s+/);
  if (words.length <= 2 || words[0]!.includes('_')) return h;
  return `${words[0]} ___`;
}

/** Hint for the item at `index` in the deal (0 = first shown). */
export function itemHint(policy: HintPolicy, hintEn: string | null | undefined, index: number): ItemHint {
  return {
    frame: frameText(hintEn, index === 0 ? policy.frame.first : policy.frame.later),
    retryFrame: frameText(hintEn, policy.frame.retry),
    wordBank: policy.wordBank,
    letterHints: policy.letterHints,
    reveal: policy.reveal,
  };
}
