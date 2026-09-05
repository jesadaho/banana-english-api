/**
 * Foundation Path V4 catalog — served by GET /learn-path/foundation-v2.
 * Preserved lesson IDs keep existing completions.
 *
 * Catalog: 50 core + 3 optional = 53 nodes on the map.
 * New lessons/pools marked comingSoon until content ships.
 * Mission sims kept as-is (content redesign later).
 */

export type FoundationV2NodeType =
  | 'lesson'
  | 'say_it'
  | 'emoji_speak'
  | 'number_challenge'
  | 'review'
  | 'mission'
  | 'describe_it';

export type FoundationV2NodeDef = {
  id: string;
  code: string;
  titleEn: string;
  titleTh: string;
  type: FoundationV2NodeType;
  /** Core nodes count toward progress. Optional = false. */
  countsTowardProgress: boolean;
  optional?: boolean;
  /** Content not ready yet — UI shows coming soon. */
  comingSoon?: boolean;
  estimatedMinutes?: number;
  estimatedSeconds?: number;
  unlockAfterNodeIds: string[];
  poolId?: string;
  topicId?: string;
  simulationId?: string;
  reviewId?: string;
};

export type FoundationV2ChapterDef = {
  id: string;
  number: number;
  emoji: string;
  titleEn: string;
  titleTh: string;
  items: FoundationV2NodeDef[];
};

function lesson(
  id: string,
  code: string,
  titleEn: string,
  titleTh: string,
  unlockAfterNodeIds: string[],
  opts?: Partial<FoundationV2NodeDef>,
): FoundationV2NodeDef {
  return {
    id,
    code,
    titleEn,
    titleTh,
    type: 'lesson',
    countsTowardProgress: true,
    estimatedMinutes: opts?.estimatedMinutes ?? 5,
    unlockAfterNodeIds,
    comingSoon: opts?.comingSoon,
    optional: opts?.optional,
  };
}

function sayIt(
  id: string,
  code: string,
  titleEn: string,
  titleTh: string,
  topicId: string,
  unlockAfterNodeIds: string[],
  opts?: Partial<FoundationV2NodeDef>,
): FoundationV2NodeDef {
  return {
    id,
    code,
    titleEn,
    titleTh,
    type: 'say_it',
    topicId,
    countsTowardProgress: true,
    estimatedMinutes: opts?.estimatedMinutes ?? 3,
    unlockAfterNodeIds,
    comingSoon: opts?.comingSoon ?? true,
    optional: opts?.optional,
  };
}

function emoji(
  id: string,
  code: string,
  titleEn: string,
  titleTh: string,
  poolId: string,
  unlockAfterNodeIds: string[],
  opts?: Partial<FoundationV2NodeDef>,
): FoundationV2NodeDef {
  const optional = opts?.optional === true;
  return {
    id,
    code,
    titleEn,
    titleTh,
    type: 'emoji_speak',
    poolId,
    countsTowardProgress: optional ? false : true,
    optional: optional || undefined,
    estimatedSeconds: opts?.estimatedSeconds ?? 60,
    unlockAfterNodeIds,
    comingSoon: opts?.comingSoon ?? true,
  };
}

function mission(
  id: string,
  code: string,
  titleEn: string,
  titleTh: string,
  simulationId: string,
  unlockAfterNodeIds: string[],
  opts?: Partial<FoundationV2NodeDef>,
): FoundationV2NodeDef {
  return {
    id,
    code,
    titleEn,
    titleTh,
    type: 'mission',
    simulationId,
    countsTowardProgress: true,
    estimatedMinutes: opts?.estimatedMinutes ?? 5,
    unlockAfterNodeIds,
    comingSoon: opts?.comingSoon ?? true,
    optional: opts?.optional,
  };
}

