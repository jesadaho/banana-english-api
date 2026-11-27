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

  it('migrates a new Google email onto the current guest profile', async () => {
    const guest = {
      id: 'guest-1',
      firebaseUid: 'anon-1',
      email: null,
      anonymousId: 'a1',
    } as any;
    const providerUpserts: any[] = [];
    const userUpdates: any[] = [];
    const service = new UserAuthService(
      {
        isEnabled: () => true,
        verifyIdToken: async () => ({
          uid: 'anon-1',
          email: 'new@example.com',
          firebase: {
            sign_in_provider: 'google.com',
            identities: { 'google.com': ['g-1'] },
          },
        }),
      } as any,
      {
        user: {
          findUnique: async ({ where }: any) => {
            if (where.firebaseUid) return guest;
            if (where.id === guest.id) {
              return { ...guest, email: 'new@example.com' };
            }
            return null;
          },
          findUniqueOrThrow: async ({ where }: any) => {
            assert.equal(where.id, guest.id);
            return { ...guest, email: 'new@example.com' };
          },
        },
        userAuthProvider: {
          findUnique: async () => null,
          count: async () => 0,
        },
        $transaction: async (fn: any) =>
          fn({
            userAuthProvider: {
              upsert: async (args: any) => {
                providerUpserts.push(args);
              },
            },
            user: {
              update: async ({ data }: any) => {
                userUpdates.push(data);
                return { ...guest, ...data };
              },
            },
          }),
      } as any,
      {
        getProfile: async (u: any) => ({ id: u.id, email: u.email }),
      } as any,
    );

    const profile = await service.linkAuthFromToken(guest, 'token');
    assert.equal(profile.id, 'guest-1');
    assert.equal(providerUpserts[0].create.userId, 'guest-1');
    assert.equal(providerUpserts[0].create.email, 'new@example.com');
    assert.equal(userUpdates[0].firebaseUid, 'anon-1');
    assert.equal(userUpdates[0].email, 'new@example.com');
  });
});
