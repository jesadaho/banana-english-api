import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { SpeakingMetricsPayload } from '../common/api.types';
import {
  mapHintRateToScore,
  mapRatioToScore,
  mapRecognitionRateToScore,
  mapWpsToScore,
  scoreConfidence,
  scoreFluency,
  scoreGrammar,
  scorePronunciation,
  scoreVariety,
  scoreVocabulary,
} from './speaking-assessment.service';

describe('speaking-assessment mappers', () => {
  it('maps hint rate: 1/10 → 4.5, 1/3 → 3', () => {
    assert.equal(mapHintRateToScore(0.1), 4.5);
    assert.equal(mapHintRateToScore(1 / 3), 3);
  });

  it('maps WPS bands', () => {
    assert.equal(mapWpsToScore(2.3), 5);
    assert.equal(mapWpsToScore(1.9), 4);
    assert.equal(mapWpsToScore(0.8), 1);
  });

  it('drops variety for repeated coffee words', () => {
    const score = scoreVariety([
      'I want coffee. Coffee with milk. Coffee, please.',
    ]);
    assert.ok(score <= 2.5);
  });

  it('scores vocabulary from AI counts (not raw AI score)', () => {
    const { score, breakdown } = scoreVocabulary(
      ["I'd like an iced latte with less sugar, please."],
      {
        content_word_count: 8,
        relevant_content_word_count: 7,
        specific_content_word_count: 6,
        repetition_count: 0,
      },
    );
    assert.ok(breakdown.relevance >= 4);
    assert.ok(score >= 3.5);
  });

  it('grammar accuracy maps to score bands', () => {
    assert.equal(scoreGrammar({ grammar_errors: 0, sentence_count: 5 }), 5);
    assert.equal(scoreGrammar({ grammar_errors: 2, sentence_count: 10 }), 4);
  });

  it('pronunciation uses STT logprob + mispronunciation flags', () => {
    const metrics: SpeakingMetricsPayload = {
      turns: [
        {
          micDurationMs: 2000,
          wordCount: 3,
          usedHint: false,
          attempted: true,
          transcript: 'iced latte please',
          sttWords: [
            { word: 'iced', segmentAvgLogprob: -0.2 },
            { word: 'latte', segmentAvgLogprob: -0.3 },
            { word: 'please', segmentAvgLogprob: -0.1 },
          ],
          mispronouncedWords: [],
        },
      ],
    };
    const result = scorePronunciation(metrics);
    assert.ok(result.recognitionRate >= 0.9);
    assert.ok(result.score >= 4);
  });

  it('confidence: unaided response rate 6/8 prompts → 75%', () => {
    const metrics: SpeakingMetricsPayload = {
      turns: [
        ...Array.from({ length: 6 }, () => ({
          micDurationMs: 2000,
          wordCount: 5,
          usedHint: false,
          attempted: true,
          responseLatencyMs: 900,
        })),
        ...Array.from({ length: 2 }, () => ({
          micDurationMs: 1500,
          wordCount: 8,
          usedHint: true,
          attempted: true,
          responseLatencyMs: 1100,
        })),
      ],
    };
    const { breakdown } = scoreConfidence(metrics, 8);
    assert.equal(breakdown.unaidedResponseRate, 0.75);
    assert.equal(breakdown.unaidedResponse, 3);
    assert.ok(breakdown.hintIndependence >= 4);
  });

  it('confidence separates completion from unaided response (8 attempted, 4 hint)', () => {
    const metrics: SpeakingMetricsPayload = {
      turns: Array.from({ length: 8 }, (_, i) => ({
        micDurationMs: 2000,
        wordCount: i % 2 === 0 ? 6 : 8,
        usedHint: i % 2 === 1,
        attempted: true,
        responseLatencyMs: 1000,
      })),
    };
    const fluency = scoreFluency(metrics, 8);
    const confidence = scoreConfidence(metrics, 8);
    assert.equal(confidence.breakdown.unaidedResponseRate, 0.5);
    assert.ok(fluency.breakdown.completion >= 4);
    assert.ok(confidence.breakdown.unaidedResponse <= 3);
  });

  it('fluency completion uses expected prompt count', () => {
    const metrics: SpeakingMetricsPayload = {
      turns: [
        {
          micDurationMs: 3000,
          wordCount: 6,
          usedHint: false,
          attempted: true,
          responseLatencyMs: 800,
        },
        {
          micDurationMs: 2500,
          wordCount: 5,
          usedHint: false,
          attempted: true,
          responseLatencyMs: 1200,
        },
      ],
    };
    const fluency = scoreFluency(metrics, 3);
    const confidence = scoreConfidence(metrics, 3);
    assert.ok(fluency.score >= 3);
    assert.ok(confidence.breakdown.hintIndependence >= 4.5);
  });

  it('mapRatioToScore handles edge ratios', () => {
    assert.equal(mapRatioToScore(0.95), 5);
    assert.equal(mapRecognitionRateToScore(0.91), 4.5);
  });
});
