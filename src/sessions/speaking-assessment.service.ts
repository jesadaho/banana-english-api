import type { SimulationConfig } from '../simulations/simulations.data';
import type {
  GrammarStats,
  SpeakingMetricsPayload,
  SpeakingSkillBreakdown,
  SpeakingSkills,
  VocabularyStats,
} from '../common/api.types';

const FILLER_WORDS = new Set([
  'uh',
  'um',
  'er',
  'ah',
  'eh',
  'hmm',
  'please',
  'thanks',
  'thank',
  'you',
  'i',
  'me',
  'my',
  'a',
  'an',
  'the',
  'is',
  'are',
  'was',
  'were',
  'to',
  'for',
  'of',
  'in',
  'on',
  'at',
  'with',
  'would',
  'like',
  'want',
  'need',
  'can',
  'could',
  'should',
]);

const LOGPROB_THRESHOLD = -0.5;

export function mapRatioToScore(ratio: number): number {
  const r = Math.max(0, Math.min(1, ratio));
  if (r >= 0.9) return 5;
  if (r >= 0.8) return 4;
  if (r >= 0.7) return 3;
  if (r >= 0.6) return 2;
  return 1;
}

export function mapRecognitionRateToScore(rate: number): number {
  const pct = rate * 100;
  if (pct >= 95) return 5;
  if (pct >= 90) return 4.5;
  if (pct >= 85) return 4;
  if (pct >= 80) return 3.5;
  if (pct >= 70) return 3;
  if (pct >= 60) return 2.5;
  if (pct >= 50) return 2;
  return 1;
}

export function mapWpsToScore(wps: number): number {
  if (wps >= 2.2) return 5;
  if (wps >= 1.8) return 4;
  if (wps >= 1.4) return 3;
  if (wps >= 1.0) return 2;
  return 1;
}

export function mapLatencyMsToScore(avgMs: number): number {
  const sec = avgMs / 1000;
  if (sec < 1) return 5;
  if (sec < 2) return 4;
  if (sec < 3) return 3;
  if (sec < 5) return 2;
  return 1;
}

export function mapHintRateToScore(hintRate: number): number {
  const pct = hintRate * 100;
  if (pct === 0) return 5;
  if (pct <= 10) return 4.5;
  if (pct <= 25) return 4;
  if (pct <= 40) return 3;
  if (pct <= 60) return 2;
  return 1;
}

export function mapGrammarAccuracyToScore(accuracy: number): number {
  const pct = accuracy * 100;
  if (pct >= 90) return 5;
  if (pct >= 80) return 4;
  if (pct >= 70) return 3;
  if (pct >= 60) return 2;
  return 1;
}

export function roundSkill(value: number): number {
  return Math.round(value * 10) / 10;
}

