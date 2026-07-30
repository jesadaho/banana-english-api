import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  OUTFIT_CATALOG,
  OutfitItemView,
  toOutfitItemView,
} from './outfit-catalog';

export interface OutfitsView {
  ownedCount: number;
  totalCount: number;
  items: OutfitItemView[];
}

@Injectable()
export class OutfitsService {
  constructor(private readonly prisma: PrismaService) {}

  async getForUser(userId: string): Promise<OutfitsView> {
    const owned = await this.prisma.userOutfit.findMany({
      where: { userId },
      select: { outfitId: true, acquiredAt: true },
    });
    const ownedMap = new Map(owned.map((row) => [row.outfitId, row.acquiredAt]));

    const items = OUTFIT_CATALOG.map((def) =>
      toOutfitItemView(def, ownedMap.get(def.outfitId) ?? null),
    );

    return {
      ownedCount: items.filter((item) => item.isOwned).length,
      totalCount: items.length,
      items,
    };
  }
}
