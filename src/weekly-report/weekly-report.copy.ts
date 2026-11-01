import type {
  WeeklyAddon,
  WeeklyCopyVars,
  WeeklyReportLocale,
  WeeklySpeakSegment,
} from './weekly-report.types';

export const TITLE_MAX = 30;
export const BODY_MAX = 110;

type Piece = {
  id: string;
  th: string;
  en: string;
};

export const ACTIVE_TITLES: Piece[] = [
  { id: 'title_01', th: 'สรุปอาทิตย์นี้มาแล้ว', en: 'Your week recap is here' },
  { id: 'title_02', th: 'อาทิตย์นี้เธอทำอะไรไปบ้าง', en: 'What you did this week' },
  { id: 'title_03', th: 'Weekly recap มาแล้ว', en: 'Weekly recap is in' },
];

export const FIRST_WEEK_TITLE: Piece = {
  id: 'title_first',
  th: 'สรุปสัปดาห์แรกของคุณ',
  en: 'Your first week is in',
};

export const IDLE_TITLE: Piece = {
  id: 'title_idle',
  th: 'สัปดาห์นี้ไม่มีความคืบหน้าเลยนะ',
  en: 'No progress this week',
};

export const ACTIVE_OPENS: Piece[] = [
  { id: 'open_01', th: 'อาทิตย์นี้พูดอังกฤษไป {n} ประโยค', en: 'You spoke {n} English sentences this week' },
  { id: 'open_02', th: 'พูดอังกฤษไป {n} ประโยคในอาทิตย์เดียว', en: '{n} English sentences in one week' },
];

export const ACTIVE_CLOSES: Piece[] = [
  { id: 'close_01', th: 'เก่งเกิ๊น', en: 'So good' },
  { id: 'close_02', th: 'ปังมาก', en: 'You crushed it' },
  { id: 'close_03', th: 'ใครจะไปสู้ไหว', en: 'Hard to beat that' },
  { id: 'close_04', th: 'ครูบีภูมิใจสุด ๆ', en: 'Teacher B is so proud' },
  { id: 'close_05', th: 'สุดยอดอะ', en: 'That’s awesome' },
];

export const LIGHT_BODIES: Piece[] = [
  { id: 'light_01', th: 'เริ่มแล้วก็คือชนะไปครึ่งนึง {n} ประโยคนี้นับหมดนะ', en: 'Starting counts. Those {n} sentences are in' },
  { id: 'light_02', th: '{n} ประโยคแรกของอาทิตย์ ก้าวเล็ก ๆ แต่ไปต่อได้ไกล', en: '{n} sentences this week. Small step, still a step' },
  { id: 'light_03', th: 'พูดไป {n} ประโยค {addon} ใช้ได้เลยนะ', en: '{n} sentences {addon} nice work' },
  { id: 'light_04', th: 'อาทิตย์นี้มาแบบเบา ๆ {n} ประโยค อาทิตย์หน้าลองวันละ 5 นาทีกันมั้ย', en: 'A light week: {n} sentences. Try 5 minutes a day next week?' },
];

export const IDLE_APP_BODIES: Piece[] = [
  { id: 'idle_app_vocab', th: 'อาทิตย์นี้เก็บคำศัพท์ใหม่ไป {w} คำ สมองพร้อมแล้ว เหลือแค่ปล่อยเสียง', en: '{w} new words this week. Brain’s ready — just add your voice' },
  { id: 'idle_app_days', th: 'เข้ามาตั้ง {d} วัน ขยันมาก อาทิตย์หน้าลองเปิดไมค์คุยกับครูบีสักบทนะ', en: 'You showed up {d} days. Next week, try one chat with Teacher B' },
  { id: 'idle_app_rank', th: 'ตอนนี้อยู่อันดับ #{r} ใน {game} ด้วย ลองมาพูดบ้างนะ', en: 'You’re #{r} in {game}. Come speak a little too' },
  { id: 'idle_app_wait', th: 'ครูบีรอฟังเสียงเธออยู่น้า แค่ประโยคเดียวก็ได้', en: 'Teacher B is waiting to hear you. One sentence is enough' },
];

export const IDLE_BODIES: Piece[] = [
  { id: 'idle_01', th: 'งอนละนะ', en: 'Okay I’m a little sulky now' },
  { id: 'idle_02', th: 'คิดถึงอะ ว่างเมื่อไหร่แวะมาคุยกันหน่อยนะ', en: 'Miss you. Come say hi when you can' },
  { id: 'idle_03', th: 'ไม่เป็นไรหรอก อาทิตย์หน้าค่อยว่ากันใหม่', en: 'All good. We’ll try again next week' },
  { id: 'idle_04', th: 'กล้วยที่เก็บไว้ให้จะเน่าหมดแล้วเนี่ย', en: 'The bananas I saved for you are going soft' },
  { id: 'idle_05', th: 'พูดแค่ประโยคเดียวก็ได้ ไม่ต้องเยอะ', en: 'One sentence is enough. No need to do a lot' },
  { id: 'idle_06', th: 'อีกแค่ {x} บทก็จบ {chapter} แล้วนะ เสียดายอะ', en: 'Only {x} lessons left in {chapter}. So close' },
  { id: 'idle_07', th: 'ไม่อยากเรียนก็มาเล่น Games กัน', en: 'Not in a lesson mood? Come play Games' },
  { id: 'idle_08', th: 'เริ่ม streak ใหม่วันนี้เลยมั้ย', en: 'Start a new streak today?' },
];

