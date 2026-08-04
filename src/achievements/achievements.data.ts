import { LESSON_PROGRESSION_ORDER } from '../lessons/lessons.data';

export type AchievementCategory =
  | 'getting_started'
  | 'learning'
  | 'speaking'
  | 'consistency'
  | 'skill'
  | 'explorer';

export type AchievementRarity = 'common' | 'rare' | 'epic' | 'legendary';

export type AchievementMetric =
  | 'onboarding_completed'
  | 'any_session_count'
  | 'mission_count'
  | 'lesson_count'
  | 'streak_days'
  | 'clear_pronunciation_mission'
  | 'no_hint_mission'
  | 'english_only_mission'
  | 'perfect_mission'
  | 'perfect_vocab_drill'
  | 'simulation_completed'
  /** Progress = how many of matchIds (simulations) the user has completed. */
  | 'all_simulations_completed'
  /** Progress = how many of matchIds (lessons) the user has completed. */
  | 'all_lessons_completed';

export interface AchievementDef {
  achievementId: string;
  category: AchievementCategory;
  rarity: AchievementRarity;
  titleEn: string;
  titleTh: string;
  descriptionEn: string;
  descriptionTh: string;
  iconKey: string;
  target: number;
  metric: AchievementMetric;
  /** For explorer / all_*_completed metrics (simulation or lesson ids). */
  matchIds?: string[];
  /** Banana seeds granted when the user claims this badge. */
  rewardSeeds?: number;
  /** Bananas granted when the user claims this badge. */
  rewardBananas?: number;
  /** Outfit id (see outfit-catalog) granted when the user claims this badge. */
  rewardOutfitId?: string;
}

export const ACHIEVEMENT_CATEGORY_ORDER: AchievementCategory[] = [
  'getting_started',
  'learning',
  'speaking',
  'consistency',
  'skill',
  'explorer',
];

export const ACHIEVEMENT_RARITY_ORDER: AchievementRarity[] = [
  'common',
  'rare',
  'epic',
  'legendary',
];

/** Curriculum lessons for Banana Graduate — exclude pronunciation course. */
const TOTAL_LESSONS = LESSON_PROGRESSION_ORDER.filter(
  (id) => !id.startsWith('pron_'),
).length;

/** Pronunciation course lessons for Clear Voice. */
const PRONUNCIATION_LESSON_IDS = LESSON_PROGRESSION_ORDER.filter((id) =>
  id.startsWith('pron_'),
);

/** Lessons shown in the Basics course catalog (app BasicsLessons). */
const BASICS_LESSON_IDS: string[] = [
  'greetings',
  'introductions',
  'yes_no_maybe',
  'polite_expressions',
  'meet_people',
  'talk_about_groups',
  'ee_about_me_family',
  'numbers',
  'telling_time',
  'everyday_numbers',
  'money_prices',
  'likes_dislikes',
  'wants_needs',
  'can_cant',
  'asking_for_help',
  'asking_questions',
];

