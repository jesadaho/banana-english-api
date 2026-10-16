import catalog from '../learn-path/foundation-v7-path.catalog.json';
import {
  getAllSimulations,
  getSimulation,
  type SimulationConfig,
} from '../simulations/simulations.data';
import { ttsBankKey } from './tts-bank';

const DOUBLE_QUOTE_RE = /"((?:\\.|[^"\\])*)"/g;

/** Closes the runtime can substitute for a live reply. */
const FIXED_CLOSES = [
  'No problem. We can talk about something else.',
  'Nice talking to you! See you around the park!',
  'Thanks for practicing. You can try again anytime.',
  'Thanks for practising. You can try again anytime.',
];

function singleQuoted(text: string): string[] {
  const pieces: string[] = [];
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== "'") continue;
    if (i > 0 && /[A-Za-z0-9]/.test(text[i - 1])) continue;
    let close = -1;
    for (let j = i + 1; j < text.length; j++) {
      if (text[j] !== "'") continue;
      if (j + 1 < text.length && /[A-Za-z0-9]/.test(text[j + 1])) continue;
      close = j;
      break;
    }
    if (close < 0) continue;
    pieces.push(text.slice(i + 1, close));
    i = close;
  }
  return pieces;
}

function quotedPieces(text: string): string[] {
  const doubles = [...text.matchAll(DOUBLE_QUOTE_RE)].map((match) =>
    match[1].replace(/\\(["\\])/g, '$1'),
  );
  return [...doubles, ...singleQuoted(text)];
}

/** A line the NPC can actually say. Drops goal ids and instruction fragments. */
export function isCacheableConversationLine(text: string): boolean {
  const key = ttsBankKey(text);
  if (!key || key.length > 160 || /[{}<>]/.test(key)) return false;
  if (!/^[A-Z]/.test(key)) return false;
  if (key.split(' ').length > 24) return false;
  if (/textTh|translate/i.test(key)) return false;
  if (
    /\b(learner|checkpoint|exactly|goal|mark|accept|script|grammar|mission)\b/i.test(key)
  ) {
    return false;
  }
  if (/^(after|then|if|when|use|never|do not|don't|once|finally|first|next|only)\b/i.test(key)) {
    return false;
  }
  return /[.!?]/.test(key) || key.split(' ').length >= 2;
}

type PathCatalog = {
  chapters: Array<{
    items: Array<{ type: string; contentRef?: { simulationId?: string } }>;
  }>;
};

/** Conversation nodes on the Foundation path. */
export function foundationConversationIds(): string[] {
  const ids: string[] = [];
  for (const chapter of (catalog as PathCatalog).chapters) {
    for (const item of chapter.items) {
      const simulationId =
        item.type === 'conversation' ? item.contentRef?.simulationId : undefined;
      if (simulationId) ids.push(simulationId);
    }
  }
  return ids;
}

function linesFromSimulations(
  sims: SimulationConfig[],
  includeFixedCloses: boolean,
): string[] {
  const lines = new Set<string>();
  const add = (text: string | null | undefined) => {
    const key = ttsBankKey(text);
    if (isCacheableConversationLine(key)) lines.add(key);
  };
  if (includeFixedCloses) {
    for (const close of FIXED_CLOSES) add(close);
  }
  for (const sim of sims) {
    add(sim.completionReplyEn);
    add(sim.fallbackReplyEn);
    for (const piece of quotedPieces(sim.openingPrompt ?? '')) add(piece);
    for (const piece of quotedPieces(sim.systemInstruction)) add(piece);
  }
  return [...lines].sort((a, b) => a.localeCompare(b));
}

/**
 * NPC lines that are fixed in the mission script: the required opening,
 * the success and fallback closes, and any English sentence the role quotes.
 * Replies Gemini invents on the spot stay on live TTS.
 */
export function collectConversationBankLines(): string[] {
  return linesFromSimulations(getAllSimulations(), true);
}

/** Fixed lines for one mission, including the shared fallback closes. */
export function cacheableLinesForSimulation(sim: SimulationConfig): string[] {
  return linesFromSimulations([sim], true);
}

/** Fixed lines for Foundation (A1) conversation nodes only. */
export function collectFoundationConversationBankLines(): string[] {
  const sims = foundationConversationIds().map((id) => {
    const sim = getSimulation(id);
    if (!sim) throw new Error(`missing simulation ${id}`);
    return sim;
  });
  return linesFromSimulations(sims, true);
}
