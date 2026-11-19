/** Voice / Banana Original audio clips need this app build or newer. */
export const AUDIO_CLIPS_MIN_APP_VERSION = '1.0.325';

function parseAppVersion(raw?: string | null): [number, number, number] {
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(raw ?? '');
  if (!match) return [0, 0, 0];
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function compareAppVersion(a: string, b: string): number {
  const left = parseAppVersion(a);
  const right = parseAppVersion(b);
  for (let i = 0; i < 3; i += 1) {
    if (left[i]! !== right[i]!) return left[i]! - right[i]!;
  }
  return 0;
}

/** Old / headerless clients must not see source=audio clips. */
export function appSupportsAudioClips(version?: string | null): boolean {
  if (!version) return false;
  if (!/^\d+\.\d+\.\d+/.test(version)) return false;
  return compareAppVersion(version, AUDIO_CLIPS_MIN_APP_VERSION) >= 0;
}
