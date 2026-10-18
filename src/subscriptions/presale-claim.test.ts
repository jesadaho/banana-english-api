import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { SubscriptionTier } from '@prisma/client';
import { SubscriptionsService } from './subscriptions.service';

describe('claimPaidPresaleForUser', () => {
  it('attaches a paid bucket order and grants Pro Max', async () => {
    const grants: any[] = [];
    const user = {
      id: 'u1',
      firebaseUid: 'fb-google',
      subscriptionTier: SubscriptionTier.FREE,
      subscriptionExpiresAt: null,
    } as any;
    const order = {
      id: 'ord-1',
      userId: null,
      firebaseUid: 'fb-google',
      status: 'paid',
      priceThb: 150,
      paidAt: new Date(),
    };
    const prisma = {
      presaleOrder: {
        findMany: async () => [order],
        update: async ({ data }: any) => {
          Object.assign(order, data);
          return order;
        },
      },
      subscriptionGrant: {
        findFirst: async () => (grants.length ? grants[0] : null),
        create: async ({ data }: any) => {
          grants.push(data);
          return data;
        },
      },
      user: {
        findUnique: async () => user,
        findUniqueOrThrow: async () => user,
        update: async ({ data }: any) => {
          Object.assign(user, data);
          return user;
        },
      },
      $transaction: async (fn: any) => fn(prisma),
    };
    const service = new SubscriptionsService(prisma as any, {} as any, {} as any);
    await service.claimPaidPresaleForUser(user);
    assert.equal(order.userId, 'u1');
    assert.equal(user.subscriptionTier, SubscriptionTier.PRO_MAX);
    assert.ok(user.subscriptionExpiresAt);
    assert.equal(grants[0].source, 'founder_presale');
    assert.equal(grants[0].note, 'ord-1');
  });

  it('skips paid orders already attached to another user', async () => {
    const user = {
      id: 'u1',
      firebaseUid: 'fb-google',
      subscriptionTier: SubscriptionTier.FREE,
      subscriptionExpiresAt: null,
    } as any;
    const prisma = {
      presaleOrder: {
        findMany: async () => [
          {
            id: 'ord-2',
            userId: 'someone-else',
            firebaseUid: 'fb-google',
            status: 'paid',
            priceThb: 150,
          },
        ],
      },
      subscriptionGrant: { findFirst: async () => null, create: async () => assert.fail('grant') },
    };
    const service = new SubscriptionsService(prisma as any, {} as any, {} as any);
    await service.claimPaidPresaleForUser(user);
    assert.equal(user.subscriptionTier, SubscriptionTier.FREE);
  });
});
