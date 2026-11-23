import { createHash } from 'node:crypto';

/**
 * A/B test: when we first ask to turn on notifications (same v3 screen).
 *   A = right after the Teacher Bee placement chat (onboarding)
 *   B = on the path after the first finished lesson (a Lesson node, not a game)
 * Both arms ask at most twice; the second ask is after a lesson on a later day.
 * New users from the start time are split 50/50 by a stable hash of their id;
 * the arm is stored on the user the first time the app asks for it.
 *
 * Env: NOTIFY_ASK_AB=off stops new assignments (app falls back to A);
 * NOTIFY_ASK_AB_START=<ISO time>.
 */
export const NOTIFY_ASK_EXPERIMENT = 'notify_ask_2026_11';
export const ENV_NOTIFY_ASK_AB = 'NOTIFY_ASK_AB';
export const ENV_NOTIFY_ASK_AB_START = 'NOTIFY_ASK_AB_START';
export const DEFAULT_NOTIFY_ASK_AB_START = '2026-11-25T00:00:00+07:00';

export type NotifyAskArm = 'A' | 'B';

export const NOTIFY_ASK_ARMS: Record<NotifyAskArm, string> = {
  A: 'After the placement chat',
  B: 'After the first lesson',
};

export type NotifyAskAbSettings = { enabled: boolean; start: Date };

export function parseNotifyAskAbSettings(
  enabledRaw?: string | null,
  startRaw?: string | null,
): NotifyAskAbSettings {
  const flag = (enabledRaw ?? '').trim().toLowerCase();
  const enabled = !['off', '0', 'false', 'no'].includes(flag);
  const parsed = new Date((startRaw ?? '').trim() || DEFAULT_NOTIFY_ASK_AB_START);
  const start = Number.isNaN(parsed.getTime()) ? new Date(DEFAULT_NOTIFY_ASK_AB_START) : parsed;
  return { enabled, start };
}

export function hashNotifyAskArm(userId: string): NotifyAskArm {
  const byte = createHash('sha256').update(`${NOTIFY_ASK_EXPERIMENT}:${userId}`).digest()[0]!;
  return byte % 2 === 0 ? 'A' : 'B';
}

/** Stored arm first; else a new one for users created after the start; null = not in the test. */
export function notifyAskArmFor(
  user: { id: string; createdAt: Date; notifyAskArm?: string | null },
  settings: NotifyAskAbSettings,
): NotifyAskArm | null {
  if (user.notifyAskArm === 'A' || user.notifyAskArm === 'B') return user.notifyAskArm;
  if (!settings.enabled || user.createdAt < settings.start) return null;
  return hashNotifyAskArm(user.id);
}
