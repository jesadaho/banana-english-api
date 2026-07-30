export type OutfitSlot = 'head' | 'body' | 'accessory';

export type OutfitRarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface OutfitDef {
  outfitId: string;
  slot: OutfitSlot;
  rarity: OutfitRarity;
  nameEn: string;
  nameTh: string;
  descriptionEn: string;
  descriptionTh: string;
  /** Icon token the app maps to a local icon (see OutfitItem rendering). */
  iconKey: string;
  /** Achievement that grants this outfit (for "how to get" copy). */
  sourceAchievementId?: string;
}

export const OUTFIT_CATALOG: OutfitDef[] = [
  {
    outfitId: 'banana_cap',
    slot: 'head',
    rarity: 'common',
    nameEn: 'Banana Cap',
    nameTh: 'หมวกกล้วย',
    descriptionEn: 'A cheerful cap for finishing the Basic Course.',
    descriptionTh: 'หมวกสุดสดใสจากการเรียนจบ Basic Course',
    iconKey: 'banana_cap',
    sourceAchievementId: 'beginner',
  },
  {
    outfitId: 'graduation_cap',
    slot: 'head',
    rarity: 'legendary',
    nameEn: 'Graduation Cap',
    nameTh: 'หมวกบัณฑิต',
    descriptionEn: 'Worn only by those who finished every lesson.',
    descriptionTh: 'สำหรับคนที่เรียนครบทุกบทเท่านั้น',
    iconKey: 'graduation_cap',
    sourceAchievementId: 'banana_graduate',
  },
  {
    outfitId: 'headphones',
    slot: 'accessory',
    rarity: 'legendary',
    nameEn: 'Headphones',
    nameTh: 'หูฟัง',
    descriptionEn: 'For a true conversation master.',
    descriptionTh: 'ของราชาการสนทนาตัวจริง',
    iconKey: 'headphones',
    sourceAchievementId: 'conversation_master',
  },
  {
    outfitId: 'flame_jacket',
    slot: 'body',
    rarity: 'legendary',
    nameEn: 'Flame Jacket',
    nameTh: 'แจ็คเก็ตเปลวไฟ',
    descriptionEn: 'Proof of a 30-day learning streak.',
    descriptionTh: 'เครื่องพิสูจน์การเรียนต่อเนื่อง 30 วัน',
    iconKey: 'flame_jacket',
    sourceAchievementId: 'streak_30',
  },
];

export interface OutfitItemView {
  outfitId: string;
  slot: OutfitSlot;
  rarity: OutfitRarity;
  nameEn: string;
  nameTh: string;
  descriptionEn: string;
  descriptionTh: string;
  iconKey: string;
  sourceAchievementId: string | null;
  isOwned: boolean;
  acquiredAt: string | null;
}

export function getOutfitById(outfitId: string): OutfitDef | undefined {
  return OUTFIT_CATALOG.find((o) => o.outfitId === outfitId);
}

export function toOutfitItemView(
  def: OutfitDef,
  acquiredAt?: Date | null,
): OutfitItemView {
  return {
    outfitId: def.outfitId,
    slot: def.slot,
    rarity: def.rarity,
    nameEn: def.nameEn,
    nameTh: def.nameTh,
    descriptionEn: def.descriptionEn,
    descriptionTh: def.descriptionTh,
    iconKey: def.iconKey,
    sourceAchievementId: def.sourceAchievementId ?? null,
    isOwned: acquiredAt != null,
    acquiredAt: acquiredAt ? acquiredAt.toISOString() : null,
  };
}
