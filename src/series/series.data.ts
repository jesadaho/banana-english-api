export interface SeriesConfig {
  seriesId: string;
  titleEn: string;
  titleTh: string;
  subtitleTh: string;
  order: number;
  coverImage: string;
  missionIds: string[];
}

/** Maps retired series IDs to the current catalog (prefs / deep links). */
export const LEGACY_SERIES_ID_ALIASES: Record<string, string> = {
  everyday_english: 'daily_life',
  travel_essentials: 'travel',
  business_basics: 'work_career',
  social_english: 'social',
  survival_english: 'survival',
};

export const SERIES: SeriesConfig[] = [
  {
    seriesId: 'social',
    titleEn: 'Social',
    titleTh: 'สังคม',
    subtitleTh: 'คุยกับคนใหม่และฝึกบทสนทนาในสังคม',
    order: 0,
    coverImage: 'category_social',
    missionIds: [
      'meet_new_friend_easy',
      'join_english_club_easy',
      'small_talk_easy',
    ],
  },
  {
    seriesId: 'daily_life',
    titleEn: 'Daily Life',
    titleTh: 'ชีวิตประจำวัน',
    subtitleTh: 'ฝึกพูดในสถานการณ์ที่เจอทุกวัน',
    order: 1,
    coverImage: 'category_daily_life',
    missionIds: [
      'coffee_order_easy',
      'restaurant_order_easy',
      'movie_tickets_easy',
    ],
  },
  {
    seriesId: 'travel',
    titleEn: 'Travel',
    titleTh: 'การเดินทาง',
    subtitleTh: 'เดินทางต่างประเทศได้อย่างมั่นใจ',
    order: 2,
    coverImage: 'category_travel',
    missionIds: [
      'airport_checkin_easy',
      'taxi_ride_easy',
      'hotel_checkin_easy',
    ],
  },
  {
    seriesId: 'work_career',
    titleEn: 'Work & Career',
    titleTh: 'งานและอาชีพ',
    subtitleTh: 'สื่อสารในงานได้อย่างมั่นใจ',
    order: 3,
    coverImage: 'category_business',
    missionIds: [
      'meet_client_easy',
      'business_meeting_easy',
      'business_phone_easy',
    ],
  },
  {
    seriesId: 'survival',
    titleEn: 'Survival',
    titleTh: 'เอาตัวรอด',
    subtitleTh: 'เอาตัวรอดเมื่อเกิดเหตุไม่คาดคิด',
    order: 4,
    coverImage: 'category_survival',
    missionIds: [
      'doctor_visit_easy',
      'ask_help_easy',
      'pharmacy_easy',
    ],
  },
];

export function resolveSeriesId(seriesId: string): string {
  return LEGACY_SERIES_ID_ALIASES[seriesId] ?? seriesId;
}

export function getAllSeries(): SeriesConfig[] {
  return [...SERIES].sort((a, b) => a.order - b.order);
}

export function getSeriesById(seriesId: string): SeriesConfig | undefined {
  const resolved = resolveSeriesId(seriesId);
  return SERIES.find((s) => s.seriesId === resolved);
}

export function getSeriesForSimulation(
  simulationId: string,
): SeriesConfig | undefined {
  return SERIES.find((s) => s.missionIds.includes(simulationId));
}

export function getPreviousSeries(
  series: SeriesConfig,
): SeriesConfig | undefined {
  return SERIES.find((s) => s.order === series.order - 1);
}
