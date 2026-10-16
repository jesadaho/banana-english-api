/**
 * Conversation NPC voices. Keep these strings identical to the app's
 * GeminiTtsVoices and TtsStylePrompt so a cached clip matches live TTS.
 */
export interface ConversationVoice {
  speaker: string;
  voice: string;
  prompt: string;
}

const MAX_PROMPT =
  'Speak as Max, a cheerful boy about 10 to 13 years old. Use a lighter, higher voice than a teenager. Clear and friendly.';

const MAY_PROMPT =
  'Speak as May, a cheerful girl about 10 or 11 years old. Use a lighter, higher voice than a teenager. Clear and friendly.';

function characterPrompt(name: string): string {
  return (
    `Speak naturally as ${name}, a friendly character in this English ` +
    'practice conversation. Sound warm, casual, and clear.'
  );
}

const VOICES: Record<string, Omit<ConversationVoice, 'speaker'>> = {
  Max: { voice: 'Achird', prompt: MAX_PROMPT },
  May: { voice: 'Leda', prompt: MAY_PROMPT },
  Mali: { voice: 'Callirrhoe', prompt: characterPrompt('Mali') },
  John: { voice: 'Iapetus', prompt: characterPrompt('John') },
  Minnie: { voice: 'Aoede', prompt: characterPrompt('Minnie') },
  Nina: { voice: 'Zephyr', prompt: characterPrompt('Nina') },
  Bogy: { voice: 'Puck', prompt: characterPrompt('Bogy') },
  'Teacher Bee': { voice: 'Sadachbia', prompt: characterPrompt('Teacher Bee') },
};

/** Speaker for each conversation currently on the Foundation or A2 path. */
const SPEAKERS: Record<string, string> = {
  foundation_first_conversation: 'Max',
  foundation_v7_u02n04: 'John',
  foundation_v7_u03n06: 'Max',
  foundation_v7_u04n06: 'Max',
  foundation_v7_u06n08: 'Mali',
  foundation_v7_u07n07: 'Max',
  foundation_v7_u08n10: 'John',
  foundation_v7_u09n09: 'Mali',
  foundation_v7_u10n07: 'Minnie',
  foundation_v7_u11n06: 'Max',
  foundation_v7_u12n08: 'Max',
  foundation_v7_u13n06: 'May',
  foundation_v7_u14n15: 'Mali',
  foundation_v7_u14tn21: 'Mali',
  a2_c01n09: 'Nina',
  a2_c02n12: 'Nina',
  a2_c03n11: 'May',
  a2_c04n10: 'Nina',
  a2_c05n10: 'Bogy',
  a2_c06n11: 'Teacher Bee',
  a2_c07n11: 'May',
};

export function conversationSimulationIds(): string[] {
  return Object.keys(SPEAKERS);
}

export function conversationVoiceFor(
  simulationId: string,
): ConversationVoice | null {
  const speaker = SPEAKERS[simulationId];
  const voice = speaker ? VOICES[speaker] : undefined;
  if (!speaker || !voice) return null;
  return { speaker, voice: voice.voice, prompt: voice.prompt };
}
