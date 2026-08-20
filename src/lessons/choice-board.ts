import type { LessonTeachingLanguage } from './lesson-teaching';

/** Normalized Guided Speaking card shape (matches normalizeGuidedSpeaking output). */
export type GuidedSpeakingCard = {
  stem: string;
  emoji: string;
  label?: string;
  speak: string;
  options?: Array<{ emoji: string; label?: string; speak: string }>;
};



const LEADING_PRAISE_OPENER_RE =
  /^(?:โอ้\s+)?(?:ทำได้ดีมาก|ยอดเยี่ยม|เยี่ยมเลย|เยี่ยมมาก|สุดยอดมาก|สุดยอด|เก่งมาก|เก่งจริง|เป๊ะเลย|ใช่เลย|ถูกต้อง|แจ๋วเลย|แม่นยำมาก|ดีมาก|ดีเลย|เยี่ยม|เป๊ะ|แจ๋ว|awesome|perfect|great job|great work|nice work|well done|amazing|fantastic|excellent|great|nice|good)(?:เลย|มาก)?(?:ครับ|ค่ะ)?(?:\s*[!！?？.…]*)?(?:\s*[👏🎉👍🔥🍌✨]*)?\s*/iu;

/** Strip a leading praise opener so board/tip copy stays teaching-only. */
export function stripLeadingPraiseOpener(text: string): string {
  const raw = (text ?? '').trim();
  if (!raw) return '';
  const stripped = raw.replace(LEADING_PRAISE_OPENER_RE, '').trimStart();
  if (!stripped || stripped === raw) return raw;
  // Re-capitalize first Latin letter after strip; leave Thai as-is.
  if (/^[a-z]/.test(stripped)) {
    return stripped.charAt(0).toUpperCase() + stripped.slice(1);
  }
  return stripped;
}

/** Capture the model's leading praise clause (if any). */
export function extractLeadingPraiseOpener(text: string): string | null {
  const raw = (text ?? '').trim();
  if (!raw) return null;
  const m = raw.match(LEADING_PRAISE_OPENER_RE);
  if (!m || !m[0]?.trim()) return null;
  return m[0].trim();
}

/**
 * Pin forced board cue text.
 * - Always strips praise written in the script/board copy.
 * - When [withPraise] is true, keeps the model's Success/Soft opener (system gen).
 * - When false (openings / no prior success), drops praise from model too.
 */
export function resolveBoardTextEn(
  modelText: string,
  boardText: string,
  opts: { withPraise: boolean },
): string {
  const body = stripLeadingPraiseOpener(boardText).trim();
  if (!body) {
    return opts.withPraise
      ? (modelText ?? '').trim() || boardText.trim()
      : stripLeadingPraiseOpener(modelText ?? '') || boardText.trim();
  }
  if (!opts.withPraise) return body;
  const praise = extractLeadingPraiseOpener(modelText ?? '');
  if (!praise) return body;
  const joiner = body.includes('\n') ? '\n\n' : ' ';
  return `${praise}${joiner}${body}`;
}

/** @deprecated Use resolveBoardTextEn(..., { withPraise: true }) */
export function pinBoardTextEn(modelText: string, boardText: string): string {
  return resolveBoardTextEn(modelText, boardText, { withPraise: true });
}

/** Forced guided board: script may include praise; [withPraise] keeps system Success opener. */
export type ForcedGuidedBoard = {
  textEn: string;
  /** Optional speech-only copy; does not change the text shown in the UI. */
  ttsText?: string;
  /** Keep model Success praise after strip (default: step > 1). Opening = false. */
  withPraise?: boolean;
  stem: string;
  expectedSpeech: string;
  /** Vocab = Thai concept only (e.g. "ตื่นนอน"); phrase = lead ending in เราจะพูดว่า. */
  softTeachHintTh?: string;
  /** English cue for PoolGate soft-advance when textEn has no trailing question. */
  advanceQuestionEn?: string;
  /** Thai guide for incorrect-tier feedback (PoolGate assess). */
  incorrectHintTh?: string;
  options: Array<{ emoji: string; label: string; speak: string }>;
};

export function resolveForcedBoardTextEn(
  modelText: string,
  board: Pick<ForcedGuidedBoard, 'textEn' | 'withPraise'>,
  step: number,
): string {
  return resolveBoardTextEn(modelText, board.textEn, {
    withPraise: board.withPraise ?? step > 1,
  });
}

function isVocabSoftTeachHint(hint: string): boolean {
  return (
    !hint.includes('ถ้า') &&
    !hint.includes('เราจะพูดว่า') &&
    hint.split(/\s+/).filter(Boolean).length <= 3
  );
}

