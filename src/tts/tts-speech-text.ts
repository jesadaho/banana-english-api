const THAI_LETTER = /[\u0E00-\u0E7F]/u;
const LATIN_LETTER = /[A-Za-z]/;

const THAI_ONES = [
  'ศูนย์',
  'หนึ่ง',
  'สอง',
  'สาม',
  'สี่',
  'ห้า',
  'หก',
  'เจ็ด',
  'แปด',
  'เก้า',
];

const EN_ONES = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
];

const EN_TEENS = [
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
];

const EN_TENS = [
  '',
  '',
  'twenty',
  'thirty',
  'forty',
  'fifty',
  'sixty',
  'seventy',
  'eighty',
  'ninety',
];

/** Same symbol strip the app applies before live TTS. */
export function sanitizeTtsSpeech(input: string): string {
  return input
    .replace(
      /[\u2190-\u21FF\u2300-\u27BF\u2B00-\u2BFF\uFE0F]|[\u{1F000}-\u{1FAFF}]/gu,
      ' ',
    )
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]*\n[ \t]*/g, '\n')
    .trim();
}

function isDigit(code: number): boolean {
  return code >= 0x30 && code <= 0x39;
}

function toThai(n: number): string {
  if (n < 10) return THAI_ONES[n];
  if (n === 10) return 'สิบ';
  if (n === 11) return 'สิบเอ็ด';
  if (n < 20) return `สิบ${THAI_ONES[n - 10]}`;
  if (n === 100) return 'หนึ่งร้อย';
  const tens = Math.floor(n / 10);
  const ones = n % 10;
  const tensWord = tens === 2 ? 'ยี่สิบ' : `${THAI_ONES[tens]}สิบ`;
  if (ones === 0) return tensWord;
  if (ones === 1) return `${tensWord}เอ็ด`;
  return `${tensWord}${THAI_ONES[ones]}`;
}

function toEnglish(n: number): string {
  if (n < 10) return EN_ONES[n];
  if (n < 20) return EN_TEENS[n - 10];
  if (n === 100) return 'one hundred';
  const tens = Math.floor(n / 10);
  const ones = n % 10;
  if (ones === 0) return EN_TENS[tens];
  return `${EN_TENS[tens]} ${EN_ONES[ones]}`;
}

function languageNear(
  input: string,
  start: number,
  end: number,
): 'thai' | 'english' | null {
  const after = input.slice(end, Math.min(input.length, end + 12));
  if (/^\s*(คือ|อ่านว่า)/u.test(after)) return 'thai';
  const before = input.slice(Math.max(0, start - 12), start);
  if (/(เลข|ตัว)\s*$/u.test(before)) return 'thai';

  let thaiDist: number | null = null;
  let englishDist: number | null = null;
  for (let i = 0; i < input.length; i++) {
    if (i >= start && i < end) continue;
    const ch = input[i];
    const dist = i < start ? start - i : i - end + 1;
    if (THAI_LETTER.test(ch)) {
      if (thaiDist == null || dist < thaiDist) thaiDist = dist;
    } else if (LATIN_LETTER.test(ch)) {
      if (englishDist == null || dist < englishDist) englishDist = dist;
    }
  }
  if (thaiDist == null && englishDist == null) return null;
  if (thaiDist == null) return 'english';
  if (englishDist == null) return 'thai';
  return thaiDist <= englishDist ? 'thai' : 'english';
}

/** Same digit reading the app uses before live TTS. Display text stays unchanged. */
export function expandTtsDigits(input: string): string {
  if (!input) return input;
  let out = '';
  let i = 0;
  while (i < input.length) {
    const code = input.charCodeAt(i);
    if (!isDigit(code)) {
      out += input[i];
      i++;
      continue;
    }
    const start = i;
    while (i < input.length && isDigit(input.charCodeAt(i))) i++;
    if (
      i < input.length &&
      input[i] === ':' &&
      i + 1 < input.length &&
      isDigit(input.charCodeAt(i + 1))
    ) {
      out += input.slice(start, i);
      continue;
    }
    if (start > 0 && input[start - 1] === ':') {
      out += input.slice(start, i);
      continue;
    }
    const raw = input.slice(start, i);
    const n = Number(raw);
    if (!Number.isInteger(n) || n > 100) {
      out += raw;
      continue;
    }
    const lang = languageNear(input, start, i);
    if (lang === 'thai') out += toThai(n);
    else if (lang === 'english') out += toEnglish(n);
    else out += raw;
  }
  return out;
}

/** Text actually sent to Cloud TTS for a banked line. */
export function synthesisText(spoken: string): string {
  return expandTtsDigits(sanitizeTtsSpeech(spoken));
}
