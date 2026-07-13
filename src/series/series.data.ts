export interface SeriesConfig {
  seriesId: string;
  titleEn: string;
  titleTh: string;
  subtitleTh: string;
  order: number;
  coverImage: string;
  missionIds: string[];
}

export const SERIES: SeriesConfig[] = [
  {
    seriesId: 'everyday_english',
    titleEn: 'Everyday English',
    titleTh: 'ภาษาอังกฤษที่ใช้ในชีวิตประจำวัน',
    subtitleTh: 'ฝึกพูดในสถานการณ์ที่เจอทุกวัน',
    order: 0,
    coverImage: 'category_daily_life',
    missionIds: [
      'coffee_order_easy',
      'restaurant_order_easy',
      'movie_tickets_easy',
    ],
  },
  {
    seriesId: 'travel_essentials',
    titleEn: 'Travel Essentials',
    titleTh: 'อังกฤษสำหรับการเดินทาง',
    subtitleTh: 'เดินทางต่างประเทศได้อย่างมั่นใจ',
    order: 1,
    coverImage: 'category_travel',
    missionIds: [
      'hotel_checkin_easy',
      'taxi_ride_easy',
      'airport_checkin_easy',
    ],
  },
  {
    seriesId: 'business_basics',
    titleEn: 'Business Basics',
    titleTh: 'ภาษาอังกฤษสำหรับการทำงาน',
    subtitleTh: 'สื่อสารในงานได้อย่างมั่นใจ',
    order: 2,
    coverImage: 'category_business',
    missionIds: [
      'business_meeting_easy',
      'business_phone_easy',
      'meet_client_easy',
    ],
  },
  {
    seriesId: 'survival_english',
    titleEn: 'Survival English',
    titleTh: 'อังกฤษเอาตัวรอด',
    subtitleTh: 'เอาตัวรอดเมื่อเกิดเหตุไม่คาดคิด',
    order: 3,
    coverImage: 'category_survival',
    missionIds: [
      'pharmacy_easy',
      'doctor_visit_easy',
      'ask_help_easy',
    ],
  },
];

export function getAllSeries(): SeriesConfig[] {
  return [...SERIES].sort((a, b) => a.order - b.order);
}

export function getSeriesById(seriesId: string): SeriesConfig | undefined {
  return SERIES.find((s) => s.seriesId === seriesId);
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