/** Natural scripted copy when scorer rejects and we reveal the canonical line once. */
export function buildSoftTeachRevealLine(
  expectedSpeech: string,
  lang: LessonTeachingLanguage,
  hintTh?: string | null,
): string {
  const target = expectedSpeech.trim();
  if (!target) {
    return lang === 'english'
      ? 'Good try — say it with me once.'
      : 'ลองพูดตามนะครับ';
  }

  if (lang === 'english') {
    const wordCount = target.split(/\s+/).filter(Boolean).length;
    if (wordCount <= 2) {
      return `Usually we say "${target}". Try saying it with me once.`;
    }
    return `Try saying it like this: "${target}" — your turn.`;
  }

  const hint = hintTh?.trim();
  if (hint) {
    if (isVocabSoftTeachHint(hint)) {
      return `ปกติแล้ว '${hint}' ในภาษาอังกฤษจะใช้คำว่า ${target} ครับ ลองพูดตามนะครับ`;
    }
    return `ปกติแล้ว${hint} ${target} ครับ ลองพูดตามนะครับ`;
  }

  const wordCount = target.split(/\s+/).filter(Boolean).length;
  if (wordCount <= 2) {
    return `ปกติแล้วในภาษาอังกฤษจะใช้คำว่า ${target} ครับ ลองพูดตามนะครับ`;
  }
  return `ลองพูดแบบนี้นะครับ: ${target} ครับ`;
}

/** AI or forced copy that reveals the canonical line and asks for one repeat. */
export function looksLikeSoftTeachReveal(textEn: string): boolean {
  const t = textEn.trim();
  if (!t) return false;
  const lower = t.toLowerCase();
  if (t.includes('พูดตาม') || t.includes('เฉลย')) return true;
  if (t.includes('ปกติแล้ว') && t.includes('ใช้คำว่า')) return true;
  if (t.includes('ปกติแล้ว') && t.includes('เราจะพูดว่า')) return true;
  if (t.includes('ลองพูดว่า') || t.includes('ลองพูดตาม')) return true;
  if (lower.startsWith('not quite.') || lower.startsWith('almost!')) return true;
  if (
    (t.includes('ไม่เป็นไร') || lower.includes('no worries')) &&
    (t.includes('พูด') || lower.includes('say') || lower.includes('try'))
  ) {
    return true;
  }
  return (
    lower.includes('try saying') ||
    lower.includes('you can say') ||
    lower.includes('say it once') ||
    lower.includes('say it with me') ||
    lower.includes('the answer is')
  );
}

/** exact = in pool; near = STT/alt OK; close = missing function words; wrong = off-topic. */
export type ChoiceStepTier = 'exact' | 'near' | 'close' | 'wrong';

/**
 * Progress with 3 answer tiers:
 * - exact → advance
 * - near → explain soft-teach, stay until exact after teach
 * - wrong → soft-teach once, then soft-advance on 2nd wrong
 */
export function computeThreeTierChoiceProgress(
  history: Array<{ speaker: string; textEn?: string }>,
  maxStep: number,
  scoreStep: (step: number, text: string) => ChoiceStepTier,
): number {
  let progress = 0;
  let awaitingCorrection = false;
  let wrongAttempts = 0;

  for (const turn of history) {
    if (turn.speaker === 'user') {
      const text = (turn.textEn ?? '').trim();
      if (!text || text.startsWith('[') || text.startsWith('(')) continue;
      const next = progress + 1;
      if (next > maxStep) continue;

      const tier = scoreStep(next, text);

      if (
        progress >= 1 &&
        scoreStep(1, text) === 'exact' &&
        tier !== 'exact' &&
        next === 2
      ) {
        continue;
      }

      if (awaitingCorrection) {
        if (tier === 'exact') {
          progress = next;
          awaitingCorrection = false;
          wrongAttempts = 0;
        } else if (tier === 'near' || tier === 'close') {
          awaitingCorrection = false;
          wrongAttempts = 0;
        } else {
          wrongAttempts++;
          awaitingCorrection = false;
          if (wrongAttempts >= 2) {
            progress = next;
            wrongAttempts = 0;
          }
        }
        continue;
      }

      if (tier === 'exact') {
        progress = next;
        wrongAttempts = 0;
        continue;
      }

      if (tier === 'near' || tier === 'close') {
        wrongAttempts = 0;
        continue;
      }

      wrongAttempts++;
      if (wrongAttempts >= 2) {
        progress = next;
        wrongAttempts = 0;
      }
      continue;
    }

    if (turn.speaker === 'ai' && looksLikeSoftTeachReveal(turn.textEn ?? '')) {
      awaitingCorrection = true;
    }
  }

  return progress;
}

