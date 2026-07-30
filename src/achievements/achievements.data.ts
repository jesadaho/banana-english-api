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
  | 'max_mission_score'
  | 'no_hint_mission'
  | 'english_only_mission'
  | 'perfect_mission'
  | 'simulation_completed';

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
  /** For explorer / simulation_completed metrics. */
  matchIds?: string[];
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

const TOTAL_LESSONS = LESSON_PROGRESSION_ORDER.length;

export const ACHIEVEMENT_CATALOG: AchievementDef[] = [
  // Getting Started
  {
    achievementId: 'first_hello',
    category: 'getting_started',
    rarity: 'common',
    titleEn: 'First Hello',
    titleTh: 'สวัสดีครั้งแรก',
    descriptionEn: 'Complete your first introduction with Teacher B.',
    descriptionTh: 'คุยแนะนำตัวกับครูบีครั้งแรกสำเร็จ',
    iconKey: 'hand',
    target: 1,
    metric: 'onboarding_completed',
  },
  {
    achievementId: 'first_conversation',
    category: 'getting_started',
    rarity: 'common',
    titleEn: 'First Conversation',
    titleTh: 'บทสนทนาแรก',
    descriptionEn: 'Finish any lesson or mission conversation.',
    descriptionTh: 'จบบทเรียนหรือมิชชันครั้งแรก',
    iconKey: 'speech_bubble',
    target: 1,
    metric: 'any_session_count',
  },
  {
    achievementId: 'mission_complete',
    category: 'getting_started',
    rarity: 'common',
    titleEn: 'Mission Complete',
    titleTh: 'ภารกิจสำเร็จ',
    descriptionEn: 'Complete your first speaking mission.',
    descriptionTh: 'จบมิชชันพูดครั้งแรก',
    iconKey: 'target',
    target: 1,
    metric: 'mission_count',
  },
  {
    achievementId: 'beginner',
    category: 'getting_started',
    rarity: 'common',
    titleEn: 'Beginner',
    titleTh: 'มือใหม่',
    descriptionEn: 'Complete your first lesson.',
    descriptionTh: 'จบบทเรียนแรก',
    iconKey: 'sprout',
    target: 1,
    metric: 'lesson_count',
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
  },

  // Skill
  {
    achievementId: 'crystal_clear',
    category: 'skill',
    rarity: 'rare',
    titleEn: 'Crystal Clear',
    titleTh: 'ชัดเจน',
    descriptionEn: 'Score 90% or higher on a mission.',
    descriptionTh: 'ได้คะแนนมิชชัน 90% ขึ้นไป',
    iconKey: 'crystal',
    target: 90,
    metric: 'max_mission_score',
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
    target: 100,
    metric: 'perfect_mission',
  },

  // Explorer
  {
    achievementId: 'coffee_explorer',
    category: 'explorer',
    rarity: 'common',
    titleEn: 'Coffee Explorer',
    titleTh: 'นักสำรวจกาแฟ',
    descriptionEn: 'Complete the Coffee Order mission.',
    descriptionTh: 'จบมิชชันสั่งกาแฟ',
    iconKey: 'coffee_cup',
    target: 1,
    metric: 'simulation_completed',
    matchIds: ['coffee_order_easy'],
  },
  {
    achievementId: 'restaurant_explorer',
    category: 'explorer',
    rarity: 'common',
    titleEn: 'Restaurant Explorer',
    titleTh: 'นักสำรวจร้านอาหาร',
    descriptionEn: 'Complete the Restaurant Order mission.',
    descriptionTh: 'จบมิชชันสั่งอาหาร',
    iconKey: 'fork_spoon',
    target: 1,
    metric: 'simulation_completed',
    matchIds: ['restaurant_order_easy'],
  },
  {
    achievementId: 'airport_explorer',
    category: 'explorer',
    rarity: 'rare',
    titleEn: 'Airport Explorer',
    titleTh: 'นักสำรวจสนามบิน',
    descriptionEn: 'Complete the Airport Check-in mission.',
    descriptionTh: 'จบมิชชันเช็กอินสนามบิน',
    iconKey: 'airplane',
    target: 1,
    metric: 'simulation_completed',
    matchIds: ['airport_checkin_easy'],
  },
  {
    achievementId: 'hotel_explorer',
    category: 'explorer',
    rarity: 'rare',
    titleEn: 'Hotel Explorer',
    titleTh: 'นักสำรวจโรงแรม',
    descriptionEn: 'Complete the Hotel Check-in mission.',
    descriptionTh: 'จบมิชชันเช็กอินโรงแรม',
    iconKey: 'hotel_bell',
    target: 1,
    metric: 'simulation_completed',
    matchIds: ['hotel_checkin_easy'],
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
