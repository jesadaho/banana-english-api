import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import type { ConfigService } from '@nestjs/config';
import type { User } from '@prisma/client';
import type { EconomyService } from '../economy/economy.service';
import type { PrismaService } from '../prisma/prisma.service';
import { PurchasesService } from './purchases.service';
import { RevenueCatClient } from './revenuecat.client';

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

/** RevenueCat row for one consumable: RC id differs from the Apple tx id. */
function stubRevenueCat() {
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        subscriber: {
          non_subscriptions: {
            banana_tickets_28: [
              { id: 'rc_abc', store_transaction_id: '2000000111' },
            ],
          },
        },
      }),
      { status: 200 },
    )) as typeof fetch;
}

const config = {
  get: (key: string) =>
    key === 'REVENUECAT_SECRET_API_KEY' ? 'sk_test' : undefined,
} as unknown as ConfigService;

test('verification maps the RevenueCat id to the store transaction id', async () => {
  stubRevenueCat();
  const client = new RevenueCatClient(config);
  const verified = await client.assertStoreTransaction({
    appUserIds: ['guest_a'],
    productId: 'banana_tickets_28',
    storeTransactionId: 'rc_abc',
  });
  assert.equal(verified.canonicalId, '2000000111');
  assert.deepEqual(verified.aliases.sort(), ['2000000111', 'rc_abc']);
});

test('purchase then restore with the other id credits bananas once', async () => {
  stubRevenueCat();
  const records: Array<{
    userId: string;
    storeTransactionId: string;
    bananasGranted: number;
  }> = [];
  const credits: string[] = [];
  let balance = 0;

  const tx = {
    purchaseRecord: {
      findFirst: async ({ where }: { where: { storeTransactionId: { in: string[] } } }) =>
        records.find((r) => where.storeTransactionId.in.includes(r.storeTransactionId)) ??
        null,
      create: async ({ data }: { data: (typeof records)[number] }) => {
        records.push(data);
        return data;
      },
    },
  };
  const prisma = {
    $transaction: async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
    purchaseAttempt: {
      findFirst: async () => null,
      create: async () => ({}),
    },
  } as unknown as PrismaService;
  const economy = {
    creditIapIfNeeded: async (
      _tx: unknown,
      _userId: string,
      amount: number,
      id: string,
      aliases: string[] = [],
    ) => {
      if ([id, ...aliases].some((ref) => credits.includes(ref))) {
        return { user: { bananaBalance: balance }, credited: false };
      }
      credits.push(id);
      balance += amount;
      return { user: { bananaBalance: balance }, credited: true };
    },
  } as unknown as EconomyService;

  const service = new PurchasesService(
    prisma,
    economy,
    config,
    new RevenueCatClient(config),
  );
  const user = { id: 'u1', firebaseUid: null, anonymousId: 'a' } as User;

  const bought = await service.claimPurchase(user, {
    productId: 'banana_tickets_28',
    storeTransactionId: '2000000111',
  });
  const restored = await service.claimPurchase(user, {
    productId: 'banana_tickets_28',
    storeTransactionId: 'rc_abc',
  });

  assert.equal(bought.alreadyClaimed, false);
  assert.equal(restored.alreadyClaimed, true);
  assert.equal(records.length, 1);
  assert.equal(records[0].storeTransactionId, '2000000111');
  assert.equal(credits.length, 1);
  assert.equal(restored.bananaBalance, bought.bananaBalance);
});
