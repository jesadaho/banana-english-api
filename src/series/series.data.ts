export interface SeriesConfig {
  seriesId: string;
  titleEn: string;
  titleTh: string;
  subtitleTh: string;
  order: number;
  coverImage: string;
  missionIds: string[];
  /**
   * When false, series stays available for activity / simulation lookup
   * but is hidden from the Mission tab catalog (missions live under Learn).
   */
  showInMissionTab?: boolean;
}

/** Maps retired series IDs to the current catalog (prefs / deep links). */
export const LEGACY_SERIES_ID_ALIASES: Record<string, string> = {
  everyday_english: 'everyday_life',
  daily_life: 'everyday_life',
  travel: 'everyday_life',
  travel_essentials: 'everyday_life',
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
    // Learn → Everyday English → Everyday Life challenges (not on Mission tab).
    seriesId: 'everyday_life',
    titleEn: 'Everyday Life',
    titleTh: 'ชีวิตประจำวัน',
    subtitleTh: 'ฝึกพูดในสถานการณ์รอบตัวและตอนเดินทาง',
    order: 1,
    coverImage: 'category_daily_life',
    showInMissionTab: false,
    missionIds: [
      'coffee_order_easy',
      'restaurant_order_easy',
      'movie_tickets_easy',
      'taxi_ride_easy',
      'hotel_checkin_easy',
      'airport_checkin_easy',
    ],
  },
  {
    seriesId: 'work_career',
    titleEn: 'Work & Career',
    titleTh: 'งานและอาชีพ',
    subtitleTh: 'สื่อสารในงานได้อย่างมั่นใจ',
    order: 2,
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
    order: 3,
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

/** Series shown on the Mission tab (Learn-hosted challenges excluded). */
export function getMissionTabSeries(): SeriesConfig[] {
  return getAllSeries().filter((s) => s.showInMissionTab !== false);
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
  const catalog = getMissionTabSeries();
  const index = catalog.findIndex((s) => s.seriesId === series.seriesId);
  if (index <= 0) return undefined;
  return catalog[index - 1];
}