export function pendingThreeTierSoftTeach(
  history: Array<{ speaker: string; textEn?: string }>,
  progressFn: (history: Array<{ speaker: string; textEn?: string }>) => number,
  maxStep: number,
  scoreStep: (step: number, text: string) => ChoiceStepTier,
): boolean {
  const progress = progressFn(history);
  const step = progress + 1;
  if (step > maxStep) return false;

  let lastUserIdx = -1;
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].speaker === 'user') {
      lastUserIdx = i;
      break;
    }
  }
  if (lastUserIdx < 0) return false;

  const userText = (history[lastUserIdx].textEn ?? '').trim();
  if (!userText) return false;

  const tier = scoreStep(step, userText);
  if (tier === 'exact') return false;
  if (progress >= 1 && scoreStep(progress, userText) === 'exact') return false;
  if (
    progress >= 1 &&
    scoreStep(1, userText) === 'exact'
  ) {
    return false;
  }

  for (let i = lastUserIdx + 1; i < history.length; i++) {
    const turn = history[i];
    if (
      turn.speaker === 'ai' &&
      looksLikeSoftTeachReveal(turn.textEn ?? '')
    ) {
      return false;
    }
  }

  return tier === 'near' || tier === 'close' || tier === 'wrong';
}

function choiceSpeechExactMatch(
  normalizedUser: string,
  normalizedTarget: string,
): boolean {
  return (
    normalizedUser.length > 0 &&
    normalizedTarget.length > 0 &&
    normalizedUser === normalizedTarget
  );
}

/**
 * exact = board option / expectedSpeech; near = legacy soft-accept matcher; wrong = else.
 * Reuse across About Me choice lessons (Daily Routine uses custom scoreDailyRoutineStep).
 */
export function createBoardChoiceScorer(
  normalize: (text: string) => string,
  getBoard: (step: number) => ForcedGuidedBoard | null,
  matchesLoose: (step: number, text: string) => boolean,
): (step: number, text: string) => ChoiceStepTier {
  return (step, text) => {
    const t = normalize(text);
    if (!t) return 'wrong';
    const board = getBoard(step);
    if (board) {
      for (const opt of board.options) {
        if (choiceSpeechExactMatch(t, normalize(opt.speak))) return 'exact';
      }
      const expected = normalize(board.expectedSpeech);
      if (expected && choiceSpeechExactMatch(t, expected)) return 'exact';
    }
    if (matchesLoose(step, text)) return 'near';
    return 'wrong';
  };
}

function matchesExactFromScorer(
  scoreStep: (step: number, text: string) => ChoiceStepTier,
): (step: number, text: string) => boolean {
  return (step, text) => scoreStep(step, text) === 'exact';
}

/**
 * Choice-lesson progress with soft-teach: first wrong → wait for reveal;
 * after reveal, any speak advances; second wrong without reveal → soft-advance.
 */
export function computeSoftTeachChoiceProgress(
  history: Array<{ speaker: string; textEn?: string }>,
  maxStep: number,
  matchesStep: (step: number, text: string) => boolean,
): number {
  let progress = 0;
  let pendingSoftTeach = false;
  let correctionTurn = false;

  for (const turn of history) {
    if (turn.speaker === 'user') {
      const text = (turn.textEn ?? '').trim();
      if (!text || text.startsWith('[') || text.startsWith('(')) continue;
      const next = progress + 1;
      if (next > maxStep) continue;

      if (correctionTurn) {
        progress = next;
        correctionTurn = false;
        pendingSoftTeach = false;
        continue;
      }

      if (matchesStep(next, text)) {
        progress = next;
        pendingSoftTeach = false;
        correctionTurn = false;
        continue;
      }

      // Benign repeat of step-1 phrase (e.g. second "I'm ready" on Daily Routine)
      // while the next step expects vocab — not a wrong answer.
      if (progress >= 1 && matchesStep(1, text) && !matchesStep(next, text)) {
        continue;
      }

      if (!pendingSoftTeach && !correctionTurn) {
        pendingSoftTeach = true;
        continue;
      }

      if (pendingSoftTeach) {
        progress = next;
        pendingSoftTeach = false;
        correctionTurn = false;
      }
      continue;
    }

    if (turn.speaker === 'ai' && looksLikeSoftTeachReveal(turn.textEn ?? '')) {
      pendingSoftTeach = false;
      correctionTurn = true;
    }
  }

  return progress;
}

