import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ConfigService } from '@nestjs/config';
import { TelegramNotifier } from './telegram.notifier';

describe('TelegramNotifier', () => {
  it('no-ops when env is missing', async () => {
    const config = {
      get: () => undefined,
    } as unknown as ConfigService;
    const notifier = new TelegramNotifier(config);
    // Must not throw even without a global fetch mock.
    notifier.notifyPurchase({ kind: 'pro', userId: 'u1' });
    await new Promise((r) => setTimeout(r, 20));
    assert.ok(true);
  });
});
