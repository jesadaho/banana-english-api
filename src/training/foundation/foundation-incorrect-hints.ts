import type { ForcedGuidedBoard } from '../../lessons/choice-board';

function stripTrailingDots(text: string): string {
  return text.replace(/\.+$/g, '').trim();
}

/** Repeat-only — incorrect uses Gemini + optional ลองพูดตาม append. */
export function isFoundationRepeatOnlyBoard(board: ForcedGuidedBoard): boolean {
  return (
    board.stem.trim() === '' &&
    board.options.length <= 1 &&
    /(?:ลอง)?พูดตาม/u.test(board.textEn)
  );
}

function stemToHintLead(stem: string): string {
  const trimmed = stem.trim();
  if (!trimmed) return '';
  if (trimmed.includes('...')) return trimmed;
  return `${stripTrailingDots(trimmed)}...`;
}

function optionToHintPhrase(option: {
  label?: string;
  speak: string;
}): string {
  const speak = stripTrailingDots(option.speak);
  if (speak) return speak;
  const label = option.label?.trim();
  return label ?? '';
}

/** Default Thai incorrect guide for guided / open Foundation steps (Introductions-style). */
export function resolveIncorrectHintTh(
  board: ForcedGuidedBoard,
): string | undefined {
  if (board.incorrectHintTh?.trim()) {
    return board.incorrectHintTh.trim();
  }
  if (isFoundationRepeatOnlyBoard(board)) {
    return undefined;
  }

  const stem = board.stem.trim();
  const options = board.options;

  if (options.length === 0 && stem) {
    const lead = stemToHintLead(stem);
    return `ยังไม่ตรงครับ ลองใช้ “${lead}” แล้วพูดต่อให้ครบประโยคครับ`;
  }

  if (stem) {
    const parts = stem.split('/').map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      const a = stemToHintLead(parts[0]!);
      const b = stemToHintLead(parts[1]!);
      return `ยังไม่ตรงครับ ลองใช้ “${a}” หรือ “${b}” ครับ`;
    }
    const lead = stemToHintLead(stem);
    return `ยังไม่ตรงครับ ลองใช้ “${lead}” แล้วพูดต่อให้ครบประโยคครับ`;
  }

  if (options.length >= 2) {
    const phrases = [
      ...new Set(options.map(optionToHintPhrase).filter(Boolean)),
    ].slice(0, 3);
    if (phrases.length === 2) {
      return `ยังไม่ตรงครับ ลองใช้ “${phrases[0]}” หรือ “${phrases[1]}” ครับ`;
    }
    if (phrases.length >= 1) {
      return `ยังไม่ตรงครับ ลองเลือกคำตอบที่ตรงกับคำถาม เช่น “${phrases[0]}” ครับ`;
    }
    return 'ยังไม่ตรงครับ ลองเลือกคำตอบจากตัวเลือกที่เหมาะกับคำถามครับ';
  }

  return undefined;
}
