import { TAP_TO_CONTINUE_TURN_TEXT } from '../../common/api.types';
import {
  pronunciationLessonSpecs,
  pronunciationSpecFor,
  type LessonConfig,
  type PronunciationLessonSpec,
} from '../../lessons/lessons.data';
import { teachingLanguageFromConfig } from '../../lessons/lesson-prompt';
import type { ChatTurn } from '../../session-store/session-store.service';
import { ttsBankKey } from '../../tts/tts-bank';
import { lineContainsLearnerName } from '../../tts/chapter1-tts-lines';
import { FOUNDATION_PROBE_LEARNER } from '../foundation/foundation-poolgate.fixtures';
import type { ScriptTurnResult } from './types';

const COMPLETE_TH =
  'เก่งมากครับ! ปิดท้ายบทนี้ด้วยการฝึกทวนคำเมื่อกี้อีกรอบนะครับ';
const COMPLETE_EN =
  "Great work! Let's close this lesson with a quick drill on the same words.";
const LISTEN_TH = 'ลองฟังก่อนนะครับ';
const LISTEN_EN = 'Listen first.';
const LISTEN_AGAIN_TH = 'ลองฟังอีกรอบนะครับ';
const LISTEN_AGAIN_EN = 'Listen one more time.';
const PAIR_TH = 'ลองฟังสองแบบนะครับ';
const PAIR_EN = 'Listen to both versions.';
const TURN_TH = 'ตาคุณแล้วครับ';
const TURN_EN = 'Your turn.';
const RETRY_TH = 'ลองอีกครั้งนะครับ';
const RETRY_EN = 'Try once more.';
const PRAISE_TH = 'ดีมากครับ!';
const PRAISE_EN = 'Nice!';
const COACH_TH = 'ดีแล้วครับ ลองเน้นให้ชัดขึ้นอีกนิด';
const COACH_EN = 'Nice — make the key sound a bit clearer.';

type ListenBeat = { textEn: string; ttsText: string };

function isEnglish(config: LessonConfig): boolean {
  return teachingLanguageFromConfig(config) === 'english';
}

function listenBeats(
  spec: PronunciationLessonSpec,
  english: boolean,
): ListenBeat[] {
  const beats: ListenBeat[] = [];
  const push = (text: string | undefined) => {
    const tts = ttsBankKey(text);
    if (tts) beats.push({ textEn: tts, ttsText: tts });
  };

  if (english) {
    push(spec.chapterIntroEn);
    push(spec.chapterOverviewEn);
  } else {
    push(spec.chapterIntroTh);
    push(spec.chapterOverviewTh);
  }

  if (spec.contrasts?.length && spec.explainTh && spec.explainEn) {
    const pairs = spec.contrasts
      .map((pair) => `❌ ${pair.wrong}\n✅ ${pair.right}`)
      .join('\n');
    const invite = english ? PAIR_EN : PAIR_TH;
    push(`${invite}\n${pairs}`);
    push(english ? spec.explainEn : spec.explainTh);
  } else {
    const listenItems = spec.listenItems ?? spec.items;
    const listenAgain = spec.listenAgainItems ?? spec.items;
    const dual = spec.smoothMode === true || spec.fineTuneMode === true;
    push(`${english ? LISTEN_EN : LISTEN_TH}\n${listenItems.join('\n')}`);
    if (dual) {
      push(
        `${english ? LISTEN_AGAIN_EN : LISTEN_AGAIN_TH}\n${listenAgain.join('\n')}`,
      );
    }
  }

  push(english ? spec.tipEn : spec.tipTh);
  return beats;
}

function practicePrompt(item: string, english: boolean): string {
  return `${english ? TURN_EN : TURN_TH}\n${item}`;
}

function matchesItem(userText: string, item: string): boolean {
  const said = userText.toLowerCase();
  return item
    .split('/')
    .map((part) => part.trim().replace(/-/g, '').toLowerCase())
    .filter(Boolean)
    .some((part) => said.includes(part));
}

function listenReply(beat: ListenBeat): ScriptTurnResult {
  return {
    textEn: beat.textEn,
    ttsText: beat.ttsText,
    textTh: '',
    isLessonComplete: false,
    expectsUserSpeech: false,
    expectedSpeech: '',
  };
}

function practiceReply(
  item: string,
  english: boolean,
  opts?: { praise?: boolean; retry?: boolean; coach?: boolean },
): ScriptTurnResult {
  const prompt = practicePrompt(item, english);
  const retryLine = english ? RETRY_EN : RETRY_TH;
  const coachLine = english ? COACH_EN : COACH_TH;
  let textEn = prompt;
  let ttsText = prompt;
  if (opts?.retry) {
    textEn = `${retryLine}\n${item}`;
    ttsText = textEn;
  } else if (opts?.coach) {
    textEn = `${coachLine}\n${prompt}`;
    ttsText = prompt;
  } else if (opts?.praise) {
    textEn = `${english ? PRAISE_EN : PRAISE_TH}\n${prompt}`;
    ttsText = prompt;
  }
  return {
    textEn,
    ttsText,
    textTh: '',
    isLessonComplete: false,
    expectsUserSpeech: true,
    expectedSpeech: item,
    praiseText: opts?.praise ? (english ? PRAISE_EN : PRAISE_TH) : undefined,
    v7Retry: opts?.retry || undefined,
  };
}

