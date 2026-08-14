export type PushNotificationType =
  | 'first_banana'
  | 'streak_reminder'
  | 'miss_you';

export interface PushNotificationPayload {
  type: PushNotificationType;
  title: string;
  body: string;
  data?: Record<string, string>;
}

export const PUSH_NOTIFICATION_TEMPLATES: Record<
  PushNotificationType,
  Omit<PushNotificationPayload, 'type'>
> = {
  first_banana: {
    title: 'กล้วยมาแล้ว! 🍌',
    body: 'กล้วยของวันนี้มาส่งแล้วนะ!',
    data: { route: '/train' },
  },
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
  type: PushNotificationType,
): PushNotificationPayload {
  const template = PUSH_NOTIFICATION_TEMPLATES[type];
  return { type, ...template };
}
