import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  CLIP_UNLOCK_TTL_MS,
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
  it('a held banana unlock is reused until it expires', () => {
    const fresh = { id: 'b', kind: 'banana', createdAt: new Date(now.getTime() - 1000) };
    const old = { id: 'o', kind: 'banana', createdAt: new Date(now.getTime() - CLIP_UNLOCK_TTL_MS - 1) };
    assert.equal(decideClipAccess({ ...base, existing: [fresh], token: 'b' }).status, 'unlocked');
    assert.equal(decideClipAccess({ ...base, existing: [fresh] }).status, 'locked');
    assert.equal(decideClipAccess({ ...base, existing: [old], token: 'o' }).status, 'locked');
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