export const ACHIEVEMENT_CATALOG: AchievementDef[] = [
  // Getting Started
  {
    achievementId: 'first_hello',
    category: 'getting_started',
    rarity: 'common',
    titleEn: 'First Hello',
    titleTh: 'สวัสดีครั้งแรก',
    descriptionEn: 'Speak your first sentence.',
    descriptionTh: 'พูดประโยคแรก',
    iconKey: 'hand',
    target: 1,
    metric: 'onboarding_completed',
    rewardSeeds: 20,
  },
  {
    achievementId: 'first_lesson',
    category: 'getting_started',
    rarity: 'common',
    titleEn: 'First Lesson',
    titleTh: 'บทเรียนแรก',
    descriptionEn: 'Complete your first lesson.',
    descriptionTh: 'เรียนบทแรกจบ',
    iconKey: 'open_book',
    target: 1,
    metric: 'lesson_count',
    rewardSeeds: 20,
  },
  {
    achievementId: 'first_mission',
    category: 'getting_started',
    rarity: 'common',
    titleEn: 'First Mission',
    titleTh: 'มิชชันแรก',
    descriptionEn: 'Complete your first mission.',
    descriptionTh: 'จบ Mission แรก',
    iconKey: 'target',
    target: 1,
    metric: 'mission_count',
    rewardBananas: 1,
  },
  {
    achievementId: 'beginner',
    category: 'getting_started',
    rarity: 'common',
    titleEn: 'Beginner',
    titleTh: 'มือใหม่',
    descriptionEn: 'Complete the Basic Course.',
    descriptionTh: 'จบ Basic Course',
    iconKey: 'sprout',
    target: BASICS_LESSON_IDS.length,
    metric: 'all_lessons_completed',
    matchIds: BASICS_LESSON_IDS,
    rewardSeeds: 100,
    rewardOutfitId: 'banana_cap',
  },

  // Learning
  {
    achievementId: 'study_time',
    category: 'learning',
    rarity: 'common',
    titleEn: 'Study Time',
    titleTh: 'เวลาเรียน',
    descriptionEn: 'Complete 3 lessons.',
    descriptionTh: 'จบบทเรียนครบ 3 บท',
    iconKey: 'open_book',
    target: 3,
    metric: 'lesson_count',
    rewardSeeds: 30,
  },
  {
    achievementId: 'bookworm',
    category: 'learning',
    rarity: 'rare',
    titleEn: 'Bookworm',
    titleTh: 'หนอนหนังสือ',
    descriptionEn: 'Complete 10 lessons.',
    descriptionTh: 'จบบทเรียนครบ 10 บท',
    iconKey: 'stack_of_books',
    target: 10,
    metric: 'lesson_count',
    rewardSeeds: 50,
  },
  {
    achievementId: 'scholar',
    category: 'learning',
    rarity: 'epic',
    titleEn: 'Scholar',
    titleTh: 'นักเรียนรู้',
    descriptionEn: 'Complete 20 lessons.',
    descriptionTh: 'จบบทเรียนครบ 20 บท',
    iconKey: 'graduation_cap',
    target: 20,
    metric: 'lesson_count',
    rewardSeeds: 100,
  },
  {
    achievementId: 'banana_graduate',
    category: 'learning',
    rarity: 'legendary',
    titleEn: 'Banana Graduate',
    titleTh: 'บัณฑิตกล้วย',
    descriptionEn: 'Complete every lesson in the curriculum.',
    descriptionTh: 'เรียนครบทุกบทในหลักสูตร',
    iconKey: 'trophy',
    target: TOTAL_LESSONS,
    metric: 'lesson_count',
    rewardOutfitId: 'graduation_cap',
  },
  {
    achievementId: 'clear_voice',
    category: 'learning',
    rarity: 'epic',
    titleEn: 'Clear Voice',
    titleTh: 'เสียงชัด',
    descriptionEn: 'Complete the Pronunciation Course.',
    descriptionTh: 'จบคอร์สออกเสียง',
    iconKey: 'microphone',
    target: PRONUNCIATION_LESSON_IDS.length,
    metric: 'all_lessons_completed',
    matchIds: PRONUNCIATION_LESSON_IDS,
    rewardOutfitId: 'studio_microphone',
  },

  // Speaking
  {
    achievementId: 'say_hello',
    category: 'speaking',
    rarity: 'common',
    titleEn: 'Say Hello',
    titleTh: 'ทักทาย',
    descriptionEn: 'Complete 1 speaking session.',
    descriptionTh: 'จบเซสชันพูด 1 ครั้ง',
    iconKey: 'smile',
    target: 1,
    metric: 'any_session_count',
    rewardSeeds: 20,
  },
  {
    achievementId: 'talkative',
    category: 'speaking',
    rarity: 'rare',
    titleEn: 'Talkative',
    titleTh: 'ช่างพูด',
    descriptionEn: 'Complete 10 speaking sessions.',
    descriptionTh: 'จบเซสชันพูดครบ 10 ครั้ง',
    iconKey: 'two_speech_bubbles',
    target: 10,
    metric: 'any_session_count',
    rewardSeeds: 50,
  },
  {
    achievementId: 'smooth_speaker',
    category: 'speaking',
    rarity: 'epic',
    titleEn: 'Smooth Speaker',
    titleTh: 'พูดคล่อง',
    descriptionEn: 'Complete 25 speaking sessions.',
    descriptionTh: 'จบเซสชันพูดครบ 25 ครั้ง',
    iconKey: 'microphone',
    target: 25,
    metric: 'any_session_count',
    rewardSeeds: 100,
  },
  {
    achievementId: 'conversation_master',
    category: 'speaking',
    rarity: 'legendary',
    titleEn: 'Conversation Master',
    titleTh: 'ราชาสนทนา',
    descriptionEn: 'Complete 50 speaking sessions.',
    descriptionTh: 'จบเซสชันพูดครบ 50 ครั้ง',
    iconKey: 'crown',
    target: 50,
    metric: 'any_session_count',
    rewardOutfitId: 'headphones',
  },

  // Consistency
  {
    achievementId: 'streak_3',
    category: 'consistency',
    rarity: 'common',
    titleEn: '3 Day Streak',
    titleTh: 'ต่อเนื่อง 3 วัน',
    descriptionEn: 'Reach a 3-day learning streak.',
    descriptionTh: 'เรียนต่อเนื่องครบ 3 วัน',
    iconKey: 'fire_3',
    target: 3,
    metric: 'streak_days',
    rewardSeeds: 30,
  },
  {
    achievementId: 'streak_7',
    category: 'consistency',
    rarity: 'rare',
    titleEn: '7 Day Streak',
    titleTh: 'ต่อเนื่อง 7 วัน',
    descriptionEn: 'Reach a 7-day learning streak.',
    descriptionTh: 'เรียนต่อเนื่องครบ 7 วัน',
    iconKey: 'fire_7',
    target: 7,
    metric: 'streak_days',
    rewardSeeds: 50,
  },
  {
    achievementId: 'streak_14',
    category: 'consistency',
    rarity: 'epic',
    titleEn: '14 Day Streak',
    titleTh: 'ต่อเนื่อง 14 วัน',
    descriptionEn: 'Reach a 14-day learning streak.',
    descriptionTh: 'เรียนต่อเนื่องครบ 14 วัน',
    iconKey: 'fire_14',
    target: 14,
    metric: 'streak_days',
    rewardSeeds: 100,
  },
  {
    achievementId: 'streak_30',
    category: 'consistency',
    rarity: 'legendary',
    titleEn: '30 Day Streak',
    titleTh: 'ต่อเนื่อง 30 วัน',
    descriptionEn: 'Reach a 30-day learning streak.',
    descriptionTh: 'เรียนต่อเนื่องครบ 30 วัน',
    iconKey: 'fire_30',
    target: 30,
    metric: 'streak_days',
    rewardOutfitId: 'flame_jacket',
  },

  // Skill
  {
    achievementId: 'crystal_clear',
    category: 'skill',
    rarity: 'rare',
    titleEn: 'Crystal Clear',
    titleTh: 'ชัดเจน',
    descriptionEn: 'Complete a mission without any pronunciation mistakes.',
    descriptionTh: 'จบมิชชันโดยออกเสียงไม่ผิดเลย',
    iconKey: 'crystal',
    target: 1,
    metric: 'clear_pronunciation_mission',
    rewardSeeds: 50,
  },
  {
    achievementId: 'no_hint_hero',
    category: 'skill',
    rarity: 'epic',
    titleEn: 'No Hint Hero',
    titleTh: 'ฮีโร่ไม่ใช้ใบ้',
    descriptionEn: 'Complete a mission without opening hints.',
    descriptionTh: 'จบมิชชันโดยไม่เปิดใบ้เลย',
    iconKey: 'shield_check',
    target: 1,
    metric: 'no_hint_mission',
    rewardSeeds: 50,
  },
  {
    achievementId: 'english_only',
    category: 'skill',
    rarity: 'epic',
    titleEn: 'English Only',
    titleTh: 'อังกฤษล้วน',
    descriptionEn: 'Complete a mission without Thai Mix.',
    descriptionTh: 'จบมิชชันโดยไม่ใช้ Thai Mix',
    iconKey: 'speech_bubble_en',
    target: 1,
    metric: 'english_only_mission',
    rewardSeeds: 50,
  },
  {
    achievementId: 'perfect_mission',
    category: 'skill',
    rarity: 'legendary',
    titleEn: 'Perfect Mission',
    titleTh: 'มิชชันสมบูรณ์',
    descriptionEn: 'Score 100% on a mission.',
    descriptionTh: 'ได้คะแนนมิชชันเต็ม 100%',
    iconKey: 'bullseye',
    target: 1,
    metric: 'perfect_mission',
    rewardSeeds: 50,
  },
  {
    achievementId: 'perfect_drill',
    category: 'skill',
    rarity: 'rare',
    titleEn: 'Perfect Drill',
    titleTh: 'ดริลเป๊ะ',
    descriptionEn: 'Complete a Vocab Drill with no mistakes.',
    descriptionTh: 'จบ Vocab Drill โดยไม่ผิดเลย',
    iconKey: 'crystal',
    target: 1,
    metric: 'perfect_vocab_drill',
    rewardSeeds: 50,
  },

  // Explorer — one badge per mission category (complete every mission in it)
  {
    achievementId: 'daily_life_explorer',
    category: 'explorer',
    rarity: 'common',
    titleEn: 'Daily Life Explorer',
    titleTh: 'นักสำรวจชีวิตประจำวัน',
    descriptionEn: 'Complete every Daily Life mission.',
    descriptionTh: 'จบมิชชันในหมวดชีวิตประจำวันครบทุกอัน',
    iconKey: 'coffee_cup',
    target: 3,
    metric: 'all_simulations_completed',
    matchIds: [
      'coffee_order_easy',
      'restaurant_order_easy',
      'movie_tickets_easy',
    ],
    rewardSeeds: 50,
  },
  {
    achievementId: 'travel_explorer',
    category: 'explorer',
    rarity: 'rare',
    titleEn: 'Travel Explorer',
    titleTh: 'นักสำรวจการเดินทาง',
    descriptionEn: 'Complete every Travel mission.',
    descriptionTh: 'จบมิชชันในหมวดการเดินทางครบทุกอัน',
    iconKey: 'airplane',
    target: 3,
    metric: 'all_simulations_completed',
    matchIds: [
      'airport_checkin_easy',
      'taxi_ride_easy',
      'hotel_checkin_easy',
    ],
    rewardSeeds: 50,
  },
  {
    achievementId: 'social_explorer',
    category: 'explorer',
    rarity: 'common',
    titleEn: 'Social Explorer',
    titleTh: 'นักสำรวจสังคม',
    descriptionEn: 'Complete every Social mission.',
    descriptionTh: 'จบมิชชันในหมวดสังคมครบทุกอัน',
    iconKey: 'two_speech_bubbles',
    target: 3,
    metric: 'all_simulations_completed',
    matchIds: [
      'meet_new_friend_easy',
      'small_talk_easy',
      'join_english_club_easy',
    ],
    rewardSeeds: 50,
  },
  {
    achievementId: 'work_career_explorer',
    category: 'explorer',
    rarity: 'rare',
    titleEn: 'Work Explorer',
    titleTh: 'นักสำรวจงานและอาชีพ',
    descriptionEn: 'Complete every Work & Career mission.',
    descriptionTh: 'จบมิชชันในหมวดงานและอาชีพครบทุกอัน',
    iconKey: 'briefcase',
    target: 3,
    metric: 'all_simulations_completed',
    matchIds: [
      'meet_client_easy',
      'business_meeting_easy',
      'business_phone_easy',
    ],
    rewardSeeds: 50,
  },
  {
    achievementId: 'survival_explorer',
    category: 'explorer',
    rarity: 'epic',
    titleEn: 'Survival Explorer',
    titleTh: 'นักสำรวจเอาตัวรอด',
    descriptionEn: 'Complete every Survival mission.',
    descriptionTh: 'จบมิชชันในหมวดเอาตัวรอดครบทุกอัน',
    iconKey: 'emergency',
    target: 3,
    metric: 'all_simulations_completed',
    matchIds: [
      'doctor_visit_easy',
      'ask_help_easy',
      'pharmacy_easy',
    ],
    rewardSeeds: 50,
  },
];

export function getAchievementById(
  achievementId: string,
): AchievementDef | undefined {
  return ACHIEVEMENT_CATALOG.find((a) => a.achievementId === achievementId);
}

export function getAllAchievements(): AchievementDef[] {
  return ACHIEVEMENT_CATALOG;
}