function describeIt(
  id: string,
  code: string,
  titleEn: string,
  titleTh: string,
  unlockAfterNodeIds: string[],
): FoundationV2NodeDef {
  return {
    id,
    code,
    titleEn,
    titleTh,
    type: 'describe_it',
    countsTowardProgress: false,
    optional: true,
    estimatedMinutes: 2,
    unlockAfterNodeIds,
    comingSoon: true,
  };
}

/**
 * Soft-lock rule: playable cores unlockAfter the previous playable core,
 * not comingSoon nodes in between.
 */
export const FOUNDATION_V2_CHAPTERS: FoundationV2ChapterDef[] = [
  {
    id: 'first_conversation',
    number: 1,
    emoji: '👋',
    titleEn: 'First Conversation',
    titleTh: 'เปิดบทสนทนา',
    items: [
      lesson('greetings', '1.1', 'Greetings', 'การทักทาย', [], {
        estimatedMinutes: 5,
        comingSoon: false,
      }),
      lesson(
        'introductions',
        '1.2',
        'Introductions',
        'การแนะนำตัว',
        ['greetings'],
        { estimatedMinutes: 3, comingSoon: false },
      ),
      sayIt(
        'fnd_v2_say_first_conversation',
        '1.3',
        'First Conversation',
        'เปิดบทสนทนา',
        'fnd_v2_first_conversation',
        ['introductions'],
        { comingSoon: false },
      ),
      lesson(
        'yes_no_maybe',
        '1.4',
        'Yes / No / Maybe',
        'ใช่ ไม่ อาจจะ',
        ['fnd_v2_say_first_conversation'],
        { estimatedMinutes: 5, comingSoon: false },
      ),
      mission(
        'fnd_v2_mission_meet_max',
        '1.5',
        'Meet Max',
        'พบกับ Max',
        'meet_new_friend_easy',
        ['yes_no_maybe'],
        { comingSoon: false },
      ),
    ],
  },
  {
    id: 'polite_survival',
    number: 2,
    emoji: '🙏',
    titleEn: 'Polite & Survival English',
    titleTh: 'คำสุภาพและเอาตัวรอด',
    items: [
      lesson(
        'polite_expressions',
        '2.1',
        'Polite Expressions',
        'คำสุภาพ',
        ['fnd_v2_mission_meet_max'],
        { comingSoon: false },
      ),
      sayIt(
        'fnd_v2_say_be_polite',
        '2.2',
        'Be Polite',
        'ฝึกคำสุภาพ',
        'fnd_v2_be_polite',
        ['polite_expressions'],
        { comingSoon: false },
      ),
      lesson(
        'asking_for_help',
        '2.3',
        'Asking for Help',
        'ขอความช่วยเหลือ',
        ['fnd_v2_say_be_polite'],
        { comingSoon: false },
      ),
      lesson(
        'fnd_v2_say_it_again',
        '2.4',
        'Say It Again',
        'พูดอีกครั้ง',
        ['asking_for_help'],
        { comingSoon: false },
      ),
      sayIt(
        'fnd_v2_say_survival',
        '2.5',
        'Survival English',
        'ภาษาเอาตัวรอด',
        'fnd_v2_survival',
        ['fnd_v2_say_it_again'],
        { comingSoon: false },
      ),
      mission(
        'fnd_v2_mission_need_help',
        '2.6',
        'I Need Help',
        'ฉันต้องการความช่วยเหลือ',
        'ask_help_easy',
        ['fnd_v2_say_survival'],
        { comingSoon: false },
      ),
    ],
  },
  {
    id: 'people_feelings_family',
    number: 3,
    emoji: '👥',
    titleEn: 'People, Feelings & Family',
    titleTh: 'คน ความรู้สึก และครอบครัว',
    items: [
      lesson(
        'meet_people',
        '3.1',
        'I Am / You Are',
        'ฉันเป็น / คุณเป็น',
        ['fnd_v2_mission_need_help'],
        { comingSoon: false },
      ),
      lesson(
        'fnd_v2_how_do_you_feel',
        '3.2',
        'How Do You Feel?',
        'คุณรู้สึกอย่างไร?',
        ['meet_people'],
        { comingSoon: false },
      ),
      emoji(
        'fnd_v2_emoji_feelings',
        '3.3',
        'Feelings',
        'ความรู้สึก',
        'fnd_v2_emoji_feelings',
        ['fnd_v2_how_do_you_feel'],
        { comingSoon: false },
      ),
      lesson(
        'talk_about_groups',
        '3.4',
        'He / She / It',
        'เขา / เธอ / มัน',
        ['fnd_v2_emoji_feelings'],
        { comingSoon: false },
      ),
      lesson(
        'fnd_v2_we_they',
        '3.5',
        'We / They',
        'เรา / พวกเขา',
        ['talk_about_groups'],
        { comingSoon: false },
      ),
      emoji(
        'fnd_v2_emoji_people_things',
        '3.6',
        'People & Things',
        'คนและสิ่งของ',
        'fnd_v2_emoji_people_things',
        ['fnd_v2_we_they'],
        { comingSoon: false },
      ),
      lesson(
        'ee_about_me_family',
        '3.7',
        'Family',
        'ครอบครัว',
        ['fnd_v2_emoji_people_things'],
        { comingSoon: false },
      ),
      emoji(
        'fnd_v2_emoji_family',
        '3.8',
        'Family Words',
        'คำครอบครัว',
        'fnd_v2_emoji_family',
        ['ee_about_me_family'],
        { comingSoon: false },
      ),
      sayIt(
        'fnd_v2_say_people_family',
        '3.9',
        'People, Feelings & Family',
        'คน ความรู้สึก และครอบครัว',
        'fnd_v2_people_family',
        ['fnd_v2_emoji_family'],
        { comingSoon: false },
      ),
      describeIt(
        'fnd_v2_describe_who',
        '3.O1',
        'Who Are They?',
        'พวกเขาเป็นใคร?',
        ['fnd_v2_say_people_family'],
      ),
      mission(
        'fnd_v2_mission_meet_family',
        '3.10',
        'Meet My Family',
        'แนะนำครอบครัว',
        'catch_up_old_friend_easy',
        ['fnd_v2_say_people_family'],
        { comingSoon: false },
      ),
    ],
  },
  {
    id: 'numbers_shopping',
    number: 4,
    emoji: '🔢',
    titleEn: 'Numbers, Time & Shopping',
    titleTh: 'ตัวเลข เวลา และการซื้อของ',
    items: [
      lesson(
        'numbers',
        '4.1',
        'Numbers 0–10',
        'ตัวเลข 0–10',
        ['fnd_v2_mission_meet_family'],
        { comingSoon: false },
      ),
      lesson(
        'fnd_v2_numbers_11_20',
        '4.2',
        'Numbers 11–20',
        'ตัวเลข 11–20',
        ['numbers'],
        { comingSoon: false },
      ),
      emoji(
        'fnd_v2_emoji_numbers_0_20',
        '4.3',
        'Numbers 0–20',
        'ตัวเลข 0–20',
        'fnd_v2_emoji_numbers_0_20',
        ['fnd_v2_numbers_11_20'],
      ),
      lesson(
        'telling_time',
        '4.4',
        'Telling Time',
        'บอกเวลา',
        // Bypass Numbers 0–20 emoji until pool ships.
        ['fnd_v2_numbers_11_20'],
        { comingSoon: false },
      ),
      sayIt(
        'fnd_v2_say_daily_time',
        '4.5',
        'Time Practice',
        'ฝึกบอกเวลา',
        'fnd_v2_daily_time',
        ['telling_time'],
        { comingSoon: false },
      ),
      lesson(
        'everyday_numbers',
        '4.6',
        'Numbers 20–100',
        'ตัวเลข 20–100',
        ['fnd_v2_say_daily_time'],
        { comingSoon: false },
      ),
      emoji(
        'fnd_v2_emoji_numbers_0_100',
        '4.7',
        'Numbers 0–100',
        'ตัวเลข 0–100',
        'fnd_v2_emoji_numbers_0_100',
        ['everyday_numbers'],
      ),
      lesson(
        'money_prices',
        '4.8',
        'Money & Prices',
        'เงินและราคา',
        // Bypass Numbers 0–100 emoji until pool ships.
        ['everyday_numbers'],
        { comingSoon: false },
      ),
      lesson(
        'fnd_v2_basic_colors',
        '4.9',
        'Basic Colors',
        'สีพื้นฐาน',
        ['money_prices'],
        { comingSoon: true },
      ),
      emoji(
        'fnd_v2_emoji_colors',
        '4.10',
        'Colors',
        'สี',
        'fnd_v2_emoji_colors',
        ['fnd_v2_basic_colors'],
      ),
      emoji(
        'fnd_v2_emoji_shop',
        '4.11',
        'Things at the Shop',
        'ของในร้าน',
        'fnd_v2_emoji_shop',
        // Soft-lock: unlock from Money while Colors is comingSoon.
        ['money_prices'],
      ),
      lesson(
        'fnd_v2_buying_something',
        '4.12',
        'Buying Something',
        'ซื้อของ',
        // Bypass Colors + Shop emoji until content ships.
        ['money_prices'],
        { comingSoon: false },
      ),
      sayIt(
        'fnd_v2_say_numbers_shopping',
        '4.13',
        'Numbers & Shopping',
        'ตัวเลขและการซื้อของ',
        'fnd_v2_numbers_shopping',
        ['fnd_v2_buying_something'],
        { comingSoon: false },
      ),
      mission(
        'fnd_v2_mission_at_shop',
        '4.14',
        'At the Shop',
        'ที่ร้านค้า',
        'coffee_order_easy',
        ['fnd_v2_say_numbers_shopping'],
        { comingSoon: false },
      ),
    ],
  },
  {
    id: 'talk_about_yourself',
    number: 5,
    emoji: '💬',
    titleEn: 'Talk About Yourself',
    titleTh: 'คุยเรื่องตัวเอง',
    items: [
      lesson(
        'likes_dislikes',
        '5.1',
        'Likes & Dislikes',
        'ชอบและไม่ชอบ',
        ['fnd_v2_mission_at_shop'],
        { comingSoon: false },
      ),
      emoji(
        'fnd_v2_emoji_food_drinks',
        '5.2',
        'Food & Drinks',
        'อาหารและเครื่องดื่ม',
        'fnd_v2_emoji_food_drinks',
        ['likes_dislikes'],
      ),
      lesson(
        'fnd_v2_daily_actions',
        '5.3',
        'Daily Actions',
        'กิจวัตรประจำวัน',
        ['likes_dislikes'],
        { comingSoon: true },
      ),
      emoji(
        'fnd_v2_emoji_daily_actions',
        '5.4',
        'Daily Actions',
        'คำกริยาวัตรประจำวัน',
        'fnd_v2_emoji_daily_actions',
        ['fnd_v2_daily_actions'],
      ),
      lesson(
        'wants_needs',
        '5.5',
        'Wants / Needs / Have',
        'อยากได้ ต้องการ มี',
        // Bypass Food & Drinks + Daily Actions until content ships.
        ['likes_dislikes'],
        { comingSoon: false },
      ),
      lesson(
        'can_cant',
        '5.6',
        'Can / Can’t',
        'สามารถ / ไม่สามารถ',
        ['wants_needs'],
        { comingSoon: false },
      ),
      sayIt(
        'fnd_v2_say_about_me',
        '5.7',
        'About Me',
        'เกี่ยวกับฉัน',
        'fnd_v2_about_me',
        ['can_cant'],
        { comingSoon: false },
      ),
      describeIt(
        'fnd_v2_describe_actions',
        '5.O1',
        'People & Actions',
        'คนและการกระทำ',
        ['fnd_v2_say_about_me'],
      ),
      mission(
        'fnd_v2_mission_talk_yourself',
        '5.8',
        'Talk About Yourself',
        'คุยเรื่องตัวเอง',
        'small_talk_easy',
        ['fnd_v2_say_about_me'],
        { comingSoon: false },
      ),
    ],
  },
  {
    id: 'ask_find_close',
    number: 6,
    emoji: '❓',
    titleEn: 'Ask, Find & Close',
    titleTh: 'ถาม หาทาง และจบ',
    items: [
      lesson(
        'asking_questions',
        '6.1',
        'Asking Questions',
        'การตั้งคำถาม',
        ['fnd_v2_mission_talk_yourself'],
        { comingSoon: false },
      ),
      lesson(
        'fnd_v2_places_directions',
        '6.2',
        'Places & Simple Directions',
        'สถานที่และการบอกทาง',
        ['asking_questions'],
        { comingSoon: true },
      ),
      emoji(
        'fnd_v2_emoji_places',
        '6.3',
        'Places & Transport',
        'สถานที่และการเดินทาง',
        'fnd_v2_emoji_places',
        ['fnd_v2_places_directions'],
      ),
      lesson(
        'fnd_v2_goodbye_closing',
        '6.4',
        'Goodbye & Closing',
        'กล่าวลาและจบสนทนา',
        // Soft-lock: unlock from Asking Questions while Places is comingSoon.
        ['asking_questions'],
        { comingSoon: true },
      ),
      sayIt(
        'fnd_v2_say_ask_me',
        '6.5',
        'Ask & Close',
        'ถามและกล่าวลา',
        'fnd_v2_ask_me',
        // Bypass Places + Goodbye until content ships.
        ['asking_questions'],
        { comingSoon: false },
      ),
      emoji(
        'fnd_v2_emoji_foundation_mix_opt',
        '6.O1',
        'Foundation Mix',
        'ทบทวนคำคละ Foundation',
        'fnd_v2_emoji_foundation_mix',
        ['fnd_v2_say_ask_me'],
        { optional: true, countsTowardProgress: false },
      ),
      sayIt(
        'fnd_v2_say_foundation_challenge',
        '6.6',
        'Foundation Challenge',
        'ท้าทาย Foundation',
        'fnd_v2_foundation_challenge',
        ['fnd_v2_say_ask_me'],
      ),
      mission(
        'fnd_v2_mission_first_day_abroad',
        '6.7',
        'My First Day Abroad',
        'วันแรกในต่างประเทศ',
        'taxi_ride_easy',
        // Bypass Foundation Challenge until pool ships.
        ['fnd_v2_say_ask_me'],
        { comingSoon: false },
      ),
    ],
  },
];

