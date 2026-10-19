export type PushNotificationType =
  | 'banana_full'
  | 'streak_reminder'
  | 'miss_you'
  | 'bug_report_reply'
  | 'referral_reward'
  | 'daily_practice';

export type ReminderSlot = 'morning' | 'noon' | 'evening';

export const REMINDER_SLOT_HOUR: Record<ReminderSlot, number> = {
  morning: 8,
  noon: 12,
  evening: 20,
};

export interface PushNotificationPayload {
  type: PushNotificationType;
  title: string;
  body: string;
  data?: Record<string, string>;
}

type PushTemplate = Omit<PushNotificationPayload, 'type'>;

export interface DailyPracticeTemplate extends PushTemplate {
  id: string;
  pool: 'core' | 'morning' | 'evening';
}

const ROUTE_HOME = { route: '/' };

/** One is picked at random per send. */
export const BANANA_FULL_VARIANTS: PushTemplate[] = [
  { title: '🍌 กล้วยครบ 5 ลูกแล้ว!', body: 'มาฝึกพูดต่อกันนะ', data: { route: '/train' } },
  { title: '🍌 กล้วยเต็มแล้ว!', body: 'พักไถฟีด แล้วมาสปีคสักบทปะ 👀', data: { route: '/train' } },
  { title: '🍌 กล้วยเต็มแล้ว!', body: 'ครูบีพร้อมแล้ว ขาดแค่เธอ 🎤', data: { route: '/train' } },
];

export const DAILY_PRACTICE_CORE: DailyPracticeTemplate[] = [
  { id: '01', pool: 'core', title: 'ครูบีรอจนกล้วยจะสุกแล้ว 🍌', body: 'วันนี้ยังไม่ได้คุยกันเลย มาหน่อยยย', data: ROUTE_HOME },
  { id: '02', pool: 'core', title: 'วันนี้พูดอังกฤษยังงง 👀', body: 'แค่ 5 นาทีเอง มาฝึกกันหน่อย!', data: ROUTE_HOME },
  { id: '03', pool: 'core', title: 'แก เรามีเรื่องต้องคุยกัน 💬', body: 'เป็นภาษาอังกฤษอะ พร้อมยัง?', data: ROUTE_HOME },
  { id: '04', pool: 'core', title: 'ขอเวลาหน่อยยย 🥹', body: 'แค่ 5 นาที ครูบีมีเรื่องอยากคุยด้วย', data: ROUTE_HOME },
  { id: '05', pool: 'core', title: "English o'clock! ⏰", body: 'ถึงเวลานัดเมาท์กับครูบีแล้ว', data: ROUTE_HOME },
  { id: '06', pool: 'core', title: 'ฮัลโหลลล ได้ยินไหม 🎤', body: 'ครูบีรอฟังเสียงภาษาอังกฤษของเธออยู่', data: ROUTE_HOME },
  { id: '07', pool: 'core', title: 'วันนี้ขอหนึ่งบทได้ป่ะ 🍌', body: 'ไม่ต้องเก่งมาก แค่เริ่มพูดก็พอ', data: ROUTE_HOME },
  { id: '08', pool: 'core', title: 'Bestie, we need to talk! 💛', body: 'มาฝึกพูดอังกฤษกันหน่อย คิดถึงแล้ว', data: ROUTE_HOME },
  { id: '09', pool: 'core', title: 'ครูบีมีชาเลนจ์มาให้ ✨', body: 'วันนี้ลองพูดประโยคใหม่กันไหม', data: ROUTE_HOME },
  { id: '10', pool: 'core', title: 'กล้วยพร้อม ครูพร้อม 🍌', body: 'เหลือแค่เธอแล้ว มาเริ่มกัน!', data: ROUTE_HOME },
  { id: '11', pool: 'core', title: '5 นาที เปลี่ยนอะไรได้บ้าง? 👀', body: 'ลองมาฝึกพูดกับครูบี แล้วดูกัน', data: ROUTE_HOME },
  { id: '12', pool: 'core', title: 'แวะมาหากันหน่อยสิ 💛', body: 'วันนี้มาฝึกพูดอังกฤษด้วยกันนะ', data: ROUTE_HOME },
  { id: '13', pool: 'core', title: 'พูดผิดได้ ไม่โดนหักคะแนนใจ 💛', body: 'ครูบีอยู่ตรงนี้ มาลองพูดกัน', data: ROUTE_HOME },
  { id: '14', pool: 'core', title: 'วันนี้มาอัปสกิลกัน ✨', body: 'พูดอีกนิด มั่นใจขึ้นอีกหน่อย', data: ROUTE_HOME },
  { id: '15', pool: 'core', title: 'คนเก่งหายไปไหนนน 👀', body: 'ครูบีเตรียมบทสนทนาไว้รอแล้ว', data: ROUTE_HOME },
  { id: '16', pool: 'core', title: 'ไม่ต้องเป๊ะก็ปังได้ ✨', body: 'ภาษาอังกฤษเริ่มจากกล้าพูดนี่แหละ', data: ROUTE_HOME },
  { id: '17', pool: 'core', title: 'Hey bestie! 🍌', body: 'วันนี้มาฝึก Speaking กันสักนิดไหม', data: ROUTE_HOME },
  { id: '18', pool: 'core', title: 'ครูบีขอจองตัว 5 นาที 💛', body: 'มาฝึกพูดด้วยกันก่อน แล้วค่อยไปลุยต่อ', data: ROUTE_HOME },
  { id: '19', pool: 'core', title: 'Ready, set, speak! 🎤', body: 'วันนี้มาลองพูดให้คล่องขึ้นอีกนิด', data: ROUTE_HOME },
  { id: '20', pool: 'core', title: 'มีนัดกับกล้วยหนึ่งลูก 🍌', body: 'ครูบีพร้อมแล้ว มาเริ่มบทเรียนกัน', data: ROUTE_HOME },
];

