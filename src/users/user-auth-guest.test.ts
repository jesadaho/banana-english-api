import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ConflictException } from '@nestjs/common';
import { UserAuthService } from './user-auth.service';

describe('UserAuthService guest IAP bind', () => {
  it('treats users without Google/Apple as guests even with firebaseUid', async () => {
    const user = { id: 'u1', firebaseUid: 'anon-1', email: null } as any;
    const service = new UserAuthService(
      {} as any,
      {
        userAuthProvider: {
          findMany: async () => [],
        },
      } as any,
      {} as any,
    );
    const status = await service.getAuthStatus(user);
    assert.equal(status.isGuest, true);
    assert.deepEqual(status.providers, []);
  });

  it('binds anonymous Firebase UID for IAP when profile has none', async () => {
    const updates: any[] = [];
    const user = { id: 'u1', firebaseUid: null, email: null } as any;
    const service = new UserAuthService(
      {
        isEnabled: () => true,
        verifyIdToken: async () => ({ uid: 'anon-abc' }),
      } as any,
      {
        user: {
          findUnique: async () => null,
          update: async ({ data }: any) => {
            updates.push(data);
            return { ...user, firebaseUid: data.firebaseUid };
          },
        },
      } as any,
      {} as any,
    );
    const bound = await service.attachFirebaseUidFromToken(user, 'token');
    assert.equal(bound.firebaseUid, 'anon-abc');
    assert.equal(updates[0].firebaseUid, 'anon-abc');
  });

  it('rejects binding a Firebase UID already owned by another profile', async () => {
    const user = { id: 'u1', firebaseUid: null, email: null } as any;
    const service = new UserAuthService(
      {
        isEnabled: () => true,
        verifyIdToken: async () => ({ uid: 'taken' }),
      } as any,
      {
        user: {
          findUnique: async () => ({ id: 'u2', firebaseUid: 'taken' }),
        },
      } as any,
      {} as any,
    );
    await assert.rejects(
      () => service.attachFirebaseUidFromToken(user, 'token'),
      (err: unknown) => err instanceof ConflictException,
    );
  });
});