export const FOUNDATION_V2_PATH_ID = 'foundation_v2';
/** Bumped when catalog shape changes (Ch.3 feelings / we-they / emoji unlock). */
export const FOUNDATION_V2_VERSION = 9;

export function flattenFoundationV2Nodes(): FoundationV2NodeDef[] {
  return FOUNDATION_V2_CHAPTERS.flatMap((c) => c.items);
}

export function foundationV2CoreNodeIds(): string[] {
  return flattenFoundationV2Nodes()
    .filter((n) => n.countsTowardProgress)
    .map((n) => n.id);
}

export function foundationV2CoreTotal(): number {
  return foundationV2CoreNodeIds().length;
}

/** Reward gameIds allowed for Foundation path nodes (no open prefix). */
export function isFoundationPathRewardGameId(gameId: string): boolean {
  const nodes = flattenFoundationV2Nodes();
  for (const node of nodes) {
    if (node.id === gameId) return true;
    if (node.topicId && gameId === `say_it:${node.topicId}`) return true;
    if (node.topicId && gameId === node.topicId) return true;
    if (node.poolId && gameId === `emoji_speak:${node.poolId}`) return true;
    if (node.poolId && gameId === node.poolId) return true;
    if (node.reviewId && gameId === node.reviewId) return true;
    if (node.simulationId && gameId === node.simulationId) return true;
  }
  return false;
}
