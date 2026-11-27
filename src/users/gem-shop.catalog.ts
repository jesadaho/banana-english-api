import { avatarSeedCost, isGrantOnlyAvatar, isKnownAvatarId } from './avatar-catalog';

export type GemShopSkuKind = 'avatar' | 'streak_shield' | 'streak_revival' | 'app_icon';

export const GEM_SHOP_STREAK_SHIELD = 'streak_shield';
export const GEM_SHOP_STREAK_REVIVAL = 'streak_revival';
export const GEM_SHOP_APP_ICON_CLASSIC = 'app_icon_classic';
export const GEM_SHOP_APP_ICON_SENSEI_B = 'app_icon_sensei_b';

const FIXED_PRICES: Record<string, number> = {
  [GEM_SHOP_STREAK_SHIELD]: 120,
  [GEM_SHOP_STREAK_REVIVAL]: 300,
  [GEM_SHOP_APP_ICON_CLASSIC]: 0,
  [GEM_SHOP_APP_ICON_SENSEI_B]: 750,
};

const FREE_APP_ICONS = new Set<string>([GEM_SHOP_APP_ICON_CLASSIC]);

export function resolveGemShopSku(sku: string): {
  kind: GemShopSkuKind;
  price: number;
  avatarId?: string;
  iconId?: string;
} | null {
  const id = sku.trim();
  if (!id) return null;

  if (id === GEM_SHOP_STREAK_SHIELD) {
    return { kind: 'streak_shield', price: FIXED_PRICES[id] };
  }
  if (id === GEM_SHOP_STREAK_REVIVAL) {
    return { kind: 'streak_revival', price: FIXED_PRICES[id] };
  }
  if (id === GEM_SHOP_APP_ICON_CLASSIC || id === GEM_SHOP_APP_ICON_SENSEI_B) {
    return { kind: 'app_icon', price: FIXED_PRICES[id], iconId: id };
  }

  if (isKnownAvatarId(id) && !isGrantOnlyAvatar(id)) {
    const price = avatarSeedCost(id);
    if (!Number.isFinite(price) || price <= 0) return null;
    return { kind: 'avatar', price, avatarId: id };
  }

  return null;
}

export function isFreeAppIcon(iconId: string): boolean {
  return FREE_APP_ICONS.has(iconId);
}

export function isKnownAppIconId(iconId: string): boolean {
  return (
    iconId === GEM_SHOP_APP_ICON_CLASSIC || iconId === GEM_SHOP_APP_ICON_SENSEI_B
  );
}
