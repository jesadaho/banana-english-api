import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { extractActiveSubscriptions } from './revenuecat.client';
import { subscriptionProduct } from '../subscriptions/subscription-products';

const future = '2027-01-01T00:00:00.000Z';
const now = new Date('2026-10-24T12:00:00.000Z');

describe('extractActiveSubscriptions', () => {
  it('uses the Play subscription product id, not the base plan id', () => {
    const periods = extractActiveSubscriptions(
      {
        subscriber: {
          subscriptions: {
            pro_monthly: {
              product_plan_identifier: 'monthly',
              store_transaction_id: 'GPA.1234',
              expires_date: future,
              purchase_date: '2026-10-24T07:00:00.000Z',
              is_sandbox: false,
              store: 'play_store',
            },
          },
        },
      },
      now,
    );
    assert.equal(periods.length, 1);
    assert.equal(periods[0].productId, 'pro_monthly');
    assert.equal(subscriptionProduct(periods[0].productId)?.tier, 'PRO');
    assert.equal(periods[0].platform, 'android');
    assert.equal(periods[0].storeTransactionId, 'GPA.1234');
  });

  it('keeps productId:basePlan keys so Play yearly still maps', () => {
    const periods = extractActiveSubscriptions(
      {
        subscriber: {
          subscriptions: {
            'pro_yearly:p1y': {
              product_plan_identifier: 'p1y',
              original_transaction_id: 'GPA.999',
              expires_date: future,
              store: 'play_store',
            },
          },
        },
      },
      now,
    );
    assert.equal(periods[0].productId, 'pro_yearly:p1y');
    assert.equal(subscriptionProduct(periods[0].productId)?.tier, 'PRO');
    assert.equal(periods[0].storeTransactionId, 'GPA.999');
  });

  it('drops expired and refunded rows', () => {
    const periods = extractActiveSubscriptions(
      {
        subscriber: {
          subscriptions: {
            pro_monthly: {
              store_transaction_id: 'old',
              expires_date: '2026-01-01T00:00:00.000Z',
              store: 'play_store',
            },
            pro_quarterly: {
              store_transaction_id: 'refunded',
              expires_date: future,
              refunded_at: '2026-10-24T08:00:00.000Z',
              store: 'play_store',
            },
          },
        },
      },
      now,
    );
    assert.equal(periods.length, 0);
  });
});
