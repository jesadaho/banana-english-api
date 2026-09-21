import { Injectable, NotFoundException } from '@nestjs/common';
import {
  dealDescribeItCards,
  describeItPoolById,
  DESCRIBE_IT_DEAL_COUNT,
  type DescribeItDealtCard,
  type DescribeItPool,
} from './describe-it.data';

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
    items: DescribeItDealtCard[];
  } {
    this.getPool(poolId);
    const items = dealDescribeItCards(poolId);
    return {
      poolId,
      dealCount: items.length || DESCRIBE_IT_DEAL_COUNT,
      items,
    };
  }
}