const ADDON_COPY: Record<
  WeeklyAddon['kind'],
  { th: string; en: string } | { many: { th: string; en: string }; one: { th: string; en: string } }
> = {
  interview: { th: 'แถมผ่านสัมภาษณ์ {name} อีก', en: 'plus you passed {name}’s interview' },
  level_test: { th: 'แถมสอบได้ {level} ติด Top {x}% อีก', en: 'plus you placed {level}, Top {x}%' },
  leaderboard_top: { th: 'แถมตอนนี้อยู่อันดับ #{r} ใน {game} อีก', en: 'plus you’re #{r} on {game}' },
  leaderboard: { th: 'แถมติดตารางอันดับ {game} อีก', en: 'plus you made the {game} board' },
  badge: {
    one: { th: 'แถมปลดล็อก badge "{badge}" มาครองอีก', en: 'plus you unlocked the "{badge}" badge' },
    many: { th: 'แถมปลดล็อก badge ใหม่ไปอีก {count} อัน', en: 'plus you unlocked {count} new badges' },
  },
  streak: { th: 'แถมไฟติดยาว {s} วันไม่มีหลุด', en: 'plus a {s}-day streak still going' },
  perfect: { th: 'แถมเก็บดาว Perfect ไปอีก {k} ดวง', en: 'plus {k} more Perfect stars' },
  vocab: { th: 'แถมได้คำศัพท์ใหม่ไปอีก {w} คำ', en: 'plus {w} new words' },
};

const THAI_MARK =
  /[\u0E31\u0E34-\u0E3A\u0E47-\u0E4E]/g;

export function visibleLength(text: string): number {
  return [...text.replace(THAI_MARK, '')].length;
}

export function fillVars(template: string, vars: WeeklyCopyVars): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = vars[key as keyof WeeklyCopyVars];
    return value == null ? '' : String(value);
  }).replace(/\s{2,}/g, ' ').trim();
}

export function pickPiece<T extends { id: string }>(
  pool: T[],
  recentIds: string[],
  random = Math.random,
): T {
  const avoid = new Set(recentIds);
  const fresh = pool.filter((item) => !avoid.has(item.id));
  const from = fresh.length > 0 ? fresh : pool;
  return from[Math.floor(random() * from.length)]!;
}

export function rememberTemplateIds(recentIds: string[], id: string): string[] {
  return [...recentIds, id].slice(-12);
}

export function addonText(
  addon: WeeklyAddon,
  locale: WeeklyReportLocale,
): string {
  const row = ADDON_COPY[addon.kind];
  const piece =
    'one' in row
      ? (addon.vars.count ?? 1) >= 2
        ? row.many
        : row.one
      : row;
  return fillVars(locale === 'en' ? piece.en : piece.th, addon.vars);
}

function localeText(piece: Piece, locale: WeeklyReportLocale, vars: WeeklyCopyVars) {
  return fillVars(locale === 'en' ? piece.en : piece.th, vars);
}

function trimToLimit(text: string, max: number): string {
  if (visibleLength(text) <= max) return text;
  const chars = [...text];
  let kept = '';
  for (const ch of chars) {
    const next = kept + ch;
    if (visibleLength(next) > max) break;
    kept = next;
  }
  return kept.trim();
}

export function composeActive(input: {
  locale: WeeklyReportLocale;
  firstWeek: boolean;
  vars: WeeklyCopyVars;
  addon?: WeeklyAddon | null;
  recentIds: string[];
  random?: () => number;
}): { title: string; body: string; templateId: string } {
  const random = input.random ?? Math.random;
  const titlePiece = input.firstWeek
    ? FIRST_WEEK_TITLE
    : pickPiece(ACTIVE_TITLES, input.recentIds, random);
  const open = pickPiece(ACTIVE_OPENS, input.recentIds, random);
  const close = pickPiece(ACTIVE_CLOSES, input.recentIds, random);
  const parts = [localeText(open, input.locale, input.vars)];
  let addonId: string | undefined;
  if (input.addon) {
    parts.push(addonText(input.addon, input.locale));
    addonId = `add_${input.addon.kind}`;
  }
  parts.push(localeText(close, input.locale, input.vars));
  let body = parts.filter(Boolean).join(' ');
  if (visibleLength(body) > BODY_MAX && input.addon) {
    body = [parts[0], parts[parts.length - 1]].filter(Boolean).join(' ');
    addonId = undefined;
  }
  if (visibleLength(body) > BODY_MAX) {
    body = parts[0] ?? '';
  }
  const templateId = [open.id, addonId, close.id].filter(Boolean).join('+');
  return {
    title: trimToLimit(localeText(titlePiece, input.locale, {}), TITLE_MAX),
    body: trimToLimit(body, BODY_MAX),
    templateId,
  };
}