function normalizeToken(word: string): string {
  return word.toLowerCase().replace(/[^a-z0-9'-]/g, '');
}

function isFiller(word: string): boolean {
  const n = normalizeToken(word);
  return !n || FILLER_WORDS.has(n);
}

function tokenizeContent(text: string): string[] {
  return text
    .toLowerCase()
    .split(/\s+/)
    .map(normalizeToken)
    .filter((w) => w && !FILLER_WORDS.has(w));
}

function weightedAverage(parts: Array<{ score: number; weight: number }>): number {
  const totalWeight = parts.reduce((sum, p) => sum + p.weight, 0);
  if (totalWeight <= 0) return 3;
  const value =
    parts.reduce((sum, p) => sum + p.score * p.weight, 0) / totalWeight;
  return roundSkill(value);
}

export function scorePronunciation(
  metrics: SpeakingMetricsPayload,
): { score: number; recognitionRate: number } {
  let eligible = 0;
  let recognized = 0;

  for (const turn of metrics.turns) {
    const misSet = new Set(
      (turn.mispronouncedWords ?? []).map((w) => normalizeToken(w)),
    );

    for (const sttWord of turn.sttWords ?? []) {
      const token = normalizeToken(sttWord.word);
      if (!token || isFiller(token)) continue;
      eligible++;
      const logprob = sttWord.segmentAvgLogprob;
      const okLogprob = logprob == null || logprob >= LOGPROB_THRESHOLD;
      const okMispronunciation = !misSet.has(token);
      if (okLogprob && okMispronunciation) recognized++;
    }

    if ((turn.sttWords ?? []).length === 0 && turn.transcript) {
      for (const token of tokenizeContent(turn.transcript)) {
        eligible++;
        if (!misSet.has(token)) recognized++;
      }
    }
  }

  const recognitionRate = eligible > 0 ? recognized / eligible : 0.75;
  return {
    recognitionRate,
    score: mapRecognitionRateToScore(recognitionRate),
  };
}

export function scoreFluency(
  metrics: SpeakingMetricsPayload,
  expectedPrompts: number,
): {
  score: number;
  breakdown: NonNullable<SpeakingSkillBreakdown['fluency']>;
} {
  const attemptedTurns = metrics.turns.filter((t) => t.attempted);
  const totalMicMs = attemptedTurns.reduce((sum, t) => sum + t.micDurationMs, 0);
  const totalWords = attemptedTurns.reduce((sum, t) => sum + t.wordCount, 0);
  const wps = totalMicMs > 0 ? totalWords / (totalMicMs / 1000) : 0;
  const continuityProxy = mapWpsToScore(wps);

  const latencySamples = metrics.turns
    .map((t) => t.responseLatencyMs)
    .filter((v): v is number => v != null && v >= 0);
  const avgLatency =
    latencySamples.length > 0
      ? latencySamples.reduce((a, b) => a + b, 0) / latencySamples.length
      : 2000;
  const responseLatency = mapLatencyMsToScore(avgLatency);

  const totalPrompts = Math.max(expectedPrompts, metrics.turns.length, 1);
  const completionRatio = attemptedTurns.length / totalPrompts;
  const completion = mapRatioToScore(completionRatio);

  const score = weightedAverage([
    { score: continuityProxy, weight: 0.4 },
    { score: responseLatency, weight: 0.3 },
    { score: completion, weight: 0.3 },
  ]);

  return {
    score,
    breakdown: {
      continuityProxy,
      responseLatency,
      completion,
      wps: roundSkill(wps),
    },
  };
}

export function scoreConfidence(
  metrics: SpeakingMetricsPayload,
  expectedPrompts: number,
): {
  score: number;
  breakdown: NonNullable<SpeakingSkillBreakdown['confidence']>;
} {
  const totalPrompts = Math.max(expectedPrompts, metrics.turns.length, 1);
  const hintsUsed = metrics.turns.filter((t) => t.usedHint).length;
  const attemptedTurns = metrics.turns.filter((t) => t.attempted).length;
  const hintRate = hintsUsed / totalPrompts;

  const hintIndependence = mapHintRateToScore(hintRate);
  const completionRatio = attemptedTurns / totalPrompts;
  const completion = mapRatioToScore(completionRatio);
  const attemptRate = mapRatioToScore(attemptedTurns / totalPrompts);

  const score = weightedAverage([
    { score: hintIndependence, weight: 0.4 },
    { score: completion, weight: 0.3 },
    { score: attemptRate, weight: 0.3 },
  ]);

  return {
    score,
    breakdown: {
      hintIndependence,
      completion,
      attemptRate,
      hintRate: roundSkill(hintRate),
    },
  };
}

export function scoreVariety(transcripts: string[]): number {
  const tokens = transcripts.flatMap(tokenizeContent);
  if (tokens.length === 0) return 3;
  const unique = new Set(tokens);
  const varietyRatio = unique.size / tokens.length;
  return mapRatioToScore(varietyRatio);
}

export function scoreVocabulary(
  transcripts: string[],
  vocabStats: VocabularyStats,
): {
  score: number;
  breakdown: NonNullable<SpeakingSkillBreakdown['vocabulary']>;
} {
  const variety = scoreVariety(transcripts);
  const denom = Math.max(vocabStats.content_word_count, 1);
  const relevance = mapRatioToScore(
    vocabStats.relevant_content_word_count / denom,
  );
  const specificity = mapRatioToScore(
    vocabStats.specific_content_word_count / denom,
  );

  const score = weightedAverage([
    { score: variety, weight: 0.3 },
    { score: relevance, weight: 0.4 },
    { score: specificity, weight: 0.3 },
  ]);

  return {
    score,
    breakdown: { variety, relevance, specificity },
  };
}

export function scoreGrammar(stats: GrammarStats): number {
  const sentences = Math.max(stats.sentence_count, 1);
  const accuracy = 1 - stats.grammar_errors / sentences;
  return mapGrammarAccuracyToScore(Math.max(0, accuracy));
}

export interface SpeakingAssessmentResult {
  speakingSkills: SpeakingSkills;
  speakingSkillBreakdown: SpeakingSkillBreakdown;
}

export function computeSpeakingAssessment(params: {
  metrics: SpeakingMetricsPayload;
  simulationConfig: SimulationConfig;
  grammarStats: GrammarStats;
  vocabularyStats: VocabularyStats;
}): SpeakingAssessmentResult {
  const { metrics, simulationConfig, grammarStats, vocabularyStats } = params;
  const expectedPrompts = simulationConfig.successCriteria.length;
  const transcripts = metrics.turns
    .map((t) => t.transcript ?? '')
    .filter((t) => t.trim().length > 0);

  const pronunciation = scorePronunciation(metrics);
  const fluency = scoreFluency(metrics, expectedPrompts);
  const confidence = scoreConfidence(metrics, expectedPrompts);
  const vocabulary = scoreVocabulary(transcripts, vocabularyStats);
  const grammar = scoreGrammar(grammarStats);

  return {
    speakingSkills: {
      pronunciation: pronunciation.score,
      fluency: fluency.score,
      confidence: confidence.score,
      vocabulary: vocabulary.score,
      grammar,
    },
    speakingSkillBreakdown: {
      pronunciation: {
        recognitionRate: roundSkill(pronunciation.recognitionRate),
      },
      fluency: fluency.breakdown,
      confidence: confidence.breakdown,
      vocabulary: vocabulary.breakdown,
    },
  };
}
