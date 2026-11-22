import { Injectable, NotFoundException } from '@nestjs/common';
import {
  dealDescribeItCards,
  describeItPoolById,
  DESCRIBE_IT_DEAL_COUNT,
  type DescribeItDealtCard,
  type DescribeItPool,
} from './describe-it.data';
import { hintPolicyFor, itemHint, type ItemHint } from '../hints/hint-policy';

@Injectable()
export class DescribeItService {
  getPool(poolId: string): DescribeItPool {
    const pool = describeItPoolById(poolId);
    if (!pool) {
      throw new NotFoundException(`Describe It pool not found: ${poolId}`);
    }
    return pool;
  }

  dealForPool(poolId: string): {
    poolId: string;
    dealCount: number;
    items: (DescribeItDealtCard & { hint: ItemHint })[];
  } {
    this.getPool(poolId);
    // Hints are decided here (see hints/hint-policy.ts); the app follows them.
    const policy = hintPolicyFor('describe_it', poolId);
    const items = dealDescribeItCards(poolId).map((card, index) => ({
      ...card,
      hint: itemHint(policy, card.hintEn, index),
    }));
    return {
      poolId,
      dealCount: items.length || DESCRIBE_IT_DEAL_COUNT,
      items,
    };
  }
}
