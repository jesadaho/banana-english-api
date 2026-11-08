/** Booked Live Talk sessions (Official Host web /host). Pure rules. */

export const LIVE_TALK_SESSION_DURATIONS = [30, 45, 60, 90, 120] as const;
/** Book at least this far ahead. */
export const LIVE_TALK_SESSION_MIN_LEAD_MS = 5 * 60 * 1000;
/** And at most this far ahead. */
export const LIVE_TALK_SESSION_MAX_AHEAD_MS = 60 * 24 * 60 * 60 * 1000;
export const LIVE_TALK_SESSION_TITLE_MAX = 50;
export const LIVE_TALK_SESSION_DESCRIPTION_MAX = 160;
/** Upcoming list may still show a session this long after it started. */
export const LIVE_TALK_SESSION_LONGEST_MS = 120 * 60 * 1000;

export type LiveTalkSessionSlot = {
  id?: string;
  startsAt: Date;
  durationMin: number;
};

export function sessionEndsAt(slot: LiveTalkSessionSlot): Date {
  return new Date(slot.startsAt.getTime() + slot.durationMin * 60 * 1000);
}

/** Half-open intervals: back-to-back sessions (one ends 20:00, next starts 20:00) are fine. */
export function sessionsOverlap(a: LiveTalkSessionSlot, b: LiveTalkSessionSlot): boolean {
  return (
    a.startsAt.getTime() < sessionEndsAt(b).getTime() &&
    b.startsAt.getTime() < sessionEndsAt(a).getTime()
  );
}

export function findSessionClash<T extends LiveTalkSessionSlot>(
  slot: LiveTalkSessionSlot,
  others: T[],
): T | null {
  for (const other of others) {
    if (slot.id && other.id === slot.id) continue;
    if (sessionsOverlap(slot, other)) return other;
  }
  return null;
}

export type SessionInput = {
  startsAt?: unknown;
  durationMin?: unknown;
  title?: unknown;
  description?: unknown;
};

export type ParsedSessionInput = {
  startsAt: Date;
  durationMin: number;
  title: string;
  description: string;
};

/** Returns the cleaned input, or an error code for the web page. */
export function parseSessionInput(
  input: SessionInput,
  now = new Date(),
): { ok: true; value: ParsedSessionInput } | { ok: false; error: string } {
  const startsAt =
    typeof input.startsAt === 'string' || typeof input.startsAt === 'number'
      ? new Date(input.startsAt)
      : null;
  if (!startsAt || Number.isNaN(startsAt.getTime())) {
    return { ok: false, error: 'startsAt_invalid' };
  }
  const durationMin = Number(input.durationMin ?? 60);
  if (!(LIVE_TALK_SESSION_DURATIONS as readonly number[]).includes(durationMin)) {
    return { ok: false, error: 'duration_invalid' };
  }
  const lead = startsAt.getTime() - now.getTime();
  if (lead < LIVE_TALK_SESSION_MIN_LEAD_MS) {
    return { ok: false, error: 'starts_too_soon' };
  }
  if (lead > LIVE_TALK_SESSION_MAX_AHEAD_MS) {
    return { ok: false, error: 'starts_too_far' };
  }
  const title = typeof input.title === 'string' ? input.title.trim() : '';
  if (!title) return { ok: false, error: 'title_required' };
  const description =
    typeof input.description === 'string' ? input.description.trim() : '';
  return {
    ok: true,
    value: {
      startsAt,
      durationMin,
      title: title.slice(0, LIVE_TALK_SESSION_TITLE_MAX),
      description: description.slice(0, LIVE_TALK_SESSION_DESCRIPTION_MAX),
    },
  };
}

/** Who may book: Official Hosts and community admins. */
export function canBookLiveTalkSession(user: {
  hostLevel?: string | null;
  communityAdmin?: boolean | null;
}): boolean {
  return user.communityAdmin === true || user.hostLevel === 'official';
}
