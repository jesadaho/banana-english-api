import { getInteractiveScenario } from '../interactive-scenario/interactive-scenario.data';
import {
  conversationClipHash,
  loadConversationTtsBank,
  type ConversationBankJob,
  type ConversationTtsBank,
} from '../tts/conversation-tts-bank';
import {
  characterVoice,
  conversationVoiceFor,
  teacherScenarioVoice,
  type ConversationVoice,
} from '../tts/conversation-voices';
import {
  loadTtsBank,
  ttsBankKey,
  TTS_BANK_PROMPT,
  TTS_BANK_VOICE,
  type TtsBankFile,
} from '../tts/tts-bank';
import { FOUNDATION_V7_CATALOG } from './foundation-v7-path.data';
import { listenDrillItemsForChapter, listenDrillTalkNode, type ListenDrillItem } from './listen-drill.data';

/**
 * Audio for Listen Up (easy), all in character voices (conversation bank):
 * - conversation lines: the conversation's character — the same file the
 *   learner hears in the conversation;
 * - taught sentences: the authored `speaker` (Max, May, Mali, John, Minnie).
 * Not banked yet → `audioUrl: null`; the app then uses device TTS (free).
 * Exact text match only, so a question never plays a statement clip.
 */
export type ListenDrillAudioItem = ListenDrillItem & {
  audioUrl: string | null;
  voice: string;
  voicePrompt: string;
};

/** Voice of the conversation (or teacher scenario) right after the drill. */
export function listenDrillConversationVoice(chapterId: string): ConversationVoice | null {
  const chapter = FOUNDATION_V7_CATALOG.chapters.find((c) => c.id === chapterId);
  const node = chapter ? listenDrillTalkNode(chapter.items) : undefined;
  if (node?.type === 'conversation' && node.contentRef.simulationId) {
    return conversationVoiceFor(node.contentRef.simulationId);
  }
  if (node?.type === 'interactive_scenario' && node.contentRef.scenarioId) {
    const scenario = getInteractiveScenario(node.contentRef.scenarioId);
    return teacherScenarioVoice(scenario?.ttsVoiceProfile ?? scenario?.teacher);
  }
  return null;
}

export function withListenDrillAudio(
  chapterId: string,
  items: readonly ListenDrillItem[],
  banks: { lesson?: TtsBankFile; conversation?: ConversationTtsBank } = {},
): ListenDrillAudioItem[] {
  const lessonBank = banks.lesson ?? loadTtsBank();
  const conversationBank = banks.conversation ?? loadConversationTtsBank();
  const npc = listenDrillConversationVoice(chapterId);
  return items.map((item) => {
    const key = ttsBankKey(item.text);
    const voice = listenDrillItemVoice(item, npc);
    if (voice) {
      return {
        ...item,
        speaker: voice.speaker,
        audioUrl: conversationBank.clips[conversationClipHash(voice, key)]?.url ?? null,
        voice: voice.voice,
        voicePrompt: voice.prompt,
      };
    }
    return {
      ...item,
      audioUrl: lessonBank.lines[key] ?? null,
      voice: TTS_BANK_VOICE,
      voicePrompt: TTS_BANK_PROMPT,
    };
  });
}

function listenDrillItemVoice(
  item: Pick<ListenDrillItem, 'source' | 'speaker'>,
  npc: ConversationVoice | null,
): ConversationVoice | null {
  if (item.source === 'conversation') return npc ?? characterVoice(item.speaker);
  return characterVoice(item.speaker);
}

/** Lines with no character voice (Teacher B bank via build-chapter1-tts-bank.ts). */
export function collectListenDrillLessonLines(): string[] {
  return FOUNDATION_V7_CATALOG.chapters.flatMap((chapter) => {
    const npc = listenDrillConversationVoice(chapter.id);
    return listenDrillItemsForChapter(chapter.id)
      .filter((item) => !listenDrillItemVoice(item, npc))
      .map((item) => item.text);
  });
}

/** Conversation lines for scripts/build-conversation-tts-bank.ts (character voice). */
export function collectListenDrillConversationJobs(): ConversationBankJob[] {
  const jobs = new Map<string, ConversationBankJob>();
  for (const chapter of FOUNDATION_V7_CATALOG.chapters) {
    const npc = listenDrillConversationVoice(chapter.id);
    for (const item of listenDrillItemsForChapter(chapter.id)) {
      const voice = listenDrillItemVoice(item, npc);
      if (!voice) continue;
      const text = ttsBankKey(item.text);
      const hash = conversationClipHash(voice, text);
      if (!jobs.has(hash)) jobs.set(hash, { voice, text, hash });
    }
  }
  return [...jobs.values()];
}
