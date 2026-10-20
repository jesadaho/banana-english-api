import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  formatAiServiceUserMessage,
  isGeminiBillingError,
} from './ai-user-message';

describe('gemini billing errors', () => {
  const prepaid = `Gemini API failed (402): {
  "error": {
    "code": 402,
    "message": "Your prepaid credits are depleted.",
    "status": "RESOURCE_EXHAUSTED"
  }
}`;

  it('detects prepaid 402', () => {
    assert.equal(isGeminiBillingError(new Error(prepaid)), true);
    assert.equal(isGeminiBillingError(new Error('Gemini API failed (503): busy')), false);
  });

  it('does not leak the 402 payload to learners', () => {
    const message = formatAiServiceUserMessage(new Error(prepaid));
    assert.equal(message.includes('402'), false);
    assert.equal(message.includes('prepaid'), false);
    assert.match(message, /ลองใหม่อีกครั้ง/);
  });
});
