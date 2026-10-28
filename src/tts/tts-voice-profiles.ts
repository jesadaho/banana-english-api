/**
 * Named TTS voice profiles. Clients pass a profile id (never a raw voice name)
 * so the server controls which Gemini voices / style prompts are used.
 */
export type TtsVoiceProfileId = 'teacher_b' | 'teacher_john' | 'teacher_minnie' | 'teacher_nina';

export const TTS_VOICE_PROFILE_IDS: TtsVoiceProfileId[] = [
  'teacher_b',
  'teacher_john',
  'teacher_minnie',
  'teacher_nina',
];

export interface TtsVoiceProfile {
  /** Gemini prebuilt voice name. null = server default (GEMINI_TTS_VOICE). */
  voice: string | null;
  /** Env var that can override `voice` without a deploy. */
  voiceEnv?: string;
  /** Style prompt prefixed to the text. null = default Teacher B prompt. */
  stylePrompt: string | null;
  /** BCP-47 language for device/Cloud TTS fallbacks on the client. */
  languageCode: string;
}

export const TTS_VOICE_PROFILES: Record<TtsVoiceProfileId, TtsVoiceProfile> = {
  teacher_b: {
    voice: null,
    stylePrompt: null,
    languageCode: 'th-TH',
  },
  teacher_john: {
    voice: 'Iapetus', // matches app GeminiTtsVoices.john
    voiceEnv: 'GEMINI_TTS_VOICE_JOHN',
    stylePrompt:
      'Speak clearly and warmly as Teacher John, a friendly native English teacher. ' +
      'Sound natural and encouraging. English only, native accent',
    languageCode: 'en-US',
  },
  teacher_minnie: {
    voice: 'Autonoe', // matches app GeminiTtsVoices.minnie
    voiceEnv: 'GEMINI_TTS_VOICE_MINNIE',
    stylePrompt:
      'Speak as Teacher Minnie, a young English teacher in her early twenties. ' +
      'Use a light, bright, slightly higher voice. Warm and encouraging. English only, native accent',
    languageCode: 'en-US',
  },
  teacher_nina: {
    voice: 'Zephyr', // matches app GeminiTtsVoices.nina
    voiceEnv: 'GEMINI_TTS_VOICE_NINA',
    stylePrompt:
      'Speak clearly and energetically as Teacher Nina, a friendly adventure English teacher. ' +
      'Sound bright, warm, and encouraging. English only, native accent',
    languageCode: 'en-US',
  },
};

export function isTtsVoiceProfileId(v: unknown): v is TtsVoiceProfileId {
  return typeof v === 'string' && (TTS_VOICE_PROFILE_IDS as string[]).includes(v);
}
