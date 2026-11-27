import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  GEM_SHOP_APP_ICON_CLASSIC,
  isFreeAppIcon,
  isKnownAppIconId,
  resolveGemShopSku,
} from './gem-shop.catalog';
import { UsersService } from './users.service';

@Injectable()
export class GemShopService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
  ) {}

  async purchase(user: User, skuRaw: string) {
    const resolved = resolveGemShopSku(skuRaw ?? '');
    if (!resolved) {
      throw new BadRequestException('Unknown gem shop sku');
    }

    const fresh = await this.prisma.user.findUnique({ where: { id: user.id } });
    if (!fresh) throw new NotFoundException('user not found');

    if (resolved.kind === 'avatar') {
      const avatarId = resolved.avatarId!;
      if (fresh.unlockedAvatarIds.includes(avatarId)) {
        return this.users.getProfile(fresh);
      }
      return this.users.unlockAvatar(fresh, avatarId, 0);
    }

    if (resolved.kind === 'app_icon') {
      const iconId = resolved.iconId!;
      const unlocked = new Set(fresh.unlockedAppIconIds);
      if (isFreeAppIcon(iconId) || unlocked.has(iconId)) {
        return this.users.getProfile(fresh);
      }
      if (fresh.bananaSeedBalance < resolved.price) {
        throw new BadRequestException('Insufficient gem balance');
      }
      const updated = await this.prisma.$transaction(async (tx) => {
        await tx.economyTransaction.create({
          data: {
            userId: fresh.id,
            currency: 'BANANA_SEED',
            amount: -resolved.price,
            source: 'gem_shop',
            referenceId: iconId,
          },
        });
        return tx.user.update({
          where: { id: fresh.id },
          data: {
            bananaSeedBalance: { decrement: resolved.price },
            unlockedAppIconIds: {
              set: [...new Set([...fresh.unlockedAppIconIds, iconId])],
            },
          },
        });
      });
      return this.users.getProfile(updated);
    }

    if (fresh.bananaSeedBalance < resolved.price) {
      throw new BadRequestException('Insufficient gem balance');
    }

    const sku =
      resolved.kind === 'streak_shield' ? 'streak_shield' : 'streak_revival';
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.economyTransaction.create({
        data: {
          userId: fresh.id,
          currency: 'BANANA_SEED',
          amount: -resolved.price,
          source: 'gem_shop',
          referenceId: sku,
        },
      });
      return tx.user.update({
        where: { id: fresh.id },
        data:
          resolved.kind === 'streak_shield'
            ? {
                bananaSeedBalance: { decrement: resolved.price },
                streakShieldCount: { increment: 1 },
              }
            : {
                bananaSeedBalance: { decrement: resolved.price },
                streakRevivalCount: { increment: 1 },
              },
      });
    });
    return this.users.getProfile(updated);
  }

  async setActiveAppIcon(user: User, iconIdRaw: string) {
    const iconId = (iconIdRaw ?? '').trim() || GEM_SHOP_APP_ICON_CLASSIC;
    if (!isKnownAppIconId(iconId)) {
      throw new BadRequestException('Unknown app icon');
    }

    const fresh = await this.prisma.user.findUnique({ where: { id: user.id } });
    if (!fresh) throw new NotFoundException('user not found');

    const owned =
      isFreeAppIcon(iconId) || fresh.unlockedAppIconIds.includes(iconId);
    if (!owned) {
      throw new BadRequestException('App icon is locked');
    }

    const updated = await this.prisma.user.update({
      where: { id: fresh.id },
      data: {
        activeAppIconId:
          iconId === GEM_SHOP_APP_ICON_CLASSIC ? null : iconId,
      },
    });
    return this.users.getProfile(updated);
  }
}
