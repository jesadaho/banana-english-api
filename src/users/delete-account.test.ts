import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { UsersService } from './users.service';

describe('UsersService.deleteAccount', () => {
  it('deletes the DB user then Firebase Auth uid', async () => {
    const deletes: string[] = [];
    const firebaseDeletes: string[] = [];
    const service = new UsersService(
      {
        user: {
          delete: async ({ where }: { where: { id: string } }) => {
            deletes.push(where.id);
          },
        },
      } as never,
      {} as never,
      {} as never,
      {
        deleteAuthUser: async (uid: string) => {
          firebaseDeletes.push(uid);
        },
      } as never,
    );

    await assert.doesNotReject(() =>
      service.deleteAccount({
        id: 'user-1',
        firebaseUid: 'fb-uid-1',
      } as never),
    );
    assert.deepEqual(deletes, ['user-1']);
    assert.deepEqual(firebaseDeletes, ['fb-uid-1']);
  });

  it('skips Firebase Auth when uid is missing', async () => {
    let firebaseCalled = false;
    const service = new UsersService(
      {
        user: {
          delete: async () => undefined,
        },
      } as never,
      {} as never,
      {} as never,
      {
        deleteAuthUser: async () => {
          firebaseCalled = true;
        },
      } as never,
    );

    const result = await service.deleteAccount({
      id: 'user-2',
      firebaseUid: null,
    } as never);
    assert.deepEqual(result, { ok: true });
    assert.equal(firebaseCalled, false);
  });
});
