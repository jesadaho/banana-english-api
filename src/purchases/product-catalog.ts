export const BANANA_PACKS = {
  banana_tickets_28: { bananas: 28 },
  banana_tickets_70: { bananas: 70 },
} as const;

export type BananaPackProductId = keyof typeof BANANA_PACKS;

export function bananasForProduct(productId: string): number | null {
  const pack = BANANA_PACKS[productId as BananaPackProductId];
  return pack?.bananas ?? null;
}

export function isKnownBananaPack(productId: string): productId is BananaPackProductId {
  return productId in BANANA_PACKS;
}
