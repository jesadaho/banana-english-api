/** Word bank for Foundation V7 Word Beats (syllable intro). */
export type SyllableWord = {
  word: string;
  syllableCount: 1 | 2;
  segments: string[];
  /** Future: normal spoken clip. */
  normalAudio?: string;
  /** Future: lightly paused segments; still natural speech. */
  segmentedAudio?: string;
};

export const FND_V7_SYLLABLE_WORDS: Record<string, SyllableWord> = {
  book: { word: 'book', syllableCount: 1, segments: ['book'] },
  bag: { word: 'bag', syllableCount: 1, segments: ['bag'] },
  pen: { word: 'pen', syllableCount: 1, segments: ['pen'] },
  apple: { word: 'apple', syllableCount: 2, segments: ['ap', 'ple'] },
  teacher: { word: 'teacher', syllableCount: 2, segments: ['tea', 'cher'] },
  doctor: { word: 'doctor', syllableCount: 2, segments: ['doc', 'tor'] },
  student: { word: 'student', syllableCount: 2, segments: ['stu', 'dent'] },
};
