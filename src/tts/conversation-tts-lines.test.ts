import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  collectConversationBankLines,
  collectFoundationConversationBankLines,
  foundationConversationIds,
  isCacheableConversationLine,
} from './conversation-tts-lines';

describe('conversation TTS bank lines', () => {
  const lines = collectConversationBankLines();

  it('includes the scripted opening and close, not the coaching', () => {
    assert.ok(lines.includes('Hi! Is this your student card?'));
    assert.ok(lines.includes('See you tomorrow!'));
    assert.ok(lines.includes("Hi! I'm Max. Nice to meet you."));
    assert.equal(lines.some((line) => line.startsWith('You are ')), false);
    assert.equal(lines.some((line) => line.includes('<')), false);
    assert.equal(isCacheableConversationLine('confirm'), false);
  });

  it('only keeps speakable lines', () => {
    for (const line of lines) {
      assert.equal(isCacheableConversationLine(line), true);
    }
    assert.ok(lines.length > 20);
  });

  it('keeps Foundation conversation lines separate from later courses', () => {
    assert.equal(foundationConversationIds().length, 14);
    const foundation = collectFoundationConversationBankLines();
    assert.ok(foundation.includes("Hi! I'm Max. Nice to meet you."));
    assert.ok(foundation.includes('See you tomorrow!'));
    assert.ok(foundation.length < lines.length);
  });
});