/** True when the learner missed the current step and soft-teach has not fired yet. */
export function pendingSoftTeachForChoiceLesson(
  history: Array<{ speaker: string; textEn?: string }>,
  progressFn: (history: Array<{ speaker: string; textEn?: string }>) => number,
  maxStep: number,
  matchesStep: (step: number, text: string) => boolean,
): boolean {
  const progress = progressFn(history);
  const step = progress + 1;
  if (step > maxStep) return false;

  let lastUserIdx = -1;
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].speaker === 'user') {
      lastUserIdx = i;
      break;
    }
  }
  if (lastUserIdx < 0) return false;

  const userText = (history[lastUserIdx].textEn ?? '').trim();
  if (!userText || matchesStep(step, userText)) return false;
  if (progress >= 1 && matchesStep(progress, userText)) return false;
  if (
    progress >= 1 &&
    matchesStep(1, userText) &&
    !matchesStep(step, userText)
  ) {
    return false;
  }

  for (let i = lastUserIdx + 1; i < history.length; i++) {
    const turn = history[i];
    if (
      turn.speaker === 'ai' &&
      looksLikeSoftTeachReveal(turn.textEn ?? '')
    ) {
      return false;
    }
  }
  return true;
}

function buildGuidedSpeakingFromBoard(
  board: ForcedGuidedBoard,
): NonNullable<GuidedSpeakingCard> {
  const first = board.options[0];
  const options = board.options.map((o) => ({ ...o }));
  const isSingleHint = options.length === 1;
  if (isSingleHint) {
    return {
      stem: board.stem,
      emoji: first.emoji,
      speak: first.speak,
      ...(first.label ? { label: first.label } : {}),
    };
  }
  return {
    stem: board.stem,
    emoji: first.emoji,
    speak: first.speak,
    ...(first.label ? { label: first.label } : {}),
    options,
  };
}

export function forceGuidedBoardSoftTeachIfNeeded(
  lessonId: string,
  expectedLessonId: string,
  lang: LessonTeachingLanguage,
  history: Array<{ speaker: string; textEn?: string }>,
  current: {
    textEn: string;
    textTh: string | null | undefined;
    guidedSpeaking: GuidedSpeakingCard | null;
    expectsUserSpeech: boolean;
    isTaskComplete: boolean;
    expectedSpeech: string | null;
  },
  cfg: {
    progressFn: (history: Array<{ speaker: string; textEn?: string }>) => number;
    maxStep: number;
    matchesStep: (step: number, text: string) => boolean;
    scoreStep?: (step: number, text: string) => ChoiceStepTier;
    getBoard: (step: number) => ForcedGuidedBoard | null;
  },
): {
  textEn: string;
  textTh: string | null;
  guidedSpeaking: GuidedSpeakingCard;
  expectsUserSpeech: true;
  expectedSpeech: string;
  emojiChoice: null;
  isTaskComplete: false;
} | null {
  if (lessonId !== expectedLessonId) return null;
  if (current.isTaskComplete) return null;

  const progress = cfg.progressFn(history);
  const step = progress + 1;
  if (step > cfg.maxStep) return null;

  let lastUserText = '';
  let lastUserIdx = -1;
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].speaker === 'user') {
      lastUserText = (history[i].textEn ?? '').trim();
      lastUserIdx = i;
      break;
    }
  }
  if (!lastUserText || lastUserText.startsWith('[')) return null;
  const tier = cfg.scoreStep
    ? cfg.scoreStep(step, lastUserText)
    : cfg.matchesStep(step, lastUserText)
      ? 'exact'
      : 'wrong';
  if (tier === 'exact') return null;
  // Just cleared step `progress` (e.g. "wake up" on vocab) — advance, don't soft-teach next step.
  if (progress >= 1 && cfg.matchesStep(progress, lastUserText)) return null;

  // Duplicate step-1 ready phrase while step 2 is next — re-pin board, no soft-teach.
  if (progress === 1 && step === 2 && cfg.matchesStep(1, lastUserText)) {
    return null;
  }

  // Soft-teach already fired for this user attempt (not any earlier step in the lesson).
  for (let i = lastUserIdx + 1; i < history.length; i++) {
    const turn = history[i];
    if (turn.speaker === 'ai' && looksLikeSoftTeachReveal(turn.textEn ?? '')) {
      return null;
    }
  }
  if (
    looksLikeSoftTeachReveal(current.textEn ?? '') &&
    current.expectsUserSpeech
  ) {
    return null;
  }

  const board = cfg.getBoard(step);
  const expectedSpeech = (board?.expectedSpeech ?? current.expectedSpeech ?? '')
    .trim();
  if (!expectedSpeech) return null;
  if (!board && !current.guidedSpeaking) return null;

  const softTeachEn = buildSoftTeachRevealLine(
    expectedSpeech,
    lang,
    board?.softTeachHintTh,
  );

  return {
    textEn: softTeachEn,
    textTh:
      lang === 'english' ? 'พูดตามประโยคที่ถูกต้องครั้งเดียว' : null,
    guidedSpeaking: board
      ? buildGuidedSpeakingFromBoard(board)
      : current.guidedSpeaking!,
    expectsUserSpeech: true,
    expectedSpeech,
    emojiChoice: null,
    isTaskComplete: false,
  };
}
