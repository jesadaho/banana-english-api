import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { hashNotifyAskArm, notifyAskArmFor, parseNotifyAskAbSettings } from './notify-ask-ab';

describe('notify-ask A/B', () => {
  const on = parseNotifyAskAbSettings('', '2026-11-25T00:00:00+07:00');
  const after = new Date('2026-11-26T00:00:00Z');

  it('splits about 50/50 and is stable', () => {
    let a = 0;
    for (let i = 0; i < 2000; i++) if (hashNotifyAskArm(`u${i}`) === 'A') a++;
    assert.ok(a > 900 && a < 1100, `A=${a}`);
    assert.equal(hashNotifyAskArm('x'), hashNotifyAskArm('x'));
  });

  it('only new users join; stored arm wins; off stops new joins', () => {
    assert.equal(notifyAskArmFor({ id: 'x', createdAt: new Date('2026-11-01') }, on), null);
    assert.ok(notifyAskArmFor({ id: 'x', createdAt: after }, on));
    assert.equal(notifyAskArmFor({ id: 'x', createdAt: after, notifyAskArm: 'B' }, on), 'B');
    const off = parseNotifyAskAbSettings('off');
    assert.equal(notifyAskArmFor({ id: 'x', createdAt: after }, off), null);
    assert.equal(notifyAskArmFor({ id: 'x', createdAt: after, notifyAskArm: 'A' }, off), 'A');
  });
});
