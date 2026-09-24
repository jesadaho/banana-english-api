import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DescribeItController } from './describe-it.controller';
import { DescribeItService } from './describe-it.service';
import {
  dealDescribeItCards,
  describeItPoolById,
  isValidDescribeItPack,
  listDescribeItPools,
} from './describe-it.data';

const req = { user: { id: 'describe-it-test', displayName: 'Mia' } } as any;

describe('Describe It foundation pack', () => {
  it('hides hub pools while Describe It is temporarily disabled', () => {
    assert.deepEqual(listDescribeItPools(), []);
  });

  it('deals six Look at Me cards in order with a first-item hint', () => {
    const pool = describeItPoolById('fnd_v7_u03n05');
    assert.ok(isValidDescribeItPack(pool));
    const items = dealDescribeItCards('fnd_v7_u03n05');
    assert.equal(items.length, 6);
    assert.deepEqual(items.map((item) => item.id), [
      '01-happy',
      '02-tired',
      '03-hungry',
      '04-hot',
      '05-cold',
      '06-sick',
    ]);
    assert.equal(items[0].hintEn, 'I am _____');
    assert.equal(items[0].answerEn, 'I am happy.');
    assert.equal(items[0].answerTh, 'ฉันมีความสุข');
    assert.ok(items.every((item) => (item.answerTh ?? '').trim().length > 0));
    assert.ok(items[0].imageUrl.includes('describe-it%2Ffnd_v7_u03n05%2F01-happy.webp'));
    assert.ok(items.slice(1).every((item) => !item.hintEn));
  });

  it('deals five Family Photo cards in order with a first-item hint', () => {
    const pool = describeItPoolById('fnd_v7_u04n05');
    assert.ok(isValidDescribeItPack(pool));
    const items = dealDescribeItCards('fnd_v7_u04n05');
    assert.equal(items.length, 5);
    assert.deepEqual(items.map((item) => item.id), [
      '01-may-student',
      '02-max-happy',
      '03-john-teacher',
      '04-minnie-doctor',
      '05-mali-tired',
    ]);
    assert.equal(items[0].hintEn, 'She is a _____');
    assert.equal(items[0].answerEn, 'She is a student.');
    assert.equal(items[0].answerTh, 'เธอเป็นนักเรียน');
    assert.equal(items[2].answerEn, 'He is a teacher.');
    assert.ok(items.every((item) => (item.answerTh ?? '').trim().length > 0));
    assert.ok(items[0].imageUrl.includes('describe-it%2Ffnd_v7_u04n05%2F01-may-student.webp'));
    assert.ok(items.slice(1).every((item) => !item.hintEn));
  });

  it('deals five Inside the Bag cards in order with a first-item hint', () => {
    const pool = describeItPoolById('fnd_v7_u05n05');
    assert.ok(isValidDescribeItPack(pool));
    const items = dealDescribeItCards('fnd_v7_u05n05');
    assert.equal(items.length, 5);
    assert.deepEqual(items.map((item) => item.id), [
      '01-one-book',
      '02-two-pens',
      '03-one-phone',
      '04-two-apples',
      '05-two-keys',
    ]);
    assert.equal(items[0].hintEn, 'It is a _____');
    assert.equal(items[0].answerEn, 'It is a book.');
    assert.equal(items[1].answerEn, 'They are pens.');
    assert.equal(items[4].answerEn, 'They are keys.');
    assert.ok(items.every((item) => (item.answerTh ?? '').trim().length > 0));
    assert.ok(items[0].imageUrl.includes('describe-it%2Ffnd_v7_u05n05%2F01-one-book.webp'));
    assert.ok(items.slice(1).every((item) => !item.hintEn));
  });

  it('deals five authored Now cards in order with a first-item hint', () => {
    const pool = describeItPoolById('fnd_v7_u13n05');
    assert.ok(isValidDescribeItPack(pool));
    const items = dealDescribeItCards('fnd_v7_u13n05');
    assert.equal(items.length, 5);
    assert.deepEqual(items.map((item) => item.id), [
      '01-she-is-reading',
      '02-he-is-eating',
      '03-they-are-waiting',
      '04-he-is-cooking',
      '05-they-are-walking',
    ]);
    assert.equal(items[0].hintEn, 'She _____');
    assert.equal(items[0].answerEn, 'She is reading.');
    assert.equal(items[0].answerTh, 'เธอกำลังอ่านหนังสือ');
    assert.ok(items.every((item) => (item.answerTh ?? '').trim().length > 0));
    assert.ok(items[0].imageUrl.includes('describe-it%2Ffnd_v7_u13n05%2F01-she-is-reading.webp'));
    assert.ok(items.slice(1).every((item) => !item.hintEn));
  });

  it('deals eight Two Blue Bags cards in order with a first-item hint', () => {
    const pool = describeItPoolById('fnd_v7_u06n06');
    assert.ok(isValidDescribeItPack(pool));
    const items = dealDescribeItCards('fnd_v7_u06n06');
    assert.equal(items.length, 8);
    assert.deepEqual(items.map((item) => item.id), [
      '01-this-blue-bag',
      '02-this-yellow-book',
      '03-these-blue-bags',
      '04-these-green-books',
      '05-that-red-bag',
      '06-that-yellow-book',
      '07-those-black-bags',
      '08-those-white-books',
    ]);
    assert.equal(items[0].hintEn, 'This is a _____');
    assert.equal(items[0].answerEn, 'This is a blue bag.');
    assert.equal(items[0].answerTh, 'นี่คือกระเป๋าสีน้ำเงิน');
    assert.equal(items[2].answerEn, 'These are blue bags.');
    assert.equal(items[4].answerEn, 'That is a red bag.');
    assert.equal(items[7].answerEn, 'Those are white books.');
    assert.ok(items.every((item) => (item.answerTh ?? '').trim().length > 0));
    assert.ok(items[0].imageUrl.includes('describe-it%2Ffnd_v7_u06n06%2F01-this-blue-bag.webp'));
    assert.ok(items.slice(1).every((item) => !item.hintEn));
  });

  it('deals eight Pick Two cards in order with a first-item hint', () => {
    const pool = describeItPoolById('fnd_v7_u06n16');
    assert.ok(isValidDescribeItPack(pool));
    const items = dealDescribeItCards('fnd_v7_u06n16');
    assert.equal(items.length, 8);
    assert.deepEqual(items.map((item) => item.id), [
      '01-blue-bag-and-red-book',
      '02-green-book-and-yellow-bag',
      '03-black-bag-and-white-book',
      '04-red-bag-and-blue-book',
      '05-red-bag-or-blue-bag',
      '06-green-book-or-yellow-bag',
      '07-black-bag-or-white-book',
      '08-red-book-or-blue-bag',
    ]);
    assert.equal(items[0].hintEn, 'A blue bag and a _____');
    assert.equal(items[0].answerEn, 'A blue bag and a red book.');
    assert.equal(items[0].answerTh, 'กระเป๋าสีน้ำเงินกับหนังสือสีแดง');
    assert.equal(items[4].answerEn, 'A red bag or a blue bag.');
    assert.equal(items[7].answerEn, 'A red book or a blue bag.');
    assert.ok(items.every((item) => (item.answerTh ?? '').trim().length > 0));
    assert.ok(
      items[0].imageUrl.includes(
        'describe-it%2Ffnd_v7_u06n16%2F01-blue-bag-and-red-book.webp',
      ),
    );
    assert.ok(items.slice(1).every((item) => !item.hintEn));
  });

  it('rejects start and complete while Describe It is temporarily disabled', async () => {
    const controller = new DescribeItController(
      new DescribeItService(),
      {
        applyMiniGameRewards: async () => {
          throw new Error('should not reward while disabled');
        },
        recordMiniGameScore: async () => {
          throw new Error('should not record while disabled');
        },
        hasClaimedMiniGameReward: async () => false,
        spendBananas: async () => {
          throw new Error('should not spend while disabled');
        },
        refundBananas: async () => {},
      } as any,
      { markActivity: async () => {} } as any,
    );
    assert.throws(() => controller.dealForPool('fnd_v7_u03n05'));
    await assert.rejects(() => controller.startPool(req, 'fnd_v7_u03n05'));
    await assert.rejects(() =>
      controller.completePool(req, 'fnd_v7_u03n05', {
        correctCount: 5,
        totalCount: 6,
      }),
    );
  });
});