function completeReply(english: boolean, name: string): ScriptTurnResult {
  const ttsText = english ? COMPLETE_EN : COMPLETE_TH;
  const named = english
    ? `Great work, ${name}! Let's close this lesson with a quick drill on the same words.`
    : `เก่งมากครับ ${name}! ปิดท้ายบทนี้ด้วยการฝึกทวนคำเมื่อกี้อีกรอบนะครับ`;
  return {
    textEn: named,
    ttsText,
    textTh: '',
    isLessonComplete: true,
    expectsUserSpeech: false,
    expectedSpeech: '',
    completionStatus: 'completed_independently',
  };
}

export function buildPronunciationOpening(
  config: LessonConfig,
): ScriptTurnResult {
  const spec = pronunciationSpecFor(config.lessonId);
  if (!spec) {
    throw new Error(`missing pronunciation spec: ${config.lessonId}`);
  }
  const beats = listenBeats(spec, isEnglish(config));
  const first = beats[0];
  if (!first) {
    throw new Error(`pronunciation lesson has no listen steps: ${config.lessonId}`);
  }
  return listenReply(first);
}

export function buildPronunciationAfterUser(input: {
  config: LessonConfig;
  turns: ChatTurn[];
  userText: string;
  learnerFirstName: string;
}): ScriptTurnResult | null {
  const spec = pronunciationSpecFor(input.config.lessonId);
  if (!spec) return null;
  const english = isEnglish(input.config);
  const beats = listenBeats(spec, english);
  const items = spec.items;
  const coach = spec.stressMode === true || spec.smoothMode === true;
  const aiTurns = input.turns.filter((turn) => turn.speaker === 'ai');
  const lastAi = aiTurns[aiTurns.length - 1];
  if (!lastAi) return listenReply(beats[0]!);
  const name = input.learnerFirstName.trim() || FOUNDATION_PROBE_LEARNER;

  const listenDone = aiTurns.filter(
    (turn) => turn.expectsUserSpeech === false && !turn.completionStatus,
  ).length;

  if (lastAi.expectsUserSpeech === false) {
    if (listenDone < beats.length) return listenReply(beats[listenDone]!);
    const firstItem = items[0];
    if (!firstItem) return completeReply(english, name);
    return practiceReply(firstItem, english);
  }

  const current = lastAi.expectedSpeech?.trim() || items[0] || '';
  const index = Math.max(0, items.indexOf(current));
  const hit = matchesItem(input.userText, current);
  const alreadyRetried = lastAi.v7Retry === true;
  if (coach || hit || alreadyRetried) {
    const next = items[index + 1];
    if (!next) return completeReply(english, name);
    return practiceReply(next, english, {
      praise: hit && !coach,
      coach,
    });
  }
  return practiceReply(current, english, { retry: true });
}

export function collectPronunciationBankLines(
  name = FOUNDATION_PROBE_LEARNER,
): string[] {
  const lines = new Set<string>();
  const add = (text: string | undefined) => {
    const key = ttsBankKey(text);
    if (!key || lineContainsLearnerName(key, name)) return;
    lines.add(key);
  };

  add(COMPLETE_TH);
  add(COMPLETE_EN);
  add(LISTEN_TH);
  add(LISTEN_EN);
  add(LISTEN_AGAIN_TH);
  add(LISTEN_AGAIN_EN);
  add(PAIR_TH);
  add(PAIR_EN);
  add(TURN_TH);
  add(TURN_EN);
  add(RETRY_TH);
  add(RETRY_EN);
  add(PRAISE_TH);
  add(PRAISE_EN);
  add(COACH_TH);
  add(COACH_EN);

  for (const spec of pronunciationLessonSpecs()) {
    for (const english of [false, true]) {
      for (const beat of listenBeats(spec, english)) add(beat.ttsText);
      for (const item of spec.items) {
        add(item);
        add(practicePrompt(item, english));
        add(`${english ? RETRY_EN : RETRY_TH}\n${item}`);
      }
      for (const item of spec.listenItems ?? []) add(item);
      for (const item of spec.listenAgainItems ?? []) add(item);
      for (const pair of spec.contrasts ?? []) {
        add(pair.wrong);
        add(pair.right);
      }
    }
  }

  return [...lines].sort((a, b) => a.localeCompare(b));
}

export function isPronunciationScriptLesson(lessonId: string): boolean {
  return pronunciationSpecFor(lessonId) != null;
}

export function pronunciationContinueText(): string {
  return TAP_TO_CONTINUE_TURN_TEXT;
}
