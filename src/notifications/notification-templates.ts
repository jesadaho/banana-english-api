export type PushNotificationType =
  | 'banana_full'
  | 'streak_reminder'
  | 'miss_you'
  | 'bug_report_reply';

export interface PushNotificationPayload {
  type: PushNotificationType;
  title: string;
  body: string;
  data?: Record<string, string>;
}

type PushTemplate = Omit<PushNotificationPayload, 'type'>;

/** One is picked at random per send. */
export const BANANA_FULL_VARIANTS: PushTemplate[] = [
  { title: '🍌 กล้วยครบ 5 ลูกแล้ว!', body: 'มาฝึกพูดต่อกันนะ', data: { route: '/train' } },
  { title: '🍌 กล้วยเต็มแล้ว!', body: 'พักไถฟีด แล้วมาสปีคสักบทปะ 👀', data: { route: '/train' } },
  { title: '🍌 กล้วยเต็มแล้ว!', body: 'ครูบีพร้อมแล้ว ขาดแค่เธอ 🎤', data: { route: '/train' } },
];

export const PUSH_NOTIFICATION_TEMPLATES: Record<
  Exclude<PushNotificationType, 'bug_report_reply' | 'banana_full'>,
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
  type: Exclude<PushNotificationType, 'bug_report_reply'>,
): PushNotificationPayload {
  const template =
    type === 'banana_full'
      ? BANANA_FULL_VARIANTS[Math.floor(Math.random() * BANANA_FULL_VARIANTS.length)]
      : PUSH_NOTIFICATION_TEMPLATES[type];
  return { type, ...template };
}
