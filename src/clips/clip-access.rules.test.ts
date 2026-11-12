import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  decideClipAccess,
  lockEnabledFrom,
  wordAccessAllowed,
} from './clip-access.rules';

const now = new Date('2026-11-11T10:00:00Z');
const base = {
  lockEnabled: true,
  proMax: false,
  existing: [],
  freeUsed: 3,
  balance: 5,
  spend: false,
  now,
};

describe('decideClipAccess', () => {
  it('lock off / Pro Max → unlocked', () => {
    assert.equal(decideClipAccess({ ...base, lockEnabled: false }).status, 'unlocked');
    assert.deepEqual(decideClipAccess({ ...base, proMax: true }), {
      status: 'unlocked',
      kind: 'pro_max',
    });
  });
  it('first 3 clips are free; a free clip stays free', () => {
    assert.equal(decideClipAccess({ ...base, freeUsed: 2 }).status, 'create_free');
    const d = decideClipAccess({
      ...base,
      existing: [{ id: 'f', kind: 'free', createdAt: new Date(0) }],
    });
    assert.deepEqual(d, { status: 'unlocked', kind: 'free', reuseUnlockId: 'f' });
  });
  it('locked → spend only when asked; not enough bananas → insufficient', () => {
    assert.equal(decideClipAccess(base).status, 'locked');
    assert.equal(decideClipAccess({ ...base, spend: true }).status, 'spend');
    assert.equal(decideClipAccess({ ...base, balance: 1, spend: true }).status, 'insufficient');
    assert.equal(decideClipAccess({ ...base, balance: 1 }).status, 'insufficient');
  });
  it('a banana unlock lasts the rest of the Bangkok day', () => {
    // now = 17:00 Bangkok; paid 09:00 Bangkok today vs 23:00 Bangkok yesterday.
    const today = { id: 'b', kind: 'banana', createdAt: new Date('2026-11-11T02:00:00Z') };
    const yesterday = { id: 'y', kind: 'banana', createdAt: new Date('2026-11-10T16:00:00Z') };
    assert.equal(decideClipAccess({ ...base, existing: [today] }).status, 'unlocked');
    assert.equal(decideClipAccess({ ...base, existing: [yesterday] }).status, 'locked');
  });
});

describe('wordAccessAllowed', () => {
  it('needs a valid unlock when the lock is on', () => {
    assert.equal(wordAccessAllowed({ ...base }), false);
    assert.equal(wordAccessAllowed({ ...base, lockEnabled: false }), true);
    assert.equal(
      wordAccessAllowed({
        ...base,
        token: 'b',
        existing: [{ id: 'b', kind: 'banana', createdAt: now }],
      }),
      true,
    );
  });
});

describe('lockEnabledFrom', () => {
  it('reads the RC string', () => {
    assert.equal(lockEnabledFrom({ clips_lock_enabled: 'true' }), true);
    assert.equal(lockEnabledFrom({ clips_lock_enabled: 'false' }), false);
    assert.equal(lockEnabledFrom(null), false);
  });
});