export const DAILY_PRACTICE_MORNING: DailyPracticeTemplate[] = [
  { id: '21', pool: 'morning', title: 'Good morning, bestie! 💛', body: 'วันนี้ครูบีมีอะไรสนุก ๆ ให้ลองพูดด้วยนะ', data: ROUTE_HOME },
  { id: '22', pool: 'morning', title: 'วันใหม่ สกิลใหม่ ✨', body: 'อัปสกิล Speaking ก่อนเริ่มวันกันหน่อย', data: ROUTE_HOME },
  { id: '23', pool: 'morning', title: 'ตื่นยังงง ☀️', body: 'มาปลุกสกิลภาษาอังกฤษกันสัก 5 นาที', data: ROUTE_HOME },
  { id: '24', pool: 'morning', title: 'เช้านี้ขอหนึ่งบท 🍌', body: 'เริ่มวันด้วยความมั่นใจไปด้วยกัน', data: ROUTE_HOME },
  { id: '25', pool: 'morning', title: 'Hello, sunshine! 🌞', body: 'วันนี้มาฝึกพูดประโยคใหม่กันเถอะ', data: ROUTE_HOME },
];

export const DAILY_PRACTICE_EVENING: DailyPracticeTemplate[] = [
  { id: '26', pool: 'evening', title: 'คืนนี้ขอ 5 นาที 🌙', body: 'ไม่ต้องเป๊ะ แค่กล้าพูดก็เริ่มเก่งแล้ว', data: ROUTE_HOME },
  { id: '27', pool: 'evening', title: 'ก่อนนอนขอหนึ่งบท ✨', body: 'มาเก็บสกิลภาษาอังกฤษกันอีกนิด', data: ROUTE_HOME },
  { id: '28', pool: 'evening', title: 'วันนี้เหนื่อยไหม 💛', body: 'มาคุยภาษาอังกฤษเบา ๆ กับครูบีกัน', data: ROUTE_HOME },
  { id: '29', pool: 'evening', title: 'ยังไม่นอนใช่ม้า 👀', body: 'ครูบีมีบทสนทนาสั้น ๆ รออยู่', data: ROUTE_HOME },
  { id: '30', pool: 'evening', title: 'ปิดวันแบบคนเก่ง 🌙', body: 'ฝึกพูดอีกนิด แล้วพักผ่อนให้เต็มที่', data: ROUTE_HOME },
];

export function poolForReminderSlot(
  slot: ReminderSlot,
): DailyPracticeTemplate[] {
  if (slot === 'morning') return [...DAILY_PRACTICE_CORE, ...DAILY_PRACTICE_MORNING];
  if (slot === 'evening') return [...DAILY_PRACTICE_CORE, ...DAILY_PRACTICE_EVENING];
  return [...DAILY_PRACTICE_CORE];
}

/** Random copy; skip the last 7 template ids when possible. */
export function pickDailyPracticeTemplate(
  slot: ReminderSlot,
  recentIds: string[],
  random = Math.random,
): DailyPracticeTemplate {
  const pool = poolForReminderSlot(slot);
  const avoid = new Set(recentIds.slice(-7));
  const fresh = pool.filter((item) => !avoid.has(item.id));
  const from = fresh.length > 0 ? fresh : pool;
  return from[Math.floor(random() * from.length)]!;
}

export function rememberDailyPracticeTemplate(
  recentIds: string[],
  id: string,
): string[] {
  return [...recentIds, id].slice(-7);
}

export const PUSH_NOTIFICATION_TEMPLATES: Record<
  Exclude<
    PushNotificationType,
    'bug_report_reply' | 'banana_full' | 'referral_reward' | 'daily_practice'
  >,
  PushTemplate
> = {
  streak_reminder: {
    title: '🔥 Streak',
    body: 'อย่าให้ Streak หลุดนะ ครูพี่บีรออยู่ 🍌',
    data: { route: '/train' },
  },
  miss_you: {
    title: '😊 หายไปหลายวันเลย',
    body: 'ครูพี่บีคิดถึงนะ มาคุยกันไหม',
    data: { route: '/learn/free-talk' },
  },
};

export function pushPayloadForType(
  type: Exclude<
    PushNotificationType,
    'bug_report_reply' | 'referral_reward' | 'daily_practice'
  >,
): PushNotificationPayload {
  const template =
    type === 'banana_full'
      ? BANANA_FULL_VARIANTS[Math.floor(Math.random() * BANANA_FULL_VARIANTS.length)]
      : PUSH_NOTIFICATION_TEMPLATES[type];
  return { type, ...template };
}

export function isReminderSlot(value: string | null | undefined): value is ReminderSlot {
  return value === 'morning' || value === 'noon' || value === 'evening';
}