export function composeLight(input: {
  locale: WeeklyReportLocale;
  firstWeek: boolean;
  vars: WeeklyCopyVars;
  addon?: WeeklyAddon | null;
  recentIds: string[];
  random?: () => number;
}): { title: string; body: string; templateId: string } {
  const random = input.random ?? Math.random;
  const titlePiece = input.firstWeek
    ? FIRST_WEEK_TITLE
    : pickPiece(ACTIVE_TITLES, input.recentIds, random);
  const light = pickPiece(LIGHT_BODIES, input.recentIds, random);
  const addon = input.addon ? addonText(input.addon, input.locale) : '';
  const withAddon = (text: string, extra: string) =>
    fillVars(text.replace('{addon}', extra || '').replace(/\s{2,}/g, ' '), input.vars);
  let body = withAddon(input.locale === 'en' ? light.en : light.th, addon);
  if (visibleLength(body) > BODY_MAX && addon) {
    body = withAddon(input.locale === 'en' ? light.en : light.th, '');
  }
  return {
    title: trimToLimit(localeText(titlePiece, input.locale, {}), TITLE_MAX),
    body: trimToLimit(body, BODY_MAX),
    templateId: [light.id, addon ? `add_${input.addon?.kind}` : null].filter(Boolean).join('+'),
  };
}

export function composeIdleApp(input: {
  locale: WeeklyReportLocale;
  firstWeek: boolean;
  vars: WeeklyCopyVars;
  recentIds: string[];
  random?: () => number;
}): { title: string; body: string; templateId: string } {
  const random = input.random ?? Math.random;
  const titlePiece = input.firstWeek
    ? FIRST_WEEK_TITLE
    : pickPiece(ACTIVE_TITLES, input.recentIds, random);
  const eligible = IDLE_APP_BODIES.filter((piece) => {
    if (piece.id === 'idle_app_vocab') return (input.vars.w ?? 0) > 0;
    if (piece.id === 'idle_app_days') return (input.vars.d ?? 0) > 0;
    if (piece.id === 'idle_app_rank') return (input.vars.r ?? 0) > 0 && Boolean(input.vars.game);
    return true;
  });
  const bodyPiece = pickPiece(eligible, input.recentIds, random);
  return {
    title: trimToLimit(localeText(titlePiece, input.locale, {}), TITLE_MAX),
    body: trimToLimit(localeText(bodyPiece, input.locale, input.vars), BODY_MAX),
    templateId: bodyPiece.id,
  };
}

export function composeIdle(input: {
  locale: WeeklyReportLocale;
  vars: WeeklyCopyVars;
  recentIds: string[];
  consecutiveIdleWeeks: number;
  previousActiveDays: number;
  idle01Blocked: boolean;
  random?: () => number;
}): { title: string; body: string; templateId: string; cta: 'learn' | 'games' } {
  const random = input.random ?? Math.random;
  let pool = IDLE_BODIES.filter((piece) => {
    if (piece.id === 'idle_01') {
      return !input.idle01Blocked && input.previousActiveDays >= 2;
    }
    if (piece.id === 'idle_06') return (input.vars.x ?? 0) > 0 && Boolean(input.vars.chapter);
    return true;
  });
  if (input.consecutiveIdleWeeks >= 1) {
    pool = pool.filter((piece) =>
      piece.id === 'idle_02' || piece.id === 'idle_03' || piece.id === 'idle_06',
    );
  }
  const bodyPiece = pickPiece(pool.length ? pool : IDLE_BODIES.filter((p) => p.id === 'idle_02'), input.recentIds, random);
  return {
    title: trimToLimit(localeText(IDLE_TITLE, input.locale, {}), TITLE_MAX),
    body: trimToLimit(localeText(bodyPiece, input.locale, input.vars), BODY_MAX),
    templateId: bodyPiece.id,
    cta: bodyPiece.id === 'idle_07' ? 'games' : 'learn',
  };
}

export function composeForSpeak(input: {
  speak: WeeklySpeakSegment;
  locale: WeeklyReportLocale;
  firstWeek: boolean;
  vars: WeeklyCopyVars;
  addon?: WeeklyAddon | null;
  recentIds: string[];
  random?: () => number;
}) {
  if (input.speak === 'active') return composeActive(input);
  if (input.speak === 'light') return composeLight(input);
  return composeIdleApp(input);
}
