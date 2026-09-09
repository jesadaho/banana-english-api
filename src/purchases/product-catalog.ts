export const BANANA_PACKS = {
  banana_tickets_28: { bananas: 50, fallbackPrice: '฿99', bestValue: false },
  banana_tickets_70: { bananas: 120, fallbackPrice: '฿199', bestValue: true },
} as const;

export type BananaPackProductId = keyof typeof BANANA_PACKS;

export type BananaPackDefinition = {
  productId: BananaPackProductId;
  bananas: number;
  fallbackPrice: string;
  bestValue: boolean;
};

export function listBananaPacks(): BananaPackDefinition[] {
  return (Object.keys(BANANA_PACKS) as BananaPackProductId[]).map((productId) => {
    const pack = BANANA_PACKS[productId];
    return {
      productId,
      bananas: pack.bananas,
      fallbackPrice: pack.fallbackPrice,
      bestValue: pack.bestValue,
    };
  });
}

export function bananasForProduct(productId: string): number | null {
  const pack = BANANA_PACKS[productId as BananaPackProductId];
  return pack?.bananas ?? null;
}

export function isKnownBananaPack(productId: string): productId is BananaPackProductId {
  return productId in BANANA_PACKS;
}
